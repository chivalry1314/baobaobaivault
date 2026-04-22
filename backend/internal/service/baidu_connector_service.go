package service

import (
	"bytes"
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/md5"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"path"
	"strconv"
	"strings"
	"time"

	"github.com/baobaobai/baobaobaivault/internal/config"
	"github.com/baobaobai/baobaobaivault/internal/model"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

const (
	baiduStateTTL         = 15 * time.Minute
	baiduProviderID       = model.CloudProviderBaiduPan
	baiduUploadChunkSize  = 4 * 1024 * 1024 // latest Pan upload doc uses 4MB slice size
	baiduDisconnectNotice = "断开操作仅清理本系统内的百度网盘绑定。若需彻底撤销授权，请到百度授权管理中移除该应用。"
)

type BaiduConnectorService struct {
	db             *gorm.DB
	logger         *zap.Logger
	cfg            config.BaiduConfig
	httpClient     *http.Client
	stateSecret    []byte
	tokenEncrypt32 [32]byte
	panAPIBaseURL  string
	panUploadURL   string
}

type BaiduAccountStatus struct {
	Connected        bool       `json:"connected"`
	Provider         string     `json:"provider"`
	DisplayName      string     `json:"display_name"`
	ExternalUserID   string     `json:"external_user_id"`
	Scope            string     `json:"scope"`
	ExpiresAt        *time.Time `json:"expires_at,omitempty"`
	DefaultDir       string     `json:"default_dir"`
	AutoBackupReady  bool       `json:"auto_backup_ready"`
	DisconnectNotice string     `json:"disconnect_notice"`
}

type BaiduBackupObject struct {
	Path  string `json:"path"`
	Name  string `json:"name"`
	Size  int64  `json:"size"`
	IsDir int    `json:"is_dir"`
	MD5   string `json:"md5"`
	Ctime int64  `json:"ctime"`
	Mtime int64  `json:"mtime"`
}

type baiduOAuthState struct {
	TenantID string `json:"tenant_id"`
	UserID   string `json:"user_id"`
	ReturnTo string `json:"return_to,omitempty"`
	Exp      int64  `json:"exp"`
	Nonce    string `json:"nonce"`
}

type baiduTokenResponse struct {
	AccessToken   string `json:"access_token"`
	RefreshToken  string `json:"refresh_token"`
	ExpiresIn     int64  `json:"expires_in"`
	Scope         string `json:"scope"`
	OpenID        string `json:"openid"`
	SessionKey    string `json:"session_key"`
	SessionSecret string `json:"session_secret"`
}

type baiduTokenErrorResponse struct {
	Error            string `json:"error"`
	ErrorDescription string `json:"error_description"`
}

type baiduPrecreateResponse struct {
	Errno      int    `json:"errno"`
	Path       string `json:"path"`
	UploadID   string `json:"uploadid"`
	BlockList  []any  `json:"block_list"`
	ReturnType int    `json:"return_type"`
}

type baiduUploadBlockResponse struct {
	MD5 string `json:"md5"`
}

type baiduCreateResponse struct {
	Errno int    `json:"errno"`
	Path  string `json:"path"`
	Size  int64  `json:"size"`
	Ctime int64  `json:"ctime"`
	Mtime int64  `json:"mtime"`
	MD5   string `json:"md5"`
}

type baiduListResponse struct {
	Errno int `json:"errno"`
	List  []struct {
		Path           string `json:"path"`
		ServerFilename string `json:"server_filename"`
		Size           int64  `json:"size"`
		IsDir          int    `json:"isdir"`
		MD5            string `json:"md5"`
		Ctime          int64  `json:"ctime"`
		Mtime          int64  `json:"mtime"`
	} `json:"list"`
}

type baiduErrorResponse struct {
	Errno            int    `json:"errno"`
	ErrMsg           string `json:"errmsg"`
	ErrorCode        string `json:"error_code"`
	ErrorDescription string `json:"error_description"`
	RequestID        string `json:"request_id"`
}

func NewBaiduConnectorService(
	db *gorm.DB,
	logger *zap.Logger,
	cfg config.BaiduConfig,
	fallbackSecret string,
) *BaiduConnectorService {
	timeoutSeconds := cfg.HTTPTimeoutSeconds
	if timeoutSeconds <= 0 {
		timeoutSeconds = 30
	}

	stateSeed := strings.TrimSpace(cfg.StateSecret)
	if stateSeed == "" {
		stateSeed = strings.TrimSpace(fallbackSecret)
	}
	if stateSeed == "" {
		stateSeed = "baobaobaivault-baidu-state"
	}

	tokenSeed := strings.TrimSpace(cfg.TokenEncryptSecret)
	if tokenSeed == "" {
		tokenSeed = strings.TrimSpace(fallbackSecret)
	}
	if tokenSeed == "" {
		tokenSeed = "baobaobaivault-baidu-token"
	}

	return &BaiduConnectorService{
		db:             db,
		logger:         logger,
		cfg:            cfg,
		httpClient:     &http.Client{Timeout: time.Duration(timeoutSeconds) * time.Second},
		stateSecret:    []byte(stateSeed),
		tokenEncrypt32: sha256.Sum256([]byte(tokenSeed)),
		panAPIBaseURL:  strings.TrimRight(strings.TrimSpace(cfg.PanAPIBaseURL), "/"),
		panUploadURL:   strings.TrimRight(strings.TrimSpace(cfg.PanUploadURL), "/"),
	}
}

func (s *BaiduConnectorService) BuildAuthURL(tenantID, userID, returnTo string) (string, error) {
	if !s.cfg.Enabled {
		return "", errors.New("baidu connector is disabled")
	}
	if strings.TrimSpace(s.cfg.APIKey) == "" {
		return "", errors.New("baidu api_key is not configured")
	}
	if strings.TrimSpace(s.cfg.RedirectURI) == "" {
		return "", errors.New("baidu redirect_uri is not configured")
	}

	state, err := s.createSignedState(tenantID, userID, returnTo, baiduStateTTL)
	if err != nil {
		return "", err
	}

	scope := strings.TrimSpace(s.cfg.Scope)
	if scope == "" {
		scope = "basic,netdisk"
	}

	authURL := strings.TrimSpace(s.cfg.AuthURL)
	if authURL == "" {
		authURL = "https://openapi.baidu.com/oauth/2.0/authorize"
	}

	values := url.Values{}
	values.Set("response_type", "code")
	values.Set("client_id", strings.TrimSpace(s.cfg.APIKey))
	values.Set("redirect_uri", strings.TrimSpace(s.cfg.RedirectURI))
	values.Set("scope", scope)
	values.Set("state", state)
	for key, value := range s.cfg.AuthExtraParams {
		trimmedKey := strings.TrimSpace(key)
		trimmedValue := strings.TrimSpace(value)
		if trimmedKey == "" || trimmedValue == "" {
			continue
		}
		if isReservedBaiduAuthParam(strings.ToLower(trimmedKey)) {
			continue
		}
		values.Set(trimmedKey, trimmedValue)
	}

	return authURL + "?" + values.Encode(), nil
}

func (s *BaiduConnectorService) HandleOAuthCallback(ctx context.Context, code, state string) (string, string, string, error) {
	if strings.TrimSpace(code) == "" {
		return "", "", "", errors.New("missing oauth code")
	}

	statePayload, err := s.parseSignedState(state)
	if err != nil {
		return "", "", "", err
	}

	token, err := s.exchangeAuthorizationCode(ctx, code)
	if err != nil {
		return "", "", "", err
	}

	if err := s.upsertAccountToken(ctx, statePayload.TenantID, statePayload.UserID, token); err != nil {
		return "", "", "", err
	}
	return statePayload.TenantID, statePayload.UserID, statePayload.ReturnTo, nil
}

func (s *BaiduConnectorService) GetAccountStatus(ctx context.Context, tenantID, userID string) (*BaiduAccountStatus, error) {
	account, err := s.getAccount(ctx, tenantID, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return &BaiduAccountStatus{
				Connected:        false,
				Provider:         baiduProviderID,
				DefaultDir:       s.defaultPathPrefix(),
				AutoBackupReady:  false,
				DisconnectNotice: baiduDisconnectNotice,
			}, nil
		}
		return nil, err
	}

	connected := account.Status == model.CloudAccountStatusActive
	return &BaiduAccountStatus{
		Connected:        connected,
		Provider:         account.Provider,
		DisplayName:      account.DisplayName,
		ExternalUserID:   account.ExternalUserID,
		Scope:            account.Scope,
		ExpiresAt:        account.ExpiresAt,
		DefaultDir:       s.defaultPathPrefix(),
		AutoBackupReady:  connected,
		DisconnectNotice: baiduDisconnectNotice,
	}, nil
}

