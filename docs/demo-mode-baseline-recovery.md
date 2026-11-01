# Demo Mode baseline recovery

## Purpose and decision

The connected staging database has five early migration records whose original SQL bodies are not present in this repository. Git history was checked on the `main`, `fix/20261031-student-bug-report`, and `feat/utconnect-demo-mode` branches; none contains those five files.

Do not invent historical SQL bodies from migration names. For the isolated Demo Mode database, the preferred recovery path is a **new squashed baseline** generated from the current staging schema, followed by the Demo Mode isolation migration.

This is a new, current-state bootstrap. It does **not** reconstruct the original five migration files or preserve their historical sequence. It captures the schema as it exists today, including the later schema changes already applied to staging. The existing staging migration history and schema must remain untouched.

## Safety rules

- Do not apply the Demo Mode isolation migration to either existing UTConnect Supabase project.
- Do not run `db push`, `db reset --linked`, or any DDL against the existing staging project.
- Do not dump staging table data, Auth users, Storage objects, secrets, or private role assignments into the baseline.
- Use a disposable local checkout/workspace. Keep the normal incremental migration files archived outside the active `supabase/migrations` directory in that workspace.
- The repository currently has no `supabase/config.toml`; initialize a separate CLI workspace with `supabase init` rather than inventing config values in this branch.
- Do not commit a generated baseline until it has been reviewed and passes a clean local reset.

## 1. Capture a schema-only baseline from staging

Prerequisites: current Supabase CLI, Docker for local verification, access to the staging database password, and a private temporary workspace. Never put the database password in Git or a Vite environment variable.

1. Create a disposable working directory and initialize a Supabase CLI project there with `supabase init`.
2. Keep its active `supabase/migrations` directory empty for the initial pull. Do not copy the existing incremental migration files into it yet.
3. Link this disposable workspace to the existing staging project using `supabase link --project-ref "$UTCONNECT_STAGING_REF"`.
4. Run `supabase db pull` interactively. This creates a baseline migration from the current remote schema.
5. If the CLI asks whether to record the generated baseline as already applied in the staging project's migration history, **decline**. The purpose is to export a local schema snapshot, not to alter the source project's migration history. Do not use non-interactive/auto-accept mode for this capture.
6. Review every generated SQL file. If the CLI emits multiple ordered files, keep all of them in order.

The baseline must describe the current application schema, not staging data. Check that the generated SQL includes the app-owned schemas, tables, enums, indexes, constraints, functions, triggers, RLS policies, grants, publications, and required extension setup. Pay special attention to customizations in Supabase-managed `auth` and `storage` schemas. The coverage of those customizations depends on the CLI diff engine and version; do not assume they were included merely because `db pull` completed.

If a custom Auth/Storage trigger or policy is absent, stop and capture/review that customization separately using the documented workflow for the project's diff engine. Do not work around missing coverage by copying platform-managed schemas wholesale.

References:
- [Supabase local development workflow](https://supabase.com/docs/guides/local-development/cli-workflows)
- [Supabase database migrations](https://supabase.com/docs/guides/local-development/database-migrations)
- [Supabase backup and restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)

## 2. Build a demo-only migration chain

In a separate disposable copy of `feat/utconnect-demo-mode`:

1. Archive the existing incremental SQL files outside the active `supabase/migrations` directory. Do not delete them from the normal feature branch.
2. Put the reviewed schema snapshot first in the active migration directory. Keep its generated timestamp earlier than `20261101110000_utconnect_demo_mode_isolation.sql`. If the generated timestamp sorts later, rename the Demo Mode migration in this disposable workspace to a later timestamp while preserving its SQL body; do not change the normal feature branch just to force ordering.
3. Add `20261101110000_utconnect_demo_mode_isolation.sql` immediately after the baseline.
4. Do **not** put the old incremental migrations back into this active migration directory. Their changes are already represented by the current-state baseline; replaying them after the baseline can fail on duplicate or already-altered objects.
5. Keep the Edge Function source files and application code from the feature branch.

The demo-only chain should therefore be:

```text
<generated>_utconnect_current_schema_baseline.sql
20261101110000_utconnect_demo_mode_isolation.sql
```

If the baseline consists of multiple generated files, retain all of them before the Demo Mode migration.

## 3. Verify locally before any remote deployment

In the disposable workspace:

1. Run `supabase start`.
2. Run `supabase db reset` with only the baseline file(s) and Demo Mode migration active. This must rebuild from an empty local database.
3. Run the repository source checks, Deno checks, normal Playwright suite, and Demo Mode Playwright suite.
4. Run the current Supabase database advisors and review every security finding, especially RLS, SECURITY DEFINER functions, Storage policies, and grants.
5. Verify the final local migration list contains the generated baseline file(s) and the Demo Mode isolation migration, in that order.

A successful Vite build or mocked Playwright run is not proof of live RLS/Auth/Storage/Realtime isolation.

## 4. Apply only to a new dedicated Demo project

Only after a separate Demo Supabase project has been provisioned:

1. Confirm its project reference is different from both existing UTConnect project references.
2. Link the disposable demo workspace to that new project, not staging.
3. Enable Anonymous Sign-Ins on the new project.
4. Apply the reviewed baseline and Demo Mode migration with `supabase db push`.
5. Deploy `demo-mode` and the updated `nearby-students` Edge Functions to that project only, with JWT verification enabled.
6. Configure the server-side `UTCONNECT_DEMO_MODE` and `DEMO_ALLOWED_ORIGIN` secrets, and the separate demo host's Vite variables as documented in [demo-mode.md](./demo-mode.md).
7. Run live two-session isolation tests before exposing the demo.

## Current status

This recovery procedure is documented but **has not been executed**. No baseline snapshot has been generated, no migration has been applied, no Edge Function has been deployed, and no dedicated Demo Supabase project exists yet. The current Free-plan project limit remains a provisioning blocker.
