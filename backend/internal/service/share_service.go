package service

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"math/big"
	"mime"
	"net/mail"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/baobaobai/baobaobaivault/internal/model"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

var (
	shareExternalUsernameCleanPattern = regexp.MustCompile(`[^a-z0-9_]+`)
	shareAccessCodePattern            = regexp.MustCompile(`^[A-Z0-9-]{4,32}$`)

	shareCardContentSlots = []string{
		"system_theme",
		"wechat_theme",
		"app",
		"character_persona",
		"world_book",
	}

	ErrShareInvalidEmail        = errors.New("invalid email")
	ErrShareEmailExists         = errors.New("email already registered")
	ErrShareWeakPassword        = errors.New("password must be at least 6 characters")
	ErrShareInvalidProfile      = errors.New("nickname must be between 2 and 40 characters")
	ErrShareInvalidBio          = errors.New("bio must be at most 100 characters")
	ErrShareInvalidPhone        = errors.New("phone format is invalid")
	ErrShareAuthFailed          = errors.New("invalid email or password")
	ErrShareInvalidOldPassword  = errors.New("current password is incorrect")
	ErrShareInvalidImageData    = errors.New("invalid image data")
	ErrShareImageTooLarge       = errors.New("image exceeds 5MB")
	ErrShareUserNotFound        = errors.New("user not found")
	ErrShareCardNotFound        = errors.New("card not found")
	ErrShareCardForbidden       = errors.New("card access denied")
	ErrShareCardTitleRequired   = errors.New("card title is required")
	ErrShareFileRequired        = errors.New("upload file is required")
	ErrShareFileTooLarge        = errors.New("file exceeds max upload size")
	ErrShareSaveFileFailed      = errors.New("failed to save file")
	ErrShareInvalidVisibility   = errors.New("invalid card visibility")
	ErrShareInvalidCardStatus   = errors.New("invalid card status")
	ErrShareInvalidAccessCode   = errors.New("invalid access code")
	ErrShareInvalidAccessRules  = errors.New("invalid access code rules")
	ErrShareAccessCodeRequired  = errors.New("access code required")
	ErrShareAccessCodeExpired   = errors.New("access code expired")
	ErrShareAccessCodeExhausted = errors.New("access code exhausted")
	ErrShareForbiddenRole       = errors.New("manager role required")
	ErrShareInvalidCardSlot     = errors.New("invalid card content slot")
	ErrShareInvalidUserRole     = errors.New("invalid user role")
	ErrShareSelfRoleDowngrade   = errors.New("cannot downgrade your own role")
	ErrShareCardAssetRequired   = errors.New("card must keep at least one category file")
	ErrShareInvalidReviewStatus = errors.New("invalid review status")
	ErrShareReviewReasonRequired = errors.New("review reason is required")
)

type ShareService struct {
	db                *gorm.DB
	logger            *zap.Logger
	fileRoot          string
	managerEmailAllow map[string]struct{}
}

func NewShareService(db *gorm.DB, logger *zap.Logger, fileRoot string, managerEmails ...string) *ShareService {
	if strings.TrimSpace(fileRoot) == "" {
		fileRoot = filepath.Join("storage", "share", "files")
	}
	allow := make(map[string]struct{}, len(managerEmails))
	for _, raw := range managerEmails {
		normalized, err := normalizeShareExternalEmail(raw)
		if err != nil {
			continue
		}
		allow[normalized] = struct{}{}
	}
	return &ShareService{
		db:                db,
		logger:            logger,
		fileRoot:          fileRoot,
		managerEmailAllow: allow,
	}
}

type ShareSessionUser struct {
	ID         string    `json:"id"`
	Email      string    `json:"email"`
	Username   string    `json:"username"`
	Nickname   string    `json:"nickname"`
	Avatar     string    `json:"avatar"`
	Bio        string    `json:"bio"`
	CoverImage string    `json:"coverImage"`
	Phone      string    `json:"phone"`
	Role       string    `json:"role"`
	CreatedAt  time.Time `json:"createdAt"`
}

type ShareCardAssetView struct {
	Slot             string `json:"slot"`
	OriginalFileName string `json:"originalFileName"`
	MimeType         string `json:"mimeType"`
	Size             int64  `json:"size"`
	PreviewUrl       string `json:"previewUrl"`
	DownloadUrl      string `json:"downloadUrl"`
}

type ShareCardView struct {
	ID               string    `json:"id"`
	CreatorID        string    `json:"creatorId"`
	Title            string    `json:"title"`
	Description      string    `json:"description"`
	Visibility       string    `json:"visibility"`
	Status           string    `json:"status"`
	ReviewStatus     string    `json:"reviewStatus"`
	ReviewReason     string    `json:"reviewReason"`
	SubmittedAt      *time.Time `json:"submittedAt,omitempty"`
	ReviewedAt       *time.Time `json:"reviewedAt,omitempty"`
	OriginalFileName string    `json:"originalFileName"`
	MimeType         string    `json:"mimeType"`
	Size             int64     `json:"size"`
	PreviewUrl       string    `json:"previewUrl"`
	DownloadUrl      string    `json:"downloadUrl"`
	Categories       []string  `json:"categories"`
	CreatedAt        time.Time `json:"createdAt"`
	UpdatedAt        time.Time `json:"updatedAt"`
}

type ShareCardStats struct {
	DownloadCount    int64      `json:"downloadCount"`
	LastDownloadedAt *time.Time `json:"lastDownloadedAt"`
}

type SharePublicUser struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Nickname string `json:"nickname"`
	Avatar   string `json:"avatar"`
}

type ShareDiscoverCardItem struct {
	Card    ShareCardView   `json:"card"`
	Creator SharePublicUser `json:"creator"`
	Stats   ShareCardStats  `json:"stats"`
}

type ShareCardDetail struct {
	Card             ShareCardView         `json:"card"`
	Creator          SharePublicUser       `json:"creator"`
	Stats            ShareCardStats        `json:"stats"`
	Assets           []ShareCardAssetView  `json:"assets"`
	CanEdit          bool                  `json:"canEdit"`
	CanDownload      bool                  `json:"canDownload"`
	AccessCodeStatus ShareCardAccessStatus `json:"accessCodeStatus"`
}

type ShareCardAccessStatus string

const (
	ShareCardAccessStatusNone      ShareCardAccessStatus = "none"
	ShareCardAccessStatusRequired  ShareCardAccessStatus = "required"
	ShareCardAccessStatusExpired   ShareCardAccessStatus = "expired"
	ShareCardAccessStatusExhausted ShareCardAccessStatus = "exhausted"
)

type ShareDashboardStats struct {
	TotalCards     int64 `json:"totalCards"`
	TotalPublic    int64 `json:"totalPublic"`
	TotalDownloads int64 `json:"totalDownloads"`
}

type ShareDashboardCard struct {
	Card          ShareCardView  `json:"card"`
	Stats         ShareCardStats `json:"stats"`
	HasAccessCode bool           `json:"hasAccessCode"`
	AccessCode    string         `json:"accessCode,omitempty"`
}

type ShareDashboard struct {
	User  ShareSessionUser     `json:"user"`
	Cards []ShareDashboardCard `json:"cards"`
	Stats ShareDashboardStats  `json:"stats"`
}

type ShareAccessCodeDashboardItem struct {
	Card              ShareCardView             `json:"card"`
	Stats             ShareCardStats            `json:"stats"`
	Config            ShareCardAccessCodeConfig `json:"config"`
	IsPubliclyVisible bool                      `json:"isPubliclyVisible"`
}

type ShareAccessCodeDashboard struct {
	User           ShareSessionUser               `json:"user"`
	Items          []ShareAccessCodeDashboardItem `json:"items"`
	AvailableCards []ShareCardView                `json:"availableCards"`
}

type ShareCreateCardInput struct {
	CreatorID   string
	Title       string
	Description string
	Visibility  string
	Status      string
	FileName    string
	MimeType    string
	FileReader  io.Reader
	CoverFileName string
	CoverMimeType string
	CoverReader   io.Reader
	MaxFileSize int64
}

type ShareCreateCardAssetInput struct {
	Slot       string
	FileName   string
	MimeType   string
	FileReader io.Reader
}

type ShareCreateCardBundleInput struct {
	CreatorID   string
	Title       string
	Description string
	Visibility  string
	Status      string
	Assets      []ShareCreateCardAssetInput
	CoverFileName string
	CoverMimeType string
	CoverReader   io.Reader
	MaxFileSize int64
}

type ShareUpdateCardInput struct {
	OwnerID     string
	CardID      string
	Title       string
	Description string
	Visibility  string
	Status      string
}

type ShareReviewDashboardItem struct {
	Card      ShareCardView   `json:"card"`
	Creator   SharePublicUser `json:"creator"`
	SubmittedAt *time.Time    `json:"submittedAt,omitempty"`
}

type ShareReviewDashboard struct {
	Items []ShareReviewDashboardItem `json:"items"`
}

type ShareUpdateCardAssetInput struct {
	OwnerID     string
	CardID      string
	Slot        string
	FileName    string
	MimeType    string
	FileReader  io.Reader
	MaxFileSize int64
}

type ShareUserRoleManageItem struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	Username  string    `json:"username"`
	Nickname  string    `json:"nickname"`
	Role      string    `json:"role"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"createdAt"`
}

type ShareUpdateUserRoleInput struct {
	OperatorID string
	UserID     string
	Role       string
}

type ShareCardAccessCodeConfig struct {
	CardID     string     `json:"cardId"`
	Code       string     `json:"code"`
	ExpiresAt  *time.Time `json:"expiresAt,omitempty"`
	ExpireDays int        `json:"expireDays"`
	UsageLimit int        `json:"usageLimit"`
	UsageCount int        `json:"usageCount"`
	Unlimited  bool       `json:"unlimited"`
	IsActive   bool       `json:"isActive"`
	IsExpired  bool       `json:"isExpired"`
}

type ShareUpdateCardAccessCodeInput struct {
	OwnerID    string
	CardID     string
	Code       string
	ExpireDays int
	UsageLimit int
	Unlimited  bool
}

