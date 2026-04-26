package service

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"math/big"
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
)

type ShareService struct {
	db       *gorm.DB
	logger   *zap.Logger
	fileRoot string
}

func NewShareService(db *gorm.DB, logger *zap.Logger, fileRoot string) *ShareService {
	if strings.TrimSpace(fileRoot) == "" {
		fileRoot = filepath.Join("storage", "share", "files")
	}
	return &ShareService{
		db:       db,
		logger:   logger,
		fileRoot: fileRoot,
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
	CreatedAt  time.Time `json:"createdAt"`
}

type ShareCardView struct {
	ID               string    `json:"id"`
	CreatorID        string    `json:"creatorId"`
	Title            string    `json:"title"`
	Description      string    `json:"description"`
	Visibility       string    `json:"visibility"`
	Status           string    `json:"status"`
	OriginalFileName string    `json:"originalFileName"`
	MimeType         string    `json:"mimeType"`
	Size             int64     `json:"size"`
	PreviewUrl       string    `json:"previewUrl"`
	DownloadUrl      string    `json:"downloadUrl"`
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

	sessionUser := toShareSessionUser(&user)
	return &sessionUser, nil
}

func (s *ShareService) ListDiscoverCards(ctx context.Context) ([]ShareDiscoverCardItem, error) {
	cards := make([]model.SharePlatformCard, 0, 24)
	if err := s.db.WithContext(ctx).
		Where("visibility = ? AND status = ?", model.SharePlatformCardVisibilityPublic, model.SharePlatformCardStatusPublished).
		Order("updated_at DESC").
		Find(&cards).Error; err != nil {
		return nil, err
	}
	if len(cards) == 0 {
		return []ShareDiscoverCardItem{}, nil
	}

	return s.mapDiscoverCards(ctx, cards)
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
		if card.Visibility == model.SharePlatformCardVisibilityPublic && card.Status == model.SharePlatformCardStatusPublished {
			totalPublic++
		}
	}

	statsByCard, totalDownloads, err := s.aggregateStatsByCard(ctx, cardIDs)
	if err != nil {
		return nil, err
	}

	items := make([]ShareDashboardCard, 0, len(cards))
	for _, card := range cards {
		items = append(items, ShareDashboardCard{
			Card:          toShareCardView(&card),
			Stats:         statsByCard[card.ID],
			HasAccessCode: strings.TrimSpace(card.AccessCode) != "",
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

	items := make([]ShareAccessCodeDashboardItem, 0, len(cards))
	availableCards := make([]ShareCardView, 0, len(cards))
	for _, card := range cards {
		cardView := toShareCardView(&card)
		config := buildShareCardAccessCodeConfig(&card)
		hasAccessCode := strings.TrimSpace(config.Code) != ""
		isPubliclyVisible := card.Visibility == model.SharePlatformCardVisibilityPublic && card.Status == model.SharePlatformCardStatusPublished
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

	storedFileName, fileSize, err := s.saveUploadFile(input.CreatorID, input.FileName, input.FileReader, input.MaxFileSize)
	if err != nil {
		return nil, err
	}

	mimeType := strings.TrimSpace(input.MimeType)
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}

	card := model.SharePlatformCard{
		CreatorExternalUserID: strings.TrimSpace(input.CreatorID),
		Title:                 strings.TrimSpace(input.Title),
		Description:           strings.TrimSpace(input.Description),
		Visibility:            normalizeShareVisibility(input.Visibility),
		Status:                status,
		StoredFileName:        storedFileName,
		OriginalFileName:      filepath.Base(input.FileName),
		MimeType:              mimeType,
		Size:                  fileSize,
	}
	if err := s.db.WithContext(ctx).Create(&card).Error; err != nil {
		_ = s.removeStoredFile(input.CreatorID, storedFileName)
		return nil, err
	}

	view := toShareCardView(&card)
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

		card.Title = strings.TrimSpace(input.Title)
		card.Description = strings.TrimSpace(input.Description)
		card.Visibility = normalizeShareVisibility(input.Visibility)
		card.Status = status
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

	view := toShareCardView(&updated)
	return &view, nil
}

func (s *ShareService) GetCardAccessCodeByOwner(ctx context.Context, ownerID, cardID string) (*ShareCardAccessCodeConfig, error) {
	card, err := s.getCardByOwner(ctx, ownerID, cardID)
	if err != nil {
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
	var storedFileName string
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

		creatorID = card.CreatorExternalUserID
		storedFileName = card.StoredFileName
		if err := tx.Where("card_id = ?", card.ID).Delete(&model.SharePlatformDownloadLog{}).Error; err != nil {
			return err
		}
		return tx.Delete(&card).Error
	})
	if err != nil {
		return err
	}

	if storedFileName != "" {
		if removeErr := s.removeStoredFile(creatorID, storedFileName); removeErr != nil {
			s.logger.Warn("share remove stored file failed", zap.Error(removeErr), zap.String("card_id", cardID))
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
	canEdit := viewerUserID != "" && viewerUserID == card.CreatorExternalUserID
	canView := canEdit || (card.Visibility == model.SharePlatformCardVisibilityPublic && card.Status == model.SharePlatformCardStatusPublished)
	if !canView {
		return nil, ErrShareCardForbidden
	}
	accessCodeStatus := deriveShareCardAccessStatus(&card, canEdit)
	canDownload := canEdit || accessCodeStatus == ShareCardAccessStatusNone || accessCodeStatus == ShareCardAccessStatusRequired

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
		Card:             toShareCardView(&card),
		Creator:          toSharePublicUser(&creator),
		Stats:            statsByCard[card.ID],
		CanEdit:          canEdit,
		CanDownload:      canDownload,
		AccessCodeStatus: accessCodeStatus,
	}, nil
}

func (s *ShareService) CanAccessCardFile(ctx context.Context, cardID, viewerUserID string) (*model.SharePlatformCard, error) {
	var card model.SharePlatformCard
	if err := s.db.WithContext(ctx).First(&card, "id = ?", strings.TrimSpace(cardID)).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrShareCardNotFound
		}
		return nil, err
	}

	viewerUserID = strings.TrimSpace(viewerUserID)
	if viewerUserID == card.CreatorExternalUserID {
		return &card, nil
	}
	if card.Visibility == model.SharePlatformCardVisibilityPublic && card.Status == model.SharePlatformCardStatusPublished {
		return &card, nil
	}
	return nil, ErrShareCardForbidden
}

func (s *ShareService) CanDownloadCardFile(ctx context.Context, cardID, viewerUserID, accessCode string) (*model.SharePlatformCard, bool, error) {
	var card model.SharePlatformCard
	if err := s.db.WithContext(ctx).First(&card, "id = ?", strings.TrimSpace(cardID)).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, false, ErrShareCardNotFound
		}
		return nil, false, err
	}

	viewerUserID = strings.TrimSpace(viewerUserID)
	if viewerUserID != "" && viewerUserID == card.CreatorExternalUserID {
		return &card, false, nil
	}
	if card.Visibility != model.SharePlatformCardVisibilityPublic || card.Status != model.SharePlatformCardStatusPublished {
		return nil, false, ErrShareCardForbidden
	}

	switch deriveShareCardAccessStatus(&card, false) {
	case ShareCardAccessStatusNone:
		return &card, false, nil
	case ShareCardAccessStatusExpired:
		return nil, false, ErrShareAccessCodeExpired
	case ShareCardAccessStatusExhausted:
		return nil, false, ErrShareAccessCodeExhausted
	case ShareCardAccessStatusRequired:
		normalizedCode := normalizeShareAccessCode(accessCode)
		if normalizedCode == "" {
			return nil, false, ErrShareAccessCodeRequired
		}
		if normalizedCode != strings.TrimSpace(card.AccessCode) {
			return nil, false, ErrShareInvalidAccessCode
		}
		return &card, true, nil
	default:
		return nil, false, ErrShareCardForbidden
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

func (s *ShareService) OpenCardFile(card *model.SharePlatformCard) (*os.File, os.FileInfo, error) {
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

func (s *ShareService) mapDiscoverCards(ctx context.Context, cards []model.SharePlatformCard) ([]ShareDiscoverCardItem, error) {
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
			Card:    toShareCardView(&card),
			Creator: creatorView,
			Stats:   statsByCard[card.ID],
		})
	}

	return items, nil
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

func isValidShareStatus(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case model.SharePlatformCardStatusDraft, model.SharePlatformCardStatusPublished, model.SharePlatformCardStatusArchived:
		return true
	default:
		return false
	}
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

func toShareCardView(card *model.SharePlatformCard) ShareCardView {
	cardID := card.ID
	return ShareCardView{
		ID:               card.ID,
		CreatorID:        card.CreatorExternalUserID,
		Title:            card.Title,
		Description:      card.Description,
		Visibility:       card.Visibility,
		Status:           card.Status,
		OriginalFileName: card.OriginalFileName,
		MimeType:         card.MimeType,
		Size:             card.Size,
		PreviewUrl:       "/api/share/cards/" + cardID + "/preview",
		DownloadUrl:      "/api/share/cards/" + cardID + "/download",
		CreatedAt:        card.CreatedAt,
		UpdatedAt:        card.UpdatedAt,
	}
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
