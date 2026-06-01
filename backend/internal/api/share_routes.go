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
			auth.POST("/continue", h.shareContinue)
			auth.POST("/register", h.shareRegister)
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
			me.GET("/cards", h.shareMyCards)
			me.GET("/access-codes", h.shareMyAccessCodes)
			me.POST("/cards", h.shareCreateCard)
			me.POST("/admin/cards", h.shareCreateCardBundle)
			me.POST("/cards/:cardId/submit-review", h.shareSubmitCardReview)
			me.GET("/admin/users", h.shareAdminUsers)
			me.PATCH("/admin/users/:userId/role", h.shareAdminUpdateUserRole)
			me.GET("/admin/reviews", h.shareAdminReviews)
			me.POST("/admin/reviews/:cardId/approve", h.shareAdminApproveReview)
			me.POST("/admin/reviews/:cardId/reject", h.shareAdminRejectReview)
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
