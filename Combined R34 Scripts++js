// ==UserScript==
// @name         Combined R34 Scripts++
// @namespace    http://tampermonkey.net/
// @version      3.16
// @description  Combines multiple scripts for Rule34 with performance improvements and now with API key support for robust features.  NEW : Cookies und Mittleremaustasten Favoriten mit M4 auch
// @author       J (refactored by AI)
// @match        https://rule34.xxx/*
// @icon         https://i.imgur.com/eF9vwMo.png
// @run-at       document-idle
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM.xmlHttpRequest
// @connect      api.rule34.xxx
// @connect      rule34.xxx
// @connect      wimg.rule34.xxx
// @connect      api-cdn.rule34.xxx
// ==/UserScript==


// NEW : Cookies und Mittleremaustasten Favoriten mit M4 auch       3.0
// UPDATED : FaviconChanger user: erkennt user%3a                   3.1
// UPDATED :Mittleremaustaste  für Favorite erstmal deaktiviert                   3.11

(function() {
    'use strict';
    // --- API Key Management Constants ---
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

    const debounce = (fn, ms) => {
        let t;
        return (...args) => {
            clearTimeout(t);
            t = setTimeout(() => fn(...args), ms);
        };
    };
    const throttle = (fn, ms) => {
        let last = 0;
        return (...args) => {
            const now = Date.now();
            if (now - last >= ms) {
                fn(...args);
                last = now;
            }
        };
    };

    let CONFIG = { ...DEFAULT_CONFIG, ...JSON.parse(localStorage.getItem('r34_feature_flags') || '{}') };

    const STYLE = `
        #header { transition: height 0.3s ease; overflow: hidden; }
        .header-fix-btn { position: absolute; top: 5px; right: 10px; z-index: 1000; padding: 2px 6px; font-size: 12px; cursor: pointer; background: #222; color: #fff; border: 1px solid #444; border-radius: 4px; }
        .r34-panel-btn { position:absolute; z-index:10000; padding:4px 8px; font-size:12px; background:#222; color:#eee; border:1px solid #444; border-radius:0px; cursor:move; user-select:none; }
        .r34-panel { position:absolute; background:#1a1a1a; color:#eee; padding:15px; border-radius:8px; font-size:12px; z-index:9999; display:none; font-family:sans-serif; border: 1px solid #555; }
        .r34-panel form label { display:block; margin-bottom: 5px; cursor:pointer; }
        .r34-panel form input { margin-right: 8px; }
        .r34-panel form strong { color:#0af; margin-top:10px; display:block; border-bottom: 1px solid #444; padding-bottom: 3px; margin-bottom: 8px; }
        .r34-panel button { margin-top:15px; padding:5px 10px; color:#fff; border:none; border-radius:4px; cursor:pointer; }
        .r34-panel .save-btn { background:#0af; }
        .r34-panel .cancel-btn { background:#444; margin-left:8px; }
        #page-indicator { position: fixed; bottom: 10px; right: 10px; background: #222; color: #fff; padding: 4px 8px; border-radius: 6px; font-size: 12px; z-index: 9999; pointer-events: none; }
        .blacklisted-image.thumb, span.blacklisted-image, div.a_list#lmid, div[style*="display: inline-flex"], div.horizontalFlexWithMargins[style*="justify-content: center"], .exo-native-widget-outer-container, span[data-nosnippet] { display: none !important; }
    `;

    GM_addStyle(STYLE);

    // --- API Key Management Functions ---
    async function handleOptionsPage() {
        if (!window.location.href.includes('page=account&s=options')) return;
        const credTextarea = Array.from(document.querySelectorAll('textarea'))
        .find(ta => ta.value.includes('&api_key=') && ta.value.includes('&user_id='));
        if (credTextarea) {
            try {
                const credString = credTextarea.value.replace(/&amp;/g, '&');
                const params = new URLSearchParams(credString);
                const apiKey = params.get('api_key');
                const userId = params.get('user_id');
                if (apiKey && userId) {
                    await GM_setValue(API_KEY_NAME, apiKey);
                    await GM_setValue(USER_ID_NAME, userId);
                    const banner = document.createElement('div');
                    banner.textContent = 'Combined R34 Scripts++: API Key and User ID found and saved!';
                    Object.assign(banner.style, {
                        backgroundColor: '#4CAF50', color: 'white', padding: '15px', textAlign: 'center',
                        position: 'fixed', top: '0', left: '0', width: '100%', zIndex: '10000', fontSize: '16px'
                    });
                    document.body.prepend(banner);
                    setTimeout(() => banner.remove(), 800);
                }
            } catch (e) {
                console.error("[Userscript] Could not parse API credentials.", e);
            }
        }
    }
    function showApiKeyPrompt() {
        GM_addStyle(`
            #r34-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 99999; font-family: sans-serif; }
            #r34-modal-content { background-color: #1e1e1e; color: #eee; padding: 20px 30px; border-radius: 8px; text-align: center; max-width: 400px; border: 1px solid #555; }
            #r34-modal-content p { margin: 0 0 20px 0; line-height: 1.5; }
            #r34-modal-buttons button, #r34-manual-input button { background-color: #333; color: #fff; border: 1px solid #555; padding: 10px 15px; border-radius: 5px; cursor: pointer; margin: 0 10px; }
            #r34-manual-input { margin-top: 20px; }
            #r34-manual-input input { display: block; width: calc(100% - 20px); margin: 10px auto; padding: 8px; background-color: #333; border: 1px solid #555; color: #fff; border-radius: 4px; }
        `);
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
        document.getElementById('r34-generate-btn').addEventListener('click', () => {
            window.location.href = 'https://rule34.xxx/index.php?page=account&s=options';
        });
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
                } else {
                    alert('Invalid format. Please paste the full string.');
                }
            } catch (e) {
                alert('Could not parse the provided string.');
            }
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

    // --- NEW: Cookies ---
    try {
        createCookie('resize-original', '1', 365);
        createCookie('resize-notification', '1', 365);
        createCookie('theme', 'dark', 365);
    } catch {}
    function createCookie(name, value, days) {
        let expires = "";
        if (days) {
            const date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            expires = "; expires=" + date.toUTCString();
        }
        // Setzt das Cookie. Wichtig: Pfad und Secure/SameSite
        document.cookie = name + "=" + value + expires + "; path=/; SameSite=Lax";
    }

    const onReady = (fn) => {
        if (document.readyState === 'interactive' || document.readyState === 'complete') {
            fn();
        } else {
            window.addEventListener('DOMContentLoaded', fn, { once: true });
        }
    };

    const injectPageScript = (func) => {
        const script = document.createElement('script');
        script.textContent = `(${func.toString()})();`;
        document.documentElement.appendChild(script);
        script.remove();
    };

    function setupFavoriteOnHover() {
        injectPageScript(() => {
            if (window.__userscriptAddFavInitialized) return;
            window.__userscriptAddFavInitialized = true;
            window.addEventListener("userscript:addFav", event => {
                if (typeof window.addFav === "function") {
                    try { window.addFav(event.detail); } catch (e) { console.warn("[Userscript] addFav error", e); }
                } else {
                    console.warn("[Userscript] addFav function not found on page.");
                }
            });
        });
        let hoveredElement = null;
        document.addEventListener('mouseenter', e => { hoveredElement = e.target; }, { passive: true, capture: true });
        document.addEventListener('mouseleave', e => { if (e.target === hoveredElement) hoveredElement = null; }, { capture: true });
        window.addEventListener('pointerdown', e => {
            if (e.button !== 3) return;
            const active = document.activeElement;
            if (active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA' || active?.isContentEditable) return;
            const getPostId = (element) => {
                if (!element) return new URLSearchParams(location.search).get('id');
                const link = element.closest('a[href*="id="], a[id^="p"]');
                if (!link) return new URLSearchParams(location.search).get('id');
                try {
                    return new URL(link.href, location.href).searchParams.get('id') || (link.id && link.id.slice(1));
                } catch (err) { return null; }
            };
            const postId = getPostId(hoveredElement);
            if (postId) {
                window.dispatchEvent(new CustomEvent('userscript:addFav', { detail: postId }));
            }
        }, true);
        /*
              //////////////////////////////////////////////////////////////////////////////
// NEW        /* Mittleremaustaste  für Favoriten, erkennt beim drücken/loslasnsesn
              /////////////////////////////////////////////////////////////////////////////
        // Hilfsfunktion: Post ID finden
        const getPostId = (element) => {
            if (!element) return new URLSearchParams(location.search).get('id');
            const link = element.closest('a[href*="id="], a[id^="p"]');
            if (!link) return new URLSearchParams(location.search).get('id');
            try {
                return new URL(link.href, location.href).searchParams.get('id') || (link.id && link.id.slice(1));
            } catch (err) { return null; }
        };

        // --- NEU: Aggressiver Blocker für neue Tabs ---
        const blockMiddleClick = (e) => {
            // Nur Button 1 (Mittelklick)
            if (e.button !== 1) return;

            // Prüfen: Ist das Ziel ein Link oder innerhalb eines Links?
            const link = e.target.closest('a');

            // Wenn es ein Link ist (egal ob mit Post-ID oder nicht), blockieren wir die Browser-Aktion
            if (link) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                return false;
            }
        };

        // Wir hören auf 'auxclick' (wichtig für Mittelklick!) UND 'click'
        window.addEventListener('auxclick', blockMiddleClick, { capture: true });
        window.addEventListener('click', blockMiddleClick, { capture: true });
        window.addEventListener('mousedown', (e) => {
            if(e.button === 1 && e.target.closest('a')) e.preventDefault();
        }, { capture: true });


        // --- DEINE LOGIK: Pointerdown -> Pointerup ---
        window.addEventListener('pointerdown', e => {
            if (e.button !== 1) return;

            const active = document.activeElement;
            if (active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA' || active?.isContentEditable) return;

            // Verhindert das Autoscroll-Icon
            e.preventDefault();

            const downTarget = e.target;

            const onPointerUp = (upEvent) => {
                if (upEvent.button !== 1) return;

                // Listener entfernen
                window.removeEventListener('pointerup', onPointerUp, true);

                // Prüfung: Gleiches Element beim Drücken und Loslassen?
                if (upEvent.target === downTarget) {
                    // Post ID holen und Fav auslösen
                    const postId = getPostId(downTarget);
                    if (postId) {
                        window.dispatchEvent(new CustomEvent('userscript:addFav', { detail: postId }));
                    }
                }
            };

            window.addEventListener('pointerup', onPointerUp, true);
        }, true);
    }
*/
        //////////////////////////////////////////////////////////////////////////////
        /////////////////////////////////////////////////////////////////////////////
    }
    const hideBlacklisted = (context) => {
        try {
            const els = context.querySelectorAll?.('.blacklisted') || [];
            els.forEach(el => el.remove());
        } catch (e) {}
    };

    const removeDuplicateThumbnails = (() => {
        let seenIds = new Set();
        const reset = () => { seenIds = new Set(); };
        const fn = (context) => {
            try {
                const nodes = context.matches && context.matches('span.thumb') ? [context] : Array.from(context.querySelectorAll?.('span.thumb') || []);
                nodes.forEach(el => {
                    if (!el.id) return;
                    const id = el.id.replace(/^s/, '');
                    if (!id) return;
                    if (seenIds.has(id)) {
                        el.remove();
                    } else {
                        seenIds.add(id);
                    }
                });
            } catch (e) {}
        };
        fn.reset = reset;
        return fn;
    })();

    const removeAnnoyances = (context) => {
        try {
            const selectors = [
                'div.a_list#lmid',
                'div[style*="display: inline-flex"]',
                'div.horizontalFlexWithMargins[style*="justify-content: center"]',
                '.exo-native-widget-outer-container',
                'span[data-nosnippet]',
            ];
            selectors.forEach(s => {
                const list = context.querySelectorAll?.(s) || [];
                list.forEach(el => el.remove());
            });
        } catch (e) {}
    };

    function setupCollapsibleHeader() {
        const header = document.querySelector('#header');
        if (!header || location.href.includes('page=favorites&s=view&id=')) return;
        let expandTimeout;
        let collapseTimeout;
        let isFixed = localStorage.getItem('r34_header_fixed') === 'true';
        const fixButton = header.querySelector('.header-fix-btn') || document.createElement('button');
        fixButton.className = 'header-fix-btn';
        if (!header.contains(fixButton)) header.appendChild(fixButton);
        const updateState = () => {
            isFixed = localStorage.getItem('r34_header_fixed') === 'true';
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
    }

    const fixPaginatorLinks = (context) => {
        try {
            const links = context.querySelectorAll?.('#paginator a[onclick]') || [];
            links.forEach(link => {
                const on = link.getAttribute('onclick') || '';
                const match = on.match(/document\.location='([^']+)'/);
                if (match && link.getAttribute('href') === '#') {
                    link.setAttribute('href', match[1]);
                }
            });
        } catch (e) {}
    };

    const removePidParameter = (context) => {
        try {
            const links = context.querySelectorAll?.('a[onclick*="return_pid="]') || [];
            links.forEach(link => {
                const on = link.getAttribute('onclick') || '';
                const replaced = on.replace(/(&|\?)return_pid=\d+/, (m, p1) => p1 === '?' ? '?return' : '&return');
                link.setAttribute('onclick', replaced);
            });
        } catch (e) {}
    };

    const setNativeLazyLoading = (context) => {
        try {
            const imgs = context.querySelectorAll?.('img:not([loading])') || [];
            imgs.forEach(img => {
                img.setAttribute('loading', 'lazy');
                img.setAttribute('decoding', 'async');
                img.setAttribute('referrerPolicy', 'no-referrer');
            });
        } catch (e) {}
    };

    const updateFavicon = () => {
        try {
         /*   if (location.href.includes("page=favorites&s=view&id=4587107")) return;
            if (location.href.includes("page=favorites&s=view&id=5598646")) return; */

            const ICON_MAP = [
                { match: 'page=post&s=view&id=', icon: 'https://i.imgur.com/eF9vwMo.png' },
                { match: 'user:', icon: 'https://i.imgur.com/sUsekOa.png' }, // Wir nutzen hier 'user:' als Basis
                { match: 'page=account&s=profile&uname=', icon: 'https://i.imgur.com/bRvarhr.png' },
                { match: 'page=favorites&s=view&id=', icon: 'https://i.imgur.com/CgJD0Mx.png' },
            ];

            // Die Logik prüft nun beides: den Text direkt ODER den Text mit %3a statt :
            const newIcon = ICON_MAP.find(entry =>
                                          location.href.includes(entry.match) ||
                                          location.href.includes(entry.match.replace(':', '%3a'))
                                         )?.icon;

            if (newIcon) {
                const link = document.querySelector('link[rel="shortcut icon"]') || document.querySelector('link[rel="icon"]');
                if (link) link.setAttribute('href', newIcon);
                else {
                    const l = document.createElement('link');
                    l.setAttribute('rel', 'shortcut icon');
                    l.setAttribute('href', newIcon);
                    document.head.appendChild(l);
                }
            }
        } catch (e) {}
    };

    async function restoreDeletedPost() {
        try {
            const notice = document.querySelector('.status-notice');
            if (!notice || !notice.innerText.includes("This post was deleted.")) return;
            const postId = new URLSearchParams(location.search).get('id');
            if (!postId) return;
            // Get API credentials
            const apiKey = await GM_getValue(API_KEY_NAME, '');
            const userId = await GM_getValue(USER_ID_NAME, '');
            const apiUrl = `https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&id=${postId}&json=1&api_key=${apiKey}&user_id=${userId}`;
            const response = await GM.xmlHttpRequest({
                method: 'GET',
                url: apiUrl,
                responseType: 'json' // Tampermonkey parst es automatisch
            });
            // Dann Zugriff via response.response (statt responseText)
            const data = response.response;
            const post = Array.isArray(data) ? data[0] : data;
            if (!post || !post.file_url) throw new Error("Post not found in API.");
            const isVideo = ['webm', 'mp4'].includes(post.file_url.split('.').pop().toLowerCase());
            const mediaElement = document.createElement(isVideo ? 'video' : 'img');
            mediaElement.src = post.file_url;
            Object.assign(mediaElement.style, { maxWidth: '95vw', maxHeight: '90vh', objectFit: 'contain', display: 'block' });
            if (isVideo) { Object.assign(mediaElement, { controls: true, autoplay: true, loop: true, muted: true }); }
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

    const hideEmptyThumbSpans = (context) => {
        try {
            const spans = context.querySelectorAll?.('#content > div.image-list > span') || [];
            spans.forEach(span => {
                if (span.children.length > 0 && ![...span.querySelectorAll('a')].some(link => link.style.display !== 'none')) {
                    span.remove();
                }
            });
        } catch (e) {}
    };

    const updatePageIndicator = (() => {
        let indicator = null;
        return () => {
            try {
                if (location.href.includes("page=favorites&s=view&id=4587107")) return;
                if (location.href.includes("page=favorites&s=view&id=5598646")) return;
                if (location.href.includes("page=post&s=view&id=")) return;
                if (location.href.includes("page=post&s=list&tags=all")) return;
                if (!indicator) {
                    indicator = document.querySelector('#page-indicator') || document.createElement('div');
                    indicator.id = 'page-indicator';
                    document.body.appendChild(indicator);
                }
                const paginator = document.querySelector('#paginator');
                if (!paginator) {
                    indicator.style.display = 'none';
                    return;
                }
                const lastLink = paginator.querySelector('a[href*="pid"]:last-of-type');
                if (!lastLink) {
                    const currentPage = paginator.querySelector('b')?.textContent || '1';
                    indicator.textContent = `Page ${currentPage}`;
                    indicator.style.display = 'block';
                    return;
                }
                const maxPid = parseInt(new URL(lastLink.href, location.href).searchParams.get('pid'), 10) || 0;
                const perPage = location.href.includes("page=favorites") ? 50 : 42;
                const totalPages = Math.floor(maxPid / perPage) + 1;
                indicator.textContent = `Page ${totalPages}`;
                indicator.style.display = 'block';
            } catch (e) {}
        };
    })();

    const removeThumbTitle = (img) => {
        try { img.removeAttribute('title'); } catch (e) {}
    };

    function setupControlPanel() {
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
        form.querySelector('.reset-btn').addEventListener('click', () => {
            localStorage.setItem('r34_feature_flags', JSON.stringify(DEFAULT_CONFIG));
            location.reload();
        });
        form.querySelector('.export-btn').addEventListener('click', async () => {
            try {
                const cfg = localStorage.getItem('r34_feature_flags') || JSON.stringify(DEFAULT_CONFIG);
                await navigator.clipboard.writeText(cfg);
                alert('Config copied to clipboard.');
            } catch (e) { alert('Unable to copy config.'); }
        });
        form.querySelector('.import-btn').addEventListener('click', async () => {
            try {
                const text = prompt('Paste config JSON here:');
                if (!text) return;
                JSON.parse(text);
                localStorage.setItem('r34_feature_flags', text);
                alert('Imported. Reloading.');
                location.reload();
            } catch (e) { alert('Invalid JSON.'); }
        });
        toggleBtn.addEventListener('click', () => {
            const rect = toggleBtn.getBoundingClientRect();
            panel.style.left = `${rect.left}px`;
            panel.style.top = `${rect.bottom + window.scrollY + 5}px`;
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        });
        toggleBtn.addEventListener('mousedown', e => {
            if (e.button !== 0) return;
            const shiftX = e.clientX - toggleBtn.getBoundingClientRect().left;
            const shiftY = e.clientY - toggleBtn.getBoundingClientRect().top;
            const moveAt = (pageX, pageY) => {
                toggleBtn.style.left = `${pageX - shiftX}px`;
                toggleBtn.style.top = `${pageY - shiftY}px`;
            };
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
                if (isNowVisible) {
                    toggleBtn.remove();
                    panel.remove();
                    localStorage.setItem('r34_button_visible', 'false');
                } else {
                    document.body.appendChild(toggleBtn);
                    document.body.appendChild(panel);
                    localStorage.setItem('r34_button_visible', 'true');
                }
            }
        });
        if (isVisible) {
            document.body.appendChild(toggleBtn);
            document.body.appendChild(panel);
        }
    }

    onReady(async () => {
        // 1. Erst checken, ob wir Credentials auf der Options-Seite abgreifen können
        await handleOptionsPage();

        // 2. Wir prüfen den Key, aber stoppen NICHT das ganze Skript, falls er fehlt.
        // Wir speichern das Ergebnis nur in einer Variable für später.
        let canRestore = false;
        if (CONFIG.restoreDeletedPost) {
            canRestore = await checkApiKey();
            if (!canRestore) {
                console.warn("[Combined R34] API Key missing. Restore feature disabled, but other scripts will run.");
                // Optional: Hier könnte man CONFIG.restoreDeletedPost = false setzen
            }
        }
        // --- API Key Integration End ---

        // 3. Setup der Features (laufen immer, unabhängig vom Key)
        if (CONFIG.favoriteOnMouse) setupFavoriteOnHover();
        if (CONFIG.collapsibleHeader) setupCollapsibleHeader();

        // 4. Restore nur ausführen, wenn Key da ist UND wir auf einer Post-Seite sind
        if (CONFIG.restoreDeletedPost && canRestore) {
            // Kurzer Check, ob wir überhaupt auf einer View-Seite sind, spart API Calls
            if (window.location.href.includes('page=post&s=view')) {
                restoreDeletedPost();
            }
        }

        const runAll = (contexts = [document]) => {
            try {
                const ctxs = Array.isArray(contexts) ? contexts : [contexts];
                ctxs.forEach(context => {
                    if (CONFIG.hideBlacklisted) hideBlacklisted(context);
                    if (CONFIG.removeDuplicates) removeDuplicateThumbnails(context);
                    if (CONFIG.removeAnnoyances) removeAnnoyances(context);
                    if (CONFIG.fixPaginatorLinks) fixPaginatorLinks(context);
                    if (CONFIG.removePidParameter) removePidParameter(context);
                    if (CONFIG.nativeLazyLoading) setNativeLazyLoading(context);
                    if (CONFIG.hideEmptyThumbSpans) hideEmptyThumbSpans(context);
                    if (CONFIG.pageIndicator) updatePageIndicator();
                    if (CONFIG.removeThumbTitles) Array.from(context.querySelectorAll?.('.thumb img[title]') || []).forEach(img => removeThumbTitle(img));
                });
            } catch (e) {}
        };
        runAll();

        const debouncedUpdatePageIndicator = debounce(updatePageIndicator, 100);

        if (CONFIG.pageIndicator) debouncedUpdatePageIndicator();
        if (CONFIG.faviconChanger) updateFavicon();
        setupControlPanel();

        const addedNodesBuffer = new Set();
        const processAddedNodes = debounce(() => {
            const nodes = Array.from(addedNodesBuffer);
            addedNodesBuffer.clear();
            const contexts = [];
            nodes.forEach(node => {
                if (node.nodeType !== 1) return;
                contexts.push(node);
                if (node.querySelectorAll) {
                    const thumbs = node.querySelectorAll('span.thumb, .thumb');
                    thumbs.forEach(t => contexts.push(t));
                }
            });
            if (contexts.length === 0) return;
            runAll(contexts);
        }, 50);

        const observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                for (const n of m.addedNodes) {
                    if (n.nodeType === 1) addedNodesBuffer.add(n);
                }
            }
            processAddedNodes();
        });

        observer.observe(document.body, { childList: true, subtree: true });

        let lastHref = location.href;
        const handleUrlChangeImmediate = () => {
            if (location.href === lastHref) return;
            lastHref = location.href;
            if (CONFIG.removeDuplicates && typeof removeDuplicateThumbnails.reset === 'function') removeDuplicateThumbnails.reset();
            if (CONFIG.faviconChanger) updateFavicon();
            if (CONFIG.pageIndicator) updatePageIndicator();
            if (CONFIG.restoreDeletedPost) restoreDeletedPost();
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
                const ev = new Event(type.toLowerCase());
                window.dispatchEvent(ev);
                return rv;
            };
        };
        history.pushState = wrapHistoryMethod('pushState');
        history.replaceState = wrapHistoryMethod('replaceState');
    });
})();
