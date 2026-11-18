# Production configuration and release

The app uses a Next.js frontend, an Express API, and PostgreSQL. Browser code uses
specific API endpoints; the former `/api/db` endpoint has been removed.

## Run locally with Docker Desktop

From PowerShell in this project directory, run:

```powershell
npm run setup:local
docker compose config --quiet
docker compose up -d --build
```

Open `http://localhost:3000`. Compose reads `.env` automatically; it does not read
`.env.local` for interpolation. The setup command creates missing configuration
in an ignored `.env`, generates independent secrets, reuses database credentials
from the existing `auctionhub_db` container, and takes the admin email allowlist
from `.env.local`. It preserves existing nonempty `.env` values on subsequent runs.
It does not change database passwords, seed accounts, or delete volumes.

Local configuration explicitly sets `APP_ENV=local`. This permits HTTP and
non-secure session cookies only for loopback URLs. Docker's application ports
remain bound to loopback. Production defaults to HTTPS and secure cookies.
Use a separate production `.env` with `APP_ENV=production` on AWS.

For a new, empty database, start `db` and run the migration command in the release
section before using the app. For an existing installation, preserve its volume
and follow the credential rotation and upload ownership notes below as needed.

## Connect the ESP32 over local Wi-Fi

The device connects directly to port 4000, so the default loopback binding does
not allow it to connect. Opt in to an additional binding on the computer's Wi-Fi
address by adding these settings to the local `.env`:

```dotenv
DEVICE_LAN_IP=192.168.1.13
COMPOSE_FILE='docker-compose.yml;docker-compose.device.yml'
COMPOSE_PATH_SEPARATOR=';'
```

Use the computer's current Wi-Fi IPv4 address for `DEVICE_LAN_IP`. The firmware's
`lib/AuctionAPI/AuctionAPI_hal.h` must use that same address and port 4000. The
ESP32's own address is different; in the reported connection it is 192.168.1.19.
Then apply the port mapping without rebuilding images or changing the database:

```powershell
docker compose config --quiet
docker compose up -d --no-deps --no-build backend
```

Keep Windows Firewall enabled. If needed, allow the device's address to reach
only TCP 4000 on the Wi-Fi interface. For the addresses above, in an Administrator
PowerShell window:

```powershell
New-NetFirewallRule -Name 'AuctionHub-ESP32-API' -DisplayName 'AuctionHub ESP32 API' -Direction Inbound -Action Allow -Protocol TCP -LocalAddress 192.168.1.13 -LocalPort 4000 -RemoteAddress 192.168.1.19 -InterfaceAlias 'Wi-Fi' -Profile Any
```

The host's `http://192.168.1.13:4000/health` and `/api/auctions` endpoints should
respond. A host check verifies the server binding; the ESP32's serial log verifies
the connection from Wi-Fi. If DHCP changes either address, update the binding,
firmware host, or scoped firewall rule accordingly; DHCP reservations avoid this.

This override exposes only the API on the selected LAN address. The frontend
remains on loopback and PostgreSQL has no published port. Remove the three
device settings or use a separate production `.env` for AWS, where devices should
connect through the public HTTPS endpoint using TLS-capable firmware.

## Configure secrets

Copy `.env.example` to `.env` on the deployment host and populate every required
value. Keep the file readable only by the deployment account. Supply these values
from your deployment secret store when automating releases. Never print the
resolved Compose configuration or environment in pipeline logs.

Generate **separate** values for `POSTGRES_PASSWORD`, `AUTH_SECRET`, and
`CRON_SECRET`, for example by running this command once for each value:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Set `DATABASE_URL` using the same PostgreSQL credentials. Inside Compose the
database hostname is `db`, for example:

```text
postgresql://<user>:<URL-encoded-password>@db:5432/<database>?schema=public
```

Set `SUPER_ADMIN_EMAILS` to email addresses you control. This is a privileged
allowlist: existing accounts with these addresses receive super-admin access.
Set `NEXT_PUBLIC_APP_URL` to the public HTTPS URL and `FRONTEND_ORIGINS` to the
exact HTTPS origin(s), separated by commas. Configure the Resend variables for
password reset email. `JWT_SECRET` is no longer used.

All `.env*` files except the empty example are excluded from Git and Docker builds.
Do not pass production secrets as Docker build arguments or `NEXT_PUBLIC_*`
variables. The frontend image uses a dummy database URL at build time; the real
URL is supplied only when the container runs.

## Validate and release

Use Node.js 24. The following checks do not migrate or seed your database:

```sh
npm ci
npx prisma generate
npm run typecheck
npm test
npm run build
docker compose config --quiet
```

Build images in CI rather than on a t3.micro. For the initial local Compose
release (after a database backup if it already contains data):

```sh
docker compose build
docker compose up -d db
docker compose run --rm --no-deps backend ./node_modules/.bin/prisma migrate deploy
docker compose up -d backend frontend
```

In the pipeline, pull the two images tagged with the commit ID, run the migration
command once, then recreate the application services. Migrations and admin
seeding no longer run when the backend starts. Use backward-compatible schema
changes: rolling back images does not roll back database migrations.

The database has no published host port. Application ports 3000 and 4000 bind to
host loopback. Configure a host reverse proxy with HTTPS: `/api/*` and `/uploads/*`
go to `127.0.0.1:4000`, and other paths go to `127.0.0.1:3000`. Disable proxy
buffering for `/api/realtime` and allow its long-running SSE connections. Permit
only ports 80/443 from the internet. `/health` on the API is a liveness check; also
smoke-test database-backed application operations after deployment.

## Create initial administrators once

The seed command requires `SUPER_ADMIN_INITIAL_PASSWORD` only when an account is
missing. Use a unique password of at least 16 characters, with uppercase,
lowercase, and numbers (at most 72 UTF-8 bytes). Inject it temporarily for this
command; never add it to the regular containers or commit it to an environment
file. For example, from a Linux deployment shell:

```sh
read -r -s -p 'Initial admin password: ' SUPER_ADMIN_INITIAL_PASSWORD
printf '\n'
export SUPER_ADMIN_INITIAL_PASSWORD
docker compose run --rm --no-deps -e SUPER_ADMIN_INITIAL_PASSWORD backend npm run db:seed
unset SUPER_ADMIN_INITIAL_PASSWORD
```

The command creates missing accounts and preserves existing accounts, including
their passwords, roles, and activation state. It never logs the password. A
failure returns a nonzero status. Change an existing admin password through the
profile form using its current password, or the password reset email flow.
Password changes invalidate other browser sessions.

## Existing installations

Back up PostgreSQL and uploaded media before changing credentials. Updating
`POSTGRES_PASSWORD` does **not** change the password in an initialized database
volume. Change the database role password interactively with `psql`'s
`\password <role>` command, update the deployment secrets and `DATABASE_URL`, then
recreate the application services. Do not delete the database volume to rotate a
password.

Both app images now run as the `node` user. Fresh upload volumes inherit the
correct ownership. For an existing upload volume that was created by root, make
this one-time ownership correction before restarting the backend:

```sh
docker compose run --rm --no-deps --user root backend chown -R node:node /app/uploads
```

Rotate previously used example credentials. Invalidating `AUTH_SECRET` invalidates
old signed email-confirmation links; password-reset tokens use database records.
Keep scheduled database and upload backups off the instance, and test restores.

# AuctionHub EC2 deployment overlay — updated for New folder(2).zip (17 Nov 2026)

Use with the UPDATED project, not the earlier archive. This ZIP is an overlay, not the application itself.
Copy `docker-compose.prod.yml`, `deploy.sh`, `Caddyfile`, `.github/workflows/deploy.yml` into the updated repository root.
The existing `Dockerfile.backend`, `Dockerfile.frontend`, `prisma/seed.ts`, `docker-compose.yml` and `DEPLOY.md` are intentionally NOT replaced.
The JSON policies and `.env.production.example` are setup references, not files to automatically deploy.

## AWS infrastructure and initial setup