type ShareUpdateProfileInput struct {
	UserID     string
	Nickname   string
	Avatar     string
	Bio        string
	CoverImage string
	Phone      string
}

type ShareChangePasswordInput struct {
	UserID      string
	OldPassword string
	NewPassword string
}

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

func (s *ShareService) ListDiscoverCards(ctx context.Context, page, size int) ([]ShareDiscoverCardItem, int64, error) {
	if page <= 0 {
		page = 1
	}
	if size <= 0 {
		size = 24
	}
	if size > 60 {
		size = 60
	}

	query := s.db.WithContext(ctx).
		Model(&model.SharePlatformCard{}).
		Where("visibility = ? AND status = ? AND review_status = ?",
			model.SharePlatformCardVisibilityPublic,
			model.SharePlatformCardStatusPublished,
			model.SharePlatformCardReviewStatusApproved,
		)

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if total == 0 {
		return []ShareDiscoverCardItem{}, 0, nil
	}

	offset := (page - 1) * size
	cards := make([]model.SharePlatformCard, 0, size)
	if err := query.
		Order("updated_at DESC").
		Offset(offset).
		Limit(size).
		Find(&cards).Error; err != nil {
		return nil, 0, err
	}
	if len(cards) == 0 {
		return []ShareDiscoverCardItem{}, total, nil
	}

	assetsByCardID, err := s.listCardAssetsByCardIDs(ctx, collectShareCardIDs(cards))
	if err != nil {
		return nil, 0, err
	}

	items, err := s.mapDiscoverCards(ctx, cards, assetsByCardID)
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (s *ShareService) ListDashboardByUser(ctx context.Context, userID string) (*ShareDashboard, error) {
	var user model.ShareExternalUser
	if err := s.db.WithContext(ctx).First(&user, "id = ?", strings.TrimSpace(userID)).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrShareUserNotFound
		}
		return nil, err
	}

	cards := make([]model.SharePlatformCard, 0, 32)
	if err := s.db.WithContext(ctx).
		Where("creator_external_user_id = ?", user.ID).
		Order("updated_at DESC").
		Find(&cards).Error; err != nil {
		return nil, err
	}

	cardIDs := make([]string, 0, len(cards))
	totalPublic := int64(0)
	for _, card := range cards {
		cardIDs = append(cardIDs, card.ID)
		if card.Visibility == model.SharePlatformCardVisibilityPublic &&
			card.Status == model.SharePlatformCardStatusPublished &&
			card.ReviewStatus == model.SharePlatformCardReviewStatusApproved {
			totalPublic++
		}
	}

	statsByCard, totalDownloads, err := s.aggregateStatsByCard(ctx, cardIDs)
	if err != nil {
		return nil, err
	}
	assetsByCardID, err := s.listCardAssetsByCardIDs(ctx, cardIDs)
	if err != nil {
		return nil, err
	}

	items := make([]ShareDashboardCard, 0, len(cards))
	for _, card := range cards {
		accessCode := strings.TrimSpace(card.AccessCode)
		items = append(items, ShareDashboardCard{
			Card:          toShareCardView(&card, assetsByCardID[card.ID]),
			Stats:         statsByCard[card.ID],
			HasAccessCode: accessCode != "",
			AccessCode:    accessCode,
		})
	}

	return &ShareDashboard{
		User:  toShareSessionUser(&user),
		Cards: items,
		Stats: ShareDashboardStats{
			TotalCards:     int64(len(cards)),
			TotalPublic:    totalPublic,
			TotalDownloads: totalDownloads,
		},
	}, nil
}

func (s *ShareService) ListAccessCodeDashboardByUser(ctx context.Context, userID string) (*ShareAccessCodeDashboard, error) {
	var user model.ShareExternalUser
	if err := s.db.WithContext(ctx).First(&user, "id = ?", strings.TrimSpace(userID)).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrShareUserNotFound
		}
		return nil, err
	}

	cards := make([]model.SharePlatformCard, 0, 32)
	if err := s.db.WithContext(ctx).
		Where("creator_external_user_id = ?", user.ID).
		Order("updated_at DESC").
		Find(&cards).Error; err != nil {
		return nil, err
	}

	cardIDs := make([]string, 0, len(cards))
	for _, card := range cards {
		cardIDs = append(cardIDs, card.ID)
	}

	statsByCard, _, err := s.aggregateStatsByCard(ctx, cardIDs)
	if err != nil {
		return nil, err
	}
	assetsByCardID, err := s.listCardAssetsByCardIDs(ctx, cardIDs)
	if err != nil {
		return nil, err
	}

	items := make([]ShareAccessCodeDashboardItem, 0, len(cards))
	availableCards := make([]ShareCardView, 0, len(cards))
	for _, card := range cards {
		cardView := toShareCardView(&card, assetsByCardID[card.ID])
		config := buildShareCardAccessCodeConfig(&card)
		hasAccessCode := strings.TrimSpace(config.Code) != ""
		isPubliclyVisible := card.Visibility == model.SharePlatformCardVisibilityPublic &&
			card.Status == model.SharePlatformCardStatusPublished &&
			card.ReviewStatus == model.SharePlatformCardReviewStatusApproved
		canReuseCurrentAccessCode := hasAccessCode && config.IsActive && isPubliclyVisible

		// Any card without a currently usable public code should be selectable for generating a new code again.
		if !canReuseCurrentAccessCode {
			availableCards = append(availableCards, cardView)
		}

		if !hasAccessCode {
			continue
		}

		items = append(items, ShareAccessCodeDashboardItem{
			Card:              cardView,
			Stats:             statsByCard[card.ID],
			Config:            config,
			IsPubliclyVisible: isPubliclyVisible,
		})
	}

	return &ShareAccessCodeDashboard{
		User:           toShareSessionUser(&user),
		Items:          items,
		AvailableCards: availableCards,
	}, nil
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

func (s *ShareService) SubmitCardForReview(ctx context.Context, ownerID, cardID string) (*ShareCardView, error) {
	card, err := s.getCardByOwner(ctx, ownerID, cardID)
	if err != nil {
		return nil, err
	}
	if err := s.ensureShareCreatorRole(ctx, ownerID); err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	card.Status = model.SharePlatformCardStatusPublished
	card.ReviewStatus = model.SharePlatformCardReviewStatusPending
	card.SubmittedAt = &now
	card.ReviewedAt = nil
	card.ReviewerExternalUserID = nil
	card.ReviewReason = ""
	card.UpdatedAt = now

	if err := s.db.WithContext(ctx).Save(card).Error; err != nil {
		return nil, err
	}

	assetsByCardID, err := s.listCardAssetsByCardIDs(ctx, []string{card.ID})
	if err != nil {
		return nil, err
	}
	view := toShareCardView(card, assetsByCardID[card.ID])
	return &view, nil
}

func (s *ShareService) ListReviewDashboard(ctx context.Context, operatorID, status string) (*ShareReviewDashboard, error) {
	if err := s.ensureShareManagerRole(ctx, operatorID); err != nil {
		return nil, err
	}

	query := s.db.WithContext(ctx).Model(&model.SharePlatformCard{})
	normalized := normalizeShareReviewStatus(status)
	if normalized != "" {
		if !isValidShareReviewStatus(normalized) {
			return nil, ErrShareInvalidReviewStatus
		}
		query = query.Where("review_status = ?", normalized)
	} else {
		query = query.Where("review_status IN ?", []string{
			model.SharePlatformCardReviewStatusPending,
			model.SharePlatformCardReviewStatusRejected,
		})
	}

	cards := make([]model.SharePlatformCard, 0, 128)
	if err := query.Order("submitted_at DESC NULLS LAST, updated_at DESC").Find(&cards).Error; err != nil {
		return nil, err
	}
	if len(cards) == 0 {
		return &ShareReviewDashboard{Items: []ShareReviewDashboardItem{}}, nil
	}

	cardIDs := collectShareCardIDs(cards)
	assetsByCardID, err := s.listCardAssetsByCardIDs(ctx, cardIDs)
	if err != nil {
		return nil, err
	}

	creatorIDs := make([]string, 0, len(cards))
	creatorSet := make(map[string]struct{}, len(cards))
	for _, card := range cards {
		if _, ok := creatorSet[card.CreatorExternalUserID]; ok {
			continue
		}
		creatorSet[card.CreatorExternalUserID] = struct{}{}
		creatorIDs = append(creatorIDs, card.CreatorExternalUserID)
	}
	creators := make([]model.ShareExternalUser, 0, len(creatorIDs))
	if err := s.db.WithContext(ctx).Where("id IN ?", creatorIDs).Find(&creators).Error; err != nil {
		return nil, err
	}
	creatorMap := make(map[string]model.ShareExternalUser, len(creators))
	for _, creator := range creators {
		creatorMap[creator.ID] = creator
	}

	items := make([]ShareReviewDashboardItem, 0, len(cards))
	for _, card := range cards {
		creator := creatorMap[card.CreatorExternalUserID]
		items = append(items, ShareReviewDashboardItem{
			Card:       toShareCardView(&card, assetsByCardID[card.ID]),
			Creator:    toSharePublicUser(&creator),
			SubmittedAt: card.SubmittedAt,
		})
	}
	return &ShareReviewDashboard{Items: items}, nil
}

func (s *ShareService) ApproveCard(ctx context.Context, operatorID, cardID string) (*ShareCardView, error) {
	if err := s.ensureShareManagerRole(ctx, operatorID); err != nil {
		return nil, err
	}

	var updated model.SharePlatformCard
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var card model.SharePlatformCard
		if err := tx.First(&card, "id = ?", strings.TrimSpace(cardID)).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrShareCardNotFound
			}
			return err
		}
		now := time.Now().UTC()
		card.Status = model.SharePlatformCardStatusPublished
		card.ReviewStatus = model.SharePlatformCardReviewStatusApproved
		card.ReviewReason = ""
		card.SubmittedAt = &now
		card.ReviewedAt = &now
		op := strings.TrimSpace(operatorID)
		card.ReviewerExternalUserID = &op
		card.UpdatedAt = now
		if err := tx.Save(&card).Error; err != nil {
			return err
		}
		updated = card
		return nil
	})
	if err != nil {
		return nil, err
	}

	assetsByCardID, err := s.listCardAssetsByCardIDs(ctx, []string{updated.ID})
	if err != nil {
		return nil, err
	}
	view := toShareCardView(&updated, assetsByCardID[updated.ID])
	return &view, nil
}

