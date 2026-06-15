package service

import (
	"context"
	"crypto/rand"
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
	"sync"
	"time"

	"github.com/baobaobai/baobaobaivault/internal/cache"
	"github.com/baobaobai/baobaobaivault/internal/config"
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
		"desktop_component",
	}

	ErrShareInvalidEmail                   = errors.New("invalid email")
	ErrShareEmailExists                    = errors.New("email already registered")
	ErrShareEmailNotVerified               = errors.New("email not verified")
	ErrShareVerificationExpired            = errors.New("verification code expired")
	ErrShareVerificationInvalid            = errors.New("invalid verification code")
	ErrShareVerificationRequired           = errors.New("verification required")
	ErrShareVerificationTooMany            = errors.New("too many verification attempts")
	ErrShareVerificationTooSoon            = errors.New("verification requested too frequently")
	ErrShareResetPasswordTooSoon           = errors.New("password reset requested too frequently")
	ErrShareResetPasswordNotFound          = errors.New("password reset request not found")
	ErrShareWeakPassword                   = errors.New("password must be at least 6 characters")
	ErrShareInvalidProfile                 = errors.New("nickname must be between 2 and 40 characters")
	ErrShareInvalidBio                     = errors.New("bio must be at most 100 characters")
	ErrShareInvalidPhone                   = errors.New("phone format is invalid")
	ErrShareAuthFailed                     = errors.New("invalid email or password")
	ErrShareInvalidOldPassword             = errors.New("current password is incorrect")
	ErrShareInvalidImageData               = errors.New("invalid image data")
	ErrShareImageTooLarge                  = errors.New("image exceeds 5MB")
	ErrShareUserNotFound                   = errors.New("user not found")
	ErrShareCardNotFound                   = errors.New("card not found")
	ErrShareCardForbidden                  = errors.New("card access denied")
	ErrShareCardTitleRequired              = errors.New("card title is required")
	ErrShareFileRequired                   = errors.New("upload file is required")
	ErrShareFileTooLarge                   = errors.New("file exceeds max upload size")
	ErrShareSaveFileFailed                 = errors.New("failed to save file")
	ErrShareInvalidVisibility              = errors.New("invalid card visibility")
	ErrShareInvalidCardStatus              = errors.New("invalid card status")
	ErrShareInvalidAccessMode              = errors.New("invalid card access mode")
	ErrSharePaidAccessRequired             = errors.New("paid access mode required")
	ErrShareInvalidAccessCode              = errors.New("invalid access code")
	ErrShareInvalidAccessRules             = errors.New("invalid access code rules")
	ErrShareAccessCodeRequired             = errors.New("access code required")
	ErrShareAccessCodeExpired              = errors.New("access code expired")
	ErrShareAccessCodeExhausted            = errors.New("access code exhausted")
	ErrShareForbiddenRole                  = errors.New("manager role required")
	ErrShareInvalidCardSlot                = errors.New("invalid card content slot")
	ErrShareInvalidUserRole                = errors.New("invalid user role")
	ErrShareSelfRoleDowngrade              = errors.New("cannot downgrade your own role")
	ErrShareSelfDelete                     = errors.New("cannot delete your own account")
	ErrShareLastManagerDelete              = errors.New("cannot delete the last manager account")
	ErrShareProtectedSuperAdmin            = errors.New("cannot delete configured super admin account")
	ErrShareSuperAdminRequired             = errors.New("configured super admin required")
	ErrShareDeleteAuthFailed               = errors.New("current password is incorrect")
	ErrSharePasswordResetFailed            = errors.New("password reset failed")
	ErrShareAdminResetUnavailable          = errors.New("admin password reset unavailable")
	ErrShareCardAssetRequired              = errors.New("card must keep at least one category file")
	ErrShareFavoriteNotFound               = errors.New("favorite not found")
	ErrShareInvalidReviewStatus            = errors.New("invalid review status")
	ErrShareReviewReasonRequired           = errors.New("review reason is required")
	ErrShareInvalidSystemThemePackage      = errors.New("invalid system theme package")
	ErrShareSystemThemePackageTooLarge     = errors.New("system theme package exceeds 20MB")
	ErrShareInvalidWechatThemePackage      = errors.New("invalid wechat theme package")
	ErrShareWechatThemePackageTooLarge     = errors.New("wechat theme package exceeds 20MB")
	ErrShareInvalidDesktopComponent        = errors.New("invalid desktop component file")
	ErrShareDesktopComponentTooLarge       = errors.New("desktop component file exceeds 2MB")
	ErrShareInvalidWorldBookPackage        = errors.New("invalid world book package")
	ErrShareWorldBookPackageTooLarge       = errors.New("world book package exceeds 2MB")
	ErrShareInvalidVerificationCodeTTL     = errors.New("invalid verification code ttl")
	ErrShareInvalidResendInterval          = errors.New("invalid resend interval")
	ErrShareInvalidMaxVerifyAttempts       = errors.New("invalid max verify attempts")
	ErrShareAuthConfigConflict             = errors.New("resend interval must be shorter than verification code ttl")
	ErrShareEmailVerificationRequiresEmail = errors.New("email verification requires email service configuration")
)

