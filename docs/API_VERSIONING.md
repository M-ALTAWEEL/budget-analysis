# API versioning policy

The website updates the moment we deploy. The mobile apps (phase 6) do not: people keep
old versions installed for months, sometimes years. So the API has to keep answering old
apps correctly while it grows.

## Rules

1. **Every route lives under a version**: `/api/v1/...`.
2. **Inside a version, changes only add.** Allowed in `v1`:
   - new endpoints;
   - new optional request fields;
   - new response fields (clients ignore fields they don't know).
3. **Breaking changes need `v2`.** Breaking means: removing or renaming a field or an
   endpoint, changing a field's type or meaning, making an optional field required,
   or changing an error code clients depend on.
4. **When `v2` exists, `v1` keeps working for at least 12 months.** Its responses carry
   `Deprecation` and `Sunset` headers, and the apps show "please update" before the end.
5. **The apps send their version** (`X-App-Version`), so we can see who still uses an old
   one before switching anything off, and force an update if a security fix needs it.

## Checklist for every API change

- [ ] Additive only? If not, it goes to `v2`.
- [ ] Old clients (that don't send the new field) still get a correct answer?
- [ ] Tests cover the old behaviour as well as the new one?
