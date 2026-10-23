// --- SCRIPT BLOCK (Original #3) ---
// Force scroll to top on load so preloader is always seen at top



        if ('scrollRestoration' in history) history.scrollRestoration = 'manual';



        window.scrollTo(0, 0);



        document.body.style.overflow = 'hidden'; // Hide scrollbar during preloader







        // Robust, Non-Blocking Preloader Controller

        let preloaderFinished = false;



        function runPreloaderExit() {

            if (preloaderFinished) return;

            preloaderFinished = true;



            const preloader = document.getElementById('preloader');

            if (!preloader) {

                document.body.style.overflow = 'auto';

                return;

            }



            // 1. Draw the laser cut line

            preloader.classList.add('cutting');



            // 2. Split the banner halves apart at 400ms

            setTimeout(() => {

                preloader.classList.add('split');

                document.body.style.overflow = 'auto';

            }, 400);



            // 3. Remove completely from layout at 1200ms

            setTimeout(() => {

                preloader.style.display = 'none';

            }, 1200);

        }



        function playPreloaderAudio() {

            try {

                const AudioContextClass = window.AudioContext || window.webkitAudioContext;

                if (AudioContextClass) {

                    const audioCtx = new AudioContextClass();

                    if (audioCtx.state === 'running') {

                        const osc = audioCtx.createOscillator();

                        osc.type = 'sawtooth';

                        osc.frequency.setValueAtTime(800, audioCtx.currentTime);

                        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.8);

                        const gainNode = audioCtx.createGain();

                        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);

                        gainNode.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 0.1);

                        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.8);

                        osc.connect(gainNode);

                        gainNode.connect(audioCtx.destination);

                        osc.start();

                        osc.stop(audioCtx.currentTime + 1);

                    }

                }

            } catch(e) {}

        }



        // Tap/Click anywhere on screen to immediately dismiss preloader

        const preloaderEl = document.getElementById('preloader');

        if (preloaderEl) {

            preloaderEl.addEventListener('click', runPreloaderExit);

            preloaderEl.addEventListener('touchend', runPreloaderExit);

        }



        // Trigger sequence promptly: does NOT wait for heavy 10MB CDNs or external trackers

        if (document.readyState === 'interactive' || document.readyState === 'complete') {

            playPreloaderAudio();

            setTimeout(runPreloaderExit, 600);

        } else {

            document.addEventListener('DOMContentLoaded', () => {

                playPreloaderAudio();

                setTimeout(runPreloaderExit, 600);

            });

            window.addEventListener('load', () => {

                setTimeout(runPreloaderExit, 200);

            });

        }



        // Hard Failsafe: Under NO circumstance can the preloader hang longer than 1.4s

        setTimeout(runPreloaderExit, 1400);







        // Scroll Progress Bar



        window.addEventListener('scroll', () => {
            const scrollTop = document.documentElement.scrollTop;
            const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            const progress = (scrollTop / scrollHeight) * 100;
            const el = document.getElementById('scrollProgress');
            if (el) el.style.width = progress + '%';
        }, { passive: true });







        // Back to Top



        window.addEventListener('scroll', () => {
            const btn = document.getElementById('backToTop');
            if (!btn) return;
            if (window.scrollY > 600) btn.classList.add('visible');
            else btn.classList.remove('visible');
        }, { passive: true });







        // Hamburger Menu



        const hamburger = document.getElementById('hamburger');



        const mobileNav = document.getElementById('mobileNav');



        hamburger.addEventListener('click', () => {



            hamburger.classList.toggle('active');



            mobileNav.classList.toggle('active');



        });



        mobileNav.querySelectorAll('a').forEach(link => {



            link.addEventListener('click', () => {



                hamburger.classList.remove('active');



                mobileNav.classList.remove('active');



            });



        });







        // Active Nav Link Highlight



        const sections = document.querySelectorAll('section, .stats-bar');



        const navLinks = document.querySelectorAll('#desktopNav a');



        window.addEventListener('scroll', () => {



            let current = '';



            sections.forEach(sec => {



                const top = sec.offsetTop - 200;



                if (window.scrollY >= top) current = sec.getAttribute('id');



            });



            navLinks.forEach(link => {



                link.classList.remove('active');



                if (link.getAttribute('href') === '#' + current) link.classList.add('active');



            });



        });







        // Scroll Reveal



        const observer = new IntersectionObserver((entries) => {



            entries.forEach(entry => {



                if (entry.isIntersecting) entry.target.classList.add('visible');



            });



        }, { threshold: 0.15, rootMargin: '0px 0px -50px 0px' });



        document.querySelectorAll('.reveal, .reveal-stagger').forEach(el => observer.observe(el));







        // Stats Counter Animation



        const counterObserver = new IntersectionObserver((entries) => {



            entries.forEach(entry => {



                if (entry.isIntersecting) {



                    const counters = entry.target.querySelectorAll('.stat-number');



                    counters.forEach(counter => {



                        const target = +counter.dataset.target;



                        const duration = 1500;



                        const start = performance.now();



                        function update(now) {



                            const elapsed = now - start;



                            const progress = Math.min(elapsed / duration, 1);



                            const eased = 1 - Math.pow(1 - progress, 3);



                            counter.textContent = Math.floor(eased * target) + '+';



                            if (progress < 1) requestAnimationFrame(update);



                        }



                        requestAnimationFrame(update);



                    });



                    counterObserver.unobserve(entry.target);



                }



            });



        }, { threshold: 0.5 });



        document.querySelectorAll('.stats-bar').forEach(el => counterObserver.observe(el));







        // ========================================================

        // 1. ORIGINAL GOLDEN CONSTELLATION WEB (ULTRA-LOW CPU & THERMAL ENGINE)

        // ========================================================

        const bgCanvas = document.getElementById('particles');

        const bgCtx = bgCanvas.getContext('2d');

        let bgW, bgH, bgParticles = [], bgMouse = { x: null, y: null };

        let lastActivityTime = performance.now();



        function resizeBg() {

            bgW = bgCanvas.width = window.innerWidth;

            bgH = bgCanvas.height = window.innerHeight;

        }

        resizeBg();



        class BgParticle {

            constructor() {

                this.x = Math.random() * bgW;

                this.y = Math.random() * bgH;

                this.vx = (Math.random() - 0.5) * 0.40;

                this.vy = (Math.random() - 0.5) * 0.40;

                // Exact original starlight radius: 0.5px to 2.0px

                this.r = Math.random() * 1.5 + 0.5;

            }

            update() {

                this.x += this.vx;

                this.y += this.vy;

                if (this.x < 0) { this.x = 0; this.vx *= -1; }

                else if (this.x > bgW) { this.x = bgW; this.vx *= -1; }

                if (this.y < 0) { this.y = 0; this.vy *= -1; }

                else if (this.y > bgH) { this.y = bgH; this.vy *= -1; }

            }

        }



        function initBgParticles() {

            // Count matched to screen size: authentic starlight field

            const isMobile = window.innerWidth < 768 || ('ontouchstart' in window);
            const count = isMobile 
                ? 36 
                : Math.min(120, Math.max(70, Math.floor((bgW * bgH) / 11000)));

            bgParticles = [];

            for (let i = 0; i < count; i++) {

                bgParticles.push(new BgParticle());

            }

        }

        initBgParticles();



        window.addEventListener('resize', () => {

            resizeBg();

            initBgParticles();

        }, { passive: true });



        function recordActivity() {
            lastActivityTime = performance.now();
            if (!bgAnimationId && typeof animateBgWeb === 'function' && !document.hidden) {
                const isModalActive = document.querySelector('.staad-modal-backdrop.active, #staad3dModal.active, #vaultModal.active, #docModal.active');
                if (!isModalActive) {
                    bgAnimationId = requestAnimationFrame(animateBgWeb);
                }
            }
        }



        window.addEventListener('mousemove', e => { 

            bgMouse.x = e.clientX; 

            bgMouse.y = e.clientY; 

            recordActivity();

        }, { passive: true });



        // CRITICAL FIX: Use document 'mouseleave' instead of window 'mouseout'.
        // 'mouseout' bubbles from every single internal DOM element boundary (chips, badges, cards in timeline),
        // instantly clearing bgMouse coordinates when moving over any card. 'mouseleave' on document only fires when cursor leaves viewport!
        document.addEventListener('mouseleave', () => { 

            bgMouse.x = null; 

            bgMouse.y = null; 

        }, { passive: true });



        window.addEventListener('scroll', recordActivity, { passive: true });

        window.addEventListener('touchstart', recordActivity, { passive: true });



        // High-Speed Spatial Hash Engine (O(N) vs original O(N^2))

        const CELL_SIZE = 120;

        const CELL_SIZE_SQ = 120 * 120; // 14400 (exact original 120px max distance)

        const MID_DIST_SQ = 70 * 70;    // 4900

        const MOUSE_MAX_SQ = 180 * 180; // 32400 (exact original 180px mouse distance)

        const MOUSE_MID_SQ = 95 * 95;   // 9025



        let lastBgFrameTime = 0;

        let bgAnimationId = null;

        // Zero-GC Pre-allocated Spatial Hash Grid Pool
        let spatialGrid = [];

        function animateBgWeb(timestamp) {

            // Continuous Starlight Web: Only pause when browser tab is hidden/minimized
            if (document.hidden) {
                bgAnimationId = null;
                return;
            }

            // Thermal & GPU Saver: Halt canvas loop completely if 3D viewer or any modal is open
            const isModalActive = document.querySelector('.staad-modal-backdrop.active, #staad3dModal.active, #vaultModal.active, #docModal.active');
            if (isModalActive) {
                bgAnimationId = null;
                return;
            }



            bgAnimationId = requestAnimationFrame(animateBgWeb);

            // 30 FPS Cap (33.3ms interval): perfectly fluid ambient gold particle motion with 50% less GPU composite load behind blur!
            const now = timestamp || performance.now();
            const elapsed = now - lastBgFrameTime;
            const BG_FRAME_INTERVAL = 1000 / 30;
            if (elapsed < BG_FRAME_INTERVAL) return;
            lastBgFrameTime = now - (elapsed % BG_FRAME_INTERVAL);

            bgCtx.clearRect(0, 0, bgW, bgH);



            const n = bgParticles.length;

            const cols = Math.ceil(bgW / CELL_SIZE) + 1;

            const rows = Math.ceil(bgH / CELL_SIZE) + 1;

            const totalCells = cols * rows;



            // Zero-GC Spatial Hash Grid Reuse (Zero memory allocations per frame)
            while (spatialGrid.length < totalCells) {
                spatialGrid.push([]);
            }
            for (let i = 0; i < totalCells; i++) {
                spatialGrid[i].length = 0;
            }
            const grid = spatialGrid;

            for (let i = 0; i < n; i++) {

                const p = bgParticles[i];

                p.update();

                const c = Math.min(cols - 1, Math.max(0, Math.floor(p.x / CELL_SIZE)));

                const r = Math.min(rows - 1, Math.max(0, Math.floor(p.y / CELL_SIZE)));

                grid[r * cols + c].push(i);

            }



            // PASS 1: All Original Golden Dots (Batched in 1 GPU Draw Call)

            bgCtx.beginPath();

            for (let i = 0; i < n; i++) {

                const p = bgParticles[i];

                bgCtx.moveTo(p.x + p.r, p.y);

                bgCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);

            }

            bgCtx.fillStyle = 'rgba(255, 215, 0, 0.55)'; // Original brilliant gold

            bgCtx.fill();



            // PASS 2: Inter-Particle Connecting Lines (Desktop only; skipped on mobile for 60fps & 0% heat)
            const isMobileDevice = window.innerWidth <= 768 || ('ontouchstart' in window);
            if (!isMobileDevice) {
            const neighborOffsets = [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 1]];

            bgCtx.lineWidth = 0.5;



            // Tier A: Close connections (< 70px) - bright warm gold

            bgCtx.beginPath();

            for (let r = 0; r < rows; r++) {

                for (let c = 0; c < cols; c++) {

                    const pList = grid[r * cols + c];

                    if (pList.length === 0) continue;



                    for (let o = 0; o < 5; o++) {

                        const nc = c + neighborOffsets[o][0];

                        const nr = r + neighborOffsets[o][1];

                        if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;

                        const nList = grid[nr * cols + nc];

                        if (nList.length === 0) continue;



                        const isSameCell = (o === 0);

                        for (let pi = 0; pi < pList.length; pi++) {

                            const i = pList[pi];

                            const pA = bgParticles[i];

                            const startK = isSameCell ? pi + 1 : 0;

                            for (let pk = startK; pk < nList.length; pk++) {

                                const j = nList[pk];

                                const pB = bgParticles[j];

                                const dx = pA.x - pB.x;

                                const dy = pA.y - pB.y;

                                const dSq = dx * dx + dy * dy;

                                if (dSq < MID_DIST_SQ) {

                                    bgCtx.moveTo(pA.x, pA.y);

                                    bgCtx.lineTo(pB.x, pB.y);

                                }

                            }

                        }

                    }

                }

            }

            bgCtx.strokeStyle = 'rgba(255, 215, 0, 0.12)';

            bgCtx.stroke();



            // Tier B: Mid connections (70px to 120px) - delicate gold filament

            bgCtx.beginPath();

            for (let r = 0; r < rows; r++) {

                for (let c = 0; c < cols; c++) {

                    const pList = grid[r * cols + c];

                    if (pList.length === 0) continue;



                    for (let o = 0; o < 5; o++) {

                        const nc = c + neighborOffsets[o][0];

                        const nr = r + neighborOffsets[o][1];

                        if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;

                        const nList = grid[nr * cols + nc];

                        if (nList.length === 0) continue;



                        const isSameCell = (o === 0);

                        for (let pi = 0; pi < pList.length; pi++) {

                            const i = pList[pi];

                            const pA = bgParticles[i];

                            const startK = isSameCell ? pi + 1 : 0;

                            for (let pk = startK; pk < nList.length; pk++) {

                                const j = nList[pk];

                                const pB = bgParticles[j];

                                const dx = pA.x - pB.x;

                                const dy = pA.y - pB.y;

                                const dSq = dx * dx + dy * dy;

                                if (dSq >= MID_DIST_SQ && dSq < CELL_SIZE_SQ) {

                                    bgCtx.moveTo(pA.x, pA.y);

                                    bgCtx.lineTo(pB.x, pB.y);

                                }

                            }

                        }

                    }

                }

            }

            bgCtx.strokeStyle = 'rgba(255, 215, 0, 0.05)';

            bgCtx.stroke();



            // PASS 3: Original Cursor Golden Web (0.8px line width, max 180px)

            if (bgMouse.x !== null) {

                const mx = bgMouse.x;

                const my = bgMouse.y;

                bgCtx.lineWidth = 0.8;



                // Close cursor web (< 95px)

                bgCtx.beginPath();

                for (let i = 0; i < n; i++) {

                    const p = bgParticles[i];

                    const dx = p.x - mx;

                    const dy = p.y - my;

                    const dSq = dx * dx + dy * dy;

                    if (dSq < MOUSE_MID_SQ) {

                        bgCtx.moveTo(p.x, p.y);

                        bgCtx.lineTo(mx, my);

                    }

                }

                bgCtx.strokeStyle = 'rgba(255, 215, 0, 0.38)';

                bgCtx.stroke();



                // Outer cursor web (95px to 180px)

                bgCtx.beginPath();

                for (let i = 0; i < n; i++) {

                    const p = bgParticles[i];

                    const dx = p.x - mx;

                    const dy = p.y - my;

                    const dSq = dx * dx + dy * dy;

                    if (dSq >= MOUSE_MID_SQ && dSq < MOUSE_MAX_SQ) {

                        bgCtx.moveTo(p.x, p.y);

                        bgCtx.lineTo(mx, my);

                    }

                }

                bgCtx.strokeStyle = 'rgba(255, 215, 0, 0.18)';
                bgCtx.stroke();
            }
            } // End of !isMobileDevice desktop check
        }

        requestAnimationFrame(animateBgWeb);



        // ===== ZERO-OVERHEAD FREEZE ON BLUR / SNIPPING TOOL (0ms OVERHEAD) =====

        // When Win+Shift+S is pressed, stop canvas loop & toggle class instantly.

        // Zero getComputedStyle, zero querySelectorAll('*'), zero DOM reflows!

        function freezeAllAnimations() {

            if (bgAnimationId) {

                cancelAnimationFrame(bgAnimationId);

                bgAnimationId = null;

            }

            document.documentElement.classList.add('window-paused');

        }



        function unfreezeAllAnimations() {

            document.documentElement.classList.remove('window-paused');

            if (!bgAnimationId && typeof animateBgWeb === 'function' && !document.hidden) {

                bgAnimationId = requestAnimationFrame(animateBgWeb);

            }

        }



        // Only pause when tab is genuinely hidden
        document.addEventListener('visibilitychange', function() {

            if (document.hidden) freezeAllAnimations();

            else unfreezeAllAnimations();

        }, { passive: true });

        window.addEventListener('scroll', unfreezeAllAnimations, { passive: true });

        window.addEventListener('focus', unfreezeAllAnimations, { passive: true });









        // ========================================================

        // 2. ULTRA-SMOOTH ARCHITECTURAL PROFILE REVEAL

        // ========================================================

        (function initSmoothProfileReveal() {

            const pFrame = document.getElementById('photoFrame');

            const pLaser = document.getElementById('photoScanLaser');

            

            function triggerHeroEntrance() {

                if (pFrame) pFrame.classList.add('specular-shine');

                if (pLaser) pLaser.classList.add('scanning');

            }



            // Timed smoothly with preloader split exit

            setTimeout(triggerHeroEntrance, 750);



            // Also trigger on preloader click/touch instant dismiss

            const preloader = document.getElementById('preloader');

            if (preloader) {

                preloader.addEventListener('click', triggerHeroEntrance, { once: true });

                preloader.addEventListener('touchend', triggerHeroEntrance, { once: true });

            }

        })();



        // (Consolidated into optimized RAF Universal Spotlight Engine at line 11320)



        // ========================================================

        // HIGH-DEFINITION CERTIFICATE & DOCUMENT VIEWER ENGINE

        // ========================================================

        const CERTIFICATE_MANIFEST = {

            'cert_revit.pdf': {

                title: 'Revit Architecture with V-Ray & Enscape',

                issuer: 'PTS CAD EXPERT • Professional Certification',

                pdf: 'cert_revit.pdf',

                pages: ['cert_revit_p1.webp', 'cert_revit_p2.webp'],

                pageLabels: ['Page 1: Certificate', 'Page 2: Transcript']

            },

            'cert_training.pdf': {

                title: '6 Months Civil & Structural Onsite Training',

                issuer: 'Landmark Constructions • Site Engineering Internship',

                pdf: 'cert_training.pdf',

                pages: ['cert_training_p1.webp'],

                pageLabels: ['Certificate']

            },

            'cert_dynamic.pdf': {

                title: 'Dynamic Seismic Loads (Response Spectrum - IS 1893)',

                issuer: 'Bentley Institute • STAAD.Pro Official Credential',

                pdf: 'cert_dynamic.pdf',

                pages: ['cert_dynamic_p1.webp']

            },

            'cert_static.pdf': {

                title: 'Static Seismic Loads (Equivalent Lateral Force)',

                issuer: 'Bentley Institute • STAAD.Pro Official Credential',

                pdf: 'cert_static.pdf',

                pages: ['cert_static_p1.webp']

            },

            'cert_wind.pdf': {

                title: 'Wind Load Generation (IS 875 Part 3)',

                issuer: 'Bentley Institute • STAAD.Pro Official Credential',

                pdf: 'cert_wind.pdf',

                pages: ['cert_wind_p1.webp']

            },

            'cert_loads.pdf': {

                title: 'Modeling Loads in STAAD (Dead, Live & Envelopes)',

                issuer: 'Bentley Institute • STAAD.Pro Official Credential',

                pdf: 'cert_loads.pdf',

                pages: ['cert_loads_p1.webp']

            },

            'cert_analytical.pdf': {

                title: 'Modelling Analytical Member (3D Skeletal Frames)',

                issuer: 'Bentley Institute • STAAD.Pro Official Credential',

                pdf: 'cert_analytical.pdf',

                pages: ['cert_analytical_p1.webp']

            },

            'cert_plates.pdf': {

                title: 'Modelling Plates & Shells (FEA Surface Discretization)',

                issuer: 'Bentley Institute • STAAD.Pro Official Credential',

                pdf: 'cert_plates.pdf',

                pages: ['cert_plates_p1.webp']

            },

            'cert_beam.pdf': {

                title: 'Concrete Beam Design (Limit State Method)',

                issuer: 'Bentley Institute • STAAD.Pro Official Credential',

                pdf: 'cert_beam.pdf',

                pages: ['cert_beam_p1.webp']

            },

            'cert_columns_walls.pdf': {

                title: 'Concrete Columns & Shear Walls Design',

                issuer: 'Bentley Institute • STAAD.Pro Official Credential',

                pdf: 'cert_columns_walls.pdf',

                pages: ['cert_columns_walls_p1.webp']

            },

            'cert_properties.pdf': {

                title: 'Analytical Properties (Section Assignment & FEA)',

                issuer: 'Bentley Institute • STAAD.Pro Official Credential',

                pdf: 'cert_properties.pdf',

                pages: ['cert_properties_p1.webp']

            },

            'cert_specifications.pdf': {

                title: 'Specifications & Boundary Supports',

                issuer: 'Bentley Institute • STAAD.Pro Official Credential',

                pdf: 'cert_specifications.pdf',

                pages: ['cert_specifications_p1.webp']

            }

        };



        let currentCertData = null;

        let currentCertPageIndex = 0;



        function switchDocPage(pageIndex) {

            if (!currentCertData || !currentCertData.pages || !currentCertData.pages[pageIndex]) return;

            currentCertPageIndex = pageIndex;

            const img = document.getElementById('docCertImg');

            if (img) {

                img.style.opacity = '0';

                setTimeout(() => {

                    img.src = currentCertData.pages[pageIndex];

                    img.style.opacity = '1';

                }, 120);

            }

            const btn1 = document.getElementById('docTabBtn1');

            const btn2 = document.getElementById('docTabBtn2');

            if (btn1 && btn2) {

                btn1.classList.toggle('active', pageIndex === 0);

                btn2.classList.toggle('active', pageIndex === 1);

            }

        }



        function openDoc(docPath) {

            const modal = document.getElementById('docModal');

            const titleEl = document.getElementById('docModalTitle');

            const subtitleEl = document.getElementById('docModalSubtitle');

            const tabsEl = document.getElementById('docModalTabs');

            const dlBtn = document.getElementById('docDownloadBtn');

            const certStage = document.getElementById('docCertStage');

            const certImg = document.getElementById('docCertImg');

            const iframe = document.getElementById('docIframe');



            if (!modal) return;



            const filename = docPath.split('/').pop();

            const certInfo = CERTIFICATE_MANIFEST[filename];



            if (certInfo) {

                // High-Definition Certificate Mode

                currentCertData = certInfo;

                currentCertPageIndex = 0;



                if (titleEl) titleEl.textContent = certInfo.title;

                if (subtitleEl) subtitleEl.textContent = certInfo.issuer;



                if (dlBtn) {

                    dlBtn.style.display = 'inline-flex';

                    dlBtn.href = certInfo.pdf;

                    dlBtn.setAttribute('download', filename);

                    dlBtn.onclick = function(e) {

                        e.stopPropagation();

                    };

                }



                if (tabsEl) {

                    if (certInfo.pages && certInfo.pages.length > 1) {

                        tabsEl.style.display = 'flex';

                        const btn1 = document.getElementById('docTabBtn1');

                        const btn2 = document.getElementById('docTabBtn2');

                        if (btn1) {

                            btn1.classList.add('active');

                            const s = btn1.querySelector('span');

                            if (s) s.textContent = certInfo.pageLabels ? certInfo.pageLabels[0] : 'Page 1';

                        }

                        if (btn2) {

                            btn2.classList.remove('active');

                            const s = btn2.querySelector('span');

                            if (s) s.textContent = certInfo.pageLabels ? certInfo.pageLabels[1] : 'Page 2';

                        }

                    } else {

                        tabsEl.style.display = 'none';

                    }

                }



                if (certImg) {

                    certImg.src = certInfo.pages[0];

                    certImg.style.opacity = '1';

                }

                if (certStage) certStage.style.display = 'flex';

                if (iframe) {

                    iframe.style.display = 'none';

                    iframe.src = '';

                }

            } else {

                // Standard Web Document Mode (like resume.html or direct PDF fallback)

                currentCertData = null;

                if (tabsEl) tabsEl.style.display = 'none';



                if (titleEl) titleEl.textContent = docPath.includes('resume') ? 'Curriculum Vitae / Resume' : 'Document Viewer';

                if (subtitleEl) subtitleEl.textContent = 'Syed Abdul Rahman • Official Documentation';



                if (dlBtn) {

                    dlBtn.href = encodeURI(docPath);

                    if (docPath.endsWith('.pdf')) {

                        dlBtn.style.display = 'inline-flex';

                        dlBtn.setAttribute('download', filename);

                    } else {

                        dlBtn.style.display = 'none';

                    }

                }



                if (certStage) certStage.style.display = 'none';

                if (iframe) {

                    iframe.style.display = 'block';

                    iframe.src = encodeURI(docPath);

                }

            }



            modal.classList.add('active');

            document.body.style.overflow = 'hidden';

        }



        function closeDoc() {

            const modal = document.getElementById('docModal');

            const iframe = document.getElementById('docIframe');

            const certImg = document.getElementById('docCertImg');



            if (modal) modal.classList.remove('active');

            if (iframe) iframe.src = '';

            if (certImg) certImg.src = '';

            document.body.style.overflow = 'auto';

        }



        // Document-level backdrop tap/click detector

        function checkBackdropClose(e) {

            const modal = document.getElementById('docModal');

            if (modal && modal.classList.contains('active')) {

                if (e.target === modal) {

                    closeDoc();

                }

            }

        }

        document.addEventListener('click', checkBackdropClose);

        document.addEventListener('touchend', checkBackdropClose);



        document.addEventListener('keydown', function(e) {

            if (e.key === 'Escape') closeDoc();

        });

