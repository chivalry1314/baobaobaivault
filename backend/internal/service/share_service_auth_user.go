package service

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/baobaobai/baobaobaivault/internal/config"
	"github.com/baobaobai/baobaobaivault/internal/model"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

const shareEmailVerificationPurposeRegister = "register"
const shareEmailVerificationRetention = 7 * 24 * time.Hour
const shareAuthSettingsSingleton = "default"

func (s *ShareService) GetShareAuthConfig() ShareAuthConfigView {
	cfg := s.currentShareAuthConfig()
	return ShareAuthConfigView{
		EmailVerificationEnabled:  cfg.EmailVerificationEnabled,
		VerificationCodeTTLSeconds: cfg.VerificationCodeTTLSeconds,
		ResendIntervalSeconds:     cfg.ResendIntervalSeconds,
	}
}

func (s *ShareService) GetShareEmailHealth() ShareEmailHealthView {
	health := ShareEmailHealthView{
		EmailVerificationEnabled: s.currentShareAuthConfig().EmailVerificationEnabled,
	}
	if s.emailService == nil {
		return health
	}
	return s.emailService.HealthView(s.currentShareAuthConfig().EmailVerificationEnabled)
}

func (s *ShareService) GetShareAuthSettings(ctx context.Context, operatorID string) (*ShareAuthSettingsView, error) {
	if err := s.ensureShareManagerRole(ctx, operatorID); err != nil {
		return nil, err
	}
	cfg := s.currentShareAuthConfig()
	return &ShareAuthSettingsView{
		EmailVerificationEnabled:  cfg.EmailVerificationEnabled,
		VerificationCodeTTLSeconds: cfg.VerificationCodeTTLSeconds,
		ResendIntervalSeconds:     cfg.ResendIntervalSeconds,
		MaxVerifyAttempts:         cfg.MaxVerifyAttempts,
		CanUpdate:                 s.isConfiguredShareSuperAdminUserID(ctx, operatorID),
	}, nil
}

func (s *ShareService) UpdateShareAuthSettings(ctx context.Context, input ShareUpdateAuthSettingsInput) (*ShareAuthSettingsView, error) {
	operatorID := strings.TrimSpace(input.OperatorID)
	if operatorID == "" {
		return nil, ErrShareUserNotFound
	}
	if err := s.ensureConfiguredShareSuperAdminByUserID(ctx, operatorID); err != nil {
		return nil, err
	}

	nextCfg, err := normalizeRuntimeShareAuthConfig(config.ShareAuthConfig{
		EmailVerificationEnabled:  input.EmailVerificationEnabled,
		VerificationCodeTTLSeconds: input.VerificationCodeTTLSeconds,
		ResendIntervalSeconds:     input.ResendIntervalSeconds,
		MaxVerifyAttempts:         input.MaxVerifyAttempts,
	}, s.emailService)
	if err != nil {
		return nil, err
	}

	record := model.ShareAuthSettings{
		Singleton:                 shareAuthSettingsSingleton,
		EmailVerificationEnabled:  nextCfg.EmailVerificationEnabled,
		VerificationCodeTTLSeconds: nextCfg.VerificationCodeTTLSeconds,
		ResendIntervalSeconds:     nextCfg.ResendIntervalSeconds,
		MaxVerifyAttempts:         nextCfg.MaxVerifyAttempts,
	}
	if err := s.db.WithContext(ctx).
		Where("singleton = ?", shareAuthSettingsSingleton).
		Assign(record).
		FirstOrCreate(&record).Error; err != nil {
		return nil, err
	}
	s.setShareAuthConfig(nextCfg)

	return &ShareAuthSettingsView{
		EmailVerificationEnabled:  nextCfg.EmailVerificationEnabled,
		VerificationCodeTTLSeconds: nextCfg.VerificationCodeTTLSeconds,
		ResendIntervalSeconds:     nextCfg.ResendIntervalSeconds,
		MaxVerifyAttempts:         nextCfg.MaxVerifyAttempts,
		CanUpdate:                 true,
	}, nil
}

func (s *ShareService) RegisterExternalUser(ctx context.Context, emailRaw, nicknameRaw, password string) (*ShareRegistrationResult, error) {
	if err := s.cleanupShareEmailVerifications(ctx); err != nil {
		return nil, err
	}

	email, nickname, password, err := s.validateShareRegistrationInput(emailRaw, nicknameRaw, password)
	if err != nil {
		return nil, err
	}

	cfg := s.currentShareAuthConfig()
	if !cfg.EmailVerificationEnabled {
		user, err := s.createVerifiedExternalUser(ctx, email, nickname, password)
		if err != nil {
			return nil, err
		}
		sessionUser := toShareSessionUser(&user)
		return &ShareRegistrationResult{
			User:                 &sessionUser,
			VerificationRequired: false,
		}, nil
	}

	expiresIn, err := s.createOrRefreshEmailVerification(ctx, email, nickname, password)
	if err != nil {
		return nil, err
	}

	return &ShareRegistrationResult{
		VerificationRequired: true,
		Email:                email,
		ExpiresInSeconds:     expiresIn,
	}, nil
}