func (s *BaiduConnectorService) Disconnect(ctx context.Context, tenantID, userID string) error {
	updates := map[string]any{
		"status":            model.CloudAccountStatusInactive,
		"access_token_enc":  "",
		"refresh_token_enc": "",
		"expires_at":        nil,
	}
	return s.db.WithContext(ctx).
		Model(&model.CloudAccount{}).
		Where("tenant_id = ? AND user_id = ? AND provider = ?", tenantID, userID, baiduProviderID).
		Updates(updates).Error
}

func (s *BaiduConnectorService) UploadBackup(
	ctx context.Context,
	tenantID string,
	userID string,
	fileName string,
	content []byte,
	pathPrefix string,
) (*BaiduBackupObject, error) {
	if len(content) == 0 {
		return nil, errors.New("backup content is empty")
	}
	fileName = strings.TrimSpace(fileName)
	if fileName == "" {
		fileName = fmt.Sprintf("baobaobaiphone-backup-%d.json", time.Now().Unix())
	}

	accessToken, _, err := s.ensureValidAccessToken(ctx, tenantID, userID)
	if err != nil {
		return nil, err
	}

	dirPath := normalizePanPath(pathPrefix, s.defaultPathPrefix())
	objectPath := joinPanPath(dirPath, fileName)

	chunks := splitContentIntoChunks(content, baiduUploadChunkSize)
	if len(chunks) == 0 {
		return nil, errors.New("baidu upload chunks are empty")
	}

	blockMD5List := make([]string, len(chunks))
	for index, chunk := range chunks {
		digest := md5.Sum(chunk)
		blockMD5List[index] = hex.EncodeToString(digest[:])
	}
	blockListJSONBytes, err := json.Marshal(blockMD5List)
	if err != nil {
		return nil, err
	}
	blockListJSON := string(blockListJSONBytes)
	contentSize := len(content)

	precreateURL := s.panAPIBaseURL + "/xpan/file?method=precreate"
	precreateForm := url.Values{}
	precreateForm.Set("access_token", accessToken)
	precreateForm.Set("path", objectPath)
	precreateForm.Set("size", strconv.Itoa(contentSize))
	precreateForm.Set("isdir", "0")
	precreateForm.Set("autoinit", "1")
	precreateForm.Set("rtype", "3")
	precreateForm.Set("block_list", blockListJSON)

	var precreateResp baiduPrecreateResponse
	if err := s.postFormJSON(ctx, precreateURL, precreateForm, &precreateResp); err != nil {
		return nil, err
	}
	if precreateResp.Errno != 0 {
		return nil, fmt.Errorf("baidu precreate failed: errno=%d", precreateResp.Errno)
	}
	if strings.TrimSpace(precreateResp.UploadID) == "" {
		return nil, errors.New("baidu precreate did not return uploadid")
	}

	partSeqList := normalizePrecreatePartSeqList(precreateResp.BlockList, len(chunks))
	lastUploadedMD5 := ""
	for _, partSeq := range partSeqList {
		partContent := chunks[partSeq]
		query := url.Values{}
		query.Set("method", "upload")
		query.Set("access_token", accessToken)
		query.Set("type", "tmpfile")
		query.Set("path", objectPath)
		query.Set("uploadid", precreateResp.UploadID)
		query.Set("partseq", strconv.Itoa(partSeq))
		uploadURL := s.panUploadURL + "?" + query.Encode()

		var uploadResp baiduUploadBlockResponse
		if err := s.postMultipartSingleFile(ctx, uploadURL, "file", fileName, partContent, &uploadResp); err != nil {
			return nil, err
		}
		if strings.TrimSpace(uploadResp.MD5) != "" {
			lastUploadedMD5 = strings.TrimSpace(uploadResp.MD5)
		}
	}

	createURL := s.panAPIBaseURL + "/xpan/file?method=create"
	createForm := url.Values{}
	createForm.Set("access_token", accessToken)
	createForm.Set("path", objectPath)
	createForm.Set("size", strconv.Itoa(contentSize))
	createForm.Set("isdir", "0")
	createForm.Set("rtype", "3")
	createForm.Set("uploadid", precreateResp.UploadID)
	createForm.Set("block_list", blockListJSON)

	var createResp baiduCreateResponse
	if err := s.postFormJSON(ctx, createURL, createForm, &createResp); err != nil {
		return nil, err
	}
	if createResp.Errno != 0 {
		return nil, fmt.Errorf("baidu create failed: errno=%d", createResp.Errno)
	}

	return &BaiduBackupObject{
		Path:  ifEmpty(strings.TrimSpace(createResp.Path), objectPath),
		Name:  path.Base(objectPath),
		Size:  createResp.Size,
		IsDir: 0,
		MD5:   ifEmpty(strings.TrimSpace(createResp.MD5), ifEmpty(lastUploadedMD5, blockMD5List[0])),
		Ctime: createResp.Ctime,
		Mtime: createResp.Mtime,
	}, nil
}

