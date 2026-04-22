package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/baobaobai/baobaobaivault/internal/model"
	"github.com/golang-jwt/jwt/v5"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// UserService handles user and login flow.
type UserService struct {
	db        *gorm.DB
	logger    *zap.Logger
	jwtSecret string
}

var errUserNotFound = errors.New("user not found")

func NewUserService(db *gorm.DB, logger *zap.Logger, jwtSecret string) *UserService {
	return &UserService{db: db, logger: logger, jwtSecret: jwtSecret}
}

func (s *UserService) CreateUser(ctx context.Context, tenantID string, req *CreateUserRequest) (*model.User, error) {
	email := normalizeEmail(req.Email)
	if email == "" {
		return nil, errors.New("email is required")
	}

	username, err := s.resolveUsername(ctx, tenantID, req.Username, email)
	if err != nil {
		return nil, err
	}

	var count int64
	if err := s.db.WithContext(ctx).Model(&model.User{}).
		Where("tenant_id = ? AND lower(email) = ?", tenantID, email).
		Count(&count).Error; err != nil {
		return nil, fmt.Errorf("failed to check email: %w", err)
	}
	if count > 0 {
		return nil, errors.New("email already exists")
	}

	user := &model.User{
		TenantID: tenantID,
		Username: username,
		Email:    email,
		Nickname: req.Nickname,
		Status:   model.UserStatusActive,
	}

	if err := user.SetPassword(req.Password); err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	if err := s.db.WithContext(ctx).Create(user).Error; err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	if len(req.RoleIDs) > 0 {
		if err := s.assignRoles(ctx, user, req.RoleIDs); err != nil {
			return nil, err
		}
	}

	s.logger.Info("User created",
		zap.String("user_id", user.ID),
		zap.String("tenant_id", tenantID),
		zap.String("username", user.Username),
		zap.String("email", user.Email),
	)
	return user, nil
}

func (s *UserService) GetUser(ctx context.Context, userID string) (*model.User, error) {
	var user model.User
	if err := s.db.WithContext(ctx).Preload("Roles.Permissions").First(&user, "id = ?", userID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errUserNotFound
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}
	return &user, nil
}

func (s *UserService) GetUserByUsername(ctx context.Context, tenantID, username string) (*model.User, error) {
	var user model.User
	if err := s.db.WithContext(ctx).Preload("Roles.Permissions").
		First(&user, "tenant_id = ? AND username = ?", tenantID, username).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errUserNotFound
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}
	return &user, nil
}

func (s *UserService) GetUserByEmail(ctx context.Context, tenantID, email string) (*model.User, error) {
	email = normalizeEmail(email)
	var user model.User
	if err := s.db.WithContext(ctx).Preload("Roles.Permissions").
		First(&user, "tenant_id = ? AND lower(email) = ?", tenantID, email).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errUserNotFound
		}
		return nil, fmt.Errorf("failed to get user by email: %w", err)
	}
	return &user, nil
}

func (s *UserService) ListUsers(ctx context.Context, tenantID string, req *ListUserRequest) ([]*model.User, int64, error) {
	if req == nil {
		req = &ListUserRequest{}
	}
	if req.Page <= 0 {
		req.Page = 1
	}
	if req.PageSize <= 0 || req.PageSize > 100 {
		req.PageSize = 20
	}

	var users []*model.User
	var total int64

	query := s.db.WithContext(ctx).Model(&model.User{}).Where("tenant_id = ?", tenantID)
	if req.Status != "" {
		query = query.Where("status = ?", req.Status)
	}
	if req.Keyword != "" {
		like := "%" + req.Keyword + "%"
		query = query.Where("username LIKE ? OR email LIKE ? OR nickname LIKE ?", like, like, like)
	}
	if len(req.VisibleNamespaceIDs) > 0 {
		query = query.Where(
			`EXISTS (
				SELECT 1
				FROM user_roles ur
				JOIN roles r ON r.id = ur.role_id
				LEFT JOIN role_namespaces rn ON rn.role_id = r.id
				WHERE ur.user_id = users.id
				  AND (rn.namespace_id IN ? OR rn.role_id IS NULL)
			) OR users.id = ?`,
			req.VisibleNamespaceIDs,
			req.CurrentUserID,
		)
	} else if req.CurrentUserID != "" && req.ScopeFiltered {
		query = query.Where("users.id = ?", req.CurrentUserID)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count users: %w", err)
	}

	offset := (req.Page - 1) * req.PageSize
	if err := query.Preload("Roles").Offset(offset).Limit(req.PageSize).Find(&users).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list users: %w", err)
	}

	return users, total, nil
}