func (s *ShareService) RejectCard(ctx context.Context, operatorID, cardID, reason string) (*ShareCardView, error) {
	if err := s.ensureShareManagerRole(ctx, operatorID); err != nil {
		return nil, err
	}
	reason = strings.TrimSpace(reason)
	if reason == "" {
		return nil, ErrShareReviewReasonRequired
	}

	var updated model.SharePlatformCard
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var card model.SharePlatformCard
		if err := tx.First(&card, "id = ?", strings.TrimSpace(cardID)).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrShareCardNotFound
			}
			return err
		}
		now := time.Now().UTC()
		card.Status = model.SharePlatformCardStatusDraft
		card.ReviewStatus = model.SharePlatformCardReviewStatusRejected
		card.ReviewReason = reason
		card.ReviewedAt = &now
		op := strings.TrimSpace(operatorID)
		card.ReviewerExternalUserID = &op
		card.UpdatedAt = now
		if err := tx.Save(&card).Error; err != nil {
			return err
		}
		updated = card
		return nil
	})
	if err != nil {
		return nil, err
	}

	assetsByCardID, err := s.listCardAssetsByCardIDs(ctx, []string{updated.ID})
	if err != nil {
		return nil, err
	}
	view := toShareCardView(&updated, assetsByCardID[updated.ID])
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

func (s *ShareService) CreateCard(ctx context.Context, input ShareCreateCardInput) (*ShareCardView, error) {
	if strings.TrimSpace(input.Title) == "" {
		return nil, ErrShareCardTitleRequired
	}
	if strings.TrimSpace(input.FileName) == "" || input.FileReader == nil {
		return nil, ErrShareFileRequired
	}
	if !isValidShareVisibility(input.Visibility) {
		return nil, ErrShareInvalidVisibility
	}

	status := strings.TrimSpace(input.Status)
	if status == "" {
		status = model.SharePlatformCardStatusPublished
	}
	status = strings.ToLower(status)
	if !isValidShareStatus(status) {
		return nil, ErrShareInvalidCardStatus
	}

	var userCount int64
	if err := s.db.WithContext(ctx).Model(&model.ShareExternalUser{}).
		Where("id = ?", strings.TrimSpace(input.CreatorID)).
		Count(&userCount).Error; err != nil {
		return nil, err
	}
	if userCount == 0 {
		return nil, ErrShareUserNotFound
	}
	if err := s.ensureShareCreatorRole(ctx, input.CreatorID); err != nil {
		return nil, err
	}

	storedFileName, fileSize, err := s.saveUploadFile(input.CreatorID, input.FileName, input.FileReader, input.MaxFileSize)
	if err != nil {
		return nil, err
	}
	coverStoredFileName := ""
	coverFileSize := int64(0)
	coverFileName := ""
	coverMimeType := ""
	if strings.TrimSpace(input.CoverFileName) != "" && input.CoverReader != nil {
		coverStoredFileName, coverFileSize, err = s.saveUploadFile(input.CreatorID, input.CoverFileName, input.CoverReader, input.MaxFileSize)
		if err != nil {
			_ = s.removeStoredFile(input.CreatorID, storedFileName)
			return nil, err
		}
		coverFileName = filepath.Base(input.CoverFileName)
		coverMimeType = detectUploadMimeType(input.CoverFileName, input.CoverMimeType)
	}

	mimeType := detectUploadMimeType(input.FileName, input.MimeType)

	card := model.SharePlatformCard{
		CreatorExternalUserID: strings.TrimSpace(input.CreatorID),
		Title:                 strings.TrimSpace(input.Title),
		Description:           strings.TrimSpace(input.Description),
		Visibility:            normalizeShareVisibility(input.Visibility),
		Status:                status,
		ReviewStatus:          defaultReviewStatusForStatus(status),
		SubmittedAt:           defaultSubmittedAtForReviewStatus(defaultReviewStatusForStatus(status)),
		ReviewedAt:            nil,
		ReviewReason:          "",
		ReviewerExternalUserID: nil,
		StoredFileName:        coverStoredFileName,
		OriginalFileName:      coverFileName,
		MimeType:              coverMimeType,
		Size:                  coverFileSize,
	}
	if err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&card).Error; err != nil {
			return err
		}

		asset := model.SharePlatformCardAsset{
			CardID:           card.ID,
			Slot:             "system_theme",
			StoredFileName:   storedFileName,
			OriginalFileName: filepath.Base(input.FileName),
			MimeType:         mimeType,
			Size:             fileSize,
			SortOrder:        0,
		}
		if err := tx.Create(&asset).Error; err != nil {
			return err
		}
		return nil
	}); err != nil {
		_ = s.removeStoredFile(input.CreatorID, storedFileName)
		if coverStoredFileName != "" {
			_ = s.removeStoredFile(input.CreatorID, coverStoredFileName)
		}
		return nil, err
	}

	assetsByCardID, err := s.listCardAssetsByCardIDs(ctx, []string{card.ID})
	if err != nil {
		return nil, err
	}
	view := toShareCardView(&card, assetsByCardID[card.ID])
	return &view, nil
}

func (s *ShareService) CreateCardBundle(ctx context.Context, input ShareCreateCardBundleInput) (*ShareCardView, error) {
	if strings.TrimSpace(input.Title) == "" {
		return nil, ErrShareCardTitleRequired
	}
	if !isValidShareVisibility(input.Visibility) {
		return nil, ErrShareInvalidVisibility
	}
	if len(input.Assets) == 0 {
		return nil, ErrShareFileRequired
	}
	if err := validateShareCardSlotItems(input.Assets); err != nil {
		return nil, err
	}

	status := strings.TrimSpace(input.Status)
	if status == "" {
		status = model.SharePlatformCardStatusPublished
	}
	status = strings.ToLower(status)
	if !isValidShareStatus(status) {
		return nil, ErrShareInvalidCardStatus
	}

	creatorID := strings.TrimSpace(input.CreatorID)
	var creator model.ShareExternalUser
	if err := s.db.WithContext(ctx).First(&creator, "id = ?", creatorID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrShareUserNotFound
		}
		return nil, err
	}
	if creator.Status != model.ShareExternalUserStatusActive {
		return nil, ErrShareUserNotFound
	}
	if !isShareCreatorRole(creator.Role) {
		return nil, ErrShareForbiddenRole
	}

	type savedAsset struct {
		slot           string
		storedFileName string
		fileName       string
		mimeType       string
		size           int64
	}

	savedAssets := make([]savedAsset, 0, len(input.Assets))
	coverStoredFileName := ""
	coverFileSize := int64(0)
	coverFileName := ""
	coverMimeType := ""
	var err error
	if strings.TrimSpace(input.CoverFileName) != "" && input.CoverReader != nil {
		coverStoredFileName, coverFileSize, err = s.saveUploadFile(creatorID, input.CoverFileName, input.CoverReader, input.MaxFileSize)
		if err != nil {
			return nil, err
		}
		coverFileName = filepath.Base(input.CoverFileName)
		coverMimeType = detectUploadMimeType(input.CoverFileName, input.CoverMimeType)
	}
	for _, item := range input.Assets {
		storedFileName, fileSize, err := s.saveUploadFile(creatorID, item.FileName, item.FileReader, input.MaxFileSize)
		if err != nil {
			if coverStoredFileName != "" {
				_ = s.removeStoredFile(creatorID, coverStoredFileName)
			}
			for _, saved := range savedAssets {
				_ = s.removeStoredFile(creatorID, saved.storedFileName)
			}
			return nil, err
		}

		mimeType := detectUploadMimeType(item.FileName, item.MimeType)
		savedAssets = append(savedAssets, savedAsset{
			slot:           normalizeShareCardSlot(item.Slot),
			storedFileName: storedFileName,
			fileName:       filepath.Base(item.FileName),
			mimeType:       mimeType,
			size:           fileSize,
		})
	}

	card := model.SharePlatformCard{
		CreatorExternalUserID: creatorID,
		Title:                 strings.TrimSpace(input.Title),
		Description:           strings.TrimSpace(input.Description),
		Visibility:            normalizeShareVisibility(input.Visibility),
		Status:                status,
		ReviewStatus:          defaultReviewStatusForStatus(status),
		SubmittedAt:           defaultSubmittedAtForReviewStatus(defaultReviewStatusForStatus(status)),
		ReviewedAt:            nil,
		ReviewReason:          "",
		ReviewerExternalUserID: nil,
		StoredFileName:        coverStoredFileName,
		OriginalFileName:      coverFileName,
		MimeType:              coverMimeType,
		Size:                  coverFileSize,
	}

	if err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&card).Error; err != nil {
			return err
		}
		for index, asset := range savedAssets {
			row := model.SharePlatformCardAsset{
				CardID:           card.ID,
				Slot:             asset.slot,
				StoredFileName:   asset.storedFileName,
				OriginalFileName: asset.fileName,
				MimeType:         asset.mimeType,
				Size:             asset.size,
				SortOrder:        index,
			}
			if err := tx.Create(&row).Error; err != nil {
				return err
			}
		}
		return nil
	}); err != nil {
		if coverStoredFileName != "" {
			_ = s.removeStoredFile(creatorID, coverStoredFileName)
		}
		for _, saved := range savedAssets {
			_ = s.removeStoredFile(creatorID, saved.storedFileName)
		}
		return nil, err
	}

	assetsByCardID, err := s.listCardAssetsByCardIDs(ctx, []string{card.ID})
	if err != nil {
		return nil, err
	}
	view := toShareCardView(&card, assetsByCardID[card.ID])
	return &view, nil
}

