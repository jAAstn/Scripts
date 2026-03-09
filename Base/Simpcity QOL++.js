// ==UserScript==
// @name         Simpcity - FastView + Download & Links umbrechen + überflüssige CSS entfernen & Album von bildern entfernt & iframe block, empty post remove + redirect
// @namespace    J
// @version      5.2
// @description  Zoom per Rechtsklick, Download per Klick (Originalname), Tooltips entfernen, FastView von Rule34 eingebaut sowie Album von bildern entfernt
// @author       J
// @match        https://simpcity.cr/threads/*
// @connect      *
// @icon         https://i.imgur.com/9It0Ga9.png
// @grant        GM_download
// ==/UserScript==

(function () {
    'use strict';

    let currentZoomed = null;
    let zoomOverlay = null;

    const setVisibility = (el, isVisible) => {
        el.style.opacity = isVisible ? '1' : '0';
        el.style.pointerEvents = isVisible ? 'auto' : 'none';
    };

    /**
     * Löst den Download direkt über GM_download aus.
     * Prüft optional die Bildhöhe (standardmäßig aktiviert).
     */
    const downloadImage = async (srcUrl, heightCheck = true) => {
        const fullUrl = srcUrl.replace(/\.md\.(jpg|png)$/i, '.$1');
        const fileName = fullUrl.split('/').pop();

        // Führe die Höhenprüfung durch, falls angefordert
        if (heightCheck) {
            const testImg = new Image();
            testImg.src = fullUrl;
            await new Promise(resolve => {
                if (testImg.complete) return resolve();
                testImg.onload = resolve;
                testImg.onerror = resolve;
            });

            if (testImg.height < 1000) {
                console.log(`Bild übersprungen (Höhe: ${testImg.height}px < 1000px): ${fileName}`);
                return; // Nicht herunterladen
            }
        }

        console.log(`Starte Download (direkt) für: ${fileName}`);
        GM_download({
            url: fullUrl,
            name: fileName,
            saveAs: false,
        });
    };

    const createZoomOverlay = () => {
        zoomOverlay = document.createElement('div');
        zoomOverlay.style.position = 'fixed';
        zoomOverlay.style.top = 0;
        zoomOverlay.style.left = 0;
        zoomOverlay.style.width = '100vw';
        zoomOverlay.style.height = '100vh';
        zoomOverlay.style.display = 'flex';
        zoomOverlay.style.justifyContent = 'center';
        zoomOverlay.style.alignItems = 'center';
        zoomOverlay.style.zIndex = '9999';
        zoomOverlay.style.background = 'rgba(0,0,0,0.85)';
        zoomOverlay.style.transition = 'opacity 0.2s';
        zoomOverlay.style.cursor = 'default';
        zoomOverlay.style.opacity = '0';
        zoomOverlay.style.pointerEvents = 'none';
        document.body.appendChild(zoomOverlay);
    };

    const resetZoom = () => {
        if (zoomOverlay) setVisibility(zoomOverlay, false);
        if (currentZoomed) {
            const toRemove = currentZoomed;
            currentZoomed = null;
            setTimeout(() => {
                toRemove.remove();
            }, 150);
        }
    };

    const fetchImage = async (src) => {
        try {
            const fullSrc = src.replace(/\.md\.(jpg|png)$/i, '.$1');
            const img = document.createElement('img');
            img.src = fullSrc;
            img.className = 'zoom-enabled';
            img.style.maxWidth = '100%';
            img.style.maxHeight = '100%';
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
            });
            return img;
        } catch (err) {
            console.error('Fehler beim Laden des Bildes:', err);
        }
    };

    /**
     * RECHTSKLICK-Handler (Nur für das Öffnen von FastView)
     */
    document.body.addEventListener('contextmenu', async function (e) {
        const img = e.target.closest('img.bbImage');

        if (currentZoomed) {
            e.preventDefault();
            resetZoom();
            return;
        }

        if (!img) return;

        e.preventDefault();

        if (!zoomOverlay) createZoomOverlay();

        const fullImg = await fetchImage(img.src);
        if (fullImg) {
            resetZoom();

            currentZoomed = fullImg;
            zoomOverlay.appendChild(fullImg);
            setVisibility(zoomOverlay, true);
        }
    });

    /**
     * LINKSKLICK-Handler (Dieser eine Handler steuert ALLES)
     */
    document.body.addEventListener('click', async function (e) {

        if (currentZoomed) {
            // --- LOGIK, WENN FASTVIEW GEÖFFNET IST ---

            e.preventDefault();
            e.stopPropagation();

            if (e.target === currentZoomed) {
                // Klick auf das Bild: Herunterladen (MIT Prüfung) und Schließen

                // *** HIER IST DIE ÄNDERUNG (false -> true) ***
                await downloadImage(currentZoomed.src, true);

                resetZoom();
            } else {
                // Klick auf den Hintergrund: Nur Schließen
                resetZoom();
            }
            return;
        }

        // --- LOGIK, WENN FASTVIEW GESCHLOSSEN IST ---

        const a = e.target.closest('a.link--external');
        if (a && /^https?:\/\/jpg[1-9]\.(su|cr)\/img\//.test(a.href)) {
            const linkedImg = a.querySelector('img.bbImage');
            if (!linkedImg) return;

            e.preventDefault();
            e.stopPropagation();

            // Lade das Bild herunter (mit Höhenprüfung)
            await downloadImage(linkedImg.src, true);
        }
    }, true);

    /**
     * Mouseover-Handler (Unverändert)
     */
    document.body.addEventListener('mouseover', function (e) {
        const img = e.target.closest('img.bbImage');
        if (!img || !img.src.match(/\.md\.(jpg|png)$/i)) return;
        img.alt = '';
        img.title = '';
    }, true);
})();

