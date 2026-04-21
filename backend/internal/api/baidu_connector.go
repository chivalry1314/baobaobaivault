package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

func (h *Handler) baiduOAuthCallback(c *gin.Context) {
	if oauthErr := strings.TrimSpace(c.Query("error")); oauthErr != "" {
		description := strings.TrimSpace(c.Query("error_description"))
		if description == "" {
			description = oauthErr
		}
		renderBaiduOAuthResult(c, http.StatusBadRequest, false, "Baidu authorization failed: "+description, "")
		return
	}

	code := strings.TrimSpace(c.Query("code"))
	state := strings.TrimSpace(c.Query("state"))
	if code == "" || state == "" {
		renderBaiduOAuthResult(c, http.StatusBadRequest, false, "Missing OAuth callback parameters.", "")
		return
	}

	tenantID, userID, returnTo, err := h.baiduService.HandleOAuthCallback(c.Request.Context(), code, state)
	if err != nil {
		h.logger.Warn("baidu oauth callback failed", zap.Error(err))
		renderBaiduOAuthResult(c, http.StatusBadRequest, false, "Baidu authorization failed: "+err.Error(), "")
		return
	}

	h.logger.Info("baidu account linked", zap.String("tenant_id", tenantID), zap.String("user_id", userID))
	renderBaiduOAuthResult(c, http.StatusOK, true, "Baidu account connected. You can return to the app now.", returnTo)
}

func (h *Handler) getBaiduConnectorStatus(c *gin.Context) {
	tenantID, userID, err := authSubjectFromContext(c)
	if err != nil {
		jsonError(c, http.StatusUnauthorized, err)
		return
	}

	status, err := h.baiduService.GetAccountStatus(c.Request.Context(), tenantID, userID)
	if err != nil {
		jsonError(c, http.StatusInternalServerError, err)
		return
	}
	jsonSuccess(c, status)
}

func (h *Handler) getBaiduConnectorAuthURL(c *gin.Context) {
	tenantID, userID, err := authSubjectFromContext(c)
	if err != nil {
		jsonError(c, http.StatusUnauthorized, err)
		return
	}

	returnTo := strings.TrimSpace(c.Query("return_to"))
	authURL, err := h.baiduService.BuildAuthURL(tenantID, userID, returnTo)
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}
	jsonSuccess(c, gin.H{"url": authURL})
}

func (h *Handler) listBaiduBackups(c *gin.Context) {
	tenantID, userID, err := authSubjectFromContext(c)
	if err != nil {
		jsonError(c, http.StatusUnauthorized, err)
		return
	}

	pathPrefix := strings.TrimSpace(c.Query("path_prefix"))
	items, err := h.baiduService.ListBackups(c.Request.Context(), tenantID, userID, pathPrefix)
	if err != nil {
		status := http.StatusBadRequest
		if errors.Is(err, gorm.ErrRecordNotFound) {
			status = http.StatusNotFound
		}
		jsonError(c, status, err)
		return
	}
	jsonSuccess(c, items)
}

func (h *Handler) uploadBaiduBackup(c *gin.Context) {
	tenantID, userID, err := authSubjectFromContext(c)
	if err != nil {
		jsonError(c, http.StatusUnauthorized, err)
		return
	}

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		jsonError(c, http.StatusBadRequest, errors.New("file is required"))
		return
	}
	defer file.Close()

	content, err := io.ReadAll(file)
	if err != nil {
		jsonError(c, http.StatusBadRequest, err)
		return
	}

	fileName := strings.TrimSpace(c.PostForm("file_name"))
	if fileName == "" {
		fileName = strings.TrimSpace(header.Filename)
	}
	pathPrefix := strings.TrimSpace(c.PostForm("path_prefix"))

	item, err := h.baiduService.UploadBackup(c.Request.Context(), tenantID, userID, fileName, content, pathPrefix)
	if err != nil {
		status := http.StatusBadRequest
		if errors.Is(err, gorm.ErrRecordNotFound) {
			status = http.StatusNotFound
		}
		jsonError(c, status, err)
		return
	}

	jsonCreated(c, item)
}

func (h *Handler) downloadBaiduBackup(c *gin.Context) {
	tenantID, userID, err := authSubjectFromContext(c)
	if err != nil {
		jsonError(c, http.StatusUnauthorized, err)
		return
	}

	filePath := strings.TrimSpace(c.Query("path"))
	if filePath == "" {
		jsonError(c, http.StatusBadRequest, errors.New("path is required"))
		return
	}

	content, fileName, err := h.baiduService.DownloadBackup(c.Request.Context(), tenantID, userID, filePath)
	if err != nil {
		status := http.StatusBadRequest
		if errors.Is(err, gorm.ErrRecordNotFound) {
			status = http.StatusNotFound
		}
		jsonError(c, status, err)
		return
	}

	if strings.TrimSpace(fileName) == "" {
		fileName = "backup.json"
	}
	fileName = strings.ReplaceAll(fileName, "\"", "_")

	c.Header("Content-Type", "application/json")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", fileName))
	c.Header("Content-Length", strconv.Itoa(len(content)))
	c.Data(http.StatusOK, "application/json", content)
}

