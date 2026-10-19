# Native deployment

Run Python 3.11 in `/opt/panwatch/.venv` with one worker; Caddy handles HTTPS
and automatic certificate renewal on ports 80/443. The application listens only
on `127.0.0.1:8000`. Do not run `python server.py` for this deployment because
that entry point binds all interfaces.

Preparation:

1. Install Git, a standalone Python 3.11 runtime, and the dependencies in
   `requirements-runtime.txt` using a virtual environment. Keep the standalone
   runtime outside `/root` so the service user can execute it.
2. Place the repository at `/opt/panwatch`. Build the frontend on a development
   machine (`pnpm install --frozen-lockfile && pnpm build` inside `frontend`),
   then copy `frontend/dist/` to `/opt/panwatch/static/`. Do not build Node assets
   on a small production VPS. Record the deployed Git SHA in `VERSION`.
3. Create a system user/group `panwatch` and `/var/lib/panwatch` owned by it,
   mode 0700. Link `/opt/panwatch/data` to `/var/lib/panwatch`; SQLite currently
   uses the repository-relative data path, so `DATA_DIR` alone is insufficient.
4. Stop the source application before migrating its full data directory. Use
   encrypted SSH transport, preserve the login settings, and verify SQLite
   integrity and record counts. Never commit databases, credentials or backups.
   Keep only one scheduler instance active after migration.
5. Install `panwatch.service` in `/etc/systemd/system/`. An optional root-only
   `/etc/panwatch.env` can hold a unique `JWT_SECRET`. Preserve a backup before
   changing an existing Caddy site, and merge its unrelated routes unchanged.
6. Before opening the reverse proxy, confirm authentication is initialized.
   Fresh installs must be initialized through an SSH tunnel first. Validate
   Caddy with `caddy validate --config /etc/caddy/Caddyfile` before reloading.
7. Run `systemctl daemon-reload` and `systemctl enable --now panwatch`.
   Verify `/api/health`, unauthenticated access rejection on protected APIs,
   certificate hostname/trust, login and read-only business data.

Operations:

- Status: `systemctl status panwatch`; logs: `journalctl -u panwatch`.
- Restart: `systemctl restart panwatch`.
- Backup: stop the service, copy `/var/lib/panwatch`, then start it again.
- Upgrade: back up data and the old release, stop service, install the new
  source/dependencies/static assets, then start and verify. SQLite migrations
  may require restoring the paired data backup when rolling back source.
- Memory settings limit this service on a 1 GB VPS. This is intended for a
  single user with limited concurrent analyses, not a high concurrency SLA.
- Chromium is deliberately not downloaded on startup. Browser-backed image
  export is unavailable until its system dependencies/browser are installed;
  ordinary web charts and remote Qwen requests do not require Chromium.
- Ubuntu 20.04 system Pango can be too old for the newest WeasyPrint. The
  application has an xhtml2pdf fallback; verify PDF export separately.