func (s *UserService) UpdateUser(ctx context.Context, userID string, req *UpdateUserRequest) (*model.User, error) {
	user, err := s.GetUser(ctx, userID)
	if err != nil {
		return nil, err
	}

	updates := map[string]interface{}{}
	if req.Nickname != "" {
		updates["nickname"] = req.Nickname
	}
	if req.Avatar != "" {
		updates["avatar"] = req.Avatar
	}
	if req.Status != "" {
		updates["status"] = req.Status
	}

	if len(updates) > 0 {
		if err := s.db.WithContext(ctx).Model(user).Updates(updates).Error; err != nil {
			return nil, fmt.Errorf("failed to update user: %w", err)
		}
	}

	if len(req.RoleIDs) > 0 {
		if err := s.assignRoles(ctx, user, req.RoleIDs); err != nil {
			return nil, err
		}
	}

	return s.GetUser(ctx, userID)
}

func (s *UserService) DeleteUser(ctx context.Context, userID string) error {
	result := s.db.WithContext(ctx).Delete(&model.User{}, "id = ?", userID)
	if result.Error != nil {
		return fmt.Errorf("failed to delete user: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return errors.New("user not found")
	}

	s.logger.Info("User deleted", zap.String("user_id", userID))
	return nil
}

func (s *UserService) ChangePassword(ctx context.Context, userID, oldPassword, newPassword string) error {
	user, err := s.GetUser(ctx, userID)
	if err != nil {
		return err
	}
	if !user.CheckPassword(oldPassword) {
		return errors.New("invalid old password")
	}
	if err := user.SetPassword(newPassword); err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}
	if err := s.db.WithContext(ctx).Model(user).Update("password", user.Password).Error; err != nil {
		return fmt.Errorf("failed to update password: %w", err)
	}

	s.logger.Info("Password changed", zap.String("user_id", userID))
	return nil
}

func (s *UserService) Login(ctx context.Context, tenantCode, email, password string) (*LoginResponse, error) {
	tenantCode = strings.TrimSpace(tenantCode)
	email = normalizeEmail(email)
	if email == "" {
		return nil, errors.New("email is required")
	}

	var tenant model.Tenant
	if err := s.db.WithContext(ctx).First(&tenant, "code = ?", tenantCode).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("tenant not found")
		}
		return nil, fmt.Errorf("failed to get tenant: %w", err)
	}
	if tenant.Status != model.TenantStatusActive {
		return nil, errors.New("tenant is not active")
	}

	user, err := s.GetUserByEmail(ctx, tenant.ID, email)
	if err != nil || !user.CheckPassword(password) {
		return nil, errors.New("invalid email or password")
	}
	if user.Status != model.UserStatusActive {
		return nil, errors.New("user is not active")
	}

	token, err := s.generateToken(user)
	if err != nil {
		return nil, fmt.Errorf("failed to generate token: %w", err)
	}

	now := time.Now()
	_ = s.db.WithContext(ctx).Model(user).Update("last_login_at", now).Error

	s.logger.Info("User logged in",
		zap.String("user_id", user.ID),
		zap.String("tenant_id", user.TenantID),
		zap.String("username", user.Username),
		zap.String("email", user.Email),
	)

	return &LoginResponse{
		Token:     token,
		ExpiresAt: now.Add(24 * time.Hour),
		User:      user,
		Tenant:    &tenant,
	}, nil
}

func (s *UserService) LoginWithEmail(ctx context.Context, tenantCode, email, password string) (*LoginFlowResponse, error) {
	tenantCode = strings.TrimSpace(tenantCode)
	email = normalizeEmail(email)
	if email == "" {
		return nil, errors.New("email is required")
	}
	if strings.TrimSpace(password) == "" {
		return nil, errors.New("password is required")
	}

	if tenantCode != "" {
		auth, err := s.Login(ctx, tenantCode, email, password)
		if err != nil {
			return nil, err
		}
		return &LoginFlowResponse{Auth: auth}, nil
	}

	options, err := s.findTenantLoginOptions(ctx, email, password)
	if err != nil {
		return nil, err
	}
	if len(options) == 0 {
		return nil, errors.New("invalid email or password")
	}
	if len(options) == 1 {
		auth, err := s.Login(ctx, options[0].TenantCode, email, password)
		if err != nil {
			return nil, err
		}
		return &LoginFlowResponse{Auth: auth}, nil
	}

	return &LoginFlowResponse{
		RequiresTenantSelection: true,
		TenantOptions:           options,
	}, nil
}

