package controlplane

const PostgresControlPlaneSchema = `
create table if not exists users (
  id text primary key,
  display_name text not null
);
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
  primary key (tenant_id, workspace_id, user_id),
  foreign key (tenant_id, workspace_id) references workspaces(tenant_id, id)
);`