type ShareService struct {
	db                     *gorm.DB
	logger                 *zap.Logger
	cache                  *cache.Client
	storageService         *StorageService
	fileRoot               string
	managerEmailAllow      map[string]struct{}
	shareAuthCfgMu         sync.RWMutex
	shareAuthCfg           config.ShareAuthConfig
	shareMediaCfgMu        sync.RWMutex
	shareMediaCfg          ShareMediaStorageSettingsView
	shareSiteBrandMu       sync.RWMutex
	shareSiteBrandCfg      ShareSiteBrandingSettingsView
	shareSiteBrandLoadedAt time.Time
	emailService           *EmailService
}

func NewShareService(
	db *gorm.DB,
	logger *zap.Logger,
	cache *cache.Client,
	storageService *StorageService,
	fileRoot string,
	shareAuthCfg config.ShareAuthConfig,
	emailService *EmailService,
	managerEmails ...string,
) *ShareService {
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
	service := &ShareService{
		db:                db,
		logger:            logger,
		cache:             cache,
		storageService:    storageService,
		fileRoot:          fileRoot,
		managerEmailAllow: allow,
		shareAuthCfg:      shareAuthCfg,
		shareMediaCfg:     defaultShareMediaStorageSettingsView(),
		shareSiteBrandCfg: defaultShareSiteBrandingSettingsView(),
		emailService:      emailService,
	}
	service.loadShareAuthConfigFromDB()
	service.loadShareMediaStorageSettingsFromDB()
	service.loadShareSiteBrandingSettingsFromDB()
	return service
}

func (s *ShareService) invalidateDiscoverCache(ctx context.Context) {
	if s.cache == nil {
		return
	}
	if err := s.cache.DeletePattern(ctx, "discover:*"); err != nil {
		s.logger.Warn("failed to invalidate discover cache", zap.Error(err))
	}
}

type ShareSessionUser struct {
	ID                     string    `json:"id"`
	Email                  string    `json:"email"`
	Username               string    `json:"username"`
	Nickname               string    `json:"nickname"`
	Avatar                 string    `json:"avatar"`
	Bio                    string    `json:"bio"`
	CoverImage             string    `json:"coverImage"`
	Phone                  string    `json:"phone"`
	Role                   string    `json:"role"`
	IsConfiguredSuperAdmin bool      `json:"isConfiguredSuperAdmin"`
	ForcePasswordChange    bool      `json:"forcePasswordChange"`
	CreatedAt              time.Time `json:"createdAt"`
}

type ShareRegistrationResult struct {
	User                 *ShareSessionUser `json:"user,omitempty"`
	VerificationRequired bool              `json:"verificationRequired"`
	Email                string            `json:"email,omitempty"`
	ExpiresInSeconds     int               `json:"expiresIn,omitempty"`
}

type SharePasswordResetRequestResult struct {
	Email                string `json:"email"`
	VerificationRequired bool   `json:"verificationRequired"`
	ExpiresInSeconds     int    `json:"expiresIn"`
}

type SharePasswordResetVerifyResult struct {
	Email                string `json:"email"`
	VerificationRequired bool   `json:"verificationRequired"`
	ExpiresInSeconds     int    `json:"expiresIn"`
}

type ShareAuthConfigView struct {
	EmailVerificationEnabled   bool `json:"emailVerificationEnabled"`
	VerificationCodeTTLSeconds int  `json:"verificationCodeTTLSeconds"`
	ResendIntervalSeconds      int  `json:"resendIntervalSeconds"`
}

