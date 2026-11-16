#!/bin/bash
# Builds "/Applications/ZH Tweaker.app": starts the tweaker server if needed and opens it in the browser.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
NODE="$(command -v node)"
APP="/Applications/ZH Tweaker.app"
LOG="$HOME/GeneralsX/zh-tweaker/server.log"
TMP="$(mktemp -d)"
mkdir -p "$HOME/GeneralsX/zh-tweaker"

cat > "$TMP/main.applescript" <<OSA
set isUp to do shell script "/usr/sbin/lsof -nP -iTCP:4170 -sTCP:LISTEN >/dev/null 2>&1 && echo yes || echo no"
if isUp is "no" then
  do shell script "cd " & quoted form of "$REPO" & " && nohup " & quoted form of "$NODE" & " src/server.js >> " & quoted form of "$LOG" & " 2>&1 &"
  repeat 30 times
    delay 0.3
    set isUp to do shell script "/usr/sbin/lsof -nP -iTCP:4170 -sTCP:LISTEN >/dev/null 2>&1 && echo yes || echo no"
    if isUp is "yes" then exit repeat
  end repeat
end if
open location "http://127.0.0.1:4170"
OSA

rm -rf "$APP"
osacompile -o "$APP" "$TMP/main.applescript"

# Icon: Command Center portrait from the game, if the server can render it.
ICON_SRC="$TMP/icon.png"
if "$NODE" --input-type=module -e "
  const {Vfs}=await import('$REPO/src/big.js');const {loadGameDb}=await import('$REPO/src/gamedb.js');const {iconPng}=await import('$REPO/src/icons.js');
  const v=await Vfs.open([process.env.HOME+'/GeneralsX/GeneralsZH',process.env.HOME+'/GeneralsX/Generals']);const db=await loadGameDb(v);
  const p=await iconPng(db,v,'AmericaCommandCenter','portrait');if(!p)process.exit(1);(await import('node:fs')).writeFileSync('$ICON_SRC',p)"; then
  SET="$TMP/icon.iconset"; mkdir -p "$SET"
  sips -s format png --padToHeightWidth 120 120 --padColor 0D1013 "$ICON_SRC" --out "$TMP/sq.png" >/dev/null
  for s in 16 32 128 256 512; do
    sips -z $s $s "$TMP/sq.png" --out "$SET/icon_${s}x${s}.png" >/dev/null
    sips -z $((s*2)) $((s*2)) "$TMP/sq.png" --out "$SET/icon_${s}x${s}@2x.png" >/dev/null
  done
  iconutil -c icns "$SET" -o "$APP/Contents/Resources/applet.icns"
  touch "$APP"
fi
rm -rf "$TMP"
echo "Готово: $APP"
