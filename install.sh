#!/bin/bash
# ZH Tweaker installer / updater for macOS.
#   curl -fsSL https://raw.githubusercontent.com/deanlawkz/zh-tweaker/main/install.sh | bash
# Your changes (~/GeneralsX/zh-tweaker) are kept on update.
set -euo pipefail

REPO_TARBALL="${ZHT_TARBALL:-https://github.com/deanlawkz/zh-tweaker/archive/refs/heads/main.tar.gz}"
HOME_DIR="$HOME/Library/Application Support/ZH Tweaker"
APP_SRC="$HOME_DIR/app"
NODE_DIR="$HOME_DIR/node"
NODE_MIN=22.13

say() { printf '\033[1m%s\033[0m\n' "$*"; }
die() { printf '\033[31m%s\033[0m\n' "$*" >&2; exit 1; }

[ "$(uname -s)" = Darwin ] || die "ZH Tweaker работает только на macOS."

# --- Node.js: system one if new enough, otherwise a private copy from nodejs.org ---
node_ok() { "$1" -e "const [a,b]=process.versions.node.split('.').map(Number);const [x,y]='$NODE_MIN'.split('.').map(Number);process.exit(a>x||(a===x&&b>=y)?0:1)" 2>/dev/null; }
NODE=""
for cand in "$(command -v node 2>/dev/null || true)" /opt/homebrew/bin/node /usr/local/bin/node "$NODE_DIR/bin/node"; do
  if [ -n "$cand" ] && [ -x "$cand" ] && node_ok "$cand"; then NODE="$cand"; break; fi
done
if [ -z "$NODE" ]; then
  say "Скачиваю Node.js 22 с nodejs.org (нужен твикеру, ставится только в его папку)..."
  case "$(uname -m)" in arm64) ARCH=arm64 ;; x86_64) ARCH=x64 ;; *) die "Неизвестный процессор: $(uname -m)" ;; esac
  BASE="https://nodejs.org/dist/latest-v22.x"
  TMPN="$(mktemp -d)"
  curl -fsSL "$BASE/SHASUMS256.txt" -o "$TMPN/SHASUMS256.txt"
  FILE="$(grep -oE "node-v[0-9.]+-darwin-$ARCH\.tar\.gz" "$TMPN/SHASUMS256.txt" | head -1)"
  [ -n "$FILE" ] || die "Не нашёл сборку Node.js для darwin-$ARCH."
  curl -fSL --progress-bar "$BASE/$FILE" -o "$TMPN/$FILE"
  (cd "$TMPN" && grep " $FILE\$" SHASUMS256.txt | shasum -a 256 -c - >/dev/null) || die "Контрольная сумма Node.js не совпала."
  rm -rf "$NODE_DIR"; mkdir -p "$NODE_DIR"
  tar -xzf "$TMPN/$FILE" -C "$NODE_DIR" --strip-components 1
  rm -rf "$TMPN"
  NODE="$NODE_DIR/bin/node"
fi
say "Node.js: $("$NODE" -v) ($NODE)"

# --- Tweaker files ---
say "Скачиваю ZH Tweaker..."
TMPA="$(mktemp -d)"
if [ -f "$REPO_TARBALL" ]; then cp "$REPO_TARBALL" "$TMPA/src.tar.gz"; else curl -fsSL "$REPO_TARBALL" -o "$TMPA/src.tar.gz"; fi
mkdir -p "$TMPA/x" && tar -xzf "$TMPA/src.tar.gz" -C "$TMPA/x" --strip-components 1
[ -f "$TMPA/x/src/server.js" ] || die "Архив твикера повреждён."
# Stop a running copy before replacing its files.
PID="$(/usr/sbin/lsof -ti tcp:4170 -sTCP:LISTEN 2>/dev/null || true)"
if [ -n "$PID" ] && [ "$(/usr/sbin/lsof -a -p "$PID" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')" = "$APP_SRC" ]; then kill "$PID" 2>/dev/null || true; fi
rm -rf "$APP_SRC"; mkdir -p "$HOME_DIR"; mv "$TMPA/x" "$APP_SRC"; rm -rf "$TMPA"

# --- Game check ---
GAME_ZH="$(cd "$APP_SRC" && "$NODE" --input-type=module -e "console.log((await import('./src/paths.js')).GAME_ZH)")"
if ! ls "$GAME_ZH"/*.big >/dev/null 2>&1; then
  printf '\n\033[33mВнимание:\033[0m не нашёл файлы Zero Hour в %s\n' "$GAME_ZH"
  echo "Сначала установите игру через GeneralsX (https://github.com/fbraz3/GeneralsX), потом запустите ZH Tweaker."
fi

# --- App icon ---
NODE="$NODE" bash "$APP_SRC/launcher/make-app.sh"
APP="/Applications/ZH Tweaker.app"; [ -d "$APP" ] || APP="$HOME/Applications/ZH Tweaker.app"
say "Готово. Запускайте «ZH Tweaker» из Программ или Launchpad."
[ "${ZHT_NO_OPEN:-}" = 1 ] || open "$APP"