func (s *ShareService) VerifyExternalUserRegistration(ctx context.Context, emailRaw, codeRaw string) (*ShareSessionUser, error) {
	if err := s.cleanupShareEmailVerifications(ctx); err != nil {
		return nil, err
	}

	email, err := normalizeShareExternalEmail(emailRaw)
	if err != nil {
		return nil, err
	}
	code := normalizeVerificationCode(codeRaw)
	if code == "" {
		return nil, ErrShareVerificationInvalid
	}

	now := time.Now().UTC()
	var sessionUser *ShareSessionUser
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var verification model.ShareEmailVerification
		if err := tx.
			Where("email = ? AND purpose = ? AND consumed_at IS NULL", email, shareEmailVerificationPurposeRegister).
			Order("created_at DESC").
			First(&verification).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrShareVerificationRequired
			}
			return err
		}

		if verification.ExpiresAt.Before(now) {
			return ErrShareVerificationExpired
		}
		cfg := s.currentShareAuthConfig()
		if verification.AttemptCount >= cfg.MaxVerifyAttempts {
			return ErrShareVerificationTooMany
		}
		if !checkVerificationCodeHash(code, verification.CodeHash) {
			if err := tx.Model(&model.ShareEmailVerification{}).
				Where("id = ?", verification.ID).
				Update("attempt_count", gorm.Expr("attempt_count + 1")).Error; err != nil {
				return err
			}
			return ErrShareVerificationInvalid
		}

		user, err := s.createExternalUserTx(tx, email, verification.Nickname, verification.PasswordHash, true)
		if err != nil {
			return err
		}

		consumedAt := now
		if err := tx.Model(&model.ShareEmailVerification{}).
			Where("email = ? AND purpose = ? AND consumed_at IS NULL", email, shareEmailVerificationPurposeRegister).
			Updates(map[string]any{
				"consumed_at": consumedAt,
				"updated_at":  consumedAt,
			}).Error; err != nil {
			return err
		}

		view := toShareSessionUser(&user)
		sessionUser = &view
		return nil
	})
	if err != nil {
		return nil, err
	}

	return sessionUser, nil
}

func (s *ShareService) ResendExternalUserRegistrationVerification(ctx context.Context, emailRaw string) (int, error) {
	if err := s.cleanupShareEmailVerifications(ctx); err != nil {
		return 0, err
	}

	email, err := normalizeShareExternalEmail(emailRaw)
	if err != nil {
		return 0, err
	}
	if !s.currentShareAuthConfig().EmailVerificationEnabled {
		return 0, ErrShareVerificationRequired
	}

	var verification model.ShareEmailVerification
	if err := s.db.WithContext(ctx).
		Where("email = ? AND purpose = ? AND consumed_at IS NULL", email, shareEmailVerificationPurposeRegister).
		Order("created_at DESC").
		First(&verification).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return 0, ErrShareVerificationRequired
		}
		return 0, err
	}

	passwordHash := strings.TrimSpace(verification.PasswordHash)
	if !isBcryptHash(passwordHash) {
		return 0, ErrShareVerificationRequired
	}

	return s.createOrRefreshEmailVerificationFromHash(ctx, email, verification.Nickname, passwordHash)
}

func (s *ShareService) ContinueExternalUser(ctx context.Context, emailRaw, passwordRaw string) (*ShareSessionUser, bool, error) {
	email, err := normalizeShareExternalEmail(emailRaw)
	if err != nil {
		return nil, false, err
	}

	password := strings.TrimSpace(passwordRaw)
	if password == "" {
		return nil, false, ErrShareAuthFailed
	}

	var user model.ShareExternalUser
	if err := s.db.WithContext(ctx).First(&user, "email = ?", email).Error; err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, false, err
		}
		if s.currentShareAuthConfig().EmailVerificationEnabled {
			return nil, false, ErrShareVerificationRequired
		}

		nickname := defaultShareNicknameFromEmail(email)
		user, err = s.createVerifiedExternalUser(ctx, email, nickname, password)
		if err != nil {
			if errors.Is(err, ErrShareEmailExists) {
				existingUser, authErr := s.AuthenticateExternalUser(ctx, email, password)
				if authErr != nil {
					return nil, false, authErr
				}
				return existingUser, false, nil
			}
			return nil, false, err
		}

		now := time.Now().UTC()
		user.LastLoginAt = &now
		_ = s.db.WithContext(ctx).Model(&model.ShareExternalUser{}).
			Where("id = ?", user.ID).
			Update("last_login_at", now).Error

		sessionUser := toShareSessionUser(&user)
		return &sessionUser, true, nil
	}

	if user.Status != model.ShareExternalUserStatusActive || !user.CheckPassword(password) {
		return nil, false, ErrShareAuthFailed
	}
	if s.currentShareAuthConfig().EmailVerificationEnabled && !user.EmailVerified {
		return nil, false, ErrShareEmailNotVerified
	}

	if err := s.ensureManagerRoleByEmailIfNeeded(ctx, &user); err != nil {
		return nil, false, err
	}

	now := time.Now().UTC()
	user.LastLoginAt = &now
	_ = s.db.WithContext(ctx).Model(&model.ShareExternalUser{}).
		Where("id = ?", user.ID).
		Update("last_login_at", now).Error

	sessionUser := toShareSessionUser(&user)
	return &sessionUser, false, nil
}

