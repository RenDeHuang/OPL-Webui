package mvp

import (
	"errors"
	"strings"
	"testing"
)

func TestNewTaskStoreUsesMemoryWithoutDatabaseURL(t *testing.T) {
	store, err := NewTaskStore(TaskStoreConfig{}, func(string) (TaskProjectionStore, error) {
		t.Fatal("postgres opener should not be called without database URL")
		return nil, nil
	})
	if err != nil {
		t.Fatalf("NewTaskStore returned error: %v", err)
	}
	if _, ok := store.(*MemoryTaskStore); !ok {
		t.Fatalf("expected memory store, got %T", store)
	}
}

func TestNewTaskStoreUsesPostgresWhenDatabaseURLExists(t *testing.T) {
	called := false
	store, err := NewTaskStore(TaskStoreConfig{DatabaseURL: "postgres://example"}, func(databaseURL string) (TaskProjectionStore, error) {
		called = true
		if databaseURL != "postgres://example" {
			t.Fatalf("database URL mismatch: %s", databaseURL)
		}
		return NewMemoryTaskStore(), nil
	})
	if err != nil {
		t.Fatalf("NewTaskStore returned error: %v", err)
	}
	if !called {
		t.Fatal("expected postgres opener to be called")
	}
	if store == nil {
		t.Fatal("expected store")
	}
}

func TestConfigureDefaultTaskStoreFromEnvUsesMemoryByDefault(t *testing.T) {
	t.Setenv("OPL_DATABASE_URL", "")

	if err := ConfigureDefaultTaskStoreFromEnv(); err != nil {
		t.Fatalf("ConfigureDefaultTaskStoreFromEnv returned error: %v", err)
	}
	if _, ok := defaultTaskStore.(*MemoryTaskStore); !ok {
		t.Fatalf("expected default memory store, got %T", defaultTaskStore)
	}
}

func TestConfigureDefaultTaskStoreFromEnvUsesConfiguredPostgresStore(t *testing.T) {
	t.Setenv("OPL_DATABASE_URL", "postgres://example")
	called := false

	if err := configureDefaultTaskStoreFromEnv(func(databaseURL string) (TaskProjectionStore, error) {
		called = true
		if databaseURL != "postgres://example" {
			t.Fatalf("database URL mismatch: %s", databaseURL)
		}
		return NewMemoryTaskStore(), nil
	}); err != nil {
		t.Fatalf("configureDefaultTaskStoreFromEnv returned error: %v", err)
	}
	if !called {
		t.Fatal("expected postgres opener to be called")
	}
}

func TestConfigureDefaultTaskStoreFromEnvPropagatesPostgresOpenError(t *testing.T) {
	t.Setenv("OPL_DATABASE_URL", "postgres://example")

	if err := configureDefaultTaskStoreFromEnv(func(string) (TaskProjectionStore, error) {
		return nil, errors.New("postgres unavailable")
	}); err == nil || !strings.Contains(err.Error(), "postgres unavailable") {
		t.Fatalf("expected postgres opener error, got %v", err)
	}
}