func (s *BaiduConnectorService) ListBackups(
	ctx context.Context,
	tenantID string,
	userID string,
	pathPrefix string,
) ([]BaiduBackupObject, error) {
	accessToken, _, err := s.ensureValidAccessToken(ctx, tenantID, userID)
	if err != nil {
		return nil, err
	}

	dirPath := normalizePanPath(pathPrefix, s.defaultPathPrefix())
	query := url.Values{}
	query.Set("method", "list")
	query.Set("access_token", accessToken)
	query.Set("dir", dirPath)
	query.Set("web", "1")
	query.Set("order", "time")
	query.Set("desc", "1")
	query.Set("num", "1000")
	query.Set("start", "0")
	listURL := s.panAPIBaseURL + "/xpan/file?" + query.Encode()

	var listResp baiduListResponse
	if err := s.getJSON(ctx, listURL, &listResp); err != nil {
		return nil, err
	}
	if listResp.Errno != 0 {
		return nil, fmt.Errorf("baidu list failed: errno=%d", listResp.Errno)
	}

	items := make([]BaiduBackupObject, 0, len(listResp.List))
	for _, item := range listResp.List {
		items = append(items, BaiduBackupObject{
			Path:  item.Path,
			Name:  ifEmpty(item.ServerFilename, path.Base(item.Path)),
			Size:  item.Size,
			IsDir: item.IsDir,
			MD5:   item.MD5,
			Ctime: item.Ctime,
			Mtime: item.Mtime,
		})
	}
	return items, nil
}