func (s *ShareService) AuthenticateExternalUser(ctx context.Context, emailRaw, password string) (*ShareSessionUser, error) {
	email, err := normalizeShareExternalEmail(emailRaw)
	if err != nil || strings.TrimSpace(password) == "" {
		return nil, ErrShareAuthFailed
	}

	var user model.ShareExternalUser
	if err := s.db.WithContext(ctx).First(&user, "email = ?", email).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrShareAuthFailed
		}
		return nil, err
	}
	if user.Status != model.ShareExternalUserStatusActive || !user.CheckPassword(password) {
		return nil, ErrShareAuthFailed
	}
	if s.currentShareAuthConfig().EmailVerificationEnabled && !user.EmailVerified {
		return nil, ErrShareEmailNotVerified
	}

	if err := s.ensureManagerRoleByEmailIfNeeded(ctx, &user); err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	_ = s.db.WithContext(ctx).Model(&model.ShareExternalUser{}).
		Where("id = ?", user.ID).
		Update("last_login_at", now).Error

	sessionUser := toShareSessionUser(&user)
	return &sessionUser, nil
}

func (s *ShareService) GetSessionUser(ctx context.Context, userID string) (*ShareSessionUser, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return nil, nil
	}

	var user model.ShareExternalUser
	if err := s.db.WithContext(ctx).First(&user, "id = ?", userID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	if user.Status != model.ShareExternalUserStatusActive {
		return nil, nil
	}
	if s.currentShareAuthConfig().EmailVerificationEnabled && !user.EmailVerified {
		return nil, nil
	}

	if err := s.ensureManagerRoleByEmailIfNeeded(ctx, &user); err != nil {
		return nil, err
	}

	sessionUser := toShareSessionUser(&user)
	return &sessionUser, nil
}

func (s *ShareService) ListUsersForRoleManage(ctx context.Context, input ShareListUsersForRoleManageInput) ([]ShareUserRoleManageItem, int64, error) {
	if err := s.ensureShareManagerRole(ctx, input.OperatorID); err != nil {
		return nil, 0, err
	}

	page := input.Page
	if page <= 0 {
		page = 1
	}
	pageSize := input.PageSize
	if pageSize <= 0 {
		pageSize = 10
	}
	if pageSize > 100 {
		pageSize = 100
	}

	keyword := strings.ToLower(strings.TrimSpace(input.Keyword))
	rawRole := strings.ToLower(strings.TrimSpace(input.Role))
	role := ""
	if rawRole != "" {
		if !isValidShareExternalUserRole(rawRole) {
			return nil, 0, ErrShareInvalidUserRole
		}
		role = normalizeShareExternalUserRole(rawRole)
	}

	query := s.db.WithContext(ctx).
		Model(&model.ShareExternalUser{}).
		Where("status = ?", model.ShareExternalUserStatusActive)

	if role != "" {
		query = query.Where("role = ?", role)
	}
	if keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where(
			"lower(email) LIKE ? OR lower(username) LIKE ? OR lower(nickname) LIKE ?",
			like,
			like,
			like,
		)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if total == 0 {
		return []ShareUserRoleManageItem{}, 0, nil
	}

	offset := (page - 1) * pageSize
	rows := make([]model.ShareExternalUser, 0, pageSize)
	if err := query.
		Order("created_at DESC").
		Offset(offset).
		Limit(pageSize).
		Find(&rows).Error; err != nil {
		return nil, 0, err
	}

	items := make([]ShareUserRoleManageItem, 0, len(rows))
	for _, row := range rows {
		items = append(items, ShareUserRoleManageItem{
			ID:        row.ID,
			Email:     row.Email,
			Username:  row.Username,
			Nickname:  row.NormalizedDisplayName(),
			Role:      normalizeShareExternalUserRole(row.Role),
			Status:    strings.TrimSpace(row.Status),
			CreatedAt: row.CreatedAt,
		})
	}
	return items, total, nil
}

