<p align="center">
  <img src="icons/image.png" alt="Nozo Logo" width="128" height="128">
</p>

<p align="center">
  <a href="https://github.com/RayZ3R0/nozo/releases"><img src="https://img.shields.io/github/v/release/RayZ3R0/nozo?style=flat-square" alt="GitHub release (latest by date)"></a>
  <a href="https://github.com/RayZ3R0/nozo/blob/main/LICENSE"><img src="https://img.shields.io/github/license/RayZ3R0/nozo?style=flat-square" alt="GitHub License"></a>
  <img src="https://img.shields.io/github/downloads/RayZ3R0/nozo/total?style=flat-square&color=blue" alt="Total Downloads">
  <img src="https://img.shields.io/github/repo-size/RayZ3R0/nozo?style=flat-square" alt="Repo Size">
  <img src="https://img.shields.io/badge/manifest-v3-orange?style=flat-square" alt="Manifest V3">
</p>

<h1 align="center">Nozo</h1>

> Fork of [RayZ3R0/nozo](https://github.com/RayZ3R0/nozo). Main changes:
> - **Alt + Click** (Option + Click on macOS) replaces drag and drop.
> - **Safer framing:** `X-Frame-Options` / `Content-Security-Policy` are removed only for the previewed domain, only in the current tab, and only while the preview is open — instead of on every iframe of every site.
<p align="center">
  <strong>Effortless Link Previewing for Modern Browsers</strong>
</p>

<p align="center">
  Preview links instantly without leaving your current context. Hold <kbd>Alt</kbd> (<kbd>Option</kbd> on macOS) and click any link to peek at it in a lightweight modal window.
</p>

<br>

## Overview

Nozo enhances your browsing workflow by allowing you to "peek" at links before navigating. Simply <kbd>Alt</kbd> + click any link to open it in a non-intrusive modal overlay. A normal click keeps working as usual. Close the preview with <kbd>Esc</kbd>, the close button, or by clicking outside it.

## Key Features

*   **Seamless Interaction**: <kbd>Alt</kbd> + click to preview; regular clicks are untouched. Only real user clicks trigger a preview — page scripts cannot.
*   **Security First**: Automatically sanitizes URLs and blocks unsafe protocols like `javascript:`.
*   **Scoped Header Handling**: To let a site load inside the preview, Nozo removes its `X-Frame-Options` / `Content-Security-Policy` headers **only for the domain being previewed, only in that tab, and only while the preview is open**. Every other iframe on every other site keeps its clickjacking protection. Everything happens locally, with no tracking or external servers.
*   **Lightweight**: Minimal resource footprint with no background processes when idle.

## Installation

### Firefox (Manual Install)
   > **Note**: As this is an unsigned extension, you will need to use **Firefox Developer Edition** / **Nightly** to install it permanently.
1. Type `about:config` in the address bar and accept the risk.
2. Search for `xpinstall.signatures.required`.
3. Toggle the value to `false`.
4. Download `nozo-firefox.xpi` from the [Releases](../../releases) page.
5. Go to `about:addons`.
6. Click on the cogwheel and select "Install Add-on From File...".
7. Select the downloaded `.xpi` file.


### Chrome / Edge / Brave (From Release)
1.  Navigate to the [Releases](../../releases) page.
2.  Download the `extension.zip` asset from the latest version.
3.  Extract the archive to a preferred location.
4.  Open your browser's extensions page (`chrome://extensions` or `edge://extensions`).
5.  Enable **Developer mode** in the top right corner.
6.  Select **Load unpacked** and choose the extracted folder.

### From Source
1.  Clone this repository:
    ```bash
    git clone https://github.com/RayZ3R0/nozo.git
    cd nozo
    ```
2.  Follow steps 4-6 above, selecting the repository root directory.

### Known limitations
*   On some Linux desktops <kbd>Alt</kbd> + click is captured by the window manager (to move windows) before it reaches the browser. Disable that shortcut or change its modifier in your desktop settings.
*   If a previewed page redirects to a completely different domain, that second domain may refuse to load inside the preview. Use the "Open in New Tab" button in that case.

## Development

### Prerequisites
*   Node.js 18+
*   npm

### Setup
```bash
npm install
```

### Testing
We utilize **Jest** for unit testing and **Playwright** for robust End-to-End (E2E) validation.

```bash
# Run unit tests
npm test

# Run E2E tests (requires Chromium)
npx playwright install chromium
npm run test:e2e
```

### Packaging
To generate a production-ready artifact:

```bash
npm run pack
```
This command produces an optimized `extension.zip` in the project root, excluding development files.

## License

[MIT](LICENSE) © 2025 RayZ3R0
