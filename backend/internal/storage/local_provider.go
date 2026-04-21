package storage

import (
	"context"
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// LocalProvider 本地文件系统存储提供者
// 用于开发测试或小规模部署
type LocalProvider struct {
	baseDir string
	metaDir string // 元数据目录
}

// NewLocalProvider 创建本地存储提供者
func NewLocalProvider(baseDir string) (*LocalProvider, error) {
	// 确保目录存在
	if err := os.MkdirAll(baseDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create base directory: %w", err)
	}

	metaDir := filepath.Join(baseDir, ".meta")
	if err := os.MkdirAll(metaDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create meta directory: %w", err)
	}

	return &LocalProvider{
		baseDir: baseDir,
		metaDir: metaDir,
	}, nil
}

// Put 上传对象
func (p *LocalProvider) Put(ctx context.Context, key string, reader io.Reader, size int64, opts ...Option) (*ObjectInfo, error) {
	options := &Options{}
	for _, opt := range opts {
		opt(options)
	}

	// 安全检查：防止路径穿越
	if strings.Contains(key, "..") {
		return nil, NewAccessDeniedError(key, fmt.Errorf("invalid key: path traversal detected"))
	}

	// 构建完整路径
	fullPath := filepath.Join(p.baseDir, key)
	dir := filepath.Dir(fullPath)

	// 确保目录存在
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, NewInternalError("failed to create directory", err)
	}

	// 创建临时文件
	tmpFile := fullPath + ".tmp"
	f, err := os.Create(tmpFile)
	if err != nil {
		return nil, NewInternalError("failed to create file", err)
	}
	defer f.Close()

	// 写入内容并计算 MD5
	hash := md5.New()
	multiWriter := io.MultiWriter(f, hash)
	written, err := io.Copy(multiWriter, reader)
	if err != nil {
		os.Remove(tmpFile)
		return nil, NewInternalError("failed to write file", err)
	}

	// 重命名临时文件
	if err := os.Rename(tmpFile, fullPath); err != nil {
		os.Remove(tmpFile)
		return nil, NewInternalError("failed to rename file", err)
	}

	// 计算ETag
	etag := hex.EncodeToString(hash.Sum(nil))

	// 保存元数据
	contentType := options.ContentType
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	meta := &objectMeta{
		ContentType:  contentType,
		ETag:         etag,
		LastModified: time.Now(),
		Size:         written,
		Metadata:     options.Metadata,
	}

	if err := p.saveMeta(key, meta); err != nil {
		return nil, err
	}

	return &ObjectInfo{
		Key:          key,
		Size:         written,
		ContentType:  contentType,
		ETag:         etag,
		LastModified: meta.LastModified,
		Metadata:     options.Metadata,
	}, nil
}

// Get 获取对象
func (p *LocalProvider) Get(ctx context.Context, key string) (io.ReadCloser, *ObjectInfo, error) {
	if strings.Contains(key, "..") {
		return nil, nil, NewAccessDeniedError(key, fmt.Errorf("invalid key: path traversal detected"))
	}

	fullPath := filepath.Join(p.baseDir, key)

	f, err := os.Open(fullPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil, NewNotFoundError(key, err)
		}
		return nil, nil, NewInternalError("failed to open file", err)
	}

	info, err := p.Stat(ctx, key)
	if err != nil {
		f.Close()
		return nil, nil, err
	}

	return f, info, nil
}

// Delete 删除对象
func (p *LocalProvider) Delete(ctx context.Context, key string) error {
	if strings.Contains(key, "..") {
		return NewAccessDeniedError(key, fmt.Errorf("invalid key: path traversal detected"))
	}

	fullPath := filepath.Join(p.baseDir, key)

	if err := os.Remove(fullPath); err != nil {
		if os.IsNotExist(err) {
			return nil // 已删除
		}
		return NewInternalError("failed to delete file", err)
	}

	// 删除元数据
	metaPath := p.metaPath(key)
	os.Remove(metaPath)

	return nil
}

// Stat 获取对象信息
func (p *LocalProvider) Stat(ctx context.Context, key string) (*ObjectInfo, error) {
	if strings.Contains(key, "..") {
		return nil, NewAccessDeniedError(key, fmt.Errorf("invalid key: path traversal detected"))
	}

	meta, err := p.loadMeta(key)
	if err != nil {
		return nil, err
	}

	fullPath := filepath.Join(p.baseDir, key)
	stat, err := os.Stat(fullPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, NewNotFoundError(key, err)
		}
		return nil, NewInternalError("failed to stat file", err)
	}

	return &ObjectInfo{
		Key:          key,
		Size:         stat.Size(),
		ContentType:  meta.ContentType,
		ETag:         meta.ETag,
		LastModified: stat.ModTime(),
		Metadata:     meta.Metadata,
	}, nil
}

// List 列出对象
func (p *LocalProvider) List(ctx context.Context, prefix string, opts ...ListOption) ([]*ObjectInfo, error) {
	options := &ListOptions{
		MaxKeys:   1000,
		Recursive: true,
	}
	for _, opt := range opts {
		opt(options)
	}

	var objects []*ObjectInfo

	searchDir := p.baseDir
	if prefix != "" {
		searchDir = filepath.Join(p.baseDir, prefix)
	}

	err := filepath.Walk(searchDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// 跳过目录和元数据目录
		if info.IsDir() || strings.Contains(path, ".meta") {
			return nil
		}

		// 计算相对路径
		relPath, err := filepath.Rel(p.baseDir, path)
		if err != nil {
			return err
		}

		// 转换为 Unix 风格路径
		relPath = filepath.ToSlash(relPath)

		objInfo, err := p.Stat(ctx, relPath)
		if err != nil {
			return nil // 跳过无法获取信息的文件
		}

		objects = append(objects, objInfo)

		if len(objects) >= options.MaxKeys {
			return io.EOF
		}

		return nil
	})

	if err != nil && err != io.EOF {
		return nil, NewInternalError("failed to list files", err)
	}

	return objects, nil
}