func (s *ShareService) UpdateCardByOwner(ctx context.Context, input ShareUpdateCardInput) (*ShareCardView, error) {
	if strings.TrimSpace(input.Title) == "" {
		return nil, ErrShareCardTitleRequired
	}
	if !isValidShareVisibility(input.Visibility) {
		return nil, ErrShareInvalidVisibility
	}

	status := strings.ToLower(strings.TrimSpace(input.Status))
	if !isValidShareStatus(status) {
		return nil, ErrShareInvalidCardStatus
	}

	var updated model.SharePlatformCard
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var card model.SharePlatformCard
		if err := tx.First(&card, "id = ?", strings.TrimSpace(input.CardID)).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrShareCardNotFound
			}
			return err
		}
		if card.CreatorExternalUserID != strings.TrimSpace(input.OwnerID) {
			return ErrShareCardForbidden
		}
		if err := s.ensureShareCreatorRoleTx(tx, card.CreatorExternalUserID); err != nil {
			return err
		}

		card.Title = strings.TrimSpace(input.Title)
		card.Description = strings.TrimSpace(input.Description)
		card.Visibility = normalizeShareVisibility(input.Visibility)
		card.Status = status
		if card.Status == model.SharePlatformCardStatusPublished {
			card.ReviewStatus = model.SharePlatformCardReviewStatusPending
			now := time.Now().UTC()
			card.SubmittedAt = &now
			card.ReviewedAt = nil
			card.ReviewerExternalUserID = nil
		} else {
			card.ReviewStatus = model.SharePlatformCardReviewStatusUnsubmitted
			card.SubmittedAt = nil
			card.ReviewedAt = nil
			card.ReviewerExternalUserID = nil
		}
		card.ReviewReason = ""
		card.UpdatedAt = time.Now().UTC()

		if err := tx.Save(&card).Error; err != nil {
			return err
		}
		updated = card
		return nil
	})
	if err != nil {
		return nil, err
	}

	assetsByCardID, err := s.listCardAssetsByCardIDs(ctx, []string{updated.ID})
	if err != nil {
		return nil, err
	}
	view := toShareCardView(&updated, assetsByCardID[updated.ID])
	return &view, nil
}

func (s *ShareService) ReplaceCardAssetByOwner(ctx context.Context, input ShareUpdateCardAssetInput) (*ShareCardDetail, error) {
	ownerID := strings.TrimSpace(input.OwnerID)
	cardID := strings.TrimSpace(input.CardID)
	slot := normalizeShareCardSlot(input.Slot)
	if ownerID == "" || cardID == "" {
		return nil, ErrShareCardNotFound
	}
	if !isValidShareCardSlot(slot) {
		return nil, ErrShareInvalidCardSlot
	}
	if strings.TrimSpace(input.FileName) == "" || input.FileReader == nil {
		return nil, ErrShareFileRequired
	}

	mimeType := detectUploadMimeType(input.FileName, input.MimeType)

	storedFileName, fileSize, err := s.saveUploadFile(ownerID, input.FileName, input.FileReader, input.MaxFileSize)
	if err != nil {
		return nil, err
	}

	var oldStoredFileName string
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var card model.SharePlatformCard
		if err := tx.First(&card, "id = ?", cardID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrShareCardNotFound
			}
			return err
		}
		if card.CreatorExternalUserID != ownerID {
			return ErrShareCardForbidden
		}
		if err := s.ensureShareCreatorRoleTx(tx, card.CreatorExternalUserID); err != nil {
			return err
		}
		now := time.Now().UTC()
		if card.Status == model.SharePlatformCardStatusPublished {
			card.ReviewStatus = model.SharePlatformCardReviewStatusPending
			card.SubmittedAt = &now
			card.ReviewedAt = nil
			card.ReviewerExternalUserID = nil
			card.ReviewReason = ""
		}

		var asset model.SharePlatformCardAsset
		if err := tx.First(&asset, "card_id = ? AND slot = ?", card.ID, slot).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				asset = model.SharePlatformCardAsset{
					CardID:           card.ID,
					Slot:             slot,
					StoredFileName:   storedFileName,
					OriginalFileName: filepath.Base(input.FileName),
					MimeType:         mimeType,
					Size:             fileSize,
					SortOrder:        shareCardSlotSortOrder(slot),
				}
				if err := tx.Create(&asset).Error; err != nil {
					return err
				}
				card.UpdatedAt = time.Now().UTC()
				return tx.Model(&model.SharePlatformCard{}).
					Where("id = ?", card.ID).
					Updates(map[string]any{
						"updated_at":                card.UpdatedAt,
						"review_status":             card.ReviewStatus,
						"submitted_at":              card.SubmittedAt,
						"reviewed_at":               card.ReviewedAt,
						"review_reason":             card.ReviewReason,
						"reviewer_external_user_id": card.ReviewerExternalUserID,
					}).Error
			}
			return err
		}

		oldStoredFileName = strings.TrimSpace(asset.StoredFileName)
		asset.StoredFileName = storedFileName
		asset.OriginalFileName = filepath.Base(input.FileName)
		asset.MimeType = mimeType
		asset.Size = fileSize
		asset.SortOrder = shareCardSlotSortOrder(slot)
		asset.UpdatedAt = time.Now().UTC()
		if err := tx.Save(&asset).Error; err != nil {
			return err
		}

		card.UpdatedAt = time.Now().UTC()
		return tx.Model(&model.SharePlatformCard{}).
			Where("id = ?", card.ID).
			Updates(map[string]any{
				"updated_at":               card.UpdatedAt,
				"review_status":            card.ReviewStatus,
				"submitted_at":             card.SubmittedAt,
				"reviewed_at":              card.ReviewedAt,
				"review_reason":            card.ReviewReason,
				"reviewer_external_user_id": card.ReviewerExternalUserID,
			}).Error
	})
	if err != nil {
		_ = s.removeStoredFile(ownerID, storedFileName)
		return nil, err
	}
	if oldStoredFileName != "" && oldStoredFileName != storedFileName {
		_ = s.removeStoredFile(ownerID, oldStoredFileName)
	}
	return s.GetCardDetail(ctx, cardID, ownerID)
}

func (s *ShareService) ReplaceCardCoverByOwner(
	ctx context.Context,
	ownerID,
	cardID,
	fileName,
	mimeType string,
	fileReader io.Reader,
	maxFileSize int64,
) (*ShareCardDetail, error) {
	ownerID = strings.TrimSpace(ownerID)
	cardID = strings.TrimSpace(cardID)
	fileName = strings.TrimSpace(fileName)
	if ownerID == "" || cardID == "" {
		return nil, ErrShareCardNotFound
	}
	if fileName == "" || fileReader == nil {
		return nil, ErrShareFileRequired
	}

	normalizedMimeType := detectUploadMimeType(fileName, mimeType)
	if !strings.HasPrefix(strings.ToLower(normalizedMimeType), "image/") {
		return nil, ErrShareInvalidImageData
	}

	storedFileName, fileSize, err := s.saveUploadFile(ownerID, fileName, fileReader, maxFileSize)
	if err != nil {
		return nil, err
	}

	oldStoredFileName := ""
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var card model.SharePlatformCard
		if err := tx.First(&card, "id = ?", cardID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrShareCardNotFound
			}
			return err
		}
		if card.CreatorExternalUserID != ownerID {
			return ErrShareCardForbidden
		}
		if err := s.ensureShareCreatorRoleTx(tx, card.CreatorExternalUserID); err != nil {
			return err
		}
		now := time.Now().UTC()
		if card.Status == model.SharePlatformCardStatusPublished {
			card.ReviewStatus = model.SharePlatformCardReviewStatusPending
			card.SubmittedAt = &now
			card.ReviewedAt = nil
			card.ReviewerExternalUserID = nil
			card.ReviewReason = ""
		}

		oldStoredFileName = strings.TrimSpace(card.StoredFileName)
		card.StoredFileName = storedFileName
		card.OriginalFileName = filepath.Base(fileName)
		card.MimeType = normalizedMimeType
		card.Size = fileSize
		card.UpdatedAt = time.Now().UTC()
		return tx.Model(&model.SharePlatformCard{}).
			Where("id = ?", card.ID).
			Updates(map[string]any{
				"stored_file_name":          card.StoredFileName,
				"original_file_name":        card.OriginalFileName,
				"mime_type":                 card.MimeType,
				"size":                      card.Size,
				"updated_at":                card.UpdatedAt,
				"review_status":             card.ReviewStatus,
				"submitted_at":              card.SubmittedAt,
				"reviewed_at":               card.ReviewedAt,
				"review_reason":             card.ReviewReason,
				"reviewer_external_user_id": card.ReviewerExternalUserID,
			}).Error
	})
	if err != nil {
		_ = s.removeStoredFile(ownerID, storedFileName)
		return nil, err
	}

	if oldStoredFileName != "" && oldStoredFileName != storedFileName {
		_ = s.removeStoredFile(ownerID, oldStoredFileName)
	}
	return s.GetCardDetail(ctx, cardID, ownerID)
}

func (s *ShareService) DeleteCardCoverByOwner(ctx context.Context, ownerID, cardID string) (*ShareCardDetail, error) {
	ownerID = strings.TrimSpace(ownerID)
	cardID = strings.TrimSpace(cardID)
	if ownerID == "" || cardID == "" {
		return nil, ErrShareCardNotFound
	}

	storedFileName := ""
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var card model.SharePlatformCard
		if err := tx.First(&card, "id = ?", cardID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrShareCardNotFound
			}
			return err
		}
		if card.CreatorExternalUserID != ownerID {
			return ErrShareCardForbidden
		}
		if err := s.ensureShareCreatorRoleTx(tx, card.CreatorExternalUserID); err != nil {
			return err
		}
		now := time.Now().UTC()
		if card.Status == model.SharePlatformCardStatusPublished {
			card.ReviewStatus = model.SharePlatformCardReviewStatusPending
			card.SubmittedAt = &now
			card.ReviewedAt = nil
			card.ReviewerExternalUserID = nil
			card.ReviewReason = ""
		}

		storedFileName = strings.TrimSpace(card.StoredFileName)
		card.StoredFileName = ""
		card.OriginalFileName = ""
		card.MimeType = ""
		card.Size = 0
		card.UpdatedAt = time.Now().UTC()
		return tx.Model(&model.SharePlatformCard{}).
			Where("id = ?", card.ID).
			Updates(map[string]any{
				"stored_file_name":          card.StoredFileName,
				"original_file_name":        card.OriginalFileName,
				"mime_type":                 card.MimeType,
				"size":                      card.Size,
				"updated_at":                card.UpdatedAt,
				"review_status":             card.ReviewStatus,
				"submitted_at":              card.SubmittedAt,
				"reviewed_at":               card.ReviewedAt,
				"review_reason":             card.ReviewReason,
				"reviewer_external_user_id": card.ReviewerExternalUserID,
			}).Error
	})
	if err != nil {
		return nil, err
	}

	if storedFileName != "" {
		_ = s.removeStoredFile(ownerID, storedFileName)
	}
	return s.GetCardDetail(ctx, cardID, ownerID)
}