func (s *ShareService) UpdateUserRole(ctx context.Context, input ShareUpdateUserRoleInput) (*ShareSessionUser, error) {
	operatorID := strings.TrimSpace(input.OperatorID)
	targetUserID := strings.TrimSpace(input.UserID)
	rawRole := strings.ToLower(strings.TrimSpace(input.Role))
	if !isValidShareExternalUserRole(rawRole) {
		return nil, ErrShareInvalidUserRole
	}
	nextRole := normalizeShareExternalUserRole(rawRole)
	if targetUserID == "" {
		return nil, ErrShareUserNotFound
	}

	var updated model.ShareExternalUser
	if err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := s.ensureShareManagerRoleTx(tx, operatorID); err != nil {
			return err
		}
		if operatorID == targetUserID && nextRole != model.ShareExternalUserRoleManager {
			return ErrShareSelfRoleDowngrade
		}

		var user model.ShareExternalUser
		if err := tx.First(&user, "id = ?", targetUserID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrShareUserNotFound
			}
			return err
		}

		user.Role = nextRole
		user.UpdatedAt = time.Now().UTC()
		if err := tx.Save(&user).Error; err != nil {
			return err
		}
		updated = user
		return nil
	}); err != nil {
		return nil, err
	}

	view := toShareSessionUser(&updated)
	return &view, nil
}

func (s *ShareService) UpdateExternalUserProfile(ctx context.Context, input ShareUpdateProfileInput) (*ShareSessionUser, error) {
	userID := strings.TrimSpace(input.UserID)
	if userID == "" {
		return nil, ErrShareUserNotFound
	}

	nickname := strings.TrimSpace(input.Nickname)
	if err := validateShareNickname(nickname); err != nil {
		return nil, err
	}

	bio := strings.TrimSpace(input.Bio)
	if err := validateShareBio(bio); err != nil {
		return nil, err
	}

	phone := strings.TrimSpace(input.Phone)
	if err := validateSharePhone(phone); err != nil {
		return nil, err
	}

	var updated model.ShareExternalUser
	if err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var user model.ShareExternalUser
		if err := tx.First(&user, "id = ?", userID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrShareUserNotFound
			}
			return err
		}

		avatar, err := s.normalizeProfileAsset(user.ID, "avatar", input.Avatar)
		if err != nil {
			return err
		}

		coverImage, err := s.normalizeProfileAsset(user.ID, "cover", input.CoverImage)
		if err != nil {
			return err
		}

		user.Nickname = nickname
		user.Avatar = avatar
		user.Bio = bio
		user.CoverImage = coverImage
		user.Phone = phone

		if err := tx.Save(&user).Error; err != nil {
			return err
		}

		updated = user
		return nil
	}); err != nil {
		return nil, err
	}

	sessionUser := toShareSessionUser(&updated)
	return &sessionUser, nil
}

func (s *ShareService) DeleteUserForManage(ctx context.Context, input ShareDeleteUserInput) error {
	operatorID := strings.TrimSpace(input.OperatorID)
	targetUserID := strings.TrimSpace(input.UserID)
	if targetUserID == "" {
		return ErrShareUserNotFound
	}
	if operatorID == targetUserID {
		return ErrShareSelfDelete
	}

	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := s.ensureShareManagerRoleTx(tx, operatorID); err != nil {
			return err
		}

		var target model.ShareExternalUser
		if err := tx.First(&target, "id = ?", targetUserID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrShareUserNotFound
			}
			return err
		}
		if s.isConfiguredShareSuperAdminEmail(target.Email) {
			return ErrShareProtectedSuperAdmin
		}

		if normalizeShareExternalUserRole(target.Role) == model.ShareExternalUserRoleManager {
			var managerCount int64
			if err := tx.Model(&model.ShareExternalUser{}).
				Where("role = ? AND status = ?", model.ShareExternalUserRoleManager, model.ShareExternalUserStatusActive).
				Count(&managerCount).Error; err != nil {
				return err
			}
			if managerCount <= 1 {
				return ErrShareLastManagerDelete
			}
		}

		return s.softDeleteExternalUserTx(tx, &target, "creator account deleted")
	})
}

func (s *ShareService) DeleteOwnExternalUser(ctx context.Context, input ShareSelfDeleteInput) error {
	userID := strings.TrimSpace(input.UserID)
	if userID == "" {
		return ErrShareUserNotFound
	}
	password := strings.TrimSpace(input.OldPassword)
	if password == "" {
		return ErrShareDeleteAuthFailed
	}

	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var user model.ShareExternalUser
		if err := tx.First(&user, "id = ?", userID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrShareUserNotFound
			}
			return err
		}
		if !user.CheckPassword(password) {
			return ErrShareDeleteAuthFailed
		}
		if s.isConfiguredShareSuperAdminEmail(user.Email) {
			return ErrShareProtectedSuperAdmin
		}
		return s.softDeleteExternalUserTx(tx, &user, "account self deleted")
	})
}