func (s *BaiduConnectorService) DownloadBackup(
	ctx context.Context,
	tenantID string,
	userID string,
	filePath string,
) ([]byte, string, error) {
	filePath = strings.TrimSpace(filePath)
	if filePath == "" {
		return nil, "", errors.New("backup path is required")
	}

	accessToken, _, err := s.ensureValidAccessToken(ctx, tenantID, userID)
	if err != nil {
		return nil, "", err
	}

	query := url.Values{}
	query.Set("method", "download")
	query.Set("access_token", accessToken)
	query.Set("path", filePath)
	downloadURL := s.panAPIBaseURL + "/xpan/file?" + query.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, downloadURL, nil)
	if err != nil {
		return nil, "", err
	}
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 32*1024))
		return nil, "", s.parseBaiduHTTPError(resp.StatusCode, body)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, "", err
	}
	return data, path.Base(filePath), nil
}

func (s *BaiduConnectorService) DeleteBackup(
	ctx context.Context,
	tenantID string,
	userID string,
	filePath string,
) error {
	filePath = strings.TrimSpace(filePath)
	if filePath == "" {
		return errors.New("backup path is required")
	}
	filePath = normalizePanPath(filePath, "/")
	if filePath == "/" {
		return errors.New("backup path is invalid")
	}

	accessToken, _, err := s.ensureValidAccessToken(ctx, tenantID, userID)
	if err != nil {
		return err
	}

	query := url.Values{}
	query.Set("method", "filemanager")
	query.Set("access_token", accessToken)
	query.Set("opera", "delete")
	query.Set("async", "2")
	apiURL := s.panAPIBaseURL + "/xpan/file?" + query.Encode()
	form := url.Values{}
	form.Set("filelist", fmt.Sprintf(`[{"path":%q}]`, filePath))

	var resp map[string]any
	if err := s.postFormJSON(ctx, apiURL, form, &resp); err != nil {
		return err
	}
	if errno, ok := resp["errno"].(float64); ok && int(errno) != 0 {
		errMsg := ""
		if value, ok := resp["errmsg"].(string); ok {
			errMsg = strings.TrimSpace(value)
		}
		if errMsg != "" {
			return fmt.Errorf("baidu delete failed: errno=%d %s", int(errno), errMsg)
		}
		return fmt.Errorf("baidu delete failed: errno=%d", int(errno))
	}
	return nil
}