func (s *UserService) findTenantLoginOptions(ctx context.Context, email, password string) ([]TenantLoginOption, error) {
	type loginCandidate struct {
		UserID       string
		Username     string
		UserStatus   model.UserStatus
		PasswordHash string
		TenantID     string
		TenantCode   string
		TenantName   string
		TenantStatus model.TenantStatus
	}

	candidates := make([]loginCandidate, 0, 8)
	err := s.db.WithContext(ctx).
		Table("users").
		Select(
			"users.id AS user_id, users.username, users.status AS user_status, users.password AS password_hash, "+
				"tenants.id AS tenant_id, tenants.code AS tenant_code, tenants.name AS tenant_name, tenants.status AS tenant_status",
		).
		Joins("JOIN tenants ON tenants.id = users.tenant_id").
		Where("lower(users.email) = ?", email).
		Where("users.deleted_at IS NULL").
		Where("tenants.deleted_at IS NULL").
		Order("tenants.code ASC").
		Scan(&candidates).Error
	if err != nil {
		return nil, fmt.Errorf("failed to find tenant candidates: %w", err)
	}

	options := make([]TenantLoginOption, 0, len(candidates))
	seenTenant := make(map[string]struct{}, len(candidates))
	for _, candidate := range candidates {
		if candidate.UserStatus != model.UserStatusActive || candidate.TenantStatus != model.TenantStatusActive {
			continue
		}

		user := &model.User{Password: candidate.PasswordHash}
		if !user.CheckPassword(password) {
			continue
		}

		if _, exists := seenTenant[candidate.TenantCode]; exists {
			continue
		}
		seenTenant[candidate.TenantCode] = struct{}{}

		options = append(options, TenantLoginOption{
			TenantID:   candidate.TenantID,
			TenantCode: candidate.TenantCode,
			TenantName: candidate.TenantName,
			UserID:     candidate.UserID,
			Username:   candidate.Username,
		})
	}

	return options, nil
}

func (s *UserService) generateToken(user *model.User) (string, error) {
	now := time.Now()
	claims := jwt.MapClaims{
		"user_id":   user.ID,
		"tenant_id": user.TenantID,
		"username":  user.Username,
		"email":     user.Email,
		"exp":       now.Add(24 * time.Hour).Unix(),
		"iat":       now.Unix(),
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(s.jwtSecret))
}

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func sanitizeUsername(raw string) string {
	raw = strings.ToLower(strings.TrimSpace(raw))
	if raw == "" {
		return ""
	}
	var builder strings.Builder
	builder.Grow(len(raw))
	lastSpecial := false
	for _, ch := range raw {
		switch {
		case ch >= 'a' && ch <= 'z':
			builder.WriteRune(ch)
			lastSpecial = false
		case ch >= '0' && ch <= '9':
			builder.WriteRune(ch)
			lastSpecial = false
		case ch == '-' || ch == '_' || ch == '.':
			if builder.Len() > 0 && !lastSpecial {
				builder.WriteRune(ch)
				lastSpecial = true
			}
		default:
			if builder.Len() > 0 && !lastSpecial {
				builder.WriteRune('_')
				lastSpecial = true
			}
		}
	}
	cleaned := strings.Trim(builder.String(), "._-")
	if len(cleaned) > 50 {
		cleaned = strings.Trim(cleaned[:50], "._-")
	}
	return cleaned
}

func usernameBaseFromEmail(email string) string {
	idx := strings.Index(email, "@")
	if idx <= 0 {
		return email
	}
	return email[:idx]
}

