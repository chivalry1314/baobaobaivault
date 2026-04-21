package storage

import (
	"context"
	"fmt"
	"sync"

	"github.com/baobaobao/baobaobaivault/internal/model"
)

// Registry keeps provider instances keyed by storage config id.
type Registry struct {
	mu        sync.RWMutex
	providers map[string]StorageProvider
	configs   map[string]*model.StorageConfig
}

func NewRegistry() *Registry {
	return &Registry{
		providers: make(map[string]StorageProvider),
		configs:   make(map[string]*model.StorageConfig),
	}
}

func (r *Registry) Register(id string, provider StorageProvider, cfg *model.StorageConfig) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if old, exists := r.providers[id]; exists {
		_ = old.Close()
	}

	r.providers[id] = provider
	r.configs[id] = cfg
}

func (r *Registry) Unregister(id string) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if provider, exists := r.providers[id]; exists {
		_ = provider.Close()
		delete(r.providers, id)
	}
	delete(r.configs, id)
}

func (r *Registry) Get(id string) (StorageProvider, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	provider, exists := r.providers[id]
	return provider, exists
}

func (r *Registry) GetConfig(id string) (*model.StorageConfig, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	cfg, exists := r.configs[id]
	return cfg, exists
}

func (r *Registry) GetDefault() (StorageProvider, *model.StorageConfig, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for id, cfg := range r.configs {
		if cfg.IsDefault {
			if provider, ok := r.providers[id]; ok {
				return provider, cfg, nil
			}
		}
	}
	return nil, nil, fmt.Errorf("no default storage provider found")
}

func (r *Registry) List() []*model.StorageConfig {
	r.mu.RLock()
	defer r.mu.RUnlock()

	configs := make([]*model.StorageConfig, 0, len(r.configs))
	for _, cfg := range r.configs {
		configs = append(configs, cfg)
	}
	return configs
}

func (r *Registry) Close() error {
	r.mu.Lock()
	defer r.mu.Unlock()

	var lastErr error
	for id, provider := range r.providers {
		if err := provider.Close(); err != nil {
			lastErr = err
		}
		delete(r.providers, id)
	}
	r.configs = make(map[string]*model.StorageConfig)
	return lastErr
}

// ProviderFactory creates provider implementations from storage config.
type ProviderFactory struct {
	registry *Registry
}

func NewProviderFactory(registry *Registry) *ProviderFactory {
	return &ProviderFactory{registry: registry}
}

func (f *ProviderFactory) CreateProvider(ctx context.Context, cfg *model.StorageConfig) (StorageProvider, error) {
	switch cfg.Provider {
	case model.ProviderS3, model.ProviderMinio, model.ProviderOSS, model.ProviderCOS:
		return NewS3Provider(ctx, &S3Config{
			Endpoint:     cfg.Endpoint,
			Region:       cfg.Region,
			AccessKey:    cfg.AccessKey,
			SecretKey:    cfg.SecretKey,
			Bucket:       cfg.Bucket,
			PathStyle:    cfg.PathStyle,
			ProviderType: ProviderType(cfg.Provider),
		})
	case model.ProviderLocal:
		return NewLocalProvider(cfg.Bucket)
	default:
		return nil, fmt.Errorf("unsupported storage provider: %s", cfg.Provider)
	}
}

func (f *ProviderFactory) CreateAndRegister(ctx context.Context, cfg *model.StorageConfig) error {
	provider, err := f.CreateProvider(ctx, cfg)
	if err != nil {
		return err
	}
	f.registry.Register(cfg.ID, provider, cfg)
	return nil
}