func (s *BaiduConnectorService) exchangeAuthorizationCode(ctx context.Context, code string) (*baiduTokenResponse, error) {
	values := url.Values{}
	values.Set("grant_type", "authorization_code")
	values.Set("code", strings.TrimSpace(code))
	values.Set("client_id", strings.TrimSpace(s.cfg.APIKey))
	values.Set("client_secret", strings.TrimSpace(s.cfg.SecretKey))
	values.Set("redirect_uri", strings.TrimSpace(s.cfg.RedirectURI))

	return s.requestToken(ctx, values)
}

func (s *BaiduConnectorService) refreshAccessToken(ctx context.Context, refreshToken string) (*baiduTokenResponse, error) {
	values := url.Values{}
	values.Set("grant_type", "refresh_token")
	values.Set("refresh_token", strings.TrimSpace(refreshToken))
	values.Set("client_id", strings.TrimSpace(s.cfg.APIKey))
	values.Set("client_secret", strings.TrimSpace(s.cfg.SecretKey))
	return s.requestToken(ctx, values)
}

func (s *BaiduConnectorService) requestToken(ctx context.Context, values url.Values) (*baiduTokenResponse, error) {
	tokenURL := strings.TrimSpace(s.cfg.TokenURL)
	if tokenURL == "" {
		tokenURL = "https://openapi.baidu.com/oauth/2.0/token"
	}

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		tokenURL,
		strings.NewReader(values.Encode()),
	)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 256*1024))
	if err != nil {
		return nil, err
	}

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return nil, s.parseBaiduHTTPError(resp.StatusCode, body)
	}

	var tokenResp baiduTokenResponse
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return nil, err
	}
	if strings.TrimSpace(tokenResp.AccessToken) == "" {
		var tokenErr baiduTokenErrorResponse
		if json.Unmarshal(body, &tokenErr) == nil && tokenErr.Error != "" {
			return nil, fmt.Errorf("baidu oauth error: %s (%s)", tokenErr.Error, tokenErr.ErrorDescription)
		}
		return nil, errors.New("baidu oauth did not return access_token")
	}
	return &tokenResp, nil
}

func (s *BaiduConnectorService) upsertAccountToken(
	ctx context.Context,
	tenantID string,
	userID string,
	token *baiduTokenResponse,
) error {
	accessTokenEnc, err := s.encryptToken(token.AccessToken)
	if err != nil {
		return err
	}
	refreshTokenEnc, err := s.encryptToken(token.RefreshToken)
	if err != nil {
		return err
	}

	var expiresAt *time.Time
	if token.ExpiresIn > 0 {
		t := time.Now().UTC().Add(time.Duration(token.ExpiresIn) * time.Second)
		expiresAt = &t
	}

	extraJSON, _ := json.Marshal(map[string]any{
		"openid":         token.OpenID,
		"session_key":    token.SessionKey,
		"session_secret": token.SessionSecret,
	})

	var account model.CloudAccount
	tx := s.db.WithContext(ctx)
	err = tx.Where("tenant_id = ? AND user_id = ? AND provider = ?", tenantID, userID, baiduProviderID).
		First(&account).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		account = model.CloudAccount{
			TenantID:        tenantID,
			UserID:          userID,
			Provider:        baiduProviderID,
			ExternalUserID:  strings.TrimSpace(token.OpenID),
			DisplayName:     "",
			AccessTokenEnc:  accessTokenEnc,
			RefreshTokenEnc: refreshTokenEnc,
			Scope:           strings.TrimSpace(token.Scope),
			Status:          model.CloudAccountStatusActive,
			ExpiresAt:       expiresAt,
			Extra:           string(extraJSON),
		}
		return tx.Create(&account).Error
	}
	if err != nil {
		return err
	}

	updates := map[string]any{
		"external_user_id":  strings.TrimSpace(token.OpenID),
		"access_token_enc":  accessTokenEnc,
		"refresh_token_enc": refreshTokenEnc,
		"scope":             strings.TrimSpace(token.Scope),
		"status":            model.CloudAccountStatusActive,
		"expires_at":        expiresAt,
		"extra":             string(extraJSON),
	}
	return tx.Model(&account).Updates(updates).Error
}

