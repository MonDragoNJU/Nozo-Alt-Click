/**
 * @jest-environment jsdom
 */

// Mock Chrome API
global.chrome = {
    runtime: {
        sendMessage: jest.fn(() => Promise.resolve({ ok: true })),
    },
};

const { initNozo, getPreviewUrl } = require('../../content');

// jsdom marks dispatched events as untrusted (isTrusted is unforgeable), so
// we feed plain objects that look like a trusted click.
function fakeClick(target, overrides = {}) {
    return {
        isTrusted: true,
        altKey: true,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        button: 0,
        target,
        preventDefault: jest.fn(),
        stopImmediatePropagation: jest.fn(),
        ...overrides,
    };
}

function makeLink(href) {
    const link = document.createElement('a');
    link.setAttribute('href', href);
    link.textContent = 'link';
    document.body.appendChild(link);
    return link;
}

describe('getPreviewUrl', () => {
    afterEach(() => { document.body.innerHTML = ''; });

    test('returns the URL for Alt + left click on a link', () => {
        const link = makeLink('https://example.com');
        expect(getPreviewUrl(fakeClick(link))).toBe('https://example.com/');
    });

    test('works when clicking an element nested inside the link', () => {
        const link = makeLink('https://example.com/page');
        const span = document.createElement('span');
        link.appendChild(span);
        expect(getPreviewUrl(fakeClick(span))).toBe('https://example.com/page');
    });

    test('resolves relative links', () => {
        const link = makeLink('/relative');
        expect(getPreviewUrl(fakeClick(link))).toBe(new URL('/relative', document.baseURI).href);
    });

    test.each([
        ['no Alt key', { altKey: false }],
        ['Ctrl also pressed', { ctrlKey: true }],
        ['Meta also pressed', { metaKey: true }],
        ['Shift also pressed', { shiftKey: true }],
        ['middle button', { button: 1 }],
        ['untrusted (synthetic) event', { isTrusted: false }],
    ])('ignores click with %s', (_name, overrides) => {
        const link = makeLink('https://example.com');
        expect(getPreviewUrl(fakeClick(link, overrides))).toBeNull();
    });

    test('ignores clicks outside links', () => {
        const div = document.createElement('div');
        document.body.appendChild(div);
        expect(getPreviewUrl(fakeClick(div))).toBeNull();
    });

    test.each([
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'file:///etc/passwd',
    ])('blocks unsafe protocol %s', (href) => {
        jest.spyOn(console, 'warn').mockImplementation(() => { });
        const link = makeLink(href);
        expect(getPreviewUrl(fakeClick(link))).toBeNull();
        console.warn.mockRestore();
    });
});

describe('Nozo modal', () => {
    let api;

    beforeEach(() => {
        jest.useFakeTimers({ doNotFake: ['setImmediate', 'queueMicrotask'] });
        document.body.innerHTML = '';
        chrome.runtime.sendMessage.mockClear();
        api = initNozo();
    });

    afterEach(() => {
        jest.useRealTimers();
        document.body.innerHTML = '';
    });

    test('injects the overlay and no drop zone', () => {
        expect(document.getElementById('nozo-overlay-container')).not.toBeNull();
        expect(document.getElementById('nozo-drop-zone')).toBeNull();
    });

    test('Alt + click opens the preview after allowing the frame', async () => {
        const link = makeLink('https://example.com');
        const event = fakeClick(link);

        api.handleClick(event);
        await Promise.resolve();
        await Promise.resolve();

        expect(event.preventDefault).toHaveBeenCalled();
        expect(event.stopImmediatePropagation).toHaveBeenCalled();
        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
            action: 'nozo:allowFrame',
            url: 'https://example.com/',
        });
        expect(document.getElementById('nozo-overlay-container').classList.contains('visible')).toBe(true);
        expect(document.getElementById('nozo-iframe').src).toBe('https://example.com/');
    });

    test('a plain click is left alone', () => {
        const link = makeLink('https://example.com');
        const event = fakeClick(link, { altKey: false });

        api.handleClick(event);

        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
        expect(document.getElementById('nozo-iframe').src).toBe('about:blank');
    });

    test('closing the preview revokes the frame rule', async () => {
        await api.openNozo('https://example.com/');
        chrome.runtime.sendMessage.mockClear();

        api.closeNozo();
        expect(document.getElementById('nozo-overlay-container').classList.contains('visible')).toBe(false);

        jest.advanceTimersByTime(400);
        expect(document.getElementById('nozo-iframe').src).toBe('about:blank');
        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ action: 'nozo:revokeFrame' });
    });

    test('leaving the page revokes the frame rule', async () => {
        await api.openNozo('https://example.com/');
        chrome.runtime.sendMessage.mockClear();

        window.dispatchEvent(new Event('pagehide'));
        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ action: 'nozo:revokeFrame' });
    });

    test('still opens the preview if the background request fails', async () => {
        jest.spyOn(console, 'warn').mockImplementation(() => { });
        chrome.runtime.sendMessage.mockImplementationOnce(() => Promise.reject(new Error('boom')));

        await api.openNozo('https://example.com/');
        await flushMicrotasks();

        expect(document.getElementById('nozo-iframe').src).toBe('https://example.com/');
        console.warn.mockRestore();
    });
});

async function flushMicrotasks() {
    for (let i = 0; i < 5; i++) await Promise.resolve();
}
