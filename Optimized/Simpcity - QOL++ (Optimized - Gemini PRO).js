// ==UserScript==
// @name         Simpcity - QOL++ (Optimized - Gemini PRO)
// @namespace    J
// @version      6.0
// @description  Optimierte Version: Ein zentraler Observer für bessere Performance, Zoom per Rechtsklick, Download per Klick etc.
// @author       J
// @match        https://simpcity.cr/threads/*
// @connect      *
// @icon         https://i.imgur.com/9It0Ga9.png
// @grant        GM_download
// ==/UserScript==

(function () {
    'use strict';

    // --- KONFIGURATION ---
    const CONFIG = {
        minImageHeight: 1000,
        blockedDomains: ['cdn.turbo.cr', 'turbovid.cr', 'turbo.cr', 'redgifs.com'],
        domainPatterns: [
            /:\/\/(?:[^\/]*\.)?bunkr\./i,
            /:\/\/(?:[^\/]*\.)?gofile\.io\//i,
            /:\/\/(?:[^\/]*\.)?porntrex\.com\//i,
            /:\/\/(?:[^\/]*\.)?pixeldrain\.com\//i,
            /:\/\/(?:[^\/]*\.)?bunkrrr\./i,
            /:\/\/(?:[^\/]*\.)?eporner\.com\//i,
            /:\/\/(?:[^\/]*\.)?coomer\.cr\//i
        ]
    };

    // --- MODUL 1: FastView & Download ---
    let currentZoomed = null;
    let zoomOverlay = null;

    const setVisibility = (el, isVisible) => {
        el.style.opacity = isVisible ? '1' : '0';
        el.style.pointerEvents = isVisible ? 'auto' : 'none';
    };

    const downloadImage = async (srcUrl, heightCheck = true) => {
        const fullUrl = srcUrl.replace(/\.md\.(jpg|png)$/i, '.$1');
        const fileName = fullUrl.split('/').pop();

        if (heightCheck) {
            const testImg = new Image();
            testImg.src = fullUrl;
            await new Promise(resolve => {
                if (testImg.complete) return resolve();
                testImg.onload = resolve;
                testImg.onerror = resolve;
            });
            if (testImg.height < CONFIG.minImageHeight) return;
        }

        GM_download({ url: fullUrl, name: fileName, saveAs: false });
    };

    const createZoomOverlay = () => {
        zoomOverlay = Object.assign(document.createElement('div'), {
            style: 'position:fixed;top:0;left:0;width:100vw;height:100vh;display:flex;justify-content:center;align-items:center;z-index:9999;background:rgba(0,0,0,0.85);transition:opacity 0.2s;cursor:default;opacity:0;pointer-events:none;'
        });
        document.body.appendChild(zoomOverlay);
    };

    const resetZoom = () => {
        if (zoomOverlay) setVisibility(zoomOverlay, false);
        if (currentZoomed) {
            const toRemove = currentZoomed;
            currentZoomed = null;
            setTimeout(() => toRemove.remove(), 150);
        }
    };

    document.body.addEventListener('contextmenu', async e => {
        const img = e.target.closest('img.bbImage');
        if (currentZoomed) { e.preventDefault(); resetZoom(); return; }
        if (!img) return;
        e.preventDefault();

        if (!zoomOverlay) createZoomOverlay();
        const fullSrc = img.src.replace(/\.md\.(jpg|png)$/i, '.$1');
        const fullImg = Object.assign(document.createElement('img'), { src: fullSrc, className: 'zoom-enabled' });
        Object.assign(fullImg.style, { maxWidth: '100%', maxHeight: '100%' });

        await new Promise((resolve) => { fullImg.onload = resolve; fullImg.onerror = resolve; });
        resetZoom();
        currentZoomed = fullImg;
        zoomOverlay.appendChild(fullImg);
        setVisibility(zoomOverlay, true);
    });

    document.body.addEventListener('click', async e => {
        if (currentZoomed) {
            e.preventDefault(); e.stopPropagation();
            if (e.target === currentZoomed) await downloadImage(currentZoomed.src, true);
            resetZoom();
            return;
        }
        const a = e.target.closest('a.link--external');
        if (a && /^https?:\/\/jpg[1-9]\.(su|cr)\/img\//.test(a.href)) {
            const linkedImg = a.querySelector('img.bbImage');
            if (linkedImg) {
                e.preventDefault(); e.stopPropagation();
                await downloadImage(linkedImg.src, true);
            }
        }
    }, true);

    document.body.addEventListener('mouseover', e => {
        const img = e.target.closest('img.bbImage');
        if (img && img.src.match(/\.md\.(jpg|png)$/i)) { img.alt = ''; img.title = ''; }
    }, true);

    // --- MODUL 2: DOM Manipulation Worker Funktionen ---

    const processWrapper = (wrapper) => {
        wrapper.querySelectorAll('a[href]').forEach(link => {
            if (CONFIG.domainPatterns.some(p => p.test(link.href)) && (!link.nextSibling || link.nextSibling.nodeName !== 'BR')) {
                link.after(document.createElement('br'));
            }
        });
        // Extra <br> aufräumen
        let lastWasBr = false;
        Array.from(wrapper.childNodes).forEach(node => {
            if (node.nodeName === 'BR') {
                if (lastWasBr) wrapper.removeChild(node);
                else lastWasBr = true;
            } else if (node.nodeType !== Node.TEXT_NODE || node.textContent.trim() !== '') {
                lastWasBr = false;
            }
        });
        if (wrapper.nextSibling?.nodeName === 'BR') wrapper.nextSibling.remove();
    };

    const cleanJsLbImage = (el) => {
        if (el.classList?.contains("js-lbImage")) el.classList.remove("js-lbImage");
        el.querySelectorAll?.("div.bbImageWrapper.js-lbImage").forEach(w => w.classList.remove("js-lbImage"));
    };

    const checkAndRemoveElement = (element) => {
        let shouldRemove = false;
        if (element.tagName === 'IFRAME') {
            const src = element.getAttribute('src') || '';
            if (CONFIG.blockedDomains.some(d => src.includes(d))) shouldRemove = true;
        } else if (element.tagName === 'SPAN' && element.getAttribute('data-s9e-mediaembed') === 'redgifs') {
            shouldRemove = true;
        }

        if (!shouldRemove) return false;

        const postArticle = element.closest('article.message--post');
        const parentDiv = element.closest('.generic2wide-iframe-div');

        if (parentDiv) parentDiv.remove(); else element.remove();

        if (postArticle) {
            const messageContent = postArticle.querySelector('.message-content.js-messageContent');
            if (messageContent && !messageContent.querySelector('a')) postArticle.remove();
        }
        return true;
    };

    const processRedirectLink = (link) => {
        link.dataset.bypassed = "true";
        try {
            const url = new URL(link.href, window.location.origin);
            let targetUrl = url.searchParams.get("to");
            if (targetUrl && url.searchParams.get("m") === "b64") targetUrl = atob(targetUrl.replace(/-/g, '+').replace(/_/g, '/'));
            if (targetUrl) {
                link.href = targetUrl;
                ['data-proxy-handler', 'data-blank-handler', 'data-proxy-href'].forEach(attr => link.removeAttribute(attr));
            }
        } catch (e) {}
    };

    // --- ZENTRALER MUTATION OBSERVER ---
    const processInitialDOM = () => {
        if (window.location.href.includes('/redirect/')) {
            const target = document.querySelector(".simpLinkProxy-targetLink")?.href;
            if (target) return window.location.replace(target);
        }
        document.querySelectorAll('div.bbWrapper').forEach(processWrapper);
        cleanJsLbImage(document.body);
        document.querySelectorAll('iframe, span[data-s9e-mediaembed="redgifs"]').forEach(checkAndRemoveElement);
        document.querySelectorAll('a[href*="/redirect/?to="]:not([data-bypassed])').forEach(processRedirectLink);
    };

    const masterObserver = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) { // Nur HTML Elemente verarbeiten
                    // 1. Line Breaks
                    if (node.matches?.('div.bbWrapper')) processWrapper(node);
                    else node.querySelectorAll?.('div.bbWrapper').forEach(processWrapper);

                    // 2. Class Cleanup
                    cleanJsLbImage(node);

                    // 3. Iframes / Redgifs
                    if (node.tagName === 'IFRAME' || (node.tagName === 'SPAN' && node.getAttribute('data-s9e-mediaembed') === 'redgifs')) {
                        checkAndRemoveElement(node);
                    }
                    node.querySelectorAll?.('iframe, span[data-s9e-mediaembed="redgifs"]').forEach(checkAndRemoveElement);

                    // 4. Redirects
                    if (node.matches?.('a[href*="/redirect/?to="]:not([data-bypassed])')) processRedirectLink(node);
                    node.querySelectorAll?.('a[href*="/redirect/?to="]:not([data-bypassed])').forEach(processRedirectLink);
                }
            });
        });
    });

    // --- INITIALISIERUNG ---
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            processInitialDOM();
            masterObserver.observe(document.body, { childList: true, subtree: true });
        });
    } else {
        processInitialDOM();
        masterObserver.observe(document.body, { childList: true, subtree: true });
    }

})();