func (s *BaiduConnectorService) getAccount(ctx context.Context, tenantID, userID string) (*model.CloudAccount, error) {
	var account model.CloudAccount
	if err := s.db.WithContext(ctx).
		Where("tenant_id = ? AND user_id = ? AND provider = ?", tenantID, userID, baiduProviderID).
		First(&account).Error; err != nil {
		return nil, err
	}
	return &account, nil
}

func (s *BaiduConnectorService) ensureValidAccessToken(
	ctx context.Context,
	tenantID string,
	userID string,
) (string, *model.CloudAccount, error) {
	account, err := s.getAccount(ctx, tenantID, userID)
	if err != nil {
		return "", nil, err
	}
	if account.Status != model.CloudAccountStatusActive {
		return "", nil, errors.New("baidu account is not active")
	}

	accessToken, err := s.decryptToken(account.AccessTokenEnc)
	if err != nil {
		return "", nil, err
	}

	needsRefresh := accessToken == ""
	if account.ExpiresAt != nil {
		needsRefresh = needsRefresh || time.Now().UTC().After(account.ExpiresAt.Add(-60*time.Second))
	}

	if !needsRefresh {
		return accessToken, account, nil
	}

	refreshToken, err := s.decryptToken(account.RefreshTokenEnc)
	if err != nil {
		return "", nil, err
	}
	if strings.TrimSpace(refreshToken) == "" {
		return "", nil, errors.New("baidu refresh token is missing")
	}

	refreshed, err := s.refreshAccessToken(ctx, refreshToken)
	if err != nil {
		_ = s.db.WithContext(ctx).Model(&model.CloudAccount{}).
			Where("id = ?", account.ID).
			Updates(map[string]any{"status": model.CloudAccountStatusError}).Error
		return "", nil, err
	}
	if strings.TrimSpace(refreshed.RefreshToken) == "" {
		refreshed.RefreshToken = refreshToken
	}
	if err := s.upsertAccountToken(ctx, tenantID, userID, refreshed); err != nil {
		return "", nil, err
	}

	account, err = s.getAccount(ctx, tenantID, userID)
	if err != nil {
		return "", nil, err
	}
	accessToken, err = s.decryptToken(account.AccessTokenEnc)
	if err != nil {
		return "", nil, err
	}
	if strings.TrimSpace(accessToken) == "" {
		return "", nil, errors.New("baidu access token is empty")
	}
	return accessToken, account, nil
}

func (s *BaiduConnectorService) createSignedState(tenantID, userID, returnTo string, ttl time.Duration) (string, error) {
	if strings.TrimSpace(tenantID) == "" || strings.TrimSpace(userID) == "" {
		return "", errors.New("invalid auth context for baidu state")
	}
	if ttl <= 0 {
		ttl = baiduStateTTL
	}
	state := baiduOAuthState{
		TenantID: tenantID,
		UserID:   userID,
		ReturnTo: sanitizeReturnTo(returnTo),
		Exp:      time.Now().UTC().Add(ttl).Unix(),
		Nonce:    randomHex(8),
	}

	payload, err := json.Marshal(state)
	if err != nil {
		return "", err
	}
	signature := s.signState(payload)

	return base64.RawURLEncoding.EncodeToString(payload) + "." + base64.RawURLEncoding.EncodeToString(signature), nil
}

