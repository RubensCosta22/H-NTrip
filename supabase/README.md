# Supabase local workflow

The database is migration-first. The initial migration creates only the access and isolation slice: profiles, workspaces, memberships and audit logs.

## Required checks

With Docker and the Supabase CLI available:

```bash
supabase start
supabase db reset
supabase db lint --level error
supabase test db
```

The test matrix covers an authorized member, another workspace, an authenticated user without membership and an anonymous user. The seed contains no identity or secret; initial owners are created by a controlled bootstrap process.

Migrations are forward-only. Never rewrite an applied migration; create a corrective migration instead.
