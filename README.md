<div align="center">

# ◫ KANBANI

**A fast, native, offline-first Kanban board for your desktop.**

No accounts. No cloud. No browser tab. Just a clean board and a local database.

[![Tauri](https://img.shields.io/badge/Tauri-2.x-24C8DB?logo=tauri&logoColor=white)](https://tauri.app)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Rust](https://img.shields.io/badge/Rust-1.95-000000?logo=rust&logoColor=white)](https://www.rust-lang.org)
[![SQLite](https://img.shields.io/badge/SQLite-bundled-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org)

</div>

---

## Overview

KANBANI is a true **native desktop application** — not an Electron-style browser wrapper. It pairs a Rust backend with a React/TypeScript UI through [Tauri](https://tauri.app), producing a single small binary (~5 MB) that starts fast and stores everything **locally in SQLite**. Your data never leaves your machine.

## ✨ Features

- **Multiple boards** — organize different projects, switch instantly from the sidebar.
- **Columns & cards** — every board starts with *To Do · In Progress · Done*; add, rename, and delete columns freely.
- **Drag & drop** — move cards within a column or across columns; order is persisted immediately.
- **Card details** — click any card to edit its title and a longer description, with created/updated timestamps.
- **Zoom** — scale the whole UI from 50 % to 200 % (`Ctrl +` / `Ctrl -` / `Ctrl 0`, or `Ctrl` + scroll). The level persists.
- **100 % local & offline** — a single SQLite file on disk; no network, no telemetry, no login.
- **Professional dark UI** — refined spacing, indigo accent, hover states, and custom scrollbars.

## ⌨️ Keyboard shortcuts

| Action        | Shortcut                          |
| ------------- | --------------------------------- |
| Zoom in       | `Ctrl` `+`  ·  `Ctrl` + scroll up   |
| Zoom out      | `Ctrl` `-`  ·  `Ctrl` + scroll down |
| Reset zoom    | `Ctrl` `0`                        |
| Rename board  | Double-click a board in the sidebar |
| Rename column | Double-click a column title       |

## 🧱 Tech stack

| Layer        | Technology                                            |
| ------------ | ----------------------------------------------------- |
| Native shell | [Tauri 2](https://tauri.app) (Rust, system WebView)   |
| Backend      | Rust + [`rusqlite`](https://crates.io/crates/rusqlite) (SQLite bundled into the binary) |
| Frontend     | [React 19](https://react.dev) + TypeScript + [Vite](https://vitejs.dev) |
| Drag & drop  | [`@dnd-kit`](https://dndkit.com)                      |
| Storage      | SQLite (single local file)                            |

## 📦 Project structure

```
KANBANI/
├─ README.md
├─ .gitignore
└─ kanban/                    # the application
   ├─ index.html
   ├─ package.json
   ├─ src/                    # React frontend
   │  ├─ App.tsx              # UI: boards, columns, cards, drag & drop, zoom
   │  ├─ api.ts               # typed wrappers around Tauri commands
   │  ├─ types.ts             # shared TypeScript models
   │  └─ App.css              # theme & styling
   └─ src-tauri/             # Rust backend
      ├─ src/
      │  ├─ lib.rs            # Tauri commands + managed SQLite connection
      │  └─ db.rs             # schema, queries, persistence (+ tests)
      ├─ Cargo.toml
      └─ tauri.conf.json      # window, bundle & metadata config
```

## 🚀 Getting started

### Prerequisites

- **Node.js** 18+ and **npm**
- **Rust** (stable) via [rustup](https://rustup.rs)
- **System WebView & build deps** — on Arch Linux:
  ```bash
  sudo pacman -S --needed webkit2gtk-4.1 base-devel curl wget file \
    openssl appmenu-gtk-module libappindicator-gtk3 librsvg
  ```
  For other platforms see the [Tauri prerequisites guide](https://tauri.app/start/prerequisites/).

### Install & run (development)

```bash
cd kanban
npm install
npm run tauri dev
```

> The first `tauri dev` compiles the Rust backend (including bundled SQLite from C), so it takes a few minutes. Subsequent runs are fast.

## 🏗️ Building a release

```bash
cd kanban
npm run tauri build
```

This produces an optimized native binary plus installers under `kanban/src-tauri/target/release/`:

| Artifact            | Location                                  | Notes                          |
| ------------------- | ----------------------------------------- | ------------------------------ |
| Native binary       | `release/kanban`                          | ~5 MB, fastest startup         |
| Debian package      | `release/bundle/deb/*.deb`                | Debian/Ubuntu                  |
| RPM package         | `release/bundle/rpm/*.rpm`                | Fedora/RHEL                    |
| AppImage (portable) | `release/bundle/appimage/*.AppImage`      | Self-contained, runs anywhere  |

### ⚠️ AppImage on Arch / modern toolchains

If the AppImage stage fails with `failed to run linuxdeploy` and a `strip … unknown type [0x13] section .relr.dyn` error, it's a known incompatibility between `linuxdeploy`'s bundled `strip` and modern binutils. Disable stripping:

```bash
NO_STRIP=true npm run tauri build
```

> **Tip:** on Linux the **native binary** (or `.deb`/`.rpm`) starts noticeably faster than the AppImage, which has to mount its filesystem on every launch.

### Desktop menu integration (Linux)

To launch KANBANI from your application menu, copy the binary somewhere stable and add a `.desktop` entry:

```bash
mkdir -p ~/Applications ~/.local/share/applications ~/.local/share/icons/hicolor/128x128/apps
cp kanban/src-tauri/target/release/kanban ~/Applications/kanbani
cp kanban/src-tauri/icons/128x128.png ~/.local/share/icons/hicolor/128x128/apps/kanbani.png

cat > ~/.local/share/applications/kanbani.desktop <<'EOF'
[Desktop Entry]
Type=Application
Name=KANBANI
Comment=A native local Kanban board
Exec=/home/USER/Applications/kanbani
Icon=kanbani
Terminal=false
Categories=Office;ProjectManagement;Utility;
StartupWMClass=kanban
EOF

update-desktop-database ~/.local/share/applications
```

*(replace `USER` with your username)*

## 🪟🍎🐧 Cross-platform: Windows & macOS

KANBANI runs on **Windows, macOS, and Linux from this same source code** — no code changes required. Tauri, React, and `rusqlite` (with the `bundled` SQLite feature) are all fully portable, and the app-data path resolves correctly per OS (see the data table below).

**The one catch:** Tauri links against each platform's *native* WebView, so cross-compiling isn't practical — you build **on** the target OS. The command is identical everywhere:

```bash
cd kanban
npm install
npm run tauri build
```

| Target      | Build on  | Prerequisites                                                                 | Installers produced            |
| ----------- | --------- | ---------------------------------------------------------------------------- | ------------------------------ |
| **Windows** | Windows   | Rust, Node, MSVC Build Tools, [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/) (preinstalled on Win 10/11) | `.exe`, `.msi`, NSIS installer |
| **macOS**   | macOS     | Rust, Node, Xcode Command Line Tools                                          | `.app`, `.dmg`                 |
| **Linux**   | Linux     | see [Prerequisites](#prerequisites)                                           | binary, `.deb`, `.rpm`, AppImage |

> The `NO_STRIP=true` workaround above is **Linux/AppImage-only** — ignore it on Windows and macOS.

### Build all three from one place (CI)

If you don't have a Mac or Windows PC, the official [`tauri-action`](https://github.com/tauri-apps/tauri-action) GitHub Actions workflow builds for all three platforms in the cloud and attaches the installers to a release when you push a version tag.

### Signing (optional, for distribution)

- **macOS:** to avoid Gatekeeper warnings, the `.app` should be code-signed and notarized with an Apple Developer account ($99/yr). Unsigned apps still run — users right-click → **Open** the first time.
- **Windows:** an unsigned `.exe` may trigger a SmartScreen prompt; a code-signing certificate removes it.

## 💾 Where is my data?

KANBANI stores everything in a single SQLite file in the OS app-data directory:

| Platform | Path                                                            |
| -------- | -------------------------------------------------------------- |
| Linux    | `~/.local/share/com.vighnesh.kanban/kanban.db`                 |
| macOS    | `~/Library/Application Support/com.vighnesh.kanban/kanban.db`  |
| Windows  | `%APPDATA%\com.vighnesh.kanban\kanban.db`                      |

Back it up by copying that file. Reinstalling or updating the app does **not** touch it.

## 🧠 Architecture notes

- The Rust backend owns the database behind a `Mutex<Connection>` managed by Tauri and exposes typed **commands** (`list_boards`, `create_card`, `move_card`, …) invoked from the frontend via `@tauri-apps/api`.
- Card ordering uses a simple integer `position` per column; a move reindexes the affected column inside a single transaction — robust and easy to reason about for a local single-user board.
- `db.rs` includes a persistence test that writes data, drops the connection (simulating an app restart), reopens the file, and asserts the data survives. Run it with `cd kanban/src-tauri && cargo test`.

## 🧪 Running tests

```bash
cd kanban/src-tauri
cargo test
```

## 👤 Author

**Created by Vighnesh Shukla.**

---

<div align="center">
<sub>Built with Tauri · React · Rust · SQLite</sub>
</div>
