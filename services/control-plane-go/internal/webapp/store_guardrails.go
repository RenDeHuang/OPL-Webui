package webapp

import (
	"sort"
	"strings"
	"time"
)

func (store *MemoryStore) RecordAuditEvent(event AuditEvent) error {
	store.mu.Lock()
	defer store.mu.Unlock()
	if event.ID == "" {
		event.ID = "audit_" + randomHex(8)
	}
	if event.CreatedAt.IsZero() {
		event.CreatedAt = time.Now().UTC()
	}
	event.Metadata = sanitizeMetadata(event.Metadata)
	store.auditEvents = append(store.auditEvents, event)
	return nil
}

func (store *MemoryStore) RecordOperatorAuditEvent(event OperatorAuditEvent) error {
	store.mu.Lock()
	defer store.mu.Unlock()
	if event.ID == "" {
		event.ID = "opsaudit_" + randomHex(8)
	}
	if event.CreatedAt.IsZero() {
		event.CreatedAt = time.Now().UTC()
	}
	event.Metadata = sanitizeMetadata(event.Metadata)
	store.operatorAuditEvents = append(store.operatorAuditEvents, event)
	return nil
}

func (store *MemoryStore) ListAuditEvents(userID string) []AuditEvent {
	store.mu.RLock()
	defer store.mu.RUnlock()
	events := []AuditEvent{}
	for _, event := range store.auditEvents {
		if event.UserID == userID {
			events = append(events, event)
		}
	}
	sort.Slice(events, func(i, j int) bool {
		return events[i].CreatedAt.Before(events[j].CreatedAt)
	})
	return events
}

func (store *MemoryStore) ConsumeChatQuota(userID string, limit int) (ChatQuotaStatus, bool) {
	store.mu.Lock()
	defer store.mu.Unlock()
	key := quotaKey(userID, time.Now().UTC())
	used := store.chatUsage[key]
	if used >= limit {
		return quotaStatus(limit, used), false
	}
	used++
	store.chatUsage[key] = used
	return quotaStatus(limit, used), true
}

func (store *MemoryStore) ChatQuotaStatus(userID string, limit int) ChatQuotaStatus {
	store.mu.RLock()
	defer store.mu.RUnlock()
	return quotaStatus(limit, store.chatUsage[quotaKey(userID, time.Now().UTC())])
}

func quotaKey(userID string, now time.Time) string {
	return userID + ":" + now.Format("2006-01")
}

func quotaStatus(limit int, used int) ChatQuotaStatus {
	remaining := limit - used
	if remaining < 0 {
		remaining = 0
	}
	return ChatQuotaStatus{Limit: limit, Used: used, Remaining: remaining}
}

func sanitizeMetadata(metadata map[string]string) map[string]string {
	clean := map[string]string{}
	for key, value := range metadata {
		if isSensitiveMetadataKey(key) {
			continue
		}
		clean[key] = value
	}
	return clean
}

func isSensitiveMetadataKey(key string) bool {
	normalized := strings.ToLower(key)
	return strings.Contains(normalized, "password") ||
		strings.Contains(normalized, "secret") ||
		strings.Contains(normalized, "api_key") ||
		strings.Contains(normalized, "apikey") ||
		strings.Contains(normalized, "token") ||
		strings.Contains(normalized, "database")
}
