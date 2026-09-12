#!/usr/bin/env bash
# Deploy Plane CE (time-tracking fork) to the k3s cluster.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NAMESPACE=plane
GHCR_USER="${GHCR_USER:-fra2404}"

rand() { LC_ALL=C tr -dc 'a-zA-Z0-9' </dev/urandom | head -c "${1:-32}"; }

echo "==> Namespace"
kubectl apply -f "$DIR/00-namespace.yaml"

echo "==> GHCR pull secret"
GHCR_TOKEN="${GHCR_PULL_TOKEN:-$(gh auth token)}"
kubectl create secret docker-registry ghcr-plane \
  --namespace "$NAMESPACE" \
  --docker-server=ghcr.io \
  --docker-username="$GHCR_USER" \
  --docker-password="$GHCR_TOKEN" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "==> Application secrets"
if kubectl get secret plane-secrets -n "$NAMESPACE" >/dev/null 2>&1; then
  echo "    plane-secrets already exists, keeping it"
else
  PGPASS="$(rand 24)"
  RABBITPASS="$(rand 24)"
  MINIOPASS="$(rand 24)"
  SECRET_KEY="$(rand 50)"
  LIVE_SECRET="$(rand 50)"
  kubectl create secret generic plane-secrets \
    --namespace "$NAMESPACE" \
    --from-literal=POSTGRES_PASSWORD="$PGPASS" \
    --from-literal=SECRET_KEY="$SECRET_KEY" \
    --from-literal=LIVE_SERVER_SECRET_KEY="$LIVE_SECRET" \
    --from-literal=RABBITMQ_PASSWORD="$RABBITPASS" \
    --from-literal=AWS_ACCESS_KEY_ID=plane \
    --from-literal=AWS_SECRET_ACCESS_KEY="$MINIOPASS" \
    --from-literal=DATABASE_URL="postgresql://plane:${PGPASS}@plane-db:5432/plane" \
    --from-literal=AMQP_URL="amqp://plane:${RABBITPASS}@plane-mq:5672/plane" \
    --dry-run=client -o yaml | kubectl apply -f -
fi

echo "==> Config, data stores, application, ingress"
kubectl apply -f "$DIR/01-config.yaml"
kubectl apply -f "$DIR/03-data.yaml"
kubectl apply -f "$DIR/04-plane.yaml"
kubectl apply -f "$DIR/05-ingress.yaml"

echo "==> Done. Watch rollouts with:"
echo "    kubectl -n $NAMESPACE get pods -w"
