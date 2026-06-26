package webapp

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

const postgresSchema = `
create table if not exists users (
  id text primary key,
  display_name text not null
);
alter table users add column if not exists email text;
alter table users add column if not exists password_hash text;
alter table users add column if not exists user_status text not null default 'active';
alter table users add column if not exists created_at timestamptz not null default now();
create unique index if not exists users_email_unique on users (lower(email)) where email is not null;
create table if not exists tenants (
  id text primary key,
  name text not null
);
create table if not exists tenant_memberships (
  tenant_id text not null references tenants(id),
  user_id text not null references users(id),
  role text not null,
  primary key (tenant_id, user_id)
);
create table if not exists workspaces (
  tenant_id text not null references tenants(id),
  id text not null,
  name text not null,
  primary key (tenant_id, id)
);
create table if not exists workspace_memberships (
  tenant_id text not null,
  workspace_id text not null,
  user_id text not null references users(id),
  role text not null,
  primary key (tenant_id, workspace_id, user_id)
);
create table if not exists api_key_bindings (
  user_id text primary key references users(id),
  provider text not null,
  base_url text not null,
  encrypted_api_key text not null,
  masked_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists chat_conversations (
  id text primary key,
  user_id text not null references users(id),
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists chat_messages (
  id text primary key,
  conversation_id text not null references chat_conversations(id),
  user_id text not null references users(id),
  role text not null,
  content text not null,
  created_at timestamptz not null default now()
);
create table if not exists webapp_audit_events (
  id text primary key,
  user_id text not null references users(id),
  event_kind text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists webapp_operator_audit_events (
  id text primary key,
  event_kind text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists webapp_chat_usage (
  user_id text not null references users(id),
  period text not null,
  used_count bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, period)
);
create table if not exists webapp_ops_state (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);`

type PostgresStore struct {
	db *sql.DB
}

func OpenStoreFromEnv() (Store, error) {
	dsn := os.Getenv("OPL_DATABASE_URL")
	if dsn == "" {
		return NewMemoryStore(), nil
	}
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		return nil, fmt.Errorf("open webapp postgres: %w", err)
	}
	if err := db.PingContext(context.Background()); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("ping webapp postgres: %w", err)
	}
	ConfigurePostgresPool(db)
	if _, err := db.ExecContext(context.Background(), postgresSchema); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("initialize webapp schema: %w", err)
	}
	return PostgresStore{db: db}, nil
}

func ConfigurePostgresPool(db *sql.DB) {
	db.SetMaxOpenConns(postgresPoolInt("OPL_DATABASE_MAX_OPEN_CONNS", 10))
	db.SetMaxIdleConns(postgresPoolInt("OPL_DATABASE_MAX_IDLE_CONNS", 5))
	db.SetConnMaxLifetime(postgresPoolDuration("OPL_DATABASE_CONN_MAX_LIFETIME_SECONDS", 300*time.Second))
}

func postgresPoolInt(key string, fallback int) int {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed < 1 || parsed > 200 {
		return fallback
	}
	return parsed
}

func postgresPoolDuration(key string, fallback time.Duration) time.Duration {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed < 1 || parsed > 86400 {
		return fallback
	}
	return time.Duration(parsed) * time.Second
}

func (store PostgresStore) CreateUser(email string, passwordHash string) (User, error) {
	user := newUser(email, passwordHash)
	tx, err := store.db.BeginTx(context.Background(), nil)
	if err != nil {
		return User{}, err
	}
	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback()
		}
	}()
	if _, err := tx.ExecContext(context.Background(), `
insert into users (id, display_name, email, password_hash, user_status, created_at)
values ($1, $2, $3, $4, $5, $6)
`, user.ID, user.Email, user.Email, user.PasswordHash, user.Status, user.CreatedAt); err != nil {
		return User{}, mapDuplicate(err)
	}
	statements := []struct {
		query string
		args  []any
	}{
		{`insert into tenants (id, name) values ($1, $1)`, []any{user.TenantID}},
		{`insert into tenant_memberships (tenant_id, user_id, role) values ($1, $2, 'owner')`, []any{user.TenantID, user.ID}},
		{`insert into workspaces (tenant_id, id, name) values ($1, $2, $2)`, []any{user.TenantID, user.WorkspaceID}},
		{`insert into workspace_memberships (tenant_id, workspace_id, user_id, role) values ($1, $2, $3, 'owner')`, []any{user.TenantID, user.WorkspaceID, user.ID}},
	}
	for _, statement := range statements {
		if _, err := tx.ExecContext(context.Background(), statement.query, statement.args...); err != nil {
			return User{}, err
		}
	}
	if err := tx.Commit(); err != nil {
		return User{}, err
	}
	committed = true
	return user, nil
}

