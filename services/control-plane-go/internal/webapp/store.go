package webapp

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"sort"
	"strings"
	"sync"
	"time"
)

var (
	ErrDuplicateEmail = errors.New("email already registered")
	ErrNotFound       = errors.New("not found")
)

type User struct {
	ID           string
	Email        string
	PasswordHash string
	TenantID     string
	WorkspaceID  string
	CreatedAt    time.Time
}

type APIKeyBinding struct {
	UserID          string
	Provider        string
	BaseURL         string
	EncryptedAPIKey string
	MaskedKey       string
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

type Conversation struct {
	ID        string    `json:"conversationId"`
	UserID    string    `json:"-"`
	Title     string    `json:"title"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type ChatMessage struct {
	ID             string    `json:"messageId"`
	ConversationID string    `json:"-"`
	UserID         string    `json:"-"`
	Role           string    `json:"role"`
	Content        string    `json:"content"`
	CreatedAt      time.Time `json:"createdAt"`
}

type AuditEvent struct {
	ID        string            `json:"eventId"`
	UserID    string            `json:"-"`
	EventKind string            `json:"eventKind"`
	Metadata  map[string]string `json:"metadata"`
	CreatedAt time.Time         `json:"createdAt"`
}

type ChatQuotaStatus struct {
	Limit     int `json:"limit"`
	Used      int `json:"used"`
	Remaining int `json:"remaining"`
}

type Store interface {
	CreateUser(email string, passwordHash string) (User, error)
	FindUserByEmail(email string) (User, bool)
	FindUserByID(userID string) (User, bool)
	SaveAPIKeyBinding(APIKeyBinding) error
	GetAPIKeyBinding(userID string) (APIKeyBinding, bool)
	CreateConversation(userID string, title string) (Conversation, error)
	ListConversations(userID string) []Conversation
	GetConversation(userID string, conversationID string) (Conversation, []ChatMessage, bool)
	AddMessage(ChatMessage) error
	RecordAuditEvent(AuditEvent) error
	ListAuditEvents(userID string) []AuditEvent
	ConsumeChatQuota(userID string, limit int) (ChatQuotaStatus, bool)
	ChatQuotaStatus(userID string, limit int) ChatQuotaStatus
}

type MemoryStore struct {
	mu            sync.RWMutex
	users         map[string]User
	emailToUserID map[string]string
	apiKeys       map[string]APIKeyBinding
	conversations map[string]Conversation
	messages      map[string][]ChatMessage
	auditEvents   []AuditEvent
	chatUsage     map[string]int
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		users:         map[string]User{},
		emailToUserID: map[string]string{},
		apiKeys:       map[string]APIKeyBinding{},
		conversations: map[string]Conversation{},
		messages:      map[string][]ChatMessage{},
		auditEvents:   []AuditEvent{},
		chatUsage:     map[string]int{},
	}
}

func (store *MemoryStore) CreateUser(email string, passwordHash string) (User, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	email = normalizeEmail(email)
	if _, ok := store.emailToUserID[email]; ok {
		return User{}, ErrDuplicateEmail
	}
	user := newUser(email, passwordHash)
	store.users[user.ID] = user
	store.emailToUserID[email] = user.ID
	return user, nil
}

func (store *MemoryStore) FindUserByEmail(email string) (User, bool) {
	store.mu.RLock()
	defer store.mu.RUnlock()
	userID, ok := store.emailToUserID[normalizeEmail(email)]
	if !ok {
		return User{}, false
	}
	user, ok := store.users[userID]
	return user, ok
}

func (store *MemoryStore) FindUserByID(userID string) (User, bool) {
	store.mu.RLock()
	defer store.mu.RUnlock()
	user, ok := store.users[userID]
	return user, ok
}

func (store *MemoryStore) SaveAPIKeyBinding(binding APIKeyBinding) error {
	store.mu.Lock()
	defer store.mu.Unlock()
	now := time.Now().UTC()
	if existing, ok := store.apiKeys[binding.UserID]; ok {
		binding.CreatedAt = existing.CreatedAt
	} else {
		binding.CreatedAt = now
	}
	binding.UpdatedAt = now
	store.apiKeys[binding.UserID] = binding
	return nil
}

func (store *MemoryStore) GetAPIKeyBinding(userID string) (APIKeyBinding, bool) {
	store.mu.RLock()
	defer store.mu.RUnlock()
	binding, ok := store.apiKeys[userID]
	return binding, ok
}

func (store *MemoryStore) CreateConversation(userID string, title string) (Conversation, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	now := time.Now().UTC()
	conversation := Conversation{ID: "conv_" + randomHex(8), UserID: userID, Title: title, CreatedAt: now, UpdatedAt: now}
	store.conversations[conversation.ID] = conversation
	return conversation, nil
}

func (store *MemoryStore) ListConversations(userID string) []Conversation {
	store.mu.RLock()
	defer store.mu.RUnlock()
	conversations := []Conversation{}
	for _, conversation := range store.conversations {
		if conversation.UserID == userID {
			conversations = append(conversations, conversation)
		}
	}
	sort.Slice(conversations, func(i, j int) bool {
		return conversations[i].UpdatedAt.After(conversations[j].UpdatedAt)
	})
	return conversations
}

func (store *MemoryStore) GetConversation(userID string, conversationID string) (Conversation, []ChatMessage, bool) {
	store.mu.RLock()
	defer store.mu.RUnlock()
	conversation, ok := store.conversations[conversationID]
	if !ok || conversation.UserID != userID {
		return Conversation{}, nil, false
	}
	return conversation, append([]ChatMessage{}, store.messages[conversationID]...), true
}

func (store *MemoryStore) AddMessage(message ChatMessage) error {
	store.mu.Lock()
	defer store.mu.Unlock()
	if message.ID == "" {
		message.ID = "msg_" + randomHex(8)
	}
	if message.CreatedAt.IsZero() {
		message.CreatedAt = time.Now().UTC()
	}
	store.messages[message.ConversationID] = append(store.messages[message.ConversationID], message)
	if conversation, ok := store.conversations[message.ConversationID]; ok {
		conversation.UpdatedAt = message.CreatedAt
		store.conversations[message.ConversationID] = conversation
	}
	return nil
}

func newUser(email string, passwordHash string) User {
	id := "user_" + randomHex(8)
	return User{
		ID:           id,
		Email:        normalizeEmail(email),
		PasswordHash: passwordHash,
		TenantID:     "tenant_" + randomHex(8),
		WorkspaceID:  "workspace_" + randomHex(8),
		CreatedAt:    time.Now().UTC(),
	}
}

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func randomHex(bytes int) string {
	buffer := make([]byte, bytes)
	if _, err := rand.Read(buffer); err != nil {
		panic(err)
	}
	return hex.EncodeToString(buffer)
}