func (s *ShareService) softDeleteExternalUserTx(tx *gorm.DB, user *model.ShareExternalUser, reviewReason string) error {
	if tx == nil || user == nil {
		return ErrShareUserNotFound
	}

	now := time.Now().UTC()
	if err := tx.Model(&model.SharePlatformCard{}).
		Where("creator_external_user_id = ?", user.ID).
		Updates(map[string]any{
			"visibility":    model.SharePlatformCardVisibilityPrivate,
			"status":        model.SharePlatformCardStatusArchived,
			"review_status": model.SharePlatformCardReviewStatusRejected,
			"review_reason": reviewReason,
			"updated_at":    now,
		}).Error; err != nil {
		return err
	}
	if err := s.removeProfileAssets(user.ID); err != nil {
		return ErrShareSaveFileFailed
	}

	releasedEmail := fmt.Sprintf("deleted+%s@share.invalid", strings.ToLower(strings.TrimSpace(user.ID)))
	releasedUsername := fmt.Sprintf("deleted_%s", strings.ReplaceAll(strings.ToLower(strings.TrimSpace(user.ID)), "-", ""))
	if len(releasedUsername) > 40 {
		releasedUsername = releasedUsername[:40]
	}

	if err := tx.Model(&model.ShareExternalUser{}).
		Where("id = ?", user.ID).
		Updates(map[string]any{
			"email":             releasedEmail,
			"username":          releasedUsername,
			"nickname":          "已注销用户",
			"avatar":            "",
			"bio":               "",
			"cover_image":       "",
			"phone":             "",
			"status":            model.ShareExternalUserStatusInactive,
			"email_verified":    false,
			"email_verified_at": nil,
			"updated_at":        now,
		}).Error; err != nil {
		return err
	}

	return tx.Delete(user).Error
}

func (s *ShareService) ChangeExternalUserPassword(ctx context.Context, input ShareChangePasswordInput) error {
	userID := strings.TrimSpace(input.UserID)
	if userID == "" {
		return ErrShareUserNotFound
	}

	if len(strings.TrimSpace(input.NewPassword)) < 6 {
		return ErrShareWeakPassword
	}

	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var user model.ShareExternalUser
		if err := tx.First(&user, "id = ?", userID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrShareUserNotFound
			}
			return err
		}

		if !user.CheckPassword(input.OldPassword) {
			return ErrShareInvalidOldPassword
		}

		if err := user.SetPassword(input.NewPassword); err != nil {
			return err
		}

		return tx.Model(&model.ShareExternalUser{}).
			Where("id = ?", user.ID).
			Update("password", user.Password).Error
	})
}

func (s *ShareService) ensureShareManagerRole(ctx context.Context, userID string) error {
	var user model.ShareExternalUser
	if err := s.db.WithContext(ctx).First(&user, "id = ?", strings.TrimSpace(userID)).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrShareUserNotFound
		}
		return err
	}
	if !isShareManagerRole(user.Role) {
		return ErrShareForbiddenRole
	}
	return nil
}

func (s *ShareService) ensureShareManagerRoleTx(tx *gorm.DB, userID string) error {
	var user model.ShareExternalUser
	if err := tx.First(&user, "id = ?", strings.TrimSpace(userID)).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrShareUserNotFound
		}
		return err
	}
	if !isShareManagerRole(user.Role) {
		return ErrShareForbiddenRole
	}
	return nil
}

func (s *ShareService) ensureShareCreatorRole(ctx context.Context, userID string) error {
	var user model.ShareExternalUser
	if err := s.db.WithContext(ctx).First(&user, "id = ?", strings.TrimSpace(userID)).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrShareUserNotFound
		}
		return err
	}
	if !isShareCreatorRole(user.Role) {
		return ErrShareForbiddenRole
	}
	return nil
}

func (s *ShareService) ensureShareCreatorRoleTx(tx *gorm.DB, userID string) error {
	var user model.ShareExternalUser
	if err := tx.First(&user, "id = ?", strings.TrimSpace(userID)).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrShareUserNotFound
		}
		return err
	}
	if !isShareCreatorRole(user.Role) {
		return ErrShareForbiddenRole
	}
	return nil
}

func (s *ShareService) createVerifiedExternalUser(ctx context.Context, email, nickname, password string) (model.ShareExternalUser, error) {
	var user model.ShareExternalUser
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		createdUser, err := s.createExternalUserTx(tx, email, nickname, password, true)
		if err != nil {
			return err
		}
		user = createdUser
		return nil
	})
	if err != nil {
		if errors.Is(err, ErrShareEmailExists) || strings.Contains(strings.ToLower(err.Error()), "duplicate key") {
			return model.ShareExternalUser{}, ErrShareEmailExists
		}
		return model.ShareExternalUser{}, err
	}
	return user, nil
}