func (s *UserService) usernameExists(ctx context.Context, tenantID, username string) (bool, error) {
	var count int64
	if err := s.db.WithContext(ctx).Model(&model.User{}).
		Where("tenant_id = ? AND username = ?", tenantID, username).
		Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

func (s *UserService) resolveUsername(ctx context.Context, tenantID, requested, email string) (string, error) {
	requested = strings.TrimSpace(requested)
	if requested != "" {
		exists, err := s.usernameExists(ctx, tenantID, requested)
		if err != nil {
			return "", fmt.Errorf("failed to check username: %w", err)
		}
		if exists {
			return "", errors.New("username already exists")
		}
		return requested, nil
	}

	base := sanitizeUsername(usernameBaseFromEmail(email))
	if base == "" {
		base = "user"
	}
	if len(base) > 50 {
		base = base[:50]
	}

	for i := 0; i < 1000; i++ {
		candidate := base
		if i > 0 {
			suffix := fmt.Sprintf("_%d", i+1)
			maxBaseLen := 50 - len(suffix)
			if maxBaseLen < 1 {
				maxBaseLen = 1
			}
			candidateBase := base
			if len(candidateBase) > maxBaseLen {
				candidateBase = strings.Trim(candidateBase[:maxBaseLen], "._-")
				if candidateBase == "" {
					candidateBase = "user"
				}
			}
			candidate = candidateBase + suffix
		}

		exists, err := s.usernameExists(ctx, tenantID, candidate)
		if err != nil {
			return "", fmt.Errorf("failed to check username: %w", err)
		}
		if !exists {
			return candidate, nil
		}
	}

	return "", errors.New("failed to allocate username")
}

func (s *UserService) ValidateToken(tokenString string) (*jwt.MapClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &jwt.MapClaims{}, func(token *jwt.Token) (interface{}, error) {
		if token.Method != jwt.SigningMethodHS256 {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(s.jwtSecret), nil
	})
	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*jwt.MapClaims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token")
	}
	return claims, nil
}

func (s *UserService) assignRoles(ctx context.Context, user *model.User, roleIDs []string) error {
	unique := make(map[string]struct{}, len(roleIDs))
	cleaned := make([]string, 0, len(roleIDs))
	for _, id := range roleIDs {
		id = strings.TrimSpace(id)
		if id == "" {
			continue
		}
		if _, exists := unique[id]; exists {
			continue
		}
		unique[id] = struct{}{}
		cleaned = append(cleaned, id)
	}
	if len(cleaned) == 0 {
		return s.db.WithContext(ctx).Model(user).Association("Roles").Clear()
	}

	var roles []model.Role
	if err := s.db.WithContext(ctx).
		Where("id IN ?", cleaned).
		Where("tenant_id = ? OR tenant_id IS NULL", user.TenantID).
		Find(&roles).Error; err != nil {
		return fmt.Errorf("failed to find roles: %w", err)
	}
	if len(roles) != len(cleaned) {
		return errors.New("contains invalid role_ids")
	}
	if err := s.db.WithContext(ctx).Model(user).Association("Roles").Replace(roles); err != nil {
		return fmt.Errorf("failed to assign roles: %w", err)
	}
	return nil
}

type CreateUserRequest struct {
	Username string   `json:"username"`
	Email    string   `json:"email" binding:"required,email"`
	Password string   `json:"password" binding:"required,min=6"`
	Nickname string   `json:"nickname"`
	RoleIDs  []string `json:"role_ids"`
}

type UpdateUserRequest struct {
	Nickname string   `json:"nickname"`
	Avatar   string   `json:"avatar"`
	Status   string   `json:"status"`
	RoleIDs  []string `json:"role_ids"`
}

type ListUserRequest struct {
	Page                int      `form:"page"`
	PageSize            int      `form:"page_size"`
	Status              string   `form:"status"`
	Keyword             string   `form:"keyword"`
	VisibleNamespaceIDs []string `json:"-"`
	CurrentUserID       string   `json:"-"`
	ScopeFiltered       bool     `json:"-"`
}

type LoginRequest struct {
	TenantCode string `json:"tenant_code"`
	Email      string `json:"email" binding:"required,email"`
	Password   string `json:"password" binding:"required"`
}

type TenantLoginOption struct {
	TenantID   string `json:"tenant_id"`
	TenantCode string `json:"tenant_code"`
	TenantName string `json:"tenant_name"`
	UserID     string `json:"user_id"`
	Username   string `json:"username"`
}

type LoginFlowResponse struct {
	RequiresTenantSelection bool                `json:"requires_tenant_selection"`
	TenantOptions           []TenantLoginOption `json:"tenant_options,omitempty"`
	Auth                    *LoginResponse      `json:"auth,omitempty"`
}

type LoginResponse struct {
	Token     string        `json:"token"`
	ExpiresAt time.Time     `json:"expires_at"`
	User      *model.User   `json:"user"`
	Tenant    *model.Tenant `json:"tenant"`
}

type ChangePasswordRequest struct {
	OldPassword string `json:"old_password" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=6"`
}
