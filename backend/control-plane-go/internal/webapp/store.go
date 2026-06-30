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

const (
	RegistrationModeOpen = "open"

	UserStatusActive   = "active"
	UserStatusDisabled = "disabled"
)

type User struct {
	ID           string
	Email        string
	PasswordHash string
	TenantID     string
	WorkspaceID  string
	Status       string
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

type TaskRef struct {
	Ref    string `json:"ref"`
	Label  string `json:"label,omitempty"`
	Status string `json:"status,omitempty"`
	Kind   string `json:"kind,omitempty"`
	Source string `json:"source,omitempty"`
}

type TaskNextAction struct {
	ID       string `json:"id"`
	Label    string `json:"label"`
	DeepLink string `json:"deepLink"`
}

type TaskBlocker struct {
	Kind       string `json:"kind"`
	Title      string `json:"title"`
	NextAction string `json:"nextAction,omitempty"`
	DeepLink   string `json:"deepLink"`
}

type TaskHistoryItem struct {
	ID                 string           `json:"taskId"`
	UserID             string           `json:"-"`
	ConversationID     string           `json:"conversationId,omitempty"`
	TaskType           string           `json:"taskType"`
	TaskIntent         string           `json:"taskIntent"`
	Marker             string           `json:"marker"`
	Status             string           `json:"status"`
	ProgressRefs       []TaskRef        `json:"progressRefs"`
	DeliverableRefs    []TaskRef        `json:"deliverableRefs"`
	MaterialRefs       []TaskRef        `json:"materialRefs"`
	Blocker            *TaskBlocker     `json:"blocker,omitempty"`
	NextStep           string           `json:"nextStep"`
	AllowedNextActions []TaskNextAction `json:"allowedNextActions"`
	DeepLink           string           `json:"deeplink"`
	CreatedAt          time.Time        `json:"createdAt"`
	UpdatedAt          time.Time        `json:"updatedAt"`
	WebuiArtifactBody  string           `json:"webuiArtifactBody"`
	WebuiStorageTruth  string           `json:"webuiStorageTruth"`
}

type AuditEvent struct {
	ID        string            `json:"eventId"`
	UserID    string            `json:"-"`
	EventKind string            `json:"eventKind"`
	Metadata  map[string]string `json:"metadata"`
	CreatedAt time.Time         `json:"createdAt"`
}

type OperatorAuditEvent struct {
	ID        string
	EventKind string
	Metadata  map[string]string
	CreatedAt time.Time
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
	ListUsers() []User
	SetUserStatus(userID string, status string) (User, error)
	RegistrationMode() string
	SetRegistrationMode(mode string) error
	SaveAPIKeyBinding(APIKeyBinding) error
	GetAPIKeyBinding(userID string) (APIKeyBinding, bool)
	CreateConversation(userID string, title string) (Conversation, error)
	UpdateConversationTitle(userID string, conversationID string, title string) (Conversation, error)
	ListConversations(userID string) []Conversation
	GetConversation(userID string, conversationID string) (Conversation, []ChatMessage, bool)
	AddMessage(ChatMessage) error
	UpsertTaskHistory(TaskHistoryItem) (TaskHistoryItem, error)
	ListTaskHistory(userID string) []TaskHistoryItem
	GetTaskHistory(userID string, taskID string) (TaskHistoryItem, bool)
	RecordAuditEvent(AuditEvent) error
	RecordOperatorAuditEvent(OperatorAuditEvent) error
	ListAuditEvents(userID string) []AuditEvent
	ConsumeChatQuota(userID string, limit int) (ChatQuotaStatus, bool)
	ChatQuotaStatus(userID string, limit int) ChatQuotaStatus
}

type MemoryStore struct {
	mu                  sync.RWMutex
	users               map[string]User
	emailToUserID       map[string]string
	apiKeys             map[string]APIKeyBinding
	conversations       map[string]Conversation
	messages            map[string][]ChatMessage
	taskHistory         map[string]TaskHistoryItem
	auditEvents         []AuditEvent
	operatorAuditEvents []OperatorAuditEvent
	chatUsage           map[string]int
	registrationMode    string
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		users:               map[string]User{},
		emailToUserID:       map[string]string{},
		apiKeys:             map[string]APIKeyBinding{},
		conversations:       map[string]Conversation{},
		messages:            map[string][]ChatMessage{},
		taskHistory:         map[string]TaskHistoryItem{},
		auditEvents:         []AuditEvent{},
		operatorAuditEvents: []OperatorAuditEvent{},
		chatUsage:           map[string]int{},
		registrationMode:    RegistrationModeOpen,
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

func (store *MemoryStore) ListUsers() []User {
	store.mu.RLock()
	defer store.mu.RUnlock()
	users := []User{}
	for _, user := range store.users {
		users = append(users, user)
	}
	sort.Slice(users, func(i, j int) bool {
		return users[i].CreatedAt.Before(users[j].CreatedAt)
	})
	return users
}

func (store *MemoryStore) SetUserStatus(userID string, status string) (User, error) {
	if !validUserStatus(status) {
		return User{}, ErrNotFound
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	user, ok := store.users[userID]
	if !ok {
		return User{}, ErrNotFound
	}
	user.Status = status
	store.users[userID] = user
	return user, nil
}

func (store *MemoryStore) RegistrationMode() string {
	store.mu.RLock()
	defer store.mu.RUnlock()
	if !validRegistrationMode(store.registrationMode) {
		return RegistrationModeOpen
	}
	return store.registrationMode
}

func (store *MemoryStore) SetRegistrationMode(mode string) error {
	if !validRegistrationMode(mode) {
		return ErrNotFound
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	store.registrationMode = mode
	return nil
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

func (store *MemoryStore) UpdateConversationTitle(userID string, conversationID string, title string) (Conversation, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	conversation, ok := store.conversations[conversationID]
	if !ok || conversation.UserID != userID {
		return Conversation{}, ErrNotFound
	}
	conversation.Title = title
	conversation.UpdatedAt = time.Now().UTC()
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

func (store *MemoryStore) UpsertTaskHistory(item TaskHistoryItem) (TaskHistoryItem, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	now := time.Now().UTC()
	if item.ID == "" {
		item.ID = "task_" + randomHex(8)
	}
	if existing, ok := store.taskHistory[item.ID]; ok {
		item.CreatedAt = existing.CreatedAt
	} else if item.CreatedAt.IsZero() {
		item.CreatedAt = now
	}
	item.UpdatedAt = now
	item.WebuiArtifactBody = "forbidden"
	item.WebuiStorageTruth = "forbidden"
	store.taskHistory[item.ID] = item
	return item, nil
}

func (store *MemoryStore) ListTaskHistory(userID string) []TaskHistoryItem {
	store.mu.RLock()
	defer store.mu.RUnlock()
	items := []TaskHistoryItem{}
	for _, item := range store.taskHistory {
		if item.UserID == userID {
			items = append(items, item)
		}
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].UpdatedAt.After(items[j].UpdatedAt)
	})
	return items
}

func (store *MemoryStore) GetTaskHistory(userID string, taskID string) (TaskHistoryItem, bool) {
	store.mu.RLock()
	defer store.mu.RUnlock()
	item, ok := store.taskHistory[taskID]
	if !ok || item.UserID != userID {
		return TaskHistoryItem{}, false
	}
	return item, true
}

func newUser(email string, passwordHash string) User {
	id := "user_" + randomHex(8)
	return User{
		ID:           id,
		Email:        normalizeEmail(email),
		PasswordHash: passwordHash,
		TenantID:     "tenant_" + randomHex(8),
		WorkspaceID:  "workspace_" + randomHex(8),
		Status:       UserStatusActive,
		CreatedAt:    time.Now().UTC(),
	}
}

func validRegistrationMode(mode string) bool {
	return mode == RegistrationModeOpen
}

func validUserStatus(status string) bool {
	switch status {
	case UserStatusActive, UserStatusDisabled:
		return true
	default:
		return false
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