// --- SCRIPT BLOCK (Original #16) ---
(function initSmartDualCursor() {

        if (!window.matchMedia('(pointer: fine)').matches) return;



        const dot = document.getElementById('customCursorDot');

        const ring = document.getElementById('customCursorRing');

        if (!dot || !ring) return;



        let mouseX = window.innerWidth / 2;

        let mouseY = window.innerHeight / 2;

        let ringX = mouseX;

        let ringY = mouseY;

        let isHovering = false;

        let isCadMode = false;

        let isVisible = false;



        document.body.classList.add('custom-cursor-active');



        // Keep cursor elements inside top-layer when entering Fullscreen

        document.addEventListener('fullscreenchange', () => {

            const fsEl = document.fullscreenElement;

            if (fsEl && fsEl !== document.documentElement) {

                fsEl.appendChild(dot);

                fsEl.appendChild(ring);

            } else {

                document.body.appendChild(dot);

                document.body.appendChild(ring);

            }

        });



        // Fast mousemove tracking

        window.addEventListener('mousemove', (e) => {

            mouseX = e.clientX;

            mouseY = e.clientY;



            const target = (e.target instanceof Element) ? e.target : (e.target && e.target.parentElement instanceof Element ? e.target.parentElement : null);
            if (!target) return;



            // If over an iframe (like the PDF viewer), let native browser cursor operate without interference

            const inIframe = target && typeof target.closest === 'function' && (target.tagName === 'IFRAME' || target.closest('iframe') || target.closest('#pdfStage') || target.closest('#docModal') || target.closest('.doc-modal'));

            if (inIframe) {

                if (isVisible) {

                    isVisible = false;

                    dot.classList.remove('active');

                    ring.classList.remove('active');

                }

                return;

            }



            if (!isVisible) {

                isVisible = true;

                dot.classList.add('active');

                ring.classList.add('active');

            }



            // Dot moves instantly with mouse

            dot.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate(-50%, -50%)`;



            // Detect CAD Stage / Canvas hover

            const inCad = target && (

                target.closest('#dxfStage') || 

                target.closest('#cadStage') || 

                target.closest('#cadCanvas') || 

                target.closest('.cad-canvas-container')

            );



            if (inCad && !isCadMode) {

                isCadMode = true;

                ring.classList.add('cad-mode');

                dot.classList.add('cad-mode');

            } else if (!inCad && isCadMode) {

                isCadMode = false;

                ring.classList.remove('cad-mode');

                dot.classList.remove('cad-mode');

            }



            // Detect interactive elements for hover scale (outside CAD mode)

            if (!isCadMode) {

                const isInteractive = target && (

                    target.closest('a') ||

                    target.closest('button') ||

                    target.closest('[role="button"]') ||

                    target.closest('.vault-item') ||

                    target.closest('.vault-key-btn') ||

                    target.closest('.vault-proj-btn') ||

                    target.closest('.vault-pill') ||

                    target.closest('.project-card') ||

                    target.closest('.cert-card') ||

                    target.closest('.modal-card') ||

                    target.closest('input') ||

                    target.closest('select') ||

                    target.closest('textarea')

                );



                if (isInteractive && !isHovering) {

                    isHovering = true;

                    ring.classList.add('hovering');

                    dot.classList.add('hovering');

                } else if (!isInteractive && isHovering) {

                    isHovering = false;

                    ring.classList.remove('hovering');

                    dot.classList.remove('hovering');

                }

            } else {

                if (isHovering) {

                    isHovering = false;

                    ring.classList.remove('hovering');

                    dot.classList.remove('hovering');

                }

            }

        }, { passive: true });



        // Mousedown / Mouseup for feedback

        window.addEventListener('mousedown', () => {

            ring.classList.add('clicking');

        });

        window.addEventListener('mouseup', () => {

            ring.classList.remove('clicking');

        });



        // Hide when mouse leaves window

        document.addEventListener('mouseleave', () => {

            isVisible = false;

            dot.classList.remove('active');

            ring.classList.remove('active');

        });

        document.addEventListener('mouseenter', () => {

            isVisible = true;

            dot.classList.add('active');

            ring.classList.add('active');

        });



        // High refresh rate ring lerp loop with smart idle sleeping (0% CPU when mouse still)

        let ringLoopRunning = false;

        function renderRing() {

            if (!document.hasFocus() || document.hidden) { ringLoopRunning = false; return; }

            if (isVisible) {

                const dx = mouseX - ringX;

                const dy = mouseY - ringY;

                if (Math.abs(dx) > 0.08 || Math.abs(dy) > 0.08) {

                    const factor = isCadMode ? 0.85 : 0.35;

                    ringX += dx * factor;

                    ringY += dy * factor;

                    ring.style.transform = `translate3d(${ringX.toFixed(2)}px, ${ringY.toFixed(2)}px, 0) translate(-50%, -50%)`;

                    requestAnimationFrame(renderRing);

                } else {

                    ringLoopRunning = false;

                }

            } else {

                ringLoopRunning = false;

            }

        }

        function wakeRingLoop() {

            if (!ringLoopRunning) {

                ringLoopRunning = true;

                requestAnimationFrame(renderRing);

            }

        }

        window.addEventListener('mousemove', wakeRingLoop, { passive: true });

        wakeRingLoop();

    })();

// --- SCRIPT BLOCK (Original #17) ---
if (new URLSearchParams(window.location.search).get('open3d') === '1') {

    window.addEventListener('load', function() {

        setTimeout(function() { if (typeof open3DViewer === 'function') open3DViewer(); }, 600);

    });

}

// --- SCRIPT BLOCK (Original #18) ---
// ========================================================
        // UNIVERSAL CARD SPOTLIGHT ENGINE (CURSOR FOLLOW LIGHT)
        // ========================================================
        function initCardSpotlights() {
            const cards = document.querySelectorAll(
                '.tracer-card-container, .tracer-card-inner, .featured-project-card, .project-bento-card, .cockpit-launch-card, .skill-card, .cert-bento-card, .timeline-card'
            );
            
            cards.forEach(card => {
                if (!card.querySelector('.card-spotlight-layer')) {
                    const spot = document.createElement('div');
                    spot.className = 'card-spotlight-layer';
                    card.insertBefore(spot, card.firstChild);
                }

                let rect = null;
                let rafPending = false;
                let lastX = 0, lastY = 0;

                card.addEventListener('mouseenter', () => {
                    rect = card.getBoundingClientRect();
                }, { passive: true });

                card.addEventListener('mousemove', e => {
                    lastX = e.clientX;
                    lastY = e.clientY;
                    if (!rafPending) {
                        rafPending = true;
                        requestAnimationFrame(() => {
                            if (!rect) rect = card.getBoundingClientRect();
                            card.style.setProperty('--mouse-x', (lastX - rect.left) + 'px');
                            card.style.setProperty('--mouse-y', (lastY - rect.top) + 'px');
                            rafPending = false;
                        });
                    }
                }, { passive: true });
            });


        }
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initCardSpotlights);
        } else {
            initCardSpotlights();
        }

        // 1-Click Clipboard Utility for Contact Actions
        function copyContactText(text, btn) {
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(text).then(() => showCopiedBadge(btn)).catch(() => fallbackCopy(text, btn));
            } else {
                fallbackCopy(text, btn);
            }
        }
        function fallbackCopy(text, btn) {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            try {
                document.execCommand('copy');
                showCopiedBadge(btn);
            } catch (e) {}
            ta.remove();
        }
        function showCopiedBadge(btn) {
            const orig = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check" style="color:#10b981"></i> Copied!';
            btn.style.borderColor = '#10b981';
            btn.style.color = '#34d399';
            setTimeout(() => {
                btn.innerHTML = orig;
                btn.style.borderColor = '';
                btn.style.color = '';
            }, 2000);
        }

// --- SCRIPT BLOCK (Original #19) ---
// Floating Quick-Connect Lifecycle
(function() {
    const pill = document.getElementById('floatingQuickConnect');
    const trigger = document.getElementById('quickConnectTrigger');
    const popover = document.getElementById('quickConnectPopover');
    const closeBtn = document.getElementById('closeQuickConnect');
    if (!pill || !trigger || !popover) return;

    let isVisible = false;
    window.addEventListener('scroll', () => {
        const scrolled = window.scrollY > 380;
        if (scrolled !== isVisible) {
            isVisible = scrolled;
            pill.classList.toggle('visible', isVisible);
            if (!isVisible) popover.classList.remove('open');
        }
    }, { passive: true });

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        popover.classList.toggle('open');
    });

    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            popover.classList.remove('open');
        });
    }

    document.addEventListener('click', (e) => {
        if (!popover.contains(e.target) && e.target !== trigger) {
            popover.classList.remove('open');
        }
    });
})();

// --- SCRIPT BLOCK (Original #20) ---
// Zero-CPU Offscreen Section Observer: freezes infinite CSS keyframes when scrolled out of view
(function() {
    if ('IntersectionObserver' in window) {
        const sectionPerfObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                entry.target.classList.toggle('offscreen-paused', !entry.isIntersecting);
            });
        }, { rootMargin: '200px 0px' });

        document.querySelectorAll('section, header, footer, .hero, .featured-project-card, .staad-workbench').forEach(el => {
            sectionPerfObserver.observe(el);
        });
    }
})();

// --- SCRIPT BLOCK (Original #21) ---
// STAAD.Pro Architectural Plan Chest / Credentials Drawer Logic
(function() {
    const modules = [
        { id: 1, name: 'Dynamic Seismic Loads', code: 'IS 1893:2016', img: 'cert_dynamic_p1.webp', pdf: 'cert_dynamic.pdf' },
        { id: 2, name: 'Static Seismic Loads', code: 'Equivalent Lateral Force', img: 'cert_static_p1.webp', pdf: 'cert_static.pdf' },
        { id: 3, name: 'Wind Load Generation', code: 'IS 875 Part 3', img: 'cert_wind_p1.webp', pdf: 'cert_wind.pdf' },
        { id: 4, name: 'Modeling Loads in STAAD', code: 'Dead, Live & Envelopes', img: 'cert_loads_p1.webp', pdf: 'cert_loads.pdf' },
        { id: 5, name: 'Modelling Analytical Member', code: '3D Space Frames', img: 'cert_analytical_p1.webp', pdf: 'cert_analytical.pdf' },
        { id: 6, name: 'Modelling Plates & Shells', code: 'FEA Discretization', img: 'cert_plates_p1.webp', pdf: 'cert_plates.pdf' },
        { id: 7, name: 'Concrete Beam Design', code: 'IS 456 Limit State', img: 'cert_beam_p1.webp', pdf: 'cert_beam.pdf' },
        { id: 8, name: 'Concrete Columns & Walls', code: 'Bi-axial & Shear', img: 'cert_columns_walls_p1.webp', pdf: 'cert_columns_walls.pdf' },
        { id: 9, name: 'Analytical Properties', code: 'Section Assignment • FEA', img: 'cert_properties_p1.webp', pdf: 'cert_properties.pdf' },
        { id: 10, name: 'Specifications & Supports', code: 'Boundary Conditions', img: 'cert_specifications_p1.webp', pdf: 'cert_specifications.pdf' }
    ];

    let activeIndex = 0;
    const stage = document.getElementById('staadMasterStage');
    const stageImg = document.getElementById('staadMasterImg');
    const stageMod = document.getElementById('staadStageMod');
    const stageTitle = document.getElementById('staadStageTitle');
    const stageCode = document.getElementById('staadStageCode');
    const track = document.getElementById('staadDrawerTrack');
    const prevBtn = document.getElementById('drawerPrevBtn');
    const nextBtn = document.getElementById('drawerNextBtn');

    if (!stage || !stageImg || !track) return;

    let switchTimer = null;
    function selectModule(index, instant = false) {
        activeIndex = (index + modules.length) % modules.length;
        const mod = modules[activeIndex];
        
        track.querySelectorAll('.staad-drawer-item').forEach((item, idx) => {
            item.classList.toggle('active', idx === activeIndex);
        });

        if (switchTimer) clearTimeout(switchTimer);

        const updateContent = () => {
            stageImg.src = mod.img;
            stageImg.alt = mod.name + ' - Bentley Certificate';
            stageMod.textContent = 'MODULE ' + (mod.id < 10 ? '0' + mod.id : mod.id) + ' / 10';
            stageTitle.textContent = mod.name;
            stageCode.textContent = mod.code;
            stageImg.style.opacity = '1';
            stage.onclick = () => openDoc(mod.pdf);
        };

        if (instant) {
            updateContent();
        } else {
            stageImg.style.opacity = '0.35';
            switchTimer = setTimeout(updateContent, 40);
        }

        if (instant) {
            const activeItem = track.children[activeIndex];
            if (activeItem) {
                activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }
    }

    track.querySelectorAll('.staad-drawer-item').forEach((item, idx) => {
        item.addEventListener('mouseenter', () => selectModule(idx, false));
        item.addEventListener('click', () => {
            selectModule(idx, true);
            openDoc(modules[idx].pdf);
        });
    });

    if (prevBtn) prevBtn.addEventListener('click', (e) => { e.stopPropagation(); selectModule(activeIndex - 1, true); });
    if (nextBtn) nextBtn.addEventListener('click', (e) => { e.stopPropagation(); selectModule(activeIndex + 1, true); });

    // Initial stage click handler
    stage.onclick = () => openDoc(modules[0].pdf);
})();