type ShareAuthSettingsView struct {
	EmailVerificationEnabled   bool `json:"emailVerificationEnabled"`
	VerificationCodeTTLSeconds int  `json:"verificationCodeTTLSeconds"`
	ResendIntervalSeconds      int  `json:"resendIntervalSeconds"`
	MaxVerifyAttempts          int  `json:"maxVerifyAttempts"`
	CanUpdate                  bool `json:"canUpdate"`
}

type ShareMediaStorageSettingsView struct {
	StorageMode          string `json:"storageMode"`
	LocalFallbackEnabled bool   `json:"localFallbackEnabled"`
	CoverNamespaceID     string `json:"coverNamespaceID"`
	AssetNamespaceID     string `json:"assetNamespaceID"`
	CanUpdate            bool   `json:"canUpdate"`
}

type ShareSiteBrandingSettingsView struct {
	SiteName             string `json:"siteName"`
	SiteShortName        string `json:"siteShortName"`
	SiteDescription      string `json:"siteDescription"`
	SiteSubtitle         string `json:"siteSubtitle"`
	ShowSiteSubtitle     bool   `json:"showSiteSubtitle"`
	AuthSubtitle         string `json:"authSubtitle"`
	ShowAuthSubtitle     bool   `json:"showAuthSubtitle"`
	LogoText             string `json:"logoText"`
	LogoBadgeText        string `json:"logoBadgeText"`
	LogoImageSrc         string `json:"logoImageSrc"`
	LogoOriginalFileName string `json:"logoOriginalFileName"`
	LogoMimeType         string `json:"logoMimeType"`
	FooterText           string `json:"footerText"`
	DefaultDisplayName   string `json:"defaultDisplayName"`
	DefaultCreatorName   string `json:"defaultCreatorName"`
	DefaultCreatorHandle string `json:"defaultCreatorHandle"`
	DefaultInitials      string `json:"defaultInitials"`
	CreatorTagline       string `json:"creatorTagline"`
	CanUpdate            bool   `json:"canUpdate"`
}

type ShareMediaStorageMigrationSummary struct {
	CoversPending int64 `json:"coversPending"`
	AssetsPending int64 `json:"assetsPending"`
	TotalPending  int64 `json:"totalPending"`
	CoversMissing int64 `json:"coversMissing"`
	AssetsMissing int64 `json:"assetsMissing"`
	TotalMissing  int64 `json:"totalMissing"`
}

type ShareMediaStorageMigrationPlanView struct {
	StorageMode          string                            `json:"storageMode"`
	LocalFallbackEnabled bool                              `json:"localFallbackEnabled"`
	CoverNamespaceID     string                            `json:"coverNamespaceID"`
	AssetNamespaceID     string                            `json:"assetNamespaceID"`
	CanMigrate           bool                              `json:"canMigrate"`
	Summary              ShareMediaStorageMigrationSummary `json:"summary"`
}

type ShareMediaStorageMigrationRunInput struct {
	OperatorID     string
	BatchSize      int
	DeleteLocal    bool
	IncludeMissing bool
}

type ShareMediaStorageMigrationRunResult struct {
	Processed   int                               `json:"processed"`
	Succeeded   int                               `json:"succeeded"`
	Skipped     int                               `json:"skipped"`
	Failed      int                               `json:"failed"`
	DeleteLocal bool                              `json:"deleteLocal"`
	HasMore     bool                              `json:"hasMore"`
	Messages    []string                          `json:"messages"`
	Summary     ShareMediaStorageMigrationSummary `json:"summary"`
}

type ShareUpdateMediaStorageSettingsInput struct {
	OperatorID           string
	StorageMode          string
	LocalFallbackEnabled bool
	CoverNamespaceID     string
	AssetNamespaceID     string
}

type ShareUpdateAuthSettingsInput struct {
	OperatorID                 string
	EmailVerificationEnabled   bool
	VerificationCodeTTLSeconds int
	ResendIntervalSeconds      int
	MaxVerifyAttempts          int
}

type ShareUpdateSiteBrandingSettingsInput struct {
	OperatorID           string
	SiteName             string
	SiteShortName        string
	SiteDescription      string
	SiteSubtitle         string
	ShowSiteSubtitle     bool
	AuthSubtitle         string
	ShowAuthSubtitle     bool
	LogoText             string
	LogoBadgeText        string
	LogoImageSrc         string
	LogoOriginalFileName string
	LogoMimeType         string
	FooterText           string
	DefaultDisplayName   string
	DefaultCreatorName   string
	DefaultCreatorHandle string
	DefaultInitials      string
	CreatorTagline       string
}

