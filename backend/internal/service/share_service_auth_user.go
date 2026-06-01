package service

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/baobaobai/baobaobaivault/internal/model"
	"gorm.io/gorm"
)

func (s *ShareService) RegisterExternalUser(ctx context.Context, emailRaw, nicknameRaw, password string) (*ShareSessionUser, error) {
	email, err := normalizeShareExternalEmail(emailRaw)
	if err != nil {
		return nil, err
	}

	nickname := strings.TrimSpace(nicknameRaw)
	password = strings.TrimSpace(password)
	if err := validateShareNickname(nickname); err != nil {
		return nil, ErrShareInvalidProfile
	}
	if len(password) < 6 {
		return nil, ErrShareWeakPassword
	}

	var user model.ShareExternalUser
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		createdUser, err := s.createExternalUserTx(tx, email, nickname, password)
		if err != nil {
			return err
		}
		user = createdUser
		return nil
	})
	if err != nil {
		if errors.Is(err, ErrShareEmailExists) || strings.Contains(strings.ToLower(err.Error()), "duplicate key") {
			return nil, ErrShareEmailExists
		}
		return nil, err
	}

	sessionUser := toShareSessionUser(&user)
	return &sessionUser, nil
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

		if len(password) < 6 {
			return nil, false, ErrShareWeakPassword
		}

		nickname := defaultShareNicknameFromEmail(email)
		err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
			createdUser, createErr := s.createExternalUserTx(tx, email, nickname, password)
			if createErr != nil {
				return createErr
			}
			user = createdUser
			now := time.Now().UTC()
			user.LastLoginAt = &now
			return tx.Model(&model.ShareExternalUser{}).
				Where("id = ?", user.ID).
				Update("last_login_at", now).Error
		})
		if err != nil {
			if errors.Is(err, ErrShareEmailExists) || strings.Contains(strings.ToLower(err.Error()), "duplicate key") {
				existingUser, authErr := s.AuthenticateExternalUser(ctx, email, password)
				if authErr != nil {
					return nil, false, authErr
				}
				return existingUser, false, nil
			}
			return nil, false, err
		}

		sessionUser := toShareSessionUser(&user)
		return &sessionUser, true, nil
	}

	if user.Status != model.ShareExternalUserStatusActive || !user.CheckPassword(password) {
		return nil, false, ErrShareAuthFailed
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

	if err := s.ensureManagerRoleByEmailIfNeeded(ctx, &user); err != nil {
		return nil, err
	}

	sessionUser := toShareSessionUser(&user)
	return &sessionUser, nil
}

func (s *ShareService) ListUsersForRoleManage(ctx context.Context, operatorID string) ([]ShareUserRoleManageItem, error) {
	if err := s.ensureShareManagerRole(ctx, operatorID); err != nil {
		return nil, err
	}

	rows := make([]model.ShareExternalUser, 0, 128)
	if err := s.db.WithContext(ctx).
		Where("status = ?", model.ShareExternalUserStatusActive).
		Order("created_at DESC").
		Find(&rows).Error; err != nil {
		return nil, err
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
	return items, nil
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

func (s *ShareService) createExternalUserTx(tx *gorm.DB, email, nickname, password string) (model.ShareExternalUser, error) {
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
		Email:    email,
		Nickname: nickname,
		Status:   model.ShareExternalUserStatusActive,
		Role:     s.defaultRoleByEmail(email),
	}
	if err := user.SetPassword(password); err != nil {
		return model.ShareExternalUser{}, err
	}

	username, err := s.generateUniqueUsernameTx(tx, email)
	if err != nil {
		return model.ShareExternalUser{}, err
	}
	user.Username = username

	if err := tx.Create(&user).Error; err != nil {
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