func (s *ShareService) createExternalUserTx(tx *gorm.DB, email, nickname, passwordOrHash string, emailVerified bool) (model.ShareExternalUser, error) {
	var count int64
	if err := tx.Model(&model.ShareExternalUser{}).
		Where("email = ?", email).
		Count(&count).Error; err != nil {
		return model.ShareExternalUser{}, err
	}
	if count > 0 {
		return model.ShareExternalUser{}, ErrShareEmailExists
	}

	user := model.ShareExternalUser{
		Email:         email,
		Nickname:      nickname,
		Status:        model.ShareExternalUserStatusActive,
		Role:          s.defaultRoleByEmail(email),
		EmailVerified: emailVerified,
	}
	if emailVerified {
		now := time.Now().UTC()
		user.EmailVerifiedAt = &now
	}

	if isBcryptHash(passwordOrHash) {
		user.Password = passwordOrHash
	} else {
		if err := user.SetPassword(passwordOrHash); err != nil {
			return model.ShareExternalUser{}, err
		}
	}

	username, err := s.generateUniqueUsernameTx(tx, email)
	if err != nil {
		return model.ShareExternalUser{}, err
	}
	user.Username = username

	if err := tx.Create(&user).Error; err != nil {
		if isDuplicateKeyError(err) {
			return model.ShareExternalUser{}, ErrShareEmailExists
		}
		return model.ShareExternalUser{}, err
	}

	return user, nil
}

func (s *ShareService) defaultRoleByEmail(email string) string {
	if _, ok := s.managerEmailAllow[strings.ToLower(strings.TrimSpace(email))]; ok {
		return model.ShareExternalUserRoleManager
	}
	return model.ShareExternalUserRoleCreator
}

func (s *ShareService) ensureManagerRoleByEmailIfNeeded(ctx context.Context, user *model.ShareExternalUser) error {
	if user == nil {
		return nil
	}
	email := strings.ToLower(strings.TrimSpace(user.Email))
	if _, ok := s.managerEmailAllow[email]; !ok {
		return nil
	}

	if normalizeShareExternalUserRole(user.Role) == model.ShareExternalUserRoleManager {
		return nil
	}

	if err := s.db.WithContext(ctx).
		Model(&model.ShareExternalUser{}).
		Where("id = ?", user.ID).
		Update("role", model.ShareExternalUserRoleManager).Error; err != nil {
		return err
	}
	user.Role = model.ShareExternalUserRoleManager
	return nil
}

func (s *ShareService) isConfiguredShareSuperAdminEmail(email string) bool {
	normalized, err := normalizeShareExternalEmail(email)
	if err != nil {
		return false
	}
	_, ok := s.managerEmailAllow[normalized]
	return ok
}

func (s *ShareService) removeProfileAssets(userID string) error {
	safeUser := filepath.Base(strings.TrimSpace(userID))
	if safeUser == "" || safeUser == "." {
		return nil
	}
	return os.RemoveAll(filepath.Join(s.fileRoot, "profiles", safeUser))
}

func (s *ShareService) generateUniqueUsernameTx(tx *gorm.DB, email string) (string, error) {
	base := shareUsernameBaseFromEmail(email)
	for i := 0; i < 50; i++ {
		candidate := base
		if i > 0 {
			candidate = fmt.Sprintf("%s%d", base, i+1)
		}

		var count int64
		if err := tx.Model(&model.ShareExternalUser{}).
			Where("username = ?", candidate).
			Count(&count).Error; err != nil {
			return "", err
		}
		if count == 0 {
			return candidate, nil
		}
	}
	return fmt.Sprintf("%s_%s", base, randomUUIDLike()[0:6]), nil
}

func (s *ShareService) normalizeProfileAsset(userID, slot, raw string) (string, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return "", nil
	}

	if strings.HasPrefix(value, "/api/share/users/") || strings.HasPrefix(value, "http://") || strings.HasPrefix(value, "https://") {
		return value, nil
	}

	if !strings.HasPrefix(value, "data:") {
		return value, nil
	}

	storedName, err := s.saveProfileAssetDataURL(userID, slot, value)
	if err != nil {
		return "", err
	}

	return fmt.Sprintf("/api/share/users/%s/assets/%s", strings.TrimSpace(userID), storedName), nil
}

