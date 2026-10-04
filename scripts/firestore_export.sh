#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/firestore_export.sh [PROJECT_ID] [GCS_BUCKET]
# PROJECT_ID default: current gcloud project
# GCS_BUCKET: required, e.g. gs://my-firestore-backups

PROJECT=${1:-$(gcloud config get-value project 2>/dev/null)}
BUCKET=${2:-}

if [ -z "$BUCKET" ]; then
  echo "Usage: $0 [PROJECT_ID] GCS_BUCKET"
  echo "Example: $0 my-gcp-project gs://my-firestore-backups"
  exit 1
fi

DATE=$(date -u +"%Y%m%dT%H%M%SZ")
DEST="$BUCKET/$DATE"

echo "Exporting Firestore to $DEST (project: $PROJECT)"

gcloud firestore export "$DEST" --project="$PROJECT"

echo "Export completed: $DEST"
