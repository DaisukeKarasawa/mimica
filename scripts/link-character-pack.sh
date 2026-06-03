#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ASSETS_REPO="${MIMICA_ASSETS_REPO:-$ROOT/../mimica-assets}"
PACK_SRC="$ASSETS_REPO/packs/rio"
PACK_LINK="$ROOT/packs/rio"

if [[ ! -d "$PACK_SRC" ]]; then
  echo "error: pack not found: $PACK_SRC" >&2
  echo "Clone mimica-assets or set MIMICA_ASSETS_REPO." >&2
  exit 1
fi

mkdir -p "$ROOT/packs"
rm -f "$PACK_LINK"
ln -sf "$PACK_SRC" "$PACK_LINK"
echo "Linked $PACK_LINK -> $PACK_SRC"
