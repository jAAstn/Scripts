// ==UserScript==
// @name          +++ Scroll & Volume Control mit UI + Video Fullscreen M4 (Optimized - Gemini PRO) +++
// @namespace     http://tampermonkey.net/
// @version       4
// @description   Scroll im Fullscreen springt im Video vor/zurück oder ändert Lautstärke. Smart Fullscreen hybrid (Video.js API + Plyr Top-Layer).
// @author        me (optimized by AI)
// @match         *://*/*
// @icon          https://i.imgur.com/Jf2wKMr.png
// @grant         unsafeWindow
// ==/UserScript==

// CHANGELOG : Eingefügt : 4
// NEW :  Gemini PRO Script völlig Optimized

(function () {
    'use strict';

    // =================================================================================
    // CONFIG & STATE
    // =================================================================================
    let hudTimeout;
    let hud;
    let lastScrollTime = Date.now();
    let currentDelta = 0;
    let videoWrapper = null;
    let lastActiveFullscreenVideo = null;

    const useWrapperSites = ['gofile.io', 'rule34video.com', 'pixeldrain.com', 'hentai.tv', 'fileditchfiles.me'];
    const isWrapperSite = useWrapperSites.some(site => location.href.includes(site));

    // Excludes für Smart Fullscreen
    const excludesMouse4 = ["rule34", "youtube.com", "supjav.com", "javdoe.to", "hanime.tv", "hentaimama.io", "noodlemagazine.com", "xvideos.com", "watchhentai", "oppai.stream"];
    const allowMouse4 = !excludesMouse4.some(site => location.href.includes(site));

    // =================================================================================
    // HUD LOGIC
    // =================================================================================
    // ORIGINAL AUSSEHEN AUS VERSION 4 (OBEN IM VIDEO)
    function createHUD() {
        const hudDiv = document.createElement('div');
        hudDiv.id = 'video-control-hud';
        hudDiv.style.cssText = `
            position: absolute !important;
            left: 50% !important;
            top: 40px !important;
            transform: translateX(-50%) !important;
            padding: 8px 16px !important;
            background: rgba(0, 0, 0, 0.85) !important;
            color: rgb(0, 255, 0) !important;
            border: 2px solid rgb(0, 255, 0) !important;
            border-radius: 8px !important;
            font-size: 20px !important;
            font-weight: bold !important;
            pointer-events: none !important;
            z-index: 2147483647 !important;
            display: none !important;
            opacity: 0 !important;
            transition: opacity 300ms ease !important;
        `;
        return hudDiv;
    }

    // AUSSEHEN AUS VERSION 3 (UNTEN IM VIDEO)
    // function createHUD() {
    //     const hudDiv = document.createElement('div');
    //     hudDiv.id = 'video-control-hud';
    //     hudDiv.style.cssText = `
    //         position: absolute !important;
    //         left: 50% !important;
    //         bottom: 5px !important;
    //         transform: translateX(-50%) !important;
    //         padding: 5px 10px !important;
    //         background: rgba(0, 0, 0, 0.85) !important;
    //         color: rgb(0, 255, 0) !important;
    //         border: 2px solid rgb(0, 255, 0) !important;
    //         border-radius: 8px !important;
    //         font-size: 18px !important;
    //         font-weight: bold !important;
    //         pointer-events: none !important;
    //         z-index: 2147483647 !important;
    //         display: none !important;
    //         opacity: 0 !important;
    //         transition: 500ms !important;
    //     `;
    //     return hudDiv;
    // }

    function showHUD(message, container) {
        if (!container) return;
        if (!hud) hud = createHUD();
        if (hud.parentElement !== container) container.appendChild(hud);

        hud.textContent = message;
        hud.style.display = 'block';
        void hud.offsetWidth; // Force reflow
        hud.style.opacity = '1';

        clearTimeout(hudTimeout);
        hudTimeout = setTimeout(() => {
            hud.style.opacity = '0';
            setTimeout(() => { if (hud) hud.style.display = 'none'; }, 300);
            currentDelta = 0;
        }, 1000);
    }

    // =================================================================================
    // WRAPPER LOGIC (Nur für defekte Fullscreen-Seiten)
    // =================================================================================
    function wrapVideoIfNeeded(video) {
        if (video.parentElement?.classList.contains('video-control-wrapper')) return video.parentElement;
        const wrapper = document.createElement('div');
        wrapper.className = 'video-control-wrapper';
        wrapper.style.cssText = `
            position: relative !important; display: inline-block !important;
            width: ${video.offsetWidth}px !important; height: ${video.offsetHeight}px !important;
        `;
        video.parentNode.insertBefore(wrapper, video);
        wrapper.appendChild(video);
        return wrapper;
    }

    function unwrapVideo(wrapper) {
        const video = wrapper?.querySelector('video');
        if (video && wrapper.parentNode) {
            wrapper.parentNode.insertBefore(video, wrapper);
            wrapper.remove();
        }
    }

    if (isWrapperSite) {
        const style = document.createElement('style');
        style.textContent = `
          .video-control-wrapper:fullscreen { background: black; display: flex !important; align-items: center; justify-content: center; width: 100vw !important; height: 100vh !important; }
          .video-control-wrapper:fullscreen video { max-width: 100%; max-height: 100%; width: 100%; height: 100%; object-fit: contain; }
        `;
        document.head.appendChild(style);

        const originalRequestFullscreen = HTMLVideoElement.prototype.requestFullscreen;
        HTMLVideoElement.prototype.requestFullscreen = function(...args) {
            videoWrapper = wrapVideoIfNeeded(this);
            return videoWrapper.requestFullscreen(...args);
        };
    }

    // =================================================================================
    // FULLSCREEN & CONTEXT MENU OBSERVER
    // =================================================================================
    const contextMenuObserver = new MutationObserver(mutations => {
        mutations.forEach(m => m.addedNodes.forEach(n => {
            if (n.nodeType === 1 && n.matches && n.matches('.fluid_context_menu, #flvv_fluid_context_menu, .context_menu, .vjs-menu, .fluid_context_menu_container')) {
                n.remove();
            }
        }));
    });

    document.addEventListener('fullscreenchange', () => {
        const fsEl = document.fullscreenElement;

        if (fsEl) {
            contextMenuObserver.observe(document.body, { childList: true, subtree: true });
            lastActiveFullscreenVideo = fsEl.tagName === 'VIDEO' ? fsEl : fsEl.querySelector('video');

            if (fsEl.tagName === 'IFRAME') {
                try { if (!fsEl.contentDocument?.querySelector('video')) showHUD('Externer Player – Steuerung nicht möglich', fsEl); }
                catch (e) { showHUD('Externer Player – Steuerung nicht möglich', fsEl); }
            }
        } else {
            contextMenuObserver.disconnect();
            if (videoWrapper) { unwrapVideo(videoWrapper); videoWrapper = null; }
            if (hud) { hud.style.display = 'none'; hud.style.opacity = '0'; currentDelta = 0; }
        }
    });

    ['mousedown', 'pointerdown', 'contextmenu'].forEach(type => {
        document.addEventListener(type, function(e) {
            if (e.button !== 2 || !document.fullscreenElement) return;
            if (e.target instanceof HTMLVideoElement || e.target.closest?.('video')) {
                e.preventDefault();
                e.stopImmediatePropagation();
            }
        }, true);
    });

    // =================================================================================
    // MOUSE WHEEL CONTROL (Volume & Seek)
    // =================================================================================
    window.addEventListener('wheel', (e) => {
        const fsEl = document.fullscreenElement;
        if (!fsEl) return;
        const video = fsEl.tagName === 'VIDEO' ? fsEl : (fsEl.tagName === 'IFRAME' ? fsEl.contentDocument?.querySelector('video') : fsEl.querySelector('video'));
        if (!video) return;

        e.preventDefault();
        e.stopPropagation();

        const deltaY = -e.deltaY;
        const delta = Math.sign(deltaY) * 5;
        const currentTime = Date.now();

        if (currentTime - lastScrollTime > 500) currentDelta = 0;
        currentDelta += delta;
        lastScrollTime = currentTime;

        const targetContainer = fsEl.classList?.contains('video-control-wrapper') ? fsEl : (fsEl.tagName === 'VIDEO' ? fsEl.parentElement : fsEl);

        if ((e.buttons & 2) !== 0) {
            video.volume = Math.max(0, Math.min(video.volume + (Math.sign(deltaY) * 0.05), 1));
            showHUD(`🔊 ${Math.round(video.volume * 100)}%`, targetContainer);
        } else {
            video.currentTime = Math.max(0, Math.min(video.currentTime + delta, video.duration));
            showHUD(`${currentDelta < 0 ? '⏪ -' : '⏩ +'}${Math.abs(currentDelta)}s`, targetContainer);
        }
    }, { passive: false, capture: true });

    // =================================================================================
    // SMART FULLSCREEN (Mouse 4)
    // =================================================================================
    if (allowMouse4) {
        window.addEventListener('pointerdown', e => {
            if (e.button !== 3) return;

            const targetElement = document.elementFromPoint(e.clientX, e.clientY);
            if (targetElement?.closest('.mbcontent, .h-thumb-video, .video-preview')) return;

            let video = targetElement?.closest('video') || targetElement?.closest('div, figure, .player')?.querySelector('video');

            if (!video && document.fullscreenElement) {
                video = document.fullscreenElement.tagName === 'VIDEO' ? document.fullscreenElement : document.fullscreenElement.querySelector('video');
            }

            if (!video) {
                const allVideos = Array.from(document.querySelectorAll('video'));
                if (allVideos.length > 0) video = allVideos.reduce((p, c) => (p.offsetWidth * p.offsetHeight > c.offsetWidth * c.offsetHeight) ? p : c);
            }

            if (!video || (video.offsetWidth > 0 && video.offsetWidth < 450)) return;

            e.stopPropagation();
            lastActiveFullscreenVideo = video;

            // WENN BEREITS FULLSCREEN: Sauber beenden
            if (document.fullscreenElement) {
                const videoJsPlayer = video.player || video.closest('.video-js, .vjs-player')?.player;
                if (videoJsPlayer && typeof videoJsPlayer.exitFullscreen === 'function') {
                    videoJsPlayer.exitFullscreen();
                } else {
                    document.exitFullscreen().catch(err => console.error(err));
                }
                return;
            }

            // PRIORITÄT 1: Native API für Video.js (Wichtig für Eporner!) & JWPlayer
            const videoJsPlayer = video.player || video.closest('.video-js, .vjs-player')?.player;
            if (videoJsPlayer && typeof videoJsPlayer.requestFullscreen === 'function') {
                videoJsPlayer.requestFullscreen();
                return;
            }

            const jwGlobal = typeof unsafeWindow !== 'undefined' ? unsafeWindow.jwplayer : window.jwplayer;
            if (typeof jwGlobal === "function" && video.closest('[id^="jwplayer_"]')) {
                try {
                    const jw = jwGlobal(video.closest('[id^="jwplayer_"]').id);
                    if (jw) return jw.setFullscreen(true);
                } catch (err) {}
            }

            const playerContainer = video.closest('.plyr, .video-js, .vjs-player, .player, .video-wrapper, [id^="jwplayer_"]');

            // PRIORITÄT 2: Button Klick für Plyr (Wichtig für Bunkr!)
            if (playerContainer) {
                const fsButton = playerContainer.querySelector(
                    'button[data-plyr="fullscreen"], ' +
                    '.vjs-fullscreen-control, ' +
                    '.ypsv-fullscr, ' +
                    'button[aria-label*="Full"], ' +
                    'button[title*="Full"], ' +
                    'button[title*="Vollbild"], ' +
                    '[class*="fullscreen"]'
                );
                if (fsButton) {
                    fsButton.click();
                    return;
                }
            }

            // PRIORITÄT 3: Fallback Container (Der Top-Layer Fix)
            let targetFsElement = playerContainer || video;
            targetFsElement.requestFullscreen().catch(err => console.error(err));

        }, { capture: true });
    }
})();