type ShareUploadSiteBrandingLogoInput struct {
	OperatorID  string
	FileName    string
	MimeType    string
	FileReader  io.Reader
	MaxFileSize int64
}

type ShareEmailHealthView struct {
	Enabled                  bool   `json:"enabled"`
	EmailVerificationEnabled bool   `json:"emailVerificationEnabled"`
	FromAddress              string `json:"fromAddress"`
	SMTPHost                 string `json:"smtpHost"`
	SMTPPort                 int    `json:"smtpPort"`
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
	ID               string     `json:"id"`
	CreatorID        string     `json:"creatorId"`
	Title            string     `json:"title"`
	Description      string     `json:"description"`
	Tags             []string   `json:"tags"`
	Visibility       string     `json:"visibility"`
	Status           string     `json:"status"`
	AccessMode       string     `json:"accessMode"`
	ReviewStatus     string     `json:"reviewStatus"`
	ReviewReason     string     `json:"reviewReason"`
	SubmittedAt      *time.Time `json:"submittedAt,omitempty"`
	ReviewedAt       *time.Time `json:"reviewedAt,omitempty"`
	OriginalFileName string     `json:"originalFileName"`
	MimeType         string     `json:"mimeType"`
	Size             int64      `json:"size"`
	PreviewUrl       string     `json:"previewUrl"`
	DownloadUrl      string     `json:"downloadUrl"`
	Categories       []string   `json:"categories"`
	CreatedAt        time.Time  `json:"createdAt"`
	UpdatedAt        time.Time  `json:"updatedAt"`
}

type ShareCardStats struct {
	DownloadCount    int64      `json:"downloadCount"`
	LastDownloadedAt *time.Time `json:"lastDownloadedAt"`
	FavoriteCount    int64      `json:"favoriteCount"`
}

type SharePublicUser struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Nickname string `json:"nickname"`
	Avatar   string `json:"avatar"`
}

type ShareDiscoverCardItem struct {
	Card        ShareCardView   `json:"card"`
	Creator     SharePublicUser `json:"creator"`
	Stats       ShareCardStats  `json:"stats"`
	IsFavorited bool            `json:"isFavorited"`
}

type ShareCardDetail struct {
	Card             ShareCardView              `json:"card"`
	Creator          SharePublicUser            `json:"creator"`
	Stats            ShareCardStats             `json:"stats"`
	Assets           []ShareCardAssetView       `json:"assets"`
	SystemTheme      *ShareSystemThemeView      `json:"systemTheme,omitempty"`
	WechatTheme      *ShareWechatThemeView      `json:"wechatTheme,omitempty"`
	DesktopComponent *ShareDesktopComponentView `json:"desktopComponent,omitempty"`
	WorldBook        *ShareWorldBookView        `json:"worldBook,omitempty"`
	CanEdit          bool                       `json:"canEdit"`
	CanDownload      bool                       `json:"canDownload"`
	AccessCodeStatus ShareCardAccessStatus      `json:"accessCodeStatus"`
	IsFavorited      bool                       `json:"isFavorited"`
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
	CreatorID     string
	Title         string
	Description   string
	Tags          []string
	Visibility    string
	Status        string
	AccessMode    string
	FileName      string
	MimeType      string
	FileReader    io.Reader
	CoverFileName string
	CoverMimeType string
	CoverReader   io.Reader
	MaxFileSize   int64
}

type ShareCreateCardAssetInput struct {
	Slot       string
	FileName   string
	MimeType   string
	FileReader io.Reader
}

type ShareCreateCardBundleInput struct {
	CreatorID     string
	Title         string
	Description   string
	Tags          []string
	Visibility    string
	Status        string
	AccessMode    string
	Assets        []ShareCreateCardAssetInput
	CoverFileName string
	CoverMimeType string
	CoverReader   io.Reader
	MaxFileSize   int64
}

// 客户端直传卡片 bundle 相关类型

type SharePrepareCardBundleAssetInput struct {
	Slot        string
	ContentType string
	Size        int64
}