func (store PostgresStore) FindUserByEmail(email string) (User, bool) {
	return store.findUser(`where lower(email) = lower($1)`, normalizeEmail(email))
}

func (store PostgresStore) FindUserByID(userID string) (User, bool) {
	return store.findUser(`where id = $1`, userID)
}

func (store PostgresStore) findUser(where string, value string) (User, bool) {
	user := User{}
	err := store.db.QueryRowContext(context.Background(), `
select u.id, u.email, u.password_hash, tm.tenant_id, wm.workspace_id, u.user_status, u.created_at
from users u
join tenant_memberships tm on tm.user_id = u.id
join workspace_memberships wm on wm.user_id = u.id and wm.tenant_id = tm.tenant_id
`+where+`
limit 1
`, value).Scan(&user.ID, &user.Email, &user.PasswordHash, &user.TenantID, &user.WorkspaceID, &user.Status, &user.CreatedAt)
	if err == nil && user.Status == "" {
		user.Status = UserStatusActive
	}
	return user, err == nil
}

func (store PostgresStore) ListUsers() []User {
	rows, err := store.db.QueryContext(context.Background(), `
select u.id, u.email, u.password_hash, tm.tenant_id, wm.workspace_id, u.user_status, u.created_at
from users u
join tenant_memberships tm on tm.user_id = u.id
join workspace_memberships wm on wm.user_id = u.id and wm.tenant_id = tm.tenant_id
order by u.created_at asc
`)
	if err != nil {
		return []User{}
	}
	defer rows.Close()
	users := []User{}
	for rows.Next() {
		user := User{}
		if err := rows.Scan(&user.ID, &user.Email, &user.PasswordHash, &user.TenantID, &user.WorkspaceID, &user.Status, &user.CreatedAt); err != nil {
			return []User{}
		}
		if user.Status == "" {
			user.Status = UserStatusActive
		}
		users = append(users, user)
	}
	return users
}

func (store PostgresStore) SetUserStatus(userID string, status string) (User, error) {
	if !validUserStatus(status) {
		return User{}, ErrNotFound
	}
	result, err := store.db.ExecContext(context.Background(), `
update users set user_status = $1 where id = $2
`, status, userID)
	if err != nil {
		return User{}, err
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		return User{}, ErrNotFound
	}
	user, ok := store.FindUserByID(userID)
	if !ok {
		return User{}, ErrNotFound
	}
	return user, nil
}

func (store PostgresStore) RegistrationMode() string {
	mode := ""
	err := store.db.QueryRowContext(context.Background(), `
select value from webapp_ops_state where key = 'registration_mode'
`).Scan(&mode)
	if err != nil || !validRegistrationMode(mode) {
		return RegistrationModeOpen
	}
	return mode
}

func (store PostgresStore) SetRegistrationMode(mode string) error {
	if !validRegistrationMode(mode) {
		return ErrNotFound
	}
	_, err := store.db.ExecContext(context.Background(), `
insert into webapp_ops_state (key, value)
values ('registration_mode', $1)
on conflict (key) do update set value = excluded.value, updated_at = now()
`, mode)
	return err
}

func (store PostgresStore) SaveAPIKeyBinding(binding APIKeyBinding) error {
	_, err := store.db.ExecContext(context.Background(), `
insert into api_key_bindings (user_id, provider, base_url, encrypted_api_key, masked_key)
values ($1, $2, $3, $4, $5)
on conflict (user_id) do update set
provider = excluded.provider,
base_url = excluded.base_url,
encrypted_api_key = excluded.encrypted_api_key,
masked_key = excluded.masked_key,
updated_at = now()
`, binding.UserID, binding.Provider, binding.BaseURL, binding.EncryptedAPIKey, binding.MaskedKey)
	return err
}

func (store PostgresStore) GetAPIKeyBinding(userID string) (APIKeyBinding, bool) {
	binding := APIKeyBinding{}
	err := store.db.QueryRowContext(context.Background(), `
select user_id, provider, base_url, encrypted_api_key, masked_key, created_at, updated_at
from api_key_bindings
where user_id = $1
`, userID).Scan(&binding.UserID, &binding.Provider, &binding.BaseURL, &binding.EncryptedAPIKey, &binding.MaskedKey, &binding.CreatedAt, &binding.UpdatedAt)
	return binding, err == nil
}
