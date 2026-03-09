// ==UserScript==
// @name         SimpCity Header Auto-Collapse
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Kollabiert den Header standardmäßig und blendet ihn bei Mouseover am oberen Rand wieder ein.
// @author       Senior JS Developer
// @match        *://simpcity.cr/*
// @match        *://www.simpcity.cr/*
// @grant        GM_addStyle
// @run-at       document-start
// @icon         https://i.imgur.com/9It0Ga9.png
// ==/UserScript==

(function() {
    'use strict';
    // 1. CSS injizieren: Weiche Übergänge über max-height, um den Sprung-Effekt von 'height: auto' zu vermeiden
    GM_addStyle(`
        #header {
            overflow: hidden;
            max-height: 0px !important;
            opacity: 0;
            padding-top: 0 !important;
            padding-bottom: 0 !important;
            //transition: max-height 0.2s ease-in-out, opacity 0.2s ease-in-out, padding 0.2s ease-in-out !important;//
        }
        #header.sc-expanded {
            max-height: 150px !important; /* Bietet genug Platz für das 72px hohe Logo + Padding */
            opacity: 1;
            padding-top: 0px !important; /* Werte ggf. an das Original-Theme anpassen */
            padding-bottom: 0px !important;
        }
    `);

    function initHeaderCollapse() {
        const header = document.querySelector('#header');
        if (!header) return;

        let expandTimeout;
        let collapseTimeout;
        let isExpanded = false;
        let isFixed = false; // Optionale Sperre aus deinem Beispiel

        const expandHeader = () => {
            if (isFixed) return;
            clearTimeout(collapseTimeout);
            if (!isExpanded) {
                expandTimeout = setTimeout(() => {
                    header.classList.add('sc-expanded');
                    isExpanded = true;
                }, 150); // Leichte Verzögerung gegen nerviges Flackern bei schnellen Mausbewegungen
            }
        };

        const collapseHeader = () => {
            if (isFixed) return;
            clearTimeout(expandTimeout);
            if (isExpanded) {
                collapseTimeout = setTimeout(() => {
                    header.classList.remove('sc-expanded');
                    isExpanded = false;
                }, 250); // Header bleibt kurz offen, wenn die Maus den Bereich knapp verlässt
            }
        };

        // Event-Listener für das Maus-Tracking (ersetzt den unsichtbaren Trigger-Div)
        document.addEventListener('mousemove', (e) => {
            // Definiere die Trigger-Zonen in Pixeln vom oberen Bildschirmrand
            // Wenn ausgeklappt, ist die sichere Zone größer (150px), damit er beim Navigieren offen bleibt.
            // Wenn eingeklappt, definieren wir die oberen 50px als deinen "roten Bereich".
            const activeZone = isExpanded ? 150 : 50;

            if (e.clientY <= activeZone) {
                expandHeader();
            } else {
                collapseHeader();
            }
        });

        // Optional: Toggle-Funktion aus deinem Beispiel für Alt+H
        document.addEventListener('keydown', e => {
            if (e.altKey && e.key.toLowerCase() === 'h') {
                isFixed = !isFixed;
                if (isFixed) {
                    header.classList.add('sc-expanded');
                    isExpanded = true;
                } else {
                    collapseHeader();
                }
            }
        });
    }

    // Sicherstellen, dass das Skript erst greift, wenn der DOM bereit ist (hilft bei SPAs und dynamischem Laden)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHeaderCollapse);
    } else {
        initHeaderCollapse();
    }

})();