(function () {
    'use strict';

    const DOMAIN_PATTERNS = [
        /:\/\/(?:[^\/]*\.)?bunkr\./i,
        /:\/\/(?:[^\/]*\.)?gofile\.io\//i,
        /:\/\/(?:[^\/]*\.)?porntrex\.com\//i,
        /:\/\/(?:[^\/]*\.)?pixeldrain\.com\//i,
        /:\/\/(?:[^\/]*\.)?bunkrrr\./i,
        /:\/\/(?:[^\/]*\.)?eporner\.com\//i,
        /:\/\/(?:[^\/]*\.)?coomer\.cr\//i
    ];

    function shouldAddBrAfter(anchor) {
        return !anchor.nextSibling || anchor.nextSibling.nodeName !== 'BR';
    }

    function removeExtraBrs(wrapper) {
        const children = Array.from(wrapper.childNodes);
        let lastWasBr = false;

        children.forEach(node => {
            if (node.nodeName === 'BR') {
                if (lastWasBr) {
                    wrapper.removeChild(node); // Entferne überzähligen <br>
                } else {
                    lastWasBr = true;
                }
            } else if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() === '') {
                // ignoriere reine Leerzeichen-Texte
            } else {
                lastWasBr = false;
            }
        });
    }

    function removeBrAfterWrapper(wrapper) {
        const next = wrapper.nextSibling;
        if (next && next.nodeName === 'BR') {
            next.remove();
        }
    }

    function processWrapper(wrapper) {
        const links = wrapper.querySelectorAll('a[href]');
        links.forEach(link => {
            const href = link.href;
            if (DOMAIN_PATTERNS.some(pattern => pattern.test(href))) {
                if (shouldAddBrAfter(link)) {
                    link.after(document.createElement('br'));
                }
            }
        });

        // Doppelte <br> entfernen
        removeExtraBrs(wrapper);

        // <br> direkt nach .bbWrapper entfernen
        removeBrAfterWrapper(wrapper);
    }

    function run() {
        document.querySelectorAll('div.bbWrapper').forEach(processWrapper);
    }

    // Direkt beim Laden ausführen
    run();

    // MutationObserver für dynamisch nachgeladene Inhalte
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === 1 && node.matches?.('div.bbWrapper')) {
                    processWrapper(node);
                } else if (node.nodeType === 1) {
                    node.querySelectorAll?.('div.bbWrapper').forEach(processWrapper);
                }
            }
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
})();

(function () {
    'use strict';

    const cleanJsLbImageClass = () => {
        document.querySelectorAll("div.bbWrapper").forEach(wrapper => {
            const imageWrapper = wrapper.querySelector("div.bbImageWrapper.js-lbImage");
            if (imageWrapper) {
                imageWrapper.classList.remove("js-lbImage");
                console.log("js-lbImage-Klasse entfernt");
            }
        });
    };

    // Warten bis DOM vollständig geladen ist
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", cleanJsLbImageClass);
    } else {
        cleanJsLbImageClass();
    }
})();

