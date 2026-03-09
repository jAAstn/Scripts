// ==UserScript==
// @name          +++ Scroll & Volume Control mit UI + Video Fullscreen M4+++
// @namespace     http://tampermonkey.net/
// @version       3
// @description   Scroll im Fullscreen springt im Video 10s vor/zurück oder ändert bei gedrücktem Rechtsklick die Lautstärke (hoch = lauter, runter = leiser) mit UI, ignoriert externe iframes
// @author        me
// @include        *://*/*
// @icon          https://i.imgur.com/Jf2wKMr.png
// @grant unsafeWindow
// ==/UserScript==
// NEW : Universeller Context-Menu Block für Videos anstelle von fluid blocker

(function () {
    'use strict';

    let hudTimeout;
    let hud;
    let lastScrollTime = Date.now();
    let currentDelta = 0;
    let videoWrapper = null;

    // Erstelle HUD
    function createHUD() {
        let hudDiv = document.createElement('div');
        hudDiv.id = 'video-control-hud';
        hudDiv.className = 'video-control-hud';
        // hudDiv.setAttribute('style', `
        //     position: absolute !important;
        //     left: 50% !important;
        //     top: 60px !important;
        //     transform: translateX(-50%) !important;
        //     background: rgba(0, 0, 0, 0.85) !important;
        //     color: rgb(0, 255, 0) !important;
        //     border: 2px solid rgb(0, 255, 0) !important;
        //     border-radius: 8px !important;
        //     padding: 8px 12px !important;
        //     font-size: 22px !important;
        //     font-family: Arial, sans-serif !important;
        //     font-weight: bold !important;
        //     text-align: center !important;
        //     z-index: 2147483647 !important;
        //     pointer-events: none !important;
        //     display: none !important;
        //     opacity: 0 !important;
        //     transition: opacity 300ms ease !important;
        // `);
        // return hudDiv;
        hudDiv.setAttribute('style', `
         position: absolute !important;
         left: 50% !important;
         bottom: 5px !important;
         transform: translateX(-50%) !important;
         padding: 5px 10px !important;
         background: rgba(0, 0, 0, 0.85) !important;
         color: rgb(0, 255, 0) !important;
         border: 2px solid rgb(0, 255, 0) !important;
         border-radius: 8px !important;
         font-size: 18px !important;
         font-weight: bold !important;
         pointer-events: none !important;
         z-index: 2147483647 !important;
         display: none !important;
         opacity: 0 !important;
         transition: 500ms !important;
         `);
        return hudDiv;
    }

    // Wrppe das Video, damit wir ein Parent-Element für das HUD haben
    function wrapVideoIfNeeded(video) {
        // Prüfe ob Video bereits gewrappt ist
        if (video.parentElement?.classList.contains('video-control-wrapper')) {
            return video.parentElement;
        }

        // Speichere die ursprünglichen Dimensionen des Videos
        const originalWidth = video.offsetWidth;
        const originalHeight = video.offsetHeight;
        const computedStyle = window.getComputedStyle(video);

        // Erstelle Wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'video-control-wrapper';

        // WICHTIG: Wrapper nimmt NUR die Größe des Videos an, nicht 100%
        wrapper.style.cssText = `
            position: relative !important;
            display: inline-block !important;
            width: ${originalWidth}px !important;
            height: ${originalHeight}px !important;
            max-width: ${computedStyle.maxWidth} !important;
            max-height: ${computedStyle.maxHeight} !important;
        `;

        // Speichere Original-Dimensionen als Data-Attribute
        wrapper.setAttribute('data-original-width', originalWidth);
        wrapper.setAttribute('data-original-height', originalHeight);

        // Füge Video in Wrapper ein
        video.parentNode.insertBefore(wrapper, video);
        wrapper.appendChild(video);

        return wrapper;
    }

    // Unwrap Video nach Fullscreen
    function unwrapVideo(wrapper) {
        if (!wrapper || !wrapper.classList.contains('video-control-wrapper')) return;

        const video = wrapper.querySelector('video');
        if (!video) return;

        // Setze Video zurück zum ursprünglichen Parent
        const parent = wrapper.parentNode;
        if (parent) {
            parent.insertBefore(video, wrapper);
            wrapper.remove();
        }
    }

    // HUD anzeigen
    function showHUD(message) {
        const fsEl = document.fullscreenElement;
        if (!fsEl) return;

        let targetContainer = null;

        // Finde den richtigen Container
        if (fsEl.tagName === 'VIDEO') {
            if (!fsEl.parentElement) {
                return;
            }
            targetContainer = fsEl.parentElement;
        } else if (fsEl.classList?.contains('video-control-wrapper')) {
            targetContainer = fsEl;
        } else {
            targetContainer = fsEl;
        }

        if (!hud) {
            hud = createHUD();
        }

        // Entferne HUD aus altem Container
        if (hud.parentElement && hud.parentElement !== targetContainer) {
            hud.remove();
        }

        // Füge HUD zum Container hinzu
        if (targetContainer && !targetContainer.contains(hud)) {
            targetContainer.appendChild(hud);
        }

        hud.textContent = message;
        hud.style.display = 'block';
        void hud.offsetWidth;
        hud.style.opacity = '1';

        clearTimeout(hudTimeout);
        hudTimeout = setTimeout(() => {
            hud.style.opacity = '0';
            setTimeout(() => {
                hud.style.display = 'none';
            }, 300);
            currentDelta = 0;
        }, 1000);
    }

    // Suche das Video im Fullscreen
    function getFullscreenVideo() {
        const fsEl = document.fullscreenElement;
        if (!fsEl) return null;

        if (fsEl.tagName === 'VIDEO') return fsEl;

        if (fsEl.tagName === 'IFRAME') {
            try {
                const doc = fsEl.contentDocument || fsEl.contentWindow.document;
                return doc.querySelector('video');
            } catch (e) {
                return null;
            }
        }

        return fsEl.querySelector('video');
    }

    // *** FIX: Nur wrapper verwenden für spezifische Seiten ***
    const useWrapperSites = ['gofile.io', 'rule34video.com', 'pixeldrain.com', 'hentai.tv', 'fileditchfiles.me'];
    const shouldUseWrapper = useWrapperSites.some(site => location.href.includes(site));

    // Intercepte Fullscreen Requests und wrppe das Video nur wenn nötig
    const originalRequestFullscreen = HTMLVideoElement.prototype.requestFullscreen;
    HTMLVideoElement.prototype.requestFullscreen = function(...args) {
        if (shouldUseWrapper) {
            const wrapper = wrapVideoIfNeeded(this);
            videoWrapper = wrapper;
            return wrapper.requestFullscreen.call(wrapper, ...args);
        } else {
            return originalRequestFullscreen.call(this, ...args);
        }
    };

    // CSS
    const style = document.createElement('style');
    style.textContent = `
      .video-control-wrapper:fullscreen {
        background: black;
        display: flex !important;
        align-items: center;
        justify-content: center;
        width: 100vw !important;
        height: 100vh !important;
      }

      .video-control-wrapper:fullscreen video {
        max-width: 100%;
        max-height: 100%;
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
    `;
    document.head.appendChild(style);

    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            // Entferne alle Context-Menüs die versuchen sich zu zeigen
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) { // Element node
                    if (node.classList?.contains('fluid_context_menu') ||
                        node.id === 'flvv_fluid_context_menu' ||
                        node.classList?.contains('context_menu') ||
                        node.classList?.contains('vjs-menu')) {
                        node.remove();
                    }
                }
            });
        });
    });

    // Beobachte nur im Fullscreen
    document.addEventListener('fullscreenchange', () => {
        if (document.fullscreenElement) {
            observer.observe(document.body, { childList: true, subtree: true });
        } else {
            observer.disconnect();
        }
    });

    function showExternalIframeWarning() {
        const msg = 'Externer Player – Steuerung nicht möglich';
        showHUD(msg);
    }

    // Fullscreen Change
    document.addEventListener('fullscreenchange', () => {
        const fsEl = document.fullscreenElement;

        if (!fsEl) {
            // Fullscreen wurde verlassen - entferne Wrapper
            if (videoWrapper) {
                unwrapVideo(videoWrapper);
                videoWrapper = null;
            }

            if (hud) {
                hud.style.display = 'none';
                hud.style.opacity = '0';
                clearTimeout(hudTimeout);
                currentDelta = 0;
            }
            return;
        }

        if (fsEl.tagName === 'IFRAME') {
            try {
                const doc = fsEl.contentDocument || fsEl.contentWindow.document;
                if (!doc.querySelector('video')) showExternalIframeWarning();
            } catch (e) {
                showExternalIframeWarning();
            }
        }
    });

    // Universeller Context-Menu Block für Videos
    function isVideoTarget(e) {
        return e.target instanceof HTMLVideoElement ||
            (e.target.closest && e.target.closest('video'));
    }

    ['mousedown', 'pointerdown', 'contextmenu'].forEach(type => {
        document.addEventListener(type, function(e) {
            if (e.button !== 2) return; // Nur Rechtsklick
            if (!isVideoTarget(e)) return;

            // Im Fullscreen: Verhindere Context-Menu komplett
            if (document.fullscreenElement) {
                e.preventDefault();
                e.stopImmediatePropagation();
            }
        }, true);
    });

    window.addEventListener('wheel', (e) => {
        const fsEl = document.fullscreenElement;
        if (!fsEl) return;

        const video = getFullscreenVideo();
        if (!video) return;

        e.preventDefault();
        e.stopPropagation();

        const deltaY = -e.deltaY;
        const delta = Math.sign(deltaY) * 5;
        const currentTime = Date.now();
        if (currentTime - lastScrollTime > 500) currentDelta = 0;
        currentDelta += delta;
        lastScrollTime = currentTime;

        const rightPressed = (e.buttons & 2) !== 0;

        if (!rightPressed) {
            video.currentTime = Math.max(0, Math.min(video.currentTime + delta, video.duration));
            const msg = `${currentDelta < 0 ? '⏪ -' : '⏩ +'}${Math.abs(currentDelta)}s`;
            showHUD(msg);
        } else {
            const volumeDelta = Math.sign(deltaY) * 0.05;
            const newVolume = Math.max(0, Math.min(video.volume + volumeDelta, 1));
            video.volume = newVolume;
            const msg = `🔊 ${Math.round(newVolume * 100)}%`;
            showHUD(msg);
        }
    }, { passive: false, capture: true });

})();

