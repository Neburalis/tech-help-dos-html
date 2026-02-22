# TECH Help! 6.0 — HTML Edition

A static HTML documentation site — a faithful conversion of the **TECH Help! 6.0** DOS reference manual (Dan Rollins, 1994) to a modern web format. Contains **1036 numbered pages** covering x86 interrupts, DOS functions, BIOS services, hardware programming, and memory layout.

## Features

- **Single-Page Application** — `index.html` is the only entry point; all navigation happens client-side via hash routing
- **Full-text search** powered by [lunr.js](https://lunrjs.com/) with a pre-built index (`pages.json`)
- **Dark terminal theme** — styled to evoke the look of a classic DOS help viewer
- **Works offline** — can be opened directly from the filesystem (`file://` protocol supported via iframe fallback)
- **Back / Forward navigation** with in-memory history stack

## Quick Start

### Local development

```bash
python3 -m http.server 8080
# open http://localhost:8080/index.html
```

Or simply open `index.html` directly in a browser — the SPA detects `file://` and uses an iframe-based loader automatically.

### Docker

```bash
docker compose up -d
```

The included `Dockerfile` builds an `nginx:alpine` image with all static assets. `nginx.conf` provides gzip compression and per-type cache headers.

## File Structure

| Path | Description |
|---|---|
| `index.html` | SPA shell — the single entry point |
| `tehhelp.js` | SPA engine: navigation, history, content injection |
| `style.css` | Dark terminal theme, DOS colour classes, layout |
| `pages.json` | Full-text search index (array of `{id, t, b}` objects) |
| `pages/` | 1036 content pages (`1-logo.html` … `1036-unable_to_display.html`) |

## Architecture

### SPA Navigation

- Hash-based routing (`#pages/foo.html`) — no server-side rewrite needed
- On `http(s)://`: uses `fetch()` to load pages
- On `file://`: uses a hidden `<iframe>` (browsers block fetch on local files)
- Content extraction pulls `<title>`, `<h1>`, and `<pre>` innerHTML from each page and injects them into the shell
- Internal links are intercepted and handled client-side; external links open in a new tab

### CSS Layout

- `body.spa-shell` activates the flex shell layout (header + nav bars + scrollable content area)
- `body:not(.spa-shell)` styles standalone pages (centred, padded)
- DOS colour classes `.c1`–`.c5` preserve the original colour scheme adapted for a dark theme

## Credits

- **Original work:** *TECH Help! 6.0* by Dan Rollins, Flambeaux Software, 1994

## License

- **Pages content:** The TECH Help! reference material is © Dan Rollins / Flambeaux Software. Provided here for archival and educational purposes.
- **Navigation & search code** (`index.html`, `tehhelp.js`, `style.css`): [GNU General Public License v3.0](https://www.gnu.org/licenses/gpl-3.0.html)
