package api

import "time"

const (
	shareSessionCookieName     = "share_external_session"
	shareSessionTTL            = 30 * 24 * time.Hour
	shareFallbackMaxUploadSize = int64(10 * 1024 * 1024 * 1024)
	ctxShareUser               = "share_user"
)
