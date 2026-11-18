#!/usr/bin/env bash
# Run as root via AWS SSM Run Command.
set -euo pipefail
TAG="${1:?Usage: bash deploy.sh <40-character-commit-sha>}"
if [[ ! "$TAG" =~ ^[a-f0-9]{40}$ ]]; then
  echo 'Refusing an invalid Git commit SHA.' >&2
  exit 1
fi
cd /opt/auctionhub
if [[ ! -f .env ]]; then
  echo 'Missing /opt/auctionhub/.env; prepare production secrets on EC2 before deploying.' >&2
  exit 1
fi
REGION="$(sed -n 's/^AWS_REGION=//p' .env | head -n1 | tr -d '')"
REGISTRY="$(sed -n 's/^ECR_REGISTRY=//p' .env | head -n1 | tr -d '')"
if [[ -z "$REGION" || -z "$REGISTRY" ]]; then
  echo 'AWS_REGION and ECR_REGISTRY are required in .env.' >&2
  exit 1
fi
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$REGISTRY"
export IMAGE_TAG="$TAG"
COMPOSE=(docker compose --env-file .env -f docker-compose.prod.yml)
"${COMPOSE[@]}" config --quiet
"${COMPOSE[@]}" pull backend frontend db caddy
# Never run seed automatically. Migrate once while only the DB is started.
"${COMPOSE[@]}" up -d --wait --wait-timeout 180 db
"${COMPOSE[@]}" run --rm --no-deps backend ./node_modules/.bin/prisma migrate deploy
"${COMPOSE[@]}" up -d --wait --wait-timeout 240 backend frontend caddy
"${COMPOSE[@]}" ps