type SharePrepareCardBundleUploadInput struct {
	CreatorID        string
	Title            string
	Description      string
	Tags             []string
	Visibility       string
	Status           string
	AccessMode       string
	Assets           []SharePrepareCardBundleAssetInput
	CoverContentType string
	CoverSize        int64
}

type SharePresignedUploadEntry struct {
	URL         string `json:"url"`
	ObjectKey   string `json:"object_key"`
	VersionID   string `json:"version_id"`
	StorageKey  string `json:"storage_key"`
	NamespaceID string `json:"namespace_id"`
	ContentType string `json:"content_type"`
}

type SharePreparedCardBundleAsset struct {
	Slot string `json:"slot"`
	SharePresignedUploadEntry
}

type SharePreparedCardBundleUpload struct {
	CardID string                         `json:"card_id"`
	Cover  *SharePresignedUploadEntry     `json:"cover,omitempty"`
	Assets []SharePreparedCardBundleAsset `json:"assets"`
}

type ShareUploadedMediaInfo struct {
	ObjectKey   string `json:"object_key"`
	VersionID   string `json:"version_id"`
	ETag        string `json:"etag"`
	Size        int64  `json:"size"`
	FileName    string `json:"file_name"`
	MimeType    string `json:"mime_type"`
	NamespaceID string `json:"namespace_id"`
}

type ShareUploadedAssetInfo struct {
	Slot string `json:"slot"`
	ShareUploadedMediaInfo
}

type ShareCreateCardBundleFromPresignedInput struct {
	CreatorID   string
	CardID      string
	Title       string
	Description string
	Tags        []string
	Visibility  string
	Status      string
	AccessMode  string
	Assets      []ShareUploadedAssetInfo
	Cover       *ShareUploadedMediaInfo
	MaxFileSize int64
}

type ShareUpdateCardCoverFromPresignedInput struct {
	OwnerID     string
	CardID      string
	Cover       *ShareUploadedMediaInfo
	MaxFileSize int64
}

type ShareUpdateCardAssetFromPresignedInput struct {
	OwnerID     string
	CardID      string
	Slot        string
	Asset       *ShareUploadedMediaInfo
	MaxFileSize int64
}

type ShareUpdateCardMediaPresignInput struct {
	OwnerID     string
	CardID      string
	Slot        string // empty for cover
	ContentType string
	Size        int64
}

type ShareUpdateCardMediaPresignResult struct {
	CardID      string `json:"card_id"`
	NamespaceID string `json:"namespace_id"`
	URL         string `json:"url"`
	ObjectKey   string `json:"object_key"`
	VersionID   string `json:"version_id"`
	StorageKey  string `json:"storage_key"`
}

type ShareUpdateCardInput struct {
	OwnerID     string
	CardID      string
	Title       string
	Description string
	Tags        []string
	Visibility  string
	Status      string
	AccessMode  string
}

type ShareReviewDashboardItem struct {
	Card        ShareCardView   `json:"card"`
	Creator     SharePublicUser `json:"creator"`
	SubmittedAt *time.Time      `json:"submittedAt,omitempty"`
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
	ID                  string    `json:"id"`
	Email               string    `json:"email"`
	Username            string    `json:"username"`
	Nickname            string    `json:"nickname"`
	Role                string    `json:"role"`
	Status              string    `json:"status"`
	ForcePasswordChange bool      `json:"forcePasswordChange"`
	CreatedAt           time.Time `json:"createdAt"`
}

type ShareListUsersForRoleManageInput struct {
	OperatorID string
	Page       int
	PageSize   int
	Keyword    string
	Role       string
}

type ShareUpdateUserRoleInput struct {
	OperatorID string
	UserID     string
	Role       string
}

type ShareDeleteUserInput struct {
	OperatorID string
	UserID     string
}

type ShareAdminResetUserPasswordInput struct {
	OperatorID string
	UserID     string
}

type ShareAdminResetUserPasswordResult struct {
	NewPassword string `json:"newPassword"`
}

type ShareSelfDeleteInput struct {
	UserID      string
	OldPassword string
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
	AccessMode string
	Visibility string
	Status     string
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

func (s *ShareService) mapDiscoverCards(
	ctx context.Context,
	cards []model.SharePlatformCard,
	assetsByCardID map[string][]model.SharePlatformCardAsset,
	viewerUserID string,
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

	favoriteCounts, err := s.CountFavorites(ctx, cardIDs)
	if err != nil {
		return nil, err
	}
	favoritedMap, err := s.BatchIsFavorited(ctx, viewerUserID, cardIDs)
	if err != nil {
		return nil, err
	}

	statsByCard, _ := aggregateStatsFromCards(cards, favoriteCounts)

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
			Card:        toShareCardView(&card, assetsByCardID[card.ID]),
			Creator:     creatorView,
			Stats:       statsByCard[card.ID],
			IsFavorited: favoritedMap[card.ID],
		})
	}

	return items, nil
}