func (s *ShareService) saveProfileAssetDataURL(userID, slot, dataURL string) (string, error) {
	header, payload, ok := strings.Cut(strings.TrimSpace(dataURL), ",")
	if !ok || !strings.HasPrefix(header, "data:") || !strings.Contains(header, ";base64") {
		return "", ErrShareInvalidImageData
	}

	mimeType := strings.TrimPrefix(strings.SplitN(header, ";", 2)[0], "data:")
	ext := ""
	switch mimeType {
	case "image/jpeg":
		ext = ".jpg"
	case "image/png":
		ext = ".png"
	default:
		return "", ErrShareInvalidImageData
	}

	decoded, err := base64.StdEncoding.DecodeString(payload)
	if err != nil {
		decoded, err = base64.RawStdEncoding.DecodeString(payload)
		if err != nil {
			return "", ErrShareInvalidImageData
		}
	}

	if len(decoded) == 0 {
		return "", ErrShareInvalidImageData
	}
	if len(decoded) > 5*1024*1024 {
		return "", ErrShareImageTooLarge
	}

	userDir := filepath.Join(s.fileRoot, "profiles", filepath.Base(strings.TrimSpace(userID)))
	if err := os.MkdirAll(userDir, 0o755); err != nil {
		return "", ErrShareSaveFileFailed
	}

	storedName := fmt.Sprintf("%s-%d-%s%s", filepath.Base(strings.TrimSpace(slot)), time.Now().UTC().UnixMilli(), randomUUIDLike()[0:8], ext)
	targetPath := filepath.Join(userDir, storedName)

	if err := os.WriteFile(targetPath, decoded, 0o644); err != nil {
		return "", ErrShareSaveFileFailed
	}

	return storedName, nil
}

func (s *ShareService) validateShareRegistrationInput(emailRaw, nicknameRaw, password string) (string, string, string, error) {
	email, err := normalizeShareExternalEmail(emailRaw)
	if err != nil {
		return "", "", "", err
	}

	nickname := strings.TrimSpace(nicknameRaw)
	password = strings.TrimSpace(password)
	if err := validateShareNickname(nickname); err != nil {
		return "", "", "", ErrShareInvalidProfile
	}
	if len(password) < 6 {
		return "", "", "", ErrShareWeakPassword
	}

	return email, nickname, password, nil
}

func (s *ShareService) createOrRefreshEmailVerification(ctx context.Context, email, nickname, password string) (int, error) {
	if s.emailService == nil || !s.emailService.Enabled() {
		return 0, fmt.Errorf("email service is disabled")
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return 0, err
	}

	return s.createOrRefreshEmailVerificationFromHash(ctx, email, nickname, string(passwordHash))
}

func (s *ShareService) cleanupShareEmailVerifications(ctx context.Context) error {
	now := time.Now().UTC()
	return s.db.WithContext(ctx).
		Where("expires_at < ?", now).
		Or("consumed_at IS NOT NULL AND consumed_at < ?", now.Add(-shareEmailVerificationRetention)).
		Delete(&model.ShareEmailVerification{}).Error
}

func (s *ShareService) createOrRefreshEmailVerificationFromHash(ctx context.Context, email, nickname, passwordHash string) (int, error) {
	if s.emailService == nil || !s.emailService.Enabled() {
		return 0, fmt.Errorf("email service is disabled")
	}

	now := time.Now().UTC()
	ttl := s.verificationCodeTTL()
	expiresAt := now.Add(ttl)
	code, codeHash, err := generateVerificationCode()
	if err != nil {
		return 0, err
	}

	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var count int64
		if err := tx.Model(&model.ShareExternalUser{}).
			Where("email = ?", email).
			Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			return ErrShareEmailExists
		}

		var existing model.ShareEmailVerification
		if err := tx.
			Where("email = ? AND purpose = ? AND consumed_at IS NULL", email, shareEmailVerificationPurposeRegister).
			Order("created_at DESC").
			First(&existing).Error; err == nil {
			cfg := s.currentShareAuthConfig()
			if existing.CreatedAt.Add(time.Duration(cfg.ResendIntervalSeconds) * time.Second).After(now) {
				return ErrShareVerificationTooSoon
			}
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		if err := tx.
			Where("email = ? AND purpose = ? AND consumed_at IS NULL", email, shareEmailVerificationPurposeRegister).
			Delete(&model.ShareEmailVerification{}).Error; err != nil {
			return err
		}

		record := model.ShareEmailVerification{
			Email:        email,
			Purpose:      shareEmailVerificationPurposeRegister,
			Nickname:     nickname,
			PasswordHash: passwordHash,
			CodeHash:     codeHash,
			ExpiresAt:    expiresAt,
		}
		return tx.Create(&record).Error
	})
	if err != nil {
		return 0, err
	}

	if err := s.emailService.SendVerificationCode(email, code, s.verificationCodeTTLMinutes()); err != nil {
		_ = s.db.WithContext(ctx).
			Where("email = ? AND purpose = ? AND consumed_at IS NULL", email, shareEmailVerificationPurposeRegister).
			Delete(&model.ShareEmailVerification{}).Error
		return 0, err
	}

	return int(ttl.Seconds()), nil
}