// DeleteBatch 批量删除
func (p *LocalProvider) DeleteBatch(ctx context.Context, keys []string) error {
	for _, key := range keys {
		if err := p.Delete(ctx, key); err != nil {
			return err
		}
	}
	return nil
}

// Copy 拷贝对象
func (p *LocalProvider) Copy(ctx context.Context, srcKey, dstKey string) error {
	if strings.Contains(srcKey, "..") || strings.Contains(dstKey, "..") {
		return NewAccessDeniedError(srcKey, fmt.Errorf("invalid key: path traversal detected"))
	}

	srcPath := filepath.Join(p.baseDir, srcKey)
	dstPath := filepath.Join(p.baseDir, dstKey)

	// 确保目标目录存在
	if err := os.MkdirAll(filepath.Dir(dstPath), 0755); err != nil {
		return NewInternalError("failed to create directory", err)
	}

	// 拷贝文件
	src, err := os.Open(srcPath)
	if err != nil {
		return NewInternalError("failed to open source file", err)
	}
	defer src.Close()

	dst, err := os.Create(dstPath)
	if err != nil {
		return NewInternalError("failed to create destination file", err)
	}
	defer dst.Close()

	if _, err := io.Copy(dst, src); err != nil {
		return NewInternalError("failed to copy file", err)
	}

	// 拷贝元数据
	srcMeta, err := p.loadMeta(srcKey)
	if err != nil {
		return err
	}
	if err := p.saveMeta(dstKey, srcMeta); err != nil {
		return err
	}

	return nil
}

// Move 移动对象
func (p *LocalProvider) Move(ctx context.Context, srcKey, dstKey string) error {
	if err := p.Copy(ctx, srcKey, dstKey); err != nil {
		return err
	}
	return p.Delete(ctx, srcKey)
}

// PresignPut 生成上传预签名 URL（本地存储不支持）
func (p *LocalProvider) PresignPut(ctx context.Context, key string, ttl time.Duration) (string, error) {
	return "", NewInternalError("presign not supported for local storage", nil)
}

// PresignGet 生成下载预签名 URL（本地存储不支持）
func (p *LocalProvider) PresignGet(ctx context.Context, key string, ttl time.Duration) (string, error) {
	return "", NewInternalError("presign not supported for local storage", nil)
}

// CreateBucket 创建存储桶（本地存储不支持）
func (p *LocalProvider) CreateBucket(ctx context.Context, bucket string) error {
	bucketPath := filepath.Join(p.baseDir, bucket)
	return os.MkdirAll(bucketPath, 0755)
}

// DeleteBucket 删除存储桶
func (p *LocalProvider) DeleteBucket(ctx context.Context, bucket string) error {
	bucketPath := filepath.Join(p.baseDir, bucket)
	return os.RemoveAll(bucketPath)
}

// BucketExists 检查存储桶是否存在
func (p *LocalProvider) BucketExists(ctx context.Context, bucket string) (bool, error) {
	bucketPath := filepath.Join(p.baseDir, bucket)
	_, err := os.Stat(bucketPath)
	if err != nil {
		if os.IsNotExist(err) {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

// Type 返回提供者类型
func (p *LocalProvider) Type() ProviderType {
	return ProviderTypeLocal
}

// Close 关闭提供者
func (p *LocalProvider) Close() error {
	return nil
}

// objectMeta 对象元数据
type objectMeta struct {
	ContentType  string            `json:"content_type"`
	ETag         string            `json:"etag"`
	LastModified time.Time         `json:"last_modified"`
	Size         int64             `json:"size"`
	Metadata     map[string]string `json:"metadata,omitempty"`
}

// metaPath 获取元数据文件路径
func (p *LocalProvider) metaPath(key string) string {
	return filepath.Join(p.metaDir, key+".json")
}

// saveMeta 保存元数据
func (p *LocalProvider) saveMeta(key string, meta *objectMeta) error {
	metaPath := p.metaPath(key)
	if err := os.MkdirAll(filepath.Dir(metaPath), 0755); err != nil {
		return NewInternalError("failed to create meta directory", err)
	}

	data, err := json.Marshal(meta)
	if err != nil {
		return NewInternalError("failed to marshal metadata", err)
	}

	if err := os.WriteFile(metaPath, data, 0644); err != nil {
		return NewInternalError("failed to write metadata", err)
	}

	return nil
}

// loadMeta 加载元数据
func (p *LocalProvider) loadMeta(key string) (*objectMeta, error) {
	metaPath := p.metaPath(key)

	data, err := os.ReadFile(metaPath)
	if err != nil {
		if os.IsNotExist(err) {
			// 返回默认元数据
			return &objectMeta{
				ContentType:  "application/octet-stream",
				LastModified: time.Now(),
			}, nil
		}
		return nil, NewInternalError("failed to read metadata", err)
	}

	var meta objectMeta
	if err := json.Unmarshal(data, &meta); err != nil {
		return nil, NewInternalError("failed to unmarshal metadata", err)
	}

	return &meta, nil
}
