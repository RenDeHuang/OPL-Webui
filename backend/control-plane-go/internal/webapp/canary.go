package webapp

import (
	"context"
	"database/sql"
	"fmt"

	_ "github.com/jackc/pgx/v5/stdlib"
)

type DatabaseCanary interface {
	Run(context.Context) error
	Close() error
}

type DatabaseCanaryOpener func(string) (DatabaseCanary, error)

type PostgresDatabaseCanary struct {
	db *sql.DB
}

func OpenPostgresDatabaseCanary(databaseURL string) (DatabaseCanary, error) {
	db, err := sql.Open("pgx", databaseURL)
	if err != nil {
		return nil, fmt.Errorf("open webapp postgres canary: %w", err)
	}
	if err := db.PingContext(context.Background()); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("ping webapp postgres canary: %w", err)
	}
	if _, err := db.ExecContext(context.Background(), postgresSchema); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("initialize webapp postgres canary schema: %w", err)
	}
	return PostgresDatabaseCanary{db: db}, nil
}

func (canary PostgresDatabaseCanary) Close() error {
	return canary.db.Close()
}

func (canary PostgresDatabaseCanary) Run(ctx context.Context) error {
	id := "canary_" + randomHex(8)
	userID := "user_" + id
	tenantID := "tenant_" + id
	workspaceID := "workspace_" + id
	conversationID := "conv_" + id
	messageID := "msg_" + id
	auditID := "audit_" + id

	tx, err := canary.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback()
		}
	}()

	if _, err := tx.ExecContext(ctx, `
insert into users (id, display_name, email, password_hash)
values ($1, $2, $3, $4)
`, userID, userID, id+"@example.invalid", "canary-password-hash"); err != nil {
		return fmt.Errorf("write users: %w", err)
	}
	if _, err := tx.ExecContext(ctx, `insert into tenants (id, name) values ($1, $2)`, tenantID, tenantID); err != nil {
		return fmt.Errorf("write tenants: %w", err)
	}
	if _, err := tx.ExecContext(ctx, `insert into tenant_memberships (tenant_id, user_id, role) values ($1, $2, 'owner')`, tenantID, userID); err != nil {
		return fmt.Errorf("write tenant membership: %w", err)
	}
	if _, err := tx.ExecContext(ctx, `insert into workspaces (tenant_id, id, name) values ($1, $2, $3)`, tenantID, workspaceID, workspaceID); err != nil {
		return fmt.Errorf("write workspace: %w", err)
	}
	if _, err := tx.ExecContext(ctx, `insert into workspace_memberships (tenant_id, workspace_id, user_id, role) values ($1, $2, $3, 'owner')`, tenantID, workspaceID, userID); err != nil {
		return fmt.Errorf("write workspace membership: %w", err)
	}
	if _, err := tx.ExecContext(ctx, `
insert into api_key_bindings (user_id, provider, base_url, encrypted_api_key, masked_key)
values ($1, $2, $3, $4, $5)
`, userID, ProviderName, FixedBaseURL, "canary-encrypted-api-key", "sk-***ary"); err != nil {
		return fmt.Errorf("write api key binding: %w", err)
	}
	if _, err := tx.ExecContext(ctx, `
insert into chat_conversations (id, user_id, title)
values ($1, $2, $3)
`, conversationID, userID, "webapp db canary"); err != nil {
		return fmt.Errorf("write chat conversation: %w", err)
	}
	if _, err := tx.ExecContext(ctx, `
insert into chat_messages (id, conversation_id, user_id, role, content)
values ($1, $2, $3, $4, $5)
`, messageID, conversationID, userID, "user", "webapp db canary"); err != nil {
		return fmt.Errorf("write chat message: %w", err)
	}
	if _, err := tx.ExecContext(ctx, `
insert into webapp_audit_events (id, user_id, event_kind, metadata)
values ($1, $2, $3, '{}'::jsonb)
`, auditID, userID, "canary.db"); err != nil {
		return fmt.Errorf("write audit event: %w", err)
	}
	if _, err := tx.ExecContext(ctx, `
insert into webapp_chat_usage (user_id, period, used_count)
values ($1, $2, $3)
`, userID, "canary", 1); err != nil {
		return fmt.Errorf("write chat usage: %w", err)
	}

	var count int
	if err := tx.QueryRowContext(ctx, `
select count(*)
from users u
join api_key_bindings k on k.user_id = u.id
join chat_conversations c on c.user_id = u.id
join chat_messages m on m.conversation_id = c.id
join webapp_audit_events a on a.user_id = u.id
join webapp_chat_usage q on q.user_id = u.id
where u.id = $1 and k.base_url = $2
`, userID, FixedBaseURL).Scan(&count); err != nil {
		return fmt.Errorf("read webapp canary rows: %w", err)
	}
	if count != 1 {
		return fmt.Errorf("read webapp canary rows: got %d", count)
	}

	cleanup := []struct {
		label string
		query string
		args  []any
	}{
		{"chat usage", `delete from webapp_chat_usage where user_id = $1 and period = $2`, []any{userID, "canary"}},
		{"audit event", `delete from webapp_audit_events where id = $1`, []any{auditID}},
		{"chat message", `delete from chat_messages where id = $1`, []any{messageID}},
		{"chat conversation", `delete from chat_conversations where id = $1`, []any{conversationID}},
		{"api key binding", `delete from api_key_bindings where user_id = $1`, []any{userID}},
		{"workspace membership", `delete from workspace_memberships where tenant_id = $1 and workspace_id = $2 and user_id = $3`, []any{tenantID, workspaceID, userID}},
		{"workspace", `delete from workspaces where tenant_id = $1 and id = $2`, []any{tenantID, workspaceID}},
		{"tenant membership", `delete from tenant_memberships where tenant_id = $1 and user_id = $2`, []any{tenantID, userID}},
		{"tenant", `delete from tenants where id = $1`, []any{tenantID}},
		{"user", `delete from users where id = $1`, []any{userID}},
	}
	for _, item := range cleanup {
		if _, err := tx.ExecContext(ctx, item.query, item.args...); err != nil {
			return fmt.Errorf("delete %s: %w", item.label, err)
		}
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	committed = true
	return nil
}