func generateVerificationCode() (string, string, error) {
	const digits = "0123456789"
	bytes := make([]byte, 6)
	for i := range bytes {
		n, err := rand.Int(rand.Reader, bigInt(int64(len(digits))))
		if err != nil {
			return "", "", err
		}
		bytes[i] = digits[n.Int64()]
	}
	code := string(bytes)
	hash := sha256.Sum256([]byte(code))
	return code, hex.EncodeToString(hash[:]), nil
}

func normalizeVerificationCode(raw string) string {
	value := strings.TrimSpace(raw)
	if len(value) != 6 {
		return ""
	}
	for _, ch := range value {
		if ch < '0' || ch > '9' {
			return ""
		}
	}
	return value
}

func checkVerificationCodeHash(code, codeHash string) bool {
	sum := sha256.Sum256([]byte(code))
	return hex.EncodeToString(sum[:]) == strings.TrimSpace(codeHash)
}

func (s *ShareService) verificationCodeTTL() time.Duration {
	return time.Duration(s.currentShareAuthConfig().VerificationCodeTTLSeconds) * time.Second
}

func (s *ShareService) verificationCodeTTLMinutes() int {
	minutes := int(s.verificationCodeTTL().Minutes())
	if minutes <= 0 {
		return 1
	}
	return minutes
}

func isBcryptHash(value string) bool {
	return strings.HasPrefix(value, "$2a$") || strings.HasPrefix(value, "$2b$") || strings.HasPrefix(value, "$2y$")
}

func isDuplicateKeyError(err error) bool {
	if err == nil {
		return false
	}
	return strings.Contains(strings.ToLower(err.Error()), "duplicate key")
}

func bigInt(v int64) *big.Int {
	return big.NewInt(v)
}

func (s *ShareService) currentShareAuthConfig() config.ShareAuthConfig {
	s.shareAuthCfgMu.RLock()
	defer s.shareAuthCfgMu.RUnlock()
	return s.shareAuthCfg
}

func (s *ShareService) setShareAuthConfig(cfg config.ShareAuthConfig) {
	s.shareAuthCfgMu.Lock()
	s.shareAuthCfg = cfg
	s.shareAuthCfgMu.Unlock()
}

func (s *ShareService) loadShareAuthConfigFromDB() {
	if s == nil || s.db == nil {
		return
	}
	var settings model.ShareAuthSettings
	if err := s.db.Where("singleton = ?", shareAuthSettingsSingleton).First(&settings).Error; err != nil {
		return
	}
	cfg, err := normalizeRuntimeShareAuthConfig(config.ShareAuthConfig{
		EmailVerificationEnabled:  settings.EmailVerificationEnabled,
		VerificationCodeTTLSeconds: settings.VerificationCodeTTLSeconds,
		ResendIntervalSeconds:     settings.ResendIntervalSeconds,
		MaxVerifyAttempts:         settings.MaxVerifyAttempts,
	}, s.emailService)
	if err != nil {
		return
	}
	s.setShareAuthConfig(cfg)
}

func normalizeRuntimeShareAuthConfig(cfg config.ShareAuthConfig, emailService *EmailService) (config.ShareAuthConfig, error) {
	if cfg.VerificationCodeTTLSeconds < 300 || cfg.VerificationCodeTTLSeconds > 1800 {
		return config.ShareAuthConfig{}, ErrShareInvalidVerificationCodeTTL
	}
	if cfg.ResendIntervalSeconds < 30 || cfg.ResendIntervalSeconds > 300 {
		return config.ShareAuthConfig{}, ErrShareInvalidResendInterval
	}
	if cfg.MaxVerifyAttempts < 3 || cfg.MaxVerifyAttempts > 10 {
		return config.ShareAuthConfig{}, ErrShareInvalidMaxVerifyAttempts
	}
	if cfg.ResendIntervalSeconds >= cfg.VerificationCodeTTLSeconds {
		return config.ShareAuthConfig{}, ErrShareAuthConfigConflict
	}
	if cfg.EmailVerificationEnabled && (emailService == nil || !emailService.Enabled()) {
		return config.ShareAuthConfig{}, ErrShareEmailVerificationRequiresEmail
	}
	return cfg, nil
}

func (s *ShareService) ensureConfiguredShareSuperAdminByUserID(ctx context.Context, userID string) error {
	if s.isConfiguredShareSuperAdminUserID(ctx, userID) {
		return nil
	}
	return ErrShareSuperAdminRequired
}

func (s *ShareService) isConfiguredShareSuperAdminUserID(ctx context.Context, userID string) bool {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return false
	}
	var user model.ShareExternalUser
	if err := s.db.WithContext(ctx).First(&user, "id = ?", userID).Error; err != nil {
		return false
	}
	return s.isConfiguredShareSuperAdminEmail(user.Email)
}
