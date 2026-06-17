package api

import (
	"errors"
	"github.com/baobaobai/baobaobaivault/internal/service"
	"github.com/gin-gonic/gin"
	"net/http"
)

func (h *Handler) shareAdminReviews(c *gin.Context) {
	user, err := h.requireShareUser(c)
	if err != nil {
		jsonError(c, http.StatusUnauthorized, err)
		return
	}

	dashboard, err := h.shareService.ListReviewDashboard(c.Request.Context(), user.ID, c.Query("status"))
	if err != nil {
		status := http.StatusBadRequest
		switch {
		case errors.Is(err, service.ErrShareUserNotFound):
			status = http.StatusNotFound
		case errors.Is(err, service.ErrShareForbiddenRole):
			status = http.StatusForbidden
		case errors.Is(err, service.ErrShareInvalidReviewStatus):
			status = http.StatusBadRequest
		default:
			status = http.StatusInternalServerError
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, dashboard)
}

func (h *Handler) shareAdminApproveReview(c *gin.Context) {
	user, err := h.requireShareUser(c)
	if err != nil {
		jsonError(c, http.StatusUnauthorized, err)
		return
	}

	card, err := h.shareService.ApproveCard(c.Request.Context(), user.ID, c.Param("cardId"))
	if err != nil {
		status := http.StatusBadRequest
		switch {
		case errors.Is(err, service.ErrShareUserNotFound),
			errors.Is(err, service.ErrShareCardNotFound):
			status = http.StatusNotFound
		case errors.Is(err, service.ErrShareForbiddenRole):
			status = http.StatusForbidden
		default:
			status = http.StatusInternalServerError
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"card": card})
}

func (h *Handler) shareAdminRejectReview(c *gin.Context) {
	user, err := h.requireShareUser(c)
	if err != nil {
		jsonError(c, http.StatusUnauthorized, err)
		return
	}

	var req struct {
		Reason string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	card, err := h.shareService.RejectCard(c.Request.Context(), user.ID, c.Param("cardId"), req.Reason)
	if err != nil {
		status := http.StatusBadRequest
		switch {
		case errors.Is(err, service.ErrShareUserNotFound),
			errors.Is(err, service.ErrShareCardNotFound):
			status = http.StatusNotFound
		case errors.Is(err, service.ErrShareForbiddenRole):
			status = http.StatusForbidden
		case errors.Is(err, service.ErrShareReviewReasonRequired):
			status = http.StatusBadRequest
		default:
			status = http.StatusInternalServerError
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"card": card})
}

func (h *Handler) shareAdminDelistCard(c *gin.Context) {
	user, err := h.requireShareUser(c)
	if err != nil {
		jsonError(c, http.StatusUnauthorized, err)
		return
	}

	cardID := c.Param("cardId")
	var req struct {
		Reason string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	card, err := h.shareService.DelistCardByAdmin(c.Request.Context(), user.ID, cardID, req.Reason)
	if err != nil {
		status := http.StatusBadRequest
		switch {
		case errors.Is(err, service.ErrShareUserNotFound),
			errors.Is(err, service.ErrShareCardNotFound):
			status = http.StatusNotFound
		case errors.Is(err, service.ErrShareForbiddenRole):
			status = http.StatusForbidden
		case errors.Is(err, service.ErrShareReviewReasonRequired),
			errors.Is(err, service.ErrShareCardNotDelistable):
			status = http.StatusBadRequest
		default:
			status = http.StatusInternalServerError
		}
		h.writeAuditLog(c, "delist", "card", cardID, req.Reason, "failure")
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	h.writeAuditLog(c, "delist", "card", cardID, req.Reason, "success")
	c.JSON(http.StatusOK, gin.H{"card": card})
}

func (h *Handler) shareAdminUsers(c *gin.Context) {
	user, err := h.requireShareUser(c)
	if err != nil {
		jsonError(c, http.StatusUnauthorized, err)
		return
	}

	users, _, err := h.shareService.ListUsersForRoleManage(c.Request.Context(), service.ShareListUsersForRoleManageInput{
		OperatorID: user.ID,
		Page:       1,
		PageSize:   1000,
	})
	if err != nil {
		status := http.StatusBadRequest
		switch {
		case errors.Is(err, service.ErrShareForbiddenRole):
			status = http.StatusForbidden
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"users": users})
}

func (h *Handler) shareAdminAuthSettings(c *gin.Context) {
	user, err := h.requireShareUser(c)
	if err != nil {
		jsonError(c, http.StatusUnauthorized, err)
		return
	}

	settings, err := h.shareService.GetShareAuthSettings(c.Request.Context(), user.ID)
	if err != nil {
		status := http.StatusBadRequest
		switch {
		case errors.Is(err, service.ErrShareForbiddenRole):
			status = http.StatusForbidden
		case errors.Is(err, service.ErrShareUserNotFound):
			status = http.StatusNotFound
		default:
			status = http.StatusInternalServerError
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"settings": settings})
}

func (h *Handler) shareAdminUpdateAuthSettings(c *gin.Context) {
	user, err := h.requireShareUser(c)
	if err != nil {
		jsonError(c, http.StatusUnauthorized, err)
		return
	}

	var req struct {
		EmailVerificationEnabled  bool `json:"emailVerificationEnabled"`
		VerificationCodeTTLSeconds int  `json:"verificationCodeTTLSeconds"`
		ResendIntervalSeconds     int  `json:"resendIntervalSeconds"`
		MaxVerifyAttempts         int  `json:"maxVerifyAttempts"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	settings, err := h.shareService.UpdateShareAuthSettings(c.Request.Context(), service.ShareUpdateAuthSettingsInput{
		OperatorID:                user.ID,
		EmailVerificationEnabled:  req.EmailVerificationEnabled,
		VerificationCodeTTLSeconds: req.VerificationCodeTTLSeconds,
		ResendIntervalSeconds:     req.ResendIntervalSeconds,
		MaxVerifyAttempts:         req.MaxVerifyAttempts,
	})
	if err != nil {
		status := http.StatusBadRequest
		switch {
		case errors.Is(err, service.ErrShareForbiddenRole),
			errors.Is(err, service.ErrShareSuperAdminRequired):
			status = http.StatusForbidden
		case errors.Is(err, service.ErrShareUserNotFound):
			status = http.StatusNotFound
		default:
			status = http.StatusBadRequest
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"settings": settings})
}

func (h *Handler) shareAdminUpdateUserRole(c *gin.Context) {
	user, err := h.requireShareUser(c)
	if err != nil {
		jsonError(c, http.StatusUnauthorized, err)
		return
	}

	var req struct {
		Role string `json:"role"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	updated, err := h.shareService.UpdateUserRole(c.Request.Context(), service.ShareUpdateUserRoleInput{
		OperatorID: user.ID,
		UserID:     c.Param("userId"),
		Role:       req.Role,
	})
	if err != nil {
		status := http.StatusBadRequest
		switch {
		case errors.Is(err, service.ErrShareForbiddenRole):
			status = http.StatusForbidden
		case errors.Is(err, service.ErrShareSelfRoleDowngrade):
			status = http.StatusBadRequest
		case errors.Is(err, service.ErrShareUserNotFound):
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	updated.IsConfiguredSuperAdmin = h.isConfiguredShareSuperAdmin(updated)
	c.JSON(http.StatusOK, gin.H{"user": updated})
}

func (h *Handler) shareAdminDeleteUser(c *gin.Context) {
	user, err := h.requireShareUser(c)
	if err != nil {
		jsonError(c, http.StatusUnauthorized, err)
		return
	}

	err = h.shareService.DeleteUserForManage(c.Request.Context(), service.ShareDeleteUserInput{
		OperatorID: user.ID,
		UserID:     c.Param("userId"),
	})
	if err != nil {
		status := http.StatusBadRequest
		switch {
		case errors.Is(err, service.ErrShareForbiddenRole):
			status = http.StatusForbidden
		case errors.Is(err, service.ErrShareUserNotFound):
			status = http.StatusNotFound
		case errors.Is(err, service.ErrShareSelfDelete),
			errors.Is(err, service.ErrShareLastManagerDelete),
			errors.Is(err, service.ErrShareProtectedSuperAdmin):
			status = http.StatusBadRequest
		default:
			status = http.StatusInternalServerError
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}
