// ==UserScript==
// @name         Combined R34 Scripts++ (Optimized - Gemini PRO)
// @namespace    http://tampermonkey.net/
// @version      4.0
// @description  Combines multiple scripts for Rule34 with extreme performance improvements, UI Panel, and API key support.
// @author       J (Optimized by Senior Dev)
// @match        https://rule34.xxx/*
// @icon         https://i.imgur.com/eF9vwMo.png
// @run-at       document-start
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM.xmlHttpRequest
// @grant        unsafeWindow
// @connect      api.rule34.xxx
// @connect      rule34.xxx
// @connect      wimg.rule34.xxx
// @connect      api-cdn.rule34.xxx
// ==/UserScript==

(function() {
    'use strict';

    // --- KONSTANTEN & CONFIG ---
    const API_KEY_NAME = 'r34_api_key';
    const USER_ID_NAME = 'r34_user_id';

    const DEFAULT_CONFIG = {
        favoriteOnMouse: true,
        hideBlacklisted: true,
        removeDuplicates: true,
        removeAnnoyances: true,
        collapsibleHeader: true,
        fixPaginatorLinks: true,
        removePidParameter: true,
        nativeLazyLoading: true,
        restoreDeletedPost: true,
        hideEmptyThumbSpans: true,
        faviconChanger: true,
        pageIndicator: true,
        removeThumbTitles: true,
    };

    let CONFIG = { ...DEFAULT_CONFIG, ...JSON.parse(localStorage.getItem('r34_feature_flags') || '{}') };

    // --- UTILS ---
    const debounce = (fn, ms) => {
        let t;
        return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
    };

    // --- STYLES ---
    GM_addStyle(`
        #header { transition: height 0.3s ease; overflow: hidden; }
        .header-fix-btn { position: absolute; top: 5px; right: 10px; z-index: 1000; padding: 2px 6px; font-size: 12px; cursor: pointer; background: #222; color: #fff; border: 1px solid #444; border-radius: 4px; }
        .r34-panel-btn { position:absolute; z-index:10000; padding:4px 8px; font-size:12px; background:#222; color:#eee; border:1px solid #444; border-radius:0px; cursor:move; user-select:none; }
        .r34-panel { position:absolute; background:#1a1a1a; color:#eee; padding:15px; border-radius:8px; font-size:12px; z-index:9999; display:none; font-family:sans-serif; border: 1px solid #555; }
        .r34-panel form label { display:block; margin-bottom: 5px; cursor:pointer; }
        .r34-panel form input { margin-right: 8px; }
        .r34-panel form strong { color:#0af; margin-top:10px; display:block; border-bottom: 1px solid #444; padding-bottom: 3px; margin-bottom: 8px; }
        .r34-panel button { margin-top:15px; padding:5px 10px; color:#fff; border:none; border-radius:4px; cursor:pointer; margin-right: 4px;}
        .r34-panel .save-btn { background:#0af; }
        .r34-panel .cancel-btn { background:#444; }
        #page-indicator { position: fixed; bottom: 10px; right: 10px; background: #222; color: #fff; padding: 4px 8px; border-radius: 6px; font-size: 12px; z-index: 9999; pointer-events: none; }
        .blacklisted-image.thumb, span.blacklisted-image, div.a_list#lmid, div[style*="display: inline-flex"], div.horizontalFlexWithMargins[style*="justify-content: center"], .exo-native-widget-outer-container, span[data-nosnippet] { display: none !important; }
        #r34-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 99999; font-family: sans-serif; }
        #r34-modal-content { background-color: #1e1e1e; color: #eee; padding: 20px 30px; border-radius: 8px; text-align: center; max-width: 400px; border: 1px solid #555; }
        #r34-modal-content p { margin: 0 0 20px 0; line-height: 1.5; }
        #r34-modal-buttons button, #r34-manual-input button { background-color: #333; color: #fff; border: 1px solid #555; padding: 10px 15px; border-radius: 5px; cursor: pointer; margin: 0 10px; }
        #r34-manual-input { margin-top: 20px; }
        #r34-manual-input input { display: block; width: calc(100% - 20px); margin: 10px auto; padding: 8px; background-color: #333; border: 1px solid #555; color: #fff; border-radius: 4px; }
    `);

    // --- API & CREDENTIALS ---
    async function handleOptionsPage() {
        if (!window.location.href.includes('page=account&s=options')) return;
        const credTextarea = Array.from(document.querySelectorAll('textarea')).find(ta => ta.value.includes('&api_key=') && ta.value.includes('&user_id='));
        if (credTextarea) {
            try {
                const params = new URLSearchParams(credTextarea.value.replace(/&amp;/g, '&'));
                const apiKey = params.get('api_key');
                const userId = params.get('user_id');
                if (apiKey && userId) {
                    await GM_setValue(API_KEY_NAME, apiKey);
                    await GM_setValue(USER_ID_NAME, userId);
                    const banner = document.createElement('div');
                    banner.textContent = 'Combined R34 Scripts++: API Key and User ID found and saved!';
                    Object.assign(banner.style, { backgroundColor: '#4CAF50', color: 'white', padding: '15px', textAlign: 'center', position: 'fixed', top: '0', left: '0', width: '100%', zIndex: '10000', fontSize: '16px' });
                    document.body.prepend(banner);
                    setTimeout(() => banner.remove(), 800);
                }
            } catch (e) { console.error("[Userscript] Could not parse API credentials.", e); }
        }
    }

    function showApiKeyPrompt() {
        const overlay = document.createElement('div');
        overlay.id = 'r34-modal-overlay';
        overlay.innerHTML = `
            <div id="r34-modal-content">
                <p>For the "Restore Deleted Post" feature, this script now needs an API key. Please generate one or enter it manually.</p>
                <div id="r34-modal-buttons">
                    <button id="r34-manual-btn">Enter Manually</button>
                    <button id="r34-generate-btn">Go to Options Page</button>
                </div>
                <div id="r34-manual-input" style="display: none;">
                    <p style="font-size: 0.9em;">Copy the full text from the 'API Access Credentials' box and paste it here.</p>
                    <input type="text" id="r34-credential-input" placeholder="&api_key=...&user_id=...">
                    <button id="r34-save-manual-btn">Save & Reload</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);

        document.getElementById('r34-generate-btn').addEventListener('click', () => window.location.href = 'https://rule34.xxx/index.php?page=account&s=options');
        document.getElementById('r34-manual-btn').addEventListener('click', () => {
            document.getElementById('r34-modal-buttons').style.display = 'none';
            document.getElementById('r34-manual-input').style.display = 'block';
        });
        document.getElementById('r34-save-manual-btn').addEventListener('click', async () => {
            const credString = document.getElementById('r34-credential-input').value.trim();
            if (!credString) return;
            try {
                const params = new URLSearchParams(credString.startsWith('?') ? credString : '?' + credString);
                const apiKey = params.get('api_key');
                const userId = params.get('user_id');
                if (apiKey && userId) {
                    await GM_setValue(API_KEY_NAME, apiKey);
                    await GM_setValue(USER_ID_NAME, userId);
                    alert('API Key and User ID saved! The page will now reload.');
                    location.reload();
                } else alert('Invalid format. Please paste the full string.');
            } catch (e) { alert('Could not parse the provided string.'); }
        });
    }

    async function checkApiKey() {
        if (window.location.href.includes('page=account&s=options')) return true;
        const apiKey = await GM_getValue(API_KEY_NAME);
        const userId = await GM_getValue(USER_ID_NAME);
        if (!apiKey || !userId) {
            console.log("Combined R34 Scripts++: API key or User ID not found. Displaying prompt.");
            showApiKeyPrompt();
            return false;
        }
        return true;
    }

    async function restoreDeletedPost() {
        try {
            const notice = document.querySelector('.status-notice');
            if (!notice || !notice.innerText.includes("This post was deleted.")) return;

            const postId = new URLSearchParams(location.search).get('id');
            if (!postId) return;

            const apiKey = await GM_getValue(API_KEY_NAME, '');
            const userId = await GM_getValue(USER_ID_NAME, '');
            const apiUrl = `https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&id=${postId}&json=1&api_key=${apiKey}&user_id=${userId}`;

            const response = await GM.xmlHttpRequest({ method: 'GET', url: apiUrl, responseType: 'json' });
            const data = response.response;
            const post = Array.isArray(data) ? data[0] : data;

            if (!post || !post.file_url) throw new Error("Post not found in API.");

            const isVideo = ['webm', 'mp4'].includes(post.file_url.split('.').pop().toLowerCase());
            const mediaElement = document.createElement(isVideo ? 'video' : 'img');
            mediaElement.src = post.file_url;
            Object.assign(mediaElement.style, { maxWidth: '95vw', maxHeight: '90vh', objectFit: 'contain', display: 'block' });
            if (isVideo) Object.assign(mediaElement, { controls: true, autoplay: true, loop: true, muted: true });

            const container = document.getElementById('fit-to-screen');
            if (container) {
                container.innerHTML = '';
                container.appendChild(mediaElement);
                notice.innerText += `\n[Userscript] Restored deleted media.`;
            }
        } catch (err) {
            try { document.querySelector('.status-notice').innerText += `\n[Userscript] Could not restore media.`; } catch (e) {}
            console.warn("[Userscript] Could not restore deleted post:", err);
        }
    }

    // --- COOKIES ---
    const initCookies = () => {
        const createCookie = (name, value, days) => {
            const date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            document.cookie = `${name}=${value}; expires=${date.toUTCString()}; path=/; SameSite=Lax`;
        };
        try { createCookie('resize-original', '1', 365); createCookie('resize-notification', '1', 365); createCookie('theme', 'dark', 365); } catch {}
    };

    // --- CORE FEATURES ---
    const hideBlacklisted = (ctx) => ctx.querySelectorAll?.('.blacklisted').forEach(el => el.remove());
    const removeAnnoyances = (ctx) => ctx.querySelectorAll?.('div.a_list#lmid, div[style*="display: inline-flex"], div.horizontalFlexWithMargins[style*="justify-content: center"], .exo-native-widget-outer-container, span[data-nosnippet]').forEach(el => el.remove());
    const fixPaginatorLinks = (ctx) => ctx.querySelectorAll?.('#paginator a[onclick]').forEach(link => {
        const match = (link.getAttribute('onclick') || '').match(/document\.location='([^']+)'/);
        if (match && link.getAttribute('href') === '#') link.setAttribute('href', match[1]);
    });
    const removePidParameter = (ctx) => ctx.querySelectorAll?.('a[onclick*="return_pid="]').forEach(link => {
        link.setAttribute('onclick', (link.getAttribute('onclick') || '').replace(/(&|\?)return_pid=\d+/, m => m.startsWith('?') ? '?return' : '&return'));
    });
    const setNativeLazyLoading = (ctx) => ctx.querySelectorAll?.('img:not([loading])').forEach(img => {
        img.setAttribute('loading', 'lazy'); img.setAttribute('decoding', 'async'); img.setAttribute('referrerPolicy', 'no-referrer');
    });
    const hideEmptyThumbSpans = (ctx) => ctx.querySelectorAll?.('#content > div.image-list > span').forEach(span => {
        if (span.children.length > 0 && ![...span.querySelectorAll('a')].some(link => link.style.display !== 'none')) span.remove();
    });
    const removeThumbTitle = (ctx) => ctx.querySelectorAll?.('.thumb img[title]').forEach(img => img.removeAttribute('title'));

    const removeDuplicateThumbnails = (() => {
        let seenIds = new Set();
        const fn = (ctx) => {
            const nodes = ctx.matches?.('span.thumb') ? [ctx] : Array.from(ctx.querySelectorAll?.('span.thumb') || []);
            nodes.forEach(el => {
                const id = el.id?.replace(/^s/, '');
                if (!id) return;
                seenIds.has(id) ? el.remove() : seenIds.add(id);
            });
        };
        fn.reset = () => { seenIds.clear(); };
        return fn;
    })();

    const updateFavicon = () => {
        try {
            const ICON_MAP = [
                { match: 'page=post&s=view&id=', icon: 'https://i.imgur.com/eF9vwMo.png' },
                { match: 'user:', icon: 'https://i.imgur.com/sUsekOa.png' },
                { match: 'page=account&s=profile&uname=', icon: 'https://i.imgur.com/bRvarhr.png' },
                { match: 'page=favorites&s=view&id=', icon: 'https://i.imgur.com/CgJD0Mx.png' },
            ];
            const url = location.href;
            const newIcon = ICON_MAP.find(entry => url.includes(entry.match) || url.includes(entry.match.replace(':', '%3a')))?.icon;

            if (newIcon) {
                let link = document.querySelector('link[rel="shortcut icon"]') || document.querySelector('link[rel="icon"]');
                if (!link) { link = document.createElement('link'); link.setAttribute('rel', 'shortcut icon'); document.head.appendChild(link); }
                link.setAttribute('href', newIcon);
            }
        } catch (e) {}
    };

    const updatePageIndicator = (() => {
        let indicator = null;
        return () => {
            try {
                if (location.href.includes("page=post&s=view&id=") || location.href.includes("page=post&s=list&tags=all")) return;

                if (!indicator) {
                    indicator = document.createElement('div');
                    indicator.id = 'page-indicator';
                    document.body.appendChild(indicator);
                }

                const paginator = document.querySelector('#paginator');
                if (!paginator) { indicator.style.display = 'none'; return; }

                const lastLink = paginator.querySelector('a[href*="pid"]:last-of-type');
                if (!lastLink) {
                    const currentPage = paginator.querySelector('b')?.textContent || '1';
                    indicator.textContent = `Page ${currentPage}`;
                    indicator.style.display = 'block';
                    return;
                }

                const maxPid = parseInt(new URL(lastLink.href, location.href).searchParams.get('pid'), 10) || 0;
                const perPage = location.href.includes("page=favorites") ? 50 : 42;
                indicator.textContent = `Page ${Math.floor(maxPid / perPage) + 1}`;
                indicator.style.display = 'block';
            } catch (e) {}
        };
    })();

    // --- USER INTERFACE (MOUSE & UI PANELS) ---
    const setupFavoriteOnHover = () => {
        let hoveredElement = null;
        document.addEventListener('mouseenter', e => { hoveredElement = e.target; }, { passive: true, capture: true });
        document.addEventListener('mouseleave', e => { if (e.target === hoveredElement) hoveredElement = null; }, { capture: true });

        // Kombinierte Logik für Mouse 3 (Middle)
        const blockMiddleClick = (e) => {
            if (e.button !== 1) return;
            if (e.target.closest('a')) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); return false; }
        };
        window.addEventListener('auxclick', blockMiddleClick, { capture: true });
        window.addEventListener('click', blockMiddleClick, { capture: true });
        window.addEventListener('mousedown', (e) => { if(e.button === 1 && e.target.closest('a')) e.preventDefault(); }, { capture: true });

        // Klick-Logik für Mouse 3 und Mouse 4
        window.addEventListener('pointerdown', e => {
            if (e.button !== 3) return;
            //   if (e.button !== 3 && e.button !== 1) return; // Mouse4 und Mittleremaustaste


            const active = document.activeElement;
            if (active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA' || active?.isContentEditable) return;

            if (e.button === 1) e.preventDefault(); // Stoppt Autoscroll

            const link = hoveredElement?.closest('a[href*="id="], a[id^="p"]');
            const postId = link ? (new URL(link.href, location.href).searchParams.get('id') || link.id.slice(1)) : new URLSearchParams(location.search).get('id');

            // HIER IST DIE MAGIE: Direkter Aufruf über unsafeWindow
            if (postId) {
                if (typeof unsafeWindow.addFav === 'function') {
                    unsafeWindow.addFav(postId);
                } else {
                    console.warn("[Userscript] addFav Funktion auf dieser Seite nicht gefunden!");
                }
            }
        }, true);
    };

    const setupCollapsibleHeader = () => {
        const header = document.querySelector('#header');
        if (!header || location.href.includes('page=favorites&s=view&id=')) return;

        let expandTimeout, collapseTimeout;
        let isFixed = localStorage.getItem('r34_header_fixed') === 'true';

        let fixButton = header.querySelector('.header-fix-btn');
        if (!fixButton) {
            fixButton = document.createElement('button');
            fixButton.className = 'header-fix-btn';
            header.appendChild(fixButton);
        }

        const updateState = () => {
            header.style.height = isFixed ? 'auto' : '40px';
            fixButton.textContent = isFixed ? '❌ Unpin' : '📌 Pin';
        };

        const toggleFixed = () => {
            isFixed = !isFixed;
            localStorage.setItem('r34_header_fixed', isFixed);
            updateState();
        };

        fixButton.addEventListener('click', toggleFixed);
        header.addEventListener('mouseenter', () => { if (!isFixed) { clearTimeout(collapseTimeout); expandTimeout = setTimeout(() => header.style.height = 'auto', 250); } });
        header.addEventListener('mouseleave', () => { if (!isFixed) { clearTimeout(expandTimeout); collapseTimeout = setTimeout(() => header.style.height = '40px', 100); } });
        document.addEventListener('keydown', e => (e.altKey && e.key.toLowerCase() === 'h') && toggleFixed());

        updateState();
    };

    const setupControlPanel = () => {
        let savedPos = JSON.parse(localStorage.getItem('r34_button_pos')) || { top: -1, left: 162 };
        let isVisible = localStorage.getItem('r34_button_visible') !== 'false';

        const toggleBtn = document.createElement('button');
        toggleBtn.textContent = '⚙️ R34 Panel';
        toggleBtn.className = 'r34-panel-btn';
        Object.assign(toggleBtn.style, { top: `${savedPos.top}px`, left: `${savedPos.left}px` });

        const panel = document.createElement('div');
        panel.className = 'r34-panel';
        const form = document.createElement('form');

        const groupedFeatures = {
            'Core': ['favoriteOnMouse', 'removeDuplicates', 'removeAnnoyances', 'fixPaginatorLinks', 'removePidParameter', 'restoreDeletedPost'],
            'Performance': ['nativeLazyLoading'],
            'Visual': ['collapsibleHeader', 'hideBlacklisted', 'hideEmptyThumbSpans', 'faviconChanger', 'pageIndicator', 'removeThumbTitles']
        };

        Object.entries(groupedFeatures).forEach(([group, keys]) => {
            let sectionHtml = `<strong>${group}</strong>`;
            keys.forEach(key => {
                sectionHtml += `<label><input type="checkbox" name="${key}" ${CONFIG[key] ? 'checked' : ''}> ${key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</label>`;
            });
            form.innerHTML += sectionHtml;
        });

        form.innerHTML += `<div>
            <button type="submit" class="save-btn">💾 Save & Reload</button>
            <button type="button" class="cancel-btn">❌ Cancel</button>
            <button type="button" class="reset-btn">🔁 Reset Defaults</button>
            <button type="button" class="export-btn">📤 Export</button>
            <button type="button" class="import-btn">📥 Import</button>
        </div>`;
        panel.appendChild(form);

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const newConfig = {};
            Object.keys(DEFAULT_CONFIG).forEach(key => newConfig[key] = formData.has(key));
            localStorage.setItem('r34_feature_flags', JSON.stringify(newConfig));
            location.reload();
        });

        form.querySelector('.cancel-btn').addEventListener('click', () => panel.style.display = 'none');
        form.querySelector('.reset-btn').addEventListener('click', () => { localStorage.setItem('r34_feature_flags', JSON.stringify(DEFAULT_CONFIG)); location.reload(); });
        form.querySelector('.export-btn').addEventListener('click', async () => {
            try { await navigator.clipboard.writeText(localStorage.getItem('r34_feature_flags') || JSON.stringify(DEFAULT_CONFIG)); alert('Config copied to clipboard.'); } catch (e) { alert('Unable to copy config.'); }
        });
        form.querySelector('.import-btn').addEventListener('click', () => {
            try { const text = prompt('Paste config JSON here:'); if (!text) return; JSON.parse(text); localStorage.setItem('r34_feature_flags', text); alert('Imported. Reloading.'); location.reload(); } catch (e) { alert('Invalid JSON.'); }
        });

        toggleBtn.addEventListener('click', () => {
            const rect = toggleBtn.getBoundingClientRect();
            panel.style.left = `${rect.left}px`; panel.style.top = `${rect.bottom + window.scrollY + 5}px`;
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        });

        toggleBtn.addEventListener('mousedown', e => {
            if (e.button !== 0) return;
            const shiftX = e.clientX - toggleBtn.getBoundingClientRect().left;
            const shiftY = e.clientY - toggleBtn.getBoundingClientRect().top;
            const moveAt = (pageX, pageY) => { toggleBtn.style.left = `${pageX - shiftX}px`; toggleBtn.style.top = `${pageY - shiftY}px`; };
            const onMouseMove = e => moveAt(e.pageX, e.pageY);
            document.addEventListener('mousemove', onMouseMove);
            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                localStorage.setItem('r34_button_pos', JSON.stringify({ top: parseInt(toggleBtn.style.top, 10) || 0, left: parseInt(toggleBtn.style.left, 10) || 0 }));
                document.removeEventListener('mouseup', onMouseUp);
            };
            document.addEventListener('mouseup', onMouseUp);
        });

        toggleBtn.ondragstart = () => false;

        document.addEventListener('keydown', e => {
            if (e.altKey && e.key.toLowerCase() === 'p') {
                e.preventDefault();
                const isNowVisible = document.body.contains(toggleBtn);
                if (isNowVisible) { toggleBtn.remove(); panel.remove(); localStorage.setItem('r34_button_visible', 'false'); }
                else { document.body.appendChild(toggleBtn); document.body.appendChild(panel); localStorage.setItem('r34_button_visible', 'true'); }
            }
        });

        if (isVisible) { document.body.appendChild(toggleBtn); document.body.appendChild(panel); }
    };

    // --- MAIN INITIALIZATION & OBSERVER ---
    const init = async () => {
        initCookies();
        await handleOptionsPage();

        let canRestore = false;
        if (CONFIG.restoreDeletedPost) {
            canRestore = await checkApiKey();
        }

        if (CONFIG.favoriteOnMouse) setupFavoriteOnHover();
        if (CONFIG.collapsibleHeader) setupCollapsibleHeader();
        setupControlPanel();

        if (CONFIG.restoreDeletedPost && canRestore && window.location.href.includes('page=post&s=view')) {
            restoreDeletedPost();
        }

        const runAll = (contexts = [document]) => {
            contexts.forEach(ctx => {
                if (CONFIG.hideBlacklisted) hideBlacklisted(ctx);
                if (CONFIG.removeDuplicates) removeDuplicateThumbnails(ctx);
                if (CONFIG.removeAnnoyances) removeAnnoyances(ctx);
                if (CONFIG.fixPaginatorLinks) fixPaginatorLinks(ctx);
                if (CONFIG.removePidParameter) removePidParameter(ctx);
                if (CONFIG.nativeLazyLoading) setNativeLazyLoading(ctx);
                if (CONFIG.hideEmptyThumbSpans) hideEmptyThumbSpans(ctx);
                if (CONFIG.removeThumbTitles) removeThumbTitle(ctx);
            });
        };

        runAll();
        if (CONFIG.pageIndicator) updatePageIndicator();
        if (CONFIG.faviconChanger) updateFavicon();

        const addedNodesBuffer = new Set();
        const processAddedNodes = debounce(() => {
            if (addedNodesBuffer.size === 0) return;
            runAll(Array.from(addedNodesBuffer));
            addedNodesBuffer.clear();
        }, 50);

        const observer = new MutationObserver((mutations) => {
            let needsUpdate = false;
            for (const m of mutations) {
                for (const n of m.addedNodes) {
                    if (n.nodeType === 1) {
                        if (n.matches('.thumb, .image-list') || n.querySelector('.thumb')) {
                            addedNodesBuffer.add(n);
                            needsUpdate = true;
                        }
                    }
                }
            }
            if (needsUpdate) processAddedNodes();
        });
        observer.observe(document.body, { childList: true, subtree: true });

        let lastHref = location.href;
        const handleUrlChangeImmediate = () => {
            if (location.href === lastHref) return;
            lastHref = location.href;
            if (CONFIG.removeDuplicates && typeof removeDuplicateThumbnails.reset === 'function') removeDuplicateThumbnails.reset();
            if (CONFIG.faviconChanger) updateFavicon();
            if (CONFIG.pageIndicator) updatePageIndicator();
            if (CONFIG.restoreDeletedPost && canRestore && window.location.href.includes('page=post&s=view')) restoreDeletedPost();
            runAll();
        };

        const debouncedHeadObserver = debounce(handleUrlChangeImmediate, 150);
        const headObserver = new MutationObserver(debouncedHeadObserver);
        headObserver.observe(document.head || document.documentElement, { childList: true, subtree: true });

        window.addEventListener('popstate', handleUrlChangeImmediate);
        window.addEventListener('pushstate', handleUrlChangeImmediate);
        window.addEventListener('replacestate', handleUrlChangeImmediate);

        const wrapHistoryMethod = (type) => {
            const orig = history[type];
            return function() {
                const rv = orig.apply(this, arguments);
                window.dispatchEvent(new Event(type.toLowerCase()));
                return rv;
            };
        };
        history.pushState = wrapHistoryMethod('pushState');
        history.replaceState = wrapHistoryMethod('replaceState');
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
