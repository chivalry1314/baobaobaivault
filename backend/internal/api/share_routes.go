package api

import (
	"errors"
	"github.com/gin-gonic/gin"
	"net/http"
)

func (h *Handler) registerShareRoutes(r *gin.Engine) {
	group := r.Group("/api/share")
	{
		auth := group.Group("/auth")
		{
			auth.GET("/config", h.shareAuthConfig)
			auth.GET("/email-health", h.shareEmailHealth)
			auth.POST("/continue", h.shareContinue)
			auth.POST("/register", h.shareRegister)
			auth.POST("/register/resend", h.shareRegisterResend)
			auth.POST("/register/verify", h.shareRegisterVerify)
			auth.POST("/password-reset/request", h.sharePasswordResetRequest)
			auth.POST("/password-reset/resend", h.sharePasswordResetResend)
			auth.POST("/password-reset/complete", h.sharePasswordResetComplete)
			auth.POST("/email-health/test", h.shareRequireAuth(), h.shareSendSMTPTest)
			auth.POST("/login", h.shareLogin)
			auth.POST("/logout", h.shareLogout)
			auth.GET("/session", h.shareSession)
		}

		group.GET("/discover/cards", h.shareDiscoverCards)
		group.GET("/users/:userId/assets/:fileName", h.shareUserAsset)
		group.GET("/cards/:cardId", h.shareCardDetail)
		group.GET("/cards/:cardId/cover/preview", h.shareCardCoverPreview)
		group.GET("/cards/:cardId/cover/download", h.shareCardCoverDownload)
		group.GET("/cards/:cardId/assets/:slot/preview", h.shareCardAssetPreview)
		group.GET("/cards/:cardId/assets/:slot/download", h.shareCardAssetDownload)

		me := group.Group("/me")
		me.Use(h.shareRequireAuth())
		{
			me.PATCH("/profile", h.shareUpdateProfile)
			me.POST("/password", h.shareChangePassword)
			me.DELETE("/account", h.shareDeleteOwnAccount)
			me.GET("/cards", h.shareMyCards)
			me.GET("/access-codes", h.shareMyAccessCodes)
			me.POST("/cards", h.shareCreateCard)
			me.POST("/admin/cards", h.shareCreateCardBundle)
			me.POST("/cards/:cardId/submit-review", h.shareSubmitCardReview)
			me.GET("/admin/users", h.shareAdminUsers)
			me.GET("/admin/auth-settings", h.shareAdminAuthSettings)
			me.PATCH("/admin/auth-settings", h.shareAdminUpdateAuthSettings)
			me.PATCH("/admin/users/:userId/role", h.shareAdminUpdateUserRole)
			me.DELETE("/admin/users/:userId", h.shareAdminDeleteUser)
			me.GET("/admin/reviews", h.shareAdminReviews)
			me.POST("/admin/reviews/:cardId/approve", h.shareAdminApproveReview)
			me.POST("/admin/reviews/:cardId/reject", h.shareAdminRejectReview)
			me.GET("/system/storage/configs", h.shareSystemListStorageConfigs)
			me.POST("/system/storage/configs", h.shareSystemCreateStorageConfig)
			me.GET("/system/storage/configs/:id", h.shareSystemGetStorageConfig)
			me.PUT("/system/storage/configs/:id", h.shareSystemUpdateStorageConfig)
			me.DELETE("/system/storage/configs/:id", h.shareSystemDeleteStorageConfig)
			me.GET("/system/namespaces", h.shareSystemListNamespaces)
			me.GET("/system/namespaces/:id", h.shareSystemGetNamespace)
			me.POST("/system/namespaces", h.shareSystemCreateNamespace)
			me.PUT("/system/namespaces/:id", h.shareSystemUpdateNamespace)
			me.DELETE("/system/namespaces/:id", h.shareSystemDeleteNamespace)
			me.GET("/system/objects", h.shareSystemListObjects)
			me.GET("/system/objects/versions", h.shareSystemListObjectVersions)
			me.POST("/system/objects/versions/rollback", h.shareSystemRollbackObjectVersion)
			me.POST("/system/objects/upload", h.shareSystemUploadObject)
			me.GET("/system/objects/download", h.shareSystemDownloadObject)
			me.DELETE("/system/objects", h.shareSystemDeleteObject)
			me.GET("/system/objects/presign-put", h.shareSystemPresignPutObject)
			me.POST("/system/objects/presign-put/complete", h.shareSystemCompletePresignPutObject)
			me.GET("/system/objects/presign-get", h.shareSystemPresignGetObject)
			me.GET("/system/audit/logs", h.shareSystemListAuditLogs)
			me.GET("/system/access-keys", h.shareSystemListAccessKeys)
			me.POST("/system/access-keys", h.shareSystemCreateAccessKey)
			me.DELETE("/system/access-keys/:id", h.shareSystemRevokeAccessKey)
			me.GET("/system/users", h.shareSystemUsers)
			me.PATCH("/system/users/:userId/role", h.shareSystemUpdateUserRole)
			me.DELETE("/system/users/:userId", h.shareSystemDeleteUser)
			me.POST("/system/users/:userId/reset-password", h.shareSystemResetUserPassword)
			me.GET("/system/media-storage", h.shareSystemMediaStorageSettings)
			me.PATCH("/system/media-storage", h.shareSystemUpdateMediaStorageSettings)
			me.POST("/system/media-storage/migrate", h.shareSystemRunMediaStorageMigration)
			me.GET("/system/auth-settings", h.shareSystemAuthSettings)
			me.PATCH("/system/auth-settings", h.shareSystemUpdateAuthSettings)
			me.POST("/system/auth-settings/test-email", h.shareSystemSendSMTPTest)
			me.GET("/system/permissions", h.shareSystemListPermissions)
			me.GET("/system/roles", h.shareSystemListRoles)
			me.GET("/system/roles/:id", h.shareSystemGetRole)
			me.POST("/system/roles", h.shareSystemCreateRole)
			me.PUT("/system/roles/:id", h.shareSystemUpdateRole)
			me.DELETE("/system/roles/:id", h.shareSystemDeleteRole)
			me.PATCH("/cards/:cardId", h.shareUpdateCard)
			me.PUT("/cards/:cardId/cover", h.shareReplaceCardCover)
			me.DELETE("/cards/:cardId/cover", h.shareDeleteCardCover)
			me.PUT("/cards/:cardId/assets/:slot", h.shareReplaceCardAsset)
			me.DELETE("/cards/:cardId/assets/:slot", h.shareDeleteCardAsset)
			me.GET("/cards/:cardId/access-code", h.shareGetCardAccessCode)
			me.PUT("/cards/:cardId/access-code", h.shareUpdateCardAccessCode)
			me.DELETE("/cards/:cardId/access-code", h.shareDeleteCardAccessCode)
			me.DELETE("/cards/:cardId", h.shareDeleteCard)
		}
	}
}

func (h *Handler) shareRequireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		user, err := h.resolveShareSessionUser(c)
		if err != nil {
			jsonError(c, http.StatusUnauthorized, err)
			c.Abort()
			return
		}
		if user == nil {
			jsonError(c, http.StatusUnauthorized, errors.New("authentication required"))
			c.Abort()
			return
		}

		c.Set(ctxShareUser, user)
		c.Next()
	}
}
