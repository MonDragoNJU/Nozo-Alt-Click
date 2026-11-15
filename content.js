// Nozo Content Script
//
// Alt + click (Option + click on macOS) on any link opens it in a preview
// modal instead of navigating.

const runtimeAPI = (typeof browser !== 'undefined' ? browser : chrome).runtime;

/**
 * Returns the http(s) URL to preview for a click event, or null if the click
 * should be left alone.
 */
function getPreviewUrl(event) {
    // Only real user clicks: page scripts must not be able to trigger a
    // preview (which relaxes framing protections for that domain).
    if (!event || !event.isTrusted) return null;
    if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null;
    if (event.button !== 0) return null;

    let target = event.target;
    if (target && target.nodeType === 3) target = target.parentNode;
    if (!target || typeof target.closest !== 'function') return null;

    const anchor = target.closest('a[href]');
    if (!anchor) return null;

    // SVG <a> elements expose href as an SVGAnimatedString.
    const rawHref = typeof anchor.href === 'string'
        ? anchor.href
        : anchor.href && anchor.href.baseVal;
    if (!rawHref) return null;

    let url;
    try {
        url = new URL(rawHref, document.baseURI);
    } catch {
        return null;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        console.warn('Nozo: Blocked potentially unsafe URL:', rawHref);
        return null;
    }
    return url.href;
}

async function sendToBackground(message) {
    try {
        const response = await runtimeAPI.sendMessage(message);
        return Boolean(response && response.ok);
    } catch (err) {
        console.warn('Nozo: Background request failed', err);
        return false;
    }
}

function initNozo() {
    if (document.getElementById('nozo-overlay-container')) {
        return null;
    }

    // Build overlay container
    const overlayContainer = document.createElement('div');
    overlayContainer.id = 'nozo-overlay-container';

    const wrapper = document.createElement('div');
    wrapper.id = 'nozo-wrapper';

    const controls = document.createElement('div');
    controls.id = 'nozo-controls';

    const maxBtn = document.createElement('button');
    maxBtn.className = 'nozo-btn nozo-maximize-btn';
    maxBtn.title = 'Open in New Tab';
    maxBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'nozo-btn nozo-close-btn';
    closeBtn.title = 'Close';
    closeBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'nozo-btn nozo-copy-btn';
    copyBtn.title = 'Copy URL';
    const copyIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
    const checkIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    copyBtn.innerHTML = copyIcon;

    controls.appendChild(maxBtn);
    controls.appendChild(closeBtn);
    controls.appendChild(copyBtn);

    const modal = document.createElement('div');
    modal.id = 'nozo-modal';

    const iframe = document.createElement('iframe');
    iframe.id = 'nozo-iframe';
    iframe.src = 'about:blank';

    modal.appendChild(iframe);
    wrapper.appendChild(controls);
    wrapper.appendChild(modal);
    overlayContainer.appendChild(wrapper);

    document.body.appendChild(overlayContainer);

    const overlay = overlayContainer;
    let currentUrl = null;
    let closeTimer = null;
    let frameRuleActive = false;

    function revokeFrameRule() {
        if (!frameRuleActive) return;
        frameRuleActive = false;
        sendToBackground({ action: 'nozo:revokeFrame' });
    }

    function closeNozo() {
        if (!currentUrl) return;
        currentUrl = null;
        overlay.classList.remove('visible');
        clearTimeout(closeTimer);
        closeTimer = setTimeout(() => {
            iframe.src = 'about:blank';
            // Restore framing protections for this tab.
            revokeFrameRule();
        }, 350);
    }

    async function openNozo(url) {
        clearTimeout(closeTimer);
        currentUrl = url;
        overlay.classList.add('visible');
        // Allow this domain to be framed in this tab before loading it.
        // If it fails, still try: many sites allow framing anyway.
        frameRuleActive = true;
        await sendToBackground({ action: 'nozo:allowFrame', url });
        if (currentUrl === url) {
            iframe.src = url;
        }
    }

    function handleClick(event) {
        const url = getPreviewUrl(event);
        if (!url) return;
        // Stop the normal navigation (and Chrome's Alt+click "download link").
        event.preventDefault();
        event.stopImmediatePropagation();
        openNozo(url);
    }

    // Capture phase so we run before the page's own (e.g. SPA router) handlers.
    window.addEventListener('click', handleClick, true);

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeNozo();
    });

    closeBtn.addEventListener('click', closeNozo);

    maxBtn.addEventListener('click', () => {
        if (currentUrl) window.open(currentUrl, '_blank', 'noopener');
        closeNozo();
    });

    copyBtn.addEventListener('click', async () => {
        if (!currentUrl) return;
        try {
            await navigator.clipboard.writeText(currentUrl);
            copyBtn.innerHTML = checkIcon;
            copyBtn.classList.add('copied');
            setTimeout(() => {
                copyBtn.innerHTML = copyIcon;
                copyBtn.classList.remove('copied');
            }, 1500);
        } catch (err) {
            console.error('Nozo: Failed to copy URL', err);
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay.classList.contains('visible')) {
            closeNozo();
        }
    });

    // Never leave framing protections relaxed after leaving the page.
    window.addEventListener('pagehide', revokeFrameRule);

    return { openNozo, closeNozo, handleClick };
}

// Export for testing or auto-run
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initNozo, getPreviewUrl };
} else {
    initNozo();
}
