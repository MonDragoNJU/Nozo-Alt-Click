# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Changed
- **Alt + Click to Preview**: Links are now previewed with Alt + click (Option + click on macOS) instead of drag and drop. Normal clicks are unaffected, and synthetic clicks from page scripts are ignored.

### Removed
- Drop zone and its options page (drop zone position setting), and the unused `storage` permission.

### Security
- **Scoped header stripping**: Previously a global, persistent rule removed `X-Frame-Options` and `Content-Security-Policy` from every iframe on every site, disabling clickjacking protection browser-wide. Headers are now removed through a session rule limited to the previewed domain, the current tab, and the lifetime of the preview. The old global rule is deleted automatically on update.
- "Open in New Tab" now uses `noopener`.

## [1.0.10] - 2025-12-21
### Added
- **Option for Full Screen Drop Window**: New setting to select full screen drop window for link previews.

## [1.0.8] - 2025-12-20
### Added
- **Options Page**: New settings page accessible via extension options with customizable drop zone position (Bottom Center, Bottom Left, Bottom Right, Top Center).

## [1.0.6] - 2025-12-20
### Added
- **Copy URL Button**: New control button to copy the previewed page URL to clipboard with visual feedback (checkmark icon on success).

## [1.0.5] - 2025-12-20
### Added
- **Official Firefox Support**: Implemented dedicated `manifest.firefox.json` and build scripts to generate valid `.xpi` files. 
- **Cross-Browser Compatibility**: Refactored `background.js` to seamlessly support both Chrome's `chrome.*` and Firefox's `browser.*` APIs.
- **Build System**: Added `npm run pack:firefox` to generate Firefox-specific artifacts automatically.

### Fixed
- Fixed `release.yml` workflow syntax error preventing release creation.
- Resolved `eslint` errors by adding proper web extension globals.
- Updated `version-sync.js` to keep both manifest files in sync.

## [1.0.3] - 2025-12-18
### Added
- Added experimental Firefox support (.xpi build and compat settings).
- Updated README with Firefox installation steps.

## [1.0.2] - 2025-12-18
### Fixed
- Fixed visual artifact (thin line) on the left/top of the peek window by removing the default iframe border.

## [1.0.1] - 2025-12-18
### Fixed
- Fixed `E2E` testing workflow by adding correct Playwright browser installation.
- Fixed `release.yml` permissions to allow creating releases.
- Fixed `Playwright` headless configuration for extension compatibility.

## [1.0.0] - 2025-12-18
### Added
- Initial release.
- **Link Peek**: Drag & Drop links to preview them.
- **Security**: Blocks `javascript:` URLs.
- **Testing**: Added Unit (Jest) and E2E (Playwright) test suites.
- **CI/CD**: Added GitHub Actions for testing and automated releases.
