package storage

import (
	"context"
	"io"
	"time"
)

// StorageProvider 存储提供者接口
// 所有存储后端都必须实现这个接口
type StorageProvider interface {
	// 基础操作
	Put(ctx context.Context, key string, reader io.Reader, size int64, opts ...Option) (*ObjectInfo, error)
	Get(ctx context.Context, key string) (io.ReadCloser, *ObjectInfo, error)
	Delete(ctx context.Context, key string) error
	Stat(ctx context.Context, key string) (*ObjectInfo, error)
	List(ctx context.Context, prefix string, opts ...ListOption) ([]*ObjectInfo, error)

	// 批量操作
	DeleteBatch(ctx context.Context, keys []string) error

	// 拷贝和移动
	Copy(ctx context.Context, srcKey, dstKey string) error
	Move(ctx context.Context, srcKey, dstKey string) error

	// 预签名 URL
	PresignPut(ctx context.Context, key string, ttl time.Duration) (string, error)
	PresignGet(ctx context.Context, key string, ttl time.Duration) (string, error)

	// 存储桶操作
	CreateBucket(ctx context.Context, bucket string) error
	DeleteBucket(ctx context.Context, bucket string) error
	BucketExists(ctx context.Context, bucket string) (bool, error)

	// 类型信息
	Type() ProviderType
	Close() error
}

// ObjectInfo 对象元信息
type ObjectInfo struct {
	Key          string            `json:"key"`
	Size         int64             `json:"size"`
	ContentType  string            `json:"content_type"`
	ETag         string            `json:"etag"`
	LastModified time.Time         `json:"last_modified"`
	Metadata     map[string]string `json:"metadata"`
}

// ProviderType 存储提供者类型
type ProviderType string

const (
	ProviderTypeS3    ProviderType = "s3"
	ProviderTypeMinio ProviderType = "minio"
	ProviderTypeOSS   ProviderType = "oss"
	ProviderTypeCOS   ProviderType = "cos"
	ProviderTypeLocal ProviderType = "local"
	ProviderTypeGCS   ProviderType = "gcs"
	ProviderTypeAzure ProviderType = "azure"
)

// Option 上传选项
type Option func(*Options)

type Options struct {
	ContentType  string
	Metadata     map[string]string
	StorageClass string
}

func WithContentType(ct string) Option {
	return func(o *Options) {
		o.ContentType = ct
	}
}

func WithMetadata(m map[string]string) Option {
	return func(o *Options) {
		o.Metadata = m
	}
}

func WithStorageClass(sc string) Option {
	return func(o *Options) {
		o.StorageClass = sc
	}
}

// ListOption 列表选项
type ListOption func(*ListOptions)

type ListOptions struct {
	MaxKeys   int
	Delimiter string
	Marker    string
	Recursive bool
}

func WithMaxKeys(max int) ListOption {
	return func(o *ListOptions) {
		o.MaxKeys = max
	}
}

func WithDelimiter(d string) ListOption {
	return func(o *ListOptions) {
		o.Delimiter = d
	}
}

func WithMarker(m string) ListOption {
	return func(o *ListOptions) {
		o.Marker = m
	}
}

func WithRecursive(r bool) ListOption {
	return func(o *ListOptions) {
		o.Recursive = r
	}
}

// StorageError 存储错误
type StorageError struct {
	Code    string
	Message string
	Cause   error
}

func (e *StorageError) Error() string {
	if e.Cause != nil {
		return e.Code + ": " + e.Message + " - " + e.Cause.Error()
	}
	return e.Code + ": " + e.Message
}

func (e *StorageError) Unwrap() error {
	return e.Cause
}

// 常见错误码
const (
	ErrCodeNotFound       = "NotFound"
	ErrCodeAlreadyExists  = "AlreadyExists"
	ErrCodeAccessDenied   = "AccessDenied"
	ErrCodeInvalidRequest = "InvalidRequest"
	ErrCodeInternalError  = "InternalError"
)

func NewNotFoundError(key string, cause error) *StorageError {
	return &StorageError{
		Code:    ErrCodeNotFound,
		Message: "object not found: " + key,
		Cause:   cause,
	}
}

func NewAlreadyExistsError(key string, cause error) *StorageError {
	return &StorageError{
		Code:    ErrCodeAlreadyExists,
		Message: "object already exists: " + key,
		Cause:   cause,
	}
}

func NewAccessDeniedError(key string, cause error) *StorageError {
	return &StorageError{
		Code:    ErrCodeAccessDenied,
		Message: "access denied: " + key,
		Cause:   cause,
	}
}

func NewInternalError(message string, cause error) *StorageError {
	return &StorageError{
		Code:    ErrCodeInternalError,
		Message: message,
		Cause:   cause,
	}
}