// Video Fullscreen Logik (Mouse4) & Advanced Scroll Manager
(function () {
    const excludes = ["rule34", "youtube.com", "supjav.com", "javdoe.to", "hanime.tv", "hentaimama.io", "noodlemagazine.com", "xvideos.com", "watchhentai", "oppai.stream"];
    if (excludes.some(site => location.href.includes(site))) return;

    // Speichert das letzte aktive Video für den generischen Fall
    let lastActiveFullscreenVideo = null;
    // Speichert eine spezifische Scroll-Funktion, falls eine definiert wurde
    let siteSpecificScrollAction = null;

    // =================================================================================
    // SECTION: Site Specific Scroll Handler Definition
    // =================================================================================
    /**
     * Erstellt einen Handler, der zu einem Element scrollt und einen Offset (für Header) beachtet.
     * Führt den Scrollvorgang einmal beim Laden und immer nach Fullscreen-Exit aus.
     */
    function createScrollHandler(selector, offset) {
        const performScroll = () => {
            const el = document.querySelector(selector);
            if (el) {
                // Berechnet die absolute Position + Offset
                const elementPosition = el.getBoundingClientRect().top + window.scrollY;
                const offsetPosition = elementPosition - offset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: "smooth"
                });
            }
        };

        // 1. Als Aktion für Fullscreen-Exit setzen
        siteSpecificScrollAction = performScroll;

        // 2. Einmalig beim Laden ausführen (nach kurzer Verzögerung für dynamische Inhalte)
        if (document.readyState === 'complete') {
            setTimeout(performScroll, 500);
        } else {
            window.addEventListener('load', () => setTimeout(performScroll, 500));
        }
    }

    // --- Konfigurationen hinzufügen ---

    // Initialize for Eporner
    if (location.href.includes("eporner.")) {
        createScrollHandler('video', 40);
    }

    // Initialize for Bunkr
    if (location.href.includes("bunkr.")) {
        createScrollHandler('video, img.relative.z-20', 77);
    }

    // =================================================================================
    // SECTION: Fullscreen Event Listener
    // =================================================================================
    function handleFullscreenChange() {
        // A) Fullscreen wurde AKTIVIERT
        if (document.fullscreenElement) {
            const fsEl = document.fullscreenElement;
            lastActiveFullscreenVideo = fsEl.tagName === 'VIDEO' ? fsEl : fsEl.querySelector('video');
        }
        // B) Fullscreen wurde BEENDET
        else {
            setTimeout(() => {
                // Priorität 1: Spezifischer Handler (Eporner, Bunkr)
                if (siteSpecificScrollAction) {
                    siteSpecificScrollAction();
                }
                // Priorität 2: Generischer Fallback (GoFile, etc.)
                else if (lastActiveFullscreenVideo) {
                    lastActiveFullscreenVideo.scrollIntoView({ behavior: 'auto', block: 'center' });
                }
            }, 100); // Kurze Wartezeit, damit die Seite ihr Layout erst resetten kann
        }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);


    // =================================================================================
    // SECTION: Mouse4 Interaction (Smart Fullscreen)
    // =================================================================================
    window.addEventListener('pointerdown', e => {
        if (e.button !== 3) return;
        e.stopPropagation();
        toggleSmartFullscreen(e);
    }, { capture: true });

    function toggleSmartFullscreen(e) {
        const targetElement = document.elementFromPoint(e.clientX, e.clientY);

        // Ignorieren von Vorschaubildern
        if (targetElement?.closest('.mbcontent, .h-thumb-video, .video-preview')) return;

        let video = targetElement?.closest('video');

        // Intelligente Suche (falls Leiste geklickt wurde)
        if (!video && targetElement) {
            const parent = targetElement.closest('div, figure, .player');
            if (parent) video = parent.querySelector('video');
        }

        // Exit-Strategie: Wenn bereits Fullscreen, nimm das aktuelle Video
        if (!video && document.fullscreenElement) {
             video = (document.fullscreenElement.tagName === 'VIDEO')
                ? document.fullscreenElement
                : document.fullscreenElement.querySelector('video');
        }

        // Fallback: Größtes Video suchen
        if (!video) {
             const allVideos = Array.from(document.querySelectorAll('video'));
             if (allVideos.length > 0) {
                 video = allVideos.reduce((prev, current) => {
                     const prevRect = prev.getBoundingClientRect();
                     const currRect = current.getBoundingClientRect();
                     return (prevRect.width * prevRect.height > currRect.width * currRect.height) ? prev : current;
                 });
             }
        }

        if (!video) return;
        if (video.offsetWidth > 0 && video.offsetWidth < 450) return;

        // Video speichern für Generic-Restore
        lastActiveFullscreenVideo = video;

        // --- Player Spezifische Logik ---

        // Plyr
        const plyrContainer = video.closest('.plyr');
        if (plyrContainer) {
            const plyrInstance = plyrContainer.plyr || plyrContainer.__plyr;
            if (plyrInstance) { plyrInstance.fullscreen.toggle(); return; }
            const fsButton = plyrContainer.querySelector('button[data-plyr="fullscreen"]');
            if (fsButton) { fsButton.click(); return; }
        }

        // VideoJS
        const videoJsPlayer = video.player || video.closest('.vjs-player')?.player;
        if (videoJsPlayer) {
            if (videoJsPlayer.isFullscreen()) videoJsPlayer.exitFullscreen();
            else videoJsPlayer.requestFullscreen();
            return;
        }

        // JWPlayer
        const jwGlobal = (typeof unsafeWindow !== 'undefined') ? unsafeWindow.jwplayer : window.jwplayer;
        if (typeof jwGlobal === "function") {
            const jwContainer = video.closest('[id^="jwplayer_"]');
            if (jwContainer) {
                try {
                    const jw = jwGlobal(jwContainer.id);
                    if (jw) { jw.setFullscreen(!jw.getFullscreen()); return; }
                } catch (err) {}
            }
        }

        // Generische Buttons
        const fsButton = video.closest('div')?.querySelector('.vjs-fullscreen-control, .ypsv-fullscr, button[aria-label*="Full"], [class*="fullscreen"]');
        if (fsButton) { fsButton.click(); return; }

        // Standard API
        if (!document.fullscreenElement) {
            video.requestFullscreen().catch(err => console.error(err));
        } else {
            document.exitFullscreen().catch(err => console.error(err));
        }
    }
})();

// Fluid Player Context Menu Block
(function() {
    'use strict';
    const blockFluidMenu = () => {
        const removeMenus = () => document.querySelectorAll('.fluid_context_menu, .fluid_context_menu_container').forEach(el => el.remove());
        removeMenus();
        new MutationObserver(removeMenus).observe(document.body, { childList: true, subtree: true });
    };
    if (document.readyState !== "loading") blockFluidMenu();
    else document.addEventListener("DOMContentLoaded", blockFluidMenu);
})();
