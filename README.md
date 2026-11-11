# Nova Explorer ⚡

A **fast, sleek, modern file explorer** that runs entirely in the browser — rebuilt from scratch to replace the old chat app in this repo. Inspired by Sigma File Manager (see the Quick View with filmstrip), rebuilt with a cleaner UI, smooth animations, and zero dependencies.

![Stack](https://img.shields.io/badge/stack-vanilla%20JS%20%2B%20CSS-no%20build%20step-purple)

## ✨ Features

- **Sleek modern dark UI** (plus light theme) — glassy panels, gradient accents, smooth staggered animations everywhere
- **Quick View** — press `Space` on any file for a big preview with a **filmstrip** of sibling files, `←` / `→` to flip through (just like the screenshot)
- **Grid & List views** — list has `NAME · ITEMS · SIZE · MODIFIED · KIND` columns like Sigma, clickable to sort
- **Tabs + history** — multiple tabs (`Ctrl+T`), back/forward/up navigation, editable breadcrumb path
- **Real files from your PC**
  - **Open folder from PC** — browse a real folder on your computer via the File System Access API (Chrome/Edge)
  - **Drag & drop / Upload** real files into the library and preview them instantly (images, video, audio, text/code)
- **Full file operations** — new folder/file, rename (`F2`), delete → Trash (with Undo), restore, delete forever, copy/cut/paste (`Ctrl+C/X/V`), duplicate, multi-select (`Ctrl`/`Shift`/rubber-band drag), drag items onto folders/sidebar to move them
- **Search, filter & sort** — instant search (`/`), type filter, sort by name/size/date/kind
- **Preview pane** (`Ctrl+P`), **Properties**, **Starred**, **Tags**, **Recent**, **Trash**, storage meter with breakdown
- **Command palette** (`Ctrl+K`) — run any action or jump to any file by typing
- **Keyboard-first** — arrow-key navigation, `Ctrl+A`, `Del`, `?` for the full shortcut list
- **Persistent library** — your virtual library is saved in `localStorage`; use *Settings → Reset demo library* to restore the samples

## 🚀 Run it

No build step, no dependencies — it's just static files in `public/`:

```bash
# any static server works
python3 -m http.server 5173 --directory public
# then open http://localhost:5173
```

Or deploy with Firebase Hosting (config already in `firebase.json`):

```bash
firebase deploy
```

## ⌨️ Shortcuts

| Key | Action |
|---|---|
| `Space` | Quick View (close with `Space`/`Esc`, flip with `←`/`→`) |
| `Ctrl+K` | Command palette |
| `Ctrl+T` | New tab |
| `/` | Search |
| `Ctrl+A` / `Ctrl+C` / `Ctrl+X` / `Ctrl+V` | Select all / Copy / Cut / Paste |
| `F2` / `Del` | Rename / Delete |
| `Alt+←/→/↑` | Back / Forward / Up |
| `Ctrl+1` / `Ctrl+2` | Grid / List view |
| `T` / `?` | Toggle theme / All shortcuts |

## 📁 Project structure

```
public/
  index.html   # app shell: sidebar, tabs, toolbar, Quick View, palette, modals
  style.css    # all styling, themes & animations (no frameworks)
  app.js       # the whole explorer: virtual FS, real-folder API, rendering, shortcuts
firebase.json  # Firebase Hosting config (serves public/, SPA rewrite)
```

> Browsers: best experience in Chrome/Edge (real-folder browsing). Firefox/Safari fully support the library, uploads and drag & drop.
