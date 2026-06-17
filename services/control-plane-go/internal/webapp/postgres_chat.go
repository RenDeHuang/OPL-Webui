package webapp

import "context"

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
