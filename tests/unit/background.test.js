// Mock Chrome API before loading the background script
const listeners = {};
global.chrome = {
    runtime: {
        id: 'nozo-test-id',
        onMessage: { addListener: jest.fn((fn) => { listeners.message = fn; }) },
        onInstalled: { addListener: jest.fn((fn) => { listeners.installed = fn; }) },
    },
    tabs: {
        onRemoved: { addListener: jest.fn((fn) => { listeners.removed = fn; }) },
    },
    declarativeNetRequest: {
        updateSessionRules: jest.fn(() => Promise.resolve()),
        updateDynamicRules: jest.fn(() => Promise.resolve()),
    },
};

const { getFrameDomain, buildRule, handleMessage, LEGACY_RULE_ID } = require('../../background');
const dnr = chrome.declarativeNetRequest;

const sender = (overrides = {}) => ({ id: 'nozo-test-id', frameId: 0, tab: { id: 42 }, ...overrides });

function send(request, from = sender()) {
    return new Promise((resolve) => {
        const async = handleMessage(request, from, resolve);
        if (!async) resolve('ignored');
    });
}

beforeEach(() => jest.clearAllMocks());

describe('getFrameDomain', () => {
    test.each([
        ['https://www.google.com/search?q=x', 'google.com'],
        ['http://Docs.GitHub.com/en', 'docs.github.com'],
        ['https://example.com', 'example.com'],
    ])('%s -> %s', (url, domain) => {
        expect(getFrameDomain(url)).toBe(domain);
    });

    test.each(['javascript:alert(1)', 'file:///etc/passwd', 'not a url', ''])('rejects %s', (url) => {
        expect(getFrameDomain(url)).toBeNull();
    });
});

describe('buildRule', () => {
    test('is scoped to one tab, one domain and sub_frames only', () => {
        const rule = buildRule(42, 'example.com');
        expect(rule.id).toBe(42);
        expect(rule.condition).toEqual({
            requestDomains: ['example.com'],
            resourceTypes: ['sub_frame'],
            tabIds: [42],
        });
        expect(rule.condition.urlFilter).toBeUndefined();
    });
});

describe('messages', () => {
    test('allowFrame adds a session rule for the sender tab', async () => {
        await expect(send({ action: 'nozo:allowFrame', url: 'https://www.example.com/a' })).resolves.toEqual({ ok: true });
        expect(dnr.updateSessionRules).toHaveBeenCalledWith({
            removeRuleIds: [42],
            addRules: [buildRule(42, 'example.com')],
        });
        expect(dnr.updateDynamicRules).not.toHaveBeenCalled();
    });

    test('allowFrame refuses unsafe URLs', async () => {
        await expect(send({ action: 'nozo:allowFrame', url: 'javascript:alert(1)' })).resolves.toEqual({ ok: false });
        expect(dnr.updateSessionRules).not.toHaveBeenCalled();
    });

    test('revokeFrame removes the tab rule', async () => {
        await expect(send({ action: 'nozo:revokeFrame' })).resolves.toEqual({ ok: true });
        expect(dnr.updateSessionRules).toHaveBeenCalledWith({ removeRuleIds: [42] });
    });

    test.each([
        ['no tab', { tab: undefined }],
        ['a sub-frame', { frameId: 3 }],
        ['another extension', { id: 'evil' }],
    ])('ignores messages from %s', async (_name, overrides) => {
        await expect(send({ action: 'nozo:allowFrame', url: 'https://example.com' }, sender(overrides))).resolves.toBe('ignored');
        expect(dnr.updateSessionRules).not.toHaveBeenCalled();
    });

    test('ignores unknown actions', async () => {
        await expect(send({ action: 'other' })).resolves.toBe('ignored');
    });
});

describe('lifecycle', () => {
    test('on install/update removes the old global rule', async () => {
        await listeners.installed();
        expect(dnr.updateDynamicRules).toHaveBeenCalledWith({ removeRuleIds: [LEGACY_RULE_ID] });
    });

    test('closing a tab removes its rule', () => {
        listeners.removed(7);
        expect(dnr.updateSessionRules).toHaveBeenCalledWith({ removeRuleIds: [7] });
    });
});
