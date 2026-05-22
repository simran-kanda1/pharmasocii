#!/usr/bin/env bash
# Creates functions/.env.pharmasocii from example if missing.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="$ROOT/functions/.env.pharmasocii"
EXAMPLE="$ROOT/functions/.env.example"

if [[ -f "$TARGET" ]] && grep -q '^SMTP_PASS=.\+' "$TARGET" 2>/dev/null; then
  echo "SMTP_PASS already set in $TARGET"
else
  if [[ ! -f "$TARGET" ]]; then
    cp "$EXAMPLE" "$TARGET"
    echo "Created $TARGET from example."
  fi
  echo ""
  echo "Edit $TARGET and set SMTP_PASS to your Gmail app password:"
  echo "  https://myaccount.google.com/apppasswords"
  echo ""
  read -rsp "Gmail app password (input hidden): " SMTP_PASS
  echo ""
  if [[ -z "$SMTP_PASS" ]]; then
    echo "No password entered. SMTP emails will log to Firestore only until SMTP_PASS is set."
    exit 1
  fi
  if grep -q '^SMTP_PASS=' "$TARGET"; then
    sed -i.bak "s|^SMTP_PASS=.*|SMTP_PASS=${SMTP_PASS}|" "$TARGET" && rm -f "$TARGET.bak"
  else
    echo "SMTP_PASS=${SMTP_PASS}" >> "$TARGET"
  fi
  echo "Updated SMTP_PASS in $TARGET"
fi

echo "Deploying functions with env..."
cd "$ROOT"
firebase deploy --only functions