func (s *BaiduConnectorService) parseSignedState(encoded string) (*baiduOAuthState, error) {
	parts := strings.Split(encoded, ".")
	if len(parts) != 2 {
		return nil, errors.New("invalid oauth state")
	}

	payload, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, errors.New("invalid oauth state payload")
	}
	signature, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, errors.New("invalid oauth state signature")
	}

	expected := s.signState(payload)
	if !hmac.Equal(signature, expected) {
		return nil, errors.New("oauth state signature mismatch")
	}

	var state baiduOAuthState
	if err := json.Unmarshal(payload, &state); err != nil {
		return nil, errors.New("invalid oauth state data")
	}
	if state.Exp <= time.Now().UTC().Unix() {
		return nil, errors.New("oauth state expired")
	}
	if strings.TrimSpace(state.TenantID) == "" || strings.TrimSpace(state.UserID) == "" {
		return nil, errors.New("oauth state missing subject")
	}
	state.ReturnTo = sanitizeReturnTo(state.ReturnTo)
	return &state, nil
}

func (s *BaiduConnectorService) signState(payload []byte) []byte {
	mac := hmac.New(sha256.New, s.stateSecret)
	_, _ = mac.Write(payload)
	return mac.Sum(nil)
}

func (s *BaiduConnectorService) encryptToken(raw string) (string, error) {
	if raw == "" {
		return "", nil
	}
	block, err := aes.NewCipher(s.tokenEncrypt32[:])
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}
	encrypted := gcm.Seal(nil, nonce, []byte(raw), nil)
	payload := append(nonce, encrypted...)
	return base64.RawURLEncoding.EncodeToString(payload), nil
}

func (s *BaiduConnectorService) decryptToken(enc string) (string, error) {
	enc = strings.TrimSpace(enc)
	if enc == "" {
		return "", nil
	}
	payload, err := base64.RawURLEncoding.DecodeString(enc)
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(s.tokenEncrypt32[:])
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	if len(payload) < gcm.NonceSize() {
		return "", errors.New("invalid encrypted token payload")
	}
	nonce := payload[:gcm.NonceSize()]
	ciphertext := payload[gcm.NonceSize():]
	plain, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}
	return string(plain), nil
}

func (s *BaiduConnectorService) postFormJSON(ctx context.Context, endpoint string, values url.Values, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(values.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 2*1024*1024))
	if err != nil {
		return err
	}
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return s.parseBaiduHTTPError(resp.StatusCode, body)
	}
	if out == nil {
		return nil
	}
	return json.Unmarshal(body, out)
}

func (s *BaiduConnectorService) getJSON(ctx context.Context, endpoint string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return err
	}
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 2*1024*1024))
	if err != nil {
		return err
	}
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return s.parseBaiduHTTPError(resp.StatusCode, body)
	}
	return json.Unmarshal(body, out)
}

func (s *BaiduConnectorService) postMultipartSingleFile(
	ctx context.Context,
	endpoint string,
	fieldName string,
	fileName string,
	content []byte,
	out any,
) error {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile(fieldName, fileName)
	if err != nil {
		return err
	}
	if _, err := part.Write(content); err != nil {
		return err
	}
	if err := writer.Close(); err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, &body)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(io.LimitReader(resp.Body, 2*1024*1024))
	if err != nil {
		return err
	}
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return s.parseBaiduHTTPError(resp.StatusCode, respBody)
	}
	if out == nil {
		return nil
	}
	return json.Unmarshal(respBody, out)
}

func (s *BaiduConnectorService) parseBaiduHTTPError(statusCode int, body []byte) error {
	var errResp baiduErrorResponse
	if json.Unmarshal(body, &errResp) == nil {
		if errResp.ErrorCode != "" || errResp.ErrorDescription != "" {
			return fmt.Errorf(
				"baidu api failed (http %d): %s (%s)",
				statusCode,
				errResp.ErrorCode,
				errResp.ErrorDescription,
			)
		}
		if errResp.Errno != 0 || errResp.ErrMsg != "" {
			return fmt.Errorf("baidu api failed (http %d): errno=%d %s", statusCode, errResp.Errno, errResp.ErrMsg)
		}
	}

	var tokenErr baiduTokenErrorResponse
	if json.Unmarshal(body, &tokenErr) == nil && tokenErr.Error != "" {
		return fmt.Errorf("baidu oauth failed (http %d): %s (%s)", statusCode, tokenErr.Error, tokenErr.ErrorDescription)
	}

	trimmed := strings.TrimSpace(string(body))
	if trimmed == "" {
		return fmt.Errorf("baidu api failed (http %d)", statusCode)
	}
	if len(trimmed) > 256 {
		trimmed = trimmed[:256]
	}
	return fmt.Errorf("baidu api failed (http %d): %s", statusCode, trimmed)
}