func (h *Handler) deleteBaiduBackup(c *gin.Context) {
	tenantID, userID, err := authSubjectFromContext(c)
	if err != nil {
		jsonError(c, http.StatusUnauthorized, err)
		return
	}

	filePath := strings.TrimSpace(c.Query("path"))
	if filePath == "" {
		jsonError(c, http.StatusBadRequest, errors.New("path is required"))
		return
	}

	if err := h.baiduService.DeleteBackup(c.Request.Context(), tenantID, userID, filePath); err != nil {
		status := http.StatusBadRequest
		if errors.Is(err, gorm.ErrRecordNotFound) {
			status = http.StatusNotFound
		}
		jsonError(c, status, err)
		return
	}

	jsonSuccess(c, gin.H{"deleted": true})
}

func (h *Handler) disconnectBaiduConnector(c *gin.Context) {
	tenantID, userID, err := authSubjectFromContext(c)
	if err != nil {
		jsonError(c, http.StatusUnauthorized, err)
		return
	}

	if err := h.baiduService.Disconnect(c.Request.Context(), tenantID, userID); err != nil {
		jsonError(c, http.StatusInternalServerError, err)
		return
	}
	jsonSuccess(c, gin.H{"disconnected": true})
}

func authSubjectFromContext(c *gin.Context) (string, string, error) {
	tenantID := strings.TrimSpace(getTenantID(c))
	userID := strings.TrimSpace(getUserID(c))
	if tenantID == "" || userID == "" {
		return "", "", errors.New("invalid auth context")
	}
	return tenantID, userID, nil
}

func renderBaiduOAuthResult(c *gin.Context, status int, success bool, message, returnTo string) {
	title := "Baidu Authorization Failed"
	accent := "#dc2626"
	if success {
		title = "Baidu Authorization Completed"
		accent = "#16a34a"
	}

	safeReturnTo := sanitizeOAuthReturnTo(returnTo)
	if success && safeReturnTo != "" {
		safeReturnTo = appendQueryParam(safeReturnTo, "baidu_oauth", "success")
	} else if !success && safeReturnTo != "" {
		safeReturnTo = appendQueryParam(safeReturnTo, "baidu_oauth", "failed")
	}

	payloadBytes, _ := json.Marshal(map[string]any{
		"type":       "baobaobaivault:baidu-oauth",
		"success":    success,
		"return_to":  safeReturnTo,
		"created_at": time.Now().UTC().Unix(),
	})

	escapedTitle := html.EscapeString(title)
	escapedMessage := html.EscapeString(strings.TrimSpace(message))
	if escapedMessage == "" {
		escapedMessage = "Done."
	}
	escapedReturnTo := html.EscapeString(safeReturnTo)
	scriptPayload := string(payloadBytes)

	doc := fmt.Sprintf(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>%s</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f8fafc;margin:0;padding:24px;">
  <div style="max-width:560px;margin:40px auto;padding:20px 22px;background:#fff;border:1px solid #e2e8f0;border-radius:14px;">
    <h1 style="margin:0 0 10px;font-size:20px;color:%s;">%s</h1>
    <p style="margin:0;color:#334155;line-height:1.6;">%s</p>
    %s
  </div>
  <script>
    (function () {
      var payload = %s;
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(payload, '*');
          setTimeout(function () { window.close(); }, 220);
          return;
        }
      } catch (error) {}
      if (payload.return_to) {
        setTimeout(function () { window.location.replace(payload.return_to); }, 180);
      }
    })();
  </script>
</body>
</html>`, escapedTitle, accent, escapedTitle, escapedMessage, buildReturnLinkHTML(escapedReturnTo), scriptPayload)

	c.Data(status, "text/html; charset=utf-8", []byte(doc))
}

func buildReturnLinkHTML(escapedReturnTo string) string {
	if strings.TrimSpace(escapedReturnTo) == "" {
		return ""
	}
	return fmt.Sprintf(`<p style="margin:14px 0 0;"><a href="%s" style="color:#2563eb;text-decoration:none;">Return to the app now</a></p>`, escapedReturnTo)
}

func sanitizeOAuthReturnTo(raw string) string {
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

func appendQueryParam(rawURL, key, value string) string {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return rawURL
	}
	query := parsed.Query()
	query.Set(key, value)
	parsed.RawQuery = query.Encode()
	return parsed.String()
}
