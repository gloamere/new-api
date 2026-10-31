# Desktop companion consent service

Uses New API dashboard JWT sessions through `/api/user/self`; no password database, API-key authentication, or identity supplied by a client. JWT/session expiry and revocation are enforced by New API on every request. Only validated New API account ID is used as the receipt owner. One immutable receipt per account and consent version; another device reads the existing receipt instead of signing again.

Node 26 standard library, independent SQLite journal; this service does not migrate or modify New API PostgreSQL/MySQL/SQLite schemas. Own DB is intentionally SQLite, backed up with the release. Signed consent uses a two-minute, single-use, account-bound challenge and Ed25519 installation key. Receipt includes server time, trusted reverse-proxy IP, client version, public key, signature and exact declaration. The key attests continuity of an installation, not verified application code or human identity. No passwords, tokens, private keys or chat contents are logged or stored here.

Deployment on tencent-production only: host-loopback 13301 behind api.gloamere.cn `/desktop-companion/*`; proxy overwrites X-Companion-Client-IP. Do not publish port 13301. Keep data/ root-only. Login stays on the official New API UI; consent signing remains a separate explicit user action.

Security references reviewed: OWASP ASVS 5.0.0; Authentication Cheat Sheet; Session Management Cheat Sheet. Focused tests cover absent/opaque credentials, authenticated-user separation, revoked sessions, expired/replayed challenges, forged signatures, modified declarations, unexpected Origin, and second-device idempotency. No blanket ASVS-compliance claim. Operational tests must verify unauthenticated public denial, Caddy routing and persistence.

Rollback: remove only the new `/desktop-companion/*` handle from the current api.gloamere.cn site, validate and reload Caddy, stop this service; preserve data/ and release backups. Do not restore an old whole Caddyfile over unrelated changes.

## Deployment record — 2026-10-31

Deployed main commit `b15b56a94` to `/opt/new-api/companion/`, persistent container `new-api-companion-consent`. Runtime image is digest-pinned in compose. Caddy validated and reloaded; New API core and the shop were not restarted. Public health is 200; anonymous whoami is 401. Container health passed. Server and compose SHA-256 matched the committed sources. Pre-change PostgreSQL custom dump and Caddy backup are at `/opt/new-api/backups/companion-b15b56a94/`; pg_restore list validated. Archive at `/opt/new-api/companion-releases/b15b56a94/` contains tracked source only. The independent consent database stays in `/opt/new-api/companion/data/`. Real desktop account login and first user signing remain pending user interaction; automated authenticated tests use isolated fixtures.