func (s *ShareService) DeleteCardAssetByOwner(ctx context.Context, ownerID, cardID, slot string) (*ShareCardDetail, error) {
	ownerID = strings.TrimSpace(ownerID)
	cardID = strings.TrimSpace(cardID)
	slot = normalizeShareCardSlot(slot)
	if ownerID == "" || cardID == "" {
		return nil, ErrShareCardNotFound
	}
	if !isValidShareCardSlot(slot) {
		return nil, ErrShareInvalidCardSlot
	}

	storedFileName := ""
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var card model.SharePlatformCard
		if err := tx.First(&card, "id = ?", cardID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrShareCardNotFound
			}
			return err
		}
		if card.CreatorExternalUserID != ownerID {
			return ErrShareCardForbidden
		}
		if err := s.ensureShareCreatorRoleTx(tx, card.CreatorExternalUserID); err != nil {
			return err
		}
		now := time.Now().UTC()
		if card.Status == model.SharePlatformCardStatusPublished {
			card.ReviewStatus = model.SharePlatformCardReviewStatusPending
			card.SubmittedAt = &now
			card.ReviewedAt = nil
			card.ReviewerExternalUserID = nil
			card.ReviewReason = ""
		}

		var asset model.SharePlatformCardAsset
		if err := tx.First(&asset, "card_id = ? AND slot = ?", card.ID, slot).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil
			}
			return err
		}
		storedFileName = strings.TrimSpace(asset.StoredFileName)

		var count int64
		if err := tx.Model(&model.SharePlatformCardAsset{}).Where("card_id = ?", card.ID).Count(&count).Error; err != nil {
			return err
		}
		if count <= 1 {
			return ErrShareCardAssetRequired
		}

		if err := tx.Delete(&asset).Error; err != nil {
			return err
		}
		card.UpdatedAt = time.Now().UTC()
		return tx.Model(&model.SharePlatformCard{}).
			Where("id = ?", card.ID).
			Updates(map[string]any{
				"updated_at":                card.UpdatedAt,
				"review_status":             card.ReviewStatus,
				"submitted_at":              card.SubmittedAt,
				"reviewed_at":               card.ReviewedAt,
				"review_reason":             card.ReviewReason,
				"reviewer_external_user_id": card.ReviewerExternalUserID,
			}).Error
	})
	if err != nil {
		return nil, err
	}
	if storedFileName != "" {
		_ = s.removeStoredFile(ownerID, storedFileName)
	}
	return s.GetCardDetail(ctx, cardID, ownerID)
}

func (s *ShareService) GetCardAccessCodeByOwner(ctx context.Context, ownerID, cardID string) (*ShareCardAccessCodeConfig, error) {
	card, err := s.getCardByOwner(ctx, ownerID, cardID)
	if err != nil {
		return nil, err
	}
	if err := s.ensureShareCreatorRole(ctx, ownerID); err != nil {
		return nil, err
	}

	config := buildShareCardAccessCodeConfig(card)
	return &config, nil
}

func (s *ShareService) UpdateCardAccessCodeByOwner(ctx context.Context, input ShareUpdateCardAccessCodeInput) (*ShareCardAccessCodeConfig, error) {
	card, err := s.getCardByOwner(ctx, input.OwnerID, input.CardID)
	if err != nil {
		return nil, err
	}
	if err := s.ensureShareCreatorRole(ctx, input.OwnerID); err != nil {
		return nil, err
	}
	if card.ReviewStatus != model.SharePlatformCardReviewStatusApproved {
		return nil, ErrShareCardForbidden
	}

	normalizedCode := normalizeShareAccessCode(input.Code)
	if !isValidShareAccessCode(normalizedCode) {
		return nil, ErrShareInvalidAccessCode
	}
	if !isValidShareAccessExpireDays(input.ExpireDays) {
		return nil, ErrShareInvalidAccessRules
	}

	usageLimit := input.UsageLimit
	if input.Unlimited {
		usageLimit = 0
	}
	if usageLimit < 0 || usageLimit > 100000 {
		return nil, ErrShareInvalidAccessRules
	}
	if !input.Unlimited && usageLimit == 0 {
		return nil, ErrShareInvalidAccessRules
	}

	expiresAt := computeShareAccessCodeExpiry(input.ExpireDays)

	card.AccessCode = normalizedCode
	card.AccessCodeExpiresAt = expiresAt
	card.AccessCodeUsageLimit = usageLimit
	card.AccessCodeUsageCount = 0
	card.UpdatedAt = time.Now().UTC()

	if err := s.db.WithContext(ctx).Save(card).Error; err != nil {
		return nil, err
	}

	config := buildShareCardAccessCodeConfig(card)
	return &config, nil
}

func (s *ShareService) DeleteCardAccessCodeByOwner(ctx context.Context, ownerID, cardID string) error {
	card, err := s.getCardByOwner(ctx, ownerID, cardID)
	if err != nil {
		return err
	}
	if err := s.ensureShareCreatorRole(ctx, ownerID); err != nil {
		return err
	}

	card.AccessCode = ""
	card.AccessCodeExpiresAt = nil
	card.AccessCodeUsageLimit = 0
	card.AccessCodeUsageCount = 0
	card.UpdatedAt = time.Now().UTC()

	return s.db.WithContext(ctx).Save(card).Error
}

func (s *ShareService) DeleteCardByOwner(ctx context.Context, ownerID, cardID string) error {
	ownerID = strings.TrimSpace(ownerID)
	cardID = strings.TrimSpace(cardID)

	var creatorID string
	storedFileNames := make([]string, 0, 8)
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var card model.SharePlatformCard
		if err := tx.First(&card, "id = ?", cardID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrShareCardNotFound
			}
			return err
		}
		if card.CreatorExternalUserID != ownerID {
			return ErrShareCardForbidden
		}
		if err := s.ensureShareCreatorRoleTx(tx, card.CreatorExternalUserID); err != nil {
			return err
		}

		creatorID = card.CreatorExternalUserID
		var assets []model.SharePlatformCardAsset
		if err := tx.Where("card_id = ?", card.ID).Order("sort_order ASC, created_at ASC").Find(&assets).Error; err != nil {
			return err
		}
		for _, asset := range assets {
			if name := strings.TrimSpace(asset.StoredFileName); name != "" {
				storedFileNames = append(storedFileNames, name)
			}
		}
		if coverName := strings.TrimSpace(card.StoredFileName); coverName != "" {
			storedFileNames = append(storedFileNames, coverName)
		}
		if err := tx.Where("card_id = ?", card.ID).Delete(&model.SharePlatformDownloadLog{}).Error; err != nil {
			return err
		}
		if err := tx.Where("card_id = ?", card.ID).Delete(&model.SharePlatformCardAsset{}).Error; err != nil {
			return err
		}
		return tx.Delete(&card).Error
	})
	if err != nil {
		return err
	}

	for _, storedFileName := range storedFileNames {
		if removeErr := s.removeStoredFile(creatorID, storedFileName); removeErr != nil {
			s.logger.Warn(
				"share remove stored file failed",
				zap.Error(removeErr),
				zap.String("card_id", cardID),
				zap.String("stored_file_name", storedFileName),
			)
		}
	}
	return nil
}

func (s *ShareService) GetCardDetail(ctx context.Context, cardID, viewerUserID string) (*ShareCardDetail, error) {
	var card model.SharePlatformCard
	if err := s.db.WithContext(ctx).First(&card, "id = ?", strings.TrimSpace(cardID)).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrShareCardNotFound
		}
		return nil, err
	}

	viewerUserID = strings.TrimSpace(viewerUserID)
	isManager := false
	if viewerUserID != "" {
		var viewer model.ShareExternalUser
		if err := s.db.WithContext(ctx).First(&viewer, "id = ?", viewerUserID).Error; err == nil {
			isManager = isShareManagerRole(viewer.Role)
		}
	}
	canEdit := viewerUserID != "" && viewerUserID == card.CreatorExternalUserID
	canView := canEdit || (card.Visibility == model.SharePlatformCardVisibilityPublic &&
		card.Status == model.SharePlatformCardStatusPublished &&
		card.ReviewStatus == model.SharePlatformCardReviewStatusApproved)
	if isManager {
		canView = true
	}
	if !canView {
		return nil, ErrShareCardForbidden
	}
	accessCodeStatus := deriveShareCardAccessStatus(&card, canEdit || isManager)
	canDownload := canEdit || isManager || accessCodeStatus == ShareCardAccessStatusNone || accessCodeStatus == ShareCardAccessStatusRequired

	assets, err := s.listCardAssetsByCardID(ctx, card.ID)
	if err != nil {
		return nil, err
	}
	assetsView := buildShareCardAssetViews(card.ID, assets)

	var creator model.ShareExternalUser
	if err := s.db.WithContext(ctx).First(&creator, "id = ?", card.CreatorExternalUserID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrShareUserNotFound
		}
		return nil, err
	}

	statsByCard, _, err := s.aggregateStatsByCard(ctx, []string{card.ID})
	if err != nil {
		return nil, err
	}

	return &ShareCardDetail{
		Card:             toShareCardView(&card, assets),
		Creator:          toSharePublicUser(&creator),
		Stats:            statsByCard[card.ID],
		Assets:           assetsView,
		CanEdit:          canEdit,
		CanDownload:      canDownload,
		AccessCodeStatus: accessCodeStatus,
	}, nil
}

