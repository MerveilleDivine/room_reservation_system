# Hosted booking storage

Roomwise keeps the required EF Core InMemory provider for local assignment review. A public, multi-instance container needs one shared PostgreSQL store. The container now refuses to start without it.

## Current blocker

A new Supabase free project was refused because the account has reached its active free-project limit. No other project has been paused, deleted or modified, and no paid upgrade has been made. The implementation is in [PR 1](https://github.com/MerveilleDivine/room_reservation_system/pull/1); production still runs the previous revision.

The remaining choice is a separate PostgreSQL database, or an explicitly approved isolated schema in an existing project. Reusing an existing project's database should be agreed before changing it because its capacity and availability would be shared with another app.

## Isolation and credentials

For an existing PostgreSQL database, the intended setup is a new application role and a new schema. The following is a review template, not an executed migration. Supply a generated password securely; do not commit it or put it in frontend configuration.

```sql
CREATE ROLE roomwise_app
  LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION
  PASSWORD '<generated-server-only-secret>';
CREATE SCHEMA roomwise_prod AUTHORIZATION roomwise_app;
REVOKE ALL ON SCHEMA roomwise_prod FROM PUBLIC;
ALTER ROLE roomwise_app SET search_path = roomwise_prod;
```

Before using a shared project, inspect its existing privileges and verify that the new role cannot read or change other applications' tables. Do not alter those applications' grants or schemas to accommodate Roomwise. Keep the custom schema outside any public REST exposure. Preview deployments need a different role and schema or a separate disposable database.

Set the Vercel server environment variable `ConnectionStrings__Reservations` to an Npgsql connection string with the actual provider-supplied hostname, port, database, application username and password. Specify `Search Path=roomwise_prod` and the provider's TLS requirements. Use a session-compatible pooler when required by the provider; do not guess a pooler hostname from its region. Never use a `VITE_` variable for this value.

The application role owns only Roomwise's schema. Initial startup creates the model's tables and synthetic seeds under a schema-scoped advisory transaction lock. Later starts preserve existing data. This bootstrap does not migrate an existing model: future schema changes need an explicit, reviewed migration.

## Verification before production

CI uses PostgreSQL 17 and independent API hosts to verify shared seed editing, restart persistence, request-receipt recovery and competing overlapping writes. It also checks the real browser flows against the development servers and published container. The container browser check explicitly opts into a disposable InMemory instance; it does not establish hosted database connectivity.

After configuring an isolated hosted store, deploy a preview with its own credentials and verify create, refresh, edit, cancel and extra time. Confirm that the selected member receives only their own reservation details and that competing requests cannot both commit. Then deploy production and repeat the important flows against the public URL. Do not mark the hosted fix complete based only on a successful image build.

Selectable profiles remain synthetic demo identities. A person can switch profiles or choose Administrator; this is not real authentication. Private office use needs verified accounts and trusted roles before accepting real booking data.
