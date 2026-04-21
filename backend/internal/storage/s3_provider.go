package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/url"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/aws/smithy-go"
)

// S3Provider supports AWS S3 and S3-compatible providers.
type S3Provider struct {
	client        *s3.Client
	presignClient *s3.PresignClient
	bucket        string
	providerType  ProviderType
}

type S3Config struct {
	Endpoint     string
	Region       string
	AccessKey    string
	SecretKey    string
	Bucket       string
	PathStyle    bool
	ProviderType ProviderType
}

func NewS3Provider(ctx context.Context, cfg *S3Config) (*S3Provider, error) {
	awsCfg, err := config.LoadDefaultConfig(ctx,
		config.WithRegion(cfg.Region),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(cfg.AccessKey, cfg.SecretKey, "")),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to load aws config: %w", err)
	}

	client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		if cfg.Endpoint != "" {
			o.BaseEndpoint = aws.String(cfg.Endpoint)
		}
		o.UsePathStyle = cfg.PathStyle
	})

	providerType := cfg.ProviderType
	if providerType == "" {
		providerType = ProviderTypeS3
	}

	return &S3Provider{
		client:        client,
		presignClient: s3.NewPresignClient(client),
		bucket:        cfg.Bucket,
		providerType:  providerType,
	}, nil
}

func (p *S3Provider) Put(ctx context.Context, key string, reader io.Reader, size int64, opts ...Option) (*ObjectInfo, error) {
	options := &Options{}
	for _, opt := range opts {
		opt(options)
	}

	contentType := options.ContentType
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	input := &s3.PutObjectInput{
		Bucket:      aws.String(p.bucket),
		Key:         aws.String(key),
		Body:        reader,
		ContentType: aws.String(contentType),
	}
	if options.Metadata != nil {
		input.Metadata = options.Metadata
	}
	if options.StorageClass != "" {
		input.StorageClass = types.StorageClass(options.StorageClass)
	}

	output, err := p.client.PutObject(ctx, input)
	if err != nil {
		return nil, NewInternalError("failed to put object", err)
	}

	return &ObjectInfo{
		Key:          key,
		Size:         size,
		ContentType:  contentType,
		ETag:         aws.ToString(output.ETag),
		LastModified: time.Now(),
		Metadata:     options.Metadata,
	}, nil
}

func (p *S3Provider) Get(ctx context.Context, key string) (io.ReadCloser, *ObjectInfo, error) {
	output, err := p.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(p.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		if isNotFoundErr(err) {
			return nil, nil, NewNotFoundError(key, err)
		}
		return nil, nil, NewInternalError("failed to get object", err)
	}

	info := &ObjectInfo{
		Key:          key,
		Size:         aws.ToInt64(output.ContentLength),
		ContentType:  aws.ToString(output.ContentType),
		ETag:         aws.ToString(output.ETag),
		LastModified: aws.ToTime(output.LastModified),
		Metadata:     output.Metadata,
	}
	return output.Body, info, nil
}

func (p *S3Provider) Delete(ctx context.Context, key string) error {
	_, err := p.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(p.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return NewInternalError("failed to delete object", err)
	}
	return nil
}

func (p *S3Provider) Stat(ctx context.Context, key string) (*ObjectInfo, error) {
	output, err := p.client.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: aws.String(p.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		if isNotFoundErr(err) {
			return nil, NewNotFoundError(key, err)
		}
		return nil, NewInternalError("failed to stat object", err)
	}

	return &ObjectInfo{
		Key:          key,
		Size:         aws.ToInt64(output.ContentLength),
		ContentType:  aws.ToString(output.ContentType),
		ETag:         aws.ToString(output.ETag),
		LastModified: aws.ToTime(output.LastModified),
		Metadata:     output.Metadata,
	}, nil
}

