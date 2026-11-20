#!/bin/bash
# ZH Tweaker uninstaller for macOS.
#   curl -fsSL https://raw.githubusercontent.com/deanlawkz/zh-tweaker/main/uninstall.sh | bash
# Removes tweaker files from the game, the app icon and the program.
# Your saved changes (~/GeneralsX/zh-tweaker) are kept; add --all to remove them too:
#   curl -fsSL https://raw.githubusercontent.com/deanlawkz/zh-tweaker/main/uninstall.sh | bash -s -- --all
set -euo pipefail
HOME_DIR="$HOME/Library/Application Support/ZH Tweaker"
APP_SRC="$HOME_DIR/app"

NODE=""
for cand in "$HOME_DIR/node/bin/node" "$(command -v node 2>/dev/null || true)" /opt/homebrew/bin/node /usr/local/bin/node; do
  [ -n "$cand" ] && [ -x "$cand" ] && { NODE="$cand"; break; }
done

# Stop the tweaker if it runs from the installed copy.
PID="$(/usr/sbin/lsof -ti tcp:4170 -sTCP:LISTEN 2>/dev/null || true)"
if [ -n "$PID" ] && [ "$(/usr/sbin/lsof -a -p "$PID" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')" = "$APP_SRC" ]; then kill "$PID" 2>/dev/null || true; fi

# Take tweaker files out of the game (same as "Сбросить всё").
if [ -n "$NODE" ] && [ -f "$APP_SRC/src/output.js" ]; then
  (cd "$APP_SRC" && "$NODE" --input-type=module -e "const r=await (await import('./src/output.js')).resetOutput();console.log('Файлы твикера убраны из игры:', r.removed?.length ?? 0)") \
    || echo "Не удалось убрать файлы из игры. Откройте твикер и нажмите «Сбросить всё»."
fi

if [ -n "${APP_DIR:-}" ]; then rm -rf "$APP_DIR/ZH Tweaker.app"
else rm -rf "/Applications/ZH Tweaker.app" "$HOME/Applications/ZH Tweaker.app" 2>/dev/null || true; fi
rm -rf "$HOME_DIR"
if [ "${1:-}" = "--all" ]; then
  rm -rf "$HOME/GeneralsX/zh-tweaker"
  echo "Удалены и сохранённые правки."
else
  echo "Ваши правки остались в ~/GeneralsX/zh-tweaker (удалить: добавьте --all)."
fi
echo "ZH Tweaker удалён."
