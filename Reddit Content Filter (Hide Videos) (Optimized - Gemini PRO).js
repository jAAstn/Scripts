// ==UserScript==
// @name         Reddit Content Filter (Hide Videos/GIFs) - (Optimized - Gemini PRO)
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Entfernt Reddit-Posts mit bestimmten Endungen/Domains (Fokus auf Old Reddit)
// @author       Gemini
// @match        https://www.reddit.com/*
// @match        https://old.reddit.com/*
// @grant        none
// @icon         https://www.iconpacks.net/icons/2/free-reddit-logo-icon-2436-thumb.png
// ==/UserScript==

(function() {
    'use strict';

    const forbiddenPatterns = [
        '.mp4',
        '.gif',
        '.gifv',
        '.webm',
        'redgifs.com'
    ];

    // Funktion zum Prüfen und Entfernen eines EINZELNEN Posts
    const checkAndRemovePost = (post) => {
        const dataUrl = post.getAttribute('data-url');
        if (!dataUrl) return;

        const lowerUrl = dataUrl.toLowerCase();

        // Prüfen, ob die URL eines der verbotenen Patterns enthält
        if (forbiddenPatterns.some(pattern => lowerUrl.includes(pattern))) {
            console.log('Entferne Post wegen URL:', dataUrl);
            post.remove();
        }
    };

    const init = () => {
        const siteTable = document.getElementById('siteTable');

        // Abbruchbedingung für neues Reddit-Design
        if (!siteTable) {
            console.warn('Reddit Content Filter: #siteTable nicht gefunden. Dieses Skript ist für das Old-Reddit-DOM geschrieben.');
            return;
        }

        // 1. Initiale Überprüfung aller bereits geladenen Posts
        document.querySelectorAll('#siteTable .thing').forEach(checkAndRemovePost);

        // 2. Performanter Observer: Prüft NUR die neu hinzugefügten DOM-Knoten
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    // Sicherstellen, dass der Knoten ein Element ist
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Entweder ist der neue Knoten selbst der Post...
                        if (node.classList.contains('thing')) {
                            checkAndRemovePost(node);
                        } else {
                            // ...oder die Posts sind Kinder des neu eingefügten Knotens
                            const newPosts = node.querySelectorAll('.thing');
                            newPosts.forEach(checkAndRemovePost);
                        }
                    }
                });
            });
        });

        // Wir beobachten den Container auf neue Kinder
        observer.observe(siteTable, { childList: true, subtree: true });
    };

    // Skript starten
    init();
})();