func (s *ShareService) CanAccessCardFile(ctx context.Context, cardID, viewerUserID string) (*model.SharePlatformCard, *model.SharePlatformCardAsset, error) {
	var card model.SharePlatformCard
	if err := s.db.WithContext(ctx).First(&card, "id = ?", strings.TrimSpace(cardID)).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil, ErrShareCardNotFound
		}
		return nil, nil, err
	}

	viewerUserID = strings.TrimSpace(viewerUserID)
	isManager := false
	if viewerUserID != "" {
		var viewer model.ShareExternalUser
		if err := s.db.WithContext(ctx).First(&viewer, "id = ?", viewerUserID).Error; err == nil {
			isManager = isShareManagerRole(viewer.Role)
		}
	}
	canAccess := viewerUserID == card.CreatorExternalUserID || (card.Visibility == model.SharePlatformCardVisibilityPublic &&
		card.Status == model.SharePlatformCardStatusPublished &&
		card.ReviewStatus == model.SharePlatformCardReviewStatusApproved)
	if isManager {
		canAccess = true
	}
	if !canAccess {
		return nil, nil, ErrShareCardForbidden
	}

	asset, err := s.pickPreviewAssetByCardID(ctx, card.ID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil, ErrShareCardNotFound
		}
		return nil, nil, err
	}
	return &card, asset, nil
}

func (s *ShareService) CanAccessCardCover(ctx context.Context, cardID, viewerUserID string) (*model.SharePlatformCard, error) {
	var card model.SharePlatformCard
	if err := s.db.WithContext(ctx).First(&card, "id = ?", strings.TrimSpace(cardID)).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrShareCardNotFound
		}
		return nil, err
	}

	viewerUserID = strings.TrimSpace(viewerUserID)
	isManager := false
	if viewerUserID != "" {
		var viewer model.ShareExternalUser
		if err := s.db.WithContext(ctx).First(&viewer, "id = ?", viewerUserID).Error; err == nil {
			isManager = isShareManagerRole(viewer.Role)
		}
	}
	canAccess := viewerUserID == card.CreatorExternalUserID || (card.Visibility == model.SharePlatformCardVisibilityPublic &&
		card.Status == model.SharePlatformCardStatusPublished &&
		card.ReviewStatus == model.SharePlatformCardReviewStatusApproved)
	if isManager {
		canAccess = true
	}
	if !canAccess {
		return nil, ErrShareCardForbidden
	}
	if strings.TrimSpace(card.StoredFileName) == "" {
		return nil, ErrShareCardNotFound
	}
	return &card, nil
}

func (s *ShareService) GetCardAssetForPreview(ctx context.Context, cardID, slot string) (*model.SharePlatformCardAsset, error) {
	return s.getCardAssetBySlot(ctx, cardID, slot)
}

func (s *ShareService) CanDownloadCardAsset(ctx context.Context, cardID, viewerUserID, accessCode, slot string) (*model.SharePlatformCard, *model.SharePlatformCardAsset, bool, error) {
	var card model.SharePlatformCard
	if err := s.db.WithContext(ctx).First(&card, "id = ?", strings.TrimSpace(cardID)).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil, false, ErrShareCardNotFound
		}
		return nil, nil, false, err
	}

	asset, err := s.getCardAssetBySlot(ctx, card.ID, slot)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil, false, ErrShareCardNotFound
		}
		return nil, nil, false, err
	}

	viewerUserID = strings.TrimSpace(viewerUserID)
	isManager := false
	if viewerUserID != "" {
		var viewer model.ShareExternalUser
		if err := s.db.WithContext(ctx).First(&viewer, "id = ?", viewerUserID).Error; err == nil {
			isManager = isShareManagerRole(viewer.Role)
		}
	}
	if viewerUserID != "" && viewerUserID == card.CreatorExternalUserID {
		return &card, asset, false, nil
	}
	if isManager {
		return &card, asset, false, nil
	}
	if card.Visibility != model.SharePlatformCardVisibilityPublic ||
		card.Status != model.SharePlatformCardStatusPublished ||
		card.ReviewStatus != model.SharePlatformCardReviewStatusApproved {
		return nil, nil, false, ErrShareCardForbidden
	}

	switch deriveShareCardAccessStatus(&card, false) {
	case ShareCardAccessStatusNone:
		return &card, asset, false, nil
	case ShareCardAccessStatusExpired:
		return nil, nil, false, ErrShareAccessCodeExpired
	case ShareCardAccessStatusExhausted:
		return nil, nil, false, ErrShareAccessCodeExhausted
	case ShareCardAccessStatusRequired:
		normalizedCode := normalizeShareAccessCode(accessCode)
		if normalizedCode == "" {
			return nil, nil, false, ErrShareAccessCodeRequired
		}
		if normalizedCode != strings.TrimSpace(card.AccessCode) {
			return nil, nil, false, ErrShareInvalidAccessCode
		}
		return &card, asset, true, nil
	default:
		return nil, nil, false, ErrShareCardForbidden
	}
}

func (s *ShareService) getCardByOwner(ctx context.Context, ownerID, cardID string) (*model.SharePlatformCard, error) {
	ownerID = strings.TrimSpace(ownerID)
	cardID = strings.TrimSpace(cardID)

	var card model.SharePlatformCard
	if err := s.db.WithContext(ctx).First(&card, "id = ?", cardID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrShareCardNotFound
		}
		return nil, err
	}
	if card.CreatorExternalUserID != ownerID {
		return nil, ErrShareCardForbidden
	}

	return &card, nil
}

func (s *ShareService) RecordDownload(ctx context.Context, cardID string, downloaderUserID *string, source string, consumeAccessCode bool) error {
	entry := model.SharePlatformDownloadLog{
		CardID:                   strings.TrimSpace(cardID),
		DownloaderExternalUserID: normalizeOptionalID(downloaderUserID),
		Source:                   strings.TrimSpace(source),
		DownloadedAt:             time.Now().UTC(),
	}
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if consumeAccessCode {
			result := tx.Model(&model.SharePlatformCard{}).
				Where("id = ?", strings.TrimSpace(cardID)).
				Where("access_code_usage_limit <= 0 OR access_code_usage_count < access_code_usage_limit").
				UpdateColumn("access_code_usage_count", gorm.Expr("access_code_usage_count + 1"))
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected == 0 {
				return ErrShareAccessCodeExhausted
			}
		}
		return tx.Create(&entry).Error
	})
}

func (s *ShareService) OpenCardFile(card *model.SharePlatformCard, asset *model.SharePlatformCardAsset) (*os.File, os.FileInfo, error) {
	path := s.getStoredFilePath(card.CreatorExternalUserID, asset.StoredFileName)
	file, err := os.Open(path)
	if err != nil {
		return nil, nil, err
	}
	stat, err := file.Stat()
	if err != nil {
		_ = file.Close()
		return nil, nil, err
	}
	return file, stat, nil
}

func (s *ShareService) OpenCardCoverFile(card *model.SharePlatformCard) (*os.File, os.FileInfo, error) {
	path := s.getStoredFilePath(card.CreatorExternalUserID, card.StoredFileName)
	file, err := os.Open(path)
	if err != nil {
		return nil, nil, err
	}
	stat, err := file.Stat()
	if err != nil {
		_ = file.Close()
		return nil, nil, err
	}
	return file, stat, nil
}

func (s *ShareService) OpenProfileAsset(userID, storedFileName string) (*os.File, os.FileInfo, error) {
	path := s.getProfileAssetPath(userID, storedFileName)
	file, err := os.Open(path)
	if err != nil {
		return nil, nil, err
	}

	stat, err := file.Stat()
	if err != nil {
		_ = file.Close()
		return nil, nil, err
	}

	return file, stat, nil
}

func (s *ShareService) aggregateStatsByCard(ctx context.Context, cardIDs []string) (map[string]ShareCardStats, int64, error) {
	stats := make(map[string]ShareCardStats, len(cardIDs))
	if len(cardIDs) == 0 {
		return stats, 0, nil
	}

	type aggRow struct {
		CardID           string     `gorm:"column:card_id"`
		DownloadCount    int64      `gorm:"column:download_count"`
		LastDownloadedAt *time.Time `gorm:"column:last_downloaded_at"`
	}

	rows := make([]aggRow, 0, len(cardIDs))
	if err := s.db.WithContext(ctx).
		Model(&model.SharePlatformDownloadLog{}).
		Select("card_id, COUNT(*) AS download_count, MAX(downloaded_at) AS last_downloaded_at").
		Where("card_id IN ?", cardIDs).
		Group("card_id").
		Scan(&rows).Error; err != nil {
		return nil, 0, err
	}

	totalDownloads := int64(0)
	for _, row := range rows {
		stats[row.CardID] = ShareCardStats{
			DownloadCount:    row.DownloadCount,
			LastDownloadedAt: row.LastDownloadedAt,
		}
		totalDownloads += row.DownloadCount
	}

	for _, cardID := range cardIDs {
		if _, exists := stats[cardID]; !exists {
			stats[cardID] = ShareCardStats{}
		}
	}

	return stats, totalDownloads, nil
}

