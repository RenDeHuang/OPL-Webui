package webapp

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"
)

func (store PostgresStore) CreateConversation(userID string, title string) (Conversation, error) {
	conversation := Conversation{ID: "conv_" + randomHex(8), UserID: userID, Title: title}
	err := store.db.QueryRowContext(context.Background(), `
insert into chat_conversations (id, user_id, title)
values ($1, $2, $3)
returning created_at, updated_at
`, conversation.ID, userID, title).Scan(&conversation.CreatedAt, &conversation.UpdatedAt)
	return conversation, err
}

func (store PostgresStore) ListConversations(userID string) []Conversation {
	rows, err := store.db.QueryContext(context.Background(), `
select id, user_id, title, created_at, updated_at
from chat_conversations
where user_id = $1
order by updated_at desc
`, userID)
	if err != nil {
		return []Conversation{}
	}
	defer rows.Close()
	conversations := []Conversation{}
	for rows.Next() {
		conversation := Conversation{}
		if err := rows.Scan(&conversation.ID, &conversation.UserID, &conversation.Title, &conversation.CreatedAt, &conversation.UpdatedAt); err != nil {
			return []Conversation{}
		}
		conversations = append(conversations, conversation)
	}
	return conversations
}

func (store PostgresStore) GetConversation(userID string, conversationID string) (Conversation, []ChatMessage, bool) {
	conversation := Conversation{}
	err := store.db.QueryRowContext(context.Background(), `
select id, user_id, title, created_at, updated_at
from chat_conversations
where id = $1 and user_id = $2
`, conversationID, userID).Scan(&conversation.ID, &conversation.UserID, &conversation.Title, &conversation.CreatedAt, &conversation.UpdatedAt)
	if err != nil {
		return Conversation{}, nil, false
	}
	rows, err := store.db.QueryContext(context.Background(), `
select id, conversation_id, user_id, role, content, created_at
from chat_messages
where conversation_id = $1 and user_id = $2
order by created_at asc
`, conversationID, userID)
	if err != nil {
		return Conversation{}, nil, false
	}
	defer rows.Close()
	messages := []ChatMessage{}
	for rows.Next() {
		message := ChatMessage{}
		if err := rows.Scan(&message.ID, &message.ConversationID, &message.UserID, &message.Role, &message.Content, &message.CreatedAt); err != nil {
			return Conversation{}, nil, false
		}
		messages = append(messages, message)
	}
	return conversation, messages, true
}

func (store PostgresStore) AddMessage(message ChatMessage) error {
	if message.ID == "" {
		message.ID = "msg_" + randomHex(8)
	}
	_, err := store.db.ExecContext(context.Background(), `
insert into chat_messages (id, conversation_id, user_id, role, content)
values ($1, $2, $3, $4, $5);
update chat_conversations set updated_at = now() where id = $2 and user_id = $3;
`, message.ID, message.ConversationID, message.UserID, message.Role, message.Content)
	return err
}

func (store PostgresStore) RecordAuditEvent(event AuditEvent) error {
	if event.ID == "" {
		event.ID = "audit_" + randomHex(8)
	}
	if event.CreatedAt.IsZero() {
		event.CreatedAt = time.Now().UTC()
	}
	metadata, err := json.Marshal(sanitizeMetadata(event.Metadata))
	if err != nil {
		return err
	}
	_, err = store.db.ExecContext(context.Background(), `
insert into webapp_audit_events (id, user_id, event_kind, metadata, created_at)
values ($1, $2, $3, $4::jsonb, $5)
`, event.ID, event.UserID, event.EventKind, string(metadata), event.CreatedAt)
	return err
}

func (store PostgresStore) ListAuditEvents(userID string) []AuditEvent {
	rows, err := store.db.QueryContext(context.Background(), `
select id, user_id, event_kind, metadata, created_at
from webapp_audit_events
where user_id = $1
order by created_at asc
`, userID)
	if err != nil {
		return []AuditEvent{}
	}
	defer rows.Close()
	events := []AuditEvent{}
	for rows.Next() {
		event := AuditEvent{}
		var metadata string
		if err := rows.Scan(&event.ID, &event.UserID, &event.EventKind, &metadata, &event.CreatedAt); err != nil {
			return []AuditEvent{}
		}
		event.Metadata = map[string]string{}
		_ = json.Unmarshal([]byte(metadata), &event.Metadata)
		events = append(events, event)
	}
	return events
}

func (store PostgresStore) ConsumeChatQuota(userID string, limit int) (ChatQuotaStatus, bool) {
	period := time.Now().UTC().Format("2006-01")
	tx, err := store.db.BeginTx(context.Background(), nil)
	if err != nil {
		return quotaStatus(limit, limit), false
	}
	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback()
		}
	}()
	used := 0
	err = tx.QueryRowContext(context.Background(), `
select used_count from webapp_chat_usage
where user_id = $1 and period = $2
for update
`, userID, period).Scan(&used)
	if err == sql.ErrNoRows {
		used = 0
	} else if err != nil {
		return quotaStatus(limit, limit), false
	}
	if used >= limit {
		_ = tx.Commit()
		committed = true
		return quotaStatus(limit, used), false
	}
	used++
	if _, err := tx.ExecContext(context.Background(), `
insert into webapp_chat_usage (user_id, period, used_count)
values ($1, $2, $3)
on conflict (user_id, period) do update set used_count = $3, updated_at = now()
`, userID, period, used); err != nil {
		return quotaStatus(limit, limit), false
	}
	if err := tx.Commit(); err != nil {
		return quotaStatus(limit, limit), false
	}
	committed = true
	return quotaStatus(limit, used), true
}