func (s *BaiduConnectorService) defaultPathPrefix() string {
	return normalizePanPath(s.cfg.DefaultPathPrefix, "/apps/baobaobaiphone/backups")
}

func isReservedBaiduAuthParam(key string) bool {
	switch key {
	case "response_type", "client_id", "redirect_uri", "scope", "state":
		return true
	default:
		return false
	}
}

func randomHex(bytesLen int) string {
	if bytesLen <= 0 {
		bytesLen = 8
	}
	buf := make([]byte, bytesLen)
	if _, err := rand.Read(buf); err != nil {
		now := time.Now().UnixNano()
		return fmt.Sprintf("%x", now)
	}
	return hex.EncodeToString(buf)
}

func normalizePanPath(raw string, fallback string) string {
	p := strings.TrimSpace(raw)
	if p == "" {
		p = strings.TrimSpace(fallback)
	}
	if p == "" {
		p = "/"
	}
	p = strings.ReplaceAll(p, "\\", "/")
	if !strings.HasPrefix(p, "/") {
		p = "/" + p
	}
	p = path.Clean(p)
	if p == "." {
		p = "/"
	}
	if !strings.HasPrefix(p, "/") {
		p = "/" + p
	}
	return p
}

func joinPanPath(dirPath, fileName string) string {
	dirPath = normalizePanPath(dirPath, "/")
	fileName = strings.TrimLeft(strings.TrimSpace(fileName), "/")
	if fileName == "" {
		return dirPath
	}
	if strings.HasSuffix(dirPath, "/") {
		return dirPath + fileName
	}
	return dirPath + "/" + fileName
}

func ifEmpty(value string, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}

func splitContentIntoChunks(content []byte, chunkSize int) [][]byte {
	if len(content) == 0 {
		return nil
	}
	if chunkSize <= 0 {
		chunkSize = baiduUploadChunkSize
	}

	chunks := make([][]byte, 0, (len(content)+chunkSize-1)/chunkSize)
	for offset := 0; offset < len(content); offset += chunkSize {
		end := offset + chunkSize
		if end > len(content) {
			end = len(content)
		}
		chunks = append(chunks, content[offset:end])
	}
	return chunks
}

func normalizePrecreatePartSeqList(raw []any, totalParts int) []int {
	if totalParts <= 0 {
		return nil
	}
	if len(raw) == 0 {
		return buildSequentialPartSeqList(totalParts)
	}

	items := make([]int, 0, len(raw))
	seen := make(map[int]struct{}, len(raw))
	for _, value := range raw {
		partSeq, ok := parsePartSeq(value)
		if !ok {
			continue
		}
		if partSeq < 0 || partSeq >= totalParts {
			continue
		}
		if _, exists := seen[partSeq]; exists {
			continue
		}
		seen[partSeq] = struct{}{}
		items = append(items, partSeq)
	}

	if len(items) == 0 {
		return buildSequentialPartSeqList(totalParts)
	}
	return items
}

func buildSequentialPartSeqList(total int) []int {
	if total <= 0 {
		return nil
	}
	items := make([]int, total)
	for index := 0; index < total; index++ {
		items[index] = index
	}
	return items
}

func parsePartSeq(value any) (int, bool) {
	switch v := value.(type) {
	case float64:
		return int(v), true
	case float32:
		return int(v), true
	case int:
		return v, true
	case int64:
		return int(v), true
	case int32:
		return int(v), true
	case uint64:
		return int(v), true
	case uint32:
		return int(v), true
	case uint:
		return int(v), true
	case string:
		parsed, err := strconv.Atoi(strings.TrimSpace(v))
		if err != nil {
			return 0, false
		}
		return parsed, true
	default:
		return 0, false
	}
}

func sanitizeReturnTo(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	parsed, err := url.Parse(raw)
	if err != nil || !parsed.IsAbs() {
		return ""
	}
	scheme := strings.ToLower(strings.TrimSpace(parsed.Scheme))
	if scheme != "http" && scheme != "https" {
		return ""
	}
	if strings.TrimSpace(parsed.Host) == "" {
		return ""
	}
	return parsed.String()
}