func (s *ShareService) mapDiscoverCards(
	ctx context.Context,
	cards []model.SharePlatformCard,
	assetsByCardID map[string][]model.SharePlatformCardAsset,
) ([]ShareDiscoverCardItem, error) {
	cardIDs := make([]string, 0, len(cards))
	creatorIDs := make([]string, 0, len(cards))
	creatorSet := make(map[string]struct{}, len(cards))
	for _, card := range cards {
		cardIDs = append(cardIDs, card.ID)
		if _, exists := creatorSet[card.CreatorExternalUserID]; !exists {
			creatorSet[card.CreatorExternalUserID] = struct{}{}
			creatorIDs = append(creatorIDs, card.CreatorExternalUserID)
		}
	}

	creators := make([]model.ShareExternalUser, 0, len(creatorIDs))
	if err := s.db.WithContext(ctx).Where("id IN ?", creatorIDs).Find(&creators).Error; err != nil {
		return nil, err
	}
	creatorMap := make(map[string]model.ShareExternalUser, len(creators))
	for _, creator := range creators {
		creatorMap[creator.ID] = creator
	}

	statsByCard, _, err := s.aggregateStatsByCard(ctx, cardIDs)
	if err != nil {
		return nil, err
	}

	items := make([]ShareDiscoverCardItem, 0, len(cards))
	for _, card := range cards {
		creator, exists := creatorMap[card.CreatorExternalUserID]
		creatorView := SharePublicUser{
			ID:       card.CreatorExternalUserID,
			Username: "creator",
			Nickname: "Creator",
			Avatar:   "",
		}
		if exists {
			creatorView = toSharePublicUser(&creator)
		}
		items = append(items, ShareDiscoverCardItem{
			Card:    toShareCardView(&card, assetsByCardID[card.ID]),
			Creator: creatorView,
			Stats:   statsByCard[card.ID],
		})
	}

	return items, nil
}

func collectShareCardIDs(cards []model.SharePlatformCard) []string {
	if len(cards) == 0 {
		return nil
	}
	ids := make([]string, 0, len(cards))
	for _, card := range cards {
		ids = append(ids, card.ID)
	}
	return ids
}

func (s *ShareService) listCardAssetsByCardIDs(ctx context.Context, cardIDs []string) (map[string][]model.SharePlatformCardAsset, error) {
	result := make(map[string][]model.SharePlatformCardAsset, len(cardIDs))
	if len(cardIDs) == 0 {
		return result, nil
	}

	rows := make([]model.SharePlatformCardAsset, 0, len(cardIDs))
	if err := s.db.WithContext(ctx).
		Where("card_id IN ?", cardIDs).
		Order("sort_order ASC, created_at ASC").
		Find(&rows).Error; err != nil {
		return nil, err
	}

	for _, row := range rows {
		result[row.CardID] = append(result[row.CardID], row)
	}
	return result, nil
}

