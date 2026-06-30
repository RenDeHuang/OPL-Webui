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

func (store PostgresStore) UpdateConversationTitle(userID string, conversationID string, title string) (Conversation, error) {
	conversation := Conversation{}
	err := store.db.QueryRowContext(context.Background(), `
update chat_conversations
set title = $3, updated_at = now()
where id = $1 and user_id = $2
returning id, user_id, title, created_at, updated_at
`, conversationID, userID, title).Scan(&conversation.ID, &conversation.UserID, &conversation.Title, &conversation.CreatedAt, &conversation.UpdatedAt)
	if err != nil {
		return Conversation{}, err
	}
	return conversation, nil
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

func (store PostgresStore) UpsertTaskHistory(item TaskHistoryItem) (TaskHistoryItem, error) {
	if item.ID == "" {
		item.ID = "task_" + randomHex(8)
	}
	item.WebuiArtifactBody = "forbidden"
	item.WebuiStorageTruth = "forbidden"
	progressRefs, err := json.Marshal(item.ProgressRefs)
	if err != nil {
		return TaskHistoryItem{}, err
	}
	deliverableRefs, err := json.Marshal(item.DeliverableRefs)
	if err != nil {
		return TaskHistoryItem{}, err
	}
	materialRefs, err := json.Marshal(item.MaterialRefs)
	if err != nil {
		return TaskHistoryItem{}, err
	}
	blocker, err := json.Marshal(item.Blocker)
	if err != nil {
		return TaskHistoryItem{}, err
	}
	allowedNextActions, err := json.Marshal(item.AllowedNextActions)
	if err != nil {
		return TaskHistoryItem{}, err
	}
	err = store.db.QueryRowContext(context.Background(), `
insert into webapp_task_history (
  id, user_id, conversation_id, task_type, task_intent, marker, status,
  progress_refs, deliverable_refs, material_refs, blocker, next_step, allowed_next_actions, deeplink
) values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, $12, $13::jsonb, $14)
on conflict (id) do update set
  conversation_id = excluded.conversation_id,
  task_type = excluded.task_type,
  task_intent = excluded.task_intent,
  marker = excluded.marker,
  status = excluded.status,
  progress_refs = excluded.progress_refs,
  deliverable_refs = excluded.deliverable_refs,
  material_refs = excluded.material_refs,
  blocker = excluded.blocker,
  next_step = excluded.next_step,
  allowed_next_actions = excluded.allowed_next_actions,
  deeplink = excluded.deeplink,
  updated_at = now()
returning created_at, updated_at
`, item.ID, item.UserID, item.ConversationID, item.TaskType, item.TaskIntent, item.Marker, item.Status,
		string(progressRefs), string(deliverableRefs), string(materialRefs), string(blocker), item.NextStep, string(allowedNextActions), item.DeepLink).
		Scan(&item.CreatedAt, &item.UpdatedAt)
	return item, err
}

func (store PostgresStore) ListTaskHistory(userID string) []TaskHistoryItem {
	rows, err := store.db.QueryContext(context.Background(), `
select id, user_id, conversation_id, task_type, task_intent, marker, status,
  progress_refs, deliverable_refs, material_refs, coalesce(blocker, 'null'::jsonb), next_step, allowed_next_actions, deeplink, created_at, updated_at
from webapp_task_history
where user_id = $1
order by updated_at desc
`, userID)
	if err != nil {
		return []TaskHistoryItem{}
	}
	defer rows.Close()
	return scanTaskHistoryRows(rows)
}

func (store PostgresStore) GetTaskHistory(userID string, taskID string) (TaskHistoryItem, bool) {
	rows, err := store.db.QueryContext(context.Background(), `
select id, user_id, conversation_id, task_type, task_intent, marker, status,
  progress_refs, deliverable_refs, material_refs, coalesce(blocker, 'null'::jsonb), next_step, allowed_next_actions, deeplink, created_at, updated_at
from webapp_task_history
where user_id = $1 and id = $2
`, userID, taskID)
	if err != nil {
		return TaskHistoryItem{}, false
	}
	defer rows.Close()
	items := scanTaskHistoryRows(rows)
	if len(items) != 1 {
		return TaskHistoryItem{}, false
	}
	return items[0], true
}

func scanTaskHistoryRows(rows *sql.Rows) []TaskHistoryItem {
	items := []TaskHistoryItem{}
	for rows.Next() {
		item := TaskHistoryItem{WebuiArtifactBody: "forbidden", WebuiStorageTruth: "forbidden"}
		progressRefs := ""
		deliverableRefs := ""
		materialRefs := ""
		blocker := ""
		allowedNextActions := ""
		if err := rows.Scan(
			&item.ID, &item.UserID, &item.ConversationID, &item.TaskType, &item.TaskIntent, &item.Marker, &item.Status,
			&progressRefs, &deliverableRefs, &materialRefs, &blocker, &item.NextStep, &allowedNextActions, &item.DeepLink,
			&item.CreatedAt, &item.UpdatedAt,
		); err != nil {
			return []TaskHistoryItem{}
		}
		_ = json.Unmarshal([]byte(progressRefs), &item.ProgressRefs)
		_ = json.Unmarshal([]byte(deliverableRefs), &item.DeliverableRefs)
		_ = json.Unmarshal([]byte(materialRefs), &item.MaterialRefs)
		_ = json.Unmarshal([]byte(allowedNextActions), &item.AllowedNextActions)
		if blocker != "" && blocker != "null" {
			parsed := TaskBlocker{}
			if err := json.Unmarshal([]byte(blocker), &parsed); err == nil {
				item.Blocker = &parsed
			}
		}
		items = append(items, item)
	}
	return items
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

func (store PostgresStore) RecordOperatorAuditEvent(event OperatorAuditEvent) error {
	if event.ID == "" {
		event.ID = "opsaudit_" + randomHex(8)
	}
	if event.CreatedAt.IsZero() {
		event.CreatedAt = time.Now().UTC()
	}
	metadata, err := json.Marshal(sanitizeMetadata(event.Metadata))
	if err != nil {
		return err
	}
	_, err = store.db.ExecContext(context.Background(), `
insert into webapp_operator_audit_events (id, event_kind, metadata, created_at)
values ($1, $2, $3::jsonb, $4)
`, event.ID, event.EventKind, string(metadata), event.CreatedAt)
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

func (store PostgresStore) ChatQuotaStatus(userID string, limit int) ChatQuotaStatus {
	period := time.Now().UTC().Format("2006-01")
	used := 0
	err := store.db.QueryRowContext(context.Background(), `
select used_count from webapp_chat_usage
where user_id = $1 and period = $2
`, userID, period).Scan(&used)
	if err == sql.ErrNoRows {
		return quotaStatus(limit, 0)
	}
	if err != nil {
		return quotaStatus(limit, limit)
	}
	return quotaStatus(limit, used)
}