1. Select AWS region `ap-south-1`, create 2 PRIVATE ECR repositories: `auctionhub-backend`, `auctionhub-frontend`.
2. Launch Amazon Linux 2023 x86_64 EC2. Prefer t3.small or larger for live traffic (t3.micro 1 GiB RAM is only for lightweight testing). Use ~30 GiB gp3, a public subnet with internet access, security-group ports 80/443 only, and Elastic IP/DNS as needed.
3. Make an EC2 instance IAM role with `AmazonSSMManagedInstanceCore` and ECR pull permission (e.g. `AmazonEC2ContainerRegistryPullOnly`). Verify Systems Manager displays the instance as managed. The SSM agent needs to reach AWS endpoints (public egress or VPC endpoints).
4. Install Docker, Docker Compose plugin and AWS CLI; ensure `sudo docker compose version` works. `sudo systemctl enable --now docker`.
5. `sudo mkdir -p /opt/auctionhub`; put a populated copy of `.env.production.example` at `/opt/auctionhub/.env` and `sudo chmod 600 /opt/auctionhub/.env`.
6. Set DNS A record for `DOMAIN` to the EC2 Elastic IP, allow incoming 80 and 443. Caddy provisions HTTPS certificates automatically.
7. Set up an IAM GitHub OIDC identity provider `https://token.actions.githubusercontent.com` audience `sts.amazonaws.com`; then deployment IAM role using `github-oidc-trust.json` and `github-aws-policy.json`. Replace placeholders: AWS account ID, GitHub OWNER/REPOSITORY, and EC2 Instance ID. The trust policy is pinned to the `main` branch.
8. In GitHub repository Actions settings set secret `AWS_ROLE_ARN` and variable `EC2_INSTANCE_ID`.
9. Push the UPDATED repository plus overlay files to `main`. GitHub Actions validates code, builds 2 Docker images, pushes ECR and invokes SSM. `deploy.sh` pulls the images, starts PostgreSQL, applies pending Prisma migrations ONCE as a one-off job, and starts the application. Seeding is NOT automatic.

## Environment differences from OLD starter

* Use **AUTH_SECRET**, NOT JWT_SECRET (removed from application).
* Use `APP_ENV=production`, `NEXT_PUBLIC_APP_URL=https://your-domain`, `FRONTEND_ORIGINS=https://your-domain`.
* Use a strong `POSTGRES_PASSWORD` and matching URL-encoded password in `DATABASE_URL`. PostgreSQL host is `db` in this Docker deployment.
* The uploaded ZIP includes a populated `.env` file; do not commit or publish it. Rotate any previously exposed credentials.
* Do NOT copy the old replacement `prisma/seed.ts` into the new project. The current source already contains a safer manual seed.
* Do NOT use the old `docker-entrypoint.sh` to run migrations on every app start. The updated Dockerfile backend intentionally starts Express directly.
* The generic `/api/db` route is not exposed by `server.ts` anymore (404). Device endpoints `/api/device/nfc/:uid`, `/api/device/verify-auction-password`, and `/api/device/bid` are present and proxied through Caddy.
* `docker-compose.device.yml` is for local laptop LAN testing only; never enable this override on public EC2.

## Manual first-time admin creation (AFTER a successful deployment)

Only if you need to create the first admin accounts, connect through EC2 Session Manager and run:

```
cd /opt/auctionhub
export IMAGE_TAG=<the-40-character-commit-SHA-from-GitHub-Actions>
read -r -s -p 'Initial admin password: ' SUPER_ADMIN_INITIAL_PASSWORD
printf '\n'
export SUPER_ADMIN_INITIAL_PASSWORD
sudo --preserve-env=SUPER_ADMIN_INITIAL_PASSWORD,IMAGE_TAG docker compose --env-file .env -f docker-compose.prod.yml \
  run --rm --no-deps -e SUPER_ADMIN_INITIAL_PASSWORD backend npm run db:seed
unset SUPER_ADMIN_INITIAL_PASSWORD
```

You may instead set IMAGE_TAG explicitly to your deployed GitHub commit SHA, e.g. `export IMAGE_TAG=<40-char-SHA>`; avoid passing passwords in CLI arguments or saving them to the `.env` file. The seed only creates missing accounts and does not modify existing passwords.

## Verify and maintain

```
cd /opt/auctionhub
export IMAGE_TAG=<the-40-character-commit-SHA>
sudo --preserve-env=IMAGE_TAG docker compose --env-file .env -f docker-compose.prod.yml ps
sudo --preserve-env=IMAGE_TAG docker compose --env-file .env -f docker-compose.prod.yml logs --tail=100 backend
sudo --preserve-env=IMAGE_TAG docker compose --env-file .env -f docker-compose.prod.yml exec backend wget -qO- http://127.0.0.1:4000/health
```

Save database dumps and `app_uploads` backups OFF the instance, test restores, and monitor CPU credits, RAM, disk and errors. This 1-host setup interrupts open SSE connections and bids during deploys; schedule deployments between live auction sessions.

**Pre-production blocker:** the ESP32 `/api/device/*` routes in `server.ts` appear to trust a supplied NFC UID and are directly reachable over HTTPS, without independent device authentication. Add authenticated device identity, rate limiting, and server-side bidding authorization checks before live bidding. Also test simultaneous bids as an atomic transaction to prevent multiple winners.

**Important:** This starter has only been inspected statically and syntax checked. It has NOT been deployed on your AWS account or run through Docker builds in this environment. The overlay is a starting point, not an audited production release.