func (s *ShareService) listCardAssetsByCardID(ctx context.Context, cardID string) ([]model.SharePlatformCardAsset, error) {
	items := make([]model.SharePlatformCardAsset, 0, 6)
	if err := s.db.WithContext(ctx).
		Where("card_id = ?", strings.TrimSpace(cardID)).
		Order("sort_order ASC, created_at ASC").
		Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (s *ShareService) pickPreviewAssetByCardID(ctx context.Context, cardID string) (*model.SharePlatformCardAsset, error) {
	assets, err := s.listCardAssetsByCardID(ctx, cardID)
	if err != nil {
		return nil, err
	}
	if len(assets) == 0 {
		return nil, gorm.ErrRecordNotFound
	}

	for _, asset := range assets {
		if strings.HasPrefix(strings.ToLower(strings.TrimSpace(asset.MimeType)), "image/") {
			copy := asset
			return &copy, nil
		}
	}
	copy := assets[0]
	return &copy, nil
}

func (s *ShareService) getCardAssetBySlot(ctx context.Context, cardID, slot string) (*model.SharePlatformCardAsset, error) {
	normalizedSlot := normalizeShareCardSlot(slot)
	if !isValidShareCardSlot(normalizedSlot) {
		return nil, ErrShareInvalidCardSlot
	}

	var asset model.SharePlatformCardAsset
	if err := s.db.WithContext(ctx).
		First(&asset, "card_id = ? AND slot = ?", strings.TrimSpace(cardID), normalizedSlot).Error; err != nil {
		return nil, err
	}
	return &asset, nil
}

func buildShareCardAssetViews(cardID string, assets []model.SharePlatformCardAsset) []ShareCardAssetView {
	if len(assets) == 0 {
		return []ShareCardAssetView{}
	}
	items := make([]ShareCardAssetView, 0, len(assets))
	for _, asset := range assets {
		slot := strings.TrimSpace(asset.Slot)
		items = append(items, ShareCardAssetView{
			Slot:             slot,
			OriginalFileName: asset.OriginalFileName,
			MimeType:         asset.MimeType,
			Size:             asset.Size,
			PreviewUrl:       fmt.Sprintf("/api/share/cards/%s/assets/%s/preview", cardID, slot),
			DownloadUrl:      fmt.Sprintf("/api/share/cards/%s/assets/%s/download", cardID, slot),
		})
	}
	return items
}

func (s *ShareService) saveUploadFile(userID, originalName string, reader io.Reader, maxFileSize int64) (string, int64, error) {
	if err := os.MkdirAll(s.fileRoot, 0o755); err != nil {
		return "", 0, ErrShareSaveFileFailed
	}

	ext := filepath.Ext(originalName)
	storedName := fmt.Sprintf("%d-%s%s", time.Now().UTC().UnixMilli(), randomUUIDLike(), ext)
	userDir := filepath.Join(s.fileRoot, filepath.Base(strings.TrimSpace(userID)))
	if err := os.MkdirAll(userDir, 0o755); err != nil {
		return "", 0, ErrShareSaveFileFailed
	}

	targetPath := filepath.Join(userDir, storedName)
	file, err := os.Create(targetPath)
	if err != nil {
		return "", 0, ErrShareSaveFileFailed
	}
	defer file.Close()

	var source io.Reader = reader
	if maxFileSize > 0 {
		source = io.LimitReader(reader, maxFileSize+1)
	}

	n, err := io.Copy(file, source)
	if err != nil {
		_ = os.Remove(targetPath)
		return "", 0, ErrShareSaveFileFailed
	}
	if maxFileSize > 0 && n > maxFileSize {
		_ = os.Remove(targetPath)
		return "", 0, ErrShareFileTooLarge
	}
	if n <= 0 {
		_ = os.Remove(targetPath)
		return "", 0, ErrShareFileRequired
	}

	return storedName, n, nil
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

func (s *ShareService) removeStoredFile(userID, storedName string) error {
	path := s.getStoredFilePath(userID, storedName)
	if path == "" {
		return nil
	}
	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

func (s *ShareService) getStoredFilePath(userID, storedFileName string) string {
	safeUser := filepath.Base(strings.TrimSpace(userID))
	safeFile := filepath.Base(strings.TrimSpace(storedFileName))
	return filepath.Join(s.fileRoot, safeUser, safeFile)
}

func (s *ShareService) getProfileAssetPath(userID, storedFileName string) string {
	safeUser := filepath.Base(strings.TrimSpace(userID))
	safeFile := filepath.Base(strings.TrimSpace(storedFileName))
	return filepath.Join(s.fileRoot, "profiles", safeUser, safeFile)
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

func normalizeShareExternalEmail(raw string) (string, error) {
	email := strings.ToLower(strings.TrimSpace(raw))
	if email == "" {
		return "", ErrShareInvalidEmail
	}
	if _, err := mail.ParseAddress(email); err != nil {
		return "", ErrShareInvalidEmail
	}
	return email, nil
}

func shareUsernameBaseFromEmail(email string) string {
	local := email
	if at := strings.Index(local, "@"); at >= 0 {
		local = local[:at]
	}
	local = strings.ToLower(strings.TrimSpace(local))
	local = shareExternalUsernameCleanPattern.ReplaceAllString(local, "_")
	local = strings.Trim(local, "_")
	if len(local) < 3 {
		local = "user_" + local
	}
	if len(local) > 24 {
		local = local[:24]
	}
	if local == "" {
		return "user"
	}
	return local
}

func defaultShareNicknameFromEmail(email string) string {
	base := shareUsernameBaseFromEmail(email)
	base = strings.Trim(base, "_")
	if len(base) > 40 {
		base = base[:40]
	}
	if err := validateShareNickname(base); err == nil {
		return base
	}
	return "\u65b0\u7528\u6237"
}

func validateShareNickname(nickname string) error {
	nickname = strings.TrimSpace(nickname)
	if len(nickname) < 2 || len(nickname) > 40 {
		return ErrShareInvalidProfile
	}
	return nil
}

func validateShareBio(bio string) error {
	bio = strings.TrimSpace(bio)
	if len([]rune(bio)) > 100 {
		return ErrShareInvalidBio
	}
	return nil
}

func validateSharePhone(phone string) error {
	phone = strings.TrimSpace(phone)
	if phone == "" {
		return nil
	}
	if len(phone) < 6 || len(phone) > 20 {
		return ErrShareInvalidPhone
	}
	for _, char := range phone {
		if (char >= '0' && char <= '9') || char == '+' || char == '-' || char == ' ' {
			continue
		}
		return ErrShareInvalidPhone
	}
	return nil
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

func isValidShareVisibility(value string) bool {
	switch normalizeShareVisibility(value) {
	case model.SharePlatformCardVisibilityPrivate, model.SharePlatformCardVisibilityPublic:
		return true
	default:
		return false
	}
}

func normalizeShareVisibility(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	if value == model.SharePlatformCardVisibilityPublic {
		return model.SharePlatformCardVisibilityPublic
	}
	return model.SharePlatformCardVisibilityPrivate
}

func normalizeShareExternalUserRole(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	if value == model.ShareExternalUserRoleManager {
		return model.ShareExternalUserRoleManager
	}
	if value == model.ShareExternalUserRoleCreator {
		return model.ShareExternalUserRoleCreator
	}
	return model.ShareExternalUserRoleViewer
}

func isValidShareExternalUserRole(value string) bool {
	switch normalizeShareExternalUserRole(value) {
	case model.ShareExternalUserRoleViewer, model.ShareExternalUserRoleCreator, model.ShareExternalUserRoleManager:
		return true
	default:
		return false
	}
}

func normalizeShareCardSlot(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func isValidShareCardSlot(value string) bool {
	value = normalizeShareCardSlot(value)
	for _, slot := range shareCardContentSlots {
		if value == slot {
			return true
		}
	}
	return false
}

func shareCardSlotSortOrder(slot string) int {
	switch normalizeShareCardSlot(slot) {
	case "system_theme":
		return 0
	case "wechat_theme":
		return 1
	case "app":
		return 2
	case "character_persona":
		return 3
	case "world_book":
		return 4
	default:
		return 999
	}
}

func validateShareCardSlotItems(items []ShareCreateCardAssetInput) error {
	if len(items) == 0 {
		return ErrShareFileRequired
	}
	seen := make(map[string]struct{}, len(items))
	for _, item := range items {
		slot := normalizeShareCardSlot(item.Slot)
		if !isValidShareCardSlot(slot) {
			return ErrShareInvalidCardSlot
		}
		if _, exists := seen[slot]; exists {
			return ErrShareInvalidCardSlot
		}
		seen[slot] = struct{}{}

		if strings.TrimSpace(item.FileName) == "" || item.FileReader == nil {
			return ErrShareFileRequired
		}
	}
	return nil
}

func isShareManagerRole(role string) bool {
	return strings.EqualFold(strings.TrimSpace(role), model.ShareExternalUserRoleManager)
}

func isShareCreatorRole(role string) bool {
	normalized := normalizeShareExternalUserRole(role)
	return normalized == model.ShareExternalUserRoleCreator || normalized == model.ShareExternalUserRoleManager
}

func isValidShareStatus(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case model.SharePlatformCardStatusDraft, model.SharePlatformCardStatusPublished, model.SharePlatformCardStatusArchived:
		return true
	default:
		return false
	}
}

func normalizeShareReviewStatus(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func isValidShareReviewStatus(value string) bool {
	switch normalizeShareReviewStatus(value) {
	case model.SharePlatformCardReviewStatusUnsubmitted,
		model.SharePlatformCardReviewStatusPending,
		model.SharePlatformCardReviewStatusApproved,
		model.SharePlatformCardReviewStatusRejected:
		return true
	default:
		return false
	}
}

func defaultReviewStatusForStatus(status string) string {
	if strings.EqualFold(strings.TrimSpace(status), model.SharePlatformCardStatusPublished) {
		return model.SharePlatformCardReviewStatusPending
	}
	return model.SharePlatformCardReviewStatusUnsubmitted
}

func defaultSubmittedAtForReviewStatus(reviewStatus string) *time.Time {
	if strings.EqualFold(strings.TrimSpace(reviewStatus), model.SharePlatformCardReviewStatusPending) {
		now := time.Now().UTC()
		return &now
	}
	return nil
}

func normalizeShareAccessCode(value string) string {
	value = strings.ToUpper(strings.TrimSpace(value))
	value = strings.ReplaceAll(value, " ", "-")
	return value
}

func isValidShareAccessCode(value string) bool {
	if value == "" || len(value) > 32 {
		return false
	}

	return shareAccessCodePattern.MatchString(value)
}

func isValidShareAccessExpireDays(days int) bool {
	switch days {
	case 0, 1, 7:
		return true
	default:
		return false
	}
}

func computeShareAccessCodeExpiry(days int) *time.Time {
	if days <= 0 {
		return nil
	}

	expiresAt := time.Now().UTC().Add(time.Duration(days) * 24 * time.Hour)
	return &expiresAt
}

func deriveShareAccessExpireDays(expiresAt *time.Time) int {
	if expiresAt == nil {
		return 0
	}

	remaining := time.Until(expiresAt.UTC())
	if remaining <= 0 {
		return 0
	}
	if remaining <= 36*time.Hour {
		return 1
	}
	return 7
}

func buildShareCardAccessCodeConfig(card *model.SharePlatformCard) ShareCardAccessCodeConfig {
	now := time.Now().UTC()
	expiresAt := card.AccessCodeExpiresAt
	isExpired := expiresAt != nil && expiresAt.Before(now)
	unlimited := card.AccessCodeUsageLimit <= 0
	isExhausted := !unlimited && card.AccessCodeUsageCount >= card.AccessCodeUsageLimit
	isActive := strings.TrimSpace(card.AccessCode) != "" && !isExpired && !isExhausted

	return ShareCardAccessCodeConfig{
		CardID:     card.ID,
		Code:       strings.TrimSpace(card.AccessCode),
		ExpiresAt:  expiresAt,
		ExpireDays: deriveShareAccessExpireDays(expiresAt),
		UsageLimit: card.AccessCodeUsageLimit,
		UsageCount: card.AccessCodeUsageCount,
		Unlimited:  unlimited,
		IsActive:   isActive,
		IsExpired:  isExpired,
	}
}

func deriveShareCardAccessStatus(card *model.SharePlatformCard, canEdit bool) ShareCardAccessStatus {
	if canEdit {
		return ShareCardAccessStatusNone
	}
	if strings.TrimSpace(card.AccessCode) == "" {
		return ShareCardAccessStatusNone
	}

	now := time.Now().UTC()
	if card.AccessCodeExpiresAt != nil && card.AccessCodeExpiresAt.Before(now) {
		return ShareCardAccessStatusExpired
	}
	if card.AccessCodeUsageLimit > 0 && card.AccessCodeUsageCount >= card.AccessCodeUsageLimit {
		return ShareCardAccessStatusExhausted
	}
	return ShareCardAccessStatusRequired
}

func toShareSessionUser(user *model.ShareExternalUser) ShareSessionUser {
	return ShareSessionUser{
		ID:         user.ID,
		Email:      user.Email,
		Username:   user.Username,
		Nickname:   user.NormalizedDisplayName(),
		Avatar:     user.Avatar,
		Bio:        strings.TrimSpace(user.Bio),
		CoverImage: strings.TrimSpace(user.CoverImage),
		Phone:      strings.TrimSpace(user.Phone),
		Role:       normalizeShareExternalUserRole(user.Role),
		CreatedAt:  user.CreatedAt,
	}
}

func toSharePublicUser(user *model.ShareExternalUser) SharePublicUser {
	return SharePublicUser{
		ID:       user.ID,
		Username: user.Username,
		Nickname: user.NormalizedDisplayName(),
		Avatar:   user.Avatar,
	}
}

func toShareCardView(card *model.SharePlatformCard, assets []model.SharePlatformCardAsset) ShareCardView {
	cardID := card.ID
	hasCover := strings.TrimSpace(card.StoredFileName) != ""
	primaryFileName := strings.TrimSpace(card.OriginalFileName)
	primaryMimeType := strings.TrimSpace(card.MimeType)
	if hasCover {
		primaryMimeType = detectUploadMimeType(primaryFileName, primaryMimeType)
	}
	primarySize := card.Size
	categories := make([]string, 0, len(assets))
	for _, asset := range assets {
		slot := strings.TrimSpace(asset.Slot)
		if slot != "" {
			categories = append(categories, slot)
		}
	}

	if !hasCover && len(assets) > 0 {
		primaryFileName = assets[0].OriginalFileName
		primaryMimeType = assets[0].MimeType
		primarySize = assets[0].Size
		for _, asset := range assets {
			if strings.HasPrefix(strings.ToLower(strings.TrimSpace(asset.MimeType)), "image/") {
				primaryFileName = asset.OriginalFileName
				primaryMimeType = asset.MimeType
				primarySize = asset.Size
				break
			}
		}
	}

	defaultSlot := ""
	if len(assets) > 0 {
		defaultSlot = strings.TrimSpace(assets[0].Slot)
	}
	if defaultSlot == "" {
		defaultSlot = "system_theme"
	}
	previewURL := ""
	downloadURL := ""
	if hasCover {
		previewURL = fmt.Sprintf("/api/share/cards/%s/cover/preview", cardID)
		downloadURL = fmt.Sprintf("/api/share/cards/%s/cover/download", cardID)
	} else {
		previewURL = fmt.Sprintf("/api/share/cards/%s/assets/%s/preview", cardID, defaultSlot)
		downloadURL = fmt.Sprintf("/api/share/cards/%s/assets/%s/download", cardID, defaultSlot)
	}
	return ShareCardView{
		ID:               card.ID,
		CreatorID:        card.CreatorExternalUserID,
		Title:            card.Title,
		Description:      card.Description,
		Visibility:       card.Visibility,
		Status:           card.Status,
		ReviewStatus:     normalizeShareReviewStatus(card.ReviewStatus),
		ReviewReason:     strings.TrimSpace(card.ReviewReason),
		SubmittedAt:      card.SubmittedAt,
		ReviewedAt:       card.ReviewedAt,
		OriginalFileName: primaryFileName,
		MimeType:         primaryMimeType,
		Size:             primarySize,
		PreviewUrl:       previewURL,
		DownloadUrl:      downloadURL,
		Categories:       categories,
		CreatedAt:        card.CreatedAt,
		UpdatedAt:        card.UpdatedAt,
	}
}

func detectUploadMimeType(fileName, providedMimeType string) string {
	value := strings.TrimSpace(strings.ToLower(providedMimeType))
	if value != "" && value != "application/octet-stream" {
		return value
	}

	ext := strings.ToLower(strings.TrimSpace(filepath.Ext(fileName)))
	if ext != "" {
		if guessed := strings.TrimSpace(strings.ToLower(mime.TypeByExtension(ext))); guessed != "" {
			return guessed
		}
	}

	if value != "" {
		return value
	}

	return "application/octet-stream"
}

func normalizeOptionalID(id *string) *string {
	if id == nil {
		return nil
	}
	value := strings.TrimSpace(*id)
	if value == "" {
		return nil
	}
	return &value
}

func randomUUIDLike() string {
	const letters = "0123456789abcdef"
	parts := []int{8, 4, 4, 4, 12}
	resultParts := make([]string, 0, len(parts))
	for _, length := range parts {
		builder := strings.Builder{}
		builder.Grow(length)
		max := big.NewInt(int64(len(letters)))
		for i := 0; i < length; i++ {
			n, err := rand.Int(rand.Reader, max)
			if err != nil {
				builder.WriteByte('0')
				continue
			}
			builder.WriteByte(letters[n.Int64()])
		}
		resultParts = append(resultParts, builder.String())
	}
	return strings.Join(resultParts, "-")
}
