---
title: "ZH Tweaker guide: install, troubleshooting and FAQ"
description: "How to install ZH Tweaker for C&C Generals Zero Hour on Mac (GeneralsX), where to get the game files, fixes for common problems, languages, online play and uninstalling."
lang: en
---

# ZH Tweaker guide

[Русская версия](GUIDE.ru.md) · [Project page](https://github.com/deanlawkz/zh-tweaker)

- [Requirements](#requirements)
- [Install step by step](#install-step-by-step)
- [First run](#first-run)
- [I don't have the game on my Mac yet](#i-dont-have-the-game-on-my-mac-yet)
- [Intel Macs](#intel-macs)
- [The game is in a different folder](#the-game-is-in-a-different-folder)
- [Language versions](#language-versions)
- [The app does not open or says it failed to start](#the-app-does-not-open-or-says-it-failed-to-start)
- [No Commander faction in the lobby](#no-commander-faction-in-the-lobby)
- [The game crashes after Apply](#the-game-crashes-after-apply)
- [Online play, replays and saves](#online-play-replays-and-saves)
- [Updating](#updating)
- [Moving or sharing your changes](#moving-or-sharing-your-changes)
- [Mods: Contra, TEOD and others](#mods-contra-teod-and-others)
- [Is the install command safe?](#is-the-install-command-safe)
- [Uninstall](#uninstall)
- [Windows and Linux](#windows-and-linux)
- [Reporting a bug](#reporting-a-bug)

## Requirements

| What | Requirement |
|---|---|
| Computer | Apple Silicon Mac (M1, M2, M3, M4 or newer) |
| System | macOS 15 Sequoia or newer (a GeneralsX requirement) |
| Game | GeneralsX plus Zero Hour data from your own legal copy |
| Node.js | 22.13 or newer; the installer downloads it if missing |
| Internet | Only to install and update |
| Admin rights | Not needed, no `sudo` |

## Install step by step

1. Make sure Generals Zero Hour already runs through GeneralsX. If not, start with [I don't have the game on my Mac yet](#i-dont-have-the-game-on-my-mac-yet).
2. Open **Terminal** (Cmd+Space, type "Terminal").
3. Paste and press Enter:

   ```bash
   curl -fsSL https://raw.githubusercontent.com/deanlawkz/zh-tweaker/main/install.sh | bash
   ```

4. Wait for "Готово" ("Done"); the installer prints Russian messages. Without Node.js the installer downloads about 50 MB.
5. A **ZH Tweaker** icon appears in Applications.

The installer puts the program in `~/Library/Application Support/ZH Tweaker/app`. If no suitable Node.js is found it downloads the official build from nodejs.org, verifies the checksum and keeps it in `~/Library/Application Support/ZH Tweaker/node` without touching your system. The icon goes to `/Applications`, or `~/Applications` if that folder is not writable.

## First run

1. Open **ZH Tweaker**. Your browser opens http://127.0.0.1:4170. The page runs only on your Mac.
2. Pick a unit or building. The top of the card shows the key numbers: health, speed, cost, build time, vision, passenger slots, power, income. Click a number, type a new one, press Enter.
3. Below are all other fields with plain labels, plus "take from another unit" (copy an ability) and "full text" for advanced edits.
4. **Build lists**: add any unit to any building.
5. **Weapons**: damage, range, reload, projectiles.
6. **Camera and general**: camera height up to 690, passengers firing in all directions, missile smoke and sound in big battles.
7. Press **Apply**, then **Play**. Pick the **Commander** faction in the skirmish lobby.

The **Changes** tab lists every change by unit as "old → new"; any of them can be undone. Changes affect only Commander: other factions and AI opponents keep the standard rules.

The interface is in English and Russian. It follows your browser language on first run; the EN/RU button at the top right switches it.

## I don't have the game on my Mac yet

ZH Tweaker does not include or download the game. You need your own legal copy, for example from Steam or the EA App.

1. Install **GeneralsX**: download the macOS build from [GeneralsX releases](https://github.com/fbraz3/GeneralsX/releases), unpack it and move the app to Applications. If macOS blocks the first launch, open System Settings → Privacy & Security and click "Open Anyway".
2. Put the game data here:
   - Zero Hour: `~/GeneralsX/GeneralsZH`
   - base Generals: `~/GeneralsX/Generals`
3. The [GeneralsX wiki](https://github.com/fbraz3/GeneralsX/wiki/Getting-the-Game-Files) explains how to get the files: copy them from a Windows PC with the Steam version, or download them with SteamCMD (Zero Hour app id 2732960, Generals 2229870).

The tweaker needs the `*.big` files in the Zero Hour folder. The base Generals folder is recommended too: some pictures and texts come from it.

## Intel Macs

GeneralsX is built for Apple Silicon only, so the game and the tweaker are not usable on Intel Macs.

## The game is in a different folder

The easiest fix is a link to the standard place, so both GeneralsX and the tweaker find the game:

```bash
mkdir -p ~/GeneralsX
ln -s "/path/to/Zero Hour" ~/GeneralsX/GeneralsZH
ln -s "/path/to/Generals" ~/GeneralsX/Generals
```

Or start the tweaker with explicit folders:

```bash
cd ~/Library/Application\ Support/ZH\ Tweaker/app
ZHT_GAME_ZH="/path/to/Zero Hour" ZHT_GAME_GEN="/path/to/Generals" node src/server.js
```

If `node` is not found, use `../node/bin/node`. Then open http://127.0.0.1:4170 and keep the Terminal window open.

## Language versions

- **English**: tested, fully works.
- **GeneralsX Russian patch** (`00RussianZH.big`) sits on top of the English version. The tweaker reads texts from the same archives, so Russian names should stay. Not tested yet.
- **German and other versions**: the tweaker writes texts to `Data/English/generals.csf`. Another language version may not read them, so Commander units may show raw labels like `OBJECT:...`. Gameplay is not affected.

## The app does not open or says it failed to start

1. Read the dialog: it shows the last lines of the log. The full log is `~/GeneralsX/zh-tweaker/server.log`.
2. **"Zero Hour files not found"**: see [The game is in a different folder](#the-game-is-in-a-different-folder).
3. **Port 4170 is busy**. Find out who uses it:

   ```bash
   lsof -nP -iTCP:4170 -sTCP:LISTEN
   ```

4. **The browser did not open** but the tweaker runs: open http://127.0.0.1:4170 yourself.
5. **The icon is broken or gone**: run the install command again.

## No Commander faction in the lobby

- Press **Apply** and wait for a message without errors.
- Quit the game completely (Cmd+Q) and start it again: the game reads files only at startup.
- Commander is available in Skirmish, not in the campaign.

## The game crashes after Apply

1. Open the tweaker and press **Reset all**. It removes every tweaker file from the game and restores the camera.
2. If the tweaker does not open, run the [uninstall](#uninstall) command: it also cleans the game.
3. Re-enable changes in small groups to find the one that breaks the game. Huge numbers and manual "full text" edits are the usual suspects.
4. [Report it](#reporting-a-bug).

## Online play, replays and saves

- **Do not play online with changes.** Your opponent has different data and the match will desync. Press **Reset all** before going online and **Apply** afterwards; your changes stay in the tweaker.
- **Replays** recorded with changes will not play back correctly without the same changes.
- **Saves** are safest to load with the same changes they were made with.

## Updating

- **Tweaker**: run the install command again. Your changes (`~/GeneralsX/zh-tweaker/tweaks.json`) are kept.
- **GeneralsX or the game files** were updated: open the tweaker and press **Apply** again.

## Moving or sharing your changes

All changes live in one file, `~/GeneralsX/zh-tweaker/tweaks.json`. Copy it to the same folder on another Mac (install the tweaker there first) and press **Apply**.

## Mods: Contra, TEOD and others

Only vanilla Zero Hour is supported for now. Contra and The End of Days support is planned. If a mod is installed into the same folder, remove it first.

## Is the install command safe?

The command downloads and runs [install.sh](https://github.com/deanlawkz/zh-tweaker/blob/main/install.sh). Read it first if you like:

```bash
curl -fsSL https://raw.githubusercontent.com/deanlawkz/zh-tweaker/main/install.sh | less
```

- No password, no `sudo`.
- Writes only to `~/Library/Application Support/ZH Tweaker`, `~/GeneralsX/zh-tweaker` and the app icon.
- Downloads only from github.com and nodejs.org; Node.js is checksum-verified.
- Game archives (`*.big`) are read, never modified.
- The tweaker page is reachable only from your Mac (127.0.0.1), and requests from other websites are rejected.

## Uninstall

```bash
curl -fsSL https://raw.githubusercontent.com/deanlawkz/zh-tweaker/main/uninstall.sh | bash
```

Removes tweaker files from the game (same as Reset all), the icon and the program. Your changes stay in `~/GeneralsX/zh-tweaker`. To remove them too:

```bash
curl -fsSL https://raw.githubusercontent.com/deanlawkz/zh-tweaker/main/uninstall.sh | bash -s -- --all
```

## Windows and Linux

Built and tested for Mac only.

## Reporting a bug

Open a [new issue](https://github.com/deanlawkz/zh-tweaker/issues/new/choose) with your Mac model and macOS version, GeneralsX version and game language, what you did and what happened, and the last lines of `~/GeneralsX/zh-tweaker/server.log`.
