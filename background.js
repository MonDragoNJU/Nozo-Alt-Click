// Nozo background script
//
// Security model:
// Sites protect themselves from being framed (clickjacking) with the
// X-Frame-Options and Content-Security-Policy (frame-ancestors) headers.
// Nozo needs to strip those headers so the preview iframe can load, but it
// must NOT do so globally. Instead, we add a short-lived *session* rule that
// only applies to:
//   - sub_frame requests,
//   - in the single tab where the user triggered a preview,
//   - to the domain being previewed,
// and remove it as soon as the preview is closed, the page unloads or the
// tab is closed.

const nativeAPI = typeof browser !== 'undefined' ? browser : chrome;
const dnr = nativeAPI.declarativeNetRequest;

// Rule id used by versions <= 1.0.10, which installed a global, persistent
// dynamic rule stripping headers on every iframe. We remove it on update.
const LEGACY_RULE_ID = 1;

/**
 * Returns the domain to allow framing for, or null if the URL is not a
 * valid http(s) URL. A leading "www." is dropped so that redirects such as
 * www.example.com -> example.com keep working (requestDomains also matches
 * subdomains).
 */
function getFrameDomain(url) {
    let parsed;
    try {
        parsed = new URL(url);
    } catch {
        return null;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return null;
    }
    const host = parsed.hostname.toLowerCase();
    if (!host) return null;
    return host.startsWith('www.') ? host.slice(4) : host;
}

/** Session rule allowing `domain` to be framed only inside `tabId`. */
function buildRule(tabId, domain) {
    return {
        // One rule per tab: tab ids are positive integers, so they make
        // natural, unique rule ids and a new preview replaces the old rule.
        id: tabId,
        priority: 1,
        action: {
            type: 'modifyHeaders',
            responseHeaders: [
                { header: 'X-Frame-Options', operation: 'remove' },
                { header: 'Content-Security-Policy', operation: 'remove' }
            ]
        },
        condition: {
            requestDomains: [domain],
            resourceTypes: ['sub_frame'],
            tabIds: [tabId]
        }
    };
}

async function allowFrame(tabId, url) {
    const domain = getFrameDomain(url);
    if (!domain || !Number.isInteger(tabId) || tabId < 0) {
        return false;
    }
    await dnr.updateSessionRules({
        removeRuleIds: [tabId],
        addRules: [buildRule(tabId, domain)]
    });
    return true;
}

async function revokeFrame(tabId) {
    if (!Number.isInteger(tabId) || tabId < 0) return;
    await dnr.updateSessionRules({ removeRuleIds: [tabId] });
}

async function removeLegacyRule() {
    try {
        await dnr.updateDynamicRules({ removeRuleIds: [LEGACY_RULE_ID] });
    } catch (error) {
        console.error('Nozo: Failed to remove legacy rule', error);
    }
}

function handleMessage(request, sender, sendResponse) {
    // Only accept messages from our own content script running in the top
    // frame of a tab. Web pages cannot message the extension directly.
    if (!request || !sender || !sender.tab || sender.frameId !== 0 ||
        sender.id !== nativeAPI.runtime.id) {
        return false;
    }
    const tabId = sender.tab.id;

    let task;
    if (request.action === 'nozo:allowFrame') {
        task = allowFrame(tabId, request.url);
    } else if (request.action === 'nozo:revokeFrame') {
        task = revokeFrame(tabId).then(() => true);
    } else {
        return false;
    }

    task
        .then((ok) => sendResponse({ ok: Boolean(ok) }))
        .catch((error) => {
            console.error('Nozo: Failed to update frame rule', error);
            sendResponse({ ok: false });
        });
    return true; // keep the channel open for the async response
}

nativeAPI.runtime.onMessage.addListener(handleMessage);
nativeAPI.runtime.onInstalled.addListener(removeLegacyRule);

// Clean up when the tab goes away (rules are session-scoped anyway, but a
// closed tab should never leave a rule behind for a reused tab id).
nativeAPI.tabs.onRemoved.addListener((tabId) => {
    revokeFrame(tabId).catch(() => { });
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getFrameDomain, buildRule, allowFrame, revokeFrame, handleMessage, LEGACY_RULE_ID };
}