//iframe block, empty post remove (claude)
(function () {
    'use strict';

    function blockSpecificContent() {
        const blockedDomains = ['cdn.turbo.cr', 'turbovid.cr', 'turbo.cr', 'redgifs.com'];

        const checkAndRemoveElement = (element) => {
            let shouldRemove = false;

            // FALL 1: Es ist ein IFRAME
            if (element.tagName === 'IFRAME') {
                const src = element.getAttribute('src') || '';
                if (blockedDomains.some(domain => src.includes(domain))) {
                    shouldRemove = true;
                }
            }
            // FALL 2: Es ist ein REDGIFS SPAN (Click-to-load)
            else if (element.tagName === 'SPAN' && element.getAttribute('data-s9e-mediaembed') === 'redgifs') {
                shouldRemove = true;
            }

            // Wenn nichts zutrifft, abbrechen
            if (!shouldRemove) return false;

            // --- AB HIER WIRD GELÖSCHT ---

            // 1. Finde den umgebenden Post BEVOR wir etwas löschen
            const postArticle = element.closest('article.message--post');

            // 2. Suche nach dem umgebenden div mit der Klasse "generic2wide-iframe-div"
            // (Das umschließt sowohl Iframes als auch die Redgifs-Vorschau)
            const parentDiv = element.closest('.generic2wide-iframe-div');

            // 3. Element oder Wrapper entfernen
            if (parentDiv) {
                parentDiv.remove();
            } else {
                element.remove();
            }

            // 4. Prüfen, ob der Post nun "leer" ist (keine <a> Tags mehr enthält)
            if (postArticle) {
                const messageContent = postArticle.querySelector('.message-content.js-messageContent');

                // Wenn der Content-Bereich existiert, aber KEIN <a> Tag darin gefunden wird
                if (messageContent && !messageContent.querySelector('a')) {
                    postArticle.remove();
                    // console.log('Leeren Post entfernt (wegen Iframe oder Embed):', postArticle);
                }
            }

            return true;
        };

        // Selektor für Iframes UND die speziellen Spans
        const selector = 'iframe, span[data-s9e-mediaembed="redgifs"]';

        // Entferne existierende Elemente beim Start
        document.querySelectorAll(selector).forEach(checkAndRemoveElement);

        // Beobachte neue Elemente (MutationObserver)
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    // Prüfen ob der hinzugefügte Node selbst ein Treffer ist (Iframe oder Span)
                    if (node.tagName === 'IFRAME' || (node.tagName === 'SPAN' && node.getAttribute('data-s9e-mediaembed') === 'redgifs')) {
                        checkAndRemoveElement(node);
                    }
                    // Prüfen ob innerhalb des neuen Nodes Treffer sind (z.B. wenn ein ganzer Div container geladen wird)
                    if (node.querySelectorAll) {
                        node.querySelectorAll(selector).forEach(checkAndRemoveElement);
                    }
                });
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    // Starte das Script sobald die Seite bereit ist
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', blockSpecificContent);
    } else {
        blockSpecificContent();
    }

})();

//Re-re-direct externe links
(function () {
    "use strict";

    // fallback for when we are already on a redirect page
    if (window.location.href.includes('/redirect/')) {
        const target = document.querySelector(".simpLinkProxy-targetLink").href;

        window.location.replace(target)
    }

    // otherwise try to modify links as they are added to the page

    function decodeTarget(str) {
        try {

            const normalized = str.replace(/-/g, '+').replace(/_/g, '/');
            return atob(normalized);
        } catch (e) {
            console.error("[SimpCity Re-re-direct] Failed to decode base64:", str, e);
            return null;
        }
    }

    function processLinks() {
        const links = document.querySelectorAll('a[href*="/redirect/?to="]:not([data-bypassed])');

        links.forEach(link => {
            link.dataset.bypassed = "true";
            try {
                const url = new URL(link.href, window.location.origin);
                let targetUrl = url.searchParams.get("to");
                const mode = url.searchParams.get("m");

                if (targetUrl && mode === "b64") {
                    targetUrl = decodeTarget(targetUrl);
                }

                if (targetUrl) {
                    link.href = targetUrl;
                    link.removeAttribute('data-proxy-handler');
                    link.removeAttribute('data-blank-handler');
                    link.removeAttribute('data-proxy-href');
                }
            } catch (e) {
                // Silently fail for invalid URLs
            }
        });
    }

    // keep watch for loaded links
    const observer = new MutationObserver(() => {
        processLinks();
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    // first pass
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', processLinks);
    } else {
        processLinks();
    }

})();