func (p *S3Provider) List(ctx context.Context, prefix string, opts ...ListOption) ([]*ObjectInfo, error) {
	options := &ListOptions{MaxKeys: 1000, Recursive: true}
	for _, opt := range opts {
		opt(options)
	}

	input := &s3.ListObjectsV2Input{
		Bucket:  aws.String(p.bucket),
		Prefix:  aws.String(prefix),
		MaxKeys: aws.Int32(int32(options.MaxKeys)),
	}
	if options.Delimiter != "" {
		input.Delimiter = aws.String(options.Delimiter)
	}
	if options.Marker != "" {
		input.ContinuationToken = aws.String(options.Marker)
	}

	output, err := p.client.ListObjectsV2(ctx, input)
	if err != nil {
		return nil, NewInternalError("failed to list objects", err)
	}

	objects := make([]*ObjectInfo, 0, len(output.Contents))
	for _, obj := range output.Contents {
		objects = append(objects, &ObjectInfo{
			Key:          aws.ToString(obj.Key),
			Size:         aws.ToInt64(obj.Size),
			ETag:         aws.ToString(obj.ETag),
			LastModified: aws.ToTime(obj.LastModified),
		})
	}
	return objects, nil
}

func (p *S3Provider) DeleteBatch(ctx context.Context, keys []string) error {
	objects := make([]types.ObjectIdentifier, 0, len(keys))
	for _, key := range keys {
		objects = append(objects, types.ObjectIdentifier{Key: aws.String(key)})
	}

	_, err := p.client.DeleteObjects(ctx, &s3.DeleteObjectsInput{
		Bucket: aws.String(p.bucket),
		Delete: &types.Delete{Objects: objects, Quiet: aws.Bool(true)},
	})
	if err != nil {
		return NewInternalError("failed to delete objects batch", err)
	}
	return nil
}

func (p *S3Provider) Copy(ctx context.Context, srcKey, dstKey string) error {
	copySource := url.QueryEscape(p.bucket + "/" + srcKey)
	_, err := p.client.CopyObject(ctx, &s3.CopyObjectInput{
		Bucket:     aws.String(p.bucket),
		Key:        aws.String(dstKey),
		CopySource: aws.String(copySource),
	})
	if err != nil {
		return NewInternalError("failed to copy object", err)
	}
	return nil
}

func (p *S3Provider) Move(ctx context.Context, srcKey, dstKey string) error {
	if err := p.Copy(ctx, srcKey, dstKey); err != nil {
		return err
	}
	return p.Delete(ctx, srcKey)
}

func (p *S3Provider) PresignPut(ctx context.Context, key string, ttl time.Duration) (string, error) {
	presignResult, err := p.presignClient.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket: aws.String(p.bucket),
		Key:    aws.String(key),
	}, func(opts *s3.PresignOptions) {
		opts.Expires = ttl
	})
	if err != nil {
		return "", NewInternalError("failed to presign put url", err)
	}
	return presignResult.URL, nil
}

func (p *S3Provider) PresignGet(ctx context.Context, key string, ttl time.Duration) (string, error) {
	presignResult, err := p.presignClient.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(p.bucket),
		Key:    aws.String(key),
	}, func(opts *s3.PresignOptions) {
		opts.Expires = ttl
	})
	if err != nil {
		return "", NewInternalError("failed to presign get url", err)
	}
	return presignResult.URL, nil
}

func (p *S3Provider) CreateBucket(ctx context.Context, bucket string) error {
	_, err := p.client.CreateBucket(ctx, &s3.CreateBucketInput{Bucket: aws.String(bucket)})
	if err != nil {
		return NewInternalError("failed to create bucket", err)
	}
	return nil
}

func (p *S3Provider) DeleteBucket(ctx context.Context, bucket string) error {
	_, err := p.client.DeleteBucket(ctx, &s3.DeleteBucketInput{Bucket: aws.String(bucket)})
	if err != nil {
		return NewInternalError("failed to delete bucket", err)
	}
	return nil
}

func (p *S3Provider) BucketExists(ctx context.Context, bucket string) (bool, error) {
	_, err := p.client.HeadBucket(ctx, &s3.HeadBucketInput{Bucket: aws.String(bucket)})
	if err != nil {
		if isNotFoundErr(err) {
			return false, nil
		}
		return false, NewInternalError("failed to check bucket exists", err)
	}
	return true, nil
}

func (p *S3Provider) Type() ProviderType {
	return p.providerType
}

func (p *S3Provider) Close() error {
	return nil
}

func isNotFoundErr(err error) bool {
	var apiErr smithy.APIError
	if errors.As(err, &apiErr) {
		switch apiErr.ErrorCode() {
		case "NoSuchKey", "NotFound", "404", "NoSuchBucket":
			return true
		}
	}
	return false
}
