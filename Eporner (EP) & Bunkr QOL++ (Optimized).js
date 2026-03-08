// ==UserScript==
// @name         Eporner (EP) & Bunkr QOL++ (Optimized)
// @namespace    http://tampermonkey.net/
// @version      08-03-2026
// @description  Enhances Eporner and Bunkr with features like auto-unmute, UI fixes, auto-show related, favicon changing, fullscreen exit scrolling, filtering of low-res/VR content, and improved watch later buttons.
// @author       me (optimized by AI)
// @match        https://*.eporner.com/*
// @grant        unsafeWindow
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @icon         https://cdn-icons-png.flaticon.com/512/3998/3998861.png
// ==/UserScript==

// CHANGELOG : Eingefügt : 08-03-2026
// NEW :  Dynamic Video Previews on Hover (Create & Remove)
// NEW :  Eporner Upload Date and Time (DE) (Aus Anderen script kopiert)

(function() {
    'use strict';

    // =================================================================================
    // CONFIG: Globale Lautstärke-Einstellungen
    // =================================================================================
    const DEFAULT_VOLUME_PCT = 0.3; // Standard: 30%
    const storage_key = window.location.hostname;

    // Variable, die die AKTUELL geladene Lautstärke speichert
    var current_volume_pct = GM_getValue(storage_key, DEFAULT_VOLUME_PCT);
    console.log(`[VolControl] Initiale Lautstärke für ${storage_key}: ${current_volume_pct * 100}%`);

    // =================================================================================
    // SECTION A: Generische HTML5 Video Überwachung (für alle Seiten)
    // =================================================================================
    // Funktion: Deklariert 'vids' nur einmal und setzt Lautstärke auf Standard-Tags
    function setvol_checkNode(el) {
        var vids;
        if (el.nodeName == "VIDEO" || el.nodeName == "AUDIO") {
            vids = [el];
        } else {
            vids = el.querySelectorAll('video, audio');
        }

        if (vids && vids.length > 0) {
            for (var j = 0; j < vids.length; j++) {
                // Setze Lautstärke, aber vermeide Konflikte, wenn VideoJS das steuern soll
                // (Wir setzen es trotzdem als Fallback für das underlying Element)
                vids[j].volume = current_volume_pct;
            }
        }
    }

    // Observer starten, sobald Body verfügbar ist
    if (document.body) {
        setvol_checkNode(document.body);

        var setvol_MutOb = (window.MutationObserver) ? window.MutationObserver : window.WebKitMutationObserver;
        if (setvol_MutOb) {
            var setvol_chgMon = new setvol_MutOb(function(mutationSet) {
                mutationSet.forEach(function(mutation) {
                    for (var setvol_node_count = 0; setvol_node_count < mutation.addedNodes.length; setvol_node_count++) {
                        if (mutation.addedNodes[setvol_node_count].nodeType == 1) {
                            setvol_checkNode(mutation.addedNodes[setvol_node_count]);
                        }
                    }
                });
            });
            setvol_chgMon.observe(document.body, {childList: true, subtree: true});
        }
    } else {
        // Fallback, falls script bei document-start läuft und body noch nicht da ist
        window.addEventListener('DOMContentLoaded', () => {
            setvol_checkNode(document.body);
            // Observer Logik hier wiederholen oder auslagern, falls nötig.
            // Der Einfachheit halber verlässt sich dieser Teil auf das spätere Laden bei Eporner.
        });
    }

    // =================================================================================
    // SECTION B: Eporner Spezifisch - Autoplay & VideoJS Integration
    // =================================================================================
    if (location.href.includes("eporner.com/video") && !location.href.includes("eporner.com/profile/") || location.href.includes("eporner.com/hd-porn")) {

        // Hilfsfunktion: Setzt Lautstärke explizit im VideoJS Player
        const setEpornerVolume = (vol) => {
            const vjs = unsafeWindow.videojs;
            if (vjs) {
                const player = vjs('EPvideo');
                if (player) {
                    player.volume(vol);
                    console.log(`[Eporner] VideoJS Lautstärke gesetzt auf: ${vol}`);
                }
            }
        };

        const tryPlay = () => {
            const vjs = unsafeWindow.videojs;
            if (!vjs) return false;

            const player = vjs('EPvideo');
            if (!player) return false;

            // Mute initial, um Autoplay-Blockaden zu umgehen
            player.muted(true);

            player.play().then(() => {
                console.log('[Eporner] Autoplay successful.');

                // Sobald es spielt: Unmute und gespeicherte Lautstärke setzen
                player.one('playing', () => {
                    player.volume(current_volume_pct); // HIER: Nutzt die globale Variable
                    player.muted(false);
                    console.log(`[Eporner] Video spielt, Volume auf ${current_volume_pct} gesetzt.`);
                });

                // Cleanup interaction listeners
                window.removeEventListener('click', onUserInteraction);
                window.removeEventListener('keydown', onUserInteraction);
            }).catch(err => {
                console.log('[Eporner] Autoplay blocked, waiting for interaction.', err);
                window.addEventListener('click', onUserInteraction, { once: true });
                window.addEventListener('keydown', onUserInteraction, { once: true });
            });

            return true;
        };

        const onUserInteraction = () => {
            const vjs = unsafeWindow.videojs;
            if (!vjs) return;
            const player = vjs('EPvideo');
            if (!player) return;

            player.play().then(() => {
                player.volume(current_volume_pct); // HIER: Nutzt die globale Variable
                player.muted(false);
                console.log('[Eporner] Playback started after interaction.');
            }).catch(e => {
                console.log('[Eporner] Playback after interaction blocked:', e);
            });
        };

        // Versuche Autoplay alle 300ms bis erfolgreich (oder timeout)
        const interval = setInterval(() => {
            // Warten bis Body da ist
            if(document.body && tryPlay()) {
                clearInterval(interval);
            }
        }, 300);
    }

    // Auto-expand the "Related Videos" section
    const showAllRelated = () => {
        const relatedDiv = document.getElementById('relateddiv');
        if (relatedDiv) relatedDiv.classList.add('relatedshowall');

        const moreRelatedDiv = document.getElementById('morerelated');
        if (moreRelatedDiv) moreRelatedDiv.style.display = 'none';
    };

    showAllRelated();

    // =================================================================================
    // SECTION C: Menü-Steuerung & Speichern
    // ================================================================================
    function chgVol() {
        var newvol = prompt('Gib einen Wert zwischen 0.0 und 1.0 ein (z.B. 0.5 für 50%) für: ' + storage_key, current_volume_pct);

        if (newvol !== null && !isNaN(parseFloat(newvol))) {
            var newnum = parseFloat(newvol);

            if (newnum < 0) newnum = 0;
            if (newnum > 1) newnum = 1;

            if (current_volume_pct !== newnum) {
                // 1. Speichern
                GM_setValue(storage_key, newnum);
                current_volume_pct = newnum;

                // 2. Auf normale HTML5 Elemente anwenden
                if(document.body) setvol_checkNode(document.body);

                // 3. SPEZIAL: Wenn wir auf Eporner sind, auch den VideoJS Player zwingen
                if (location.href.includes("eporner.com/video")) {
                    const vjs = unsafeWindow.videojs;
                    if (vjs) {
                        const player = vjs('EPvideo');
                        if (player) {
                            player.volume(newnum);
                            console.log('[Eporner] Manuelle Lautstärkeänderung angewendet.');
                        }
                    }
                }

                console.log('Lautstärke für ' + storage_key + ' auf ' + (newnum * 100) + '% geändert.');
            }
        }
    }
    GM_registerMenuCommand('Change volume for this page and save', chgVol);

    // =================================================================================
    // SECTION: Generic - Scroll To Element on Fullscreen Exit & Initial Load
    // =================================================================================

    //Initializes scrolling behavior for a specific element on the page.
    //It scrolls to the element on initial load and after exiting fullscreen mode.
    //Compatible with video-control-wrapper from other userscripts.
    //@param {string} elementSelector - The CSS selector for the element to scroll to (e.g., 'video').
    //@param {number} scrollOffset - The offset from the top of the viewport.
    const createScrollHandler = (elementSelector, scrollOffset) => {
        let observedElement = null;
        let alreadyScrolled = false;

        const scrollToElement = (element, force = false) => {
            if (!element || (alreadyScrolled && !force)) return;

            // Finde das echte Element zum scrollen - handle wrapper
            let targetElement = element;

            // Falls das Element in einem video-control-wrapper ist, nutze den wrapper
            if (element.parentElement?.classList.contains('video-control-wrapper')) {
                targetElement = element.parentElement;
            }

            const rect = targetElement.getBoundingClientRect();
            const scrollY = window.scrollY + rect.top - scrollOffset;
            window.scrollTo({ top: scrollY, behavior: 'smooth' });
            if (!force) alreadyScrolled = true;
        };

        const init = (element) => {
            if (!element || observedElement === element) return;
            observedElement = element;

            document.addEventListener('fullscreenchange', () => {
                if (!document.fullscreenElement) {
                    // Warte kurz, damit das DOM sich stabilisiert
                    setTimeout(() => {
                        // Suche das Element erneut, falls es sich verändert hat
                        const currentElement = document.querySelector(elementSelector);
                        if (currentElement) {
                            scrollToElement(currentElement, true);
                        } else {
                            // Fallback: nutze das ursprüngliche Element
                            scrollToElement(element, true);
                        }
                    }, 50); // Etwas länger warten für Wrapper-Cleanup
                }
            });

            setTimeout(() => scrollToElement(element), 100);
        };

        // Beobachte sowohl neue Elemente als auch Änderungen an Eltern-Containern
        const observer = new MutationObserver(() => {
            const targetElement = document.querySelector(elementSelector);
            if (targetElement) {
                init(targetElement);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true, // Beobachte auch Attribut-Änderungen
            attributeFilter: ['class'] // Speziell class-Änderungen (z.B. wrapper hinzufügen)
        });

        const existingElement = document.querySelector(elementSelector);
        if (existingElement) init(existingElement);
    };

    if (location.href.includes("eporner.")) {
        createScrollHandler('video', 40);
    }
    if (location.href.includes("bunkr.")) {
        createScrollHandler('video, img.relative.z-20', 77);
    }

    // =================================================================================
    // SECTION: Eporner - Favicon Changer
    // =================================================================================
    if (location.href.includes("eporner.com")) {
        const urlIconMapping = [
            { match: "https://www.eporner.com/", icon: 'https://i.imgur.com/fuZAduI.png' }, // Homepage
            { include: "www.eporner.com/profile/", icon: 'https://i.imgur.com/fuZAduI.png' }, // Profile pages
        ];

        const updateIcon = (newIconUrl) => {
            document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]').forEach(favicon => favicon.remove());
            const link = document.createElement('link');
            link.rel = 'icon';
            link.href = newIconUrl;
            document.head.appendChild(link);
        };

        const currentUrl = window.location.href;
        for (const entry of urlIconMapping) {
            if ((entry.match && currentUrl === entry.match) || (entry.include && currentUrl.includes(entry.include))) {
                updateIcon(entry.icon);
                break;
            }
        }
    }

    // =================================================================================
    // SECTION: Eporner - Filter Low-Quality & VR Videos
    // =================================================================================
    if (location.href.includes("eporner.com")) {
        const hideUnwantedElements = (root = document) => {
            // Remove non-HD videos, comment boxes, and photo albums
            root.querySelectorAll('div.mb:not(.hdy), div.mbphoto').forEach(el => el.remove());    /*   div.commbox,    */

            // Remove VR videos
            root.querySelectorAll('div.mb.hdy').forEach(el => {
                if (el.querySelector('div.mbimg span.vrico')) el.remove();
            });

            // Remove day-containers if they become empty after filtering
            root.querySelectorAll('div.streameventsday.showAll').forEach(container => {
                const hasVisibleHDVideos = container.querySelector('div.mb.hdy');
                if (!hasVisibleHDVideos) container.remove();
            });
        };

        // Initial run
        hideUnwantedElements();

        // Observe for dynamically added content (e.g., infinite scroll)
        const observer = new MutationObserver(mutations => {
            const hasRelevantChanges = mutations.some(m =>
                                                      Array.from(m.addedNodes).some(node =>
                                                                                    node.nodeType === 1 && (node.matches('.mb, .streameventsday') || node.querySelector('.mb, .streameventsday'))
                                                                                   )
                                                     );

            if (hasRelevantChanges) {
                console.log('New content detected, applying filters.');
                // Use a small timeout to allow the DOM to settle
                setTimeout(() => hideUnwantedElements(), 100);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    // =================================================================================
    // SECTION: Eporner - Watch Later & Downloaded & Favorite & Playlists Status Buttons
    // =================================================================================
    if (location.href.includes("eporner.com/video-") || location.href.includes("eporner.com/hd-porn")) {
        const saveSpan = document.querySelector('span.uvmspn5');

        const myCustomSvg = `
<svg height="16px" width="16px" viewBox="-21 0 512 512" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle; margin-right: 5px;">
  <path d="m466.578125 3.5c-2.027344-2.21875-4.886719-3.5-7.914063-3.5h-448c-3.03125 0-5.890624 1.28125-7.917968 3.5-2.023438 2.261719-3.007813 5.226562-2.6875002 8.234375l42.6679682 426.664063c.425782 4.183593 3.242188 7.722656 7.230469 9.066406l192 64c1.109375.34375 2.21875.535156 3.371094.535156 1.28125 0 2.539063-.234375 3.753906-.683594l170.667969-64c3.796875-1.40625 6.464844-4.882812 6.847656-8.917968l42.667969-426.664063c.320313-3.007813-.664063-5.972656-2.6875-8.234375zm0 0" fill="#ffc107"/>
  <path d="m245.328125 512c-1.152344 0-2.261719-.191406-3.371094-.535156l-192-64c-3.988281-1.320313-6.804687-4.882813-7.230469-9.066406l-42.6679682-426.664063c-.3203128-3.007813.6640622-5.972656 2.6875002-8.234375 2.027344-2.21875 4.886718-3.5 7.917968-3.5h448c3.027344 0 5.886719 1.28125 7.914063 3.5 2.023437 2.238281 3.007813 5.226562 2.6875 8.234375l-42.667969 426.664063c-.40625 4.035156-3.070312 7.511718-6.847656 8.917968l-170.667969 64c-1.214843.449219-2.472656.683594-3.753906.683594zm-182.078125-82.601562 181.867188 60.628906 160.914062-60.351563 40.832031-408.34375h-424.402343zm0 0"/>
  <path d="m266.664062 394.667969c-4.460937 0-8.621093-2.839844-10.136718-7.296875-1.855469-5.589844 1.175781-11.628906 6.742187-13.503906l58.007813-19.328126 17.941406-98.539062h-72.554688c-5.890624 0-10.667968-4.777344-10.667968-10.667969v-128c0-5.886719 4.777344-10.664062 10.667968-10.664062h106.664063c3.285156 0 6.402344 1.511719 8.425781 4.09375 2.027344 2.582031 2.730469 5.953125 1.941406 9.152343l-10.664062 42.667969c-1.429688 5.714844-7.148438 9.128907-12.929688 7.765625-5.738281-1.429687-9.195312-7.234375-7.765624-12.929687l7.316406-29.417969h-82.324219v106.667969h74.667969c3.15625 0 6.164062 1.386719 8.191406 3.839843 2.027344 2.410157 2.878906 5.628907 2.304688 8.746094l-21.335938 117.332032c-.703125 3.839843-3.433594 6.976562-7.125 8.214843l-64 21.332031c-1.128906.363282-2.238281.535157-3.367188.535157zm0 0"/>
  <path d="m223.996094 394.667969c-.980469 0-1.964844-.128907-2.945313-.429688l-74.664062-21.332031c-3.84375-1.085938-6.722657-4.246094-7.53125-8.171875l-10.667969-53.332031c-1.171875-5.78125 2.582031-11.390625 8.382812-12.542969 5.484376-1.214844 11.371094 2.558594 12.546876 8.382813l9.386718 46.933593 54.824219 15.679688v-241.855469h-117.332031c-5.886719 0-10.667969-4.777344-10.667969-10.667969 0-5.886719 4.78125-10.664062 10.667969-10.664062h128c5.886718 0 10.667968 4.777343 10.667968 10.664062v266.667969c0 3.347656-1.558593 6.507812-4.246093 8.511719-1.878907 1.429687-4.140625 2.15625-6.421875 2.15625zm0 0"/>
</svg>`;

        if (saveSpan) {
            GM_addStyle(`
                /* Hide the original modal by default */
                #simplemodal-overlay, .simplemodal-container { display: none !important; }
                /* Custom styles for our new buttons */
                #gm-watchlater-btn, #gm-downloaded-btn, #gm-pf-btn, #gm-JAV-btn, #gm-fav-btn {
                    background: #ae0000 !important;
                    color: white;
                    padding-left: 12px !important;
                    cursor: pointer;
                }
                #gm-watchlater-btn.added, #gm-downloaded-btn.added, #gm-pf-btn.added, #gm-JAV-btn.added, #gm-fav-btn.added {
                    background: green !important;
                }
            `);

            // Programmatically click the save button to load the modal content into the DOM
            saveSpan.click();

            const interval = setInterval(() => {
                const watchLaterCheckbox = document.querySelector('#stl-wl');
                const downloadedCheckbox = document.querySelector('#stl-pl-1848755499');
                const pfCheckbox = document.querySelector('#stl-pl-1850259227');
                const JAVCheckbox = document.querySelector('#stl-pl-1850564436');
                const FAVCheckbox = document.querySelector('#stl-fav');

                if (watchLaterCheckbox && downloadedCheckbox) {
                    clearInterval(interval);

                    const createStatusButton = ({ checkbox, id, labelOn, labelOff, insertAfter }) => {
                        let isChecked = checkbox.checked;
                        const btn = document.createElement('span');
                        btn.id = id;
                        btn.textContent = isChecked ? labelOn : labelOff;
                        if (isChecked) btn.classList.add('added');
                        insertAfter.parentNode.insertBefore(btn, insertAfter.nextSibling);

                        btn.addEventListener('click', () => {
                            checkbox.click();
                            // Update button state after a short delay to reflect the change
                            setTimeout(() => {
                                isChecked = checkbox.checked;
                                btn.textContent = isChecked ? labelOn : labelOff;
                                btn.classList.toggle('added', isChecked);
                            }, 200);
                        });
                    };

                    createStatusButton({
                        checkbox: watchLaterCheckbox,
                        id: 'gm-watchlater-btn',
                        labelOn: '💾 In Watch-Later',
                        labelOff: '➕ Add to Watch-Later',
                        insertAfter: saveSpan
                    });

                    createStatusButton({
                        checkbox: downloadedCheckbox,
                        id: 'gm-downloaded-btn',
                        labelOn: '📥 In Downloaded',
                        labelOff: '✅ Add to Downloaded',
                        insertAfter: document.querySelector('#gm-JAV-btn') || saveSpan
                    });

                    createStatusButton({
                        checkbox: pfCheckbox,
                        id: 'gm-pf-btn',
                        labelOn: '💯 In Elite',
                        labelOff: '⚠️ Add to Elite',
                        insertAfter: document.querySelector('#gm-watchlater-btn') || saveSpan
                    });

                    createStatusButton({
                        checkbox: JAVCheckbox,
                        id: 'gm-JAV-btn',
                        labelOn: '🈯 In JAV',
                        labelOff: '🟦 Add to JAV',
                        insertAfter: document.querySelector('#gm-pf-btn') || saveSpan
                    });

                    createStatusButton({
                        checkbox: FAVCheckbox,
                        id: 'gm-fav-btn',
                        labelOn: '💛 In Favorites',
                        labelOff: '🔝 Add to Favorites',
                        insertAfter: document.querySelector('.uvmspn5') || saveSpan
                    });

                    // Add listener to show the original modal on a real click
                    saveSpan.addEventListener("click", () => {
                        document.querySelector('#simplemodal-overlay')?.style.setProperty("display", "block", "important");
                        document.querySelector('.simplemodal-container')?.style.setProperty("display", "block", "important");
                    });
                }
            }, 100);
        }
    }

    // =================================================================================
    // SECTION: Eporner - Hover Watch Later Button for Thumbnails
    // =================================================================================
    if (location.href.includes("eporner")) {
        const { jQuery: $, EPwatchLaterList, EPt, EPchangeWatchLater, EPcheckVideos } = unsafeWindow;

        if ($ && EPwatchLaterList && EPchangeWatchLater) {
            const createWatchLaterBox = (el) => {
                if (!el || !el.id || el.querySelector('.watchlater')) return;

                const videoId = el.dataset.id;
                const wlId = "watchlaterbox_" + el.id;
                let isAdded = typeof EPwatchLaterList['v' + videoId] !== 'undefined';

                const wlDiv = $(`
                    <div id="${wlId}" class="watchlater ${isAdded ? 'added' : ''}" style="display: none;">
                        <span>${isAdded ? EPt('Added') : EPt('Watch later')}</span><i></i>
                    </div>
                `);

                wlDiv.on("click", (e) => {
                    e.stopPropagation();
                    // Call Eporner's function to add/remove
                    EPchangeWatchLater(videoId, isAdded ? 0 : 1);

                    // Update UI immediately for instant feedback
                    isAdded = !isAdded;
                    EPwatchLaterList['v' + videoId] = isAdded ? true : undefined;
                    wlDiv.toggleClass("added", isAdded);
                    wlDiv.find("span").text(isAdded ? EPt('Added') : EPt('Watch later'));
                });

                $(el).find(".mbimg").append(wlDiv);

                $(el).on("mouseenter", () => wlDiv.stop(true, true).fadeIn("fast"))
                    .on("mouseleave", () => wlDiv.stop(true, true).fadeOut("fast"));
            };

            const handleVideos = (context) => {
                $(context).find(".mb").addBack(".mb").each((i, el) => createWatchLaterBox(el));
                if (typeof EPcheckVideos === "function") EPcheckVideos();
            };

            // Initial run
            handleVideos(document.body);

            // Observer for new videos
            const observer = new MutationObserver(mutations => {
                mutations.forEach(mutation => {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1) handleVideos(node);
                    });
                });
            });

            observer.observe(document.body, { childList: true, subtree: true });
        }
    }

    // =================================================================================
    // SECTION: Eporner - Dynamic Video Previews on Hover (Create & Remove)
    // =================================================================================
    if (location.href.includes("eporner.com/profile")) return;{

        // Hilfsfunktion: Baut die WebM URL basierend auf der ID auf
        const getWebmUrl = (id) => {
            const idStr = String(id);
            const p1 = idStr.substring(0, 1);
            const p2 = idStr.substring(0, 2);
            const p3 = idStr.substring(0, 3);
            return `https://static-eu-cdn.eporner.com/thumbs/static4/${p1}/${p2}/${p3}/${idStr}/${idStr}-preview.webm`;
        };

        const attachHoverLogic = () => {
            document.querySelectorAll('.mb').forEach(mbEl => {

                // Überspringen, wenn wir dieses Video schon mit Event-Listenern versorgt haben
                if (mbEl.classList.contains('js-preview-handled')) return;
                mbEl.classList.add('js-preview-handled');

                // HOVER START (Maus kommt aufs Bild)
                mbEl.addEventListener('mouseenter', function() {
                    let previddiv = this.querySelector('.previdthumb');

                    // Wenn keine existiert, bauen wir sie exakt nach deinen Vorgaben auf!
                    if (!previddiv) {
                        const videoId = this.getAttribute('data-id');
                        const aTag = this.querySelector('.mbcontent > a');
                        const mbcontent = this.querySelector('.mbcontent');

                        if (!videoId || !aTag || !mbcontent) return;

                        const videoHref = aTag.getAttribute('href');
                        const webmUrl = getWebmUrl(videoId);

                        // DIV Container erstellen
                        previddiv = document.createElement('div');
                        previddiv.id = 'previddiv';
                        previddiv.className = 'previdthumb';
                        previddiv.style.display = 'block';
                        previddiv.dataset.custom = "true";

                        // Link Container erstellen
                        const previewLink = document.createElement('a');
                        previewLink.href = videoHref;
                        previewLink.setAttribute('onclick', 'EP.beacon.bindThumbA(this);');

                        // Video Element erstellen
                        const videoEl = document.createElement('video');
                        videoEl.id = `previd-${videoId}`;
                        videoEl.loop = true;
                        videoEl.muted = true;
                        videoEl.playsInline = true;
                        videoEl.preload = 'auto';
                        videoEl.src = webmUrl;

                        // Alles zusammenbauen
                        previewLink.appendChild(videoEl);
                        previddiv.appendChild(previewLink);
                        mbcontent.appendChild(previddiv);

                        const mbimg = this.querySelector('.mbimg');
                        if (mbimg && !mbimg.hasAttribute('data-fullscreen-container')) {
                            mbimg.setAttribute('data-fullscreen-container', 'true');
                        }

                        // WICHTIG: Das Promise des play() Befehls im Element speichern
                        videoEl._playPromise = videoEl.play();
                    }
                });

                // HOVER ENDE (Maus verlässt das Bild)
                mbEl.addEventListener('mouseleave', function() {
                    // Suchen nach dem von UNS erstellten Div
                    const customPreviddiv = this.querySelector('.previdthumb[data-custom="true"]');

                    if (customPreviddiv) {
                        // 1. Sofort unsichtbar machen, damit der User nichts mehr sieht
                        customPreviddiv.style.display = 'none';
                        const videoEl = customPreviddiv.querySelector('video');

                        if (videoEl) {
                            // Aufräum-Funktion (Pausieren und restlos entfernen)
                            const cleanup = () => {
                                videoEl.pause();
                                videoEl.removeAttribute('src');
                                videoEl.load();
                                customPreviddiv.remove();
                            };

                            // 2. Race-Condition verhindern: Warten, bis play() fertig ist, DANN aufräumen
                            if (videoEl._playPromise !== undefined) {
                                videoEl._playPromise.then(() => {
                                    cleanup();
                                }).catch(e => {
                                    cleanup(); // Auch bei Fehlern (z.B. Autoplay-Block) sauber löschen
                                });
                            } else {
                                cleanup();
                            }
                        } else {
                            customPreviddiv.remove();
                        }
                    } else {
                        // FALLBACK: Originale Eporner-Videos
                        const nativeVideo = this.querySelector('.previdthumb video');
                        if (nativeVideo) {
                            // Wenn playPromise existiert (moderne Browser), fangen wir den Fehler ab
                            const playPromise = nativeVideo.play();
                            if (playPromise !== undefined) {
                                playPromise.then(() => {
                                    nativeVideo.pause();
                                    nativeVideo.currentTime = 0;
                                }).catch(() => {});
                            } else {
                                nativeVideo.pause();
                                nativeVideo.currentTime = 0;
                            }
                        }
                    }
                });
            });
        };

        // 1. Direkt beim Start ausführen
        attachHoverLogic();

        // 2. Observer für nachgeladene Videos
        const previewObserver = new MutationObserver(mutations => {
            const hasNewVideos = mutations.some(m =>
                                                Array.from(m.addedNodes).some(node =>
                                                                              node.nodeType === 1 && (node.matches('.mb') || node.querySelector('.mb'))
                                                                             )
                                               );

            if (hasNewVideos) {
                attachHoverLogic();
            }
        });

        previewObserver.observe(document.body, { childList: true, subtree: true });
    }

    // =================================================================================
    // SECTION: Bunkr - Filter MKV and Archive Files
    // =================================================================================
    if (location.href.includes("bunkr.") && (location.href.includes("/a/") || location.href.includes("/f/"))) {
        const BLOCKED_EXTENSIONS = ['.rar', '.zip', '.7z', '.f4v', '.gif']; // '.mkv'

        const removeBlockedTypes = () => {
            const selector = location.href.includes("/a/") ? 'main > div.grid.grid-images > div' : '#related-files-grid > div';
            document.querySelectorAll(selector).forEach(item => {
                const title = item.getAttribute('title') || '';
                const link = item.querySelector('a')?.href || '';
                const imgSrc = item.querySelector('img')?.src || '';
                const combinedText = (title + ' ' + link + ' ' + imgSrc).toLowerCase();

                if (BLOCKED_EXTENSIONS.some(ext => combinedText.includes(ext))) {
                    item.remove();
                }
            });
        };

        // Initial run
        removeBlockedTypes();

        // Observe for dynamically loaded content
        const observer = new MutationObserver(removeBlockedTypes);
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // =================================================================================
    // SECTION: Eporner - Remove Specific Profile ("TrunkSSJ") from Activity Stream
    // =================================================================================
    if (location.href.includes("eporner.com/profile/TrunkSSJ/")) {
        const removeTrunkSSJ = () => {
            document.querySelectorAll('#pcontent > div.fillerOuter.profilemain > div.filler > div.streamevents').forEach(streamEvent => {
                const headers = streamEvent.querySelectorAll('div.streameventsday.showAll > div.seheader');
                headers.forEach(header => {
                    if (header.textContent.includes('TrunkSSJ')) {
                        console.log('Removed TrunkSSJ entry:', header);
                        streamEvent.remove();
                    }
                });
            });
        };

        removeTrunkSSJ();

        const observer = new MutationObserver(mutations => {
            const addedSomething = mutations.some(m =>
                                                  Array.from(m.addedNodes).some(node =>
                                                                                node.nodeType === 1 && node.matches('#pcontent div.streamevents, #pcontent div.streamevents *')
                                                                               )
                                                 );
            if (addedSomething) setTimeout(removeTrunkSSJ, 100);
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    // =================================================================================
    // SECTION: Eporner - Eporner Upload Date and Time (DE)
    // =================================================================================
    if (location.href.includes("eporner.com/video-")) {
        // Safely extract and parse JSON-LD
        const jsonLdScript = document.querySelector('script[type="application/ld+json"]');
        if (!jsonLdScript) {
            console.log('JSON-LD script tag not found.');
            return;
        }

        let jsonData;
        try {
            // Get raw text and clean it
            let raw = jsonLdScript.textContent.trim();

            // Fix common issues: unescaped newlines, tabs, etc.
            raw = raw.replace(/[\n\r\t]+/g, ' '); // Replace newlines/tabs with space
            raw = raw.replace(/\\+/g, '\\\\');    // Escape backslashes
            raw = raw.replace(/'/g, "\\'");       // Escape single quotes if any

            // Try parsing
            jsonData = JSON.parse(raw);
        } catch (e) {
            console.warn('JSON.parse failed, attempting manual fix...', e);

            // Fallback: Extract uploadDate using regex (robust)
            const uploadMatch = jsonLdScript.textContent.match(/"uploadDate"\s*:\s*"([^"]+)"/);
            if (!uploadMatch) {
                console.log('uploadDate not found even with regex.');
                return;
            }
            const uploadDate = uploadMatch[1];

            // --- HIER ANGEPASST: de-DE Format ---
            const formattedDate = new Date(uploadDate).toLocaleString('de-DE', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            // Insert with icon
            insertUploadDate(formattedDate + ' Uhr'); // "Uhr" für die deutsche Optik angehängt
            return;
        }

        // Normal path: JSON parsed successfully
        const uploadDate = jsonData.uploadDate;
        if (!uploadDate) {
            console.log('uploadDate not found in JSON-LD.');
            return;
        }

        // --- HIER ANGEPASST: de-DE Format ---
        const formattedDate = new Date(uploadDate).toLocaleString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        insertUploadDate(formattedDate + ' Uhr'); // "Uhr" für die deutsche Optik angehängt

        // Helper function to insert the date (shared)
        function insertUploadDate(dateText) {
            // Find ALL .vid-quality elements, use the LAST one
            const qualityElements = document.querySelectorAll('span.vid-quality');
            if (qualityElements.length === 0) {
                console.log('No .vid-quality element found.');
                return;
            }
            const qualityElement = qualityElements[qualityElements.length - 1]; // Use last one

            // Avoid adding multiple times
            if (qualityElement.nextSibling && qualityElement.nextSibling.classList && qualityElement.nextSibling.classList.contains('upload-date-span')) {
                return;
            }

            // Create span with SVG icon
            const dateSpan = document.createElement('span');
            dateSpan.className = 'upload-date-span'; // For deduplication
            dateSpan.style.marginLeft = '10px';
            dateSpan.style.color = '#999';
            dateSpan.style.fontSize = '12px';
            dateSpan.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" style="vertical-align: middle; padding-right: 4px; display: inline-block; fill: #999;">
                <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V9h14v10zm0-12H5V5h14v2zM7 11h10v2H7zm0 4h10v2H7zm0 4h10v2H7z"/>
            </svg>
            ${dateText}
        `;

            // Insert after quality
            qualityElement.parentNode.insertBefore(dateSpan, qualityElement.nextSibling);

            // Apply flex centering to h1
            const h1 = document.querySelector('#video-info h1');
            if (h1) {
                h1.style.display = 'flex';
                h1.style.alignItems = 'center';
                h1.style.justifyContent = 'flex-start';
            }

            // Style all spans
            h1.querySelectorAll('span').forEach(span => {
                span.style.display = 'inline-flex';
                span.style.alignItems = 'center';
                span.style.verticalAlign = 'middle';
                span.style.fontSize = '12px';
            });
        }
    }
})();
