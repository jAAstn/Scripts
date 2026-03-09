// ==UserScript==
// @name         Bunkr Sort & Filter Buttons mit QOL Navigation (IndexedDB) Cache (Optimized - Gemini PRO)
// @version      1.1
// @description  Performance-optimierte Version: Nutzt IndexedDB (mit 24h TTL) für rasend schnellen Cache, zentralisiertes CSS und ausfallsichere Fallbacks.
// @author       jAstn (Optimized by Senior JS Developer)
// @include      https://bunkr.*/*
// @icon         https://i.imgur.com/wY9dGSH.png
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    // --- ZENTRALES CSS INJIZIEREN ---
    GM_addStyle(`
        /* Ladeindikator */
        #bunkr-loader {
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: rgba(0,0,0,0.9); padding: 20px 40px; border-radius: 10px;
            color: white; z-index: 99999; font-size: 16px; text-align: center;
        }

        /* Filter Input & Placeholder */
        #sizeFilterInput::-webkit-input-placeholder { color: rgb(167, 139, 250) !important; }
        #sizeFilterInput::placeholder { color: rgb(167, 139, 250) !important; }
        #jumpInput::placeholder { color: white !important; opacity: 1 !important; }
        ::-webkit-inner-spin-button, ::-webkit-outer-spin-button { display: none !important; }

        /* Galerie Sortier-Nummern */
        .gallery-sort-number {
            position: absolute; top: -134px; right: -11px; width: 35px; height: 26px;
            font-size: 0.75rem; font-weight: 600; padding: 0.25rem 0.5rem;
            background-color: #22c55e; color: white; border: 1px solid rgba(34, 197, 94, 0.5);
            cursor: pointer; z-index: 20; display: flex; align-items: center; justify-content: center;
            transition: background-color 0.2s;
        }
        .gallery-sort-number:hover { background-color: #16a34a; }
    `);

    // --- UTILITIES ---
    function throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    function waitForElement(selector, callback) {
        const el = document.querySelector(selector);
        if (el) {
            callback(el);
            return;
        }
        const observer = new MutationObserver((mutations, obs) => {
            const foundEl = document.querySelector(selector);
            if (foundEl) {
                obs.disconnect();
                callback(foundEl);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // --- INDEXEDDB WRAPPER ---
    const DB_NAME = 'BunkrCacheDB';
    const STORE_NAME = 'galleries';
    const CACHE_KEY = window.location.pathname;
    const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 Stunden in Millisekunden

    function openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async function getCache(key) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async function setCache(key, data) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.put(data, key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async function clearCache(key) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.delete(key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // --- MODULE 1: SORT, FILTER, INFINITE SCROLL & CACHE ---
    (function initMainFeatures() {
        if (/bunkr\.[a-z.]+\/f\//.test(location.href)) return;
        if (/bunkr\.[a-z.]+\/a\/.*?advanced=1/.test(location.href)) return;

        let sortDirections = { date: "desc", size: "desc", name: "asc" };
        let currentSort = "size";
        let currentFilter = "all";
        let sizeFilterMin = 0;
        let sizeFilterMax = Infinity;
        let cachedAllItemsData = [];

        let activeSortedItems = [];
        let currentlyRenderedCount = 0;
        let isRendering = false;

        function getArrowSVG(direction) {
            let rotation = direction === "asc" ? "180deg" : "0deg";
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 330 330" fill="#fff" height="10px" width="10px" style="transform: rotate(${rotation}); margin-left:4px;"><path d="M325.606,229.393l-150.004-150C172.79,76.58,168.974,75,164.996,75c-3.979,0-7.794,1.581-10.607,4.394l-149.996,150c-5.858,5.858-5.858,15.355,0,21.213c5.857,5.857,15.355,5.858,21.213,0l139.39-139.393l139.397,139.393C307.322,253.536,311.161,255,315,255c3.839,0,7.678-1.464,10.607-4.394C331.464,244.748,331.464,235.251,325.606,229.393z"/></svg>`;
        }

        function parseSize(sizeText) {
            if (!sizeText) return 0;
            if (sizeText.includes('GB')) return parseFloat(sizeText.replace(/ GB|,/g, '')) * 1024;
            if (sizeText.includes('MB')) return parseFloat(sizeText.replace(/ MB|,/g, ''));
            if (sizeText.includes('KB')) return parseFloat(sizeText.replace(/ KB|,/g, '')) / 1024;
            return 0;
        }

        function parseDate(dateText) {
            const match = dateText.match(/(\d{2}:\d{2}:\d{2}) (\d{2})\/(\d{2})\/(\d{4})/);
            if (!match) return new Date(0);
            let [, time, day, month, year] = match;
            return new Date(`${year}-${month}-${day}T${time}`);
        }

        function parseSizeFilter(inputValue) {
            const trimmed = inputValue.trim();
            if (!trimmed) return { min: 0, max: Infinity };

            if (trimmed.includes('-') && !trimmed.startsWith('-')) {
                const parts = trimmed.split('-').map(p => parseFloat(p.trim()));
                if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                    return { min: Math.min(parts[0], parts[1]), max: Math.max(parts[0], parts[1]) };
                }
            }
            if (trimmed.startsWith('-')) {
                const val = parseFloat(trimmed.substring(1));
                if (!isNaN(val)) return { min: val, max: Infinity };
            }
            const val = parseFloat(trimmed);
            if (!isNaN(val)) return { min: 0, max: val };

            return { min: 0, max: Infinity };
        }

        function fetchPage(url, retries = 2) {
            return new Promise((resolve, reject) => {
                const attempt = (attemptsLeft) => {
                    GM_xmlhttpRequest({
                        method: "GET",
                        url: url,
                        timeout: 15000,
                        onload: function (response) {
                            if (response.status === 200) {
                                let parser = new DOMParser();
                                resolve(parser.parseFromString(response.responseText, "text/html"));
                            } else if (attemptsLeft > 0) {
                                setTimeout(() => attempt(attemptsLeft - 1), 1000);
                            } else {
                                reject(`HTTP ${response.status}: ${url}`);
                            }
                        },
                        onerror: () => attemptsLeft > 0 ? setTimeout(() => attempt(attemptsLeft - 1), 1000) : reject(`Network error: ${url}`),
                        ontimeout: () => attemptsLeft > 0 ? setTimeout(() => attempt(attemptsLeft - 1), 1000) : reject(`Timeout: ${url}`)
                    });
                };
                attempt(retries);
            });
        }

        function extractItemsFromDoc(doc) {
            return Array.from(doc.querySelectorAll(".theItem")).map(item => {
                const sizeEl = item.querySelector(".theSize");
                const dateEl = item.querySelector(".theDate");
                const nameEl = item.querySelector(".theName");

                return {
                    html: item.outerHTML,
                    size: sizeEl ? parseSize(sizeEl.textContent) : 0,
                    date: dateEl ? parseDate(dateEl.textContent) : new Date(0),
                    name: nameEl ? nameEl.textContent.toLowerCase() : '',
                    isImage: !!item.querySelector(".type-Image"),
                    isVideo: !!item.querySelector(".type-Video")
                };
            });
        }

        async function loadAllPages() {
            try {
                const cachedWrapper = await getCache(CACHE_KEY);
                // Cache validieren (Existiert und ist jünger als 24h)
                if (cachedWrapper && cachedWrapper.timestamp && cachedWrapper.data && Array.isArray(cachedWrapper.data)) {
                    const cacheAge = Date.now() - cachedWrapper.timestamp;
                    if (cacheAge < CACHE_TTL) {
                        const minutesOld = Math.round(cacheAge / 1000 / 60);
                        console.log(`[Bunkr Script] Geladen aus IndexedDB (Alter: ${minutesOld} Minuten): ${cachedWrapper.data.length} Items.`);
                        return cachedWrapper.data;
                    } else {
                        console.log(`[Bunkr Script] Cache ist abgelaufen (älter als 24h). Lade Album neu...`);
                        await clearCache(CACHE_KEY);
                    }
                }
            } catch (e) {
                console.error("[Bunkr Script] IndexedDB Read Error:", e);
                await clearCache(CACHE_KEY);
            }

            const currentUrl = window.location.href.split("?")[0];
            const pagination = document.querySelector(".pagination");
            let totalPages = 1;

            if (pagination) {
                const pageLinks = Array.from(pagination.querySelectorAll("a"))
                .map(a => a.href.match(/page=(\d+)/))
                .filter(Boolean)
                .map(m => parseInt(m[1]));
                if (pageLinks.length > 0) totalPages = Math.max(...pageLinks);
            }

            showLoadingIndicator(totalPages);

            const MAX_PARALLEL = 8;
            let allItemsData = [];
            let completed = 0;

            for (let i = 1; i <= totalPages; i += MAX_PARALLEL) {
                const batch = [];
                for (let j = i; j < Math.min(i + MAX_PARALLEL, totalPages + 1); j++) {
                    batch.push(
                        fetchPage(`${currentUrl}?page=${j}`)
                        .then(doc => {
                            completed++;
                            updateLoadingIndicator(completed, totalPages);
                            return extractItemsFromDoc(doc);
                        })
                        .catch(err => {
                            console.warn(err);
                            completed++;
                            updateLoadingIndicator(completed, totalPages);
                            return [];
                        })
                    );
                }
                const results = await Promise.all(batch);
                results.forEach(items => allItemsData.push(...items));
            }

            hideLoadingIndicator();

            try {
                // Wrapper Objekt speichern: Daten + Zeitstempel
                await setCache(CACHE_KEY, { timestamp: Date.now(), data: allItemsData });
                console.log("[Bunkr Script] Neue Daten erfolgreich in IndexedDB gespeichert.");
            } catch (e) {
                console.error("[Bunkr Script] IndexedDB Save Failed:", e);
                alert("Bunkr Script Info: Fehler beim Speichern in die Datenbank.");
            }

            return allItemsData;
        }

        function showLoadingIndicator(total) {
            document.getElementById('bunkr-loader')?.remove();
            const loader = document.createElement('div');
            loader.id = 'bunkr-loader';
            loader.innerHTML = `<div style="margin-bottom: 10px;">Lade Seiten...</div><div id="loader-progress">0 / ${total}</div>`;
            document.body.appendChild(loader);
        }

        function updateLoadingIndicator(current, total) {
            const progress = document.getElementById('loader-progress');
            if (progress) progress.textContent = `${current} / ${total}`;
        }

        function hideLoadingIndicator() {
            document.getElementById('bunkr-loader')?.remove();
        }

        async function prepareItems() {
            if (cachedAllItemsData.length === 0) {
                cachedAllItemsData = await loadAllPages();
            }

            let filteredItems = cachedAllItemsData.filter(item => {
                const matchesType = (currentFilter === "all") ||
                      (currentFilter === "images" && item.isImage) ||
                      (currentFilter === "videos" && item.isVideo);
                const matchesSize = item.size >= sizeFilterMin && item.size <= sizeFilterMax;
                return matchesType && matchesSize;
            });

            let direction = sortDirections[currentSort];
            filteredItems.sort((a, b) => {
                if (currentSort === "size") return direction === "desc" ? b.size - a.size : a.size - b.size;
                if (currentSort === "date") return direction === "desc" ? a.date - b.date : b.date - a.date;
                if (currentSort === "name") return direction === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
                return 0;
            });

            activeSortedItems = filteredItems;
            currentlyRenderedCount = 0;

            const table = document.querySelector(".grid-images");
            if (table) {
                table.innerHTML = '';
                table.style.opacity = '1';
            }

            renderNextBatch(60);
            updateButtonIcons();
            updateFilterButtons();
        }

        function renderNextBatch(amount) {
            if (isRendering) return;
            const table = document.querySelector(".grid-images");
            if (!table || currentlyRenderedCount >= activeSortedItems.length) return;

            isRendering = true;
            const endIndex = Math.min(currentlyRenderedCount + amount, activeSortedItems.length);
            const htmlString = activeSortedItems.slice(currentlyRenderedCount, endIndex).map(i => i.html).join('');

            table.insertAdjacentHTML('beforeend', htmlString);
            currentlyRenderedCount = endIndex;
            isRendering = false;
        }

        window.addEventListener('scroll', throttle(() => {
            if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 1500) {
                renderNextBatch(40);
            }
        }, 150));

        function updateButtonIcons() {
            const buttons = { date: ".btnDate", name: ".btnName", size: ".btnSize" };
            for (const [key, selector] of Object.entries(buttons)) {
                const btn = document.querySelector(selector);
                if (btn) {
                    btn.innerHTML = btn.textContent.replace(/Date|Name|Size/, key.charAt(0).toUpperCase() + key.slice(1));
                    if (currentSort === key) btn.innerHTML += getArrowSVG(sortDirections[key]);
                }
            }
        }

        function updateFilterButtons() {
            document.querySelectorAll(".filterBtn").forEach(btn => {
                btn.classList.toggle("current", btn.dataset.filter === currentFilter);
            });
        }

        function initButtons() {
            ['Size', 'Date', 'Name'].forEach(type => {
                const btn = document.querySelector(`.btn${type}`);
                if (btn) {
                    btn.addEventListener("click", () => {
                        const key = type.toLowerCase();
                        currentSort = key;
                        sortDirections[key] = sortDirections[key] === "desc" ? "asc" : "desc";
                        prepareItems();
                    });
                }
            });
        }

        function initFilterMenu() {
            const grid = document.querySelector(".grid-images");
            if (!grid) return;

            const wrapper = document.createElement("div");
            wrapper.className = "flex bg-soft p-1 rounded-lg items-center";
            wrapper.style = "margin: -20px 0 10px 0; gap: 10px; flex-wrap: wrap;";

            const btnContainer = document.createElement("div");
            btnContainer.className = "flex items-center";
            btnContainer.style = "gap: 6px;";

            [ { label: "Alle", filter: "all" }, { label: "Bilder", filter: "images" }, { label: "Videos", filter: "videos" } ].forEach(({ label, filter }) => {
                const btn = document.createElement("button");
                btn.textContent = label;
                btn.dataset.filter = filter;
                btn.className = `btn btn-sm rounded-md font-semibold [&.current]:bg-body [&.current]:text-subs filterBtn ${filter === currentFilter ? 'current' : ''}`;
                btn.addEventListener("click", () => {
                    currentFilter = filter;
                    prepareItems();
                });
                btnContainer.appendChild(btn);
            });

            const sizeInput = document.createElement("input");
            sizeInput.type = "text";
            sizeInput.id = "sizeFilterInput";
            sizeInput.placeholder = "MB ( min - max )";
            sizeInput.title = "Beispiele:\n300-500 = 300MB bis 500MB\n300 = bis 300MB\n-300 = ab 300MB";
            sizeInput.style = "background: #222; color: white; border: 1px solid #444; border-radius: 4px; padding: 0 2px 0 3px; width: 120px; min-height: 20px; height: 32px; font-size: 14px;";

            sizeInput.addEventListener("input", (e) => {
                const result = parseSizeFilter(e.target.value);
                sizeFilterMin = result.min;
                sizeFilterMax = result.max;
                prepareItems();
            });

            const refreshBtn = document.createElement("button");
            refreshBtn.innerHTML = "↻ Scan Neu";
            refreshBtn.style = "background: #ef4444; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-weight: bold; margin-left: auto;";
            refreshBtn.title = "Löscht den Cache und scannt das Album neu";

            refreshBtn.addEventListener("click", async () => {
                if(confirm("Cache für dieses Album löschen und neu scannen?")) {
                    await clearCache(CACHE_KEY);
                    location.reload();
                }
            });

            wrapper.appendChild(btnContainer);
            wrapper.appendChild(sizeInput);
            wrapper.appendChild(refreshBtn);
            grid.parentElement.insertBefore(wrapper, grid);
        }

        window.addEventListener("load", () => {
            initButtons();
            initFilterMenu();
            prepareItems();
        });
    })();

    // --- MODULE 2: NAVIGATION (WASD / Arrows / Wheel / Click / ContextMenu) ---
    (function initNavigation() {
        document.addEventListener('keydown', function (e) {
            if (document.activeElement && ['input', 'textarea'].includes(document.activeElement.tagName.toLowerCase())) return;
            const key = e.key.toLowerCase();
            if (e.key === 'ArrowLeft' || key === 'a') {
                const prevBtn = document.querySelector('button[aria-label="Previous slide"]');
                if (prevBtn) { e.preventDefault(); prevBtn.click(); }
            }
            if (e.key === 'ArrowRight' || key === 'd') {
                const nextBtn = document.querySelector('button[aria-label="Next slide"]');
                if (nextBtn) { e.preventDefault(); nextBtn.click(); }
            }
        }, true);

        document.addEventListener('click', function (e) {
            if (e.target.closest('button, a, input, textarea')) return;
            const nextBtn = document.querySelector('button[aria-label="Next slide"]');
            if (nextBtn) nextBtn.click();
        }, true);

        document.addEventListener('contextmenu', function (e) {
            if (e.target.closest('button, a, input, textarea')) return;
            const lgOuter = document.querySelector('.lg-outer');
            if (lgOuter && lgOuter.classList.contains('lg-visible') && typeof window.lgInstance?.closeGallery === 'function') {
                e.preventDefault();
                window.lgInstance.closeGallery();
            }
        }, true);

        document.addEventListener('wheel', throttle(function (e) {
            const delta = e.deltaY;
            if (delta < 0) {
                document.querySelector('button[aria-label="Next slide"]')?.click();
            } else if (delta > 0) {
                document.querySelector('button[aria-label="Previous slide"]')?.click();
            }
        }, 300), { passive: true });
    })();

    // --- MODULE 3: GALLERY SORTER & CUSTOM UI ---
    (function initGallerySorter() {
        if (!/bunkr\.[a-z.]+\/a\//.test(location.href) || /bunkr\.[a-z.]+\/f\//.test(location.href)) return;

        function parseFileSize(sizeStr) {
            if (!sizeStr) return 0;
            const units = { B: 1, KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 };
            const match = sizeStr.trim().match(/^([\d.]+)\s*([A-Z]+)$/i);
            if (!match) return 0;
            return parseFloat(match[1]) * (units[match[2].toUpperCase()] || 1);
        }

        function formatBytes(bytes) {
            if (!bytes || bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }

        function jumpToImage(inputEl) {
            const index = parseInt(inputEl.value);
            if (window.lgInstance && typeof window.lgInstance.slide === 'function' && !isNaN(index)) {
                window.lgInstance.slide(index - 1);
            }
        }

        document.addEventListener('click', e => { if (e.target?.id === 'jumpBtn') jumpToImage(document.getElementById('jumpInput')); });
        document.addEventListener('keydown', e => { if (e.target?.id === 'jumpInput' && e.key === 'Enter') jumpToImage(e.target); });

        function initGalleryFeature(galleryBtn) {
            const newBtn = galleryBtn.cloneNode(true);
            galleryBtn.parentNode.replaceChild(newBtn, galleryBtn);

            newBtn.addEventListener("click", async function(e) {
                e.preventDefault();
                e.stopPropagation();

                const sizeMap = new Map();
                const elementMap = new Map();

                document.querySelectorAll('.theItem').forEach(item => {
                    const nameEl = item.querySelector('.grid-images_box-txt p');
                    const sizeEl = item.querySelector('.theSize');
                    if (nameEl && sizeEl) {
                        const fileName = nameEl.textContent.trim();
                        sizeMap.set(fileName, parseFileSize(sizeEl.textContent.trim()));
                        elementMap.set(fileName, item);
                    }
                });

                const slug = window.location.pathname.split("/")[2];
                try {
                    const response = await fetch("/api/album/gallery", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ slug: slug })
                    });

                    const json = await response.json();
                    if (!json.data) return;

                    let galleryData = json.data.map(img => ({ ...img, sizeBytes: sizeMap.get(img.original) || 0 }));
                    galleryData.sort((a, b) => b.sizeBytes - a.sizeBytes);

                    const totalItems = galleryData.length;
                    const items = galleryData.map((img, idx) => ({
                        src: img.image_url,
                        subHtml: `
                            <div style="text-align:center; font-family: sans-serif;">
                                <h4 style="color:white; margin-bottom: 5px;">${img.name}</h4>
                                <p style="color:#a78bfa; font-weight:bold; margin: 5px 0; font-size: 14px;">Größe: ${formatBytes(img.sizeBytes)}</p>
                                <p style="color:#a78bfa; font-weight:400; margin: 5px 0; font-size: 19px;">Bild ${idx + 1} von ${totalItems}</p>
                                <div style="display: flex; justify-content: center; align-items: center; gap: 10px; margin-top: 10px;">
                                    <div style="display: flex; background: #a78bfa; height: 36px; padding: 0px; border-radius: 5px;">
                                        <input type="number" id="jumpInput" placeholder="Nr." min="1" max="${totalItems}" style="width: 70px; background: transparent; color: white; border: none; text-align: center; outline: none; min-height: 36px; height: 36px" />
                                        <button id="jumpBtn" style="background: #555; color: white; border: none; padding: 3px 6px; cursor: pointer; font-size: 16px; border-radius: 0px 5px 5px 0px;">Go</button>
                                    </div>
                                </div>
                            </div>`,
                        downloadUrl: `https://get.bunkrr.su/file/${img.id}`
                    }));

                    galleryData.forEach((img, index) => {
                        const originalEl = elementMap.get(img.original);
                        if (originalEl) {
                            const infoBox = originalEl.querySelector('.mt-2') || originalEl;
                            if (window.getComputedStyle(infoBox).position === 'static') infoBox.style.position = 'relative';

                            infoBox.querySelector('.gallery-sort-number')?.remove();

                            const numBadge = document.createElement('div');
                            numBadge.className = 'gallery-sort-number';
                            numBadge.textContent = index + 1;
                            numBadge.title = `Öffne Bild ${index + 1}`;

                            numBadge.addEventListener('click', (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (window.lgInstance && typeof window.lgInstance.openGallery === 'function') {
                                    window.lgInstance.openGallery(index);
                                } else if (typeof lightGallery === 'function') {
                                    window.lgInstance = lightGallery(document.getElementById("lightgallery"), {
                                        dynamic: true, dynamicEl: items, closable: true, download: true, index: index
                                    });
                                }
                            });
                            infoBox.appendChild(numBadge);
                        }
                    });

                    // Sicherer Destory-Aufruf falls bereits eine alte Instanz existiert
                    if (window.lgInstance && typeof window.lgInstance.destroy === 'function') {
                        window.lgInstance.destroy(true);
                    }

                    let container = document.getElementById("lightgallery") || document.createElement("div");
                    container.id = "lightgallery";
                    if(!document.getElementById("lightgallery")) document.body.appendChild(container);
                    container.style.display = "block";

                    if (typeof lightGallery === 'function') {
                        window.lgInstance = lightGallery(container, {
                            dynamic: true, dynamicEl: items, closable: true, download: true,
                            onCloseAfter: () => { container.style.display = "none"; }
                        });
                        window.lgInstance.openGallery(0);
                    }

                } catch (err) {
                    console.error("Fehler bei der Galerie-Sortierung:", err);
                }
            });
        }

        waitForElement("#lunchGallery", initGalleryFeature);
    })();

    // --- MODULE 4: HIDE MODERN SCROLL CONTAINER ---
    (function initScrollbarHider() {
        function hideScrollbar() {
            const host = document.querySelector("#modern_scroll");
            if (host?.shadowRoot) {
                const el = host.shadowRoot.querySelector("#ms_h_container");
                if (el) el.style.display = "none";
            }
        }
        hideScrollbar();
        const obs = new MutationObserver(hideScrollbar);
        obs.observe(document, { childList: true, subtree: true });
    })();

})();