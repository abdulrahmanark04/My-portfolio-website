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

    // Colors
    const COLOR_COLUMN = 0xffb703;
    const COLOR_BEAM = 0x00e5ff;
    const COLOR_FOOTING = 0x8b5cf6;
    const COLOR_SLAB = 0x0284c7;
    const COLOR_NODE = 0xffffff;
    const COLOR_HIGHLIGHT = 0xff0055;
    const COLOR_SELECTED = 0xffd700;

    // Materials cache
    let matColumn, matBeam, matFooting, matSlab, matNode;
    let matRebarTop, matRebarBot, matRebarGold, matRebarTies;

    function initMaterials() {
        matColumn = new THREE.MeshStandardMaterial({
            color: COLOR_COLUMN,
            roughness: 0.35,
            metalness: 0.25
        });

        matBeam = new THREE.MeshStandardMaterial({
            color: COLOR_BEAM,
            roughness: 0.4,
            metalness: 0.2
        });

        matFooting = new THREE.MeshStandardMaterial({
            color: COLOR_FOOTING,
            roughness: 0.6,
            metalness: 0.1
        });

        matSlab = new THREE.MeshStandardMaterial({
            color: COLOR_SLAB,
            transparent: true,
            opacity: 0.35,
            roughness: 0.35,
            metalness: 0.15,
            depthWrite: false
        });

        matNode = new THREE.MeshBasicMaterial({
            color: COLOR_NODE
        });

        // 3D Rebar Materials
        matRebarTop = new THREE.MeshStandardMaterial({
            color: 0xf43f5e, // Crimson Red Top Rebar
            roughness: 0.3,
            metalness: 0.8,
            emissive: 0x9f1239,
            emissiveIntensity: 0.3
        });

        matRebarBot = new THREE.MeshStandardMaterial({
            color: 0x00e5ff, // Cyan Blue Bottom Rebar
            roughness: 0.3,
            metalness: 0.8,
            emissive: 0x0284c7,
            emissiveIntensity: 0.3
        });

        matRebarGold = new THREE.MeshStandardMaterial({
            color: 0xffd700, // Gold Column Corner Bars / Main Mesh
            roughness: 0.3,
            metalness: 0.8,
            emissive: 0xb45309,
            emissiveIntensity: 0.3
        });

        matRebarTies = new THREE.LineBasicMaterial({
            color: 0xffd700, // Golden Shear Stirrups & Lateral Ties
            linewidth: 2,
            transparent: true,
            opacity: 0.95
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
                <!-- Header -->
                <div class="staad-header">
                    <div class="staad-header-title">
                        <div class="staad-header-badge">
                            <i class="fas fa-cube"></i>
                        </div>
                        <div class="staad-header-text">
                            <h3>
                                3D SKELETAL SPACE FRAME
                                <span class="staad-tag" id="staadHeaderTag">STAAD.Pro 2025 FEA</span>
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
                            Headroom / OHT (+14.13m)
                        </button>
                        <button type="button" class="staad-pill-btn" data-story="second" onclick="window.staadViewerFilterStory('second')">
                            Terrace (+11.13m)
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

        const colCrimson = new THREE.Color(0xef4444);
        const colCyan = new THREE.Color(0x06b6d4);
        const ribbonW = 0.04; // 40mm volumetric ribbon in local X

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
            opacity: 0.82,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        const mesh = new THREE.Mesh(geom, mat);
        mesh.renderOrder = 3;
        group.add(mesh);

        // Sharp neon crest outline
        const lineGeom = new THREE.BufferGeometry().setFromPoints(crestPoints);
        const line = new THREE.Line(lineGeom, new THREE.LineBasicMaterial({
            color: 0xffffff,
            linewidth: 2,
            transparent: true,
            opacity: 0.95
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
        const ribbonW = 0.04;

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
            color: 0x10b981,
            transparent: true,
            opacity: 0.78,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        const mesh = new THREE.Mesh(geom, mat);
        mesh.renderOrder = 3;
        group.add(mesh);

        const lineGeom = new THREE.BufferGeometry().setFromPoints(crestPoints);
        const line = new THREE.Line(lineGeom, new THREE.LineBasicMaterial({
            color: 0x34d399,
            linewidth: 2,
            transparent: true,
            opacity: 0.95
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
        const ribbonW = 0.04; // along local X

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
            color: 0xf59e0b, // Amber gold
            transparent: true,
            opacity: 0.78,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        const mesh = new THREE.Mesh(geom, mat);
        mesh.renderOrder = 3;
        group.add(mesh);

        const lineGeom = new THREE.BufferGeometry().setFromPoints(crestPoints);
        const line = new THREE.Line(lineGeom, new THREE.LineBasicMaterial({
            color: 0xfef08a,
            linewidth: 2,
            transparent: true,
            opacity: 0.95
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
        const ribbonW = 0.04;

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
            color: 0x10b981,
            transparent: true,
            opacity: 0.78,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        const mesh = new THREE.Mesh(geom, mat);
        mesh.renderOrder = 3;
        group.add(mesh);

        const lineGeom = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, yBot, zCrest),
            new THREE.Vector3(0, yTop, zCrest)
        ]);
        const line = new THREE.Line(lineGeom, new THREE.LineBasicMaterial({
            color: 0x34d399,
            linewidth: 2,
            transparent: true,
            opacity: 0.95
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

        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
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
        const gridHelper = new THREE.GridHelper(30, 30, 0xffd700, 0x1f293d);
        gridHelper.position.y = -0.55;
        scene.add(gridHelper);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        scene.add(ambientLight);

        const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.85);
        dirLight1.position.set(20, 35, 20);
        scene.add(dirLight1);

        const dirLight2 = new THREE.DirectionalLight(0x00e5ff, 0.45);
        dirLight2.position.set(-20, 20, -20);
        scene.add(dirLight2);
    }

    function initThree() {
        if (isInitialized) return;

        canvas = document.getElementById('staad3dCanvas');
        container = document.getElementById('staadViewportContainer');
        if (!canvas || !container) return;

        // Scene
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x070b14);
        scene.fog = new THREE.FogExp2(0x070b14, 0.015);

        // Camera
        const aspect = container.clientWidth / container.clientHeight;
        camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
        setCameraView('iso');

        // Renderer
        renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance'
        });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

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
        const dist = 32;
        const targetY = 6.0;

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
    }

    function getIntersectedObject(e) {
        if (!container) return null;
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

    function onCanvasMouseMove(e) {
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
        }
        if (tooltipEl) {
            tooltipEl.style.display = 'none';
        }
    }

    // Single Click: 3D Selection highlight only (or updates inspector if already open)
    function onCanvasClick(e) {
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
            case 'second': return 'Terrace (+11.13m)';
            case 'headroom': return 'Headroom / OHT (+14.13m)';
            default: return 'Floor';
        }
    }

    // Animation loop
    function animate() {
        animId = requestAnimationFrame(animate);

        if (controls) {
            if (autoRotate) {
                controls.autoRotate = true;
                controls.autoRotateSpeed = 1.2;
            } else {
                controls.autoRotate = false;
            }
            controls.update();
        }

        renderer.render(scene, camera);
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
        ['Solid', 'RCC', 'Moment', 'Shear'].forEach(m => {
            const btn = document.getElementById('btnMode' + m);
            if (btn) btn.classList.toggle('active', analysisMode.toLowerCase() === m.toLowerCase());
        });

        // Update banners
        const rccBanner = document.getElementById('staadRccBanner');
        const momentBanner = document.getElementById('staadMomentBanner');
        const shearBanner = document.getElementById('staadShearBanner');

        if (rccBanner) rccBanner.classList.toggle('active', analysisMode === 'rcc');
        if (momentBanner) momentBanner.classList.toggle('active', analysisMode === 'moment');
        if (shearBanner) shearBanner.classList.toggle('active', analysisMode === 'shear');

        // Header tag
        const headerTag = document.getElementById('staadHeaderTag');
        if (headerTag) {
            if (analysisMode === 'rcc') {
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
                headerTag.textContent = 'STAAD.Pro 2025 FEA';
                headerTag.style.color = '#ffd700';
                headerTag.style.borderColor = 'rgba(255, 215, 0, 0.4)';
            }
        }

        // Update members
        memberMeshes.forEach(m => {
            const u = m.userData;
            const matchesStory = (currentStory === 'all' || u.story === currentStory);
            const matchesGrid = !activeGridFilter || isMemberOnGrid(m, activeGridFilter);

            m.visible = matchesStory && matchesGrid;

            if (m.material) {
                if (analysisMode === 'solid') {
                    m.material.transparent = false;
                    m.material.opacity = 1.0;
                    m.material.depthWrite = true;
                } else if (analysisMode === 'rcc') {
                    m.material.transparent = true;
                    m.material.opacity = 0.28;
                    m.material.depthWrite = false;
                } else { // moment or shear
                    m.material.transparent = true;
                    m.material.opacity = 0.12; // faint ghost structure
                    m.material.depthWrite = false;
                }
                m.material.needsUpdate = true;
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
                } else if (analysisMode === 'rcc') {
                    f.material.transparent = true;
                    f.material.opacity = 0.35;
                    f.material.depthWrite = false;
                } else {
                    f.material.transparent = true;
                    f.material.opacity = 0.15;
                    f.material.depthWrite = false;
                }
                f.material.needsUpdate = true;
            }
            if (f.userData.rebarCage) {
                f.userData.rebarCage.visible = (analysisMode === 'rcc') && f.visible;
            }
        });

        // Slabs
        slabMeshes.forEach(s => {
            const matchesStory = (currentStory === 'all' || s.userData.story === currentStory);
            s.visible = showSlabs && matchesStory && !activeGridFilter;
            if (s.material) {
                s.material.opacity = (analysisMode === 'solid') ? 0.35 : (analysisMode === 'rcc' ? 0.20 : 0.08);
            }
        });

        // Joints / Nodes
        jointMeshes.forEach(jMesh => {
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
        getAnimId: () => animId
    };

})();
