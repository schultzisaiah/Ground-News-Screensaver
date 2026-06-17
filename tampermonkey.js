// ==UserScript==
// @name         Ground News Screensaver
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Bulletproof Feed-First Extraction with Auto-Scrolling Insights, AI Summaries, normalized bias distribution, Interactive Controls, Multi-Column Previews, and Chronological Sorting.
// @author       You
// @match        https://ground.news/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    const style = document.createElement('style');
    style.innerHTML = `
        .gn-grid-layer {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 16px;
            padding-bottom: 16px;
        }
        .gn-source-card {
            background-color: rgba(15, 15, 20, 0.6);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 12px;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            transition: transform 0.2s, background-color 0.2s;
        }
        .gn-source-card:hover {
            background-color: rgba(255,255,255,0.05);
        }
        .gn-source-meta-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 10px;
        }
        .gn-source-pub {
            font-size: 0.75rem;
            color: #a1a1aa;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .gn-source-time {
            font-size: 0.65rem;
            color: #71717a;
            font-weight: 700;
            text-transform: uppercase;
            white-space: nowrap;
        }
        .gn-source-hdl {
            font-size: 0.95rem;
            color: #f4f4f5;
            font-weight: 700;
            line-height: 1.3;
        }
        .gn-source-preview {
            font-size: 0.85rem;
            color: #a1a1aa;
            line-height: 1.5;
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            overflow: hidden;
            margin-top: 4px;
        }
        .gn-proportional-bar {
            display: flex;
            flex-direction: row;
            width: 100%;
            height: 12px;
            min-height: 12px;
            border-radius: 6px;
            overflow: hidden;
            background-color: #27272a;
        }
        .gn-segment {
            height: 100%;
            min-height: 12px;
        }
        .gn-summary-list {
            list-style: none;
            padding: 0;
            margin: 0;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .gn-summary-list li {
            font-size: 1.05rem;
            color: #d4d4d8;
            line-height: 1.5;
            position: relative;
            padding-left: 20px;
        }
        .gn-summary-list li::before {
            content: "•";
            position: absolute;
            left: 0;
            color: #3b82f6;
            font-size: 1.5rem;
            line-height: 1;
            top: -2px;
        }
        .gn-clickable {
            cursor: pointer;
            transition: transform 0.2s ease, opacity 0.2s ease;
        }
        .gn-clickable:hover {
            opacity: 0.85;
            transform: scale(1.01);
        }
        .gn-hide-scrollbar {
            scrollbar-width: none;
            -ms-overflow-style: none;
        }
        .gn-hide-scrollbar::-webkit-scrollbar {
            display: none;
        }
    `;
    document.head.appendChild(style);

    const CONFIG = {
        slideDurationMs: 38000,
        refreshIntervalMs: 450000,
        hydrationDelayMs: 1500,
        storageKeyActive: 'gn_screensaver_active',
        storageKeyHistory: 'gn_screensaver_history',
        feeds: [
            { id: 'Home', url: '/' },
            { id: 'For You', url: '/my' },
            { id: 'Local', url: '/local' },
            { id: 'Blindspot', url: '/blindspot' }
        ]
    };

    const isScreensaverActive = () => sessionStorage.getItem(CONFIG.storageKeyActive) === 'true';
    const toggleScreensaver = (active) => sessionStorage.setItem(CONFIG.storageKeyActive, active ? 'true' : 'false');

    class SmoothScroller {
        constructor(container, speed = 0.015, pauseDelay = 3000) {
            this.container = container;
            this.speed = speed;
            this.pauseDelay = pauseDelay;
            this.isPaused = false;
            this.resumeTimeout = null;
            this.frameId = null;
            this.lastTime = null;
            this.exactScrollTop = 0;

            this.bindEvents();
        }

        bindEvents() {
            const handlePause = () => this.pause();
            const handleResume = () => this.scheduleResume();

            this.container.addEventListener('wheel', handlePause, { passive: true });
            this.container.addEventListener('touchstart', handlePause, { passive: true });
            this.container.addEventListener('mousemove', handlePause, { passive: true });

            this.container.addEventListener('mouseleave', handleResume, { passive: true });
            this.container.addEventListener('touchend', handleResume, { passive: true });
            this.container.addEventListener('wheel', handleResume, { passive: true });
        }

        start() {
            this.stop();
            this.isPaused = false;
            this.exactScrollTop = this.container.scrollTop;
            this.lastTime = performance.now();
            this.tick(this.lastTime);
        }

        stop() {
            if (this.frameId) cancelAnimationFrame(this.frameId);
            clearTimeout(this.resumeTimeout);
        }

        pause() {
            this.isPaused = true;
            clearTimeout(this.resumeTimeout);
        }

        scheduleResume() {
            clearTimeout(this.resumeTimeout);
            this.resumeTimeout = setTimeout(() => {
                this.isPaused = false;
                this.exactScrollTop = this.container.scrollTop;
                this.lastTime = performance.now();
            }, this.pauseDelay);
        }

        tick(currentTime) {
            if (!this.isPaused) {
                const deltaTime = currentTime - this.lastTime;

                this.exactScrollTop += this.speed * deltaTime;
                this.container.scrollTop = this.exactScrollTop;

                const midpoint = this.container.scrollHeight / 2;
                if (this.exactScrollTop >= midpoint) {
                    this.exactScrollTop -= midpoint;
                    this.container.scrollTop = this.exactScrollTop;
                }
            }
            this.lastTime = currentTime;
            this.frameId = requestAnimationFrame((t) => this.tick(t));
        }
    }

    class ArticleScraper {

        static parseTimeWeight(timeStr) {
            if (!timeStr) return 99999999;
            const str = timeStr.toLowerCase();
            const match = str.match(/(\d+)\s*(minute|min|hour|hr|day|week|month)s?\s*ago/);
            if (match) {
                const val = parseInt(match[1], 10);
                const unit = match[2];
                if (unit === 'minute' || unit === 'min') return val;
                if (unit === 'hour' || unit === 'hr') return val * 60;
                if (unit === 'day') return val * 60 * 24;
                if (unit === 'week') return val * 60 * 24 * 7;
                if (unit === 'month') return val * 60 * 24 * 30;
            }

            const dt = Date.parse(timeStr);
            if (!isNaN(dt)) {
                return Math.max(0, (Date.now() - dt) / 60000);
            }
            return 99999999;
        }

        static async fetchAllFeeds(uiStatusCallback) {
            let allArticles = [];
            for (const feed of CONFIG.feeds) {
                uiStatusCallback(`Syncing ${feed.id} feed...`);
                try {
                    const response = await fetch(feed.url);
                    if (!response.ok) continue;
                    const html = await response.text();
                    const doc = new DOMParser().parseFromString(html, 'text/html');
                    const articles = this.extractFeedItems(doc, feed.id);
                    allArticles = allArticles.concat(articles);
                } catch (error) {
                    console.warn(`Skipped ${feed.id} due to fetch error.`);
                }
            }
            const uniqueArticles = Array.from(new Map(allArticles.map(item => [item.id, item])).values());
            uniqueArticles.sort((a, b) => this.parseTimeWeight(a.timestamp) - this.parseTimeWeight(b.timestamp));

            return this.applyHistoryState(uniqueArticles);
        }

        static extractFeedItems(documentObj, sourceFeed) {
            const items = [];
            try {
                const anchors = Array.from(documentObj.querySelectorAll('a[href*="/article/"]'));

                anchors.forEach(anchor => {
                    const container = anchor.closest('div[class*="mt-"]') || anchor.parentElement?.parentElement;
                    if (!container || items.some(i => i.url === anchor.href)) return;

                    const headings = Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, h6'));
                    const validHeadings = headings.map(h => (h.textContent || '').trim()).filter(t => t.length > 25);
                    let title = validHeadings.length > 0 ? validHeadings[0] : '';
                    if (!title || title.length < 15) return;

                    const img = container.querySelector('img');
                    const textContent = (container.textContent || '').replace(/\s+/g, ' ');

                    let timestamp = '';
                    const timeMatch = textContent.match(/(\d+\s*(?:minute|min|hour|hr|day|week|month)s?\s*ago)/i);
                    if (timeMatch) timestamp = timeMatch[1];

                    let biasLabel = 'Coverage Analysis';
                    const biasTextMatch = textContent.match(/(\d+)%\s*(Left|Center|Right)\s*coverage/i);
                    if (biasTextMatch) biasLabel = `${biasTextMatch[1]}% ${biasTextMatch[2]}`;

                    const biasSegments = [];
                    const flexDivs = Array.from(container.querySelectorAll('div')).filter(d => (d.className || '').includes('flex'));
                    for (const d of flexDivs) {
                        const children = Array.from(d.children);
                        const isBiasBar = children.some(c => c.style && c.style.width && c.style.width.includes('%'));
                        if (isBiasBar && children.length <= 3) {
                            children.forEach(segment => {
                                if (segment.style && segment.style.width && parseFloat(segment.style.width) > 0) {
                                    let color = '#71717a';
                                    const cls = (segment.className || '').toLowerCase();
                                    if (cls.includes('blue') || cls.includes('left')) color = '#3b82f6';
                                    else if (cls.includes('red') || cls.includes('right')) color = '#ef4444';
                                    else if (cls.includes('gray') || cls.includes('center') || cls.includes('zinc')) color = '#a1a1aa';
                                    biasSegments.push({ width: segment.style.width, color });
                                }
                            });
                            break;
                        }
                    }

                    items.push({
                        id: anchor.href.split('/').pop(),
                        url: anchor.href,
                        title,
                        imageUrl: img ? img.src : null,
                        sourceFeed,
                        timestamp,
                        biasLabel,
                        biasSegments: biasSegments.length > 0 ? biasSegments : null,
                        sourcesCount: null,
                        summaryBullets: [],
                        deepSourcesFetched: false,
                        deepSourcesList: []
                    });
                });
            } catch (err) {
                console.error("Feed extraction issue:", err);
            }
            return items;
        }

        static fetchDeepData(article) {
            if (article.deepSourcesFetched) return Promise.resolve(article);
            // Dedupe concurrent requests: the per-slide foreground fetch and the
            // background hydrator can target the same article at the same time.
            if (article._hydrationPromise) return article._hydrationPromise;
            article._hydrationPromise = this._doFetchDeepData(article);
            return article._hydrationPromise;
        }

        static async _doFetchDeepData(article) {
            try {
                const response = await fetch(article.url);
                if (!response.ok) throw new Error("HTTP " + response.status);

                const html = await response.text();
                const doc = new DOMParser().parseFromString(html, 'text/html');

                const bullets = Array.from(doc.querySelectorAll('ul li'))
                    .map(li => (li.textContent || '').trim().replace(/\s+/g, ' '))
                    .filter(t => t.length > 40 && !t.includes('Sign In') && !t.includes('Subscribe'));
                article.summaryBullets = bullets.slice(0, 4);

                let l = 0, r = 0, c = 0, tot = 0;
                let lastUpdated = null;
                const allTextNodes = Array.from(doc.querySelectorAll('span, div, p'));

                allTextNodes.forEach(el => {
                    const text = (el.textContent || '').trim();
                    if (text === 'Leaning Left') {
                        const next = el.nextElementSibling;
                        if (next && !isNaN(parseInt(next.textContent))) l = parseInt(next.textContent);
                    } else if (text === 'Leaning Right') {
                        const next = el.nextElementSibling;
                        if (next && !isNaN(parseInt(next.textContent))) r = parseInt(next.textContent);
                    } else if (text === 'Center') {
                        const next = el.nextElementSibling;
                        if (next && !isNaN(parseInt(next.textContent))) c = parseInt(next.textContent);
                    } else if (text === 'Total News Sources') {
                        const next = el.nextElementSibling;
                        if (next && !isNaN(parseInt(next.textContent))) tot = parseInt(next.textContent);
                    } else if (text === 'Last Updated') {
                        const next = el.nextElementSibling;
                        if (next && next.textContent) lastUpdated = next.textContent.trim();
                    }
                });

                if (lastUpdated) {
                    article.timestamp = lastUpdated;
                }

                const trackedTot = l + c + r;

                if (trackedTot > 0) {
                    article.biasSegments = [];
                    if(l > 0) article.biasSegments.push({ label: 'Left', val: Math.round((l/trackedTot)*100)+'%', color: '#3b82f6', width: ((l/trackedTot)*100)+'%' });
                    if(c > 0) article.biasSegments.push({ label: 'Center', val: Math.round((c/trackedTot)*100)+'%', color: '#a1a1aa', width: ((c/trackedTot)*100)+'%' });
                    if(r > 0) article.biasSegments.push({ label: 'Right', val: Math.round((r/trackedTot)*100)+'%', color: '#ef4444', width: ((r/trackedTot)*100)+'%' });

                    let maxVal = Math.max(l, c, r);
                    let dominant = l === maxVal ? 'Left' : (c === maxVal ? 'Center' : 'Right');
                    article.biasLabel = `${Math.round((maxVal/trackedTot)*100)}% ${dominant}`;
                    article.sourcesCount = tot > 0 ? tot : trackedTot;
                }

                const uniqueSources = new Map();
                const sourceCards = Array.from(doc.querySelectorAll('div')).filter(d =>
                    (d.textContent || '').includes('Factuality') && (d.textContent || '').length < 800
                );

                sourceCards.forEach(card => {
                    const texts = Array.from(card.querySelectorAll('span, p, h3, h4'))
                        .filter(el => !(el.className || '').includes('sr-only') && !el.closest('.sr-only'))
                        .map(el => (el.textContent || '').trim().replace(/\s+/g, ' '))
                        .filter(t => t.length > 2 && !t.includes('Factuality') && !t.includes('Ownership') && !t.includes('Icon') && !t.includes('Arrow') && !t.includes('Read Full'));

                    const timeStr = texts.find(t => t.match(/\d+\s+(?:minute|min|hour|hr|day|week|month)s?\s+ago/i)) || null;
                    const publisher = texts.find(t => t.length < 35 && t !== timeStr && !t.includes('Upgrade') && !t.includes('Lean')) || 'News Source';

                    const longTexts = texts.filter(t => t.length >= 35 && t !== timeStr && !t.includes('Upgrade') && !t.includes('Lean'));

                    const headline = longTexts[0] || null;
                    const preview = longTexts[1] || null;

                    if (headline && !uniqueSources.has(headline) && headline !== article.title) {
                        uniqueSources.set(headline, { publisher, headline, preview, timestamp: timeStr });
                    }
                });

                const sortedSources = Array.from(uniqueSources.values());
                sortedSources.sort((a, b) => this.parseTimeWeight(a.timestamp) - this.parseTimeWeight(b.timestamp));

                article.deepSourcesList = sortedSources.slice(0, 18);

                if (!article.sourcesCount && article.deepSourcesList.length > 0) {
                    article.sourcesCount = article.deepSourcesList.length;
                    if(article.biasLabel === 'Coverage Analysis') article.biasLabel = 'General Coverage';
                }

                article.deepSourcesFetched = true;
            } catch (err) {
                console.warn("Could not fetch deep data for:", article.id);
                article.deepSourcesFetched = true;
            }

            return article;
        }

        static applyHistoryState(articles) {
            try {
                const knownIds = JSON.parse(sessionStorage.getItem(CONFIG.storageKeyHistory) || '[]');
                articles.forEach(article => { article.isNew = !knownIds.includes(article.id); });
                const newKnownIds = [...new Set([...knownIds, ...articles.map(a => a.id)])];
                sessionStorage.setItem(CONFIG.storageKeyHistory, JSON.stringify(newKnownIds));
            } catch (err) {}
            return articles;
        }
    }

    class ScreensaverUI {
        constructor() {
            this.articles = [];
            this.currentIndex = 0;
            this.timerFrameId = null;
            this.slideStartTime = null;
            this.scroller = null;
            this.hydrationActive = false;

            this.overlay = this.buildOverlay();
            this.bindKeyboardControls();
        }

        buildOverlay() {
            const overlay = document.createElement('div');
            Object.assign(overlay.style, {
                position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
                backgroundColor: '#040406', zIndex: 2147483647, display: 'flex',
                flexDirection: 'column', color: '#ffffff', fontFamily: 'system-ui, -apple-system, sans-serif',
                overflow: 'hidden'
            });

            this.countdownBar = document.createElement('div');
            Object.assign(this.countdownBar.style, {
                position: 'absolute', top: 0, left: 0, height: '3px', width: '0%',
                backgroundColor: '#3b82f6', zIndex: 2147483649, boxShadow: '0 0 10px #3b82f6'
            });

            this.backgroundBlur = document.createElement('div');
            Object.assign(this.backgroundBlur.style, {
                position: 'absolute', top: '-10%', left: '-10%', width: '120%', height: '120%',
                backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(90px) brightness(0.25)',
                zIndex: -1, transition: 'background-image 2.5s ease-in-out', opacity: 0.6
            });

            this.mainContainer = document.createElement('div');
            Object.assign(this.mainContainer.style, {
                flex: '1 1 auto', display: 'flex', flexDirection: 'column',
                padding: '40px 6%', gap: '30px', opacity: 1, transition: 'opacity 0.6s ease',
                height: 'calc(100vh - 170px)', overflow: 'hidden'
            });

            this.topRow = document.createElement('div');
            Object.assign(this.topRow.style, {
                display: 'flex', gap: '50px', flex: '0 0 auto', maxHeight: '45vh', alignItems: 'flex-start'
            });

            this.imageColumn = document.createElement('div');
            Object.assign(this.imageColumn.style, {
                flex: '0 0 45%', display: 'flex', alignItems: 'flex-start', justifyContent: 'center'
            });

            this.mainImage = document.createElement('img');
            this.mainImage.className = 'gn-clickable';
            Object.assign(this.mainImage.style, {
                maxWidth: '100%', maxHeight: '45vh', objectFit: 'contain',
                borderRadius: '16px', boxShadow: '0 30px 60px -15px rgba(0, 0, 0, 0.8)',
                transition: 'transform 0.8s cubic-bezier(0.25, 1, 0.5, 1)'
            });
            this.mainImage.addEventListener('click', () => this.openCurrentArticle());
            this.imageColumn.appendChild(this.mainImage);

            this.contentColumn = document.createElement('div');
            this.contentColumn.className = 'gn-hide-scrollbar';
            Object.assign(this.contentColumn.style, {
                flex: '1 1 55%', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', paddingRight: '10px'
            });

            this.tagContainer = document.createElement('div');
            Object.assign(this.tagContainer.style, { display: 'flex', gap: '10px', alignItems: 'center', flexShrink: '0' });

            this.feedBadge = document.createElement('div');
            Object.assign(this.feedBadge.style, {
                padding: '6px 14px', backgroundColor: 'rgba(255,255,255,0.08)', color: '#fff',
                fontSize: '0.8rem', letterSpacing: '1px', borderRadius: '6px', textTransform: 'uppercase',
                border: '1px solid rgba(255,255,255,0.15)', fontWeight: '600'
            });

            this.timeBadge = document.createElement('div');
            Object.assign(this.timeBadge.style, {
                padding: '6px 12px', color: '#a1a1aa', fontSize: '0.8rem', fontWeight: '500'
            });

            this.newBadge = document.createElement('div');
            Object.assign(this.newBadge.style, {
                display: 'none', padding: '6px 12px', backgroundColor: '#eab308', color: '#000', fontWeight: '800',
                fontSize: '0.8rem', letterSpacing: '1px', borderRadius: '6px', textTransform: 'uppercase'
            });
            this.newBadge.innerText = '● New';

            this.tagContainer.appendChild(this.feedBadge);
            this.tagContainer.appendChild(this.timeBadge);
            this.tagContainer.appendChild(this.newBadge);

            this.titleEl = document.createElement('h1');
            this.titleEl.className = 'gn-clickable';
            Object.assign(this.titleEl.style, {
                fontSize: '2.5rem', fontWeight: '800', lineHeight: '1.2', margin: '0', color: '#f4f4f5', flexShrink: '0'
            });
            this.titleEl.addEventListener('click', () => this.openCurrentArticle());

            this.summaryContainer = document.createElement('ul');
            this.summaryContainer.className = 'gn-summary-list';

            this.contentColumn.appendChild(this.tagContainer);
            this.contentColumn.appendChild(this.titleEl);
            this.contentColumn.appendChild(this.summaryContainer);

            this.topRow.appendChild(this.imageColumn);
            this.topRow.appendChild(this.contentColumn);

            this.bottomRow = document.createElement('div');
            Object.assign(this.bottomRow.style, {
                flex: '1 1 auto', display: 'flex', flexDirection: 'row', gap: '30px', minHeight: '0'
            });

            this.biasCard = document.createElement('div');
            Object.assign(this.biasCard.style, {
                backgroundColor: 'rgba(15, 15, 20, 0.6)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '14px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px',
                flex: '0 0 320px'
            });

            this.biasHeader = document.createElement('div');
            this.biasHeader.innerText = 'Distribution Breakdown';
            Object.assign(this.biasHeader.style, { fontSize: '0.75rem', color: '#71717a', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '700' });

            this.biasLabelContainer = document.createElement('div');
            Object.assign(this.biasLabelContainer.style, { display: 'flex', flexDirection: 'column', gap: '8px', flex: '1' });

            this.biasLabel = document.createElement('div');
            Object.assign(this.biasLabel.style, { fontSize: '1.6rem', fontWeight: '800', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' });

            this.sourcesLabel = document.createElement('span');
            Object.assign(this.sourcesLabel.style, { fontSize: '0.9rem', color: '#a1a1aa', fontWeight: '500' });

            this.proportionalBar = document.createElement('div');
            this.proportionalBar.className = 'gn-proportional-bar';

            this.biasLabelContainer.appendChild(this.biasLabel);
            this.biasCard.appendChild(this.biasHeader);
            this.biasCard.appendChild(this.biasLabelContainer);
            this.biasCard.appendChild(this.proportionalBar);

            this.sourcesCard = document.createElement('div');
            Object.assign(this.sourcesCard.style, {
                backgroundColor: 'rgba(15, 15, 20, 0.6)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '14px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px',
                flex: '1 1 auto', overflow: 'hidden', minWidth: '0'
            });

            this.sourcesHeaderWrapper = document.createElement('div');
            Object.assign(this.sourcesHeaderWrapper.style, {
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: '0',
                borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px'
            });

            this.sourcesHeaderTitle = document.createElement('div');
            this.sourcesHeaderTitle.innerText = 'Underlying Coverage Previews';
            Object.assign(this.sourcesHeaderTitle.style, { fontSize: '0.8rem', color: '#e4e4e7', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '700' });

            this.sourcesHeaderWrapper.appendChild(this.sourcesHeaderTitle);

            this.sourcesMask = document.createElement('div');
            this.sourcesMask.className = 'gn-hide-scrollbar';
            Object.assign(this.sourcesMask.style, {
                position: 'relative', flex: '1', overflowY: 'auto',
                WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 5%, black 85%, transparent 100%)',
                maskImage: 'linear-gradient(to bottom, transparent 0%, black 5%, black 85%, transparent 100%)'
            });

            this.sourcesContainer = document.createElement('div');
            Object.assign(this.sourcesContainer.style, {
                display: 'flex', flexDirection: 'column'
            });

            this.sourcesMask.appendChild(this.sourcesContainer);
            this.sourcesCard.appendChild(this.sourcesHeaderWrapper);
            this.sourcesCard.appendChild(this.sourcesMask);

            this.bottomRow.appendChild(this.biasCard);
            this.bottomRow.appendChild(this.sourcesCard);

            this.mainContainer.appendChild(this.topRow);
            this.mainContainer.appendChild(this.bottomRow);

            this.timelineWrapper = document.createElement('div');
            Object.assign(this.timelineWrapper.style, {
                flex: '0 0 150px', width: '100%', backgroundColor: 'rgba(5,5,8,0.85)',
                borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center',
                overflowX: 'hidden', position: 'relative', backdropFilter: 'blur(20px)'
            });

            this.timelineTrack = document.createElement('div');
            Object.assign(this.timelineTrack.style, {
                display: 'flex', gap: '16px', padding: '0 40px', transition: 'transform 1.2s cubic-bezier(0.25, 1, 0.5, 1)'
            });
            this.timelineWrapper.appendChild(this.timelineTrack);

            overlay.appendChild(this.countdownBar);
            overlay.appendChild(this.backgroundBlur);
            overlay.appendChild(this.mainContainer);
            overlay.appendChild(this.timelineWrapper);

            const exitBtn = document.createElement('button');
            exitBtn.innerText = 'Exit Screensaver';
            Object.assign(exitBtn.style, {
                position: 'absolute', top: '24px', right: '24px', padding: '10px 20px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '30px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600', backdropFilter: 'blur(10px)',
                zIndex: 2147483648, transition: 'all 0.2s'
            });
            exitBtn.addEventListener('click', () => { toggleScreensaver(false); window.location.reload(); });
            overlay.appendChild(exitBtn);

            document.body.appendChild(overlay);
            return overlay;
        }

        bindKeyboardControls() {
            document.addEventListener('keydown', (e) => {
                if (this.articles.length === 0) return;
                if (e.key === 'ArrowRight') this.navigateSlide(1);
                else if (e.key === 'ArrowLeft') this.navigateSlide(-1);
            });
        }

        openCurrentArticle() {
            if (this.articles[this.currentIndex]) {
                window.open(this.articles[this.currentIndex].url, '_blank');
            }
        }

        updateStatus(message) {
            this.titleEl.innerText = message;
            this.feedBadge.style.display = 'none';
            this.timeBadge.style.display = 'none';
            this.imageColumn.style.display = 'none';
            this.summaryContainer.style.display = 'none';
            this.biasCard.style.display = 'none';
            this.sourcesCard.style.display = 'none';
        }

        buildTimeline() {
            this.timelineTrack.innerHTML = '';
            this.timelineCards = this.articles.map((article, index) => {
                const card = document.createElement('div');
                Object.assign(card.style, {
                    flex: '0 0 240px', height: '90px', backgroundColor: 'rgba(255,255,255,0.03)',
                    borderRadius: '10px', overflow: 'hidden', display: 'flex', flexDirection: 'column',
                    cursor: 'pointer', transition: 'all 0.3s ease', border: '1px solid rgba(255,255,255,0.04)',
                    position: 'relative'
                });

                if (article.isNew) {
                    const dot = document.createElement('div');
                    Object.assign(dot.style, {
                        position: 'absolute', top: '8px', right: '8px', width: '6px', height: '6px',
                        backgroundColor: '#eab308', borderRadius: '50%'
                    });
                    card.appendChild(dot);
                }

                const titlePreview = document.createElement('div');
                titlePreview.innerText = article.title;
                Object.assign(titlePreview.style, {
                    padding: '12px 12px 6px 12px', fontSize: '0.8rem', color: '#e4e4e7',
                    display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical',
                    overflow: 'hidden', lineHeight: '1.4', flex: '1'
                });

                const metaContainer = document.createElement('div');
                Object.assign(metaContainer.style, {
                    display: 'flex', justifyContent: 'space-between', padding: '0 12px 10px 12px',
                    fontSize: '0.65rem', color: '#71717a', textTransform: 'uppercase', fontWeight: '700'
                });

                const sourcePreview = document.createElement('span');
                sourcePreview.innerText = article.sourceFeed;

                const timePreview = document.createElement('span');
                timePreview.className = 'timeline-time';
                timePreview.innerText = article.timestamp;

                metaContainer.appendChild(sourcePreview);
                metaContainer.appendChild(timePreview);
                card.appendChild(titlePreview);
                card.appendChild(metaContainer);

                card.addEventListener('click', () => { this.jumpToSlide(index); });

                this.timelineTrack.appendChild(card);
                return card;
            });
        }

        updateTimelinePosition() {
            this.timelineCards.forEach((card, index) => {
                const isCurrent = index === this.currentIndex;
                card.style.opacity = isCurrent ? '1' : '0.35';
                card.style.transform = isCurrent ? 'scale(1.03)' : 'scale(1)';
                card.style.borderColor = isCurrent ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.04)';
                card.style.backgroundColor = isCurrent ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)';
            });

            if (this.timelineCards.length > 0) {
                const activeCard = this.timelineCards[this.currentIndex];
                const wrapperCenter = this.timelineWrapper.offsetWidth / 2;
                const cardOffset = activeCard.offsetLeft + (activeCard.offsetWidth / 2);
                this.timelineTrack.style.transform = `translateX(${wrapperCenter - cardOffset}px)`;
            }
        }

        async hydrateInBackground() {
            if (this.hydrationActive) return;
            this.hydrationActive = true;

            // Walk every article once, fetching the authoritative "Last Updated"
            // time and re-sorting as each lands. One request at a time with a
            // delay between calls keeps us well under any rate limit; the dedupe
            // in fetchDeepData means foreground slide fetches are never repeated.
            for (const article of this.articles) {
                if (!isScreensaverActive()) break;
                if (article.deepSourcesFetched) continue;

                await ArticleScraper.fetchDeepData(article);
                this.resortTimeline();
                await new Promise(resolve => setTimeout(resolve, CONFIG.hydrationDelayMs));
            }

            this.hydrationActive = false;
        }

        resortTimeline() {
            if (this.articles.length === 0) return;
            // Only reorder the *upcoming* items. The currently-displayed slide and
            // everything already shown stay pinned in place, so a freshly-hydrated
            // recent story bubbles to the slot right after the current one (played
            // next) instead of being sorted behind it where it'd be skipped.
            const head = this.articles.slice(0, this.currentIndex + 1);
            const tail = this.articles.slice(this.currentIndex + 1);
            tail.sort((a, b) => ArticleScraper.parseTimeWeight(a.timestamp) - ArticleScraper.parseTimeWeight(b.timestamp));
            this.articles = head.concat(tail);
            this.buildTimeline();
            this.updateTimelinePosition();
        }

        async setArticlesAndStart(articles) {
            this.articles = articles;
            this.currentIndex = 0;
            this.buildTimeline();

            if (this.articles.length > 0) {
                this.updateStatus("Hydrating initial intelligence...");
                await ArticleScraper.fetchDeepData(this.articles[0]);
                this.resortTimeline();
                this.renderSlide(this.articles[this.currentIndex]);

                this.startTimerLoop();
                this.hydrateInBackground();
                setTimeout(() => { window.location.reload(); }, CONFIG.refreshIntervalMs);
            } else {
                this.updateStatus("No articles found across monitored feeds.");
            }
        }

        startTimerLoop() {
            if (this.timerFrameId) cancelAnimationFrame(this.timerFrameId);
            this.slideStartTime = performance.now();

            const tick = (currentTime) => {
                const elapsed = currentTime - this.slideStartTime;
                const progressRatio = Math.min(elapsed / CONFIG.slideDurationMs, 1);
                this.countdownBar.style.width = `${progressRatio * 100}%`;

                if (elapsed >= CONFIG.slideDurationMs) {
                    this.navigateSlide(1);
                } else {
                    this.timerFrameId = requestAnimationFrame(tick);
                }
            };
            this.timerFrameId = requestAnimationFrame(tick);
            this.preloadNextSlide();
        }

        navigateSlide(directionModifier) {
            let nextIdx = this.currentIndex + directionModifier;
            if (nextIdx >= this.articles.length) nextIdx = 0;
            if (nextIdx < 0) nextIdx = this.articles.length - 1;

            this.jumpToSlide(nextIdx);
        }

        preloadNextSlide() {
            const nextIndex = (this.currentIndex + 1) % this.articles.length;
            const nextArticle = this.articles[nextIndex];
            ArticleScraper.fetchDeepData(nextArticle).then(() => {
                this.resortTimeline();
                const reIndex = this.articles.indexOf(nextArticle);
                if (reIndex >= 0 && this.timelineCards[reIndex]) {
                    const timeSpan = this.timelineCards[reIndex].querySelector('.timeline-time');
                    if (timeSpan && nextArticle.timestamp) {
                        timeSpan.innerText = nextArticle.timestamp;
                    }
                }
            });
        }

        async jumpToSlide(index) {
            this.currentIndex = index;
            await ArticleScraper.fetchDeepData(this.articles[this.currentIndex]);
            this.resortTimeline();
            this.renderSlide(this.articles[this.currentIndex]);
            this.startTimerLoop();
        }

        renderSlide(article) {
            this.mainContainer.style.opacity = 0;
            this.mainImage.style.transform = 'scale(0.97)';
            if (this.scroller) this.scroller.stop();

            setTimeout(() => {
                this.titleEl.innerText = article.title;
                this.newBadge.style.display = article.isNew ? 'block' : 'none';
                this.feedBadge.innerText = article.sourceFeed;
                this.feedBadge.style.display = 'block';

                this.biasCard.style.display = 'flex';
                this.sourcesCard.style.display = 'flex';

                if (article.timestamp) {
                    this.timeBadge.innerText = article.timestamp;
                    this.timeBadge.style.display = 'block';
                } else {
                    this.timeBadge.style.display = 'none';
                }

                if (article.imageUrl) {
                    this.mainImage.src = article.imageUrl;
                    this.backgroundBlur.style.backgroundImage = `url(${article.imageUrl})`;
                    this.imageColumn.style.display = 'flex';
                } else {
                    this.imageColumn.style.display = 'none';
                    this.backgroundBlur.style.backgroundImage = 'none';
                }

                this.summaryContainer.innerHTML = '';
                if (article.summaryBullets && article.summaryBullets.length > 0) {
                    article.summaryBullets.forEach(bullet => {
                        const li = document.createElement('li');
                        li.innerText = bullet;
                        this.summaryContainer.appendChild(li);
                    });
                    this.summaryContainer.style.display = 'flex';
                } else {
                    this.summaryContainer.style.display = 'none';
                }

                this.proportionalBar.innerHTML = '';
                this.biasLabel.innerHTML = '';

                const detailRows = this.biasLabelContainer.querySelectorAll('.bias-detail-row');
                detailRows.forEach(row => row.remove());

                let lblText = document.createElement('span');
                lblText.innerText = article.biasLabel || 'Coverage Analysis';
                this.biasLabel.appendChild(lblText);

                if (article.sourcesCount) {
                    this.sourcesLabel.innerText = `${article.sourcesCount} Sources`;
                    this.biasLabel.appendChild(this.sourcesLabel);
                }

                if (article.biasSegments && article.biasSegments.length > 0) {
                    article.biasSegments.forEach(bias => {
                        const segment = document.createElement('div');
                        segment.className = 'gn-segment';
                        Object.assign(segment.style, { width: bias.width, backgroundColor: bias.color });
                        this.proportionalBar.appendChild(segment);

                        if (bias.label) {
                            const row = document.createElement('div');
                            row.className = 'bias-detail-row';
                            Object.assign(row.style, { display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: '600' });

                            const lbl = document.createElement('span');
                            lbl.innerText = bias.label;
                            lbl.style.color = bias.color;

                            const val = document.createElement('span');
                            val.innerText = bias.val;
                            val.style.color = '#f4f4f5';

                            row.appendChild(lbl);
                            row.appendChild(val);
                            this.biasLabelContainer.appendChild(row);
                        }
                    });
                } else {
                    const fallbackSeg = document.createElement('div');
                    fallbackSeg.className = 'gn-segment';
                    Object.assign(fallbackSeg.style, { width: '100%', backgroundColor: '#3f3f46' });
                    this.proportionalBar.appendChild(fallbackSeg);
                }

                this.sourcesContainer.innerHTML = '';
                this.sourcesMask.scrollTop = 0;

                if (article.deepSourcesList && article.deepSourcesList.length > 0) {
                    const gridLayer = document.createElement('div');
                    gridLayer.className = 'gn-grid-layer';

                    article.deepSourcesList.forEach(src => {
                        const card = document.createElement('div');
                        card.className = 'gn-source-card';

                        const metaRow = document.createElement('div');
                        metaRow.className = 'gn-source-meta-row';

                        const pub = document.createElement('span');
                        pub.className = 'gn-source-pub';
                        pub.innerText = src.publisher;

                        metaRow.appendChild(pub);

                        if (src.timestamp) {
                            const timeSpan = document.createElement('span');
                            timeSpan.className = 'gn-source-time';

                            const cleanTimeMatch = src.timestamp.match(/(\d+\s*(?:minute|min|hour|hr|day|week|month)s?\s*ago)/i);
                            timeSpan.innerText = cleanTimeMatch ? cleanTimeMatch[1] : src.timestamp;

                            metaRow.appendChild(timeSpan);
                        }

                        const hdl = document.createElement('span');
                        hdl.className = 'gn-source-hdl';
                        hdl.innerText = src.headline;

                        card.appendChild(metaRow);
                        card.appendChild(hdl);

                        if (src.preview) {
                            const pre = document.createElement('div');
                            pre.className = 'gn-source-preview';
                            pre.innerText = src.preview;
                            card.appendChild(pre);
                        }

                        gridLayer.appendChild(card);
                    });

                    this.sourcesContainer.appendChild(gridLayer);

                    const needsScroll = article.deepSourcesList.length > 3;
                    if (needsScroll) {
                        const gridClone = gridLayer.cloneNode(true);
                        this.sourcesContainer.appendChild(gridClone);

                        this.scroller = new SmoothScroller(this.sourcesMask);
                        this.scroller.start();
                    }
                } else {
                    const templateMsg = document.createElement('div');
                    templateMsg.innerText = 'Fetching deep analysis failed or is hidden behind login gate. Check the article on Ground News directly.';
                    Object.assign(templateMsg.style, { fontSize: '0.85rem', color: '#71717a', fontStyle: 'italic', paddingTop: '10px' });
                    this.sourcesContainer.appendChild(templateMsg);
                }

                this.updateTimelinePosition();

                this.mainContainer.style.opacity = 1;
                this.mainImage.style.transform = 'scale(1)';
            }, 600);
        }
    }

    class App {
        init() {
            if (isScreensaverActive()) {
                this.ui = new ScreensaverUI();
                this.startAggregation();
            } else {
                this.injectActivationButton();
            }
        }

        async startAggregation() {
            this.ui.updateStatus("Extracting core visual layout...");
            const articles = await ArticleScraper.fetchAllFeeds((msg) => this.ui.updateStatus(msg));
            this.ui.setArticlesAndStart(articles);
        }

        injectActivationButton() {
            const btn = document.createElement('button');
            btn.innerHTML = `<svg style="width:20px;height:20px;margin-right:8px" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> Launch Screensaver`;
            Object.assign(btn.style, {
                position: 'fixed', bottom: '24px', left: '24px', zIndex: 999999,
                padding: '12px 24px', backgroundColor: '#7c3aed', color: '#fff',
                border: 'none', borderRadius: '12px', cursor: 'pointer',
                fontFamily: 'system-ui, sans-serif', fontWeight: '600',
                display: 'flex', alignItems: 'center', boxShadow: '0 4px 15px rgba(124, 58, 237, 0.4)',
                transition: 'transform 0.2s, background-color 0.2s'
            });

            btn.addEventListener('mouseover', () => btn.style.backgroundColor = '#6d28d9');
            btn.addEventListener('mouseout', () => btn.style.backgroundColor = '#7c3aed');
            btn.addEventListener('click', () => {
                toggleScreensaver(true);
                window.location.reload();
            });

            document.body.appendChild(btn);
        }
    }

    window.addEventListener('load', () => {
        new App().init();
    });

})();
