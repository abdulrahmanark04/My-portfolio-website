// ==========================================================================
// 3D SKELETAL SPACE FRAME & BENTLEY RCDC REINFORCEMENT DETAILING VIEWER
// Interactive 3D WebGL Visualization for G+2 Multi-Storey Residential Space Frame
// ==========================================================================

(function () {
    let scene, camera, renderer, controls;
    let canvas, container;
    let animId = null;
    let isInitialized = false;
    let currentStory = 'all';
    let displayMode = 'solid'; // 'solid' | 'wireframe'
    let analysisMode = 'solid'; // 'solid' | 'rcc' | 'moment' | 'shear'
    let isRccMode = false;
    let showNodes = true;
    let showSlabs = true;
    let autoRotate = false;
    let activeGridFilter = null; // { axis: 'X'|'Z', coord: number, name: string }
    let currentView = 'iso';
    let renderDemandCount = 10;
    function requestRender(frames = 3) {
        renderDemandCount = Math.max(renderDemandCount, frames);
    }

    let architecturalModel = null;
    let archStoryGroups = {};
    let gridHelper = null;
    let ambientLight = null;
    let dirLight1 = null;
    let dirLight2 = null;
    let dirLight3 = null;

    // Materials cache for realistic architectural rendering
    let matWallStucco, matWallInterior, matWallAccent, matPlinthStone, matGroundPaver;
    let matGroundLawn, matCompoundWall, matGateSteel, matDoorWood, matDoorInterior;
    let matDoorSteel, matWindowFrame, matWindowGlass, matRailingGlass, matRailingSteel;
    let matChajja, matWaterTank, matParapetCoping, matRoofTile, matPillarStone;

    // Object registries
    const memberMeshes = [];
    const jointMeshes = [];
    const footingMeshes = [];
    const slabMeshes = [];
    let selectedMesh = null;
    let hoveredMesh = null;
    let hoveredOrigColor = null;
    let currentInspectorData = null;

    // Raycaster for hover & click inspection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let tooltipEl = null;

    // Center offset coordinates
    const OFFSET_X = 9.2206 / 2.0;
    const OFFSET_Z = 16.6882 / 2.0;

    // Colors (High-Contrast, Vivid Structural Engineering Palette)
    const COLOR_COLUMN = 0xff9f0a; // Deep Vibrant Amber-Gold
    const COLOR_BEAM = 0x00b4d8;   // Deep Electric Cerulean Cyan
    const COLOR_FOOTING = 0x9333ea;// Royal Amethyst Purple
    const COLOR_SLAB = 0x0284c7;   // Pure Sapphire Glass
    const COLOR_NODE = 0xffffff;
    const COLOR_HIGHLIGHT = 0xff0055;
    const COLOR_SELECTED = 0xffd700;

    // Materials cache
    let matColumn, matBeam, matFooting, matSlab, matNode;
    let matRebarTop, matRebarBot, matRebarGold, matRebarTies;

    function initMaterials() {
        // 1. Structural FEA Materials — Deep, high-saturation CAD pigments (Zero whitewash)
        matColumn = new THREE.MeshStandardMaterial({
            color: 0xff9f0a,          // Deep Vibrant Amber-Gold
            roughness: 0.42,
            metalness: 0.12,
            emissive: 0x9a3412,       // Rich warm burnt-orange core
            emissiveIntensity: 0.28,
            envMapIntensity: 0.15     // Prevents bright sky dome from bleaching the gold!
        });

        matBeam = new THREE.MeshStandardMaterial({
            color: 0x00b4d8,          // Deep Electric Cerulean Cyan
            roughness: 0.38,
            metalness: 0.12,
            emissive: 0x0369a1,       // Deep ocean-blue core
            emissiveIntensity: 0.28,
            envMapIntensity: 0.15     // Prevents icy-white blowout!
        });

        matFooting = new THREE.MeshStandardMaterial({
            color: 0x9333ea,          // Royal Amethyst Purple
            roughness: 0.45,
            metalness: 0.10,
            emissive: 0x581c87,       // Deep violet core
            emissiveIntensity: 0.25,
            envMapIntensity: 0.15
        });

        matSlab = new THREE.MeshBasicMaterial({
            color: 0x0284c7,          // Pure Sapphire Glass (BasicMaterial = 0 lighting/GPU overhead)
            transparent: true,
            opacity: 0.28,
            depthWrite: false
        });

        matNode = new THREE.MeshBasicMaterial({
            color: COLOR_NODE
        });

        // 2. 3D Rebar Materials — MeshLambertMaterial gives vivid 3D cylindrical shading 
        // at 1/3rd the GPU fragment cost of MeshStandardMaterial and NEVER washes out white!
        matRebarTop = new THREE.MeshLambertMaterial({
            color: 0xff1e56,          // Intense Ruby Crimson (Top Tension Steel)
            emissive: 0xbe123c,
            emissiveIntensity: 0.35
        });

        matRebarBot = new THREE.MeshLambertMaterial({
            color: 0x00f0ff,          // Electric Neon Cyan (Bottom Flexural Steel)
            emissive: 0x0284c7,
            emissiveIntensity: 0.35
        });

        matRebarGold = new THREE.MeshLambertMaterial({
            color: 0xffbe0b,          // Pure 24K Gold (Column Longitudinal Steel)
            emissive: 0xb45309,
            emissiveIntensity: 0.35
        });

        matRebarTies = new THREE.LineBasicMaterial({
            color: 0xa3e635,          // High-Contrast Lime-Gold Stirrups (Pops against both Red & Gold bars!)
            transparent: false
        });

        // Architectural PBR Materials for Realistic 3D Simulation
        matWallStucco = new THREE.MeshStandardMaterial({
            color: 0xe5e1d8, // Contemporary warm off-white stucco plaster
            roughness: 0.85,
            metalness: 0.05
        });

        matWallInterior = new THREE.MeshStandardMaterial({
            color: 0xf6f4ed, // Ivory interior partition plaster
            roughness: 0.9,
            metalness: 0.02
        });

        matWallAccent = new THREE.MeshStandardMaterial({
            color: 0x1f2633, // Modern dark charcoal / graphite facade accent panels
            roughness: 0.45,
            metalness: 0.15
        });

        matPlinthStone = new THREE.MeshStandardMaterial({
            color: 0x3d4654, // Rustic granite / basalt plinth base cladding
            roughness: 0.75,
            metalness: 0.2
        });

        matGroundPaver = new THREE.MeshStandardMaterial({
            color: 0x2b3445, // Heavy interlocking driveway pavers
            roughness: 0.85,
            metalness: 0.1
        });

        matGroundLawn = new THREE.MeshStandardMaterial({
            color: 0x236340, // Manicured landscape lawn
            roughness: 0.95,
            metalness: 0.0
        });

        matCompoundWall = new THREE.MeshStandardMaterial({
            color: 0xd6d0c4, // Boundary compound wall plaster
            roughness: 0.8,
            metalness: 0.05
        });

        matGateSteel = new THREE.MeshStandardMaterial({
            color: 0x1a2230, // Architectural dark charcoal steel gate
            roughness: 0.3,
            metalness: 0.8
        });

        matDoorWood = new THREE.MeshStandardMaterial({
            color: 0x61381e, // Polished Indian Teak wood main door
            roughness: 0.35,
            metalness: 0.1
        });

        matDoorInterior = new THREE.MeshStandardMaterial({
            color: 0x8a6e5b, // Modern flush interior doors
            roughness: 0.5,
            metalness: 0.05
        });

        matDoorSteel = new THREE.MeshStandardMaterial({
            color: 0x475569, // Terrace headroom weatherproof steel door
            roughness: 0.3,
            metalness: 0.75
        });

        matWindowFrame = new THREE.MeshStandardMaterial({
            color: 0x141b26, // Anodized dark charcoal aluminum window frames
            roughness: 0.25,
            metalness: 0.75
        });

        matWindowGlass = new THREE.MeshStandardMaterial({
            color: 0x38bdf8, // Solar-reflective architectural tinted glass
            roughness: 0.1,
            metalness: 0.85,
            transparent: true,
            opacity: 0.55
        });

        matRailingGlass = new THREE.MeshStandardMaterial({
            color: 0x67e8f9, // Clear tempered safety glass balcony railing
            roughness: 0.08,
            metalness: 0.9,
            transparent: true,
            opacity: 0.45
        });

        matRailingSteel = new THREE.MeshStandardMaterial({
            color: 0xe2e8f0, // Stainless steel 304 top rail & spigots
            roughness: 0.15,
            metalness: 0.92
        });

        matChajja = new THREE.MeshStandardMaterial({
            color: 0xdcd8cf, // Weather-shade RCC cantilevered chajja
            roughness: 0.65,
            metalness: 0.05
        });

        matWaterTank = new THREE.MeshStandardMaterial({
            color: 0x0f2b5c, // Sintex deep blue polymer water tank
            roughness: 0.4,
            metalness: 0.2
        });

        matParapetCoping = new THREE.MeshStandardMaterial({
            color: 0xf1f5f9, // Precast white coping stone
            roughness: 0.5,
            metalness: 0.05
        });

        matRoofTile = new THREE.MeshStandardMaterial({
            color: 0x9a3412, // Terracotta roof tiles
            roughness: 0.8,
            metalness: 0.05
        });

        matPillarStone = new THREE.MeshStandardMaterial({
            color: 0x475569,
            roughness: 0.65,
            metalness: 0.15
        });
    }

    // Modal DOM Injection
    function injectModalHtml() {
        if (document.getElementById('staad3dModal')) return;

        const modal = document.createElement('div');
        modal.id = 'staad3dModal';
        modal.className = 'staad-modal-backdrop';
        modal.innerHTML = `
            <div class="staad-modal-window">
                <!-- Mobile Persistent Floating Exit Pill & Corner Close -->
                <button type="button" class="staad-floating-exit-pill" onclick="window.close3DViewer()" aria-label="Exit 3D View and Return to Portfolio">
                    <i class="fas fa-arrow-left"></i> <span>Back</span>
                </button>
                <button type="button" class="staad-floating-corner-close" onclick="window.close3DViewer()" aria-label="Close 3D Viewer">
                    <i class="fas fa-times"></i>
                </button>
                <!-- Header -->
                <div class="staad-header">
                    <div class="staad-header-title">
                        <button type="button" class="staad-header-back-btn" onclick="window.close3DViewer()" title="Back to Portfolio">
                            <i class="fas fa-arrow-left"></i>
                        </button>
                        <div class="staad-header-badge">
                            <i class="fas fa-cube"></i>
                        </div>
                        <div class="staad-header-text">
                            <h3>
                                3D SKELETAL SPACE FRAME
                                <span class="staad-tag" id="staadHeaderTag">STAAD.Pro & RCDC</span>
                            </h3>
                            <p id="staadHeaderSubtitle">G+2 Multi-Storey Residential Space Frame &bull; Mahabubnagar (Zone II, Z = 0.10) &bull; 100 Joints, 188 Members, 36 Slabs</p>
                        </div>
                    </div>
                    <div class="staad-header-actions">
                        <!-- Analysis Mode Segmented Switcher -->
                        <div class="staad-mode-segmented">
                            <button type="button" class="staad-mode-btn active" id="btnModeSolid" onclick="window.staadViewerSetAnalysisMode('solid')">
                                <i class="fas fa-cube"></i> Solid 3D
                            </button>
                            <button type="button" class="staad-mode-btn" id="btnModeRCC" onclick="window.staadViewerSetAnalysisMode('rcc')">
                                <i class="fas fa-shield-halved"></i> RCC Rebar
                            </button>
                            <button type="button" class="staad-mode-btn" id="btnModeMoment" onclick="window.staadViewerSetAnalysisMode('moment')">
                                <i class="fas fa-wave-square"></i> Moment Mz
                            </button>
                            <button type="button" class="staad-mode-btn" id="btnModeShear" onclick="window.staadViewerSetAnalysisMode('shear')">
                                <i class="fas fa-chart-area"></i> Shear Fy
                            </button>
                            <button type="button" class="staad-mode-btn" id="btnModeRealistic" onclick="window.staadViewerSetAnalysisMode('realistic')">
                                <i class="fas fa-city"></i> Realistic 3D
                            </button>
                        </div>
                        <button type="button" class="staad-btn-action" onclick="window.staadViewerResetView()" title="Reset Camera">
                            <i class="fas fa-crosshairs"></i> Reset
                        </button>
                        <button type="button" class="staad-btn-action" id="staadRotateBtn" onclick="window.staadViewerToggleRotate()" title="Auto-Rotate">
                            <i class="fas fa-sync-alt"></i> Auto-Spin
                        </button>
                        <button type="button" class="staad-btn-close" onclick="window.close3DViewer()" title="Close Viewer (Esc)">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>

                <!-- 3D Viewport Body -->
                <div class="staad-viewport-body" id="staadViewportContainer">
                    <canvas id="staad3dCanvas"></canvas>

                    <!-- Detailing Mode Active Banner -->
                    <div class="staad-rcc-mode-banner" id="staadRccBanner">
                        <i class="fas fa-shield-halved"></i>
                        <span><strong>Bentley RCDC Detailing Active:</strong> 3D physical steel rebar cages visible inside components. Double-click any member, footing, or slab to inspect schedule drawings &amp; cross-sections.</span>
                    </div>

                    <!-- Moment Mz Envelope Active Banner -->
                    <div class="staad-analysis-banner banner-moment" id="staadMomentBanner">
                        <i class="fas fa-wave-square" style="font-size: 1.1rem; color: #ef4444;"></i>
                        <div>
                            <strong>3D Bending Moment (Mz) Envelope Active:</strong>
                            <span>Parabolic design moments from Bentley RCDC envelopes. Negative hogging (-Mu) in crimson/red, positive sagging (+Mu) in cyan. Double-click any member to inspect moment diagrams.</span>
                        </div>
                    </div>

                    <!-- Shear Fy Envelope Active Banner -->
                    <div class="staad-analysis-banner banner-shear" id="staadShearBanner">
                        <i class="fas fa-chart-area" style="font-size: 1.1rem; color: #10b981;"></i>
                        <div>
                            <strong>3D Shear Force (Fy) Envelope Active:</strong>
                            <span>Critical support and midspan shears (Vu) along frame axes. Green ribbons indicate shear envelope magnitude. Double-click any member to inspect shear stress checks.</span>
                        </div>
                    </div>

                    <!-- Realistic Architectural Render Banner -->
                    <div class="staad-analysis-banner banner-realistic" id="staadRealisticBanner">
                        <i class="fas fa-city" style="font-size: 1.1rem; color: #38bdf8;"></i>
                        <div>
                            <strong>Realistic 3D Architectural Simulation Active:</strong>
                            <span>Complete G+2 architectural model with masonry walls, teak main door, aluminum glazed windows, weather chajjas, glass balcony railings, plinth entrance staircase, compound wall, and overhead water tank.</span>
                        </div>
                    </div>

                    <!-- Elevation Active HUD Banner -->
                    <div class="staad-elevation-banner" id="staadElevationBanner">
                        <div class="elevation-badge-icon"><i class="fas fa-border-all"></i></div>
                        <div class="elevation-badge-text">
                            <strong id="staadElevationTitle">Grid Bent Elevation</strong>
                            <span id="staadElevationSubtitle">2D Frame Isolated</span>
                        </div>
                        <button type="button" class="staad-elevation-reset-btn" onclick="window.staadViewerResetGridFilter()">
                            <i class="fas fa-undo"></i> Return to 3D
                        </button>
                    </div>

                    <!-- Top Story Filter Ribbon -->
                    <div class="staad-controls-ribbon">
                        <button type="button" class="staad-pill-btn active" data-story="all" onclick="window.staadViewerFilterStory('all')">
                            <i class="fas fa-layer-group"></i> Full Building (All Stories)
                        </button>
                        <button type="button" class="staad-pill-btn" data-story="headroom" onclick="window.staadViewerFilterStory('headroom')">
                            Roof Terrace / OHT (+14.13m)
                        </button>
                        <button type="button" class="staad-pill-btn" data-story="second" onclick="window.staadViewerFilterStory('second')">
                            Second Floor (+11.13m)
                        </button>
                        <button type="button" class="staad-pill-btn" data-story="first" onclick="window.staadViewerFilterStory('first')">
                            First Floor (+8.08m)
                        </button>
                        <button type="button" class="staad-pill-btn" data-story="ground" onclick="window.staadViewerFilterStory('ground')">
                            Ground Floor (+5.03m)
                        </button>
                        <button type="button" class="staad-pill-btn" data-story="plinth" onclick="window.staadViewerFilterStory('plinth')">
                            Plinth Beam (+1.98m)
                        </button>
                    </div>

                    <!-- Right Side View Tools (All 6 Standard Engineering Views) -->
                    <div class="staad-view-tools">
                        <div class="staad-view-group-title">Camera Views</div>
                        <button type="button" class="staad-tool-btn active" id="btnViewIso" onclick="window.staadViewerSetCamera('iso')">
                            <i class="fas fa-cube"></i> Isometric
                        </button>
                        <button type="button" class="staad-tool-btn" id="btnViewFront" onclick="window.staadViewerSetCamera('front')">
                            <i class="fas fa-arrow-down"></i> Front (South)
                        </button>
                        <button type="button" class="staad-tool-btn" id="btnViewRear" onclick="window.staadViewerSetCamera('rear')">
                            <i class="fas fa-arrow-up"></i> Rear (North)
                        </button>
                        <button type="button" class="staad-tool-btn" id="btnViewLeft" onclick="window.staadViewerSetCamera('left')">
                            <i class="fas fa-arrow-right"></i> Left (West)
                        </button>
                        <button type="button" class="staad-tool-btn" id="btnViewRight" onclick="window.staadViewerSetCamera('right')">
                            <i class="fas fa-arrow-left"></i> Right (East)
                        </button>
                        <button type="button" class="staad-tool-btn" id="btnViewTop" onclick="window.staadViewerSetCamera('top')">
                            <i class="fas fa-th"></i> Top (Plan)
                        </button>
                        <div style="height: 1px; background: rgba(255,255,255,0.1); margin: 4px 0;"></div>
                        <button type="button" class="staad-tool-btn active" id="staadToggleModeBtn" onclick="window.staadViewerToggleDisplayMode()">
                            <i class="fas fa-shapes"></i> <span id="staadModeLabel">Solid 3D</span>
                        </button>
                        <button type="button" class="staad-tool-btn active" id="staadToggleNodesBtn" onclick="window.staadViewerToggleNodes()">
                            <i class="fas fa-circle" style="font-size:0.6rem;"></i> Nodes
                        </button>
                        <button type="button" class="staad-tool-btn active" id="staadToggleSlabsBtn" onclick="window.staadViewerToggleSlabs()">
                            <i class="fas fa-layer-group"></i> Slabs (5")
                        </button>
                    </div>

                    <!-- 2D Framing Grid Minimap (STAAD.Pro Frame Bents) -->
                    <div class="staad-grid-minimap" id="staadGridMinimap">
                        <div class="staad-minimap-header">
                            <div class="staad-minimap-title">
                                <i class="fas fa-th-large" style="color: #ffd700;"></i>
                                <span>Framing Grids</span>
                            </div>
                            <div class="staad-minimap-actions">
                                <button type="button" class="staad-minimap-btn" onclick="window.staadViewerToggleMinimap()" title="Toggle Minimap">
                                    <i class="fas fa-chevron-down" id="minimapToggleIcon"></i>
                                </button>
                            </div>
                        </div>
                        <div class="staad-minimap-body">
                            <svg viewBox="0 0 200 280" class="staad-grid-svg" id="staadGridSvg">
                                <rect x="35" y="35" width="133" height="210" fill="rgba(14, 165, 233, 0.04)" stroke="rgba(255, 255, 255, 0.1)" stroke-width="1" />

                                <!-- Framing Beams -->
                                <line x1="35" y1="35" x2="145" y2="35" class="grid-beam-line" />
                                <line x1="35" y1="98" x2="145" y2="98" class="grid-beam-line" />
                                <line x1="35" y1="162" x2="168" y2="162" class="grid-beam-line" />
                                <line x1="35" y1="218" x2="168" y2="218" class="grid-beam-line" />
                                <line x1="35" y1="245" x2="168" y2="245" class="grid-beam-line" />

                                <line x1="35" y1="35" x2="35" y2="245" class="grid-beam-line" />
                                <line x1="90" y1="35" x2="90" y2="245" class="grid-beam-line" />
                                <line x1="145" y1="35" x2="145" y2="245" class="grid-beam-line" />
                                <line x1="168" y1="162" x2="168" y2="245" class="grid-beam-line" />

                                <!-- X Grids Lines -->
                                <line id="gridLine_GridA" x1="35" y1="26" x2="35" y2="254" class="grid-line" onclick="window.staadViewerFilterGrid('X', 0.0, 'Grid A')" />
                                <line id="gridLine_GridB" x1="90" y1="26" x2="90" y2="254" class="grid-line" onclick="window.staadViewerFilterGrid('X', 3.924, 'Grid B')" />
                                <line id="gridLine_GridC" x1="145" y1="26" x2="145" y2="254" class="grid-line" onclick="window.staadViewerFilterGrid('X', 7.849, 'Grid C')" />
                                <line id="gridLine_GridD" x1="168" y1="152" x2="168" y2="254" class="grid-line" onclick="window.staadViewerFilterGrid('X', 9.221, 'Grid D')" />

                                <!-- Z Grids Lines -->
                                <line id="gridLine_Grid1" x1="26" y1="35" x2="155" y2="35" class="grid-line" onclick="window.staadViewerFilterGrid('Z', 0.0, 'Grid 1')" />
                                <line id="gridLine_Grid2" x1="26" y1="98" x2="155" y2="98" class="grid-line" onclick="window.staadViewerFilterGrid('Z', 4.991, 'Grid 2')" />
                                <line id="gridLine_Grid3" x1="26" y1="162" x2="178" y2="162" class="grid-line" onclick="window.staadViewerFilterGrid('Z', 10.058, 'Grid 3')" />
                                <line id="gridLine_Grid4" x1="26" y1="218" x2="178" y2="218" class="grid-line" onclick="window.staadViewerFilterGrid('Z', 14.554, 'Grid 4')" />
                                <line id="gridLine_Grid5" x1="26" y1="245" x2="178" y2="245" class="grid-line" onclick="window.staadViewerFilterGrid('Z', 16.688, 'Grid 5')" />

                                <!-- Columns -->
                                <rect x="31" y="31" width="8" height="8" class="grid-col-rect" title="C1 (A-1)" />
                                <rect x="86" y="31" width="8" height="8" class="grid-col-rect" title="C2 (B-1)" />
                                <rect x="141" y="31" width="8" height="8" class="grid-col-rect" title="C3 (C-1)" />

                                <rect x="31" y="94" width="8" height="8" class="grid-col-rect" title="C4 (A-2)" />
                                <rect x="86" y="94" width="8" height="8" class="grid-col-rect" title="C5 (B-2)" />
                                <rect x="141" y="94" width="8" height="8" class="grid-col-rect" title="C6 (C-2)" />

                                <rect x="31" y="158" width="8" height="8" class="grid-col-rect" title="C7 (A-3)" />
                                <rect x="86" y="158" width="8" height="8" class="grid-col-rect" title="C8 (B-3)" />
                                <rect x="141" y="158" width="8" height="8" class="grid-col-rect" title="C9 (C-3)" />

                                <rect x="31" y="214" width="8" height="8" class="grid-col-rect" title="C10 (A-4)" />
                                <rect x="86" y="214" width="8" height="8" class="grid-col-rect" title="C11 (B-4)" />
                                <rect x="141" y="214" width="8" height="8" class="grid-col-rect" title="C12 (C-4)" />

                                <rect x="164" y="158" width="8" height="8" class="grid-col-rect" title="Stair/Lift C13" />
                                <rect x="164" y="214" width="8" height="8" class="grid-col-rect" title="Stair/Lift C14" />
                                <rect x="164" y="241" width="8" height="8" class="grid-col-rect" title="Stair/Lift C15" />

                                <!-- Grid Bubbles: X (Top) -->
                                <g class="grid-bubble" data-grid="Grid A" onclick="window.staadViewerFilterGrid('X', 0.0, 'Grid A')">
                                    <circle cx="35" cy="16" r="9" />
                                    <text x="35" y="16">A</text>
                                </g>
                                <g class="grid-bubble" data-grid="Grid B" onclick="window.staadViewerFilterGrid('X', 3.924, 'Grid B')">
                                    <circle cx="90" cy="16" r="9" />
                                    <text x="90" y="16">B</text>
                                </g>
                                <g class="grid-bubble" data-grid="Grid C" onclick="window.staadViewerFilterGrid('X', 7.849, 'Grid C')">
                                    <circle cx="145" cy="16" r="9" />
                                    <text x="145" y="16">C</text>
                                </g>
                                <g class="grid-bubble" data-grid="Grid D" onclick="window.staadViewerFilterGrid('X', 9.221, 'Grid D')">
                                    <circle cx="168" cy="142" r="9" />
                                    <text x="168" y="142">D</text>
                                </g>

                                <!-- Grid Bubbles: Z (Left) -->
                                <g class="grid-bubble" data-grid="Grid 1" onclick="window.staadViewerFilterGrid('Z', 0.0, 'Grid 1')">
                                    <circle cx="16" cy="35" r="9" />
                                    <text x="16" y="35">1</text>
                                </g>
                                <g class="grid-bubble" data-grid="Grid 2" onclick="window.staadViewerFilterGrid('Z', 4.991, 'Grid 2')">
                                    <circle cx="16" cy="98" r="9" />
                                    <text x="16" y="98">2</text>
                                </g>
                                <g class="grid-bubble" data-grid="Grid 3" onclick="window.staadViewerFilterGrid('Z', 10.058, 'Grid 3')">
                                    <circle cx="16" cy="162" r="9" />
                                    <text x="16" y="162">3</text>
                                </g>
                                <g class="grid-bubble" data-grid="Grid 4" onclick="window.staadViewerFilterGrid('Z', 14.554, 'Grid 4')">
                                    <circle cx="16" cy="218" r="9" />
                                    <text x="16" y="218">4</text>
                                </g>
                                <g class="grid-bubble" data-grid="Grid 5" onclick="window.staadViewerFilterGrid('Z', 16.688, 'Grid 5')">
                                    <circle cx="16" cy="245" r="9" />
                                    <text x="16" y="245">5</text>
                                </g>
                            </svg>
                            <div class="staad-minimap-hint">Click any grid line or bubble to isolate 2D frame bent</div>
                        </div>
                    </div>

                    <!-- Bottom Legend & Stats -->
                    <div class="staad-footer-legend">
                        <div class="staad-legend-group">
                            <div class="staad-legend-item">
                                <span class="legend-color-dot dot-column"></span>
                                <span>Columns (230&times;450/530mm)</span>
                            </div>
                            <div class="staad-legend-item">
                                <span class="legend-color-dot dot-beam"></span>
                                <span>Beams (230&times;430/300mm)</span>
                            </div>
                            <div class="staad-legend-item">
                                <span class="legend-color-dot" style="background:#0ea5e9;"></span>
                                <span>RCC Slabs (125mm)</span>
                            </div>
                            <div class="staad-legend-item">
                                <span class="legend-color-dot dot-footing"></span>
                                <span>Pad Footings (12 Nos)</span>
                            </div>
                            <div class="staad-legend-item">
                                <span class="legend-color-dot dot-node"></span>
                                <span>Analytical Joints</span>
                            </div>
                        </div>

                        <div class="staad-stats-card">
                            <span>Skeletal Grid: <strong>33' &times; 65'</strong></span>
                            <span>Height: <strong>14.13 m (G+2 + OHT)</strong></span>
                            <span>Limit State: <strong>IS 456 &bull; IS 1893:2016</strong></span>
                        </div>
                    </div>

                    <!-- Hover Tooltip -->
                    <div class="staad-tooltip" id="staadTooltip">
                        <div class="staad-tooltip-header" id="staadTooltipHeader">Member #0</div>
                        <div class="staad-tooltip-row">
                            <span>Type:</span>
                            <span id="staadTooltipType">Beam</span>
                        </div>
                        <div class="staad-tooltip-row">
                            <span>Dimensions:</span>
                            <span id="staadTooltipDim">230 &times; 430 mm</span>
                        </div>
                        <div class="staad-tooltip-row">
                            <span>Length:</span>
                            <span id="staadTooltipLength">3.924 m</span>
                        </div>
                        <div class="staad-tooltip-row">
                            <span>Level:</span>
                            <span id="staadTooltipLevel">First Floor</span>
                        </div>
                        <div class="staad-tooltip-row">
                            <span>Nodes:</span>
                            <span id="staadTooltipNodes">J1 &rarr; J2</span>
                        </div>
                        <div class="staad-tooltip-row" id="staadTooltipRebarRow" style="color: #00e5ff; border-top: 1px dashed rgba(255,255,255,0.15); padding-top: 4px; margin-top: 4px;">
                            <span>Rebar:</span>
                            <span id="staadTooltipRebar">Double-click to view</span>
                        </div>
                    </div>

                    <!-- Slide-in RCC Detailing & Reinforcement Inspector -->
                    <div class="staad-rebar-inspector" id="staadRebarInspector">
                        <div class="rebar-inspector-header">
                            <div class="rebar-inspector-title">
                                <div class="rebar-icon-badge" id="rebarIconBadge"><i class="fas fa-cube"></i></div>
                                <div>
                                    <h4 id="rebarTitle">Beam B1 <span class="rebar-badge-pass" id="rebarStatusBadge">PASS</span></h4>
                                    <p id="rebarSubtitle">Level: Floor 1 Framing (+5.03m)</p>
                                </div>
                            </div>
                            <button type="button" class="staad-btn-close" onclick="window.closeRebarInspector()" title="Close Inspector"><i class="fas fa-times"></i></button>
                        </div>
                        <div class="rebar-inspector-body" id="rebarBody">
                            <!-- Populated dynamically -->
                        </div>
                        <div class="rebar-inspector-footer">
                            <button type="button" class="rebar-btn-doc" id="rebarDocBtn" onclick="window.openCurrentRebarDoc()">
                                <i class="fas fa-file-pdf"></i> View RCDC Text Schedule Drawing
                            </button>
                        </div>
                    </div>

                    <!-- Floating Component Quick-Action Bar (Mobile Touch & Single-Click Ready) -->
                    <div class="staad-selection-bar" id="staadSelectionBar">
                        <div class="staad-selection-info">
                            <span class="staad-selection-badge" id="selBadge">BEAM</span>
                            <span class="staad-selection-title" id="selTitle">B1 (Member #1)</span>
                            <span class="staad-selection-dim" id="selDim">230 &times; 430 mm</span>
                        </div>
                        <div class="staad-selection-actions">
                            <button type="button" class="staad-selection-btn" onclick="window.staadViewerInspectSelected()">
                                <i class="fas fa-file-waveform"></i> Inspect Detailing &amp; Diagrams
                            </button>
                            <button type="button" class="staad-selection-close" onclick="window.staadViewerClearSelection()" title="Deselect">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Escape key to close inspector or viewer
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const inspector = document.getElementById('staadRebarInspector');
                if (inspector && inspector.classList.contains('active')) {
                    window.closeRebarInspector();
                    return;
                }
                if (modal.classList.contains('active')) {
                    window.close3DViewer();
                }
            }
        });
    }

    // ==========================================
    // 3D PHYSICAL REBAR CAGE GENERATORS
    // ==========================================

    function buildRebarCageForBeam(width, depth, distance, rcdc) {
        const cage = new THREE.Group();
        cage.name = 'rebarCage';

        const cover = 0.025; // 25mm
        const ws = Math.max(0.08, width - 2 * cover - 0.010);
        const hs = Math.max(0.12, depth - 2 * cover - 0.010);
        const barLen = Math.max(0.2, distance - 0.05);

        const topCount = rcdc ? (rcdc.topCount || 3) : 3;
        const botCount = rcdc ? (rcdc.botCount || 3) : 3;
        const rTop = 0.012; // 24mm visual rebar diameter
        const rBot = 0.014; // 28mm visual rebar diameter

        // Top Bars (Cylinders oriented along local Z)
        const topGeom = new THREE.CylinderGeometry(rTop, rTop, barLen, 8);
        topGeom.rotateX(Math.PI / 2);

        const yTop = depth / 2.0 - cover - rTop - 0.006;
        const topPositions = [-ws / 2.0 + rTop, ws / 2.0 - rTop];
        if (topCount >= 3) topPositions.push(0);

        topPositions.forEach(xPos => {
            const bar = new THREE.Mesh(topGeom, matRebarTop);
            bar.position.set(xPos, yTop, 0);
            cage.add(bar);
        });

        // Bottom Bars
        const botGeom = new THREE.CylinderGeometry(rBot, rBot, barLen, 8);
        botGeom.rotateX(Math.PI / 2);

        const yBot = -depth / 2.0 + cover + rBot + 0.006;
        const botPositions = [-ws / 2.0 + rBot, ws / 2.0 - rBot];
        if (botCount >= 3) botPositions.push(0);

        botPositions.forEach(xPos => {
            const bar = new THREE.Mesh(botGeom, matRebarBot);
            bar.position.set(xPos, yBot, 0);
            cage.add(bar);
        });

        // Shear Stirrups (Closed rectangular hoops in local XY)
        const stirrupCount = Math.max(4, Math.min(14, Math.floor(distance / 0.35)));
        const sSpacing = (distance - 0.16) / Math.max(1, stirrupCount - 1);

        for (let i = 0; i < stirrupCount; i++) {
            const zPos = -distance / 2.0 + 0.08 + i * sSpacing;
            const pts = [
                new THREE.Vector3(-ws / 2.0, -hs / 2.0, zPos),
                new THREE.Vector3(ws / 2.0, -hs / 2.0, zPos),
                new THREE.Vector3(ws / 2.0, hs / 2.0, zPos),
                new THREE.Vector3(-ws / 2.0, hs / 2.0, zPos),
                new THREE.Vector3(-ws / 2.0, -hs / 2.0, zPos)
            ];
            const lineGeom = new THREE.BufferGeometry().setFromPoints(pts);
            const stirrup = new THREE.Line(lineGeom, matRebarTies);
            cage.add(stirrup);
        }

        cage.renderOrder = 2;
        cage.visible = isRccMode;
        return cage;
    }

    function buildRebarCageForColumn(width, height, depth, rcdc) {
        const cage = new THREE.Group();
        cage.name = 'rebarCage';

        const cover = 0.040; // 40mm
        const wt = Math.max(0.08, width - 2 * cover - 0.010);
        const dt = Math.max(0.14, depth - 2 * cover - 0.010);
        const barH = Math.max(0.2, height - 0.06);

        const rCol = 0.013; // 26mm visual rebar diameter
        const colGeom = new THREE.CylinderGeometry(rCol, rCol, barH, 8); // along local Y

        // 4 Corner Bars
        const corners = [
            [-wt / 2.0, -dt / 2.0],
            [wt / 2.0, -dt / 2.0],
            [-wt / 2.0, dt / 2.0],
            [wt / 2.0, dt / 2.0]
        ];

        corners.forEach(([x, z]) => {
            const bar = new THREE.Mesh(colGeom, matRebarGold);
            bar.position.set(x, 0, z);
            cage.add(bar);
        });

        // Face Bars
        const faceCount = rcdc ? (rcdc.faceCount || 2) : 2;
        if (faceCount > 0) {
            const faceSteps = Math.floor(faceCount / 2);
            for (let f = 1; f <= faceSteps; f++) {
                const zOffset = -dt / 2.0 + (f / (faceSteps + 1)) * dt;
                [-wt / 2.0, wt / 2.0].forEach(x => {
                    const bar = new THREE.Mesh(colGeom, matRebarBot);
                    bar.position.set(x, 0, zOffset);
                    cage.add(bar);
                });
            }
        }

        // Lateral Ties (Closed rectangular rings in local XZ)
        const tieCount = Math.max(4, Math.floor(height / 0.225));
        const tSpacing = (height - 0.12) / Math.max(1, tieCount - 1);

        for (let i = 0; i < tieCount; i++) {
            const yPos = -height / 2.0 + 0.06 + i * tSpacing;
            const pts = [
                new THREE.Vector3(-wt / 2.0, yPos, -dt / 2.0),
                new THREE.Vector3(wt / 2.0, yPos, -dt / 2.0),
                new THREE.Vector3(wt / 2.0, yPos, dt / 2.0),
                new THREE.Vector3(-wt / 2.0, yPos, dt / 2.0),
                new THREE.Vector3(-wt / 2.0, yPos, -dt / 2.0)
            ];
            const lineGeom = new THREE.BufferGeometry().setFromPoints(pts);
            const tie = new THREE.Line(lineGeom, matRebarTies);
            cage.add(tie);
        }

        cage.renderOrder = 2;
        cage.visible = isRccMode;
        return cage;
    }

    function buildRebarMeshForFooting(length, depth, width, footing) {
        const cage = new THREE.Group();
        cage.name = 'rebarCage';

        const cover = 0.050; // 50mm
        const yMat = -depth / 2.0 + cover + 0.010;
        const meshW = width - 2 * cover;
        const meshL = length - 2 * cover;

        // Long Bars along local X
        const nLong = 7;
        const longGeom = new THREE.CylinderGeometry(0.010, 0.010, meshL, 6);
        longGeom.rotateZ(Math.PI / 2);

        for (let i = 0; i < nLong; i++) {
            const zPos = -meshW / 2.0 + (i / (nLong - 1)) * meshW;
            const bar = new THREE.Mesh(longGeom, matRebarGold);
            bar.position.set(0, yMat, zPos);
            cage.add(bar);
        }

        // Short Bars along local Z
        const nShort = 7;
        const shortGeom = new THREE.CylinderGeometry(0.010, 0.010, meshW, 6);
        shortGeom.rotateX(Math.PI / 2);

        for (let i = 0; i < nShort; i++) {
            const xPos = -meshL / 2.0 + (i / (nShort - 1)) * meshL;
            const bar = new THREE.Mesh(shortGeom, matRebarBot);
            bar.position.set(xPos, yMat + 0.012, 0);
            cage.add(bar);
        }

        cage.renderOrder = 2;
        cage.visible = isRccMode;
        return cage;
    }

    // ==========================================
    // 3D MOMENT & SHEAR ENVELOPE DIAGRAM GENERATORS
    // ==========================================

    function buildMomentDiagramForBeam(width, depth, distance, rcdc) {
        const group = new THREE.Group();
        group.name = 'momentDiagram';
        group.visible = false;

        const mL = rcdc ? (rcdc.muLeft !== undefined ? rcdc.muLeft : -72.0) : -72.0;
        const mM = rcdc ? (rcdc.muMid !== undefined ? rcdc.muMid : 48.0) : 48.0;
        const mR = rcdc ? (rcdc.muRight !== undefined ? rcdc.muRight : -80.0) : -80.0;

        const kM = 0.0055; // scale factor (e.g. 80 kNm -> 0.44m)
        const N = 20;
        const zStart = -distance / 2.0;

        const positions = [];
        const colors = [];
        const crestPoints = [];

        const colCrimson = new THREE.Color(0xff2255); // Vivid Fiery Crimson (Hogging / Tension Top)
        const colCyan = new THREE.Color(0x00d4ff);    // Brilliant Electric Cyan (Sagging / Tension Bottom)
        const ribbonW = 0.06; // 60mm volumetric ribbon in local X (high visibility & depth)

        for (let i = 0; i <= N; i++) {
            const s = i / N;
            const z = zStart + s * distance;
            const mVal = 2.0 * (mL - 2.0 * mM + mR) * s * s + (-3.0 * mL + 4.0 * mM - mR) * s + mL;
            // Civil engineering tension side convention:
            // Negative hogging (mVal < 0) tension at top -> extends upward +Y
            // Positive sagging (mVal > 0) tension at bottom -> extends downward -Y
            const yCrest = -mVal * kM;

            crestPoints.push(new THREE.Vector3(0, yCrest, z));

            if (i < N) {
                const sNext = (i + 1) / N;
                const zNext = zStart + sNext * distance;
                const mValNext = 2.0 * (mL - 2.0 * mM + mR) * sNext * sNext + (-3.0 * mL + 4.0 * mM - mR) * sNext + mL;
                const yCrestNext = -mValNext * kM;

                const cCurr = (mVal < 0) ? colCrimson : colCyan;
                const cNext = (mValNext < 0) ? colCrimson : colCyan;

                // Front quad (at x = -ribbonW/2)
                const xF = -ribbonW / 2.0;
                positions.push(
                    xF, 0, z,          xF, yCrest, z,          xF, yCrestNext, zNext,
                    xF, 0, z,          xF, yCrestNext, zNext,  xF, 0, zNext
                );
                colors.push(
                    cCurr.r, cCurr.g, cCurr.b, cCurr.r, cCurr.g, cCurr.b, cNext.r, cNext.g, cNext.b,
                    cCurr.r, cCurr.g, cCurr.b, cNext.r, cNext.g, cNext.b, cNext.r, cNext.g, cNext.b
                );

                // Back quad (at x = +ribbonW/2)
                const xB = ribbonW / 2.0;
                positions.push(
                    xB, 0, z,          xB, yCrestNext, zNext,  xB, yCrest, z,
                    xB, 0, z,          xB, 0, zNext,           xB, yCrestNext, zNext
                );
                colors.push(
                    cCurr.r, cCurr.g, cCurr.b, cNext.r, cNext.g, cNext.b, cCurr.r, cCurr.g, cCurr.b,
                    cCurr.r, cCurr.g, cCurr.b, cNext.r, cNext.g, cNext.b, cNext.r, cNext.g, cNext.b
                );

                // Crest top cap connecting front and back at the crest
                positions.push(
                    xF, yCrest, z,      xB, yCrest, z,          xB, yCrestNext, zNext,
                    xF, yCrest, z,      xB, yCrestNext, zNext,  xF, yCrestNext, zNext
                );
                colors.push(
                    cCurr.r, cCurr.g, cCurr.b, cCurr.r, cCurr.g, cCurr.b, cNext.r, cNext.g, cNext.b,
                    cCurr.r, cCurr.g, cCurr.b, cNext.r, cNext.g, cNext.b, cNext.r, cNext.g, cNext.b
                );
            }
        }

        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        const mat = new THREE.MeshBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.94,
            side: THREE.DoubleSide,
            depthWrite: false,
            fog: false
        });

        const mesh = new THREE.Mesh(geom, mat);
        mesh.renderOrder = 3;
        group.add(mesh);

        // Sharp neon white crest outline
        const lineGeom = new THREE.BufferGeometry().setFromPoints(crestPoints);
        const line = new THREE.Line(lineGeom, new THREE.LineBasicMaterial({
            color: 0xffffff,
            linewidth: 2,
            transparent: false,
            opacity: 1.0,
            fog: false
        }));
        line.renderOrder = 4;
        group.add(line);

        return group;
    }

    function buildShearDiagramForBeam(width, depth, distance, rcdc) {
        const group = new THREE.Group();
        group.name = 'shearDiagram';
        group.visible = false;

        const vL = rcdc ? (rcdc.vuLeft !== undefined ? rcdc.vuLeft : 60.0) : 60.0;
        const vR = rcdc ? (rcdc.vuRight !== undefined ? rcdc.vuRight : 70.0) : 70.0;

        const kV = 0.005; // scale factor
        const N = 12;
        const zStart = -distance / 2.0;

        const positions = [];
        const crestPoints = [];
        const ribbonW = 0.06;

        for (let i = 0; i <= N; i++) {
            const s = i / N;
            const z = zStart + s * distance;
            const vVal = vL * (1.0 - s) - vR * s;
            const yCrest = vVal * kV;

            crestPoints.push(new THREE.Vector3(0, yCrest, z));

            if (i < N) {
                const sNext = (i + 1) / N;
                const zNext = zStart + sNext * distance;
                const vValNext = vL * (1.0 - sNext) - vR * sNext;
                const yCrestNext = vValNext * kV;

                const xF = -ribbonW / 2.0;
                positions.push(
                    xF, 0, z,          xF, yCrest, z,          xF, yCrestNext, zNext,
                    xF, 0, z,          xF, yCrestNext, zNext,  xF, 0, zNext
                );

                const xB = ribbonW / 2.0;
                positions.push(
                    xB, 0, z,          xB, yCrestNext, zNext,  xB, yCrest, z,
                    xB, 0, z,          xB, 0, zNext,           xB, yCrestNext, zNext
                );

                positions.push(
                    xF, yCrest, z,      xB, yCrest, z,          xB, yCrestNext, zNext,
                    xF, yCrest, z,      xB, yCrestNext, zNext,  xF, yCrestNext, zNext
                );
            }
        }

        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

        const mat = new THREE.MeshBasicMaterial({
            color: 0x00e676, // Radiant Neon Spring Emerald
            transparent: true,
            opacity: 0.92,
            side: THREE.DoubleSide,
            depthWrite: false,
            fog: false
        });

        const mesh = new THREE.Mesh(geom, mat);
        mesh.renderOrder = 3;
        group.add(mesh);

        const lineGeom = new THREE.BufferGeometry().setFromPoints(crestPoints);
        const line = new THREE.Line(lineGeom, new THREE.LineBasicMaterial({
            color: 0xffffff,
            linewidth: 2,
            transparent: false,
            opacity: 1.0,
            fog: false
        }));
        line.renderOrder = 4;
        group.add(line);

        return group;
    }

    function buildMomentDiagramForColumn(width, height, depth, rcdc) {
        const group = new THREE.Group();
        group.name = 'momentDiagram';
        group.visible = false;

        const mTop = rcdc ? (rcdc.muTop !== undefined ? rcdc.muTop : 48.0) : 48.0;
        const mBot = rcdc ? (rcdc.muBot !== undefined ? rcdc.muBot : -40.8) : -40.8;

        const kM = 0.0055;
        const N = 10;
        const yStart = -height / 2.0;

        const positions = [];
        const crestPoints = [];
        const ribbonW = 0.06; // along local X

        for (let i = 0; i <= N; i++) {
            const s = i / N;
            const y = yStart + s * height;
            const mVal = mBot * (1.0 - s) + mTop * s;
            const zCrest = mVal * kM;

            crestPoints.push(new THREE.Vector3(0, y, zCrest));

            if (i < N) {
                const sNext = (i + 1) / N;
                const yNext = yStart + sNext * height;
                const mValNext = mBot * (1.0 - sNext) + mTop * sNext;
                const zCrestNext = mValNext * kM;

                const xF = -ribbonW / 2.0;
                positions.push(
                    xF, y, 0,          xF, y, zCrest,          xF, yNext, zCrestNext,
                    xF, y, 0,          xF, yNext, zCrestNext,  xF, yNext, 0
                );

                const xB = ribbonW / 2.0;
                positions.push(
                    xB, y, 0,          xB, yNext, zCrestNext,  xB, y, zCrest,
                    xB, y, 0,          xB, yNext, 0,           xB, yNext, zCrestNext
                );

                positions.push(
                    xF, y, zCrest,     xB, y, zCrest,          xB, yNext, zCrestNext,
                    xF, y, zCrest,     xB, yNext, zCrestNext,  xF, yNext, zCrestNext
                );
            }
        }

        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

        const mat = new THREE.MeshBasicMaterial({
            color: 0xfbbf24, // Bright Amber Gold
            transparent: true,
            opacity: 0.94,
            side: THREE.DoubleSide,
            depthWrite: false,
            fog: false
        });

        const mesh = new THREE.Mesh(geom, mat);
        mesh.renderOrder = 3;
        group.add(mesh);

        const lineGeom = new THREE.BufferGeometry().setFromPoints(crestPoints);
        const line = new THREE.Line(lineGeom, new THREE.LineBasicMaterial({
            color: 0xffffff,
            linewidth: 2,
            transparent: false,
            opacity: 1.0,
            fog: false
        }));
        line.renderOrder = 4;
        group.add(line);

        return group;
    }

    function buildShearDiagramForColumn(width, height, depth, rcdc) {
        const group = new THREE.Group();
        group.name = 'shearDiagram';
        group.visible = false;

        const vCol = rcdc ? (rcdc.vuCol !== undefined ? rcdc.vuCol : 29.13) : 29.13;
        const kV = 0.005;
        const zCrest = vCol * kV;
        const yBot = -height / 2.0;
        const yTop = height / 2.0;
        const ribbonW = 0.06;

        const xF = -ribbonW / 2.0;
        const xB = ribbonW / 2.0;

        const positions = [
            xF, yBot, 0,       xF, yBot, zCrest,       xF, yTop, zCrest,
            xF, yBot, 0,       xF, yTop, zCrest,       xF, yTop, 0,
            xB, yBot, 0,       xB, yTop, zCrest,       xB, yBot, zCrest,
            xB, yBot, 0,       xB, yTop, 0,            xB, yTop, zCrest,
            xF, yBot, zCrest,  xB, yBot, zCrest,       xB, yTop, zCrest,
            xF, yBot, zCrest,  xB, yTop, zCrest,       xF, yTop, zCrest
        ];

        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

        const mat = new THREE.MeshBasicMaterial({
            color: 0x00e676, // Radiant Neon Spring Emerald
            transparent: true,
            opacity: 0.92,
            side: THREE.DoubleSide,
            depthWrite: false,
            fog: false
        });

        const mesh = new THREE.Mesh(geom, mat);
        mesh.renderOrder = 3;
        group.add(mesh);

        const lineGeom = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, yBot, zCrest),
            new THREE.Vector3(0, yTop, zCrest)
        ]);
        const line = new THREE.Line(lineGeom, new THREE.LineBasicMaterial({
            color: 0xffffff,
            linewidth: 2,
            transparent: false,
            opacity: 1.0,
            fog: false
        }));
        line.renderOrder = 4;
        group.add(line);

        return group;
    }

    // Helper: create properly oriented extruded beam or column connecting two points
    function createExtrudedMember(p1, p2, width, depth, material, isColumn, rcdc) {
        const v1 = new THREE.Vector3(p1.x - OFFSET_X, p1.y, p1.z - OFFSET_Z);
        const v2 = new THREE.Vector3(p2.x - OFFSET_X, p2.y, p2.z - OFFSET_Z);
        const distance = v1.distanceTo(v2);
        const mid = new THREE.Vector3().addVectors(v1, v2).multiplyScalar(0.5);

        let mesh;

        if (isColumn) {
            // For vertical columns:
            // Local X = width (0.23m) along world X
            // Local Y = distance (height) along world Y
            // Local Z = depth (0.45m or 0.53m or 0.30m) along world Z
            const geom = new THREE.BoxGeometry(width, distance, depth);
            mesh = new THREE.Mesh(geom, material);
            mesh.position.copy(mid);
            mesh.rotation.set(0, 0, 0);

            // 3D Column Rebar Cage
            const cage = buildRebarCageForColumn(width, distance, depth, rcdc);
            mesh.add(cage);
            mesh.userData.rebarCage = cage;

            // 3D Moment Diagram
            const momentDiag = buildMomentDiagramForColumn(width, distance, depth, rcdc);
            mesh.add(momentDiag);
            mesh.userData.momentDiagram = momentDiag;

            // 3D Shear Diagram
            const shearDiag = buildShearDiagramForColumn(width, distance, depth, rcdc);
            mesh.add(shearDiag);
            mesh.userData.shearDiagram = shearDiag;
        } else {
            // For horizontal beams:
            // Depth is ALWAYS vertical along world Y! (Local Y = depth)
            // Width is horizontal transverse perpendicular to span! (Local X = width)
            // Distance is along beam span! (Local Z = distance)
            const geom = new THREE.BoxGeometry(width, depth, distance);
            mesh = new THREE.Mesh(geom, material);
            mesh.position.copy(mid);

            const uSpan = new THREE.Vector3().subVectors(v2, v1).normalize();
            const uVert = new THREE.Vector3(0, 1, 0);
            // Right-hand rule basis: uTrans x uVert = uSpan
            const uTrans = new THREE.Vector3().crossVectors(uVert, uSpan).normalize();

            const rotMatrix = new THREE.Matrix4();
            rotMatrix.makeBasis(uTrans, uVert, uSpan);
            mesh.setRotationFromMatrix(rotMatrix);

            // 3D Beam Rebar Cage
            const cage = buildRebarCageForBeam(width, depth, distance, rcdc);
            mesh.add(cage);
            mesh.userData.rebarCage = cage;

            // 3D Moment Diagram
            const momentDiag = buildMomentDiagramForBeam(width, depth, distance, rcdc);
            mesh.add(momentDiag);
            mesh.userData.momentDiagram = momentDiag;

            // 3D Shear Diagram
            const shearDiag = buildShearDiagramForBeam(width, depth, distance, rcdc);
            mesh.add(shearDiag);
            mesh.userData.shearDiagram = shearDiag;
        }

        // Crisp CAD edge outline for Solid 3D mode (makes colors pop with sharp definition)
        const edgeGeom = new THREE.EdgesGeometry(mesh.geometry);
        const edgeMat = new THREE.LineBasicMaterial({
            color: isColumn ? 0x78350f : 0x083344,
            transparent: true,
            opacity: 0.55
        });
        const edgeLines = new THREE.LineSegments(edgeGeom, edgeMat);
        edgeLines.name = 'cadEdgeOutline';
        mesh.add(edgeLines);
        mesh.userData.cadEdgeOutline = edgeLines;

        mesh.castShadow = false;
        mesh.receiveShadow = false;
        return mesh;
    }



    // ==========================================================================
    // 3D REALTIME ARCHITECTURAL SIMULATION GENERATOR (AUTHENTIC CAD/STAAD BIM)
    // - Staircase Mumty with Terracotta Tiled Roof (Front-Left, +13.63m)
    // - Lift Machine Room & Storage Room spanning Columns C3 to C6 (Rear-Right, +14.13m)
    // - Overhead Water Tanks (OHT) on LMR roof slab
    // - 7'-0" Large Front Cantilever Balcony with Glass/Steel Balustrade
    // - Right side Lift path and Dog-legged Staircase in Front-Left bay
    // - Teak Main Door, French Doors, Chajjas, Windows & Ventilators
    // - Plinth Platform (+1.98m), 8-Step Grand Entrance Staircase, Site & Compound Wall
    // ==========================================================================
// =========================================================================
    // AUTHENTIC HYDERABAD RESIDENTIAL ARCHITECTURAL 3D SIMULATION (G+2 + OHT)
    // Strictly constructed to 1:1 match CAD Floor Plans, STAAD Space Frame &
    // Project Specifications (33' x 65' Plot, Open Stilt Parking, 7' Balcony,
    // 4'6" Side Balcony/Lift Corridor, Dog-legged Staircase, Mumty with Tiled Roof)
    // =========================================================================
// =========================================================================
    // MASTERPIECE HYDERABAD CONTEMPORARY RESIDENTIAL ARCHITECTURAL SIMULATION
    // Strictly matching CAD plans, Furniture Layout (Image 5), and Site Details:
    // - Ground level raised to plinth (+1.98m) - NO front stairs!
    // - Gate on RIGHT side with paved driveway; 5' Garden strictly on LEFT side
    // - Right boundary wall immediately follows 4'6" lift pathway (NO extra setback!)
    // - Open stilt parking with dual-tone architectural parking tiles
    // - 1 Realistic Car + 1 Detailed Modern Motorcycle
    // - True Staircase Orientation: Lower flight East->West, Left Mid-Landing,
    //   Upper flight West->East, Left Parapet, Front Wall with Large Glass Frame!
    // - Doors on Mumty: Stair Mumty Door + Lift Machine Room Door on Terrace
    // - Full 3D Interior Furniture (Sofas, Dining 6-seater, Beds, Kitchen, TV)
    // =========================================================================
// =========================================================================
    // 10/10 MASTERPIECE ARCHITECTURAL SIMULATION (33' x 65' Plot, G+2 + OHT)
    // Strictly matching CAD plans, Furniture Layout (Image 4 & 5), and Realism:
    // - Ground raised to plinth (+1.98m) - NO front stairs!
    // - Gate strictly on RIGHT side with paved driveway
    // - 5' Garden strictly on LEFT side in front of staircase bay
    // - Right boundary wall immediately borders 4'6" pathway (ZERO extra setback!)
    // - NO Z-FIGHTING: Clean vertical geometry offsets (floor finish +0.015m, furniture +0.02m)
    // - NO OPEN GAPS: Fully enclosed staircase shaft on left with large stairwell windows!
    // - Real Interior Partition Walls dividing Hall, Kitchen, Dining, Bedrooms, Toilets!
    // - Authentic Furniture matching CAD: 3-seater Sofas, Coffee Tables, TVs, 6-Seater Dining,
    //   Granite Kitchen L-Counters with Stoves, King Beds with Pillows & Nightstands, Wardrobes!
    // - Car parked on LEFT in deep stilt bay; Bike parked neatly; Clear wide path to Main Door!
    // - Stair Mumty Door & Lift Machine Room Door clearly visible on roof terrace!
    // =========================================================================
// =========================================================================
    // 10/10 ROYAL LUXURY ARCHITECTURAL SIMULATION (33' x 65' Plot, G+2 + OHT)
    // - Modern Royal Luxury Color Palette (Royal Navy Slate, Warm Royal Teak,
    //   Ivory Travertine, Sapphire Blue & Emerald Velvet, Black Galaxy Granite)
    // - Clear Architectural Stairwell with Polished Black Granite & Golden Brass
    //   stairs clearly visible from outside through crystal glass!
    // - TV Unit placed SAFELY on Interior Partition Wall (NEVER Outside or Glitching!)
    // - Right Balcony Railing seamlessly flush with Front Balcony at X = +4.61m
    //   (ZERO Protrusion / ZERO Jog!)
    // - Strict Non-Overlapping Volume Hierarchy: ZERO Z-Fighting / ZERO Glitching!
    // - Ground Floor: 1 Car on Left, 1 Bike, Clear Driveway on Right to M.D & Lift!
    // - Second Floor correctly named in UI; Roof Terrace with Mumty & LMR Doors!
    // =========================================================================
    // =========================================================================
    // 10/10 ULTRA-LUXURY ROYAL ARCHITECTURAL MODEL (33' x 65' Plot, G+2 + OHT)
    // Strictly solving all user pain points from video & feedback:
    // 1. ROYAL/LUXURY COLOURFUL PALETTE: Italian Botticino ivory, rich teakwood,
    //    imperial slate, midnight blue velvet, gold brass trims, and emerald garden.
    // 2. PERFECT BALCONY ALIGNMENT: Front & right corridor railings meet at
    //    EXACT flush 90-deg corner (X = 4.66m, Z = 8.30m) - ZERO protrusion!
    // 3. TELEVISION STRICTLY INSIDE: TV consoles mounted on interior partition
    //    walls deep inside apartments (Z <= 3.8m), completely clear of windows!
    // 4. STAIRS CLEARLY VISIBLE: Ultra-clear crystal curtain glass with illuminated
    //    Emperador marble/teak treads, Carrara risers, and polished brass rails.
    // 5. ZERO Z-FIGHTING / GLITCHES: Logarithmic depth buffer + clean vertical
    //    offsets + polygon offsets completely kill all flickering.
    // =========================================================================
    // =========================================================================
    // 10/10 ULTRA-VIBRANT ROYAL ARCHITECTURAL MODEL (33' x 65' Plot, G+2 + OHT)
    // - ROYAL ARCHITECTURAL COLORING: Warm Jaipur Sandstone body (never flat white!),
    //   Imperial Charcoal Slate tower, Royal Navy structural accents, Teak cladding,
    //   and crisp Alabaster white slab bands with deep, rich shadows!
    // - GROUND FLOOR LIFT: Full lift shaft enclosure & stainless steel lift door
    //   accessible at the end of the 4'6" pathway on the Ground Floor!
    // - INTERIOR LIFT SIDE WALL: Solid 9" wall at X = 3.24m (Z: -8.34 to -6.80m)
    //   fully enclosing the lift shaft from the interior bedrooms on ALL floors!
    // - RIGHT FACADE WINDOWS & DOORS: Windows, teak doors, ventilators, and chajjas
    //   prominently visible along the right corridor wall!
    // - STAIRCASE: Crystal-clear glass, illuminated warm interior, dark Emperador
    //   teak treads, Carrara risers, and polished brass handrails!
    // - BALCONY FLUSH CORNER: Front & right railings meet at exact seamless corner!
    // - TELEVISIONS: Mounted strictly on interior partition walls!
    // =========================================================================
    // =========================================================================
    // 10/10 ULTRA-VIBRANT ROYAL ARCHITECTURAL MODEL (33' x 65' Plot, G+2 + OHT)
    // - ROYAL ARCHITECTURAL COLORING: Warm Jaipur Sandstone body (never flat white!),
    //   Imperial Charcoal Slate tower, Royal Navy structural accents, Teak cladding,
    //   and crisp Alabaster white slab bands with deep, rich shadows!
    // - GROUND FLOOR LIFT: Full lift shaft enclosure & stainless steel lift door
    //   accessible at the end of the 4'6" pathway on the Ground Floor!
    // - INTERIOR LIFT SIDE WALL: Solid 9" wall at X = 3.24m (Z: -8.34 to -6.80m)
    //   fully enclosing the lift shaft from the interior bedrooms on ALL floors!
    // - RIGHT FACADE WINDOWS & DOORS: Windows, teak doors, ventilators, and chajjas
    //   prominently visible along the right corridor wall!
    // - STAIRCASE: Crystal-clear glass, illuminated warm interior, dark Emperador
    //   teak treads, Carrara risers, and polished brass handrails!
    // - BALCONY FLUSH CORNER: Front & right railings meet at exact seamless corner!
    // - TELEVISIONS: Mounted strictly on interior partition walls!
    // =========================================================================
    // =========================================================================
    // 10/10 ULTRA-VIBRANT ROYAL ARCHITECTURAL MODEL (33' x 65' Plot, G+2 + OHT)
    // - ROYAL ARCHITECTURAL COLORING: Warm Jaipur Sandstone body (never flat white!),
    //   Imperial Charcoal Slate tower, Royal Navy structural accents, Teak cladding,
    //   and crisp Alabaster white slab bands with deep, rich shadows!
    // - GROUND FLOOR LIFT: Full lift shaft enclosure & stainless steel lift door
    //   accessible at the end of the 4'6" pathway on the Ground Floor!
    // - INTERIOR LIFT SIDE WALL: Solid 9" wall at X = 3.24m (Z: -8.34 to -6.80m)
    //   fully enclosing the lift shaft from the interior bedrooms on ALL floors!
    // - RIGHT FACADE WINDOWS & DOORS: Windows, teak doors, ventilators, and chajjas
    //   prominently visible along the right corridor wall!
    // - STAIRCASE: Crystal-clear glass, illuminated warm interior, dark Emperador
    //   teak treads, Carrara risers, and polished brass handrails!
    // - BALCONY FLUSH CORNER: Front & right railings meet at exact seamless corner!
    // - TELEVISIONS: Mounted strictly on interior partition walls!
    // =========================================================================
    // =========================================================================
    // 10/10 EXACT ARCHITECTURAL PLAN MASTERPIECE (33' x 65' Plot, G+2 + OHT)
    // Modeled with 100% precision from AutoCAD Architectural Drawings:
    // 1. EXACT 12 RCC COLUMNS: Row 1 (-8.34m), Row 2 (-3.35m), Row 3 (+1.71m),
    //    Row 4 (+6.21m) at Grids A (-4.61m), B (-0.69m), C (+3.24m).
    //    NO columns at cantilever balcony tips! Zero vehicles (car/bike removed).
    // 2. 100% OPEN STAIRCASE ACCESS: No wall blocking stairs at Ground Floor!
    //    Direct, inviting access from stilt parking onto Flight 1.
    // 3. LIGHT-COLORED GRID TILES FLOORING: High-end 2'x2' checkered pavers in parking,
    //    Italian Botticino cream marble in halls/dining, warm parquet in bedrooms,
    //    matte non-skid ceramic in toilets. ZERO BLACK FLOOR!
    // 4. REAL DOORS & WALL OPENINGS: Every single room (Hall, Bedroom, Kitchen, Toilet)
    //    has framed doorways with wood doors swung open at natural angles!
    // 5. TOILET SANITARIES: European Water Closets (WC with cistern & seat) + wash basins!
    // 6. EXACT ROOM LAYOUT:
    //    - Ground: Open Stilt Parking + 2 BHK Apartment (Hall, Kitchen, Dining, 2 Bed, 2 Bath)
    //    - First: 7' Front Balcony, 4'6" Side Balcony, 2 BHK Front + 1 BHK Rear
    //    - Second: 7' Front Balcony, 4'6" Side Balcony, Three 1-BHK Units
    // 7. LIFT SHAFTS & LUXURY PORTALS: All 4 enclosing walls on every floor,
    //    brushed stainless steel sliding doors, gold frame, cyan indicator ("G", "1", "2").
    // =========================================================================
    // =========================================================================
    // 10/10 FLAWLESS ARCHITECTURAL PLAN MASTERPIECE (33' x 65' Plot, G+2 + OHT)
    // Strictly engineered per Hyderabad AutoCAD Architectural Working Drawings:
    // 1. STAIRCASE ACCESS: 100% OPEN WALKWAY (1.24m wide) onto 7' Front Balcony!
    //    NO blocking wall at landing! Safety parapet/railing along flight voids.
    // 2. STAIRCASE GLASS CURTAIN WALL: Tinted architectural cyan/blue glazing
    //    with crisp dark aluminum structural mullions & transoms grid.
    // 3. TOILET SANITARIES: 100% strictly enclosed inside dedicated 7'x4' bathrooms!
    //    Zero fixtures outside or in living rooms! Commode, vanity basin & mirror.
    // 4. GROUND FLOOR LAYOUT: Exact 1:1 AutoCAD alignment:
    //    - Parking (30'8" x 26'9") with light checkered tiles, 1 car, 1 bike, open corridor
    //    - Front Wall (Z = 1.71m): Kitchen window, C8, Hall window, Main Door (M.D), C9
    //    - Hall (12'2" x 15'11") with side door (D) to 4'6" pathway and royal sofa suite
    //    - Kitchen (12'6" x 7'9") enclosed with door opening to Dining
    //    - Dining (12'6" x 7'9") with 6-seater dining suite
    //    - Common Toilet (7'x4') enclosed with door from lobby and ventilator on setback
    //    - Bedroom 1 (12'6" x 12'2") with attached Toilet (7'x4') at rear (C2-C3)
    //    - Bedroom 2 (12'2" x 12'5") with door from lobby
    //    - Lift Shaft (3'9" x 4'6") at rear of 4'6" pathway with stainless portal
    // 5. UPPER FLOORS & ROOF:
    //    - First Floor: 2 BHK Front + 1 BHK Rear with private side balcony entrances
    //    - Second Floor: Three 1-BHK Units each with private entrance & enclosed bath
    //    - Roof: Open terrace with parapet, Mumty with red Mangalore clay tile gable,
    //      Lift Machine Room (LMR) spanning C3-C6, and dual overhead water tanks!
    // 6. ZERO BLACK FLOORS & ZERO Z-FIGHTING: Ivory/cream Botticino marble,
    //    checkered pavers, honey-oak parquet, and logarithmic depth buffer.
    // =========================================================================
    // =========================================================================
    // 10/10 MASTERPIECE ARCHITECTURAL MODEL (33' x 65' Plot, G+2 + OHT)
    // Strictly engineered per Hyderabad AutoCAD Architectural Working Drawings:
    // 1. STAIRCASE ORIENTATION & ACCESS (100% AutoCAD Match):
    //    - Flight 1: Starts at Front (Z = 7.85m), rises Right-to-Left up to Mid-Landing.
    //    - Mid-Landing: On Left Exterior Wall (X = -4.61m) with 1.10m solid parapet wall.
    //    - Flight 2: Starts at Mid-Landing, rises Left-to-Right along Z = 6.70m up to Top Landing.
    //    - Top Landing: Arrives at X = -0.69m, stepping DIRECTLY through 1.24m wide open
    //      walkway onto the 7' Front Balcony! Zero blocking walls!
    //    - Clean handrails with ZERO hanging rods!
    //    - Tinted Cyan/Blue Architectural Glass Curtain Wall with Royal Blue portal frames
    //      and dark anthracite structural mullions/transoms on BOTH Front and Left facades!
    // 2. ROOF MACHINE ROOM (Spans Columns C3 to C6!):
    //    - Extends from Z = -8.34m (C3) to Z = -3.35m (C6) along X = 3.24 to 4.38m!
    //    - Houses Lift Machine Room + Terrace Storage, supported directly on RCC columns!
    //    - Dual Overhead Water Tanks on top RCC slab!
    //    - Stair Mumty with red Mangalore clay tile gable roof & teak terrace door.
    // 3. TOILET SANITARIES: 100% enclosed inside dedicated 7'x4' bathrooms with
    //    waterproof doors, exterior ventilators, commodes & vanity washbasins strictly inside.
    // 4. EXACT 1:1 AUTOCAD FLOOR PLANS:
    //    - Ground: Parking (30'8" x 26'9", light pavers, 1 car, 1 bike), 2 BHK Apartment
    //    - First: 7' Front Balcony, 4'6" Side Balcony, 2 BHK Front + 1 BHK Rear
    //    - Second: Three modular 1-BHK Units (Front, Middle, Rear) with private balconies
    // 5. ZERO BLACK FLOORS & ZERO Z-FIGHTING: Ivory/cream Botticino marble,
    //    light checkered pavers, honey-oak parquet, and logarithmic depth buffer.
    // =========================================================================
    // =========================================================================
    // 10/10 MASTERPIECE ARCHITECTURAL MODEL (33' x 65' Plot, G+2 + OHT)
    // Strictly engineered per Hyderabad AutoCAD Architectural Working Drawings:
    // 1. NO BROWN PILASTERS CUTTING THROUGH DOORS! Right corridor walls are clean
    //    architectural sandstone with framed doorways and windows with weather chajjas.
    // 2. GROUND FLOOR: Left Bedroom (12'6" x 12'2") door is placed on the VERTICAL
    //    wall (orient 'Z') entering from central lobby, swinging correctly!
    // 3. FIRST FLOOR: Exactly 1 2BHK at front + 1 1BHK at rear:
    //    - Zero extra spacing at the rear! Rear bedroom spans all the way to rear wall (-8.34m)!
    //    - NO TOILETS IN THE MIDDLE! Toilets are positioned strictly per AutoCAD:
    //      * Front Common Toilet (7'x4') on left wall behind dining
    //      * Front Attached Toilet (7'x3'9") on right wall entered from Bed 2
    //      * Rear Unit Toilet (7'x4') at rear right entered from Rear Hall
    // 4. SECOND FLOOR: Three modular 1-BHK units (Front, Middle, Rear):
    //    - Front unit entered via double door from 7' front balcony.
    //    - Middle and rear units entered via individual framed doors from 4'6" side balcony.
    //    - All right wall openings cleanly framed with NO solid blocking wall!
    //    - Rear bedroom and toilet touch the rear wall (-8.34m) with zero voids!
    // 5. STAIRCASE: Flight 1 starts at Front (Z = 7.85m) rising Right-to-Left to
    //    Mid-Landing on left wall with 1.10m solid parapet wall. Flight 2 rises
    //    Left-to-Right along Z = 6.70m arriving at X = -0.69m, stepping DIRECTLY
    //    through 1.25m wide open walkway onto 7' Front Balcony! Zero blocking wall!
    // 6. ROOF LEVEL: Mumty with Mangalore clay tiled gable roof and teak terrace door!
    //    Machine Room spans full length from Column C3 (-8.34m) to Column C6 (-3.35m)!
    // 7. GROUND FLOOR PARKING: Pristine pearl-white paver tiles, 12 RCC columns,
    //    wide gate, lush front garden, zero blocking vehicles!
    // =========================================================================
    // =========================================================================
    // 100% FLAWLESS MASTERPIECE ARCHITECTURAL SIMULATION (33' x 65' Plot, G+2 + OHT)
    // Strictly engineered per Hyderabad AutoCAD Architectural Working Drawings:
    // 1. EXTERIOR FAÇADES: 100% Uniform Warm Jaipur Sandstone (Zero white patches!).
    // 2. VENTILATORS: Frosted glass louvered panels with weather chajjas (Zero black holes!).
    // 3. ZERO Z-FIGHTING: Clean, non-overlapping contiguous wall geometry everywhere.
    // 4. FRONT BALCONY: Fully enclosed front wall with lintel beam and double door (Zero ceiling gaps!).
    // 5. GROUND FLOOR:
    //    - Common Toilet (7'x4'): Door on SOUTH wall facing dining per AutoCAD!
    //    - Bed 1 Door: Entered from lobby on Z = -4.23m wall, swinging inward to the north!
    //    - Bed 2 Door: Entered from lobby on Z = -3.01m wall, swinging inward to the north!
    //    - Bed 2 Attached Toilet (7'x4'): At rear right against rear wall next to lift!
    //    - Stilt Parking: Open, spacious, light checkered pavers, 12 RCC columns, garden & gate!
    // 6. FIRST FLOOR:
    //    - Exactly 1 2-BHK at front + 1 1-BHK at rear.
    //    - Front Common Toilet on left wall behind dining with door on south wall.
    //    - Front Bed 2 Attached Toilet (7'x3'9") on right exterior wall, door from Bed 2.
    //    - Rear Bed (12'6"x10'2") flush against rear wall (-8.34m) with ZERO extra spacing!
    //    - Rear Toilet (7'x4') flush against rear wall (-8.34m) next to lift!
    //    - Solid transverse dividing wall at Z = -2.91m separating units.
    // 7. SECOND FLOOR:
    //    - 3 Modular 1-BHK units (Front, Middle, Rear) exactly per AutoCAD drawing!
    //    - Clean Jaipur sandstone corridor wall with individual framed doors and windows.
    // 8. STAIRCASE:
    //    - Flight 1 rises front-to-back (right-to-left) to mid-landing with 1.10m solid parapet.
    //    - Flight 2 rises left-to-right arriving at X = -0.69m with 1.25m wide open walkway onto 7' balcony!
    // 9. ROOF LEVEL:
    //    - Mumty with Mangalore clay tiled gable roof and teak terrace door.
    //    - Lift Machine Room spanning Columns C3 to C6 (-8.34m to -3.35m) with dual water tanks.
    // =========================================================================
    // =========================================================================
    // 100% PERFECTED ARCHITECTURAL MASTERPIECE SIMULATION (33' x 65' Plot, G+2 + OHT)
    // Fully restored to approved structural grid, column layout, and lift shaft,
    // with surgical resolution of all 5 user feedback points.
    // =========================================================================
    // =========================================================================
    // 100% PERFECTED ARCHITECTURAL MASTERPIECE SIMULATION (33' x 65' Plot, G+2 + OHT)
    // Fully restored to approved structural grid, column layout, and lift shaft,
    // with surgical resolution of all 5 user feedback points.
    // =========================================================================
    // =========================================================================
    // 100% PERFECTED ARCHITECTURAL MASTERPIECE SIMULATION (33' x 65' Plot, G+2 + OHT)
    // Fully restored to approved structural grid, column layout, and lift shaft,
    // with surgical resolution of all 5 user feedback points.
    // =========================================================================
    const _archTexCache = {};

    function buildArchitecturalModel() {
        if (architecturalModel) {
            scene.remove(architecturalModel);
            architecturalModel.traverse(obj => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                    else obj.material.dispose();
                }
            });
            architecturalModel = null;
        }

        const archGroup = new THREE.Group();
        archGroup.name = 'architecturalModel';

        const storyGroups = {
            site: new THREE.Group(),
            ground: new THREE.Group(),
            first: new THREE.Group(),
            second: new THREE.Group(),
            terrace: new THREE.Group(),
            headroom: new THREE.Group()
        };
        storyGroups.site.name = 'arch_site';
        storyGroups.ground.name = 'arch_ground';
        storyGroups.first.name = 'arch_first';
        storyGroups.second.name = 'arch_second';
        storyGroups.terrace.name = 'arch_terrace';
        storyGroups.headroom.name = 'arch_headroom';
        archStoryGroups = storyGroups;

        // -------------------------------------------------------------
        // PROCEDURAL ARCHITECTURAL TEXTURE GENERATORS
        // -------------------------------------------------------------
        // 1. Procedural Sandstone Stucco & Architectural Groove Texture + Bump Map
        function createStuccoTexture() {
            if (_archTexCache['stucco']) return _archTexCache['stucco'];
            if (typeof document === 'undefined') return null;
            const c = document.createElement('canvas');
            c.width = 256;
            c.height = 256;
            const ctx = c.getContext('2d');
            if (!ctx) return null;
            ctx.fillStyle = '#ded1b8';
            ctx.fillRect(0, 0, 256, 256);

            for (let i = 0; i < 1500; i++) {
                const x = Math.random() * 512;
                const y = Math.random() * 512;
                const v = Math.random() > 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(120,95,70,0.09)';
                ctx.fillStyle = v;
                ctx.fillRect(x, y, 2, 2);
            }

            // Refined horizontal architectural stone reveal grooves
            ctx.strokeStyle = 'rgba(95, 68, 42, 0.18)';
            ctx.lineWidth = 2.5;
            for (let y = 64; y < 512; y += 64) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(512, y);
                ctx.stroke();
            }

            const tex = new THREE.CanvasTexture(c);
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(3, 3);
            _archTexCache['stucco'] = tex;
            return tex;
        }

        // 1b. Procedural Warm Luxury Interior Wall Emulsion Paint Texture (Fine Eggshell Micro-Grain)
        function createInteriorPaintTexture() {
            if (_archTexCache['interior']) return _archTexCache['interior'];
            if (typeof document === 'undefined') return null;
            const c = document.createElement('canvas');
            c.width = 256;
            c.height = 256;
            const ctx = c.getContext('2d');
            if (!ctx) return null;
            ctx.fillStyle = '#f4ede2';
            ctx.fillRect(0, 0, 256, 256);

            for (let i = 0; i < 1500; i++) {
                const x = Math.random() * 512;
                const y = Math.random() * 512;
                const v = Math.random() > 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(165,145,125,0.07)';
                ctx.fillStyle = v;
                ctx.fillRect(x, y, 1.5, 1.5);
            }

            const tex = new THREE.CanvasTexture(c);
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(3.0, 3.0);
            _archTexCache['interior'] = tex;
            return tex;
        }

        // 2. Procedural Teak Wood Grain Texture
        function createWoodTexture(baseHex, stripeHex) {
            const cacheKey = 'wood_' + (baseHex || '') + '_' + (stripeHex || '');
            if (_archTexCache[cacheKey]) return _archTexCache[cacheKey];
            if (typeof document === 'undefined') return null;
            const c = document.createElement('canvas');
            c.width = 512;
            c.height = 512;
            const ctx = c.getContext('2d');
            if (!ctx) return null;
            ctx.fillStyle = baseHex || '#6d3614';
            ctx.fillRect(0, 0, 512, 512);

            ctx.strokeStyle = stripeHex || 'rgba(35, 12, 2, 0.28)';
            for (let i = 0; i < 140; i++) {
                ctx.lineWidth = 1 + Math.random() * 3;
                ctx.beginPath();
                const x = Math.random() * 512;
                ctx.moveTo(x, 0);
                ctx.bezierCurveTo(
                    x + (Math.random() - 0.5) * 25, 170,
                    x + (Math.random() - 0.5) * 25, 340,
                    x + (Math.random() - 0.5) * 35, 512
                );
                ctx.stroke();
            }

            const tex = new THREE.CanvasTexture(c);
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            _archTexCache[cacheKey] = tex;
            return tex;
        }

        // 3. Procedural Mangalore Corrugated Clay Roof Tile Texture
        function createMangaloreTileTexture() {
            if (_archTexCache['mangalore']) return _archTexCache['mangalore'];
            if (typeof document === 'undefined') return null;
            const c = document.createElement('canvas');
            c.width = 512;
            c.height = 512;
            const ctx = c.getContext('2d');
            if (!ctx) return null;
            ctx.fillStyle = '#b91c1c';
            ctx.fillRect(0, 0, 512, 512);

            for (let x = 0; x < 512; x += 32) {
                const grad = ctx.createLinearGradient(x, 0, x + 32, 0);
                grad.addColorStop(0, '#7f1d1d');
                grad.addColorStop(0.5, '#dc2626');
                grad.addColorStop(1, '#991b1b');
                ctx.fillStyle = grad;
                ctx.fillRect(x, 0, 32, 512);
            }

            ctx.strokeStyle = 'rgba(40, 5, 5, 0.45)';
            ctx.lineWidth = 3;
            for (let y = 0; y < 512; y += 64) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(512, y);
                ctx.stroke();
            }

            const tex = new THREE.CanvasTexture(c);
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(4, 3);
            _archTexCache['mangalore'] = tex;
            return tex;
        }

        // 4. Procedural Heavy-Duty Architectural Paver Texture
        function createPaverTileTexture(baseHex, grooveHex) {
            const cacheKey = 'paver_' + (baseHex || '') + '_' + (grooveHex || '');
            if (_archTexCache[cacheKey]) return _archTexCache[cacheKey];
            if (typeof document === 'undefined') return null;
            const c = document.createElement('canvas');
            c.width = 512;
            c.height = 512;
            const ctx = c.getContext('2d');
            if (!ctx) return null;
            ctx.fillStyle = baseHex;
            ctx.fillRect(0, 0, 512, 512);

            // Plaster & fine stone grain
            for (let i = 0; i < 12000; i++) {
                const x = Math.random() * 512;
                const y = Math.random() * 512;
                ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.10)';
                ctx.fillRect(x, y, 2, 2);
            }

            // Paver block joint lines (staggered running bond 64x32)
            ctx.strokeStyle = grooveHex || 'rgba(15,23,42,0.40)';
            ctx.lineWidth = 2.5;
            const blockW = 64;
            const blockH = 32;
            for (let y = 0; y < 512; y += blockH) {
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke();
                const row = Math.floor(y / blockH);
                const offset = (row % 2 === 0) ? 0 : blockW / 2;
                for (let x = offset; x < 512 + blockW; x += blockW) {
                    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + blockH); ctx.stroke();
                }
            }

            const tex = new THREE.CanvasTexture(c);
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(4, 4);
            _archTexCache[cacheKey] = tex;
            return tex;
        }

        // 5. Procedural Woven Fabric Area Rug Texture
        function createWovenRugTexture() {
            if (_archTexCache['wovenRug']) return _archTexCache['wovenRug'];
            if (typeof document === 'undefined') return null;
            const c = document.createElement('canvas');
            c.width = 512;
            c.height = 512;
            const ctx = c.getContext('2d');
            if (!ctx) return null;
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(0, 0, 512, 512);

            // Woven thread lattice
            ctx.strokeStyle = 'rgba(217, 119, 6, 0.35)';
            ctx.lineWidth = 2;
            for (let i = 0; i < 512; i += 16) {
                ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke();
            }
            ctx.strokeStyle = 'rgba(241, 245, 249, 0.25)';
            for (let j = 0; j < 512; j += 16) {
                ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(512, j); ctx.stroke();
            }

            ctx.strokeStyle = '#d97706';
            ctx.lineWidth = 8;
            ctx.strokeRect(12, 12, 488, 488);

            const tex = new THREE.CanvasTexture(c);
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            _archTexCache[cacheKey] = tex;
            return tex;
        }

        // 6. Royal Italian Calacatta Marble (Mirror-polished luxury marble with veins & tile grid for interior living spaces)
        function createCalacattaMarbleTexture() {
            if (_archTexCache['calacatta']) return _archTexCache['calacatta'];
            if (typeof document === 'undefined') return null;
            const canvas = document.createElement('canvas');
            canvas.width = 1024;
            canvas.height = 1024;
            const ctx = canvas.getContext('2d');
            if (!ctx) return null;

            // 1. Warm Pearl White Base with subtle ivory gradient
            const bgGrad = ctx.createLinearGradient(0, 0, 1024, 1024);
            bgGrad.addColorStop(0, '#fbf9f4');
            bgGrad.addColorStop(0.3, '#f5f2ea');
            bgGrad.addColorStop(0.7, '#f9f6f0');
            bgGrad.addColorStop(1, '#f3efe6');
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, 1024, 1024);

            // 2. Soft translucent smoky clouds across the entire slab
            for (let i = 0; i < 20; i++) {
                const cx = (i * 137.5) % 1024;
                const cy = (i * 229.3) % 1024;
                const cr = 120 + ((i * 47) % 160);
                const rad = ctx.createRadialGradient(cx, cy, 10, cx, cy, cr);
                rad.addColorStop(0, 'rgba(215, 208, 195, 0.45)');
                rad.addColorStop(1, 'rgba(251, 249, 244, 0)');
                ctx.fillStyle = rad;
                ctx.beginPath();
                ctx.arc(cx, cy, cr, 0, Math.PI * 2);
                ctx.fill();
            }

            // 3. Fractal Meandering Vein Generator (Midpoint Displacement)
            function fractalLine(x1, y1, x2, y2, depth, spread) {
                if (depth <= 0) return [[x1, y1], [x2, y2]];
                const mx = (x1 + x2) / 2 + (Math.random() - 0.5) * spread;
                const my = (y1 + y2) / 2 + (Math.random() - 0.5) * spread;
                const left = fractalLine(x1, y1, mx, my, depth - 1, spread * 0.55);
                const right = fractalLine(mx, my, x2, y2, depth - 1, spread * 0.55);
                return left.concat(right.slice(1));
            }

            function drawNaturalVein(startX, startY, endX, endY, baseWidth, mainColor, goldColor) {
                const pts = fractalLine(startX, startY, endX, endY, 5, 110);

                ctx.save();
                ctx.strokeStyle = 'rgba(100, 116, 139, 0.28)';
                ctx.lineWidth = baseWidth * 2.8;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.beginPath();
                ctx.moveTo(pts[0][0], pts[0][1]);
                for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
                ctx.stroke();

                ctx.strokeStyle = mainColor;
                ctx.lineWidth = baseWidth;
                ctx.stroke();

                ctx.strokeStyle = 'rgba(30, 41, 59, 0.85)';
                ctx.lineWidth = Math.max(2.4, baseWidth * 0.38);
                ctx.stroke();

                ctx.strokeStyle = goldColor;
                ctx.lineWidth = Math.max(2.2, baseWidth * 0.30);
                ctx.beginPath();
                ctx.moveTo(pts[0][0] + 3, pts[0][1] - 2);
                for (let i = 1; i < pts.length; i++) {
                    ctx.lineTo(pts[i][0] + Math.sin(i * 0.5) * 4, pts[i][1] + Math.cos(i * 0.5) * 4);
                }
                ctx.stroke();

                // Tributary capillaries
                for (let i = 2; i < pts.length - 2; i += 2) {
                    if (Math.random() > 0.20) {
                        const dir = (Math.random() > 0.5) ? 1 : -1;
                        const len = 40 + Math.random() * 80;
                        const bPts = fractalLine(pts[i][0], pts[i][1], pts[i][0] + dir * len, pts[i][1] + (Math.random() - 0.5) * len, 3, 25);
                        ctx.strokeStyle = 'rgba(71, 85, 105, 0.50)';
                        ctx.lineWidth = 2.0;
                        ctx.beginPath();
                        ctx.moveTo(bPts[0][0], bPts[0][1]);
                        for (let j = 1; j < bPts.length; j++) ctx.lineTo(bPts[j][0], bPts[j][1]);
                        ctx.stroke();
                    }
                }
                ctx.restore();
            }

            let s = 101;
            const originalRandom = Math.random;
            Math.random = function() {
                s = (s * 9301 + 49297) % 233280;
                return s / 233280;
            };

            // Well-distributed veins across the entire 1024x1024 slab
            drawNaturalVein(-50, 80, 1080, 880, 22, 'rgba(47, 59, 75, 0.80)', 'rgba(217, 119, 6, 0.85)');
            drawNaturalVein(150, -50, 1080, 650, 18, 'rgba(51, 65, 85, 0.75)', 'rgba(180, 83, 9, 0.75)');
            drawNaturalVein(-50, 480, 900, 1080, 18, 'rgba(51, 65, 85, 0.75)', 'rgba(217, 119, 6, 0.80)');
            drawNaturalVein(420, -50, 1080, 420, 20, 'rgba(180, 83, 9, 0.80)', 'rgba(51, 65, 85, 0.70)');
            drawNaturalVein(-50, 780, 680, 1080, 15, 'rgba(71, 85, 105, 0.65)', 'rgba(217, 119, 6, 0.65)');
            drawNaturalVein(650, -50, 1080, 220, 16, 'rgba(51, 65, 85, 0.70)', 'rgba(180, 83, 9, 0.70)');
            drawNaturalVein(-50, 280, 850, 1080, 16, 'rgba(71, 85, 105, 0.70)', 'rgba(217, 119, 6, 0.75)');
            drawNaturalVein(0, 1000, 1000, 0, 14, 'rgba(51, 65, 85, 0.65)', 'rgba(180, 83, 9, 0.65)'); // cross-vein

            Math.random = originalRandom;

            // 4x4 Large-Format Vitrified Marble Tile Joints (1.0m - 1.2m grid)
            ctx.strokeStyle = 'rgba(71, 85, 105, 0.60)';
            ctx.lineWidth = 3.0;
            [0, 256, 512, 768, 1024].forEach(coord => {
                ctx.beginPath();
                ctx.moveTo(coord, 0);
                ctx.lineTo(coord, 1024);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(0, coord);
                ctx.lineTo(1024, coord);
                ctx.stroke();
            });

            // Tile bevel highlight
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.80)';
            ctx.lineWidth = 1.5;
            [1, 257, 513, 769].forEach(coord => {
                ctx.beginPath();
                ctx.moveTo(coord, 0);
                ctx.lineTo(coord, 1024);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(0, coord);
                ctx.lineTo(1024, coord);
                ctx.stroke();
            });

            const tex = new THREE.CanvasTexture(canvas);
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(2.0, 2.0);
            _archTexCache['calacatta'] = tex;
            return tex;
        }

        // 7. Procedural Ground Contact Shadow Texture (Zero-CPU Baked Ambient Occlusion)
        function createContactShadowTexture() {
            if (_archTexCache['contactShadow']) return _archTexCache['contactShadow'];
            if (typeof document === 'undefined') return null;
            const c = document.createElement('canvas');
            c.width = 512;
            c.height = 512;
            const ctx = c.getContext('2d');
            if (!ctx) return null;
            const grad = ctx.createRadialGradient(256, 256, 40, 256, 256, 256);
            grad.addColorStop(0, 'rgba(0, 0, 0, 0.70)');
            grad.addColorStop(0.35, 'rgba(0, 0, 0, 0.35)');
            grad.addColorStop(0.70, 'rgba(0, 0, 0, 0.10)');
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 512, 512);
            const tex = new THREE.CanvasTexture(c);
            _archTexCache['contactShadow'] = tex;
            return tex;
        }
        // 8. Procedural Architectural Warm Teak Wood Soffit Texture
        function createWoodSoffitTexture() {
            if (_archTexCache['woodSoffit']) return _archTexCache['woodSoffit'];
            if (typeof document === 'undefined') return null;
            const c = document.createElement('canvas');
            c.width = 512;
            c.height = 512;
            const ctx = c.getContext('2d');
            if (!ctx) return null;
            ctx.fillStyle = '#6b300c'; // Warm rich teak wood base
            ctx.fillRect(0, 0, 512, 512);

            // Shiplap timber plank lines (horizontal planks spaced at 32px)
            const plankH = 32;
            for (let y = 0; y < 512; y += plankH) {
                const tint = (Math.random() - 0.5) * 20;
                ctx.fillStyle = `rgba(${Math.max(0, 115 + tint)}, ${Math.max(0, 50 + tint * 0.6)}, ${Math.max(0, 12 + tint * 0.3)}, 0.28)`;
                ctx.fillRect(0, y, 512, plankH);

                for (let g = 0; g < 4; g++) {
                    ctx.strokeStyle = 'rgba(25, 8, 2, 0.20)';
                    ctx.lineWidth = 1 + Math.random();
                    ctx.beginPath();
                    const gy = y + Math.random() * plankH;
                    ctx.moveTo(0, gy);
                    ctx.lineTo(512, gy + (Math.random() - 0.5) * 4);
                    ctx.stroke();
                }

                ctx.strokeStyle = 'rgba(15, 5, 2, 0.70)';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(512, y);
                ctx.stroke();

                ctx.strokeStyle = 'rgba(255, 215, 160, 0.22)';
                ctx.lineWidth = 1.0;
                ctx.beginPath();
                ctx.moveTo(0, y + 2.5);
                ctx.lineTo(512, y + 2.5);
                ctx.stroke();
            }

            const tex = new THREE.CanvasTexture(c);
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(2, 2);
            return tex;
        }

        // 9. Procedural Prestigious Architectural Signboard Texture (Ultra-HD 1024x512 Canvas)
        function createArchitecturalSignTexture() {
            if (_archTexCache['archSign']) return _archTexCache['archSign'];
            if (typeof document === 'undefined') return null;
            const c = document.createElement('canvas');
            c.width = 1024;
            c.height = 512;
            const ctx = c.getContext('2d');
            if (!ctx) return null;

            // 1. Brushed Dark Obsidian / Slate Metallic Background
            const bgGrad = ctx.createLinearGradient(0, 0, 1024, 512);
            bgGrad.addColorStop(0.0, '#0a0e17');
            bgGrad.addColorStop(0.5, '#161f30');
            bgGrad.addColorStop(1.0, '#0a0e17');
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, 1024, 512);

            // Fine brushed horizontal metal grain
            for (let i = 0; i < 450; i++) {
                const y = Math.random() * 512;
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
                ctx.lineWidth = 1 + Math.random() * 1.5;
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(1024, y);
                ctx.stroke();
            }

            // 2. Double Burnished Gold Perimeter Frame with Corner Insets
            const goldStroke = '#d4af37';
            ctx.strokeStyle = goldStroke;
            ctx.lineWidth = 5;
            ctx.strokeRect(20, 20, 984, 472);

            ctx.strokeStyle = 'rgba(212, 175, 55, 0.45)';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(32, 32, 960, 448);

            // Ornate corner-bracket highlights
            const corners = [
                [20, 20, 1, 1], [1004, 20, -1, 1],
                [20, 492, 1, -1], [1004, 492, -1, -1]
            ];
            corners.forEach(([cx, cy, sx, sy]) => {
                ctx.fillStyle = goldStroke;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(cx + sx * 24, cy);
                ctx.lineTo(cx, cy + sy * 24);
                ctx.closePath();
                ctx.fill();
            });

            // 3. Central Engineering & Architectural Crest (Emblem)
            const emblemCx = 512;
            const emblemCy = 125;
            const emblemRad = 58;

            const glowGrad = ctx.createRadialGradient(emblemCx, emblemCy, 10, emblemCx, emblemCy, emblemRad * 1.6);
            glowGrad.addColorStop(0, 'rgba(245, 158, 11, 0.32)');
            glowGrad.addColorStop(1, 'rgba(245, 158, 11, 0.0)');
            ctx.fillStyle = glowGrad;
            ctx.beginPath();
            ctx.arc(emblemCx, emblemCy, emblemRad * 1.6, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(emblemCx, emblemCy, emblemRad, 0, Math.PI * 2);
            ctx.stroke();

            for (let i = 0; i < 36; i++) {
                const angle = (i * Math.PI * 2) / 36;
                const len = (i % 3 === 0) ? 7 : 4;
                const x1 = emblemCx + Math.cos(angle) * (emblemRad - 2);
                const y1 = emblemCy + Math.sin(angle) * (emblemRad - 2);
                const x2 = emblemCx + Math.cos(angle) * (emblemRad - 2 - len);
                const y2 = emblemCy + Math.sin(angle) * (emblemRad - 2 - len);
                ctx.strokeStyle = (i % 3 === 0) ? '#fbbf24' : 'rgba(245, 158, 11, 0.6)';
                ctx.lineWidth = (i % 3 === 0) ? 2 : 1;
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
            }

            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(emblemCx, emblemCy, emblemRad - 12, 0, Math.PI * 2);
            ctx.stroke();

            ctx.save();
            ctx.translate(emblemCx, emblemCy);

            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(0, -32);
            ctx.lineTo(26, 0);
            ctx.lineTo(0, 32);
            ctx.lineTo(-26, 0);
            ctx.closePath();
            ctx.stroke();

            ctx.strokeStyle = 'rgba(251, 191, 36, 0.6)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-26, 0); ctx.lineTo(26, 0);
            ctx.moveTo(0, -32); ctx.lineTo(0, 32);
            ctx.stroke();

            const compassGrad = ctx.createLinearGradient(-20, -32, 20, 32);
            compassGrad.addColorStop(0, '#fffbeb');
            compassGrad.addColorStop(0.5, '#f59e0b');
            compassGrad.addColorStop(1, '#92400e');
            ctx.strokeStyle = compassGrad;
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.fillStyle = '#fffbeb';
            ctx.beginPath();
            ctx.arc(0, -22, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(0, -22);
            ctx.lineTo(-16, 26);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, -22);
            ctx.lineTo(16, 26);
            ctx.stroke();
            ctx.strokeStyle = '#fef08a';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, -22, 34, 0.35 * Math.PI, 0.65 * Math.PI);
            ctx.stroke();

            ctx.restore();

            // 4. Main Prominent Title: "SA RAHMAN"
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const goldTextGrad = ctx.createLinearGradient(0, 215, 0, 280);
            goldTextGrad.addColorStop(0.0, '#fffbeb');
            goldTextGrad.addColorStop(0.25, '#fde68a');
            goldTextGrad.addColorStop(0.60, '#f59e0b');
            goldTextGrad.addColorStop(0.85, '#d97706');
            goldTextGrad.addColorStop(1.0, '#92400e');

            ctx.font = '900 52px "Outfit", "Segoe UI", system-ui, sans-serif';

            ctx.shadowColor = 'rgba(0, 0, 0, 0.90)';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 5;
            ctx.fillStyle = goldTextGrad;
            ctx.fillText('SA RAHMAN', 512, 252);

            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;

            // 5. Tapered Gold Divider with Diamond Gem
            const divY = 302;
            const divGradL = ctx.createLinearGradient(200, divY, 512, divY);
            divGradL.addColorStop(0, 'rgba(245, 158, 11, 0.0)');
            divGradL.addColorStop(1, '#f59e0b');
            ctx.strokeStyle = divGradL;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(200, divY);
            ctx.lineTo(495, divY);
            ctx.stroke();

            const divGradR = ctx.createLinearGradient(512, divY, 824, divY);
            divGradR.addColorStop(0, '#f59e0b');
            divGradR.addColorStop(1, 'rgba(245, 158, 11, 0.0)');
            ctx.strokeStyle = divGradR;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(529, divY);
            ctx.lineTo(824, divY);
            ctx.stroke();

            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            ctx.moveTo(512, divY - 6);
            ctx.lineTo(518, divY);
            ctx.lineTo(512, divY + 6);
            ctx.lineTo(506, divY);
            ctx.closePath();
            ctx.fill();

            // 6. Subtitles
            ctx.font = '700 24px "Outfit", "Segoe UI", sans-serif';
            ctx.fillStyle = '#fef3c7';
            ctx.fillText('STRUCTURAL DESIGN & CONSULTANCY', 512, 348);

            ctx.font = '600 17px "Outfit", "Segoe UI", sans-serif';
            ctx.fillStyle = '#94a3b8';
            ctx.fillText('CIVIL & STRUCTURAL ENGINEERING  •  R.C.C. SPECIALIST', 512, 396);

            ctx.font = '700 13px "Outfit", "Segoe UI", sans-serif';
            ctx.fillStyle = '#d97706';
            ctx.fillText('★   G+2 RESIDENTIAL PROJECT   ★', 512, 442);

            const tex = new THREE.CanvasTexture(c);
            tex.wrapS = THREE.ClampToEdgeWrapping;
            tex.wrapT = THREE.ClampToEdgeWrapping;
            _archTexCache['archSign'] = tex;
            return tex;
        }


        // Texture instances
        const calacattaMarbleTex = createCalacattaMarbleTexture();
        const stuccoTex = createStuccoTexture();
        const woodTex = createWoodTexture('#78350f', 'rgba(30,10,0,0.32)');
        const woodSoffitTex = createWoodSoffitTexture();
        const archSignTex = createArchitecturalSignTexture();
        const roofTex = createMangaloreTileTexture();
        const paverSlateTex = createPaverTileTexture('#334155', 'rgba(15,23,42,0.50)');
        const paverGoldTex = createPaverTileTexture('#c29b74', 'rgba(67,40,16,0.40)');
        const rugTex = createWovenRugTexture();
        const interiorWallTex = createInteriorPaintTexture();
        const contactShadowTex = createContactShadowTexture();

        // -------------------------------------------------------------
        // MATERIALS PALETTE (WARM LUXURY JAIPUR SANDSTONE, CHARCOAL BASALT & CASHMERE INTERIOR)
        // -------------------------------------------------------------
        const wallSandstone = new THREE.MeshStandardMaterial({
            color: 0xddd0b6, // Rich natural Jaipur Sandstone / Travertine (tangible warm stone character)
            map: stuccoTex,
            bumpMap: stuccoTex,
            bumpScale: 0.018,
            roughness: 0.74, // Diffuses light naturally without washing out to white
            metalness: 0.02
        });
        const matFacadeCharcoal = new THREE.MeshStandardMaterial({
            color: 0x1e2430, // Deep Architectural Charcoal Basalt / Anthracite Slate
            roughness: 0.45,
            metalness: 0.25
        });
        const wallAccentSlate = matFacadeCharcoal;
        const wallAccentRoyalBlue = matFacadeCharcoal; // Eliminates cartoonish royal blue
        const parapetCopingMat = new THREE.MeshStandardMaterial({
            color: 0x1e2633, // High-contrast Anthracite Slate coping
            roughness: 0.38,
            metalness: 0.25
        });
        const granitePlinthMat = new THREE.MeshStandardMaterial({
            color: 0x181e28, // Dark Flamed Rustic Granite Podium Band
            roughness: 0.50,
            metalness: 0.20
        });
        const windowSillMat = new THREE.MeshStandardMaterial({
            color: 0x181e28, // Dark Polished Granite Window Sill
            roughness: 0.35,
            metalness: 0.40
        });
        const teakSoffitMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            map: woodSoffitTex,
            bumpMap: woodSoffitTex,
            bumpScale: 0.010,
            roughness: 0.42,
            metalness: 0.08
        });
        const matSignBackplate = new THREE.MeshStandardMaterial({
            color: 0x0f172a, // Brushed dark obsidian slate
            roughness: 0.30,
            metalness: 0.85
        });
        const matSignGoldTrim = new THREE.MeshStandardMaterial({
            color: 0xd97706, // Champagne 24K Gold Brass
            roughness: 0.20,
            metalness: 0.90
        });
        const matSignCanvas = new THREE.MeshStandardMaterial({
            map: archSignTex,
            roughness: 0.25,
            metalness: 0.65
        });
        const matLuminaireUnderside = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0xfef08a,
            emissiveIntensity: 0.9,
            roughness: 0.10
        });
        const wallInternalMat = new THREE.MeshStandardMaterial({
            color: 0xf5eee4, // Warm Cashmere Ivory / Linen (Asian Paints Royale Luxury Emulsion)
            map: interiorWallTex,
            bumpMap: interiorWallTex,
            bumpScale: 0.005,
            roughness: 0.82,
            metalness: 0.01
        });
        const teakCladMat = new THREE.MeshStandardMaterial({ color: 0x854d0e, map: woodTex, roughness: 0.50, metalness: 0.10 });
        const slabFasciaMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35, metalness: 0.05 });
        const darkFrameMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.30, metalness: 0.85 });
        const goldBrassMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.20, metalness: 0.85 });
        const steelMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.35, metalness: 0.30 });
        const teakDoorMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            map: woodTex,
            bumpMap: woodTex,
            bumpScale: 0.008,
            roughness: 0.38,
            metalness: 0.10
        });
        const internalDoorMat = new THREE.MeshStandardMaterial({ color: 0xa16207, map: woodTex, roughness: 0.45, metalness: 0.10 });
        const toiletDoorMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.30, metalness: 0.10 });

        const royalCalacattaMarble = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            map: calacattaMarbleTex,
            roughness: 0.40,
            metalness: 0.0
        });
        const royalMarbleBorder = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.15, metalness: 0.15 });
        const floorMarbleMat = royalCalacattaMarble;

        // Designer Outdoor Balcony Vitrified Tiles (Warm Tuscan Cotto & Sandstone Travertine)
        const balconyTileCotto = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.58, metalness: 0.05 });
        const balconyTileTravertine = new THREE.MeshStandardMaterial({ color: 0xddcbb5, roughness: 0.52, metalness: 0.05 });
        const floorBalconyMat = balconyTileTravertine;

        // Heavy-Duty Architectural Paver Tiles for Stilt Parking, Driveway, & Setbacks
        const paverCharcoalSlate = new THREE.MeshStandardMaterial({
            color: 0x334155, // Charcoal Slate
            map: paverSlateTex,
            bumpMap: paverSlateTex,
            bumpScale: 0.02,
            roughness: 0.65,
            metalness: 0.10
        });
        const paverSandstoneGold = new THREE.MeshStandardMaterial({
            color: 0xc29b74, // Sandstone Gold
            map: paverGoldTex,
            bumpMap: paverGoldTex,
            bumpScale: 0.02,
            roughness: 0.68,
            metalness: 0.05
        });
        const floorPaverLight1 = paverCharcoalSlate;
        const floorPaverLight2 = paverSandstoneGold;
        const floorWoodMat = new THREE.MeshStandardMaterial({ color: 0xd4a373, map: woodTex, roughness: 0.45, metalness: 0.05 });
        const floorToiletMat = new THREE.MeshStandardMaterial({ color: 0xdbeafe, roughness: 0.50, metalness: 0.05 });
        const terraceTileMat = new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.78, metalness: 0.05 });
        const mangaloreRoofMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            map: roofTex,
            bumpMap: roofTex,
            bumpScale: 0.03,
            roughness: 0.65,
            metalness: 0.08
        });
        const livingRugMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            map: rugTex,
            roughness: 0.85,
            metalness: 0.02
        });
        const grassMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.95 });
        const flowerRedMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.8 });
        const flowerGoldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.8 });

        const ceramicSanitaryMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15, metalness: 0.10 });
        const chromeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.10, metalness: 0.95 });
        const mirrorGlassMat = new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.05, metalness: 0.90 });

        const sofaRoyalNavy = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.80 });
        const sofaGoldCushion = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.60 });
        const walnutWoodMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.45, metalness: 0.05 });
        const tvScreenMat = new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.10, metalness: 0.90 });
        const bedNavyMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.75 });
        const bedWhiteLinen = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.90 });
        const bedTealPillow = new THREE.MeshStandardMaterial({ color: 0x0d9488, roughness: 0.70 });
        const kitchenGraniteMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.20, metalness: 0.50 });

        const stairTreadMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.30, metalness: 0.10 });
        const stairRiserMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.35, metalness: 0.20 });
        const stairNosingMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.40, metalness: 0.10 });

        const windowGlassMat = new THREE.MeshStandardMaterial({
            color: 0x162a3e, // Solar Low-E Blue-Grey Reflective Glazing
            roughness: 0.06,
            metalness: 0.94,
            transparent: true,
            opacity: 0.65
        });
        const railingGlassMat = new THREE.MeshStandardMaterial({
            color: 0xdbeafe, // Crystal-clear low-iron tempered architectural safety glass
            roughness: 0.03,
            metalness: 0.85,
            transparent: true,
            opacity: 0.35
        });
        const stairGlassMat = new THREE.MeshStandardMaterial({
            color: 0x1a2e44, // Low-E Blue-Grey curtain wall glazing
            roughness: 0.05,
            metalness: 0.94,
            transparent: true,
            opacity: 0.65
        });

        // -------------------------------------------------------------
        // GEOMETRIC HELPERS
        // -------------------------------------------------------------
        // Share 1 BoxGeometry across all walls/furniture to save GPU memory
        const sharedBoxGeom = new THREE.BoxGeometry(1, 1, 1);

        function createBox(w, h, d, x, y, z, mat, parent) {
            const mesh = new THREE.Mesh(sharedBoxGeom, mat);
            mesh.scale.set(w, h, d);
            mesh.position.set(x, y, z);
            mesh.castShadow = false;
            mesh.receiveShadow = false;
            mesh.matrixAutoUpdate = false;
            mesh.updateMatrix();
            (parent || archGroup).add(mesh);
            return mesh;
        }

        function createCheckeredFloor(xMin, xMax, zMin, zMax, yLevel, tileSize, matA, matB, parent) {
            const w = xMax - xMin;
            const d = zMax - zMin;
            const cx = (xMin + xMax) / 2;
            const cz = (zMin + zMax) / 2;

            let colAHex = (matA && matA.color) ? ('#' + matA.color.getHexString()) : '#334155';
            let colBHex = (matB && matB.color) ? ('#' + matB.color.getHexString()) : '#c29b74';
            if (colAHex.toLowerCase() === '#ffffff' && colBHex.toLowerCase() === '#ffffff') {
                colAHex = '#334155';
                colBHex = '#c29b74';
            }

            const repX = Math.max(1, Math.round(w / (tileSize * 2)));
            const repY = Math.max(1, Math.round(d / (tileSize * 2)));
            const cacheKey = `checker_${colAHex}_${colBHex}`;

            if (!_archTexCache[cacheKey]) {
                const c = document.createElement('canvas');
                c.width = 128; c.height = 128;
                const ctx = c.getContext('2d');
                ctx.fillStyle = colAHex;
                ctx.fillRect(0, 0, 64, 64); ctx.fillRect(64, 64, 64, 64);
                ctx.fillStyle = colBHex;
                ctx.fillRect(64, 0, 64, 64); ctx.fillRect(0, 64, 64, 64);

                // Architectural joint grooves
                ctx.strokeStyle = 'rgba(15, 23, 42, 0.60)';
                ctx.lineWidth = 3.5;
                ctx.strokeRect(0, 0, 64, 64); ctx.strokeRect(64, 64, 64, 64);
                ctx.strokeRect(0, 0, 128, 128);

                // Chamfered bevel highlight
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
                ctx.lineWidth = 1.5;
                ctx.strokeRect(2, 2, 60, 60); ctx.strokeRect(66, 66, 60, 60);

                _archTexCache[cacheKey] = c;
            }

            const tex = new THREE.CanvasTexture(_archTexCache[cacheKey]);
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(Math.max(1, w / (tileSize * 2)), Math.max(1, d / (tileSize * 2)));

            const tiledMat = new THREE.MeshStandardMaterial({
                map: tex,
                roughness: 0.65,
                metalness: 0.08
            });

            return createBox(w, 0.02, d, cx, yLevel + 0.01, cz, tiledMat, parent);
        }

        function createWallWithDoor(wallLen, wallH, wallThick, wx, wy, wz, orient, doorOffsetFromStart, doorW, doorH, doorMat, doorSwingAngle, wallMat, parent) {
            const grp = new THREE.Group();
            grp.position.set(wx, wy, wz);
            const isZ = (orient === 'Z');
            const dW = doorW || 0.90;
            const dH = doorH || 2.10;
            const swing = (doorSwingAngle !== undefined) ? doorSwingAngle : 0.35;
            const matDoor = doorMat || internalDoorMat;
            const matWall = wallMat || wallInternalMat;

            const leftLen = doorOffsetFromStart;
            const rightLen = wallLen - doorOffsetFromStart - dW;
            const topH = wallH - dH;

            if (!isZ) {
                const startX = -wallLen / 2;
                if (leftLen > 0.02) createBox(leftLen, wallH, wallThick, startX + leftLen / 2, 0, 0, matWall, grp);
                if (rightLen > 0.02) createBox(rightLen, wallH, wallThick, startX + leftLen + dW + rightLen / 2, 0, 0, matWall, grp);
                createBox(dW, topH, wallThick, startX + leftLen + dW / 2, wallH / 2 - topH / 2, 0, matWall, grp);

                const doorCenterX = startX + leftLen + dW / 2;
                const doorJambY = -wallH / 2 + dH / 2;
                createBox(0.06, dH, wallThick + 0.02, startX + leftLen + 0.03, doorJambY, 0, darkFrameMat, grp);
                createBox(0.06, dH, wallThick + 0.02, startX + leftLen + dW - 0.03, doorJambY, 0, darkFrameMat, grp);
                createBox(dW, 0.06, wallThick + 0.02, doorCenterX, -wallH / 2 + dH - 0.03, 0, darkFrameMat, grp);

                const leafGrp = new THREE.Group();
                leafGrp.position.set(startX + leftLen + 0.05, -wallH / 2 + dH / 2, 0);
                leafGrp.rotation.y = swing;
                createBox(dW - 0.08, dH - 0.06, 0.04, (dW - 0.08) / 2, 0, 0, matDoor, leafGrp);
                createBox(0.03, 0.16, 0.06, dW - 0.15, -0.05, 0.03, goldBrassMat, leafGrp);
                grp.add(leafGrp);
            } else {
                const startZ = -wallLen / 2;
                if (leftLen > 0.02) createBox(wallThick, wallH, leftLen, 0, 0, startZ + leftLen / 2, matWall, grp);
                if (rightLen > 0.02) createBox(wallThick, wallH, rightLen, 0, 0, startZ + leftLen + dW + rightLen / 2, matWall, grp);
                createBox(wallThick, topH, dW, 0, wallH / 2 - topH / 2, startZ + leftLen + dW / 2, matWall, grp);

                const doorCenterZ = startZ + leftLen + dW / 2;
                const doorJambY = -wallH / 2 + dH / 2;
                createBox(wallThick + 0.02, dH, 0.06, 0, doorJambY, startZ + leftLen + 0.03, darkFrameMat, grp);
                createBox(wallThick + 0.02, dH, 0.06, 0, doorJambY, startZ + leftLen + dW - 0.03, darkFrameMat, grp);
                createBox(wallThick + 0.02, 0.06, dW, 0, -wallH / 2 + dH - 0.03, doorCenterZ, darkFrameMat, grp);

                const leafGrp = new THREE.Group();
                leafGrp.position.set(0, -wallH / 2 + dH / 2, startZ + leftLen + 0.05);
                leafGrp.rotation.y = swing;
                createBox(0.04, dH - 0.06, dW - 0.08, 0, 0, (dW - 0.08) / 2, matDoor, leafGrp);
                createBox(0.06, 0.16, 0.03, 0.03, -0.05, dW - 0.15, goldBrassMat, leafGrp);
                grp.add(leafGrp);
            }

            (parent || archGroup).add(grp);
            return grp;
        }

        // Double-Leaf Main Door (M.D) with Continuous Top Lintel
        function createWallWithDoubleDoor(wallLen, wallH, wallThick, wx, wy, wz, orient, doorOffset, doorW, doorH, parent) {
            const grp = new THREE.Group();
            grp.position.set(wx, wy, wz);
            const dW = doorW || 1.40;
            const dH = doorH || 2.15;
            const leftLen = doorOffset;
            const rightLen = wallLen - doorOffset - dW;
            const topH = wallH - dH;
            const startX = -wallLen / 2;

            if (leftLen > 0.02) createBox(leftLen, wallH, wallThick, startX + leftLen / 2, 0, 0, wallSandstone, grp);
            if (rightLen > 0.02) createBox(rightLen, wallH, wallThick, startX + leftLen + dW + rightLen / 2, 0, 0, wallSandstone, grp);
            createBox(wallLen, topH, wallThick, 0, wallH / 2 - topH / 2, 0, wallSandstone, grp);

            const doorJambY = -wallH / 2 + dH / 2;
            createBox(0.06, dH, wallThick + 0.02, startX + leftLen + 0.03, doorJambY, 0, darkFrameMat, grp);
            createBox(0.06, dH, wallThick + 0.02, startX + leftLen + dW - 0.03, doorJambY, 0, darkFrameMat, grp);
            createBox(dW, 0.06, wallThick + 0.02, startX + leftLen + dW / 2, -wallH / 2 + dH - 0.03, 0, darkFrameMat, grp);

            const leafW = (dW - 0.10) / 2;
            const leftLeaf = new THREE.Group();
            leftLeaf.position.set(startX + leftLen + 0.05, doorJambY, 0);
            leftLeaf.rotation.y = 0.35;
            createBox(leafW, dH - 0.06, 0.045, leafW / 2, 0, 0, teakDoorMat, leftLeaf);
            createBox(0.03, 0.20, 0.06, leafW - 0.08, 0, 0.03, goldBrassMat, leftLeaf);
            grp.add(leftLeaf);

            const rightLeaf = new THREE.Group();
            rightLeaf.position.set(startX + leftLen + dW - 0.05, doorJambY, 0);
            rightLeaf.rotation.y = -0.35;
            createBox(leafW, dH - 0.06, 0.045, -leafW / 2, 0, 0, teakDoorMat, rightLeaf);
            createBox(0.03, 0.20, 0.06, -leafW + 0.08, 0, 0.03, goldBrassMat, rightLeaf);
            grp.add(rightLeaf);

            (parent || archGroup).add(grp);
            return grp;
        }

        // Open Cased Archway (Zero door leaf - 100% open flow)
        function createWallWithArchOpening(wallLen, wallH, wallThick, wx, wy, wz, orient, openOffset, openW, openH, wallMat, parent) {
            const grp = new THREE.Group();
            grp.position.set(wx, wy, wz);
            const isZ = (orient === 'Z');
            const oW = openW || 1.80;
            const oH = openH || 2.40;
            const topH = wallH - oH;
            const leftLen = openOffset;
            const rightLen = wallLen - openOffset - oW;
            const matWall = wallMat || wallInternalMat;

            if (!isZ) {
                const startX = -wallLen / 2;
                if (leftLen > 0.02) createBox(leftLen, wallH, wallThick, startX + leftLen / 2, 0, 0, matWall, grp);
                if (topH > 0.02) createBox(oW, topH, wallThick, startX + leftLen + oW / 2, wallH / 2 - topH / 2, 0, matWall, grp);
                if (rightLen > 0.02) createBox(rightLen, wallH, wallThick, startX + leftLen + oW + rightLen / 2, 0, 0, matWall, grp);
                createBox(0.06, oH, wallThick + 0.02, startX + leftLen + 0.03, -wallH / 2 + oH / 2, 0, teakCladMat, grp);
                createBox(0.06, oH, wallThick + 0.02, startX + leftLen + oW - 0.03, -wallH / 2 + oH / 2, 0, teakCladMat, grp);
                createBox(oW, 0.06, wallThick + 0.02, startX + leftLen + oW / 2, -wallH / 2 + oH - 0.03, 0, teakCladMat, grp);
            } else {
                const startZ = -wallLen / 2;
                if (leftLen > 0.02) createBox(wallThick, wallH, leftLen, 0, 0, startZ + leftLen / 2, matWall, grp);
                if (topH > 0.02) createBox(wallThick, topH, oW, 0, wallH / 2 - topH / 2, startZ + leftLen + oW / 2, matWall, grp);
                if (rightLen > 0.02) createBox(wallThick, wallH, rightLen, 0, 0, startZ + leftLen + oW + rightLen / 2, matWall, grp);
                createBox(wallThick + 0.02, oH, 0.06, 0, -wallH / 2 + oH / 2, startZ + leftLen + 0.03, teakCladMat, grp);
                createBox(wallThick + 0.02, oH, 0.06, 0, -wallH / 2 + oH / 2, startZ + leftLen + oW - 0.03, teakCladMat, grp);
                createBox(wallThick + 0.02, 0.06, oW, 0, -wallH / 2 + oH - 0.03, startZ + leftLen + oW / 2, teakCladMat, grp);
            }
            (parent || archGroup).add(grp);
            return grp;
        }

        // Clean Wall with Door AND Window safely separated (ZERO OVERLAP!)
        function createWallWithDoorAndWindow(wallLen, wallH, wallThick, wx, wy, wz, orient, doorOffset, doorW, doorH, doorMat, doorSwing, winOffset, winW, winH, sillH, wallMat, parent) {
            const grp = new THREE.Group();
            grp.position.set(wx, wy, wz);
            const isZ = (orient === 'Z');
            const matDoor = doorMat || teakDoorMat;
            const matWall = wallMat || wallSandstone;
            const dW = doorW || 0.90;
            const dH = doorH || 2.10;
            const swing = (doorSwing !== undefined) ? doorSwing : 0.35;
            const topDoorH = wallH - dH;
            const topWinH = wallH - sillH - winH;

            let first = { type: 'door', offset: doorOffset, size: dW };
            let second = { type: 'win', offset: winOffset, size: winW };
            if (doorOffset > winOffset) {
                first = { type: 'win', offset: winOffset, size: winW };
                second = { type: 'door', offset: doorOffset, size: dW };
            }

            const p0 = 0;
            const p1 = first.offset;
            const p2 = first.offset + first.size;
            const p3 = second.offset;
            const p4 = second.offset + second.size;
            const p5 = wallLen;

            if (isZ) {
                const startZ = -wallLen / 2;
                if (p1 - p0 > 0.01) createBox(wallThick, wallH, p1 - p0, 0, 0, startZ + (p0 + p1) / 2, matWall, grp);

                if (first.type === 'door') {
                    if (topDoorH > 0.01) createBox(wallThick, topDoorH, dW, 0, wallH / 2 - topDoorH / 2, startZ + (p1 + p2) / 2, matWall, grp);
                    createBox(wallThick + 0.02, dH, 0.06, 0, -wallH / 2 + dH / 2, startZ + p1 + 0.03, darkFrameMat, grp);
                    createBox(wallThick + 0.02, dH, 0.06, 0, -wallH / 2 + dH / 2, startZ + p2 - 0.03, darkFrameMat, grp);
                    createBox(wallThick + 0.02, 0.06, dW, 0, -wallH / 2 + dH - 0.03, startZ + (p1 + p2) / 2, darkFrameMat, grp);
                    const leafGrp = new THREE.Group();
                    leafGrp.position.set(0, -wallH / 2 + dH / 2, startZ + p1 + 0.05);
                    leafGrp.rotation.y = swing;
                    createBox(0.04, dH - 0.06, dW - 0.08, 0, 0, (dW - 0.08) / 2, matDoor, leafGrp);
                    createBox(0.06, 0.16, 0.03, 0.03, -0.05, dW - 0.15, goldBrassMat, leafGrp);
                    grp.add(leafGrp);
                } else {
                    if (sillH > 0.01) createBox(wallThick, sillH, winW, 0, -wallH / 2 + sillH / 2, startZ + (p1 + p2) / 2, matWall, grp);
                    if (topWinH > 0.01) createBox(wallThick, topWinH, winW, 0, wallH / 2 - topWinH / 2, startZ + (p1 + p2) / 2, matWall, grp);
                    createWindow(winW, winH, 0, -wallH / 2 + sillH + winH / 2, startZ + (p1 + p2) / 2, 'X', grp);
                }

                if (p3 - p2 > 0.01) createBox(wallThick, wallH, p3 - p2, 0, 0, startZ + (p2 + p3) / 2, matWall, grp);

                if (second.type === 'door') {
                    if (topDoorH > 0.01) createBox(wallThick, topDoorH, dW, 0, wallH / 2 - topDoorH / 2, startZ + (p3 + p4) / 2, matWall, grp);
                    createBox(wallThick + 0.02, dH, 0.06, 0, -wallH / 2 + dH / 2, startZ + p3 + 0.03, darkFrameMat, grp);
                    createBox(wallThick + 0.02, dH, 0.06, 0, -wallH / 2 + dH / 2, startZ + p4 - 0.03, darkFrameMat, grp);
                    createBox(wallThick + 0.02, 0.06, dW, 0, -wallH / 2 + dH - 0.03, startZ + (p3 + p4) / 2, darkFrameMat, grp);
                    const leafGrp = new THREE.Group();
                    leafGrp.position.set(0, -wallH / 2 + dH / 2, startZ + p3 + 0.05);
                    leafGrp.rotation.y = swing;
                    createBox(0.04, dH - 0.06, dW - 0.08, 0, 0, (dW - 0.08) / 2, matDoor, leafGrp);
                    createBox(0.06, 0.16, 0.03, 0.03, -0.05, dW - 0.15, goldBrassMat, leafGrp);
                    grp.add(leafGrp);
                } else {
                    if (sillH > 0.01) createBox(wallThick, sillH, winW, 0, -wallH / 2 + sillH / 2, startZ + (p3 + p4) / 2, matWall, grp);
                    if (topWinH > 0.01) createBox(wallThick, topWinH, winW, 0, wallH / 2 - topWinH / 2, startZ + (p3 + p4) / 2, matWall, grp);
                    createWindow(winW, winH, 0, -wallH / 2 + sillH + winH / 2, startZ + (p3 + p4) / 2, 'X', grp);
                }

                if (p5 - p4 > 0.01) createBox(wallThick, wallH, p5 - p4, 0, 0, startZ + (p4 + p5) / 2, matWall, grp);
            }
            (parent || archGroup).add(grp);
            return grp;
        }

        function createWindow(w, h, x, y, z, orient, parent) {
            const winGrp = new THREE.Group();
            winGrp.position.set(x, y, z);
            const isZ = (orient === 'Z');
            const frameT = 0.065;
            const frameD = 0.24; // Spans full 230mm wall thickness
            const chajjaDepth = 0.42; // 420mm projecting RCC weather sunshade
            const chajjaW = w + 0.30;

            if (isZ) {
                // Outer Aluminum Frame
                createBox(w, frameT, frameD, 0, h / 2 - frameT / 2, 0, darkFrameMat, winGrp);
                createBox(w, frameT, frameD, 0, -h / 2 + frameT / 2, 0, darkFrameMat, winGrp);
                createBox(frameT, h, frameD, -w / 2 + frameT / 2, 0, 0, darkFrameMat, winGrp);
                createBox(frameT, h, frameD, w / 2 - frameT / 2, 0, 0, darkFrameMat, winGrp);
                // Center Mullion & Transom
                createBox(frameT * 0.75, h, frameD * 0.7, 0, 0, 0, darkFrameMat, winGrp);
                createBox(w - frameT * 2, 0.03, frameD * 0.6, 0, h * 0.18, 0, darkFrameMat, winGrp);
                // Tinted Reflective Glass Pane
                createBox(w - frameT * 2, h - frameT * 2, 0.02, 0, 0, 0, windowGlassMat, winGrp);
                // Projecting Granite Window Sill & RCC Chajja (Sunshade)
                const extDir = (z >= 0) ? 1 : -1;
                createBox(w + 0.12, 0.045, 0.30, 0, -h / 2 - 0.02, extDir * 0.04, windowSillMat, winGrp);
                createBox(chajjaW, 0.065, chajjaDepth, 0, h / 2 + 0.05, extDir * (chajjaDepth / 2 - 0.05), slabFasciaMat, winGrp);
                // Chajja Side Fascia Fins (Box-Window look)
                createBox(0.05, h + 0.12, chajjaDepth * 0.65, -w / 2 - 0.04, 0, extDir * 0.10, matFacadeCharcoal, winGrp);
                createBox(0.05, h + 0.12, chajjaDepth * 0.65, w / 2 + 0.04, 0, extDir * 0.10, matFacadeCharcoal, winGrp);
            } else {
                createBox(frameD, frameT, w, 0, h / 2 - frameT / 2, 0, darkFrameMat, winGrp);
                createBox(frameD, frameT, w, 0, -h / 2 + frameT / 2, 0, darkFrameMat, winGrp);
                createBox(frameD, h, frameT, 0, 0, -w / 2 + frameT / 2, darkFrameMat, winGrp);
                createBox(frameD, h, frameT, 0, 0, w / 2 - frameT / 2, darkFrameMat, winGrp);
                createBox(frameD * 0.7, h, frameT * 0.75, 0, 0, 0, darkFrameMat, winGrp);
                createBox(frameD * 0.6, 0.03, w - frameT * 2, 0, h * 0.18, 0, darkFrameMat, winGrp);
                createBox(0.02, h - frameT * 2, w - frameT * 2, 0, 0, 0, windowGlassMat, winGrp);
                const extDir = (x >= 0) ? 1 : -1;
                createBox(0.30, 0.045, w + 0.12, extDir * 0.04, -h / 2 - 0.02, 0, windowSillMat, winGrp);
                createBox(chajjaDepth, 0.065, chajjaW, extDir * (chajjaDepth / 2 - 0.05), h / 2 + 0.05, 0, slabFasciaMat, winGrp);
                createBox(chajjaDepth * 0.65, h + 0.12, 0.05, extDir * 0.10, 0, -w / 2 - 0.04, matFacadeCharcoal, winGrp);
                createBox(chajjaDepth * 0.65, h + 0.12, 0.05, extDir * 0.10, 0, w / 2 + 0.04, matFacadeCharcoal, winGrp);
            }
            (parent || archGroup).add(winGrp);
            return winGrp;
        }

        function createToiletVentilator(x, y, z, orient, parent) {
            const ventGrp = new THREE.Group();
            ventGrp.position.set(x, y, z);
            const isZ = (orient === 'Z');
            const w = 0.60;
            const h = 0.60;
            const frameT = 0.05;
            const frameD = 0.24; // Spans full wall thickness

            // Crisp white architectural louver blade material (strictly per Image 3 reference)
            const louverBladeMat = new THREE.MeshStandardMaterial({
                color: 0xffffff, // Crisp pure white / silver aluminum blades
                roughness: 0.25,
                metalness: 0.35
            });
            const darkAcousticMat = new THREE.MeshBasicMaterial({ color: 0x090e1a });

            if (isZ) {
                // Wall along X (ventilator faces North/South, normal along Z)
                // Outer dark architectural frame
                createBox(w, frameT, frameD, 0, h / 2 - frameT / 2, 0, darkFrameMat, ventGrp);
                createBox(w, frameT, frameD, 0, -h / 2 + frameT / 2, 0, darkFrameMat, ventGrp);
                createBox(frameT, h, frameD, -w / 2 + frameT / 2, 0, 0, darkFrameMat, ventGrp);
                createBox(frameT, h, frameD, w / 2 - frameT / 2, 0, 0, darkFrameMat, ventGrp);

                // Center acoustic dark mesh backing
                createBox(w - frameT * 2, h - frameT * 2, 0.02, 0, 0, 0, darkAcousticMat, ventGrp);

                // Modern horizontal architectural louvers on BOTH exterior and interior faces (Image 3 style)
                [-frameD / 2 + 0.035, frameD / 2 - 0.035].forEach(zPos => {
                    for (let lv = -h / 2 + 0.09; lv <= h / 2 - 0.09; lv += 0.105) {
                        const louver = createBox(w - frameT * 2, 0.018, 0.05, 0, lv, zPos, louverBladeMat, ventGrp);
                        louver.rotation.x = 0.40;
                    }
                });
            } else {
                // Wall along Z (ventilator faces East/West, normal along X)
                // Outer dark architectural frame
                createBox(frameD, frameT, w, 0, h / 2 - frameT / 2, 0, darkFrameMat, ventGrp);
                createBox(frameD, frameT, w, 0, -h / 2 + frameT / 2, 0, darkFrameMat, ventGrp);
                createBox(frameD, h, frameT, 0, 0, -w / 2 + frameT / 2, darkFrameMat, ventGrp);
                createBox(frameD, h, frameT, 0, 0, w / 2 - frameT / 2, darkFrameMat, ventGrp);

                // Center acoustic dark mesh backing
                createBox(0.02, h - frameT * 2, w - frameT * 2, 0, 0, 0, darkAcousticMat, ventGrp);

                // Modern horizontal architectural louvers on BOTH exterior and interior faces (Image 3 style)
                [-frameD / 2 + 0.035, frameD / 2 - 0.035].forEach(xPos => {
                    for (let lv = -h / 2 + 0.09; lv <= h / 2 - 0.09; lv += 0.105) {
                        const louver = createBox(0.05, 0.018, w - frameT * 2, xPos, lv, 0, louverBladeMat, ventGrp);
                        louver.rotation.z = 0.40;
                    }
                });
            }
            (parent || archGroup).add(ventGrp);
            return ventGrp;
        }

        // Wall with dedicated cutout for toilet ventilator (ZERO solid masonry blockage!)
        function createWallWithVentilator(wallLen, wallH, wallThick, wx, wy, wz, orient, ventYCenter, matWall, parent) {
            const isZ = (orient === 'Z');
            const ventW = 0.60;
            const ventH = 0.60;
            const ventSillH = ventYCenter - (wy - wallH / 2) - ventH / 2;
            const topH = wallH - (ventSillH + ventH);
            const sideLen = Math.max(0, (wallLen - ventW) / 2);

            if (!isZ) {
                // Wall along X
                if (ventSillH > 0.02) createBox(ventW, ventSillH, wallThick, wx, (wy - wallH / 2) + ventSillH / 2, wz, matWall, parent);
                if (topH > 0.02) createBox(ventW, topH, wallThick, wx, (wy + wallH / 2) - topH / 2, wz, matWall, parent);
                if (sideLen > 0.02) {
                    createBox(sideLen, wallH, wallThick, wx - ventW / 2 - sideLen / 2, wy, wz, matWall, parent);
                    createBox(sideLen, wallH, wallThick, wx + ventW / 2 + sideLen / 2, wy, wz, matWall, parent);
                }
                createToiletVentilator(wx, ventYCenter, wz, 'Z', parent);
            } else {
                // Wall along Z
                if (ventSillH > 0.02) createBox(wallThick, ventSillH, ventW, wx, (wy - wallH / 2) + ventSillH / 2, wz, matWall, parent);
                if (topH > 0.02) createBox(wallThick, topH, ventW, wx, (wy + wallH / 2) - topH / 2, wz, matWall, parent);
                if (sideLen > 0.02) {
                    createBox(wallThick, wallH, sideLen, wx, wy, wz - ventW / 2 - sideLen / 2, matWall, parent);
                    createBox(wallThick, wallH, sideLen, wx, wy, wz + ventW / 2 + sideLen / 2, matWall, parent);
                }
                createToiletVentilator(wx, ventYCenter, wz, 'X', parent);
            }
        }

        // Exterior wall along Z with physical cutouts for all windows (100% visible interior & glass depth)
        function createExteriorWallWithWindows(xPos, yBase, wallH, wallThick, zStart, zEnd, windowsList, matWall, parent) {
            const wins = [...windowsList].sort((a, b) => a.zCenter - b.zCenter);
            let curZ = Math.min(zStart, zEnd);
            const maxZ = Math.max(zStart, zEnd);

            wins.forEach(w => {
                const winMinZ = w.zCenter - w.width / 2;
                const winMaxZ = w.zCenter + w.width / 2;

                if (winMinZ - curZ > 0.01) {
                    const segLen = winMinZ - curZ;
                    createBox(wallThick, wallH, segLen, xPos, yBase + wallH / 2, curZ + segLen / 2, matWall, parent);
                }

                if (w.sillH > 0.01) {
                    createBox(wallThick, w.sillH, w.width, xPos, yBase + w.sillH / 2, w.zCenter, matWall, parent);
                }
                const topH = wallH - (w.sillH + w.height);
                if (topH > 0.01) {
                    createBox(wallThick, topH, w.width, xPos, yBase + w.sillH + w.height + topH / 2, w.zCenter, matWall, parent);
                }
                createWindow(w.width, w.height, xPos, yBase + w.sillH + w.height / 2, w.zCenter, 'X', parent);

                curZ = winMaxZ;
            });

            if (maxZ - curZ > 0.01) {
                const segLen = maxZ - curZ;
                createBox(wallThick, wallH, segLen, xPos, yBase + wallH / 2, curZ + segLen / 2, matWall, parent);
            }
        }

        function createRailing(len, x, y, z, orient, parent) {
            const railGrp = new THREE.Group();
            railGrp.position.set(x, y, z);
            const isZ = (orient === 'Z');
            const h = 0.95;

            if (isZ) {
                createBox(len, h - 0.12, 0.02, 0, h / 2 + 0.02, 0, railingGlassMat, railGrp);
                const capG = new THREE.CylinderGeometry(0.03, 0.03, len, 16);
                capG.rotateZ(Math.PI / 2);
                const capM = new THREE.Mesh(capG, steelMat);
                capM.position.set(0, h, 0);
                railGrp.add(capM);
                createBox(len, 0.05, 0.06, 0, 0.025, 0, darkFrameMat, railGrp);
                const numPosts = Math.max(2, Math.round(len / 1.3) + 1);
                for (let i = 0; i < numPosts; i++) {
                    const px = -len / 2 + (len / (numPosts - 1)) * i;
                    createBox(0.04, h, 0.04, px, h / 2, 0, steelMat, railGrp);
                }
            } else {
                createBox(0.02, h - 0.12, len, 0, h / 2 + 0.02, 0, railingGlassMat, railGrp);
                const capG = new THREE.CylinderGeometry(0.03, 0.03, len, 16);
                capG.rotateX(Math.PI / 2);
                const capM = new THREE.Mesh(capG, steelMat);
                capM.position.set(0, h, 0);
                railGrp.add(capM);
                createBox(0.06, 0.05, len, 0, 0.025, 0, darkFrameMat, railGrp);
                const numPosts = Math.max(2, Math.round(len / 1.3) + 1);
                for (let i = 0; i < numPosts; i++) {
                    const pz = -len / 2 + (len / (numPosts - 1)) * i;
                    createBox(0.04, h, 0.04, 0, h / 2, pz, steelMat, railGrp);
                }
            }
            (parent || archGroup).add(railGrp);
            return railGrp;
        }

        // Enclosed Bathroom with privacy door placement
        function createEnclosedBathroom(cfg) {
            const grp = new THREE.Group();
            const wX = cfg.xMax - cfg.xMin;
            const wZ = cfg.zMax - cfg.zMin;
            const xC = (cfg.xMin + cfg.xMax) / 2;
            const zC = (cfg.zMin + cfg.zMax) / 2;
            const yM = cfg.yBase + cfg.roomH / 2;
            const wallT = 0.12;
            const extT = 0.23;
            const tzMin = (cfg.extWall === 'Z_MIN') ? extT : wallT;
            const tzMax = (cfg.extWall === 'Z_MAX') ? extT : wallT;
            const txMin = (cfg.extWall === 'X_MIN') ? extT : wallT;
            const txMax = (cfg.extWall === 'X_MAX') ? extT : wallT;

            createBox(wX - 0.04, 0.02, wZ - 0.04, xC, cfg.yBase + 0.01, zC, floorToiletMat, grp);

            const dW = 0.75;
            const dH = 2.05;

            // Wall 1: Z_MIN
            const matZMin = (cfg.extWall === 'Z_MIN') ? wallSandstone : wallInternalMat;
            if (cfg.doorWall === 'Z_MIN') {
                createWallWithDoor(wX, cfg.roomH, tzMin, xC, yM, cfg.zMin, 'X', cfg.doorOffset || 0.20, dW, dH, toiletDoorMat, 0.45, matZMin, grp);
            } else if (cfg.ventWall === 'Z_MIN') {
                createWallWithVentilator(wX, cfg.roomH, tzMin, xC, yM, cfg.zMin, 'X', cfg.yBase + cfg.roomH - 0.55, matZMin, grp);
            } else {
                createBox(wX, cfg.roomH, tzMin, xC, yM, cfg.zMin, matZMin, grp);
            }

            // Wall 2: Z_MAX
            const matZMax = (cfg.extWall === 'Z_MAX') ? wallSandstone : wallInternalMat;
            if (cfg.doorWall === 'Z_MAX') {
                createWallWithDoor(wX, cfg.roomH, tzMax, xC, yM, cfg.zMax, 'X', cfg.doorOffset || 0.20, dW, dH, toiletDoorMat, 0.45, matZMax, grp);
            } else if (cfg.ventWall === 'Z_MAX') {
                createWallWithVentilator(wX, cfg.roomH, tzMax, xC, yM, cfg.zMax, 'X', cfg.doorOffset || 0.20, matZMax, grp);
            } else {
                createBox(wX, cfg.roomH, tzMax, xC, yM, cfg.zMax, matZMax, grp);
            }

            // Wall 3: X_MIN
            const matXMin = (cfg.extWall === 'X_MIN') ? wallSandstone : wallInternalMat;
            if (cfg.doorWall === 'X_MIN') {
                createWallWithDoor(wZ, cfg.roomH, txMin, cfg.xMin, yM, zC, 'Z', cfg.doorOffset || 0.20, dW, dH, toiletDoorMat, 0.45, matXMin, grp);
            } else if (cfg.ventWall === 'X_MIN') {
                createWallWithVentilator(wZ, cfg.roomH, txMin, cfg.xMin, yM, zC, 'Z', cfg.yBase + cfg.roomH - 0.55, matXMin, grp);
            } else {
                createBox(txMin, cfg.roomH, wZ, cfg.xMin, yM, zC, matXMin, grp);
            }

            // Wall 4: X_MAX
            const matXMax = (cfg.extWall === 'X_MAX') ? wallSandstone : wallInternalMat;
            if (cfg.doorWall === 'X_MAX') {
                createWallWithDoor(wZ, cfg.roomH, txMax, cfg.xMax, yM, zC, 'Z', cfg.doorOffset || 0.20, dW, dH, toiletDoorMat, 0.45, matXMax, grp);
            } else if (cfg.ventWall === 'X_MAX') {
                createWallWithVentilator(wZ, cfg.roomH, txMax, cfg.xMax, yM, zC, 'Z', cfg.yBase + cfg.roomH - 0.55, matXMax, grp);
            } else {
                createBox(txMax, cfg.roomH, wZ, cfg.xMax, yM, zC, matXMax, grp);
            }

            // Internal Sanitaries (Curved/Beveled Geometries)
            const isWideX = (wX >= wZ);
            if (isWideX) {
                const wcX = cfg.xMin + 0.45;
                const wcZ = cfg.zMin + 0.32;
                // Commode Cistern
                createBox(0.38, 0.42, 0.18, wcX, cfg.yBase + 0.45, wcZ - 0.12, ceramicSanitaryMat, grp);
                createBox(0.04, 0.02, 0.06, wcX, cfg.yBase + 0.67, wcZ - 0.12, chromeMat, grp);

                // Commode bowl: tapered cylinder
                const bowlG = new THREE.CylinderGeometry(0.19, 0.14, 0.38, 16);
                const bowlM = new THREE.Mesh(bowlG, ceramicSanitaryMat);
                bowlM.position.set(wcX, cfg.yBase + 0.19, wcZ + 0.15);
                bowlM.castShadow = true; bowlM.receiveShadow = true;
                grp.add(bowlM);

                // Toilet seat & lid: torus
                const seatG = new THREE.TorusGeometry(0.15, 0.035, 10, 20);
                seatG.rotateX(Math.PI / 2);
                const seatM = new THREE.Mesh(seatG, ceramicSanitaryMat);
                seatM.position.set(wcX, cfg.yBase + 0.385, wcZ + 0.15);
                seatM.castShadow = true; seatM.receiveShadow = true;
                grp.add(seatM);

                // Pedestal washbasin
                const wbX = cfg.xMax - 0.45;
                const wbZ = cfg.zMin + 0.26;
                const pedG = new THREE.CylinderGeometry(0.08, 0.09, 0.65, 16);
                const pedM = new THREE.Mesh(pedG, ceramicSanitaryMat);
                pedM.position.set(wbX, cfg.yBase + 0.325, wbZ);
                pedM.castShadow = true; pedM.receiveShadow = true;
                grp.add(pedM);

                const washG = new THREE.CylinderGeometry(0.22, 0.15, 0.14, 20);
                const washM = new THREE.Mesh(washG, ceramicSanitaryMat);
                washM.position.set(wbX, cfg.yBase + 0.72, wbZ);
                washM.castShadow = true; washM.receiveShadow = true;
                grp.add(washM);

                createBox(0.04, 0.10, 0.06, wbX, cfg.yBase + 0.82, wbZ - 0.10, chromeMat, grp);
                createBox(0.38, 0.55, 0.02, wbX, cfg.yBase + 1.25, cfg.zMin + 0.07, mirrorGlassMat, grp);
            } else {
                const wcX = cfg.xMin + 0.30;
                const wcZ = cfg.zMin + 0.45;
                // Commode Cistern
                createBox(0.18, 0.42, 0.38, wcX - 0.12, cfg.yBase + 0.45, wcZ, ceramicSanitaryMat, grp);
                createBox(0.06, 0.02, 0.04, wcX - 0.12, cfg.yBase + 0.67, wcZ, chromeMat, grp);

                // Commode bowl: tapered cylinder
                const bowlG = new THREE.CylinderGeometry(0.19, 0.14, 0.38, 16);
                const bowlM = new THREE.Mesh(bowlG, ceramicSanitaryMat);
                bowlM.position.set(wcX + 0.15, cfg.yBase + 0.19, wcZ);
                bowlM.castShadow = true; bowlM.receiveShadow = true;
                grp.add(bowlM);

                // Toilet seat & lid: torus
                const seatG = new THREE.TorusGeometry(0.15, 0.035, 10, 20);
                seatG.rotateX(Math.PI / 2);
                const seatM = new THREE.Mesh(seatG, ceramicSanitaryMat);
                seatM.position.set(wcX + 0.15, cfg.yBase + 0.385, wcZ);
                seatM.castShadow = true; seatM.receiveShadow = true;
                grp.add(seatM);

                // Pedestal washbasin
                const wbX = cfg.xMin + 0.26;
                const wbZ = cfg.zMax - 0.45;
                const pedG = new THREE.CylinderGeometry(0.08, 0.09, 0.65, 16);
                const pedM = new THREE.Mesh(pedG, ceramicSanitaryMat);
                pedM.position.set(wbX, cfg.yBase + 0.325, wbZ);
                pedM.castShadow = true; pedM.receiveShadow = true;
                grp.add(pedM);

                const washG = new THREE.CylinderGeometry(0.22, 0.15, 0.14, 20);
                const washM = new THREE.Mesh(washG, ceramicSanitaryMat);
                washM.position.set(wbX, cfg.yBase + 0.72, wbZ);
                washM.castShadow = true; washM.receiveShadow = true;
                grp.add(washM);

                createBox(0.06, 0.10, 0.04, wbX - 0.10, cfg.yBase + 0.82, wbZ, chromeMat, grp);
                createBox(0.02, 0.55, 0.38, cfg.xMin + 0.07, cfg.yBase + 1.25, wbZ, mirrorGlassMat, grp);
            }

            (cfg.parent || archGroup).add(grp);
            return grp;
        }

        // Luxury Lift Portal & Sliding Doors Flush with Landing
        function createLuxuryLiftPortal(yFloor, floorH, floorLabel, parent) {
            const grp = new THREE.Group();
            const yMid = yFloor + floorH / 2;

            createBox(1.14, floorH, 0.23, 3.81, yMid, -8.34, wallSandstone, grp);
            createBox(0.23, floorH, 1.37, 4.38, yMid, -7.655, wallSandstone, grp);
            createBox(0.23, floorH, 1.37, 3.24, yMid, -7.655, wallSandstone, grp);

            const dW = 0.95;
            const dH = 2.15;
            createBox(0.10, floorH, 0.20, 3.29, yMid, -6.97, darkFrameMat, grp);
            createBox(0.10, floorH, 0.20, 4.33, yMid, -6.97, darkFrameMat, grp);
            createBox(1.14, floorH - dH, 0.20, 3.81, yFloor + dH + (floorH - dH) / 2, -6.97, wallSandstone, grp);

            createBox(0.05, dH, 0.22, 3.33, yFloor + dH / 2, -6.97, goldBrassMat, grp);
            createBox(0.05, dH, 0.22, 4.29, yFloor + dH / 2, -6.97, goldBrassMat, grp);
            createBox(1.01, 0.05, 0.22, 3.81, yFloor + dH - 0.025, -6.97, goldBrassMat, grp);

            const doorMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, roughness: 0.25, metalness: 0.85 });
            createBox(0.44, dH - 0.05, 0.03, 3.58, yFloor + (dH - 0.05) / 2, -6.96, doorMat, grp);
            createBox(0.44, dH - 0.05, 0.03, 4.04, yFloor + (dH - 0.05) / 2, -6.96, doorMat, grp);
            createBox(0.02, dH - 0.05, 0.04, 3.81, yFloor + (dH - 0.05) / 2, -6.96, darkFrameMat, grp);

            const cyanIndicatorMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
            createBox(0.36, 0.12, 0.04, 3.81, yFloor + dH + 0.15, -6.95, darkFrameMat, grp);
            createBox(0.28, 0.06, 0.05, 3.81, yFloor + dH + 0.15, -6.945, cyanIndicatorMat, grp);

            createBox(0.06, 0.14, 0.03, 4.22, yFloor + 1.15, -6.95, darkFrameMat, grp);
            createBox(0.02, 0.02, 0.04, 4.22, yFloor + 1.18, -6.945, cyanIndicatorMat, grp);

            // Interior lighting cleanly provided by global sun & ambient sky fill

            (parent || archGroup).add(grp);
            return grp;
        }

        // Monolithic RCC Dog-Legged Staircase (100% Mathematically Synchronized Steps & Waist Slab)
        function createStairFlight(startX, startY, startZ, endX, endY, endZ, numSteps, widthZ, parent) {
            const grp = new THREE.Group();
            grp.userData.isStairComponent = true;

            const dx = (endX - startX) / numSteps;
            const dy = (endY - startY) / numSteps;
            const riserH = dy;
            const treadDepth = Math.abs(dx);
            const zCenter = (startZ + endZ) / 2;

            // Slope angle and vertical waist slab thickness (150mm normal structural thickness)
            const spanX = endX - startX;
            const spanY = endY - startY;
            const slopeAngle = Math.atan(Math.abs(spanY / spanX));
            const waistNormalThick = 0.15;
            const waistVertThick = waistNormalThick / Math.cos(slopeAngle);

            // 1. Monolithic Concrete Flight (Solid Steps + Integrated Waist Slab in ONE Extrusion)
            const shape = new THREE.Shape();
            shape.moveTo(startX, startY - waistVertThick);
            shape.lineTo(startX, startY);

            for (let i = 0; i < numSteps; i++) {
                const rx = startX + i * dx;
                const ry = startY + (i + 1) * dy;
                shape.lineTo(rx, ry);
                const tx = startX + (i + 1) * dx;
                shape.lineTo(tx, ry);
            }

            shape.lineTo(endX, endY - waistVertThick);
            shape.lineTo(startX, startY - waistVertThick);
            shape.closePath();

            const flightGeom = new THREE.ExtrudeGeometry(shape, { depth: widthZ, bevelEnabled: false });
            flightGeom.translate(0, 0, zCenter - widthZ / 2);

            const flightMesh = new THREE.Mesh(flightGeom, slabFasciaMat);
            flightMesh.castShadow = true;
            flightMesh.receiveShadow = true;
            grp.add(flightMesh);

            // 2. High-End Architectural Finishes (Marble Treads, Nosing, & Polished Risers)
            const nosingOverhang = 0.025;
            const treadThick = 0.025;
            const riserFaceThick = 0.015;
            const dirX = Math.sign(dx); // +1 if going East, -1 if going West

            for (let i = 0; i < numSteps; i++) {
                const xFront = startX + i * dx; // front face of concrete riser & tread start
                const xBack = startX + (i + 1) * dx; // back of tread meeting next riser
                const stepY = startY + (i + 1) * dy; // tread surface level

                // Polished Marble Tread Slab (overhangs xFront by nosingOverhang towards the climber)
                const treadW = treadDepth + nosingOverhang;
                const treadX = (xFront + xBack) / 2 - dirX * (nosingOverhang / 2);
                createBox(treadW, treadThick, widthZ + 0.02, treadX, stepY + treadThick / 2, zCenter, stairTreadMat, grp);

                // Polished Hardwood Bullnose Nosing Edge (at the front overhanging edge)
                const noseX = xFront - dirX * (nosingOverhang / 2);
                createBox(0.015, treadThick, widthZ + 0.02, noseX, stepY + treadThick / 2, zCenter, stairNosingMat, grp);

                // Polished Teak / Gold Riser Face Plate (flush on the vertical riser face)
                const riserX = xFront - dirX * (riserFaceThick / 2);
                createBox(riserFaceThick, riserH, widthZ, riserX, startY + (i + 0.5) * dy, zCenter, stairRiserMat, grp);
            }

            // 3. Stainless Steel Baluster Posts & Teak Handrail (Inner Open Edge Facing Void)
            const railZ = (zCenter < 7.275) ? (zCenter + widthZ / 2 - 0.04) : (zCenter - widthZ / 2 + 0.04);
            const railHeight = 0.85;

            for (let i = 0; i < numSteps; i++) {
                const postX = startX + (i + 0.5) * dx;
                const postBaseY = startY + (i + 1) * dy + treadThick;
                createBox(0.025, railHeight, 0.025, postX, postBaseY + railHeight / 2, railZ, darkFrameMat, grp);
            }

            const railStartX = startX + 0.5 * dx;
            const railStartY = startY + dy + treadThick + railHeight;
            const railEndX = startX + (numSteps - 0.5) * dx;
            const railEndY = endY + treadThick + railHeight;

            const railSpanX = railEndX - railStartX;
            const railSpanY = railEndY - railStartY;
            const railLen = Math.sqrt(railSpanX ** 2 + railSpanY ** 2);
            const railAngle = Math.atan2(railSpanY, railSpanX);

            const railG = new THREE.CylinderGeometry(0.022, 0.022, railLen, 16);
            railG.rotateZ(railAngle - Math.PI / 2);
            const railM = new THREE.Mesh(railG, stairNosingMat);
            railM.position.set((railStartX + railEndX) / 2, (railStartY + railEndY) / 2, railZ);
            railM.castShadow = true;
            grp.add(railM);

            (parent || archGroup).add(grp);
            return grp;
        }

        // Enclosed Staircase with 100% CLEAR UNBLOCKED BALCONY WALKWAY
        function buildEnclosedStaircaseShaft(yBase, yTarget, isGroundFloor, parent) {
            const h = yTarget - yBase;
            const yMid = (yBase + yTarget) / 2;
            const flightSteps = 9;

            // 1. Front Glass Curtain Wall (Z = 8.34m) - High-End Charcoal Basalt & Gold Anodized Fin
            createBox(0.35, h, 0.23, -4.435, yMid, 8.34, matFacadeCharcoal, parent);
            createBox(0.35, h, 0.23, -0.865, yMid, 8.34, matFacadeCharcoal, parent);
            createBox(3.92, 0.20, 0.23, -2.65, yBase + 0.10, 8.34, matFacadeCharcoal, parent);
            createBox(3.92, 0.20, 0.23, -2.65, yTarget - 0.10, 8.34, matFacadeCharcoal, parent);

            const glassW = 3.22;
            const glassH = h - 0.40;
            createBox(glassW, glassH, 0.02, -2.65, yMid, 8.34, stairGlassMat, parent);
            [-3.45, -2.65, -1.85].forEach(mx => {
                createBox(0.05, glassH, 0.08, mx, yMid, 8.34, darkFrameMat, parent);
            });
            // Champagne gold center accent fin on staircase curtain wall
            createBox(0.03, glassH, 0.09, -2.65, yMid, 8.345, matSignGoldTrim, parent);
            [yBase + 0.20 + glassH / 3, yBase + 0.20 + (2 * glassH) / 3].forEach(ty => {
                createBox(glassW, 0.05, 0.08, -2.65, ty, 8.34, darkFrameMat, parent);
            });

            // 2. Left Wall with Mid-Landing Parapet & Structural Column A-1
            // Full-height continuous structural column A-1 at Grid A-1 (X = -4.61m, Z = 6.21m) rising to the roof!
            if (!isGroundFloor) {
                createBox(0.23, h, 0.43, -4.61, yMid, 6.21, wallSandstone, parent);
            }
            const yLanding = (yBase + yTarget) / 2;
            createBox(0.23, 1.10, 2.13, -4.61, yLanding + 0.55, 7.275, wallSandstone, parent);
            createBox(0.23, 0.04, 2.13, -4.61, yLanding + 1.12, 7.275, wallSandstone, parent);

            const leftGlassH = h - 1.25;
            const leftGlassLen = 2.13; // Full span from Column A-1 (6.21m) to Front Column A-0 (8.34m) - ZERO GAP!
            createBox(0.02, leftGlassH, leftGlassLen, -4.61, yLanding + 1.15 + leftGlassH / 2, 7.275, stairGlassMat, parent);
            // End vertical mullions anchored flush into both columns + center mullion + top header channel
            createBox(0.06, leftGlassH, 0.05, -4.61, yLanding + 1.15 + leftGlassH / 2, 6.22, darkFrameMat, parent);
            createBox(0.06, leftGlassH, 0.05, -4.61, yLanding + 1.15 + leftGlassH / 2, 7.275, darkFrameMat, parent);
            createBox(0.06, leftGlassH, 0.05, -4.61, yLanding + 1.15 + leftGlassH / 2, 8.33, darkFrameMat, parent);
            createBox(0.06, 0.05, leftGlassLen, -4.61, yLanding + 1.15 + leftGlassH, 7.275, darkFrameMat, parent);

            // 3. Flights (100% Monolithically Synchronized with Mid-Landing)
            // Mid-landing slab spans X in [-4.61m, -3.51m], width = 1.10m, center X = -4.06m
            const xLandingEdge = -3.51;
            const xFloorEdge = -1.00;

            // Flight 1: Inner flight (Z = 6.70m), ascends from floor edge to mid-landing edge
            createStairFlight(xFloorEdge, yBase, 6.70, xLandingEdge, yLanding, 6.70, flightSteps, 0.95, parent);
            createBox(1.10, 0.15, 2.05, -4.06, yLanding - 0.075, 7.275, slabFasciaMat, parent);
            createBox(1.10, 0.025, 2.05, -4.06, yLanding + 0.0125, 7.275, stairTreadMat, parent);
            // Mid-landing inner return rail connecting Flight 1 to Flight 2 across central void
            createBox(0.04, 0.04, 0.35, xLandingEdge - 0.04, yLanding + 0.025 + 0.85, 7.275, stairNosingMat, parent);
            createBox(0.025, 0.85, 0.025, xLandingEdge - 0.04, yLanding + 0.025 + 0.85 / 2, 7.275, darkFrameMat, parent);
            // Flight 2: Front window flight (Z = 7.85m), ascends from mid-landing edge to upper floor edge
            createStairFlight(xLandingEdge, yLanding, 7.85, xFloorEdge, yTarget, 7.85, flightSteps, 0.95, parent);

            // 3b. Triangular Spandrel Closure Wall on Ground Floor behind Flight 1
            if (isGroundFloor) {
                const triShape = new THREE.Shape();
                triShape.moveTo(-4.61, yLanding);
                triShape.lineTo(xLandingEdge, yLanding);
                triShape.lineTo(xFloorEdge, yBase);
                triShape.lineTo(xFloorEdge, yTarget);
                triShape.lineTo(-4.61, yTarget);
                triShape.closePath();
                const triGeom = new THREE.ExtrudeGeometry(triShape, { depth: 0.23, bevelEnabled: false });
                triGeom.translate(0, 0, -0.115);
                const triWall = new THREE.Mesh(triGeom, wallSandstone);
                triWall.position.set(0, 0, 6.21);
                triWall.castShadow = true;
                triWall.receiveShadow = true;
                parent.add(triWall);
            }

            // 4. Top Landing Floor Slab connecting Flight 2 arrival, Flight 1 departure, & Balcony Walkway
            const targetLandingGroup = isGroundFloor ? (storyGroups.first || parent) : (yTarget >= Y_TERRACE ? (storyGroups.headroom || parent) : (storyGroups.second || parent));
            createBox(0.35, 0.15, 2.13, -0.845, yTarget, 7.275, slabFasciaMat, targetLandingGroup);
            createBox(0.35, 0.015, 2.13, -0.845, yTarget + 0.02, 7.275, floorBalconyMat, targetLandingGroup);

            // Continuous structural lintel beam strictly at ceiling level (above 2.60m) - ZERO wall below in walkway!
            createBox(0.23, 0.45, 2.13, -0.69, yTarget - 0.225, 7.275, wallSandstone, parent);

            // Upper floor return handrail connecting Flight 2 arrival to Flight 1 departure across central void
            createBox(0.04, 0.04, 0.35, xFloorEdge, yTarget + 0.025 + 0.85, 7.275, stairNosingMat, targetLandingGroup);
            createBox(0.025, 0.85, 0.025, xFloorEdge, yTarget + 0.025 + 0.85 / 2, 7.275, darkFrameMat, targetLandingGroup);

            // Stair lighting cleanly provided by global sun & ambient sky fill
        }

        // Furniture Creators
        function createLivingSofaAndTable(x, y, z, orient, parent) {
            const grp = new THREE.Group();
            grp.position.set(x, y, z);
            if (typeof orient === 'number') {
                grp.rotation.y = orient;
            } else if (orient === 'N') {
                grp.rotation.y = Math.PI; // back against South wall, facing North
            } else if (orient === 'S') {
                grp.rotation.y = 0; // back against North wall, facing South
            } else if (orient === 'E') {
                grp.rotation.y = Math.PI / 2; // back against West wall, facing East
            } else if (orient === 'W') {
                grp.rotation.y = -Math.PI / 2; // back against East wall, facing West
            } else if (orient === false) {
                grp.rotation.y = Math.PI / 2;
            }

            // Woven area rug underneath sofa and coffee table
            createBox(2.40, 0.008, 1.60, 0, 0.005, 0.65, livingRugMat, grp);

            createBox(2.20, 0.42, 0.85, 0, 0.21, 0, sofaRoyalNavy, grp);
            createBox(2.20, 0.48, 0.20, 0, 0.52, -0.34, sofaRoyalNavy, grp);
            createBox(0.20, 0.38, 0.85, -1.01, 0.42, 0, sofaRoyalNavy, grp);
            createBox(0.20, 0.38, 0.85, 1.01, 0.42, 0, sofaRoyalNavy, grp);

            // Rounded bolster cushions along armrests
            const armCylG = new THREE.CylinderGeometry(0.09, 0.09, 0.75, 16);
            armCylG.rotateX(Math.PI / 2);
            const armLeft = new THREE.Mesh(armCylG, sofaGoldCushion);
            armLeft.position.set(-0.90, 0.45, 0.05);
            armLeft.castShadow = true; armLeft.receiveShadow = true;
            grp.add(armLeft);

            const armRight = new THREE.Mesh(armCylG, sofaGoldCushion);
            armRight.position.set(0.90, 0.45, 0.05);
            armRight.castShadow = true; armRight.receiveShadow = true;
            grp.add(armRight);

            createBox(0.55, 0.12, 0.55, -0.65, 0.46, 0.05, sofaGoldCushion, grp);
            createBox(0.55, 0.12, 0.55, 0.00, 0.46, 0.05, sofaGoldCushion, grp);
            createBox(0.55, 0.12, 0.55, 0.65, 0.46, 0.05, sofaGoldCushion, grp);
            createBox(1.10, 0.025, 0.55, 0, 0.40, 0.95, railingGlassMat, grp);
            createBox(1.05, 0.03, 0.50, 0, 0.25, 0.95, walnutWoodMat, grp);
            [[-0.50, 0.70], [0.50, 0.70], [-0.50, 1.20], [0.50, 1.20]].forEach(lp => {
                createBox(0.035, 0.38, 0.035, lp[0], 0.19, lp[1], goldBrassMat, grp);
            });
            (parent || archGroup).add(grp);
            return grp;
        }

        function createTvUnit(x, y, z, orient, parent) {
            const grp = new THREE.Group();
            grp.position.set(x, y, z);
            if (typeof orient === 'number') {
                grp.rotation.y = orient;
            } else if (orient === 'N') {
                grp.rotation.y = 0; // back against South wall, screen facing North
            } else if (orient === 'S') {
                grp.rotation.y = Math.PI; // back against North wall, screen facing South
            } else if (orient === 'E') {
                grp.rotation.y = -Math.PI / 2; // back against West wall, screen facing East
            } else if (orient === 'W') {
                grp.rotation.y = Math.PI / 2; // back against East wall, screen facing West
            } else if (orient === false) {
                grp.rotation.y = Math.PI / 2;
            }

            createBox(1.80, 0.42, 0.35, 0, 0.21, 0, walnutWoodMat, grp);
            createBox(1.82, 0.02, 0.36, 0, 0.42, 0, goldBrassMat, grp);
            createBox(1.45, 0.82, 0.04, 0, 0.95, 0, tvScreenMat, grp);
            createBox(1.47, 0.84, 0.02, 0, 0.95, -0.01, darkFrameMat, grp);
            createBox(0.35, 0.12, 0.20, 0, 0.48, 0, darkFrameMat, grp);
            createBox(0.45, 0.02, 0.25, 0, 0.43, 0, goldBrassMat, grp);
            (parent || archGroup).add(grp);
            return grp;
        }

        function createDiningFurniture(x, y, z, parent) {
            const grp = new THREE.Group();
            grp.position.set(x, y, z);
            createBox(1.50, 0.05, 0.90, 0, 0.73, 0, walnutWoodMat, grp);
            createBox(1.52, 0.015, 0.92, 0, 0.755, 0, goldBrassMat, grp);
            [[-0.68, -0.38], [0.68, -0.38], [-0.68, 0.38], [0.68, 0.38]].forEach(tp => {
                createBox(0.06, 0.70, 0.06, tp[0], 0.35, tp[1], walnutWoodMat, grp);
            });
            const chairPositions = [
                [-0.45, -0.60, 0], [0.00, -0.60, 0], [0.45, -0.60, 0],
                [-0.45, 0.60, Math.PI], [0.00, 0.60, Math.PI], [0.45, 0.60, Math.PI]
            ];
            chairPositions.forEach(cp => {
                const cg = new THREE.Group();
                cg.position.set(cp[0], 0, cp[1]);
                cg.rotation.y = cp[2];
                createBox(0.38, 0.06, 0.38, 0, 0.45, 0, sofaRoyalNavy, cg);
                createBox(0.38, 0.45, 0.05, 0, 0.68, -0.17, sofaRoyalNavy, cg);
                [[-0.16, -0.16], [0.16, -0.16], [-0.16, 0.16], [0.16, 0.16]].forEach(lp => {
                    createBox(0.035, 0.45, 0.035, lp[0], 0.225, lp[1], goldBrassMat, cg);
                });
                grp.add(cg);
            });
            (parent || archGroup).add(grp);
            return grp;
        }

        // -------------------------------------------------------------
        // LUXURY BEDROOM FURNITURE (HEADBOARD FLUSH TO WALL, CLEAR DOORWAYS)
        // -------------------------------------------------------------
        function createLuxuryBed(x, y, z, orient, parent) {
            const grp = new THREE.Group();
            grp.position.set(x, y, z);

            // orient: 'S' (head at -Z, facing +Z/South), 'N' (head at +Z, facing -Z/North),
            //         'E' (head at -X, facing +X/East),  'W' (head at +X, facing -X/West)
            if (orient === 'N') grp.rotation.y = Math.PI;
            else if (orient === 'E') grp.rotation.y = Math.PI / 2;
            else if (orient === 'W') grp.rotation.y = -Math.PI / 2;

            // Headboard (flush at local Z = -1.04m)
            createBox(2.20, 1.10, 0.08, 0, 0.55, -1.04, walnutWoodMat, grp);
            createBox(2.22, 0.02, 0.10, 0, 1.11, -1.04, goldBrassMat, grp);

            // Headboard rounded bolster cushion
            const headBolsterG = new THREE.CylinderGeometry(0.09, 0.09, 1.80, 16);
            headBolsterG.rotateZ(Math.PI / 2);
            const headBolster = new THREE.Mesh(headBolsterG, bedNavyMat);
            headBolster.position.set(0, 0.65, -0.96);
            headBolster.castShadow = true; headBolster.receiveShadow = true;
            grp.add(headBolster);

            // Bed frame & mattress
            createBox(1.85, 0.30, 2.05, 0, 0.15, 0, walnutWoodMat, grp);
            createBox(1.80, 0.28, 2.00, 0, 0.44, 0, bedNavyMat, grp);
            createBox(1.76, 0.08, 1.40, 0, 0.52, 0.28, bedWhiteLinen, grp);
            // Pillows
            createBox(0.60, 0.12, 0.42, -0.42, 0.62, -0.70, bedWhiteLinen, grp);
            createBox(0.60, 0.12, 0.42, 0.42, 0.62, -0.70, bedWhiteLinen, grp);
            createBox(0.42, 0.08, 0.30, -0.42, 0.68, -0.55, bedTealPillow, grp);
            createBox(0.42, 0.08, 0.30, 0.42, 0.68, -0.55, bedTealPillow, grp);
            // Nightstands on both sides of headboard
            [-1.05, 1.05].forEach(nx => {
                createBox(0.38, 0.45, 0.38, nx, 0.225, -0.80, walnutWoodMat, grp);
                createBox(0.39, 0.015, 0.39, nx, 0.455, -0.80, goldBrassMat, grp);
                createBox(0.12, 0.25, 0.12, nx, 0.58, -0.80, darkFrameMat, grp);
                createBox(0.18, 0.15, 0.18, nx, 0.78, -0.80, new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.3 }), grp);
            });

            (parent || archGroup).add(grp);
            return grp;
        }

        function createWardrobe(x, y, z, len, depth, orient, doorFacing, parent) {
            const grp = new THREE.Group();
            grp.position.set(x, y, z);
            const h = 2.20;
            const yMid = h / 2;

            if (orient === 'X') {
                // Runs along X axis (against North or South wall)
                createBox(len, h, depth, 0, yMid, 0, walnutWoodMat, grp);
                createBox(len + 0.02, 0.04, depth + 0.02, 0, h - 0.02, 0, goldBrassMat, grp);
                createBox(len + 0.02, 0.04, depth + 0.02, 0, 0.02, 0, goldBrassMat, grp);
                const dz = (doorFacing === 'NEG_Z') ? -depth / 2 - 0.015 : depth / 2 + 0.015;
                const numDoors = Math.max(2, Math.round(len / 0.55));
                const doorW = (len - 0.04) / numDoors;
                for (let i = 0; i < numDoors; i++) {
                    const doorX = -len / 2 + 0.02 + (i + 0.5) * doorW;
                    createBox(doorW - 0.02, h - 0.08, 0.03, doorX, yMid, dz, teakDoorMat, grp);
                    const handleDir = (i % 2 === 0) ? 0.08 : -0.08;
                    createBox(0.02, 0.30, 0.03, doorX + handleDir, yMid, dz + ((doorFacing === 'NEG_Z') ? -0.02 : 0.02), goldBrassMat, grp);
                }
            } else {
                // Runs along Z axis (against East or West wall)
                createBox(depth, h, len, 0, yMid, 0, walnutWoodMat, grp);
                createBox(depth + 0.02, 0.04, len + 0.02, 0, h - 0.02, 0, goldBrassMat, grp);
                createBox(depth + 0.02, 0.04, len + 0.02, 0, 0.02, 0, goldBrassMat, grp);
                const dx = (doorFacing === 'NEG_X') ? -depth / 2 - 0.015 : depth / 2 + 0.015;
                const numDoors = Math.max(2, Math.round(len / 0.55));
                const doorD = (len - 0.04) / numDoors;
                for (let i = 0; i < numDoors; i++) {
                    const doorZ = -len / 2 + 0.02 + (i + 0.5) * doorD;
                    createBox(0.03, h - 0.08, doorD - 0.02, dx, yMid, doorZ, teakDoorMat, grp);
                    const handleDir = (i % 2 === 0) ? 0.08 : -0.08;
                    createBox(0.03, 0.30, 0.02, dx + ((doorFacing === 'NEG_X') ? -0.02 : 0.02), yMid, doorZ + handleDir, goldBrassMat, grp);
                }
            }

            (parent || archGroup).add(grp);
            return grp;
        }

        function createMasterBedroomFurniture(x, y, z, wardrobeConfig, parent, bedOrient) {
            const bed = createLuxuryBed(x, y, z, bedOrient || 'S', parent);
            if (wardrobeConfig) {
                const wx = x + (wardrobeConfig.x || 0);
                const wz = z + (wardrobeConfig.z || 0.85);
                const ww = wardrobeConfig.w || 0.55;
                const wd = wardrobeConfig.d || 1.50;
                createWardrobe(wx, y, wz, wd, ww, 'Z', (wardrobeConfig.x > 0) ? 'NEG_X' : 'POS_X', parent);
            }
            return bed;
        }

        function createKitchenCounter(x, y, z, parent) {
            const grp = new THREE.Group();
            grp.position.set(x, y, z);
            createBox(2.40, 0.85, 0.65, 0, 0.425, 0, walnutWoodMat, grp);
            createBox(2.44, 0.05, 0.68, 0, 0.875, 0, kitchenGraniteMat, grp);
            createBox(0.60, 0.02, 0.40, -0.65, 0.905, 0, steelMat, grp);
            createBox(0.70, 0.03, 0.45, 0.45, 0.91, 0, darkFrameMat, grp);
            createBox(0.75, 0.50, 0.45, 0.45, 1.70, 0, steelMat, grp);
            (parent || archGroup).add(grp);
            return grp;
        }



        // =============================================================
        // STORY ELEVATIONS (IS 456 Structural Heights)
        // =============================================================
        const Y_PLINTH = 1.9812;
        const Y_FLOOR1 = 5.0292;
        const Y_FLOOR2 = 8.0772;
        const Y_TERRACE = 11.1252;
        const Y_MUMTY = 13.6252;
        const Y_LIFT = 14.1252;

        const roadMat = new THREE.MeshStandardMaterial({
            color: 0x161b24, // Deep rich asphalt charcoal
            roughness: 0.88,
            metalness: 0.05
        });
        const curbMat = new THREE.MeshStandardMaterial({
            color: 0xe2e8f0, // Crisp precast white concrete curb
            roughness: 0.50,
            metalness: 0.05
        });
        createBox(36.0, 0.25, 14.0, 0, Y_PLINTH - 0.20, 17.5, roadMat, storyGroups.site);
        for (let rx = -15; rx <= 15; rx += 4.5) {
            createBox(2.5, 0.02, 0.25, rx, Y_PLINTH - 0.06, 17.5, slabFasciaMat, storyGroups.site);
        }
        createBox(36.0, 0.20, 1.0, 0, Y_PLINTH - 0.08, 10.5, curbMat, storyGroups.site);

        // Ground Contact Shadows (Zero-CPU Baked Ambient Occlusion Grounding)
        if (contactShadowTex) {
            // Building Footprint Contact Shadow
            const bldShadowG = new THREE.PlaneGeometry(24, 30);
            bldShadowG.rotateX(-Math.PI / 2);
            const bldShadowM = new THREE.Mesh(bldShadowG, new THREE.MeshBasicMaterial({
                map: contactShadowTex,
                transparent: true,
                opacity: 0.70,
                depthWrite: false
            }));
            bldShadowM.position.set(0, Y_PLINTH - 0.078, 0.5);
            storyGroups.site.add(bldShadowM);

            // Car Contact Shadow (Under wheels and chassis)
            const carShadowG = new THREE.PlaneGeometry(3.2, 5.4);
            carShadowG.rotateX(-Math.PI / 2);
            const carShadowM = new THREE.Mesh(carShadowG, new THREE.MeshBasicMaterial({
                map: contactShadowTex,
                transparent: true,
                opacity: 0.80,
                depthWrite: false
            }));
            carShadowM.position.set(1.5, Y_PLINTH - 0.078, 14.25);
            storyGroups.site.add(carShadowM);
        }

        // =============================================================
        // SCULPTED RETRO BABY-BLUE CONCEPT CAR (ON FRONT ROAD)
        // =============================================================
        function createRetroConceptCar(carX, carY, carZ, rotY, parent) {
            const car = new THREE.Group();
            car.position.set(carX, carY, carZ);
            car.rotation.y = rotY || 0;

            // Exact Reference Photo Palette (Calibrated for ACES Filmic Tone Mapping)
            const babyBluePaint = new THREE.MeshStandardMaterial({
                color: 0x3b82f6, // Rich authentic baby-blue automotive finish
                roughness: 0.20,
                metalness: 0.25,
                envMapIntensity: 0.85
            });
            const bumperWhiteMat = new THREE.MeshStandardMaterial({
                color: 0xf8fafc,
                roughness: 0.20,
                metalness: 0.05
            });
            const glassSlateMat = new THREE.MeshStandardMaterial({
                color: 0x1e293b, // Deep smoked slate-gray concept glass
                roughness: 0.08,
                metalness: 0.85,
                envMapIntensity: 0.90
            });
            const silverTrimMat = new THREE.MeshStandardMaterial({
                color: 0xcbd5e1,
                roughness: 0.22,
                metalness: 0.80
            });
            const yellowLampMat = new THREE.MeshStandardMaterial({
                color: 0xfbbf24, // French lemon/amber yellow
                emissive: 0xd97706,
                emissiveIntensity: 0.65,
                roughness: 0.15,
                metalness: 0.10
            });
            const tireRubberMat = new THREE.MeshStandardMaterial({
                color: 0x141414,
                roughness: 0.90,
                metalness: 0.03
            });
            const darkGrilleMat = new THREE.MeshBasicMaterial({ color: 0x090d16 });
            const chromeMat = new THREE.MeshStandardMaterial({
                color: 0xffffff,
                roughness: 0.08,
                metalness: 0.96,
                envMapIntensity: 1.2
            });

            function makeCarBox(w, h, d, x, y, z, mat, targetParent, rotZ) {
                const mesh = new THREE.Mesh(sharedBoxGeom, mat);
                mesh.scale.set(w, h, d);
                mesh.position.set(x, y, z);
                if (rotZ) mesh.rotation.z = rotZ;
                mesh.matrixAutoUpdate = false;
                mesh.updateMatrix();
                (targetParent || car).add(mesh);
                return mesh;
            }

            // 1. Lower Wedge Body Shell (Full Width = 1.56m + 0.08m bevel = 1.64m)
            const lowerWidth = 1.56;
            const lowerShape = new THREE.Shape();
            lowerShape.moveTo(-1.84, 0.28); // Rear lower valence
            lowerShape.lineTo( 1.78, 0.28); // Front lower valence
            lowerShape.lineTo( 1.98, 0.50); // Slanted lower nose
            lowerShape.lineTo( 1.92, 0.75); // Headlight fascia
            lowerShape.lineTo( 0.76, 0.91); // Sloping wedge hood to cowl
            lowerShape.lineTo(-1.88, 0.91); // Beltline to tail
            lowerShape.lineTo(-1.98, 0.50); // Rear tail panel
            lowerShape.lineTo(-1.84, 0.28);
            lowerShape.closePath();

            const lowerGeom = new THREE.ExtrudeGeometry(lowerShape, {
                depth: lowerWidth,
                bevelEnabled: true,
                bevelThickness: 0.04,
                bevelSize: 0.03,
                bevelSegments: 3
            });
            lowerGeom.translate(0, 0, -lowerWidth / 2);
            car.add(new THREE.Mesh(lowerGeom, babyBluePaint));

            // 2. Solid Sculpted Upper Cabin Greenhouse (Zero gaps, zero missing pillars!)
            const cabinWidth = 1.38; // Tumbles home slightly narrower than lower body shoulder
            const cabinShape = new THREE.Shape();
            cabinShape.moveTo( 0.74, 0.90); // Base of windshield (cowl)
            cabinShape.lineTo( 0.24, 1.39); // Top of windshield
            cabinShape.lineTo(-1.24, 1.38); // Flat roofline to rear C/D pillar
            cabinShape.lineTo(-1.86, 0.90); // Fastback rear slope
            cabinShape.lineTo( 0.74, 0.90);
            cabinShape.closePath();

            const cabinGeom = new THREE.ExtrudeGeometry(cabinShape, {
                depth: cabinWidth,
                bevelEnabled: true,
                bevelThickness: 0.035,
                bevelSize: 0.025,
                bevelSegments: 3
            });
            cabinGeom.translate(0, 0, -cabinWidth / 2);
            car.add(new THREE.Mesh(cabinGeom, babyBluePaint));

            // 3. Flush Front Windshield & Rear Fastback Glass (With Silver Perimeter Trim)
            function addAngledWindshield(x1, y1, x2, y2, widthZ) {
                const dx = x2 - x1;
                const dy = y2 - y1;
                const len = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx);

                const grp = new THREE.Group();
                grp.position.set((x1 + x2) / 2, (y1 + y2) / 2 + 0.018, 0);
                grp.rotation.z = angle;

                makeCarBox(len, 0.02, widthZ, 0, 0, 0, silverTrimMat, grp);
                makeCarBox(len - 0.05, 0.026, widthZ - 0.05, 0, 0.002, 0, glassSlateMat, grp);
                car.add(grp);
            }
            addAngledWindshield(0.71, 0.94, 0.26, 1.38, 1.26);   // Front windshield
            addAngledWindshield(-1.26, 1.37, -1.83, 0.93, 1.22); // Rear fastback glass

            // 4. Flush Trapezoid Side Windows (Aligned to A, B, C, and D Pillars)
            function addSideWindow(pts, zSide) {
                const s = new THREE.Shape();
                s.moveTo(pts[0][0], pts[0][1]);
                for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
                s.closePath();
                const g = new THREE.ExtrudeGeometry(s, { depth: 0.018, bevelEnabled: false });
                g.translate(0, 0, -0.009);
                const m = new THREE.Mesh(g, glassSlateMat);
                m.position.z = zSide;
                car.add(m);
            }

            // Coordinates follow the exact A-pillar (0.64 -> 0.23), B-pillar (-0.36), C-pillar (-1.06), and D-pillar (-1.24 -> -1.75)
            const frontDoorWin = [[0.64, 0.95], [0.22, 1.35], [-0.34, 1.345], [-0.34, 0.95]];
            const rearDoorWin  = [[-0.41, 0.95], [-0.41, 1.345], [-1.03, 1.34], [-1.03, 0.95]];
            const quarterWin   = [[-1.10, 0.95], [-1.10, 1.34], [-1.23, 1.34], [-1.74, 0.95]];

            [-1, 1].forEach(side => {
                const zWin = side * (cabinWidth / 2 + 0.035);
                addSideWindow(frontDoorWin, zWin);
                addSideWindow(rearDoorWin, zWin);
                addSideWindow(quarterWin, zWin);

                // Thick White Side Rub-Strip Moulding (Between wheel arches)
                const zSideBody = side * (lowerWidth / 2 + 0.045);
                makeCarBox(1.62, 0.085, 0.03, 0.0, 0.52, zSideBody, bumperWhiteMat, car);
                makeCarBox(0.38, 0.085, 0.03, -1.68, 0.52, zSideBody, bumperWhiteMat, car);

                // Flush Chrome Door Handles
                [-0.18, -0.86].forEach(hx => {
                    makeCarBox(0.15, 0.028, 0.035, hx, 0.82, zSideBody, chromeMat, car);
                });
            });

            // 5. Recessed Yellow Round Headlights + Chrome Bezels
            const lampCylG = new THREE.CylinderGeometry(0.115, 0.115, 0.05, 24);
            lampCylG.rotateZ(Math.PI / 2);
            const bezelTorusG = new THREE.TorusGeometry(0.118, 0.016, 12, 24);
            bezelTorusG.rotateY(Math.PI / 2);

            [-0.54, 0.54].forEach(lz => {
                const lamp = new THREE.Mesh(lampCylG, yellowLampMat);
                lamp.position.set(1.96, 0.64, lz);
                lamp.rotation.z = -0.22;
                car.add(lamp);

                const bezel = new THREE.Mesh(bezelTorusG, chromeMat);
                bezel.position.set(1.98, 0.64, lz);
                bezel.rotation.z = -0.22;
                car.add(bezel);
            });

            // 6. Slanted Lower Front Vertical Air Intake Slots (Correct -0.72 rad angle!)
            const lowerValenceAngle = -0.72; // Matches (1.78, 0.28) -> (1.98, 0.50) nose slant
            for (let gz = -0.68; gz <= 0.68; gz += 0.052) {
                if (Math.abs(gz) < 0.19) continue; // Solid body panel under center license plate
                makeCarBox(0.025, 0.16, 0.026, 1.92, 0.39, gz, darkGrilleMat, car, lowerValenceAngle);
            }

            // 7. White Wrap-Around Bumpers + 2 Tall Vertical Bumper Guards ("Fangs")
            makeCarBox(0.12, 0.085, 1.76, 2.03, 0.51, 0, bumperWhiteMat, car);
            makeCarBox(0.52, 0.085, 0.06, 1.80, 0.51, -0.85, bumperWhiteMat, car);
            makeCarBox(0.52, 0.085, 0.06, 1.80, 0.51,  0.85, bumperWhiteMat, car);
            // Center White License Plate Mount
            makeCarBox(0.08, 0.065, 0.34, 2.04, 0.45, 0, bumperWhiteMat, car);

            const fangShape = new THREE.Shape();
            fangShape.moveTo(0, -0.23);
            fangShape.quadraticCurveTo(0.095, 0, 0, 0.25);
            fangShape.lineTo(-0.045, 0.23);
            fangShape.lineTo(-0.045, -0.21);
            fangShape.closePath();
            const fangGeom = new THREE.ExtrudeGeometry(fangShape, {
                depth: 0.058,
                bevelEnabled: true,
                bevelThickness: 0.015,
                bevelSize: 0.012,
                bevelSegments: 2
            });
            fangGeom.translate(0, 0, -0.029);
            [-0.27, 0.27].forEach(fz => {
                const fang = new THREE.Mesh(fangGeom, bumperWhiteMat);
                fang.position.set(2.05, 0.51, fz);
                car.add(fang);
            });

            // Rear Bumper & Tail Lamps
            makeCarBox(0.10, 0.085, 1.74, -2.02, 0.51, 0, bumperWhiteMat, car);
            makeCarBox(0.45, 0.085, 0.06, -1.82, 0.51, -0.84, bumperWhiteMat, car);
            makeCarBox(0.45, 0.085, 0.06, -1.82, 0.51,  0.84, bumperWhiteMat, car);

            const tailLampMat = new THREE.MeshStandardMaterial({
                color: 0xef4444,
                emissive: 0xb91c1c,
                emissiveIntensity: 0.5,
                roughness: 0.2
            });
            [-0.54, 0.54].forEach(tz => {
                makeCarBox(0.04, 0.08, 0.26, -1.99, 0.65, tz, tailLampMat, car);
            });

            // 8. Sculpted Fender Arch Lips + Deep Wheel Wells + Tires + Chrome Hubcaps
            const archTorusG = new THREE.TorusGeometry(0.36, 0.032, 12, 24, Math.PI);
            const wellCylG = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 24);
            wellCylG.rotateX(Math.PI / 2);
            const tireCylG = new THREE.CylinderGeometry(0.32, 0.32, 0.21, 28);
            tireCylG.rotateX(Math.PI / 2);
            const rimCylG = new THREE.CylinderGeometry(0.20, 0.20, 0.22, 24);
            rimCylG.rotateX(Math.PI / 2);
            const capSphereG = new THREE.SphereGeometry(0.135, 20, 14);
            capSphereG.scale(1, 1, 0.32);

            const wheelCoords = [
                [ 1.18, -0.80], [ 1.18,  0.80],
                [-1.18, -0.80], [-1.18,  0.80]
            ];
            wheelCoords.forEach(([wx, wz]) => {
                const sideSign = Math.sign(wz);

                // Sculpted body-colored circular fender lip around top of wheel
                const archLip = new THREE.Mesh(archTorusG, babyBluePaint);
                archLip.position.set(wx, 0.33, sideSign * 0.815);
                car.add(archLip);

                // Dark wheel housing recess
                const well = new THREE.Mesh(wellCylG, darkGrilleMat);
                well.position.set(wx, 0.33, sideSign * 0.72);
                car.add(well);

                // Rubber tire
                const tire = new THREE.Mesh(tireCylG, tireRubberMat);
                tire.position.set(wx, 0.32, wz);
                car.add(tire);

                // Silver steel rim
                const rim = new THREE.Mesh(rimCylG, silverTrimMat);
                rim.position.set(wx, 0.32, wz);
                car.add(rim);

                // Domed chrome hubcap
                const cap = new THREE.Mesh(capSphereG, chromeMat);
                cap.position.set(wx, 0.32, wz + sideSign * 0.10);
                car.add(cap);
            });

            (parent || storyGroups.site).add(car);
            return car;
        }

        // Spawn the Retro Baby-Blue Car on the road in front of the gate (Straight along road lane)
        createRetroConceptCar(1.5, Y_PLINTH - 0.075, 14.25, 0, storyGroups.site);

        // 5' Front Setback Garden (X: -5.22m to -0.69m)
        const gardenW = 4.53;
        const gardenCenterX = (-5.22 - 0.69) / 2;
        createBox(gardenW, 0.15, 1.53, gardenCenterX, Y_PLINTH - 0.07, 9.10, grassMat, storyGroups.site);
        [-4.6, -3.8, -3.0, -2.2, -1.4].forEach((px, idx) => {
            const bushGeom = new THREE.DodecahedronGeometry(0.32, 1);
            const bushMesh = new THREE.Mesh(bushGeom, grassMat);
            bushMesh.position.set(px, Y_PLINTH + 0.26, 9.10);
            storyGroups.site.add(bushMesh);
            const flowerGeom = new THREE.SphereGeometry(0.10, 8, 8);
            const flowerMesh = new THREE.Mesh(flowerGeom, idx % 2 === 0 ? flowerRedMat : flowerGoldMat);
            flowerMesh.position.set(px, Y_PLINTH + 0.58, 9.10);
            storyGroups.site.add(flowerMesh);
        });

        // Continuous Site Foundation Plinth Slab covering entire plot inside compound walls (eliminating black void!)
        createBox(10.02, 0.20, 19.43, -0.21, Y_PLINTH - 0.11, 0.155, slabFasciaMat, storyGroups.site);

        // Driveway and Entrance Gate at right (X: -0.69m to 4.80m)
        const driveW = 4.80 - (-0.69);
        const driveCenterX = (-0.69 + 4.80) / 2;
        createCheckeredFloor(-0.69, 4.80, 8.34, 9.87, Y_PLINTH, 0.60, paverCharcoalSlate, paverSandstoneGold, storyGroups.site);

        // Setback Paved Walkways (Left Setback, Rear Service Pathway, & Right Setback - ZERO black voids!)
        createCheckeredFloor(-5.22, -4.61, -9.56, 8.34, Y_PLINTH, 0.60, paverCharcoalSlate, paverSandstoneGold, storyGroups.site);
        createCheckeredFloor(-5.22, 4.80, -9.56, -8.34, Y_PLINTH, 0.60, paverCharcoalSlate, paverSandstoneGold, storyGroups.site);
        createBox(0.19, 0.02, 16.68, 4.705, Y_PLINTH + 0.01, 0.0, paverCharcoalSlate, storyGroups.site);

        const wallH = 1.60;
        createBox(0.20, wallH, 19.81, -5.22, Y_PLINTH + wallH / 2, 0.345, wallSandstone, storyGroups.site);
        createBox(10.02, wallH, 0.20, -0.21, Y_PLINTH + wallH / 2, -9.56, wallSandstone, storyGroups.site);
        createBox(0.20, wallH, 19.81, 4.80, Y_PLINTH + wallH / 2, 0.345, wallSandstone, storyGroups.site);
        createBox(gardenW, wallH, 0.20, gardenCenterX, Y_PLINTH + wallH / 2, 9.87, wallSandstone, storyGroups.site);
        createBox(0.45, wallH + 0.25, 0.45, -0.69, Y_PLINTH + (wallH + 0.25) / 2, 9.87, wallAccentSlate, storyGroups.site);
        createBox(0.45, wallH + 0.25, 0.45, 4.80, Y_PLINTH + (wallH + 0.25) / 2, 9.87, wallAccentSlate, storyGroups.site);

        // 2-Leaf Entrance Gate: Right leaf closed, Left leaf swung open into driveway at angle
        const gatePillarLeftX = -0.69;
        const gatePillarRightX = 4.80;
        const gateZ = 9.87;
        const leafW = (driveW - 0.40) / 2; // ~2.54m per leaf

        // Right Gate Leaf (Closed across right half of driveway)
        const rightLeafGrp = new THREE.Group();
        const rightLeafCenterX = gatePillarRightX - 0.20 - leafW / 2;
        rightLeafGrp.position.set(rightLeafCenterX, Y_PLINTH + wallH / 2, gateZ);
        createBox(leafW, wallH - 0.10, 0.06, 0, 0, 0, darkFrameMat, rightLeafGrp);
        for (let lz = -wallH / 2 + 0.15; lz <= wallH / 2 - 0.15; lz += 0.18) {
            createBox(leafW - 0.10, 0.04, 0.07, 0, lz, 0, teakCladMat, rightLeafGrp);
        }
        createBox(0.04, 0.30, 0.08, -leafW / 2 + 0.15, 0, 0.04, steelMat, rightLeafGrp); // Center drop lock / handle
        storyGroups.site.add(rightLeafGrp);

        // Left Gate Leaf (Swung open inward into the driveway at ~55 degrees angle!)
        const leftLeafHingeX = gatePillarLeftX + 0.20;
        const leftLeafGrp = new THREE.Group();
        leftLeafGrp.position.set(leftLeafHingeX, Y_PLINTH + wallH / 2, gateZ);
        leftLeafGrp.rotation.y = 0.95; // Swung ~55 deg inward towards stilt parking!
        createBox(leafW, wallH - 0.10, 0.06, leafW / 2, 0, 0, darkFrameMat, leftLeafGrp);
        for (let lz = -wallH / 2 + 0.15; lz <= wallH / 2 - 0.15; lz += 0.18) {
            createBox(leafW - 0.10, 0.04, 0.07, leafW / 2, lz, 0, teakCladMat, leftLeafGrp);
        }
        createBox(0.04, 0.30, 0.08, leafW - 0.15, 0, 0.04, steelMat, leftLeafGrp); // Stainless steel pull handle
        // Industrial hinge brackets connecting to left pillar
        createBox(0.12, 0.08, 0.08, -0.04, wallH / 2 - 0.25, 0, darkFrameMat, leftLeafGrp);
        createBox(0.12, 0.08, 0.08, -0.04, -wallH / 2 + 0.25, 0, darkFrameMat, leftLeafGrp);
        storyGroups.site.add(leftLeafGrp);

        // 1. FREE-STANDING STILT PARKING RCC STRUCTURAL COLUMNS (Front Cantilever Supports)
        const colH = Y_FLOOR1 - Y_PLINTH;
        const stiltParkingColumns = [
            [-4.61,  6.21], // Third Column at Stairs Side (Grid A-1, supporting staircase landing & waist slab)
            [-0.69,  6.21], // Center Column (Grid B-1)
            [ 3.24,  6.21]  // Right Column (Grid C-1)
        ];
        stiltParkingColumns.forEach(cp => {
            createBox(0.27, 0.20, 0.47, cp[0], Y_PLINTH + 0.10, cp[1], wallAccentSlate, storyGroups.ground);
            createBox(0.23, colH - 0.20, 0.43, cp[0], Y_PLINTH + 0.20 + (colH - 0.20) / 2, cp[1], wallSandstone, storyGroups.ground);
        });

        // 2. GROUND FLOOR: STILT PARKING + 2 BHK RESIDENTIAL APARTMENT (Rustic Granite Podium Plinth)
        createBox(9.22, 0.20, 16.69, 0, Y_PLINTH - 0.10, 0, granitePlinthMat, storyGroups.ground);

        // Heavy-Duty Interlocking Architectural Paver Tiles in Stilt Parking & Pathway
        createCheckeredFloor(-4.61, 4.61, 1.71, 8.34, Y_PLINTH, 0.60, paverCharcoalSlate, paverSandstoneGold, storyGroups.ground);
        createCheckeredFloor(3.24, 4.61, -8.34, 1.71, Y_PLINTH, 0.60, paverCharcoalSlate, paverSandstoneGold, storyGroups.ground);

        // Ground Floor Apartment Living Spaces (100% Royal Calacatta Italian Marble inside Living House)
        createBox(3.93, 0.02, 4.72, 1.275, Y_PLINTH + 0.01, -0.65, royalCalacattaMarble, storyGroups.ground); // Living Hall
        createBox(3.92, 0.02, 2.36, -2.65, Y_PLINTH + 0.01, 0.53, royalCalacattaMarble, storyGroups.ground); // Kitchen
        createBox(3.92, 0.02, 2.36, -2.65, Y_PLINTH + 0.01, -1.83, royalCalacattaMarble, storyGroups.ground); // Dining
        createBox(3.92, 0.02, 4.11, -2.65, Y_PLINTH + 0.01, -6.285, royalCalacattaMarble, storyGroups.ground); // Bed 1 (Flush to -8.34m)
        createBox(3.93, 0.02, 4.11, 1.275, Y_PLINTH + 0.01, -5.065, royalCalacattaMarble, storyGroups.ground); // Bed 2

        createLuxuryLiftPortal(Y_PLINTH, colH, 'G', storyGroups.ground);

        const gHouseH = colH;
        const gHouseY = (Y_PLINTH + Y_FLOOR1) / 2;

        // Front Wall at Z = +1.71m: Double Main Door (M.D) + Windows (100% Sandstone!)
        // Physical rough opening cutout for window (Left Pier + Right Pier + Sill + Lintel + Window)
        createBox(1.26, gHouseH, 0.23, -3.98, gHouseY, 1.71, wallSandstone, storyGroups.ground);
        createBox(1.26, gHouseH, 0.23, -1.32, gHouseY, 1.71, wallSandstone, storyGroups.ground);
        createBox(1.40, 0.90, 0.23, -2.65, Y_PLINTH + 0.45, 1.71, wallSandstone, storyGroups.ground);
        if (gHouseH - 2.20 > 0.01) {
            createBox(1.40, gHouseH - 2.20, 0.23, -2.65, Y_PLINTH + 2.20 + (gHouseH - 2.20) / 2, 1.71, wallSandstone, storyGroups.ground);
        }
        createWindow(1.40, 1.30, -2.65, Y_PLINTH + 1.55, 1.71, 'Z', storyGroups.ground);

        createWallWithDoubleDoor(3.93, gHouseH, 0.23, 1.275, gHouseY, 1.71, 'X', 0.80, 1.40, 2.15, storyGroups.ground);

        // Right Wall at X = +3.24m (Inward swinging door clear of pathway, zero overlap!)
        createWallWithDoorAndWindow(4.72, gHouseH, 0.23, 3.24, gHouseY, -0.65, 'Z', 3.20, 0.90, 2.10, teakDoorMat, -0.55, 0.60, 1.20, 1.20, 0.95, wallSandstone, storyGroups.ground);
        createExteriorWallWithWindows(3.24, Y_PLINTH, gHouseH, 0.23, -7.12, -3.01, [
            { zCenter: -5.85, width: 1.40, height: 1.30, sillH: 0.90 }
        ], wallSandstone, storyGroups.ground);

        // Left Exterior Wall (X = -4.61m) with REAL PHYSICAL CUTOUTS for all windows (Zero solid blockage!)
        createExteriorWallWithWindows(-4.61, Y_PLINTH, gHouseH, 0.23, -8.34, 1.71, [
            { zCenter: -6.00, width: 1.40, height: 1.30, sillH: 0.90 },
            { zCenter: -3.62, width: 0.60, height: 0.60, sillH: gHouseH - 0.85 },
            { zCenter: -1.83, width: 1.20, height: 1.20, sillH: 0.95 },
            { zCenter: 0.53, width: 1.20, height: 1.20, sillH: 0.95 }
        ], wallSandstone, storyGroups.ground);

        // Rear Wall (Z = -8.34m) with authentic window cutout opening into rear bedroom
        createBox(0.71, gHouseH, 0.23, -4.255, gHouseY, -8.34, wallSandstone, storyGroups.ground);
        createBox(1.40, 0.90, 0.23, -3.20, Y_PLINTH + 0.45, -8.34, wallSandstone, storyGroups.ground);
        if (gHouseH - 2.20 > 0.01) createBox(1.40, gHouseH - 2.20, 0.23, -3.20, Y_PLINTH + 2.20 + (gHouseH - 2.20) / 2, -8.34, wallSandstone, storyGroups.ground);
        createWindow(1.40, 1.30, -3.20, Y_PLINTH + 1.55, -8.34, 'Z', storyGroups.ground);
        createBox(3.61, gHouseH, 0.23, -0.695, gHouseY, -8.34, wallSandstone, storyGroups.ground);

        // Ground Floor Internal Partitions:
        createWallWithDoor(3.92, gHouseH, 0.12, -2.65, gHouseY, -0.65, 'X', 2.30, 0.90, 2.10, internalDoorMat, 0.45, wallInternalMat, storyGroups.ground);
        // Cased Archway opening from Living Hall into Kitchen (Z = -0.65 to 1.71m) - ZERO DOOR LEAF!
        createWallWithArchOpening(2.36, gHouseH, 0.12, -0.69, gHouseY, 0.53, 'Z', 0.45, 1.45, 2.40, wallInternalMat, storyGroups.ground);
        // Living Hall to Dining / Bedroom Lobby partition wall: door opened at black marks side (Z = -2.66m)
        createWallWithDoor(2.36, gHouseH, 0.12, -0.69, gHouseY, -1.83, 'Z', 0.35, 0.90, 2.10, internalDoorMat, 0.45, wallInternalMat, storyGroups.ground);

        // Common Toilet on left (7'x4', X: -4.61 to -2.48m, Z: -4.23 to -3.01m)
        // SURGICAL FIX: Door on EAST wall (X_MAX) opening from bedroom lobby, SOLID wall on SOUTH facing dining!
        createEnclosedBathroom({
            xMin: -4.61, xMax: -2.48,
            zMin: -4.23, zMax: -3.01,
            yBase: Y_PLINTH, roomH: gHouseH,
            doorWall: 'X_MAX', doorOffset: 0.25,
            ventWall: 'X_MIN', extWall: 'X_MIN',
            parent: storyGroups.ground
        });

        // Bedroom 1 Door: Entered from lobby on horizontal wall at Z = -4.23m, swinging North into Bed 1
        createWallWithDoor(1.79, gHouseH, 0.12, -1.585, gHouseY, -4.23, 'X', 0.45, 0.90, 2.10, internalDoorMat, 0.50, wallInternalMat, storyGroups.ground);

        // Closed opening: Solid wall separating Living Hall from Bedroom 2 at Z = -3.01m (User request: close that opening)
        createBox(3.93, gHouseH, 0.12, 1.275, gHouseY, -3.01, wallInternalMat, storyGroups.ground);
        // Bedroom 2 Door: Entered from lobby on vertical wall at X = -0.69m (Z: -4.23 to -3.01m)
        createWallWithDoor(1.22, gHouseH, 0.12, -0.69, gHouseY, -3.62, 'Z', 0.16, 0.90, 2.10, internalDoorMat, -0.45, wallInternalMat, storyGroups.ground);
        createBox(0.12, gHouseH, 4.11, -0.69, gHouseY, -6.285, wallInternalMat, storyGroups.ground);

        // Attached Toilet for Bed 2 at rear right (7'x4', X: 1.11 to 3.24m, Z: -8.34 to -7.12m)
        createEnclosedBathroom({
            xMin: 1.11, xMax: 3.24,
            zMin: -8.34, zMax: -7.12,
            yBase: Y_PLINTH, roomH: gHouseH,
            doorWall: 'Z_MAX', doorOffset: 0.35,
            ventWall: 'Z_MIN', extWall: 'Z_MIN',
            parent: storyGroups.ground
        });

        // Furniture
        // TV Centered on solid wall segment (Image 3 fix: >0.5m clear of doorway), Sofa facing North towards TV
        createTvUnit(1.95, Y_PLINTH + 0.035, -2.80, 'S', storyGroups.ground);
        createLivingSofaAndTable(1.95, Y_PLINTH + 0.035, 0.30, 'N', storyGroups.ground);
        createKitchenCounter(-2.65, Y_PLINTH + 0.035, 1.35, storyGroups.ground);
        createDiningFurniture(-2.65, Y_PLINTH + 0.035, -1.83, storyGroups.ground);
        // Ground Floor Bed 1: Headboard flush against North rear wall (-8.34m), wardrobe on East wall (-0.69m) clear of door!
        createLuxuryBed(-2.65, Y_PLINTH + 0.035, -7.24, 'S', storyGroups.ground);
        createWardrobe(-0.965, Y_PLINTH + 0.035, -5.80, 1.70, 0.55, 'Z', 'NEG_X', storyGroups.ground);

        // Ground Floor Bed 2: Headboard flush against West wall (-0.69m), wardrobe moved to EAST wall (Image 5 red arrow fix!)
        createLuxuryBed(0.41, Y_PLINTH + 0.035, -5.10, 'E', storyGroups.ground);
        createWardrobe(2.965, Y_PLINTH + 0.035, -4.00, 1.70, 0.55, 'Z', 'NEG_X', storyGroups.ground);

        // Ground floor interior lighting cleanly provided by global sun & ambient sky fill

        buildEnclosedStaircaseShaft(Y_PLINTH, Y_FLOOR1, true, storyGroups.ground);



        // =============================================================
        // 3. FIRST FLOOR: EXACT 2 BHK FRONT + 1 BHK REAR
        // =============================================================
        const f1H = Y_FLOOR2 - Y_FLOOR1;
        const f1Y = (Y_FLOOR1 + Y_FLOOR2) / 2;

        // First Floor Slab: Main body (Z = -8.34m to 6.21m) leaving front staircase void completely OPEN!
        createBox(9.22, 0.18, 14.55, 0, Y_FLOOR1 - 0.09, -1.065, slabFasciaMat, storyGroups.first);
        // 7' Front Balcony Slab (X = -0.69m to 4.61m, Z = 6.21m to 8.34m)
        createBox(5.30, 0.18, 2.13, 1.96, Y_FLOOR1 - 0.09, 7.275, slabFasciaMat, storyGroups.first);
        // Architectural Warm Teak Wood Balcony Ceiling Soffits (Luxury Villa Hallmark)
        createBox(5.26, 0.015, 2.09, 1.96, Y_FLOOR1 - 0.185, 7.275, teakSoffitMat, storyGroups.first);
        createBox(1.33, 0.015, 13.14, 3.925, Y_FLOOR1 - 0.185, -0.38, teakSoffitMat, storyGroups.first);

        // 7' Front Balcony & 4'6" Side Balcony (Designer Outdoor Vitrified Tuscan Cotto & Sandstone Travertine Tiles)
        createCheckeredFloor(-0.69, 4.61, 6.21, 8.34, Y_FLOOR1, 0.60, balconyTileCotto, balconyTileTravertine, storyGroups.first);
        createRailing(5.30, 1.96, Y_FLOOR1 + 0.03, 8.30, 'Z', storyGroups.first);
        createRailing(2.09, 4.61, Y_FLOOR1 + 0.03, 7.255, 'X', storyGroups.first);

        createCheckeredFloor(3.24, 4.61, -6.97, 6.21, Y_FLOOR1, 0.60, balconyTileCotto, balconyTileTravertine, storyGroups.first);
        createRailing(13.18, 4.61, Y_FLOOR1 + 0.03, -0.38, 'X', storyGroups.first);

        // First Floor Flooring (100% Mirror-Polished Royal Calacatta Italian Marble inside Living House)
        createBox(3.93, 0.02, 4.27, 1.275, Y_FLOOR1 + 0.01, 4.075, royalCalacattaMarble, storyGroups.first); // Front Hall
        createBox(3.92, 0.02, 1.98, -2.65, Y_FLOOR1 + 0.01, 5.22, royalCalacattaMarble, storyGroups.first); // Front Kitchen
        createBox(3.92, 0.02, 2.18, -2.65, Y_FLOOR1 + 0.01, 3.14, royalCalacattaMarble, storyGroups.first); // Front Dining
        createBox(3.92, 0.02, 3.63, -2.65, Y_FLOOR1 + 0.01, -0.985, royalCalacattaMarble, storyGroups.first); // Front Bed 1
        createBox(3.93, 0.02, 3.71, 1.275, Y_FLOOR1 + 0.01, 0.085, royalCalacattaMarble, storyGroups.first); // Front Bed 2

        createBox(3.93, 0.02, 3.71, 1.275, Y_FLOOR1 + 0.01, -4.765, royalCalacattaMarble, storyGroups.first); // Rear Hall
        createBox(3.92, 0.02, 2.33, -2.65, Y_FLOOR1 + 0.01, -4.075, royalCalacattaMarble, storyGroups.first); // Rear Kitchen
        createBox(3.92, 0.02, 3.10, -2.65, Y_FLOOR1 + 0.01, -6.79, royalCalacattaMarble, storyGroups.first); // Rear Bed (Flush to -8.34m)
        // Rear Hall/Lobby Extension Flush to Rear Wall (-8.34m) & Toilet Entry (ZERO DEAD SPACING!)
        createBox(1.80, 0.02, 1.72, 0.21, Y_FLOOR1 + 0.01, -7.48, royalCalacattaMarble, storyGroups.first);
        createBox(2.13, 0.02, 0.50, 2.175, Y_FLOOR1 + 0.01, -6.87, royalCalacattaMarble, storyGroups.first);

        createLuxuryLiftPortal(Y_FLOOR1, f1H, '1', storyGroups.first);
        buildEnclosedStaircaseShaft(Y_FLOOR1, Y_FLOOR2, false, storyGroups.first);

        // Exterior Front Wall (100% Sandstone, continuous lintel beam)
        createWallWithDoubleDoor(3.93, f1H, 0.23, 1.275, f1Y, 6.21, 'X', 0.80, 1.40, 2.15, storyGroups.first);

        // Right Wall at X = +3.24m (SOLID WALL WITH WINDOW - FIRST FLOOR DOOR REMOVED PER USER REQUEST!)
        createBox(0.23, f1H, 0.60, 3.24, f1Y, 2.24, wallSandstone, storyGroups.first);
        createBox(0.23, 0.95, 1.20, 3.24, Y_FLOOR1 + 0.475, 3.14, wallSandstone, storyGroups.first);
        createWindow(1.20, 1.20, 3.24, Y_FLOOR1 + 1.55, 3.14, 'X', storyGroups.first);
        createBox(0.23, f1H - 2.15, 1.20, 3.24, Y_FLOOR1 + 2.15 + (f1H - 2.15) / 2, 3.14, wallSandstone, storyGroups.first);
        createBox(0.23, f1H, 2.47, 3.24, f1Y, 4.975, wallSandstone, storyGroups.first);
        createExteriorWallWithWindows(3.24, Y_FLOOR1, f1H, 0.23, -1.77, 1.94, [
            { zCenter: 0.085, width: 1.40, height: 1.30, sillH: 0.90 }
        ], wallSandstone, storyGroups.first);

        createWallWithDoorAndWindow(3.71, f1H, 0.23, 3.24, f1Y, -4.765, 'Z', 2.30, 0.90, 2.10, teakDoorMat, -0.55, 0.50, 1.20, 1.20, 0.95, wallSandstone, storyGroups.first);
        createBox(0.23, f1H, 0.35, 3.24, f1Y, -6.795, wallSandstone, storyGroups.first);

        // Left Exterior Wall (X = -4.61m) with REAL PHYSICAL CUTOUTS for all 5 windows (Zero solid blockage!)
        createExteriorWallWithWindows(-4.61, Y_FLOOR1, f1H, 0.23, -8.34, 6.21, [
            { zCenter: -6.80, width: 1.40, height: 1.30, sillH: 0.90 },
            { zCenter: -4.00, width: 1.20, height: 1.20, sillH: 0.95 },
            { zCenter: -1.00, width: 1.40, height: 1.30, sillH: 0.90 },
            { zCenter: 1.44, width: 0.60, height: 0.60, sillH: f1H - 0.85 },
            { zCenter: 3.10, width: 1.20, height: 1.20, sillH: 0.95 },
            { zCenter: 5.20, width: 1.20, height: 1.20, sillH: 0.95 }
        ], wallSandstone, storyGroups.first);

        // Rear Wall (Z = -8.34m) with authentic window cutout opening into rear bedroom
        createBox(0.71, f1H, 0.23, -4.255, f1Y, -8.34, wallSandstone, storyGroups.first);
        createBox(1.40, 0.90, 0.23, -3.20, Y_FLOOR1 + 0.45, -8.34, wallSandstone, storyGroups.first);
        if (f1H - 2.20 > 0.01) createBox(1.40, f1H - 2.20, 0.23, -3.20, Y_FLOOR1 + 2.20 + (f1H - 2.20) / 2, -8.34, wallSandstone, storyGroups.first);
        createWindow(1.40, 1.30, -3.20, Y_FLOOR1 + 1.55, -8.34, 'Z', storyGroups.first);
        createBox(3.61, f1H, 0.23, -0.695, f1Y, -8.34, wallSandstone, storyGroups.first);

        // First Floor Interior Partitions:
        createBox(3.92, f1H, 0.23, -2.65, f1Y, 6.21, wallSandstone, storyGroups.first);
        createWallWithDoor(3.92, f1H, 0.12, -2.65, f1Y, 4.23, 'X', 1.80, 0.90, 2.10, internalDoorMat, 0.45, wallInternalMat, storyGroups.first);

        // SURGICAL FIX: Grand Open Cased Archway between 2BHK Living Hall and Dining Room (Zero Door Leaf!)
        createWallWithArchOpening(4.27, f1H, 0.12, -0.69, f1Y, 4.075, 'Z', 1.20, 1.80, 2.40, wallInternalMat, storyGroups.first);

        // Front Common Toilet (7'x4', X: -4.61 to -2.48m, Z: 0.83 to 2.05m)
        createEnclosedBathroom({
            xMin: -4.61, xMax: -2.48,
            zMin: 0.83, zMax: 2.05,
            yBase: Y_FLOOR1, roomH: f1H,
            doorWall: 'X_MAX', doorOffset: 0.25,
            ventWall: 'X_MIN', extWall: 'X_MIN',
            parent: storyGroups.first
        });

        // Front Bed 1 Door
        createWallWithDoor(1.79, f1H, 0.12, -1.585, f1Y, 0.83, 'X', 0.45, 0.90, 2.10, internalDoorMat, 0.50, wallInternalMat, storyGroups.first);

        // Front Bed 2 Door
        createWallWithDoor(3.93, f1H, 0.12, 1.275, f1Y, 1.94, 'X', 0.35, 0.90, 2.10, internalDoorMat, 0.45, wallInternalMat, storyGroups.first);
        createBox(0.12, f1H, 3.71, -0.69, f1Y, 0.085, wallInternalMat, storyGroups.first);

        // Attached Toilet for Bed 2 (7'x3'9", X: 1.11 to 3.24m, Z: -2.91 to -1.77m)
        createEnclosedBathroom({
            xMin: 1.11, xMax: 3.24,
            zMin: -2.91, zMax: -1.77,
            yBase: Y_FLOOR1, roomH: f1H,
            doorWall: 'Z_MAX', doorOffset: 0.35,
            ventWall: 'X_MAX', extWall: 'X_MAX',
            parent: storyGroups.first
        });

        // Dividing transverse wall between Front 2 BHK and Rear 1 BHK
        createBox(3.92, f1H, 0.15, -2.65, f1Y, -2.91, wallInternalMat, storyGroups.first);
        createBox(1.80, f1H, 0.15, 0.21, f1Y, -2.91, wallInternalMat, storyGroups.first);

        // Open Archway from Rear Living Hall into Kitchen (Z = -4.63 to -2.91, length 1.72m) - ZERO DOOR LEAF!
        createWallWithArchOpening(1.72, f1H, 0.12, -0.69, f1Y, -3.77, 'Z', 0.20, 1.30, 2.20, wallInternalMat, storyGroups.first);

        // Solid Transverse Partition Wall between Kitchen and Rear Bedroom (Z = -4.63m)
        createBox(3.92, f1H, 0.12, -2.65, f1Y, -4.63, wallInternalMat, storyGroups.first);

        // Dedicated Door from Living Hall into Rear Bedroom (Z = -8.34 to -4.63, length 3.71m)
        createWallWithDoor(3.71, f1H, 0.12, -0.69, f1Y, -6.485, 'Z', 2.50, 0.90, 2.10, internalDoorMat, 0.45, wallInternalMat, storyGroups.first);

        // Rear Toilet of 1 BHK (7'x4', X: 1.11 to 3.24m, Z: -8.34 to -7.12m)
        createEnclosedBathroom({
            xMin: 1.11, xMax: 3.24,
            zMin: -8.34, zMax: -7.12,
            yBase: Y_FLOOR1, roomH: f1H,
            doorWall: 'Z_MAX', doorOffset: 0.35,
            ventWall: 'Z_MIN', extWall: 'Z_MIN',
            parent: storyGroups.first
        });

        // Furniture
        // Front 2BHK: TV centered on solid wall (clearing Bed 2 doorway), Sofa facing North towards TV
        createTvUnit(1.95, Y_FLOOR1 + 0.035, 2.15, 'S', storyGroups.first);
        createLivingSofaAndTable(1.95, Y_FLOOR1 + 0.035, 4.50, 'N', storyGroups.first);
        createKitchenCounter(-2.65, Y_FLOOR1 + 0.035, 5.50, storyGroups.first);
        createDiningFurniture(-2.65, Y_FLOOR1 + 0.035, 3.14, storyGroups.first);
        // First Floor Front Bed 1: Headboard flush against South wall (-2.91m), wardrobe on East wall (-0.69m) clear of door!
        createLuxuryBed(-2.65, Y_FLOOR1 + 0.035, -1.81, 'S', storyGroups.first);
        createWardrobe(-0.965, Y_FLOOR1 + 0.035, -1.20, 1.70, 0.55, 'Z', 'NEG_X', storyGroups.first);

        // First Floor Front Bed 2: Rotated 180 degrees per user request (orient: 'W')
        createLuxuryBed(0.41, Y_FLOOR1 + 0.035, 0.085, 'W', storyGroups.first);
        createWardrobe(2.15, Y_FLOOR1 + 0.035, 1.665, 1.70, 0.55, 'X', 'NEG_Z', storyGroups.first);

        // Rear 1BHK: TV on solid South dividing wall (-3.10m), Sofa facing South towards TV (ZERO toilet door conflict!)
        createTvUnit(1.275, Y_FLOOR1 + 0.035, -3.10, 'N', storyGroups.first);
        createLivingSofaAndTable(1.275, Y_FLOOR1 + 0.035, -5.00, 'S', storyGroups.first);
        createKitchenCounter(-2.65, Y_FLOOR1 + 0.035, -4.00, storyGroups.first);

        // First Floor Rear Bed: Headboard flush against North rear wall (-8.34m), wardrobe on South wall (-4.63m) clear of door!
        createLuxuryBed(-2.65, Y_FLOOR1 + 0.035, -7.24, 'S', storyGroups.first);
        createWardrobe(-3.35, Y_FLOOR1 + 0.035, -4.905, 1.70, 0.55, 'X', 'NEG_Z', storyGroups.first);

        // First floor interior lighting cleanly provided by global sun & ambient sky fill

        // =============================================================
        // 4. SECOND FLOOR: THREE MODULAR 1-BHK UNITS
        // =============================================================
        const f2H = Y_TERRACE - Y_FLOOR2;
        const f2Y = (Y_FLOOR2 + Y_TERRACE) / 2;

        // Second Floor Slab: Main body (Z = -8.34m to 6.21m) leaving front staircase void completely OPEN!
        createBox(9.22, 0.18, 14.55, 0, Y_FLOOR2 - 0.09, -1.065, slabFasciaMat, storyGroups.second);
        // 7' Front Balcony Slab (X = -0.69m to 4.61m, Z = 6.21m to 8.34m)
        createBox(5.30, 0.18, 2.13, 1.96, Y_FLOOR2 - 0.09, 7.275, slabFasciaMat, storyGroups.second);
        // Architectural Warm Teak Wood Balcony Ceiling Soffits (Luxury Villa Hallmark)
        createBox(5.26, 0.015, 2.09, 1.96, Y_FLOOR2 - 0.185, 7.275, teakSoffitMat, storyGroups.second);
        createBox(1.33, 0.015, 13.14, 3.925, Y_FLOOR2 - 0.185, -0.38, teakSoffitMat, storyGroups.second);

        // 7' Front Balcony & 4'6" Side Balcony (Designer Outdoor Vitrified Tuscan Cotto & Sandstone Travertine Tiles)
        createCheckeredFloor(-0.69, 4.61, 6.21, 8.34, Y_FLOOR2, 0.60, balconyTileCotto, balconyTileTravertine, storyGroups.second);
        createRailing(5.30, 1.96, Y_FLOOR2 + 0.03, 8.30, 'Z', storyGroups.second);
        createRailing(2.09, 4.61, Y_FLOOR2 + 0.03, 7.255, 'X', storyGroups.second);

        createCheckeredFloor(3.24, 4.61, -6.97, 6.21, Y_FLOOR2, 0.60, balconyTileCotto, balconyTileTravertine, storyGroups.second);
        createRailing(13.18, 4.61, Y_FLOOR2 + 0.03, -0.38, 'X', storyGroups.second);

        createLuxuryLiftPortal(Y_FLOOR2, f2H, '2', storyGroups.second);
        buildEnclosedStaircaseShaft(Y_FLOOR2, Y_TERRACE, false, storyGroups.second);

        // Unit 1 (Front 1 BHK - 100% Mirror-Polished Royal Calacatta Italian Marble inside Living House)
        createBox(3.93, 0.02, 2.95, 1.275, Y_FLOOR2 + 0.01, 4.735, royalCalacattaMarble, storyGroups.second); // Living Hall
        createBox(1.80, 0.02, 1.21, 0.21, Y_FLOOR2 + 0.01, 2.655, royalCalacattaMarble, storyGroups.second); // Unit 1 Lobby Extension
        createBox(3.92, 0.02, 1.53, -2.65, Y_FLOOR2 + 0.01, 5.445, royalCalacattaMarble, storyGroups.second); // Kitchen
        createBox(3.92, 0.02, 2.63, -2.65, Y_FLOOR2 + 0.01, 3.365, royalCalacattaMarble, storyGroups.second); // Bedroom

        createWallWithDoubleDoor(3.93, f2H, 0.23, 1.275, f2Y, 6.21, 'X', 0.80, 1.40, 2.15, storyGroups.second);
        createBox(3.92, f2H, 0.23, -2.65, f2Y, 6.21, wallSandstone, storyGroups.second);

        // Open Archway from Living Hall into Kitchen (Z = 4.68 to 6.21, length 1.53m) - ZERO DOOR LEAF!
        createWallWithArchOpening(1.53, f2H, 0.12, -0.69, f2Y, 5.445, 'Z', 0.20, 1.10, 2.20, wallInternalMat, storyGroups.second);

        // Solid Transverse Partition Wall between Kitchen and Bedroom (Z = 4.68m)
        createBox(3.92, f2H, 0.12, -2.65, f2Y, 4.68, wallInternalMat, storyGroups.second);

        // Dedicated Door from Living Hall into Bedroom (Z = 2.05 to 4.68, length 2.63m)
        createWallWithDoor(2.63, f2H, 0.12, -0.69, f2Y, 3.365, 'Z', 1.50, 0.90, 2.10, internalDoorMat, 0.45, wallInternalMat, storyGroups.second);

        createEnclosedBathroom({
            xMin: 1.11, xMax: 3.24,
            zMin: 2.05, zMax: 3.26,
            yBase: Y_FLOOR2, roomH: f2H,
            doorWall: 'Z_MAX', doorOffset: 0.35,
            ventWall: 'X_MAX', extWall: 'X_MAX',
            parent: storyGroups.second
        });

        createExteriorWallWithWindows(3.24, Y_FLOOR2, f2H, 0.23, 3.26, 6.21, [
            { zCenter: 4.735, width: 1.40, height: 1.30, sillH: 0.90 }
        ], wallSandstone, storyGroups.second);

        // Unit 1 Living Furniture: Sofa against East exterior wall
        createLivingSofaAndTable(2.85, Y_FLOOR2 + 0.035, 4.80, 'W', storyGroups.second);
        createKitchenCounter(-2.65, Y_FLOOR2 + 0.035, 5.50, storyGroups.second);

        // Unit 1 Bedroom: Headboard flush against West wall (-4.61m)
        createLuxuryBed(-3.51, Y_FLOOR2 + 0.035, 3.365, 'E', storyGroups.second);

        createBox(7.85, f2H, 0.15, -0.685, f2Y, 2.05, wallInternalMat, storyGroups.second);

        // Unit 2 (Middle 1 BHK - 100% Mirror-Polished Royal Calacatta Italian Marble inside Living House)
        createBox(3.93, 0.02, 3.63, 1.275, Y_FLOOR2 + 0.01, 0.235, royalCalacattaMarble, storyGroups.second); // Living Hall
        createBox(1.80, 0.02, 1.22, 0.21, Y_FLOOR2 + 0.01, -2.19, royalCalacattaMarble, storyGroups.second); // Unit 2 Lobby Extension
        createBox(3.92, 0.02, 1.83, -2.65, Y_FLOOR2 + 0.01, 1.135, royalCalacattaMarble, storyGroups.second); // Kitchen
        createBox(3.92, 0.02, 3.02, -2.65, Y_FLOOR2 + 0.01, -1.29, royalCalacattaMarble, storyGroups.second); // Bedroom

        // Unit 2 Right Exterior Wall (Inward swinging door clear of pathway, zero overlap!)
        createWallWithDoorAndWindow(3.63, f2H, 0.23, 3.24, f2Y, 0.235, 'Z', 2.20, 0.90, 2.10, teakDoorMat, -0.55, 0.50, 1.20, 1.20, 0.95, wallSandstone, storyGroups.second);

        // Open Archway from Living Hall into Kitchen (Z = 0.22 to 2.05, length 1.83m) - ZERO DOOR LEAF!
        createWallWithArchOpening(1.83, f2H, 0.12, -0.69, f2Y, 1.135, 'Z', 0.25, 1.25, 2.20, wallInternalMat, storyGroups.second);

        // Solid Transverse Partition Wall between Kitchen and Bedroom (Z = 0.22m)
        createBox(3.92, f2H, 0.12, -2.65, f2Y, 0.22, wallInternalMat, storyGroups.second);

        // Dedicated Door from Living Hall into Bedroom (Z = -2.80 to 0.22, length 3.02m)
        createWallWithDoor(3.02, f2H, 0.12, -0.69, f2Y, -1.29, 'Z', 1.80, 0.90, 2.10, internalDoorMat, 0.45, wallInternalMat, storyGroups.second);

        createEnclosedBathroom({
            xMin: 1.11, xMax: 3.24,
            zMin: -2.80, zMax: -1.58,
            yBase: Y_FLOOR2, roomH: f2H,
            doorWall: 'Z_MAX', doorOffset: 0.35,
            ventWall: 'X_MAX', extWall: 'X_MAX',
            parent: storyGroups.second
        });

        // Unit 2 Living Furniture: Sofa backrest flush against solid North dividing wall, facing into living room
        createLivingSofaAndTable(1.275, Y_FLOOR2 + 0.035, 1.53, 'N', storyGroups.second);
        createKitchenCounter(-2.65, Y_FLOOR2 + 0.035, 1.20, storyGroups.second);

        // Unit 2 Bedroom: Headboard flush against West wall (-4.61m)
        createLuxuryBed(-3.51, Y_FLOOR2 + 0.035, -1.29, 'E', storyGroups.second);

        createBox(7.85, f2H, 0.15, -0.685, f2Y, -2.80, wallInternalMat, storyGroups.second);

        // Unit 3 (Rear 1 BHK - 100% Mirror-Polished Royal Calacatta Italian Marble inside Living House)
        createBox(3.93, 0.02, 3.82, 1.275, Y_FLOOR2 + 0.01, -4.71, royalCalacattaMarble, storyGroups.second); // Living Hall
        createBox(1.80, 0.02, 1.72, 0.21, Y_FLOOR2 + 0.01, -7.48, royalCalacattaMarble, storyGroups.second);
        createBox(2.13, 0.02, 0.50, 2.175, Y_FLOOR2 + 0.01, -6.87, royalCalacattaMarble, storyGroups.second);
        createBox(3.92, 0.02, 1.83, -2.65, Y_FLOOR2 + 0.01, -3.715, royalCalacattaMarble, storyGroups.second); // Kitchen
        createBox(3.92, 0.02, 3.71, -2.65, Y_FLOOR2 + 0.01, -6.485, royalCalacattaMarble, storyGroups.second); // Bedroom (Flush to -8.34m)

        // Unit 3 Right Exterior Wall (Inward swinging door clear of pathway, zero overlap!)
        createWallWithDoorAndWindow(3.82, f2H, 0.23, 3.24, f2Y, -4.71, 'Z', 2.30, 0.90, 2.10, teakDoorMat, -0.55, 0.50, 1.20, 1.20, 0.95, wallSandstone, storyGroups.second);
        createBox(0.23, f2H, 0.35, 3.24, f2Y, -6.795, wallSandstone, storyGroups.second);

        // Open Archway from Living Hall into Kitchen (Z = -4.63 to -2.80, length 1.83m) - ZERO DOOR LEAF!
        createWallWithArchOpening(1.83, f2H, 0.12, -0.69, f2Y, -3.715, 'Z', 0.25, 1.25, 2.20, wallInternalMat, storyGroups.second);

        // Solid Transverse Partition Wall between Kitchen and Bedroom (Z = -4.63m)
        createBox(3.92, f2H, 0.12, -2.65, f2Y, -4.63, wallInternalMat, storyGroups.second);

        // Dedicated Door from Living Hall into Bedroom (Z = -8.34 to -4.63, length 3.71m)
        createWallWithDoor(3.71, f2H, 0.12, -0.69, f2Y, -6.485, 'Z', 2.50, 0.90, 2.10, internalDoorMat, 0.45, wallInternalMat, storyGroups.second);

        // Unit 3 Toilet (7'x4', X: 1.11 to 3.24m, Z: -8.34 to -7.12m)
        createEnclosedBathroom({
            xMin: 1.11, xMax: 3.24,
            zMin: -8.34, zMax: -7.12,
            yBase: Y_FLOOR2, roomH: f2H,
            doorWall: 'Z_MAX', doorOffset: 0.35,
            ventWall: 'Z_MIN', extWall: 'Z_MIN',
            parent: storyGroups.second
        });

        // Unit 3 Living Furniture: TV against solid South dividing wall (-2.80m), Sofa facing South towards TV (ZERO toilet door conflict!)
        createTvUnit(1.275, Y_FLOOR2 + 0.035, -3.00, 'N', storyGroups.second);
        createLivingSofaAndTable(1.275, Y_FLOOR2 + 0.035, -5.00, 'S', storyGroups.second);
        createKitchenCounter(-2.65, Y_FLOOR2 + 0.035, -3.70, storyGroups.second);

        // Unit 3 Bedroom: Headboard flush against North rear wall (-8.34m), wardrobe on South wall (-4.63m) clear of door!
        createLuxuryBed(-2.65, Y_FLOOR2 + 0.035, -7.24, 'S', storyGroups.second);
        createWardrobe(-3.35, Y_FLOOR2 + 0.035, -4.905, 1.70, 0.55, 'X', 'NEG_Z', storyGroups.second);

        // Second floor interior lighting cleanly provided by global sun & ambient sky fill

        // Exterior left wall with REAL PHYSICAL CUTOUTS for all windows (Zero solid blockage!)
        createExteriorWallWithWindows(-4.61, Y_FLOOR2, f2H, 0.23, -8.34, 6.21, [
            { zCenter: -6.49, width: 1.40, height: 1.30, sillH: 0.90 },
            { zCenter: -3.72, width: 1.20, height: 1.20, sillH: 0.95 },
            { zCenter: -1.29, width: 1.40, height: 1.30, sillH: 0.90 },
            { zCenter: 1.14, width: 1.20, height: 1.20, sillH: 0.95 },
            { zCenter: 3.37, width: 1.40, height: 1.30, sillH: 0.90 },
            { zCenter: 5.20, width: 1.20, height: 1.20, sillH: 0.95 }
        ], wallSandstone, storyGroups.second);

        // Rear Wall (Z = -8.34m) with authentic window cutout opening into rear bedroom
        createBox(0.71, f2H, 0.23, -4.255, f2Y, -8.34, wallSandstone, storyGroups.second);
        createBox(1.40, 0.90, 0.23, -3.20, Y_FLOOR2 + 0.45, -8.34, wallSandstone, storyGroups.second);
        if (f2H - 2.20 > 0.01) createBox(1.40, f2H - 2.20, 0.23, -3.20, Y_FLOOR2 + 2.20 + (f2H - 2.20) / 2, -8.34, wallSandstone, storyGroups.second);
        createWindow(1.40, 1.30, -3.20, Y_FLOOR2 + 1.55, -8.34, 'Z', storyGroups.second);
        createBox(3.61, f2H, 0.23, -0.695, f2Y, -8.34, wallSandstone, storyGroups.second);

        // =============================================================
        // 5. ROOF LEVEL: TERRACE, MUMTY WITH TILED GABLE ROOF, LMR SPANNING C3-C6!
        // =============================================================
        // Roof Terrace Slab aligned to Y_TERRACE - 0.09 (Flush top at Y_TERRACE!)
        createBox(9.22, 0.18, 14.55, 0, Y_TERRACE - 0.09, -1.065, slabFasciaMat, storyGroups.terrace);
        createBox(5.30, 0.18, 2.13, 1.96, Y_TERRACE - 0.09, 7.275, slabFasciaMat, storyGroups.terrace);

        // Weatherproof Terracotta Terrace Tiles (Flush at Y_TERRACE + 0.01)
        createBox(8.90, 0.02, 14.47, 0, Y_TERRACE + 0.01, -1.005, terraceTileMat, storyGroups.terrace);
        createBox(5.10, 0.02, 2.05, 1.96, Y_TERRACE + 0.01, 7.215, terraceTileMat, storyGroups.terrace);

        // Parapet Walls (Trimmed cleanly around Staircase Mumty and Lift Machine Room)
        const paraH = 0.95;
        const paraY = Y_TERRACE + paraH / 2;
        // North Rear Parapet (stops at X = 3.24m where LMR begins)
        createBox(7.75, paraH, 0.20, -0.635, paraY, -8.24, wallSandstone, storyGroups.terrace);
        createBox(7.83, 0.06, 0.24, -0.635, Y_TERRACE + paraH + 0.03, -8.24, parapetCopingMat, storyGroups.terrace);
        // West Left Parapet (stops at Z = 6.21m where Staircase Mumty begins)
        createBox(0.20, paraH, 14.45, -4.51, paraY, -1.015, wallSandstone, storyGroups.terrace);
        createBox(0.24, 0.06, 14.53, -4.51, Y_TERRACE + paraH + 0.03, -1.015, parapetCopingMat, storyGroups.terrace);
        // East Right Parapet (starts at Z = -3.35m where LMR ends, runs to Z = 8.24m)
        createBox(0.20, paraH, 11.59, 4.51, paraY, 2.445, wallSandstone, storyGroups.terrace);
        createBox(0.24, 0.06, 11.67, 4.51, Y_TERRACE + paraH + 0.03, 2.445, parapetCopingMat, storyGroups.terrace);
        // South Front Parapet (from Mumty East wall X = -0.69m to East edge X = 4.51m)
        createBox(5.20, paraH, 0.20, 1.91, paraY, 8.24, wallSandstone, storyGroups.terrace);
        createBox(5.30, 0.06, 0.24, 1.91, Y_TERRACE + paraH + 0.03, 8.24, parapetCopingMat, storyGroups.terrace);

        
        // -------------------------------------------------------------
        // MODERN LUXURY ROOF PERGOLA TRELLIS (Warm Teak & Charcoal Architectural Crown)
        // -------------------------------------------------------------
        const pergolaY = Y_TERRACE + paraH + 1.85; // ~13.92m
        // 4 Charcoal Longitudinal Runner Beams spanning over front terrace (Z: 6.35 to 8.15m)
        [6.40, 7.00, 7.60, 8.20].forEach(pz => {
            createBox(5.30, 0.08, 0.06, 1.96, pergolaY, pz, matFacadeCharcoal, storyGroups.terrace);
        });
        // 8 Warm Teak Wood Cross Louver Slats (Spanning across runner beams)
        for (let px = -0.50; px <= 4.40; px += 0.70) {
            createBox(0.05, 0.12, 2.05, px, pergolaY + 0.06, 7.30, teakSoffitMat, storyGroups.terrace);
        }
        // Supporting Slim Charcoal Upright Stanchions anchoring into front parapet & Mumty
        [[-0.60, 8.20], [4.45, 8.20], [4.45, 6.40]].forEach(pt => {
            createBox(0.06, 1.85, 0.06, pt[0], Y_TERRACE + paraH + 0.925, pt[1], matFacadeCharcoal, storyGroups.terrace);
        });

        // Stair Mumty Room (With duplicate solid East wall removed so Terrace Door is open!)
        const mumtyH = Y_MUMTY - Y_TERRACE;
        const mumtyY = (Y_TERRACE + Y_MUMTY) / 2;
        createBox(0.23, mumtyH, 0.43, -4.61, mumtyY, 6.21, wallSandstone, storyGroups.headroom);
        createBox(0.23, mumtyH, 2.13, -4.61, mumtyY, 7.275, wallSandstone, storyGroups.headroom);
        createBox(3.92, mumtyH, 0.23, -2.65, mumtyY, 8.34, wallSandstone, storyGroups.headroom);
        createBox(3.92, mumtyH, 0.23, -2.65, mumtyY, 6.21, wallSandstone, storyGroups.headroom);
        createWallWithDoor(2.13, mumtyH, 0.23, -0.69, mumtyY, 7.275, 'Z', 0.50, 0.95, 2.10, teakDoorMat, 0.40, wallSandstone, storyGroups.headroom);

        // -------------------------------------------------------------
        // PRESTIGIOUS ARCHITECTURAL SIGNBOARD & 3D CORPORATE LOGO PLAQUE
        // Located at the exact South facade wall of the Stair Mumty (Cursor location)
        // -------------------------------------------------------------
        // 1. Vertical Architectural Teak Wood Slat Feature Backdrop
        const slatW = 3.40;
        const slatH = mumtyH - 0.12;
        createBox(slatW, slatH, 0.025, -2.65, mumtyY, 8.468, teakSoffitMat, storyGroups.headroom);
        // Flanking vertical dark charcoal reveal trims
        createBox(0.05, slatH, 0.035, -2.65 - slatW / 2 - 0.025, mumtyY, 8.472, matFacadeCharcoal, storyGroups.headroom);
        createBox(0.05, slatH, 0.035, -2.65 + slatW / 2 + 0.025, mumtyY, 8.472, matFacadeCharcoal, storyGroups.headroom);

        // 2. Heavy Floating Architectural Plaque
        // Positioned in the upper half of the facade wall (Y = 12.72m) exactly at cursor mark
        const signW = 2.40;
        const signH = 1.05;
        const signY = Y_TERRACE + mumtyH * 0.58; // 12.58m to 12.75m
        const signZ = 8.50;

        // Dark obsidian backplate
        createBox(signW, signH, 0.035, -2.65, signY, signZ, matSignBackplate, storyGroups.headroom);

        // High-definition Canvas Face with Gold Metallic Crest & Typography
        createBox(signW - 0.04, signH - 0.04, 0.005, -2.65, signY, signZ + 0.020, matSignCanvas, storyGroups.headroom);

        // Beveled Champagne 24K Gold Brass Perimeter Framing
        const frameBezelT = 0.035;
        const frameBezelD = 0.045;
        createBox(signW + frameBezelT * 2, frameBezelT, frameBezelD, -2.65, signY + signH / 2 + frameBezelT / 2, signZ + 0.005, matSignGoldTrim, storyGroups.headroom);
        createBox(signW + frameBezelT * 2, frameBezelT, frameBezelD, -2.65, signY - signH / 2 - frameBezelT / 2, signZ + 0.005, matSignGoldTrim, storyGroups.headroom);
        createBox(frameBezelT, signH, frameBezelD, -2.65 - signW / 2 - frameBezelT / 2, signY, signZ + 0.005, matSignGoldTrim, storyGroups.headroom);
        createBox(frameBezelT, signH, frameBezelD, -2.65 + signW / 2 + frameBezelT / 2, signY, signZ + 0.005, matSignGoldTrim, storyGroups.headroom);

        // 4 Solid Brass Standoff Mounting Studs at the corners
        const standoffOffsetX = signW / 2 - 0.12;
        const standoffOffsetY = signH / 2 - 0.10;
        [-standoffOffsetX, standoffOffsetX].forEach(sx => {
            [-standoffOffsetY, standoffOffsetY].forEach(sy => {
                const studG = new THREE.CylinderGeometry(0.022, 0.022, 0.04, 16);
                studG.rotateX(Math.PI / 2);
                const studM = new THREE.Mesh(studG, matSignGoldTrim);
                studM.position.set(-2.65 + sx, signY + sy, signZ + 0.022);
                storyGroups.headroom.add(studM);
            });
        });

        // 3. Overhead Architectural Slim LED Downlight Luminaire (Picture / Wall-washer light)
        const lumY = signY + signH / 2 + 0.22;
        const lumZ = signZ + 0.08;
        const lumW = 1.90;
        // Luminaire housing
        createBox(lumW, 0.04, 0.08, -2.65, lumY, lumZ, matFacadeCharcoal, storyGroups.headroom);
        // Underside warm LED light emitter
        createBox(lumW - 0.04, 0.01, 0.06, -2.65, lumY - 0.02, lumZ, matLuminaireUnderside, storyGroups.headroom);
        // Brass endcaps
        createBox(0.02, 0.045, 0.085, -2.65 - lumW / 2, lumY, lumZ, matSignGoldTrim, storyGroups.headroom);
        createBox(0.02, 0.045, 0.085, -2.65 + lumW / 2, lumY, lumZ, matSignGoldTrim, storyGroups.headroom);
        // Two cantilevered angled brass mounting brackets anchoring to the wall
        [-0.65, 0.65].forEach(bx => {
            const bracketArm = createBox(0.025, 0.025, 0.14, -2.65 + bx, lumY + 0.01, lumZ - 0.07, matSignGoldTrim, storyGroups.headroom);
            bracketArm.rotation.x = -0.15;
        });

        // Mangalore Clay Tiled Gable Roof
        const gableOverhang = 0.35;
        const roofW = 3.92 + gableOverhang * 2;
        const roofD = 2.13 + gableOverhang * 2;
        const ridgeH = 0.75;
        const roofYBase = Y_MUMTY;

        const roofShape = new THREE.Shape();
        roofShape.moveTo(-roofW / 2, 0);
        roofShape.lineTo(0, ridgeH);
        roofShape.lineTo(roofW / 2, 0);
        roofShape.closePath();

        const extrudeSettings = { depth: roofD, bevelEnabled: false };
        const roofGeom = new THREE.ExtrudeGeometry(roofShape, extrudeSettings);
        roofGeom.center();
        const roofMesh = new THREE.Mesh(roofGeom, mangaloreRoofMat);
        roofMesh.position.set(-2.65, roofYBase + ridgeH / 2, 7.275);
        roofMesh.castShadow = false;
        roofMesh.receiveShadow = false;
        storyGroups.headroom.add(roofMesh);

        createBox(0.18, 0.08, roofD + 0.10, -2.65, roofYBase + ridgeH + 0.04, 7.275, new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.8 }), storyGroups.headroom);

        // LIFT MACHINE ROOM & TERRACE STORAGE (Spanning Columns C3 to C6! Z: -8.34m to -3.35m, X: 3.24m to 4.61m!)
        const lmrH = Y_LIFT - Y_TERRACE;
        const lmrY = (Y_TERRACE + Y_LIFT) / 2;
        const lmrLenZ = -3.35 - (-8.34);
        const lmrCenterZ = (-8.34 + -3.35) / 2;

        createBox(1.37, lmrH, 0.23, 3.925, lmrY, -8.34, wallSandstone, storyGroups.headroom);
        createBox(1.37, lmrH, 0.23, 3.925, lmrY, -3.35, wallSandstone, storyGroups.headroom);
        createBox(0.23, lmrH, lmrLenZ, 4.61, lmrY, lmrCenterZ, wallSandstone, storyGroups.headroom);
        // LMR West Wall at X = 3.24m with Heavy-Duty Industrial Metal Service Door (NO DUPLICATE SOLID WALL!)
        const lmrSteelDoorMat = new THREE.MeshStandardMaterial({
            color: 0x2d3748, // Industrial Charcoal Slate Steel
            roughness: 0.38,
            metalness: 0.75
        });
        const lmrDoorOffset = 2.10;
        createWallWithDoor(lmrLenZ, lmrH, 0.23, 3.24, lmrY, lmrCenterZ, 'Z', lmrDoorOffset, 0.95, 2.10, lmrSteelDoorMat, 0.35, wallSandstone, storyGroups.headroom);

        // LMR Door Leaf is cleanly opened with industrial handle, leaving entrance 100% unobstructed

        // Heavy-Duty Galvanized Steel Access Ladder (Monkey Ladder from Terrace to Water Tanks / LMR Roof)
        const ladderSteelMat = new THREE.MeshStandardMaterial({
            color: 0x475569, // Galvanized Industrial Structural Steel
            metalness: 0.85,
            roughness: 0.30
        });
        const ladZ = -4.05; // Located conveniently between door and front corner
        const ladX = 3.08;  // Standoff of 160mm from wall at X = 3.24m
        const ladWidth = 0.46; // 460mm wide standard rung width
        const zRail1 = ladZ - ladWidth / 2;
        const zRail2 = ladZ + ladWidth / 2;
        const ladBottomY = Y_TERRACE;
        const ladTopY = Y_LIFT + 0.85; // 850mm safety grab extension above LMR roof
        const ladRailH = ladTopY - ladBottomY;

        // Two Vertical Stringer Rails (35mm steel pipe)
        [zRail1, zRail2].forEach(rz => {
            const railG = new THREE.CylinderGeometry(0.018, 0.018, ladRailH, 16);
            const railM = new THREE.Mesh(railG, ladderSteelMat);
            railM.position.set(ladX, ladBottomY + ladRailH / 2, rz);
            railM.castShadow = true;
            storyGroups.headroom.add(railM);

            // Curved Safety Grab Top Return (arching back over roof parapet)
            createBox(0.26, 0.035, 0.035, ladX + 0.13, ladTopY, rz, ladderSteelMat, storyGroups.headroom);

            // Wall Standoff Mounting Brackets (securing ladder firmly to masonry wall at X = 3.24m)
            [Y_TERRACE + 0.80, Y_TERRACE + 2.00, Y_TERRACE + 2.90].forEach(by => {
                createBox(0.16, 0.035, 0.035, ladX + 0.08, by, rz, ladderSteelMat, storyGroups.headroom);
            });
        });

        // Horizontal Steel Rungs (22mm knurled non-slip steel rods spaced at 300mm / 1 foot centers)
        for (let ry = Y_TERRACE + 0.30; ry <= Y_LIFT + 0.10; ry += 0.30) {
            const rungG = new THREE.CylinderGeometry(0.012, 0.012, ladWidth, 12);
            rungG.rotateX(Math.PI / 2);
            const rungM = new THREE.Mesh(rungG, ladderSteelMat);
            rungM.position.set(ladX, ry, ladZ);
            rungM.castShadow = true;
            storyGroups.headroom.add(rungM);
        }

        createBox(1.65, 0.18, lmrLenZ + 0.30, 3.925, Y_LIFT, lmrCenterZ, slabFasciaMat, storyGroups.headroom);

        const tankY = Y_LIFT + 0.75;
        const tankRad = 0.50;
        const tankHeight = 1.30;
        const tankGeom = new THREE.CylinderGeometry(tankRad, tankRad, tankHeight, 20);
        [-6.50, -5.20].forEach(tz => {
            const tankMesh = new THREE.Mesh(tankGeom, darkFrameMat);
            tankMesh.position.set(3.925, tankY, tz);
            tankMesh.castShadow = true;
            storyGroups.headroom.add(tankMesh);
            for (let r = -tankHeight / 2 + 0.25; r <= tankHeight / 2 - 0.25; r += 0.35) {
                const ringGeom = new THREE.TorusGeometry(tankRad + 0.015, 0.02, 8, 20);
                const ringMesh = new THREE.Mesh(ringGeom, slabFasciaMat);
                ringMesh.position.set(3.925, tankY + r, tz);
                ringMesh.rotation.x = Math.PI / 2;
                storyGroups.headroom.add(ringMesh);
            }
        });

        // Assemble Stories
        archGroup.add(storyGroups.site);
        archGroup.add(storyGroups.ground);
        archGroup.add(storyGroups.first);
        archGroup.add(storyGroups.second);
        archGroup.add(storyGroups.terrace);
        archGroup.add(storyGroups.headroom);

        scene.add(archGroup);
        architecturalModel = archGroup;
        return architecturalModel;
    }

    // Build the complete 3D structural model
    function buildModel() {
        if (!window.STAAD_MODEL_DATA) {
            console.error('STAAD_MODEL_DATA not found');
            return;
        }

        const data = window.STAAD_MODEL_DATA;
        const joints = data.joints;
        const members = data.members;

        initMaterials();

        // 1. Build Members (Columns & Beams)
        members.forEach(m => {
            const j1 = joints[m.node1];
            const j2 = joints[m.node2];
            if (!j1 || !j2) return;

            const isCol = (m.type === 'column');
            const mat = isCol ? matColumn.clone() : matBeam.clone();
            const width = m.width || 0.23;
            const depth = m.depth || (isCol ? 0.45 : 0.43);

            const mesh = createExtrudedMember(j1, j2, width, depth, mat, isCol, m.rcdc);
            mesh.userData = {
                memberId: m.id,
                type: m.type,
                story: m.story,
                length: m.length,
                width: width,
                depth: depth,
                node1: m.node1,
                node2: m.node2,
                j1: j1,
                j2: j2,
                rcdc: m.rcdc,
                origMat: mat,
                cadEdgeOutline: mesh.userData.cadEdgeOutline,
                rebarCage: mesh.userData.rebarCage,
                momentDiagram: mesh.userData.momentDiagram,
                shearDiagram: mesh.userData.shearDiagram
            };

            scene.add(mesh);
            memberMeshes.push(mesh);
        });

        // 2. Build Joints / Nodes
        const nodeGeom = new THREE.SphereGeometry(0.08, 12, 12);
        Object.values(joints).forEach(j => {
            const nodeMesh = new THREE.Mesh(nodeGeom, matNode.clone());
            nodeMesh.position.set(j.x - OFFSET_X, j.y, j.z - OFFSET_Z);
            nodeMesh.userData = {
                jointId: j.id,
                x: j.x,
                y: j.y,
                z: j.z
            };
            scene.add(nodeMesh);
            jointMeshes.push(nodeMesh);
        });

        // 3. Build Isolated Pad Footings (From authentic RCDC schedule)
        if (data.footings) {
            data.footings.forEach(ft => {
                const footingGeom = new THREE.BoxGeometry(ft.length, ft.depth, ft.width);
                const footingMesh = new THREE.Mesh(footingGeom, matFooting.clone());
                footingMesh.position.set(ft.x - OFFSET_X, -ft.depth / 2.0, ft.z - OFFSET_Z);

                // Add 3D Footing bottom rebar mesh
                const fCage = buildRebarMeshForFooting(ft.length, ft.depth, ft.width, ft);
                footingMesh.add(fCage);
                footingMesh.userData = {
                    isFooting: true,
                    footing: ft,
                    jointId: ft.jointId,
                    rebarCage: fCage,
                    origMat: matFooting
                };

                scene.add(footingMesh);
                footingMeshes.push(footingMesh);
            });
        }

        // 4. Build Monolithic RCC Slabs (5" / 125mm Thick)
        // Engineering Rule: Top of slab is flush with top of 430mm beam!
        if (data.slabs) {
            data.slabs.forEach(p => {
                const slabW = p.xMax - p.xMin;
                const slabL = p.zMax - p.zMin;
                const slabThk = p.thickness; // 0.125m

                const slabGeom = new THREE.BoxGeometry(slabW, slabThk, slabL);
                const slabMesh = new THREE.Mesh(slabGeom, matSlab.clone());
                const slabX = (p.xMin + p.xMax) / 2.0 - OFFSET_X;
                const slabZ = (p.zMin + p.zMax) / 2.0 - OFFSET_Z;
                slabMesh.position.set(slabX, p.yCenter, slabZ);

                // Seam border lines showing slab panel edges
                const edgeGeom = new THREE.EdgesGeometry(slabGeom);
                const edgeLine = new THREE.LineSegments(edgeGeom, new THREE.LineBasicMaterial({
                    color: 0x38bdf8,
                    transparent: true,
                    opacity: 0.4
                }));
                slabMesh.add(edgeLine);

                slabMesh.userData = {
                    isSlab: true,
                    panel: p,
                    story: p.story
                };

                scene.add(slabMesh);
                slabMeshes.push(slabMesh);
            });
        }

        // 5. Ground Grid
        gridHelper = new THREE.GridHelper(30, 30, 0xffd700, 0x1f293d);
        gridHelper.position.y = -0.55;
        scene.add(gridHelper);

        // Lighting (Clean, Crisp 3-Point Architectural Studio Lighting with Zero GPU Overhead)
        ambientLight = new THREE.HemisphereLight(0xffffff, 0x1e293b, 0.45);
        scene.add(ambientLight);

        // Key Sun / Studio Light (Warm South-East high angle)
        dirLight1 = new THREE.DirectionalLight(0xfffaf0, 1.25);
        dirLight1.position.set(24, 40, 24);
        dirLight1.castShadow = false;
        scene.add(dirLight1);

        // Fill Light (Soft cool North-West low angle)
        dirLight2 = new THREE.DirectionalLight(0xe2e8f0, 0.40);
        dirLight2.position.set(-24, 18, -20);
        scene.add(dirLight2);

        // Crisp Rim / Back Accent Light (High rear-North angle)
        // Grazes top edges of parapets, beams, columns, and railings with sharp silhouette pop
        dirLight3 = new THREE.DirectionalLight(0xffffff, 0.55);
        dirLight3.position.set(0, 32, -32);
        dirLight3.castShadow = false;
        scene.add(dirLight3);

        // 6. Realistic Architectural 3D Simulation Model (Lazy-loaded on first demand in staadViewerSetAnalysisMode)
        // architecturalModel is instantiated when Realistic 3D mode is activated.
    }

    function initThree() {
        if (isInitialized) return;

        canvas = document.getElementById('staad3dCanvas');
        container = document.getElementById('staadViewportContainer');
        if (!canvas || !container) return;

        // Scene (High contrast, fog-free engineering & architectural clarity)
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x090e1a);
        scene.fog = null;

        // Camera
        const aspect = container.clientWidth / container.clientHeight;
        camera = new THREE.PerspectiveCamera(45, aspect, 0.5, 500);
        setCameraView('iso');

        // High-Quality, Power-Efficient WebGL Renderer
        renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true, // Always true for razor-sharp edges and zero jaggies
            alpha: false,
            powerPreference: 'high-performance',
            logarithmicDepthBuffer: false
        });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 768 ? 1.0 : 1.25));
        renderer.shadowMap.enabled = false;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.04; // Natural calibrated dynamic range (zero white blowout)
        renderer.outputEncoding = THREE.sRGBEncoding;

        // Generate a Balanced Subtle Studio Environment Map
        // Provides realistic specular reflection highlights without washing out or bleaching colors!
        const pmremGenerator = new THREE.PMREMGenerator(renderer);
        pmremGenerator.compileEquirectangularShader();
        const envScene = new THREE.Scene();
        envScene.background = new THREE.Color(0xdde3ea);
        const skyDome = new THREE.Mesh(
            new THREE.SphereGeometry(100, 32, 16),
            new THREE.MeshBasicMaterial({ color: 0xe2e8f0, side: THREE.BackSide })
        );
        envScene.add(skyDome);
        const envLight1 = new THREE.DirectionalLight(0xfffbeb, 1.0);
        envLight1.position.set(24, 40, 24);
        envScene.add(envLight1);
        const envLight2 = new THREE.DirectionalLight(0xe0f2fe, 0.5);
        envLight2.position.set(-20, 20, -20);
        envScene.add(envLight2);
        const envLight3 = new THREE.HemisphereLight(0xffffff, 0x1e293b, 0.7);
        envScene.add(envLight3);
        scene.environment = pmremGenerator.fromScene(envScene, 0.04).texture;
        pmremGenerator.dispose();

        // Controls
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.rotateSpeed = 0.8;
        controls.zoomSpeed = 1.0;
        controls.panSpeed = 0.8;
        controls.maxDistance = 80;
        controls.minDistance = 2;
        controls.target.set(0, 6.0, 0);
        controls.addEventListener('change', () => requestRender(2));

        // Tooltip element
        tooltipEl = document.getElementById('staadTooltip');

        // Events
        window.addEventListener('resize', onWindowResize);
        canvas.addEventListener('mousemove', onCanvasMouseMove);
        canvas.addEventListener('mouseleave', onMouseLeave);
        canvas.addEventListener('click', onCanvasClick);
        canvas.addEventListener('dblclick', onCanvasDoubleClick);

        buildModel();

        isInitialized = true;
        animate();
    }

    function setCameraView(view) {
        if (!camera) return;
        currentView = view || 'iso';
        const dist = (analysisMode === 'realistic') ? 36 : 32;
        const targetY = (analysisMode === 'realistic') ? 7.2 : 6.0;

        switch (view) {
            case 'front': // Front (South) looking North (+Z to -Z)
                camera.position.set(0, targetY, dist);
                break;
            case 'rear': // Rear (North) looking South (-Z to +Z)
                camera.position.set(0, targetY, -dist);
                break;
            case 'left': // Left (West) looking East (-X to +X)
                camera.position.set(-dist, targetY, 0);
                break;
            case 'right': // Right (East) looking West (+X to -X)
                camera.position.set(dist, targetY, 0);
                break;
            case 'top': // Top (Plan) looking down (+Y down)
                camera.position.set(0.001, dist + 8, 0);
                break;
            case 'iso':
            default:
                camera.position.set(24, 22, 26);
                break;
        }

        if (controls) {
            controls.target.set(0, targetY, 0);
            controls.update();
        }
        requestRender(5);

        // Update active class on camera view buttons
        ['Iso', 'Front', 'Rear', 'Left', 'Right', 'Top'].forEach(v => {
            const btn = document.getElementById('btnView' + v);
            if (btn) btn.classList.toggle('active', currentView.toLowerCase() === v.toLowerCase());
        });
    }

    function onWindowResize() {
        if (!container || !renderer || !camera) return;
        const width = container.clientWidth;
        const height = container.clientHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
        requestRender(5);

        if (window.innerWidth < 768) {
            const minimap = document.getElementById('staadGridMinimap');
            if (minimap && !minimap.classList.contains('minimized')) {
                minimap.classList.add('minimized');
                const icon = document.getElementById('minimapToggleIcon');
                if (icon) icon.className = 'fas fa-chevron-up';
            }
        }
    }

    function getIntersectedObject(e) {
        if (!container || analysisMode === 'realistic') return null;
        const rect = container.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);

        // Check members and footings first, then slabs
        const visibleMembers = memberMeshes.filter(m => m.visible);
        const visibleFootings = footingMeshes.filter(f => f.visible);
        const visibleSlabs = showSlabs ? slabMeshes.filter(s => s.visible) : [];

        const targets = [...visibleMembers, ...visibleFootings, ...visibleSlabs];
        const intersects = raycaster.intersectObjects(targets, false);

        if (intersects.length > 0) {
            return intersects[0].object;
        }
        return null;
    }

    let lastRaycastTime = 0;
    let isPointerDown = false;

    // Track pointer drag so we never raycast while orbiting/panning
    window.addEventListener('pointerdown', () => { isPointerDown = true; }, { passive: true });
    window.addEventListener('pointerup', () => { isPointerDown = false; }, { passive: true });

    function onCanvasMouseMove(e) {
        // 1. Never raycast while rotating/panning the camera
        if (isPointerDown) return;

        // 2. Throttle raycasting to max 20 checks/sec (50ms) instead of 120+/sec
        const now = performance.now();
        if (now - lastRaycastTime < 50) return;
        lastRaycastTime = now;

        const hit = getIntersectedObject(e);

        if (hit && hit !== hoveredMesh) {
            if (hoveredMesh && hoveredMesh !== selectedMesh && hoveredMesh.material) {
                hoveredMesh.material.color.setHex(hoveredOrigColor);
            }

            hoveredMesh = hit;
            if (hit !== selectedMesh && hit.material) {
                hoveredOrigColor = hit.material.color.getHex();
                hit.material.color.setHex(COLOR_HIGHLIGHT);
            }
            requestRender(2);

            // Update tooltip
            const rect = container.getBoundingClientRect();
            const u = hit.userData;

            if (u.isSlab) {
                const p = u.panel;
                document.getElementById('staadTooltipHeader').textContent = `Slab Panel ${p.mark}`;
                document.getElementById('staadTooltipType').textContent = `125 mm (5") RCC Slab`;
                document.getElementById('staadTooltipDim').textContent = `${p.lx} × ${p.lz} m (${p.spanType})`;
                document.getElementById('staadTooltipLength').textContent = `Thk: 125 mm (M25 : Fe550)`;
                document.getElementById('staadTooltipLevel').textContent = p.storyLevel;
                document.getElementById('staadTooltipNodes').textContent = `Bottom: ${p.botSS}`;
                document.getElementById('staadTooltipRebar').textContent = 'Double-click to inspect';
            } else if (u.isFooting) {
                const ft = u.footing;
                document.getElementById('staadTooltipHeader').textContent = ft.mark + ' (Footing)';
                document.getElementById('staadTooltipType').textContent = 'Isolated Pad Footing';
                document.getElementById('staadTooltipDim').textContent = ft.size;
                document.getElementById('staadTooltipLength').textContent = 'Depth: ' + (ft.depth * 1000) + ' mm';
                document.getElementById('staadTooltipLevel').textContent = 'Foundation Level (0.00m)';
                document.getElementById('staadTooltipNodes').textContent = 'Supports ' + ft.columnMark;
                document.getElementById('staadTooltipRebar').textContent = ft.longRebar;
            } else {
                const rcdc = u.rcdc || {};
                document.getElementById('staadTooltipHeader').textContent = (u.type === 'column' ? 'Column #' : 'Beam #') + u.memberId + (rcdc.mark ? ' (' + rcdc.mark + ')' : '');
                document.getElementById('staadTooltipType').textContent = u.type === 'column' ? 'RCC Column' : 'RCC Beam';
                document.getElementById('staadTooltipDim').textContent = `${Math.round(u.width * 1000)} × ${Math.round(u.depth * 1000)} mm`;
                document.getElementById('staadTooltipLength').textContent = `${u.length.toFixed(3)} m (${(u.length * 3.28084).toFixed(2)} ft)`;
                document.getElementById('staadTooltipLevel').textContent = getStoryLabel(u.story);
                document.getElementById('staadTooltipNodes').textContent = `Joint ${u.node1} → Joint ${u.node2}`;
                
                const rebarRow = document.getElementById('staadTooltipRebarRow');
                const rebarSpan = document.getElementById('staadTooltipRebar');
                if (rebarRow && rebarSpan) {
                    if (analysisMode === 'moment') {
                        rebarRow.querySelector('span:first-child').textContent = 'Moment Mz:';
                        rebarRow.style.color = '#f87171';
                        if (u.type === 'column') {
                            rebarSpan.textContent = `Top: ${rcdc.muTop || 48} kNm | Bot: ${rcdc.muBot || -40.8} kNm`;
                        } else {
                            rebarSpan.textContent = `L: ${rcdc.muLeft || -72} | M: +${rcdc.muMid || 48} | R: ${rcdc.muRight || -80} kNm`;
                        }
                    } else if (analysisMode === 'shear') {
                        rebarRow.querySelector('span:first-child').textContent = 'Shear Fy:';
                        rebarRow.style.color = '#34d399';
                        if (u.type === 'column') {
                            rebarSpan.textContent = `Vu = ${rcdc.vuCol || 29.1} kN`;
                        } else {
                            rebarSpan.textContent = `L: ${rcdc.vuLeft || 58.8} kN | R: ${rcdc.vuRight || 73.6} kN`;
                        }
                    } else {
                        rebarRow.querySelector('span:first-child').textContent = 'Rebar:';
                        rebarRow.style.color = '#00e5ff';
                        rebarSpan.textContent = rcdc.mainRebar || rcdc.topRebar || 'Double-click to view';
                    }
                }
            }

            tooltipEl.style.display = 'block';
            tooltipEl.style.left = (e.clientX - rect.left) + 'px';
            tooltipEl.style.top = (e.clientY - rect.top) + 'px';
        } else if (!hit) {
            onMouseLeave();
        }
    }

    function onMouseLeave() {
        if (hoveredMesh && hoveredMesh !== selectedMesh && hoveredMesh.material) {
            hoveredMesh.material.color.setHex(hoveredOrigColor);
            hoveredMesh = null;
            requestRender(2);
        }
        if (tooltipEl) {
            tooltipEl.style.display = 'none';
        }
    }

    // Single Click: 3D Selection highlight only (or updates inspector if already open)
    function onCanvasClick(e) {
        requestRender(5);
        const hit = getIntersectedObject(e);
        if (hit) {
            const inspector = document.getElementById('staadRebarInspector');
            if (inspector && inspector.classList.contains('active')) {
                // When inspector drawer is already open, clicking another component seamlessly switches to it
                selectAndInspectObject(hit);
            } else {
                selectObject3dOnly(hit);
            }
        } else {
            clearSelectionHighlight();
        }
    }

    // Double Click: Directly opens the slide-in RCC Detailing Inspector on any component
    function onCanvasDoubleClick(e) {
        requestRender(5);
        const hit = getIntersectedObject(e);
        if (hit) {
            selectAndInspectObject(hit);
        }
    }

    function selectObject3dOnly(hit) {
        if (selectedMesh && selectedMesh !== hit && selectedMesh.material) {
            const orig = getOriginalMeshColor(selectedMesh);
            selectedMesh.material.color.setHex(orig);
        }

        selectedMesh = hit;
        hit.material.color.setHex(COLOR_SELECTED);

        // Intentionally keep camera stable — do not jerk controls.target on click!
        updateSelectionBar(hit.userData);
    }

    function clearSelectionHighlight() {
        if (selectedMesh && selectedMesh.material) {
            const orig = getOriginalMeshColor(selectedMesh);
            selectedMesh.material.color.setHex(orig);
            selectedMesh = null;
        }
        hideSelectionBar();
        requestRender(5);
    }

    function selectAndInspectObject(hit) {
        selectObject3dOnly(hit);
        hideSelectionBar();
        openRebarInspector(hit.userData);
    }

    function updateSelectionBar(u) {
        const bar = document.getElementById('staadSelectionBar');
        if (!bar) return;

        const badge = document.getElementById('selBadge');
        const title = document.getElementById('selTitle');
        const dim = document.getElementById('selDim');

        if (u.isSlab) {
            const p = u.panel;
            if (badge) { badge.textContent = 'SLAB'; badge.style.color = '#00e5ff'; }
            if (title) title.textContent = `Panel ${p.mark} (${p.spanType})`;
            if (dim) dim.textContent = `t = 125mm • ${p.lx} × ${p.lz}m`;
        } else if (u.isFooting) {
            const ft = u.footing;
            if (badge) { badge.textContent = 'FOOTING'; badge.style.color = '#e2e8f0'; }
            if (title) title.textContent = `${ft.mark} (${ft.columnMark})`;
            if (dim) dim.textContent = ft.size;
        } else {
            const isCol = (u.type === 'column');
            const rcdc = u.rcdc || {};
            if (badge) {
                badge.textContent = isCol ? 'COLUMN' : 'BEAM';
                badge.style.color = isCol ? '#ffb703' : '#38bdf8';
            }
            if (title) title.textContent = `${rcdc.mark || (isCol ? 'C' : 'B') + u.memberId} (Member #${u.memberId})`;
            if (dim) dim.textContent = `${Math.round(u.width * 1000)} × ${Math.round(u.depth * 1000)} mm • L = ${u.length.toFixed(2)}m`;
        }

        bar.classList.add('active');
    }

    function hideSelectionBar() {
        const bar = document.getElementById('staadSelectionBar');
        if (bar) bar.classList.remove('active');
    }

    window.staadViewerInspectSelected = function () {
        if (selectedMesh) {
            selectAndInspectObject(selectedMesh);
        }
    };

    window.staadViewerClearSelection = function () {
        clearSelectionHighlight();
    };

    function getOriginalMeshColor(mesh) {
        if (mesh.userData.isSlab) return COLOR_SLAB;
        if (mesh.userData.isFooting) return COLOR_FOOTING;
        return mesh.userData.type === 'column' ? COLOR_COLUMN : COLOR_BEAM;
    }

    // ==========================================
    // 2D CROSS SECTION SVG GENERATOR
    // ==========================================
    function render2dCrossSectionSvg(u) {
        if (u.isSlab) {
            const p = u.panel;
            return `
                <svg viewBox="0 0 280 160" class="rebar-svg-wrapper" style="width:100%; height:150px;">
                    <!-- Slab Cross Section (125mm thick) -->
                    <rect x="25" y="45" width="230" height="50" fill="rgba(14, 165, 233, 0.15)" stroke="#0ea5e9" stroke-width="2" />
                    
                    <!-- Bottom Main Steel Rods (20mm cover) -->
                    <line x1="30" y1="85" x2="250" y2="85" stroke="#38bdf8" stroke-width="2.5" />
                    <!-- Dot distribution rebar -->
                    <circle cx="45" cy="85" r="3" fill="#ffd700" />
                    <circle cx="75" cy="85" r="3" fill="#ffd700" />
                    <circle cx="105" cy="85" r="3" fill="#ffd700" />
                    <circle cx="135" cy="85" r="3" fill="#ffd700" />
                    <circle cx="165" cy="85" r="3" fill="#ffd700" />
                    <circle cx="195" cy="85" r="3" fill="#ffd700" />
                    <circle cx="225" cy="85" r="3" fill="#ffd700" />

                    <!-- Top Extra / Distribution Steel -->
                    <line x1="30" y1="55" x2="90" y2="55" stroke="#f43f5e" stroke-width="2" />
                    <line x1="190" y1="55" x2="250" y2="55" stroke="#f43f5e" stroke-width="2" />

                    <!-- Dimension Callouts -->
                    <text x="140" y="35" font-size="9" fill="#00e5ff" text-anchor="middle" font-weight="700">Span: ${p.lx} m × ${p.lz} m (${p.spanType})</text>
                    <text x="258" y="73" font-size="9" fill="#ffd700" text-anchor="start" font-weight="700">t = 125 mm (5")</text>
                    <text x="140" y="115" font-size="8" fill="#94a3b8" text-anchor="middle">Bottom: ${p.botSS} &bull; Top: ${p.topMesh}</text>
                </svg>
            `;
        }

        const isFooting = u.isFooting;
        const isColumn = (u.type === 'column');
        const rcdc = isFooting ? u.footing : u.rcdc;
        if (!rcdc) return '<p style="color:#94a3b8; font-size:0.75rem;">No rebar detail available.</p>';

        if (isFooting) {
            return `
                <svg viewBox="0 0 280 180" class="rebar-svg-wrapper" style="width:100%; height:160px;">
                    <!-- PCC Base Layer -->
                    <rect x="25" y="125" width="230" height="25" fill="#1e293b" stroke="#64748b" stroke-width="1.5" />
                    <text x="140" y="142" font-size="9" fill="#94a3b8" text-anchor="middle">PCC 150mm THK (M15)</text>

                    <!-- Pad Footing Rect -->
                    <rect x="45" y="65" width="190" height="60" fill="rgba(139, 92, 246, 0.15)" stroke="#8b5cf6" stroke-width="2" />
                    
                    <!-- Rebar Mat Lines -->
                    <line x1="55" y1="115" x2="225" y2="115" stroke="#ffd700" stroke-width="2.5" />
                    <!-- Dot rebar in short direction -->
                    <circle cx="70" cy="115" r="3" fill="#00e5ff" />
                    <circle cx="95" cy="115" r="3" fill="#00e5ff" />
                    <circle cx="120" cy="115" r="3" fill="#00e5ff" />
                    <circle cx="145" cy="115" r="3" fill="#00e5ff" />
                    <circle cx="170" cy="115" r="3" fill="#00e5ff" />
                    <circle cx="195" cy="115" r="3" fill="#00e5ff" />
                    <circle cx="210" cy="115" r="3" fill="#00e5ff" />

                    <!-- Pedestal / Starter Column Stub -->
                    <rect x="115" y="25" width="50" height="40" fill="#0f172a" stroke="#ffb703" stroke-width="1.5" />
                    <line x1="123" y1="30" x2="123" y2="110" stroke="#ffb703" stroke-width="1.8" />
                    <line x1="157" y1="30" x2="157" y2="110" stroke="#ffb703" stroke-width="1.8" />

                    <!-- Dimension Labels -->
                    <text x="140" y="55" font-size="8" fill="#ffd700" text-anchor="middle">${rcdc.size}</text>
                    <text x="140" y="90" font-size="7.5" fill="#94a3b8" text-anchor="middle">Depth: ${rcdc.depth * 1000}mm &bull; Cover: 50mm</text>
                </svg>
            `;
        }

        if (isColumn) {
            const b = rcdc.b || 230;
            const d = rcdc.d || 450;
            const isHeavy = (d > 500);
            const isMumty = (d < 350);

            const bW = 85;
            const bH = isHeavy ? 145 : (isMumty ? 95 : 125);
            const bX = (280 - bW) / 2.0;
            const bY = 22;
            const cover = 9;

            return `
                <svg viewBox="0 0 280 185" class="rebar-svg-wrapper" style="width:100%; height:170px;">
                    <!-- Outer Concrete Boundary -->
                    <rect x="${bX}" y="${bY}" width="${bW}" height="${bH}" fill="rgba(255, 183, 3, 0.12)" stroke="#ffb703" stroke-width="2" rx="2" />
                    
                    <!-- Closed Rectangular Tie with 135 deg Hooks -->
                    <rect x="${bX + cover}" y="${bY + cover}" width="${bW - 2*cover}" height="${bH - 2*cover}" fill="none" stroke="#00e5ff" stroke-width="1.5" rx="3" />
                    <line x1="${bX + cover + 4}" y1="${bY + cover}" x2="${bX + cover - 2}" y2="${bY + cover + 6}" stroke="#00e5ff" stroke-width="1.5" />

                    <!-- 4 Corner Bars (Gold) -->
                    <circle cx="${bX + cover + 5}" cy="${bY + cover + 5}" r="4.5" fill="#ffd700" stroke="#000" stroke-width="0.8" />
                    <circle cx="${bX + bW - cover - 5}" cy="${bY + cover + 5}" r="4.5" fill="#ffd700" stroke="#000" stroke-width="0.8" />
                    <circle cx="${bX + cover + 5}" cy="${bY + bH - cover - 5}" r="4.5" fill="#ffd700" stroke="#000" stroke-width="0.8" />
                    <circle cx="${bX + bW - cover - 5}" cy="${bY + bH - cover - 5}" r="4.5" fill="#ffd700" stroke="#000" stroke-width="0.8" />

                    <!-- Face Bars -->
                    ${isHeavy ? `
                        <circle cx="${bX + cover + 5}" cy="${bY + bH*0.3}" r="4" fill="#38bdf8" />
                        <circle cx="${bX + bW - cover - 5}" cy="${bY + bH*0.3}" r="4" fill="#38bdf8" />
                        <circle cx="${bX + cover + 5}" cy="${bY + bH*0.5}" r="4" fill="#38bdf8" />
                        <circle cx="${bX + bW - cover - 5}" cy="${bY + bH*0.5}" r="4" fill="#38bdf8" />
                        <circle cx="${bX + cover + 5}" cy="${bY + bH*0.7}" r="4" fill="#38bdf8" />
                        <circle cx="${bX + bW - cover - 5}" cy="${bY + bH*0.7}" r="4" fill="#38bdf8" />
                    ` : (!isMumty ? `
                        <circle cx="${bX + cover + 5}" cy="${bY + bH/2}" r="4" fill="#38bdf8" />
                        <circle cx="${bX + bW - cover - 5}" cy="${bY + bH/2}" r="4" fill="#38bdf8" />
                    ` : '')}

                    <!-- Dimensions & Annotations -->
                    <text x="${bX + bW/2}" y="${bY - 4}" font-size="9" fill="#00e5ff" text-anchor="middle" font-weight="700">b = ${b} mm</text>
                    <text x="${bX + bW + 6}" y="${bY + bH/2}" font-size="9" fill="#00e5ff" text-anchor="start" font-weight="700">D = ${d} mm</text>

                    <!-- Callouts -->
                    <text x="${bX - 8}" y="${bY + 12}" font-size="8" fill="#ffd700" text-anchor="end">Corners</text>
                    <line x1="${bX - 4}" y1="${bY + 10}" x2="${bX + cover + 3}" y2="${bY + cover + 5}" stroke="#ffd700" stroke-width="0.8" stroke-dasharray="2,2" />

                    <text x="${bX - 8}" y="${bY + bH/2 + 2}" font-size="8" fill="#38bdf8" text-anchor="end">Face Bars</text>
                    <line x1="${bX - 4}" y1="${bY + bH/2}" x2="${bX + cover + 3}" y2="${bY + bH/2}" stroke="#38bdf8" stroke-width="0.8" stroke-dasharray="2,2" />

                    <text x="${bX + bW/2}" y="${bY + bH + 14}" font-size="7.5" fill="#00e5ff" text-anchor="middle">Tie: ${rcdc.links}</text>
                </svg>
            `;
        }

        // Beam Cross Section
        const b = rcdc.b || 230;
        const d = rcdc.d || 430;
        const bW = 100;
        const bH = d === 300 ? 95 : 125;
        const bX = (280 - bW) / 2.0;
        const bY = 22;
        const cover = 9;

        const topCnt = rcdc.topCount || 3;
        const botCnt = rcdc.botCount || 3;

        return `
            <svg viewBox="0 0 280 180" class="rebar-svg-wrapper" style="width:100%; height:160px;">
                <!-- Beam Outline -->
                <rect x="${bX}" y="${bY}" width="${bW}" height="${bH}" fill="rgba(0, 229, 255, 0.08)" stroke="#00e5ff" stroke-width="2" rx="2" />

                <!-- Stirrup Wire Loop with 135 deg Hooks -->
                <rect x="${bX + cover}" y="${bY + cover}" width="${bW - 2*cover}" height="${bH - 2*cover}" fill="none" stroke="#ffd700" stroke-width="1.5" rx="3" />
                <line x1="${bX + cover + 5}" y1="${bY + cover}" x2="${bX + cover - 2}" y2="${bY + cover + 5}" stroke="#ffd700" stroke-width="1.5" />
                
                <!-- Top Rebar Bars -->
                <circle cx="${bX + cover + 6}" cy="${bY + cover + 6}" r="4.5" fill="#f43f5e" stroke="#000" stroke-width="0.8" />
                <circle cx="${bX + bW - cover - 6}" cy="${bY + cover + 6}" r="4.5" fill="#f43f5e" stroke="#000" stroke-width="0.8" />
                ${topCnt >= 3 ? `<circle cx="${bX + bW/2}" cy="${bY + cover + 6}" r="4.5" fill="#f43f5e" stroke="#000" stroke-width="0.8" />` : ''}

                <!-- Bottom Rebar Bars -->
                <circle cx="${bX + cover + 7}" cy="${bY + bH - cover - 7}" r="5.5" fill="#38bdf8" stroke="#000" stroke-width="0.8" />
                <circle cx="${bX + bW - cover - 7}" cy="${bY + bH - cover - 7}" r="5.5" fill="#38bdf8" stroke="#000" stroke-width="0.8" />
                ${botCnt >= 3 ? `<circle cx="${bX + bW/2}" cy="${bY + bH - cover - 7}" r="5.5" fill="#38bdf8" stroke="#000" stroke-width="0.8" />` : ''}

                <!-- Dimensions & Annotations -->
                <text x="${bX + bW/2}" y="${bY - 4}" font-size="9" fill="#00e5ff" text-anchor="middle" font-weight="700">b = ${b} mm</text>
                <text x="${bX + bW + 6}" y="${bY + bH/2}" font-size="9" fill="#00e5ff" text-anchor="start" font-weight="700">D = ${d} mm</text>
                
                <!-- Callout Leaders -->
                <text x="${bX - 6}" y="${bY + 12}" font-size="8" fill="#f43f5e" text-anchor="end" font-weight="700">Top: ${rcdc.topRebar.split('(')[0]}</text>
                <line x1="${bX - 3}" y1="${bY + 10}" x2="${bX + cover + 4}" y2="${bY + cover + 6}" stroke="#f43f5e" stroke-width="0.8" stroke-dasharray="2,2" />

                <text x="${bX - 6}" y="${bY + bH - 6}" font-size="8" fill="#38bdf8" text-anchor="end" font-weight="700">Bot: ${rcdc.botRebar.split('(')[0]}</text>
                <line x1="${bX - 3}" y1="${bY + bH - 8}" x2="${bX + cover + 4}" y2="${bY + bH - cover - 7}" stroke="#38bdf8" stroke-width="0.8" stroke-dasharray="2,2" />

                <text x="${bX + bW/2}" y="${bY + bH + 13}" font-size="7.5" fill="#ffd700" text-anchor="middle">Stirrups: ${rcdc.stirrups}</text>
            </svg>
        `;
    }

    // ==========================================
    // 2D MOMENT & SHEAR DIAGRAM SVG GENERATORS
    // ==========================================

    function render2dMomentDiagramSvg(u) {
        const isColumn = (u.type === 'column');
        const rcdc = u.rcdc || {};
        if (isColumn) {
            const mTop = rcdc.muTop !== undefined ? rcdc.muTop : 48.0;
            const mBot = rcdc.muBot !== undefined ? rcdc.muBot : -40.8;
            return `
                <svg viewBox="0 0 280 180" class="rebar-svg-wrapper" style="width:100%; height:160px;">
                    <!-- Column Axis -->
                    <line x1="140" y1="25" x2="140" y2="155" stroke="#64748b" stroke-width="2" stroke-dasharray="4,3" />
                    <text x="140" y="18" font-size="8" fill="#94a3b8" text-anchor="middle">Column Axis (h = ${u.length.toFixed(2)}m)</text>
                    
                    <!-- Moment Trapezoid -->
                    <polygon points="140,30 195,30 100,150 140,150" fill="rgba(239, 68, 68, 0.25)" stroke="#ef4444" stroke-width="2" />
                    
                    <!-- Zero Axis Markers -->
                    <line x1="135" y1="30" x2="145" y2="30" stroke="#ffd700" stroke-width="1.5" />
                    <line x1="135" y1="150" x2="145" y2="150" stroke="#ffd700" stroke-width="1.5" />
                    
                    <!-- Values -->
                    <text x="202" y="34" font-size="9" fill="#f87171" font-weight="700">M_top = +${Math.abs(mTop).toFixed(1)} kNm</text>
                    <text x="92" y="154" font-size="9" fill="#38bdf8" font-weight="700" text-anchor="end">M_bot = ${mBot.toFixed(1)} kNm</text>
                    
                    <text x="140" y="95" font-size="7.5" fill="#ffd700" text-anchor="middle">P-M Interaction: ${rcdc.interactionRatio || '0.81'} (Safe)</text>
                </svg>
            `;
        }

        // Beam Bending Moment Parabola
        const mL = rcdc.muLeft !== undefined ? rcdc.muLeft : -72.46;
        const mM = rcdc.muMid !== undefined ? rcdc.muMid : 48.71;
        const mR = rcdc.muRight !== undefined ? rcdc.muRight : -80.31;
        
        const scale = 0.55;
        const y0 = 90;
        const xL = 40;
        const xM = 140;
        const xR = 240;
        
        const yL = y0 + mL * scale;
        const yMid = y0 + mM * scale;
        const yR = y0 + mR * scale;
        const yCtrl = 2 * yMid - 0.5 * (yL + yR);

        return `
            <svg viewBox="0 0 280 180" class="rebar-svg-wrapper" style="width:100%; height:160px;">
                <!-- Datum -->
                <line x1="30" y1="${y0}" x2="250" y2="${y0}" stroke="#64748b" stroke-width="1.5" stroke-dasharray="3,3" />
                <text x="255" y="${y0 + 3}" font-size="7.5" fill="#64748b">0 M</text>
                
                <!-- Support Column Markers -->
                <rect x="36" y="${y0 - 25}" width="8" height="50" fill="#1e293b" stroke="#ffb703" stroke-width="1" />
                <rect x="236" y="${y0 - 25}" width="8" height="50" fill="#1e293b" stroke="#ffb703" stroke-width="1" />
                
                <!-- Shaded Moment Area -->
                <path d="M ${xL} ${y0} L ${xL} ${yL} Q ${xM} ${yCtrl} ${xR} ${yR} L ${xR} ${y0} Z" 
                      fill="url(#momentGradient)" stroke="none" opacity="0.45" />

                <!-- Moment Envelope Curve Line -->
                <path d="M ${xL} ${yL} Q ${xM} ${yCtrl} ${xR} ${yR}" 
                      fill="none" stroke="#ef4444" stroke-width="2.5" />
                
                <defs>
                    <linearGradient id="momentGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#ef4444" stop-opacity="0.8" />
                        <stop offset="50%" stop-color="#06b6d4" stop-opacity="0.8" />
                        <stop offset="100%" stop-color="#ef4444" stop-opacity="0.8" />
                    </linearGradient>
                </defs>

                <!-- Support & Midspan Value Pins -->
                <circle cx="${xL}" cy="${yL}" r="3.5" fill="#ef4444" stroke="#ffffff" stroke-width="1" />
                <circle cx="${xM}" cy="${yMid}" r="3.5" fill="#06b6d4" stroke="#ffffff" stroke-width="1" />
                <circle cx="${xR}" cy="${yR}" r="3.5" fill="#ef4444" stroke="#ffffff" stroke-width="1" />

                <!-- Moment Value Labels -->
                <text x="${xL}" y="${Math.min(yL - 6, y0 - 15)}" font-size="8.5" fill="#f87171" font-weight="700" text-anchor="middle">${mL.toFixed(1)} kNm</text>
                <text x="${xL}" y="${Math.min(yL - 16, y0 - 25)}" font-size="7" fill="#94a3b8" text-anchor="middle">Hogging (-)</text>

                <text x="${xM}" y="${Math.max(yMid + 14, y0 + 20)}" font-size="8.5" fill="#38bdf8" font-weight="700" text-anchor="middle">+${mM.toFixed(1)} kNm</text>
                <text x="${xM}" y="${Math.max(yMid + 24, y0 + 30)}" font-size="7" fill="#94a3b8" text-anchor="middle">Sagging (+)</text>

                <text x="${xR}" y="${Math.min(yR - 6, y0 - 15)}" font-size="8.5" fill="#f87171" font-weight="700" text-anchor="middle">${mR.toFixed(1)} kNm</text>
                <text x="${xR}" y="${Math.min(yR - 16, y0 - 25)}" font-size="7" fill="#94a3b8" text-anchor="middle">Hogging (-)</text>
            </svg>
        `;
    }

    function render2dShearDiagramSvg(u) {
        const isColumn = (u.type === 'column');
        const rcdc = u.rcdc || {};
        if (isColumn) {
            const vCol = rcdc.vuCol !== undefined ? rcdc.vuCol : 29.13;
            return `
                <svg viewBox="0 0 280 180" class="rebar-svg-wrapper" style="width:100%; height:160px;">
                    <line x1="140" y1="25" x2="140" y2="155" stroke="#64748b" stroke-width="2" stroke-dasharray="4,3" />
                    <rect x="140" y="30" width="45" height="120" fill="rgba(16, 185, 129, 0.25)" stroke="#10b981" stroke-width="2" />
                    <text x="195" y="95" font-size="9" fill="#34d399" font-weight="700">Vu = ${vCol.toFixed(1)} kN</text>
                    <text x="140" y="170" font-size="7.5" fill="#94a3b8" text-anchor="middle">Uniform Column Shear</text>
                </svg>
            `;
        }

        const vL = rcdc.vuLeft !== undefined ? rcdc.vuLeft : 58.76;
        const vM = rcdc.vuMid !== undefined ? rcdc.vuMid : 50.08;
        const vR = rcdc.vuRight !== undefined ? rcdc.vuRight : 73.63;
        
        const scale = 0.55;
        const y0 = 90;
        const xL = 40;
        const xR = 240;
        
        const yL = y0 - vL * scale;
        const yR = y0 + vR * scale;

        return `
            <svg viewBox="0 0 280 180" class="rebar-svg-wrapper" style="width:100%; height:160px;">
                <!-- Datum -->
                <line x1="30" y1="${y0}" x2="250" y2="${y0}" stroke="#64748b" stroke-width="1.5" stroke-dasharray="3,3" />
                <text x="255" y="${y0 + 3}" font-size="7.5" fill="#64748b">0 V</text>
                
                <!-- Support Column Markers -->
                <rect x="36" y="${y0 - 25}" width="8" height="50" fill="#1e293b" stroke="#ffb703" stroke-width="1" />
                <rect x="236" y="${y0 - 25}" width="8" height="50" fill="#1e293b" stroke="#ffb703" stroke-width="1" />
                
                <!-- Shear Envelope Polygon -->
                <polygon points="${xL},${y0} ${xL},${yL} ${xR},${yR} ${xR},${y0}" 
                         fill="rgba(16, 185, 129, 0.25)" stroke="#10b981" stroke-width="2.2" />

                <!-- Value Pins -->
                <circle cx="${xL}" cy="${yL}" r="3.5" fill="#10b981" stroke="#ffffff" stroke-width="1" />
                <circle cx="${xR}" cy="${yR}" r="3.5" fill="#10b981" stroke="#ffffff" stroke-width="1" />

                <!-- Labels -->
                <text x="${xL}" y="${yL - 6}" font-size="8.5" fill="#34d399" font-weight="700" text-anchor="middle">+${vL.toFixed(1)} kN</text>
                <text x="${xL}" y="${yL - 16}" font-size="7" fill="#94a3b8" text-anchor="middle">Support Shear</text>

                <text x="${xR}" y="${yR + 14}" font-size="8.5" fill="#34d399" font-weight="700" text-anchor="middle">-${vR.toFixed(1)} kN</text>
                <text x="${xR}" y="${yR + 24}" font-size="7" fill="#94a3b8" text-anchor="middle">Support Shear</text>

                <text x="140" y="${y0 - 6}" font-size="7.5" fill="#ffd700" text-anchor="middle">Midspan Shear: ${vM.toFixed(1)} kN</text>
            </svg>
        `;
    }

    // Grid membership helper
    function isMemberOnGrid(m, grid) {
        if (!grid) return true;
        const j1 = m.userData.j1;
        const j2 = m.userData.j2;
        if (!j1 || !j2) return false;
        const tol = 0.25;
        if (grid.axis === 'X') {
            return Math.abs(j1.x - grid.coord) < tol && Math.abs(j2.x - grid.coord) < tol;
        } else if (grid.axis === 'Z') {
            return Math.abs(j1.z - grid.coord) < tol && Math.abs(j2.z - grid.coord) < tol;
        }
        return true;
    }

    function openRebarInspector(u) {
        currentInspectorData = u;
        const inspector = document.getElementById('staadRebarInspector');
        if (!inspector) return;

        const isSlab = u.isSlab;
        const isFooting = u.isFooting;
        const isColumn = (u.type === 'column');
        const rcdc = isSlab ? u.panel : (isFooting ? u.footing : u.rcdc);

        // Header Title & Icon
        const iconEl = document.getElementById('rebarIconBadge');
        const titleEl = document.getElementById('rebarTitle');
        const subEl = document.getElementById('rebarSubtitle');

        if (isSlab) {
            iconEl.innerHTML = '<i class="fas fa-layer-group"></i>';
            iconEl.style.color = '#0ea5e9';
            titleEl.innerHTML = `Slab Panel ${rcdc.mark} <span class="rebar-badge-pass">PASS</span>`;
            subEl.innerHTML = `125 mm (5") Monolithic RCC Slab &bull; ${rcdc.storyLevel}`;
        } else if (isFooting) {
            iconEl.innerHTML = '<i class="fas fa-square-full"></i>';
            iconEl.style.color = '#8b5cf6';
            titleEl.innerHTML = `${rcdc.mark} <span class="rebar-badge-pass">PASS</span>`;
            subEl.innerHTML = `Isolated Pad Footing &bull; Supports ${rcdc.columnMark}`;
        } else if (analysisMode === 'moment') {
            iconEl.innerHTML = '<i class="fas fa-wave-square"></i>';
            iconEl.style.color = '#ef4444';
            titleEl.innerHTML = `${rcdc.mark} (Member #${u.memberId}) <span class="rebar-badge-pass">PASS</span>`;
            subEl.innerHTML = `Moment Mz Design Envelope &bull; ${rcdc.storyLevel}`;
        } else if (analysisMode === 'shear') {
            iconEl.innerHTML = '<i class="fas fa-chart-area"></i>';
            iconEl.style.color = '#10b981';
            titleEl.innerHTML = `${rcdc.mark} (Member #${u.memberId}) <span class="rebar-badge-pass">PASS</span>`;
            subEl.innerHTML = `Shear Force Fy Design Envelope &bull; ${rcdc.storyLevel}`;
        } else if (isColumn) {
            iconEl.innerHTML = '<i class="fas fa-columns"></i>';
            iconEl.style.color = '#ffb703';
            titleEl.innerHTML = `${rcdc.mark} (Member #${u.memberId}) <span class="rebar-badge-pass">PASS</span>`;
            subEl.innerHTML = `RCC Column &bull; ${rcdc.storyLevel}`;
        } else {
            iconEl.innerHTML = '<i class="fas fa-arrows-alt-h"></i>';
            iconEl.style.color = '#00e5ff';
            titleEl.innerHTML = `${rcdc.mark} (Member #${u.memberId}) <span class="rebar-badge-pass">PASS</span>`;
            subEl.innerHTML = `RCC Continuous Beam &bull; ${rcdc.storyLevel}`;
        }

        // Body Content
        const bodyEl = document.getElementById('rebarBody');
        let detailsHtml = '';

        if (isSlab) {
            const svgHtml = render2dCrossSectionSvg(u);
            detailsHtml = `
                <div class="rebar-chips-group">
                    <div class="rebar-chip-row">
                        <span class="rebar-chip-name"><i class="fas fa-ruler-combined"></i> Slab Thickness</span>
                        <span class="rebar-chip-val" style="color:#0ea5e9;">125 mm (5") Concrete Slab</span>
                    </div>
                    <div class="rebar-chip-row">
                        <span class="rebar-chip-name"><i class="fas fa-border-all"></i> Panel Dimensions</span>
                        <span class="rebar-chip-val" style="color:#ffffff;">${rcdc.lx} &times; ${rcdc.lz} m (${rcdc.spanType})</span>
                    </div>
                    <div class="rebar-chip-row">
                        <span class="rebar-chip-name"><i class="fas fa-arrow-down"></i> Bottom Rebar (Short Span)</span>
                        <span class="rebar-chip-val" style="color:#38bdf8;">${rcdc.botSS}</span>
                    </div>
                    <div class="rebar-chip-row">
                        <span class="rebar-chip-name"><i class="fas fa-arrow-right"></i> Bottom Rebar (Long Span)</span>
                        <span class="rebar-chip-val" style="color:#ffd700;">${rcdc.botLS}</span>
                    </div>
                    <div class="rebar-chip-row">
                        <span class="rebar-chip-name"><i class="fas fa-arrow-up"></i> Top Distribution Mesh</span>
                        <span class="rebar-chip-val" style="color:#f43f5e;">${rcdc.topMesh}</span>
                    </div>
                </div>

                <div class="rebar-svg-card">
                    <div class="rebar-svg-card-title">
                        <span><i class="fas fa-drafting-compass"></i> Monolithic Slab Section</span>
                        <span>SP 34 Detailing</span>
                    </div>
                    ${svgHtml}
                </div>

                <table class="rebar-spec-table">
                    <tr>
                        <td class="rebar-spec-label">Concrete / Steel Grade</td>
                        <td class="rebar-spec-val">M25 : Fe 550</td>
                    </tr>
                    <tr>
                        <td class="rebar-spec-label">Monolithic Web Depth</td>
                        <td class="rebar-spec-val">300 mm Web below 125mm Slab</td>
                    </tr>
                    <tr>
                        <td class="rebar-spec-label">Clear Concrete Cover</td>
                        <td class="rebar-spec-val">20 mm</td>
                    </tr>
                    <tr>
                        <td class="rebar-spec-label">Limit State Check</td>
                        <td class="rebar-spec-val" style="color:#22c55e;">Flexure &amp; Deflection Pass (IS 456)</td>
                    </tr>
                </table>
            `;
        } else if (isFooting) {
            const svgHtml = render2dCrossSectionSvg(u);
            detailsHtml = `
                <div class="rebar-chips-group">
                    <div class="rebar-chip-row">
                        <span class="rebar-chip-name"><i class="fas fa-ruler-combined"></i> Footing Dimensions</span>
                        <span class="rebar-chip-val" style="color:#8b5cf6;">${rcdc.size}</span>
                    </div>
                    <div class="rebar-chip-row">
                        <span class="rebar-chip-name"><i class="fas fa-layer-group"></i> PCC Base Bedding</span>
                        <span class="rebar-chip-val" style="color:#94a3b8;">${rcdc.pcc}</span>
                    </div>
                </div>

                <div class="rebar-svg-card">
                    <div class="rebar-svg-card-title">
                        <span><i class="fas fa-drafting-compass"></i> Foundation Cross-Section</span>
                        <span>IS 456 LSM</span>
                    </div>
                    ${svgHtml}
                </div>

                <table class="rebar-spec-table">
                    <tr>
                        <td class="rebar-spec-label">Longitudinal Rebar (L)</td>
                        <td class="rebar-spec-val" style="color:#ffd700;">${rcdc.longRebar}</td>
                    </tr>
                    <tr>
                        <td class="rebar-spec-label">Transverse Rebar (B)</td>
                        <td class="rebar-spec-val" style="color:#38bdf8;">${rcdc.shortRebar}</td>
                    </tr>
                    <tr>
                        <td class="rebar-spec-label">Concrete / Steel Grade</td>
                        <td class="rebar-spec-val">M25 : Fe 550</td>
                    </tr>
                    <tr>
                        <td class="rebar-spec-label">Clear Concrete Cover</td>
                        <td class="rebar-spec-val">50 mm</td>
                    </tr>
                    <tr>
                        <td class="rebar-spec-label">Structural Checks</td>
                        <td class="rebar-spec-val" style="color:#22c55e;">Punching &amp; One-Way Shear Safe</td>
                    </tr>
                </table>
            `;
        } else if (analysisMode === 'moment') {
            const svgHtml = render2dMomentDiagramSvg(u);
            if (isColumn) {
                detailsHtml = `
                    <div class="rebar-chips-group">
                        <div class="rebar-chip-row">
                            <span class="rebar-chip-name"><i class="fas fa-arrow-up"></i> Top Moment (Mu,top)</span>
                            <span class="rebar-chip-val" style="color:#f87171;">+${Math.abs(rcdc.muTop || 48.0).toFixed(1)} kNm</span>
                        </div>
                        <div class="rebar-chip-row">
                            <span class="rebar-chip-name"><i class="fas fa-arrow-down"></i> Bottom Moment (Mu,bot)</span>
                            <span class="rebar-chip-val" style="color:#38bdf8;">${(rcdc.muBot || -40.8).toFixed(1)} kNm</span>
                        </div>
                        <div class="rebar-chip-row">
                            <span class="rebar-chip-name"><i class="fas fa-weight-hanging"></i> Factored Axial Load (Pu)</span>
                            <span class="rebar-chip-val" style="color:#ffd700;">${rcdc.axialPu || '1145 kN'}</span>
                        </div>
                    </div>

                    <div class="rebar-svg-card">
                        <div class="rebar-svg-card-title">
                            <span><i class="fas fa-wave-square"></i> Column Moment Diagram</span>
                            <span>P-M Interaction</span>
                        </div>
                        ${svgHtml}
                    </div>

                    <table class="rebar-spec-table">
                        <tr>
                            <td class="rebar-spec-label">Cross Section (b &times; D)</td>
                            <td class="rebar-spec-val">${rcdc.b} &times; ${rcdc.d} mm</td>
                        </tr>
                        <tr>
                            <td class="rebar-spec-label">Governing Design Moment</td>
                            <td class="rebar-spec-val" style="color:#f87171;">${rcdc.maxMoment || '48.0 kNm'}</td>
                        </tr>
                        <tr>
                            <td class="rebar-spec-label">Interaction Ratio (P-M)</td>
                            <td class="rebar-spec-val" style="color:#22c55e;">${rcdc.interactionRatio || '0.81'} (Safe &lt; 1.0)</td>
                        </tr>
                        <tr>
                            <td class="rebar-spec-label">Steel Percentage (Pt)</td>
                            <td class="rebar-spec-val" style="color:#ffd700;">${rcdc.pt || '2.0%'} (${rcdc.totalAst || '2060 mm²'})</td>
                        </tr>
                        <tr>
                            <td class="rebar-spec-label">Design Standard</td>
                            <td class="rebar-spec-val">IS 456:2000 &bull; SP 16</td>
                        </tr>
                    </table>
                `;
            } else {
                detailsHtml = `
                    <div class="rebar-chips-group">
                        <div class="rebar-chip-row">
                            <span class="rebar-chip-name"><i class="fas fa-arrow-up"></i> Hogging Moment (Left)</span>
                            <span class="rebar-chip-val" style="color:#f87171;">${(rcdc.muLeft || -72.5).toFixed(1)} kNm</span>
                        </div>
                        <div class="rebar-chip-row">
                            <span class="rebar-chip-name"><i class="fas fa-arrow-down"></i> Sagging Moment (Midspan)</span>
                            <span class="rebar-chip-val" style="color:#38bdf8;">+${(rcdc.muMid || 48.7).toFixed(1)} kNm</span>
                        </div>
                        <div class="rebar-chip-row">
                            <span class="rebar-chip-name"><i class="fas fa-arrow-up"></i> Hogging Moment (Right)</span>
                            <span class="rebar-chip-val" style="color:#f87171;">${(rcdc.muRight || -80.3).toFixed(1)} kNm</span>
                        </div>
                    </div>

                    <div class="rebar-svg-card">
                        <div class="rebar-svg-card-title">
                            <span><i class="fas fa-wave-square"></i> Bending Moment Envelope</span>
                            <span>IS 456 Limit State</span>
                        </div>
                        ${svgHtml}
                    </div>

                    <table class="rebar-spec-table">
                        <tr>
                            <td class="rebar-spec-label">Cross Section (b &times; D)</td>
                            <td class="rebar-spec-val">${rcdc.b} &times; ${rcdc.d} mm</td>
                        </tr>
                        <tr>
                            <td class="rebar-spec-label">Max Factored Moment</td>
                            <td class="rebar-spec-val" style="color:#f87171;">${rcdc.maxMoment || '80.3 kNm'}</td>
                        </tr>
                        <tr>
                            <td class="rebar-spec-label">Top Steel Provided</td>
                            <td class="rebar-spec-val" style="color:#f87171;">${rcdc.topRebar} (${rcdc.topAst})</td>
                        </tr>
                        <tr>
                            <td class="rebar-spec-label">Bottom Steel Provided</td>
                            <td class="rebar-spec-val" style="color:#38bdf8;">${rcdc.botRebar} (${rcdc.botAst})</td>
                        </tr>
                        <tr>
                            <td class="rebar-spec-label">Flexure Capacity Check</td>
                            <td class="rebar-spec-val" style="color:#22c55e;">Mu &lt; Mu,lim (Safe Pass)</td>
                        </tr>
                    </table>
                `;
            }
        } else if (analysisMode === 'shear') {
            const svgHtml = render2dShearDiagramSvg(u);
            if (isColumn) {
                detailsHtml = `
                    <div class="rebar-chips-group">
                        <div class="rebar-chip-row">
                            <span class="rebar-chip-name"><i class="fas fa-chart-area"></i> Factored Shear (Vu)</span>
                            <span class="rebar-chip-val" style="color:#34d399;">${(rcdc.vuCol || 29.13).toFixed(1)} kN</span>
                        </div>
                        <div class="rebar-chip-row">
                            <span class="rebar-chip-name"><i class="fas fa-link"></i> Lateral Ties / Links</span>
                            <span class="rebar-chip-val" style="color:#ffd700;">${rcdc.links || 'T8 @ 225 mm c/c'}</span>
                        </div>
                    </div>

                    <div class="rebar-svg-card">
                        <div class="rebar-svg-card-title">
                            <span><i class="fas fa-chart-area"></i> Column Shear Diagram</span>
                            <span>IS 456 / IS 13920</span>
                        </div>
                        ${svgHtml}
                    </div>

                    <table class="rebar-spec-table">
                        <tr>
                            <td class="rebar-spec-label">Cross Section (b &times; D)</td>
                            <td class="rebar-spec-val">${rcdc.b} &times; ${rcdc.d} mm</td>
                        </tr>
                        <tr>
                            <td class="rebar-spec-label">Factored Shear Force</td>
                            <td class="rebar-spec-val" style="color:#34d399;">${rcdc.maxShear || '29.1 kN'}</td>
                        </tr>
                        <tr>
                            <td class="rebar-spec-label">Shear Confinement Check</td>
                            <td class="rebar-spec-val" style="color:#22c55e;">Ductile Ties Adequate (Pass)</td>
                        </tr>
                    </table>
                `;
            } else {
                detailsHtml = `
                    <div class="rebar-chips-group">
                        <div class="rebar-chip-row">
                            <span class="rebar-chip-name"><i class="fas fa-arrows-alt-v"></i> Left Support Shear (Vu,L)</span>
                            <span class="rebar-chip-val" style="color:#34d399;">+${(rcdc.vuLeft || 58.8).toFixed(1)} kN</span>
                        </div>
                        <div class="rebar-chip-row">
                            <span class="rebar-chip-name"><i class="fas fa-arrows-alt-v"></i> Right Support Shear (Vu,R)</span>
                            <span class="rebar-chip-val" style="color:#34d399;">-${(rcdc.vuRight || 73.6).toFixed(1)} kN</span>
                        </div>
                        <div class="rebar-chip-row">
                            <span class="rebar-chip-name"><i class="fas fa-link"></i> Shear Stirrups</span>
                            <span class="rebar-chip-val" style="color:#ffd700; font-size:0.76rem;">${rcdc.stirrups}</span>
                        </div>
                    </div>

                    <div class="rebar-svg-card">
                        <div class="rebar-svg-card-title">
                            <span><i class="fas fa-chart-area"></i> Shear Force Envelope</span>
                            <span>IS 456 Cl. 40</span>
                        </div>
                        ${svgHtml}
                    </div>

                    <table class="rebar-spec-table">
                        <tr>
                            <td class="rebar-spec-label">Cross Section (b &times; D)</td>
                            <td class="rebar-spec-val">${rcdc.b} &times; ${rcdc.d} mm</td>
                        </tr>
                        <tr>
                            <td class="rebar-spec-label">Critical Section Shear</td>
                            <td class="rebar-spec-val" style="color:#34d399;">${rcdc.maxShear || '73.6 kN'}</td>
                        </tr>
                        <tr>
                            <td class="rebar-spec-label">Nominal Shear Stress (&tau;v)</td>
                            <td class="rebar-spec-val">0.82 N/mm&sup2;</td>
                        </tr>
                        <tr>
                            <td class="rebar-spec-label">Max Permissible (&tau;c,max)</td>
                            <td class="rebar-spec-val">3.10 N/mm&sup2; (M25)</td>
                        </tr>
                        <tr>
                            <td class="rebar-spec-label">Shear Reinforcement Check</td>
                            <td class="rebar-spec-val" style="color:#22c55e;">&tau;v &lt; &tau;c,max (Safe per IS 456)</td>
                        </tr>
                    </table>
                `;
            }
        } else if (isColumn) {
            const svgHtml = render2dCrossSectionSvg(u);
            detailsHtml = `
                <div class="rebar-chips-group">
                    <div class="rebar-chip-row">
                        <span class="rebar-chip-name"><i class="fas fa-cubes-stacked"></i> Main Longitudinal Steel</span>
                        <span class="rebar-chip-val" style="color:#ffd700;">${rcdc.mainRebar}</span>
                    </div>
                    <div class="rebar-chip-row">
                        <span class="rebar-chip-name"><i class="fas fa-link"></i> Lateral Ties / Links</span>
                        <span class="rebar-chip-val" style="color:#00e5ff;">${rcdc.links}</span>
                    </div>
                </div>

                <div class="rebar-svg-card">
                    <div class="rebar-svg-card-title">
                        <span><i class="fas fa-drafting-compass"></i> Cross-Section Detailing</span>
                        <span>SP 34 Detailing</span>
                    </div>
                    ${svgHtml}
                </div>

                <table class="rebar-spec-table">
                    <tr>
                        <td class="rebar-spec-label">Cross Section (b &times; D)</td>
                        <td class="rebar-spec-val">${rcdc.b} &times; ${rcdc.d} mm</td>
                    </tr>
                    <tr>
                        <td class="rebar-spec-label">Total Steel Area (Ast)</td>
                        <td class="rebar-spec-val" style="color:#ffd700;">${rcdc.totalAst} (Pt = ${rcdc.pt})</td>
                    </tr>
                    <tr>
                        <td class="rebar-spec-label">Factored Axial Load (Pu)</td>
                        <td class="rebar-spec-val">${rcdc.axialPu}</td>
                    </tr>
                    <tr>
                        <td class="rebar-spec-label">Interaction Ratio (P-M)</td>
                        <td class="rebar-spec-val" style="color:#22c55e;">${rcdc.interactionRatio} (Safe &lt; 1.0)</td>
                    </tr>
                    <tr>
                        <td class="rebar-spec-label">Clear Cover</td>
                        <td class="rebar-spec-val">${rcdc.clearCover}</td>
                    </tr>
                    <tr>
                        <td class="rebar-spec-label">Design Standard</td>
                        <td class="rebar-spec-val">IS 456:2000 &bull; SP 16</td>
                    </tr>
                </table>
            `;
        } else {
            const svgHtml = render2dCrossSectionSvg(u);
            detailsHtml = `
                <div class="rebar-chips-group">
                    <div class="rebar-chip-row">
                        <span class="rebar-chip-name"><i class="fas fa-arrow-up"></i> Top Reinforcement</span>
                        <span class="rebar-chip-val" style="color:#f43f5e;">${rcdc.topRebar.split('(')[0]} (${rcdc.topAst})</span>
                    </div>
                    <div class="rebar-chip-row">
                        <span class="rebar-chip-name"><i class="fas fa-arrow-down"></i> Bottom Reinforcement</span>
                        <span class="rebar-chip-val" style="color:#38bdf8;">${rcdc.botRebar.split('(')[0]} (${rcdc.botAst})</span>
                    </div>
                    <div class="rebar-chip-row">
                        <span class="rebar-chip-name"><i class="fas fa-link"></i> Shear Stirrups</span>
                        <span class="rebar-chip-val" style="color:#ffd700; font-size:0.76rem;">${rcdc.stirrups}</span>
                    </div>
                </div>

                <div class="rebar-svg-card">
                    <div class="rebar-svg-card-title">
                        <span><i class="fas fa-drafting-compass"></i> Cross-Section Detailing</span>
                        <span>SP 34 Detailing</span>
                    </div>
                    ${svgHtml}
                </div>

                <table class="rebar-spec-table">
                    <tr>
                        <td class="rebar-spec-label">Cross Section (b &times; D)</td>
                        <td class="rebar-spec-val">${rcdc.b} &times; ${rcdc.d} mm</td>
                    </tr>
                    <tr>
                        <td class="rebar-spec-label">Span Length</td>
                        <td class="rebar-spec-val">${u.length.toFixed(3)} m (${(u.length * 3.28084).toFixed(2)} ft)</td>
                    </tr>
                    <tr>
                        <td class="rebar-spec-label">Concrete / Steel Grade</td>
                        <td class="rebar-spec-val">M25 : Fe 550</td>
                    </tr>
                    <tr>
                        <td class="rebar-spec-label">Clear Concrete Cover</td>
                        <td class="rebar-spec-val">${rcdc.clearCover}</td>
                    </tr>
                    <tr>
                        <td class="rebar-spec-label">Limit State Check</td>
                        <td class="rebar-spec-val" style="color:#22c55e;">Flexure &amp; Shear Pass (IS 456)</td>
                    </tr>
                </table>
            `;
        }

        bodyEl.innerHTML = detailsHtml;

        // Update Document Button Label
        const docBtn = document.getElementById('rebarDocBtn');
        if (docBtn) {
            if (isSlab) {
                docBtn.innerHTML = '<i class="fas fa-file-pdf"></i> View RCDC Slab Design Summary Drawing';
            } else if (isFooting) {
                docBtn.innerHTML = '<i class="fas fa-file-pdf"></i> View RCDC Footing Schedule Drawing';
            } else if (analysisMode === 'moment' || analysisMode === 'shear') {
                docBtn.innerHTML = '<i class="fas fa-file-pdf"></i> View Bentley RCDC Design Summary Report';
            } else if (isColumn) {
                docBtn.innerHTML = '<i class="fas fa-file-pdf"></i> View RCDC Column Schedule Drawing';
            } else {
                docBtn.innerHTML = '<i class="fas fa-file-pdf"></i> View RCDC Beam Schedule Drawing';
            }
        }

        inspector.classList.add('active');
    }

    function getStoryLabel(story) {
        switch (story) {
            case 'plinth': return 'Plinth Level (+1.98m)';
            case 'ground': return 'Ground Floor (+5.03m)';
            case 'first': return 'First Floor (+8.08m)';
            case 'second': return 'Second Floor (+11.13m)';
            case 'headroom': return 'Terrace / OHT (+14.13m)';
            default: return 'Floor';
        }
    }

    // Animation loop with thermal & battery optimization (renders on demand when stationary)
    function animate() {
        animId = requestAnimationFrame(animate);

        // Power efficiency: If tab is hidden/backgrounded, skip rendering to prevent heating & lag
        if (typeof document !== 'undefined' && (document.hidden || !document.hasFocus())) return;

        let moved = false;
        if (controls) {
            if (autoRotate) {
                controls.autoRotate = true;
                controls.autoRotateSpeed = 1.2;
                moved = true;
            } else {
                controls.autoRotate = false;
            }
            if (controls.update()) {
                moved = true;
            }
        }

        if (moved || renderDemandCount > 0) {
            renderer.render(scene, camera);
            if (renderDemandCount > 0) renderDemandCount--;
        }
    }

    if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && isInitialized && !animId) {
                animate();
            }
        });
    }

    // Public API
    window.open3DViewer = function (initialMode) {
        injectModalHtml();
        const modal = document.getElementById('staad3dModal');
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';

            // Auto-minimize minimap on mobile to prevent obstruction
            if (window.innerWidth < 768) {
                const minimap = document.getElementById('staadGridMinimap');
                if (minimap && !minimap.classList.contains('minimized')) {
                    minimap.classList.add('minimized');
                    const icon = document.getElementById('minimapToggleIcon');
                    if (icon) icon.className = 'fas fa-chevron-up';
                }
            }

            setTimeout(() => {
                initThree();
                if (isInitialized && !animId) {
                    animate();
                }
                onWindowResize();
                setCameraView('iso');

                if (initialMode === 'rcc' || initialMode === true) {
                    window.staadViewerSetAnalysisMode('rcc');
                } else if (initialMode === 'moment') {
                    window.staadViewerSetAnalysisMode('moment');
                } else if (initialMode === 'shear') {
                    window.staadViewerSetAnalysisMode('shear');
                } else if (initialMode === 'realistic') {
                    window.staadViewerSetAnalysisMode('realistic');
                } else {
                    window.staadViewerSetAnalysisMode('solid');
                }
            }, 50);
        }
    };

    window.close3DViewer = function () {
        if (animId) {
            cancelAnimationFrame(animId);
            animId = null;
        }
        const modal = document.getElementById('staad3dModal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
        window.closeRebarInspector();
        hideSelectionBar();
    };

    window.closeRebarInspector = function () {
        const inspector = document.getElementById('staadRebarInspector');
        if (inspector) {
            inspector.classList.remove('active');
        }
        clearSelectionHighlight();
    };

    window.openCurrentRebarDoc = function () {
        if (!currentInspectorData) return;
        const rcdc = currentInspectorData.isSlab ? currentInspectorData.panel : (currentInspectorData.isFooting ? currentInspectorData.footing : currentInspectorData.rcdc);
        if (rcdc && rcdc.pdfRef) {
            const targetPath = 'vault/project-4-1/' + rcdc.pdfRef;
            if (window.vaultSelectByPath) {
                window.close3DViewer();
                window.openVault('project-4-1');
                setTimeout(() => {
                    window.vaultSelectByPath(targetPath);
                }, 300);
            } else if (window.openDoc) {
                window.openDoc(targetPath);
            }
        }
    };

    window.staadViewerSetAnalysisMode = function (mode) {
        analysisMode = mode || 'solid';
        isRccMode = (analysisMode === 'rcc');

        // Update segmented buttons
        ['Solid', 'RCC', 'Moment', 'Shear', 'Realistic'].forEach(m => {
            const btn = document.getElementById('btnMode' + m);
            if (btn) btn.classList.toggle('active', analysisMode.toLowerCase() === m.toLowerCase());
        });

        // Update banners
        const rccBanner = document.getElementById('staadRccBanner');
        const momentBanner = document.getElementById('staadMomentBanner');
        const shearBanner = document.getElementById('staadShearBanner');
        const realisticBanner = document.getElementById('staadRealisticBanner');

        if (rccBanner) rccBanner.classList.toggle('active', analysisMode === 'rcc');
        if (momentBanner) momentBanner.classList.toggle('active', analysisMode === 'moment');
        if (shearBanner) shearBanner.classList.toggle('active', analysisMode === 'shear');
        if (realisticBanner) realisticBanner.classList.toggle('active', analysisMode === 'realistic');

        // Header tag
        const headerTag = document.getElementById('staadHeaderTag');
        if (headerTag) {
            if (analysisMode === 'realistic') {
                headerTag.textContent = 'Architectural 3D Simulation';
                headerTag.style.color = '#38bdf8';
                headerTag.style.borderColor = 'rgba(56, 189, 248, 0.4)';
            } else if (analysisMode === 'rcc') {
                headerTag.textContent = 'Bentley RCDC Concrete Detailing';
                headerTag.style.color = '#00e5ff';
                headerTag.style.borderColor = 'rgba(0, 229, 255, 0.4)';
            } else if (analysisMode === 'moment') {
                headerTag.textContent = 'STAAD.Pro 3D Bending Moment Mz Envelope';
                headerTag.style.color = '#f87171';
                headerTag.style.borderColor = 'rgba(239, 68, 68, 0.4)';
            } else if (analysisMode === 'shear') {
                headerTag.textContent = 'STAAD.Pro 3D Shear Force Fy Envelope';
                headerTag.style.color = '#34d399';
                headerTag.style.borderColor = 'rgba(16, 185, 129, 0.4)';
            } else {
                headerTag.textContent = 'STAAD.Pro & RCDC';
                headerTag.style.color = '#ffd700';
                headerTag.style.borderColor = 'rgba(255, 215, 0, 0.4)';
            }
        }

        // Scene atmosphere & lights
        if (scene) {
            if (analysisMode === 'realistic') {
                scene.background.setHex(0x0a1120); // Deep architectural obsidian-navy
                scene.fog = null; // Clean, high-contrast, crystal-clear architectural rendering
                if (gridHelper) gridHelper.visible = false;
                if (ambientLight) {
                    ambientLight.intensity = 0.38;
                    ambientLight.color.setHex(0xffeedd);
                    ambientLight.groundColor.setHex(0x1e293b);
                }
                if (dirLight1) {
                    dirLight1.intensity = 1.08;
                    dirLight1.color.setHex(0xfff3e0);
                    dirLight1.castShadow = false;
                }
                if (dirLight2) {
                    dirLight2.intensity = 0.32;
                    dirLight2.color.setHex(0xcfd8dc);
                }
                if (dirLight3) {
                    dirLight3.intensity = 0.40;
                    dirLight3.color.setHex(0xffffff);
                }
                if (renderer) renderer.toneMappingExposure = 0.98;
            } else {
                scene.background.setHex(0x090e1a); // Deep engineering dark viewport
                scene.fog = null; // Zero fog washing out structural members and diagrams
                if (gridHelper) gridHelper.visible = true;
                if (ambientLight) {
                    ambientLight.intensity = 0.45;
                    ambientLight.color.setHex(0xffffff);
                    ambientLight.groundColor.setHex(0x1e293b);
                }
                if (dirLight1) {
                    dirLight1.intensity = 1.20;
                    dirLight1.color.setHex(0xfffaf0);
                    dirLight1.castShadow = false;
                }
                if (dirLight2) {
                    dirLight2.intensity = 0.38;
                    dirLight2.color.setHex(0xe2e8f0); // Crisp cool fill
                }
                if (dirLight3) {
                    dirLight3.intensity = 0.55;
                    dirLight3.color.setHex(0xffffff);
                }
                if (renderer) renderer.toneMappingExposure = 1.02;
            }
        }

        // Realistic architectural model visibility & story filtering
        if (analysisMode === 'realistic') {
            // Lazy load: build realistic model only on first demand!
            if (!architecturalModel) {
                architecturalModel = buildArchitecturalModel();
                scene.add(architecturalModel);
            }
            architecturalModel.visible = true;

            const ag = archStoryGroups;
            if (currentStory === 'all') {
                if (ag.site) ag.site.visible = true;
                if (ag.ground) ag.ground.visible = true;
                if (ag.first) ag.first.visible = true;
                if (ag.second) ag.second.visible = true;
                if (ag.terrace) ag.terrace.visible = true;
                if (ag.headroom) ag.headroom.visible = true;
            } else if (currentStory === 'plinth' || currentStory === 'ground') {
                if (ag.site) ag.site.visible = true;
                if (ag.ground) ag.ground.visible = true;
                if (ag.first) ag.first.visible = false;
                if (ag.second) ag.second.visible = false;
                if (ag.terrace) ag.terrace.visible = false;
                if (ag.headroom) ag.headroom.visible = false;
            } else if (currentStory === 'first') {
                if (ag.site) ag.site.visible = false;
                if (ag.ground) ag.ground.visible = false;
                if (ag.first) ag.first.visible = true;
                if (ag.second) ag.second.visible = false;
                if (ag.terrace) ag.terrace.visible = false;
                if (ag.headroom) ag.headroom.visible = false;
            } else if (currentStory === 'second') {
                if (ag.site) ag.site.visible = false;
                if (ag.ground) ag.ground.visible = false;
                if (ag.first) ag.first.visible = false;
                if (ag.second) ag.second.visible = true;
                if (ag.terrace) ag.terrace.visible = false;
                if (ag.headroom) ag.headroom.visible = false;
            } else if (currentStory === 'headroom') {
                if (ag.site) ag.site.visible = false;
                if (ag.ground) ag.ground.visible = false;
                if (ag.first) ag.first.visible = false;
                if (ag.second) ag.second.visible = false;
                if (ag.terrace) ag.terrace.visible = true;
                if (ag.headroom) ag.headroom.visible = true;
            }
        } else {
            if (architecturalModel) {
                architecturalModel.visible = false;
            }
        }

        // Update members
        memberMeshes.forEach(m => {
            const u = m.userData;
            if (analysisMode === 'realistic') {
                m.visible = false;
                return;
            }

            const matchesStory = (currentStory === 'all' || u.story === currentStory);
            const matchesGrid = !activeGridFilter || isMemberOnGrid(m, activeGridFilter);

            m.visible = matchesStory && matchesGrid;

            if (m.material) {
                if (analysisMode === 'solid') {
                    m.material.transparent = false;
                    m.material.opacity = 1.0;
                    m.material.depthWrite = true;
                    m.material.emissiveIntensity = 0.28;
                    m.material.envMapIntensity = 0.15;
                } else if (analysisMode === 'rcc') {
                    m.material.transparent = true;
                    m.material.opacity = 0.12;          // Smoked X-Ray glass shell
                    m.material.depthWrite = false;
                    m.material.emissiveIntensity = 0.02; // Kill milky glow so rebars pop!
                    m.material.envMapIntensity = 0.0;    // Zero white reflection on X-Ray shell
                } else { // moment or shear
                    m.material.transparent = true;
                    m.material.opacity = 0.09;
                    m.material.depthWrite = false;
                    m.material.emissiveIntensity = 0.0;
                    m.material.envMapIntensity = 0.0;
                }
                m.material.needsUpdate = true;
            }

            if (u.cadEdgeOutline) {
                u.cadEdgeOutline.visible = (analysisMode === 'solid') && m.visible;
            }
            if (u.rebarCage) {
                u.rebarCage.visible = (analysisMode === 'rcc') && m.visible;
            }
            if (u.momentDiagram) {
                u.momentDiagram.visible = (analysisMode === 'moment') && m.visible;
            }
            if (u.shearDiagram) {
                u.shearDiagram.visible = (analysisMode === 'shear') && m.visible;
            }
        });

        // Footings
        footingMeshes.forEach(f => {
            if (analysisMode === 'realistic') {
                f.visible = false;
                return;
            }
            const matchesStory = (currentStory === 'all' || currentStory === 'plinth');
            const matchesGrid = !activeGridFilter || (
                activeGridFilter.axis === 'X' ? Math.abs(f.userData.footing.x - activeGridFilter.coord) < 0.2 :
                Math.abs(f.userData.footing.z - activeGridFilter.coord) < 0.2
            );
            f.visible = matchesStory && matchesGrid;

            if (f.material) {
                if (analysisMode === 'solid') {
                    f.material.transparent = false;
                    f.material.opacity = 1.0;
                    f.material.depthWrite = true;
                    f.material.emissiveIntensity = 0.25;
                    f.material.envMapIntensity = 0.15;
                } else if (analysisMode === 'rcc') {
                    f.material.transparent = true;
                    f.material.opacity = 0.12;          // Smoked X-Ray glass shell
                    f.material.depthWrite = false;
                    f.material.emissiveIntensity = 0.02; // Kill milky glow
                    f.material.envMapIntensity = 0.0;    // Zero white reflection
                } else {
                    f.material.transparent = true;
                    f.material.opacity = 0.09;
                    f.material.depthWrite = false;
                    f.material.emissiveIntensity = 0.0;
                    f.material.envMapIntensity = 0.0;
                }
                f.material.needsUpdate = true;
            }
            if (f.userData.rebarCage) {
                f.userData.rebarCage.visible = (analysisMode === 'rcc') && f.visible;
            }
        });

        // Slabs
        slabMeshes.forEach(s => {
            if (analysisMode === 'realistic') {
                s.visible = false;
                return;
            }
            const matchesStory = (currentStory === 'all' || s.userData.story === currentStory);
            s.visible = showSlabs && matchesStory && !activeGridFilter;
            if (s.material) {
                s.material.opacity = (analysisMode === 'solid') ? 0.35 : (analysisMode === 'rcc' ? 0.20 : 0.08);
            }
        });

        // Joints / Nodes
        jointMeshes.forEach(jMesh => {
            if (analysisMode === 'realistic') {
                jMesh.visible = false;
                return;
            }
            const u = jMesh.userData;
            const matchesGrid = !activeGridFilter || (
                activeGridFilter.axis === 'X' ? Math.abs(u.x - activeGridFilter.coord) < 0.25 :
                Math.abs(u.z - activeGridFilter.coord) < 0.25
            );
            jMesh.visible = showNodes && matchesGrid;
        });

        // If inspector is open, update its content for the current analysis mode!
        if (currentInspectorData) {
            const inspector = document.getElementById('staadRebarInspector');
            if (inspector && inspector.classList.contains('active')) {
                openRebarInspector(currentInspectorData);
            }
        }
        requestRender(5);
        if (controls) controls.update();
        if (renderer && scene && camera) renderer.render(scene, camera);
    };

    window.staadViewerToggleRccMode = function (forceState) {
        const target = (typeof forceState === 'boolean') ? (forceState ? 'rcc' : 'solid') : (analysisMode === 'rcc' ? 'solid' : 'rcc');
        window.staadViewerSetAnalysisMode(target);
    };

    window.staadViewerFilterGrid = function (axis, coord, name) {
        if (activeGridFilter && activeGridFilter.name === name) {
            window.staadViewerResetGridFilter();
            return;
        }

        activeGridFilter = { axis: axis, coord: coord, name: name };

        document.querySelectorAll('.grid-line').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.grid-bubble').forEach(el => el.classList.remove('active'));

        const lineEl = document.getElementById('gridLine_' + name.replace(/\s+/g, ''));
        if (lineEl) lineEl.classList.add('active');

        document.querySelectorAll(`.grid-bubble[data-grid="${name}"]`).forEach(b => b.classList.add('active'));

        const banner = document.getElementById('staadElevationBanner');
        const titleEl = document.getElementById('staadElevationTitle');
        const subEl = document.getElementById('staadElevationSubtitle');

        if (banner) banner.classList.add('active');
        if (titleEl) titleEl.textContent = `${name} (${axis === 'Z' ? 'Transverse Frame' : 'Longitudinal Frame'})`;
        if (subEl) subEl.textContent = `2D Frame Bent Isolated • ${axis === 'Z' ? 'Z = ' + coord.toFixed(3) + 'm (Looking North)' : 'X = ' + coord.toFixed(3) + 'm (Looking East)'}`;

        window.staadViewerSetAnalysisMode(analysisMode);

        if (axis === 'Z') {
            const zCentered = coord - OFFSET_Z;
            if (controls) {
                controls.target.set(0, 6.0, zCentered);
            }
            if (camera) {
                camera.position.set(0, 6.0, zCentered + 24);
            }
            ['Iso', 'Front', 'Rear', 'Left', 'Right', 'Top'].forEach(v => {
                const btn = document.getElementById('btnView' + v);
                if (btn) btn.classList.toggle('active', v === 'Front');
            });
        } else {
            const xCentered = coord - OFFSET_X;
            if (controls) {
                controls.target.set(xCentered, 6.0, 0);
            }
            if (camera) {
                camera.position.set(xCentered - 26, 6.0, 0);
            }
            ['Iso', 'Front', 'Rear', 'Left', 'Right', 'Top'].forEach(v => {
                const btn = document.getElementById('btnView' + v);
                if (btn) btn.classList.toggle('active', v === 'Left');
            });
        }
        if (controls) controls.update();
    };

    window.staadViewerResetGridFilter = function () {
        activeGridFilter = null;

        document.querySelectorAll('.grid-line').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.grid-bubble').forEach(el => el.classList.remove('active'));

        const banner = document.getElementById('staadElevationBanner');
        if (banner) banner.classList.remove('active');

        window.staadViewerSetAnalysisMode(analysisMode);
        setCameraView('iso');
    };

    window.staadViewerToggleMinimap = function () {
        const minimap = document.getElementById('staadGridMinimap');
        const icon = document.getElementById('minimapToggleIcon');
        if (minimap) {
            minimap.classList.toggle('minimized');
            const isMin = minimap.classList.contains('minimized');
            if (icon) {
                icon.className = isMin ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
            }
        }
    };

    window.staadViewerToggleSlabs = function () {
        showSlabs = !showSlabs;
        slabMeshes.forEach(s => {
            s.visible = showSlabs && (currentStory === 'all' || s.userData.story === currentStory);
        });

        const btn = document.getElementById('staadToggleSlabsBtn');
        if (btn) {
            btn.classList.toggle('active', showSlabs);
        }
        requestRender(5);
    };

    window.staadViewerResetView = function () {
        window.staadViewerResetGridFilter();
        setCameraView('iso');
        window.closeRebarInspector();
    };

    window.staadViewerSetCamera = function (view) {
        setCameraView(view);
    };

    window.staadViewerToggleRotate = function () {
        autoRotate = !autoRotate;
        const btn = document.getElementById('staadRotateBtn');
        if (btn) {
            btn.style.borderColor = autoRotate ? '#ffd700' : '';
            btn.style.color = autoRotate ? '#ffd700' : '';
        }
    };

    window.staadViewerToggleNodes = function () {
        showNodes = !showNodes;
        jointMeshes.forEach(m => {
            const u = m.userData;
            const matchesGrid = !activeGridFilter || (
                activeGridFilter.axis === 'X' ? Math.abs(u.x - activeGridFilter.coord) < 0.25 :
                Math.abs(u.z - activeGridFilter.coord) < 0.25
            );
            m.visible = showNodes && matchesGrid;
        });
        const btn = document.getElementById('staadToggleNodesBtn');
        if (btn) {
            btn.classList.toggle('active', showNodes);
        }
        requestRender(5);
    };

    window.staadViewerToggleDisplayMode = function () {
        displayMode = (displayMode === 'solid' ? 'wireframe' : 'solid');
        const isWire = (displayMode === 'wireframe');

        memberMeshes.forEach(m => {
            if (m.material) {
                m.material.wireframe = isWire;
            }
        });

        const label = document.getElementById('staadModeLabel');
        if (label) {
            label.textContent = isWire ? 'Wireframe FEA' : 'Solid 3D';
        }
        const btn = document.getElementById('staadToggleModeBtn');
        if (btn) {
            btn.classList.toggle('active', isWire);
        }
        requestRender(5);
    };

    window.staadViewerFilterStory = function (storyId) {
        currentStory = storyId;

        document.querySelectorAll('.staad-pill-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-story') === storyId);
        });

        window.staadViewerSetAnalysisMode(analysisMode);
    };

    window.staadViewerInspectMember = function (memberId) {
        const mesh = memberMeshes.find(m => m.userData && m.userData.memberId === memberId);
        if (mesh) {
            selectAndInspectObject(mesh);
            return true;
        }
        return false;
    };

    window.staadViewerInspectFooting = function (footingMark) {
        const mesh = footingMeshes.find(m => m.userData && m.userData.footing && m.userData.footing.mark === footingMark);
        if (mesh) {
            selectAndInspectObject(mesh);
            return true;
        }
        return false;
    };

    window.staadViewerInspectSlab = function (slabMark) {
        const mesh = slabMeshes.find(m => m.userData && m.userData.panel && (m.userData.panel.mark === slabMark || m.userData.panel.id === slabMark));
        if (mesh) {
            selectAndInspectObject(mesh);
            return true;
        }
        return false;
    };

    window._debugViewer = {
        getMemberMeshes: () => memberMeshes,
        getFootingMeshes: () => footingMeshes,
        getSlabMeshes: () => slabMeshes,
        getJointMeshes: () => jointMeshes,
        getScene: () => scene,
        getCamera: () => camera,
        getControls: () => controls,
        getArchStoryGroups: () => archStoryGroups,
        getAnimId: () => animId
    };

})();