func aggregateStatsFromCards(cards []model.SharePlatformCard, favoriteCounts map[string]int64) (map[string]ShareCardStats, int64) {
	stats := make(map[string]ShareCardStats, len(cards))
	totalDownloads := int64(0)
	for _, card := range cards {
		stats[card.ID] = ShareCardStats{
			DownloadCount:    card.DownloadCount,
			LastDownloadedAt: card.LastDownloadedAt,
			FavoriteCount:    favoriteCounts[card.ID],
		}
		totalDownloads += card.DownloadCount
	}
	return stats, totalDownloads
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
	return "新用户"
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

func normalizeShareCardAccessMode(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	if value == model.SharePlatformCardAccessModePaid {
		return model.SharePlatformCardAccessModePaid
	}
	return model.SharePlatformCardAccessModeFree
}

func isValidShareCardAccessMode(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "", model.SharePlatformCardAccessModeFree, model.SharePlatformCardAccessModePaid:
		return true
	default:
		return false
	}
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
	case "desktop_component":
		return 5
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
	if normalizeShareCardAccessMode(card.AccessMode) == model.SharePlatformCardAccessModeFree {
		return ShareCardAccessCodeConfig{
			CardID:     card.ID,
			Code:       "",
			ExpiresAt:  nil,
			ExpireDays: 0,
			UsageLimit: 0,
			UsageCount: 0,
			Unlimited:  true,
			IsActive:   false,
			IsExpired:  false,
		}
	}

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
	if normalizeShareCardAccessMode(card.AccessMode) == model.SharePlatformCardAccessModeFree {
		return ShareCardAccessStatusNone
	}

	if strings.TrimSpace(card.AccessCode) == "" {
		return ShareCardAccessStatusRequired
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
		ID:                     user.ID,
		Email:                  user.Email,
		Username:               user.Username,
		Nickname:               user.NormalizedDisplayName(),
		Avatar:                 user.Avatar,
		Bio:                    strings.TrimSpace(user.Bio),
		CoverImage:             strings.TrimSpace(user.CoverImage),
		Phone:                  strings.TrimSpace(user.Phone),
		Role:                   normalizeShareExternalUserRole(user.Role),
		IsConfiguredSuperAdmin: false,
		ForcePasswordChange:    user.ForcePasswordChange,
		CreatedAt:              user.CreatedAt,
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
	hasCover := hasShareStoredMedia(card.StorageBackend, card.StorageNamespaceID, card.StorageObjectKey, card.StoredFileName)
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
		Tags:             decodeShareCardTags(card.TagsText),
		Visibility:       card.Visibility,
		Status:           card.Status,
		AccessMode:       normalizeShareCardAccessMode(card.AccessMode),
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

func normalizeShareCardTags(tags []string) []string {
	if len(tags) == 0 {
		return []string{}
	}
	seen := make(map[string]struct{}, len(tags))
	result := make([]string, 0, len(tags))
	for _, raw := range tags {
		tag := strings.TrimSpace(raw)
		if tag == "" {
			continue
		}
		tag = strings.Join(strings.Fields(tag), " ")
		if tag == "" {
			continue
		}
		if len(tag) > 32 {
			tag = strings.TrimSpace(tag[:32])
		}
		key := strings.ToLower(tag)
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		result = append(result, tag)
		if len(result) >= 12 {
			break
		}
	}
	if len(result) == 0 {
		return []string{}
	}
	return result
}

func encodeShareCardTags(tags []string) string {
	normalized := normalizeShareCardTags(tags)
	if len(normalized) == 0 {
		return ""
	}
	return strings.Join(normalized, "\n")
}

func decodeShareCardTags(raw string) []string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return []string{}
	}
	parts := strings.FieldsFunc(trimmed, func(r rune) bool {
		return r == '\n' || r == '\r' || r == ',' || r == '，' || r == ';' || r == '；'
	})
	return normalizeShareCardTags(parts)
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
