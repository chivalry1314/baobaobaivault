package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

const (
	ctxUserID      = "user_id"
	ctxTenantID    = "tenant_id"
	ctxUsername    = "username"
	ctxAuthType    = "auth_type"
	ctxAuditBefore = "audit_before"
	ctxAuditAfter  = "audit_after"
)

type apiError struct {
	Error string `json:"error"`
}

type pageResult struct {
	Total    int64 `json:"total"`
	Page     int   `json:"page"`
	PageSize int   `json:"page_size"`
	Items    any   `json:"items"`
}

func jsonSuccess(c *gin.Context, data any) {
	c.JSON(http.StatusOK, gin.H{"data": data})
}

func jsonCreated(c *gin.Context, data any) {
	c.JSON(http.StatusCreated, gin.H{"data": data})
}

func jsonPage(c *gin.Context, total int64, page, pageSize int, items any) {
	c.JSON(http.StatusOK, pageResult{Total: total, Page: page, PageSize: pageSize, Items: items})
}

func jsonError(c *gin.Context, status int, err error) {
	if err == nil {
		err = http.ErrAbortHandler
	}
	c.JSON(status, apiError{Error: err.Error()})
}

func getTenantID(c *gin.Context) string {
	v, _ := c.Get(ctxTenantID)
	s, _ := v.(string)
	return s
}

func getUserID(c *gin.Context) string {
	v, _ := c.Get(ctxUserID)
	s, _ := v.(string)
	return s
}
