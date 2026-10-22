/**
 * PROJECT 4-1 VAULT & UNIVERSAL IN-BROWSER VIEWER
 * Pure Client-Side Engineering File Renderer (CAD DXF, Excel XLS/XLSX, Word DOCX, Code, PDF)
 * Industrial Dark-Tech Theme (IS 456:2000 & SP 34 - Seismic Zone II)
 */

(function () {
    let vaultData = null;
    let activeFile = null;
    let activeFilter = 'all';
    let searchQuery = '';
    let isInitialized = false;

    // CAD Canvas State
    let cadEntities = [];
    let cadBBox = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    let cadTransform = { x: 0, y: 0, scale: 1 };
    window.cadTransform = cadTransform;
    window.drawCadCanvas = function() { drawCadCanvas(); };
    let isPanning = false;
    let panStart = { x: 0, y: 0 };

    let currentProjectId = 'project-4-1';

    window.openVault = async function (projectId = 'project-4-1') {
        const modal = document.getElementById('vaultModal');
        if (!modal) return;
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';

        if (!isInitialized) {
            initVaultEvents();
            isInitialized = true;
        }
        await switchVaultProject(projectId);
    };

    window.closeVault = function () {
        const modal = document.getElementById('vaultModal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = 'auto';
            // Stop any active iframes
            const pdfFrame = document.getElementById('pdfFrame');
            if (pdfFrame) pdfFrame.src = '';
        }
        window.vaultCloseSecurityModal();
    };

    window.toggleVaultFullscreen = function () {
        if (!document.fullscreenElement) {
            (document.documentElement.requestFullscreen ? document.documentElement.requestFullscreen() : Promise.reject())
                .catch(() => {
                    const win = document.querySelector('.vault-window');
                    if (win) win.requestFullscreen().catch(() => {});
                });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(() => {});
            }
        }
    };

    function initVaultEvents() {
        const modal = document.getElementById('vaultModal');
        modal.addEventListener('click', function (e) {
            if (e.target === modal) closeVault();
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && modal.classList.contains('active')) {
                closeVault();
            }
        });

        // Filter pills
        document.querySelectorAll('.vault-pill').forEach(pill => {
            pill.addEventListener('click', function () {
                document.querySelectorAll('.vault-pill').forEach(p => p.classList.remove('active'));
                this.classList.add('active');
                activeFilter = this.dataset.filter || 'all';
                renderFileTree();
            });
        });

        // Search input
        const searchInput = document.getElementById('vaultSearch');
        if (searchInput) {
            searchInput.addEventListener('input', function (e) {
                searchQuery = e.target.value.toLowerCase().trim();
                renderFileTree();
            });
        }

        // CAD Canvas Pan/Zoom Listeners
        initCadCanvasInteractions();

        // Responsive window resize
        window.addEventListener('resize', function () {
            if (activeFile && activeFile.category === 'cad' && activeFile.ext === 'dxf') {
                resetCadView();
                drawCadCanvas();
            }
        });
    }

    window.switchVaultProject = async function (projectId) {
        currentProjectId = projectId || 'project-4-1';
        showLoading(true, 'Indexing ' + (currentProjectId === 'project-3-2' ? 'Minor Project 3-2' : 'Major Project 4-1') + ' Deliverables...');
        try {
            if (window.VAULT_MANIFESTS && window.VAULT_MANIFESTS[currentProjectId]) {
                vaultData = window.VAULT_MANIFESTS[currentProjectId];
            } else if (window.VAULT_MANIFEST && (!currentProjectId || currentProjectId === 'project-4-1')) {
                vaultData = window.VAULT_MANIFEST;
            } else {
                const res = await fetch('vault_manifest.json');
                if (!res.ok) throw new Error('Manifest fetch failed: ' + res.status);
                const json = await res.json();
                if (json.projects && json.projects[currentProjectId]) {
                    vaultData = json.projects[currentProjectId];
                } else {
                    vaultData = json;
                }
            }

            // Update UI selector buttons
            document.querySelectorAll('.vault-proj-btn').forEach(btn => {
                if (btn.dataset.project === currentProjectId) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });

            // Update Header Meta
            const titleEl = document.getElementById('vaultProjectTitle');
            if (titleEl) {
                titleEl.innerHTML = currentProjectId === 'project-3-2'
                    ? `PROJECT 3-2 VAULT <span class="vault-stage-tag" style="background: rgba(56, 189, 248, 0.15); border-color: rgba(56, 189, 248, 0.35); color: #38bdf8;"><i class="fas fa-circle-check"></i> Minor Project Complete</span>`
                    : `PROJECT 4-1 VAULT <span class="vault-stage-tag"><i class="fas fa-spinner fa-spin"></i> Stage 1 (Ongoing)</span>`;
            }

            const metaEl = document.getElementById('vaultMetaText');
            if (metaEl) {
                metaEl.innerHTML = currentProjectId === 'project-3-2'
                    ? `Indiramma Indlu: Pure Manual Structural Design &bull; <span id="vaultTotalCount">${vaultData.totalFiles} Files (${vaultData.totalSize})</span> &bull; First-Principles Kani's Method &bull; IS 456:2000 Limit State`
                    : `G+2 Multi-Storey RCC Structure &bull; <span id="vaultTotalCount">${vaultData.totalFiles} Files (${vaultData.totalSize})</span> &bull; IS 456:2000 Limit State &bull; Seismic Zone II (Z = 0.10) &bull; SP 34 Detailing`;
            } else {
                const countEl = document.getElementById('vaultTotalCount');
                if (countEl) countEl.textContent = `${vaultData.totalFiles} Files (${vaultData.totalSize})`;
            }

            // Update filter pill counts dynamically based on categories in this project
            updatePillCounts();

            // Reset search and filter to 'all'
            searchQuery = '';
            const searchInput = document.getElementById('vaultSearch');
            if (searchInput) searchInput.value = '';
            activeFilter = 'all';
            document.querySelectorAll('.vault-pill').forEach(p => {
                if (p.dataset.filter === 'all') p.classList.add('active');
                else p.classList.remove('active');
            });

            renderFileTree();

            // Default file selection
            let defaultDoc = null;
            if (currentProjectId === 'project-3-2') {
                defaultDoc = vaultData.files.find(f => f.name.includes('FULL MAIN DOC.pdf') || f.name.includes('PROJECT REPORT.pdf') || f.name.includes('INDLU PLAN.dwg')) || vaultData.files[0];
            } else {
                defaultDoc = vaultData.files.find(f => f.name.includes('PROJECT STAGE 1 DOCUMENTATION.pdf') || f.name.includes('FINAL PLAN.dwg')) || vaultData.files[0];
            }
            if (defaultDoc) {
                try {
                    selectFile(defaultDoc);
                } catch (selErr) {
                    console.warn('Initial file selection caught:', selErr);
                }
            }
        } catch (err) {
            console.error('Error loading vault manifest:', err);
            showLoading(false);
            const vp = document.getElementById('vaultContentArea');
            if (vp) {
                vp.innerHTML = `<div style="padding: 40px; text-align: center; color: #f87171;">
                    <i class="fas fa-triangle-exclamation" style="font-size: 2rem; margin-bottom: 12px;"></i>
                    <h4>Failed to load Project Vault</h4>
                    <p style="color: #94a3b8; font-size: 0.85rem;">Make sure vault_manifest.json exists in the website directory.</p>
                </div>`;
            }
        } finally {
            showLoading(false);
        }
    };

    function updatePillCounts() {
        if (!vaultData || !vaultData.files) return;
        const counts = { cad: 0, excel: 0, pdf: 0, word: 0, code: 0 };
        vaultData.files.forEach(f => {
            const ext = (f.ext || f.extension || (f.name && f.name.includes('.') ? f.name.split('.').pop() : '')).toLowerCase();
            const cat = f.category || (['dxf', 'dwg'].includes(ext) ? 'cad' : ['xls', 'xlsx', 'csv'].includes(ext) ? 'excel' : ['doc', 'docx'].includes(ext) ? 'word' : ext === 'pdf' ? 'pdf' : ['std', 'py', 'js', 'json', 'lsp'].includes(ext) ? 'code' : 'other');
            if (counts[cat] !== undefined) counts[cat]++;
        });
        const cadPill = document.getElementById('pillCad');
        if (cadPill) cadPill.innerHTML = `<i class="fas fa-drafting-compass"></i> CAD (${counts.cad})`;
        const excelPill = document.getElementById('pillExcel');
        if (excelPill) excelPill.innerHTML = `<i class="fas fa-file-excel"></i> Excel (${counts.excel})`;
        const pdfPill = document.getElementById('pillPdf');
        if (pdfPill) pdfPill.innerHTML = `<i class="fas fa-file-pdf"></i> PDF (${counts.pdf})`;
        const wordPill = document.getElementById('pillWord');
        if (wordPill) wordPill.innerHTML = `<i class="fas fa-file-word"></i> Docs (${counts.word})`;
        const codePill = document.getElementById('pillCode');
        if (codePill) codePill.innerHTML = `<i class="fas fa-code"></i> Code (${counts.code})`;
    }

    async function loadManifest() {
        await switchVaultProject('project-4-1');
    }

    function getIconClass(category, ext) {
        switch (category) {
            case 'cad': return 'fas fa-drafting-compass icon-cad';
            case 'excel': return 'fas fa-file-excel icon-excel';
            case 'word': return 'fas fa-file-word icon-word';
            case 'pdf': return 'fas fa-file-pdf icon-pdf';
            case 'code': return 'fas fa-code icon-code';
            case 'image': return 'fas fa-file-image icon-image';
            case 'rcdc': return 'fas fa-cube icon-code';
            case 'bim': return 'fas fa-cube icon-cad';
            case 'presentation': return 'fas fa-file-powerpoint icon-word';
            case 'archive': return 'fas fa-file-zipper icon-archive';
            default: return 'fas fa-file-lines';
        }
    }

    function renderFileTree() {
        const container = document.getElementById('vaultTreeContainer');
        if (!container || !vaultData) return;

        // If user is searching or has an active category filter, show flat filtered list
        if (searchQuery || activeFilter !== 'all') {
            const filtered = vaultData.files.filter(f => {
                const matchSearch = !searchQuery || f.name.toLowerCase().includes(searchQuery) || f.folder.toLowerCase().includes(searchQuery);
                const matchFilter = activeFilter === 'all' || f.category === activeFilter;
                return matchSearch && matchFilter;
            });

            if (filtered.length === 0) {
                container.innerHTML = `<div style="padding: 24px 12px; text-align: center; color: var(--vault-text-muted); font-size: 0.8rem;">
                    No deliverables found matching "${searchQuery}".
                </div>`;
                return;
            }

            let html = `<div style="padding: 4px 6px;">`;
            filtered.forEach(file => {
                const isActive = activeFile && activeFile.path === file.path ? 'active' : '';
                html += `
                    <div class="tree-file-row ${isActive}" onclick="vaultSelectByPath('${file.path}')" title="${file.folder}/${file.name}">
                        <i class="${getIconClass(file.category, file.ext)}"></i>
                        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${file.name}</span>
                        <span class="tree-file-size">${file.size}</span>
                    </div>
                `;
            });
            html += `</div>`;
            container.innerHTML = html;
            return;
        }

        // Otherwise render the full hierarchical tree
        container.innerHTML = renderTreeNode(vaultData.tree, true);
    }

    function renderTreeNode(node, isRoot = false) {
        if (node.type === 'folder') {
            const isExpanded = isRoot;
            const childHtml = (node.children || []).map(child => renderTreeNode(child)).join('');
            const childCount = countChildren(node);

            return `
                <div class="tree-node ${isExpanded ? 'expanded' : ''}" data-relpath="${node.relPath}">
                    <div class="tree-folder-row" onclick="vaultToggleFolder(this)">
                        <i class="fas fa-chevron-right tree-folder-caret"></i>
                        <i class="fas fa-folder-open icon-folder"></i>
                        <span style="font-weight: 500;">${node.name}</span>
                        <span class="tree-badge-count">${childCount}</span>
                    </div>
                    <div class="tree-folder-children">
                        ${childHtml}
                    </div>
                </div>
            `;
        } else {
            const isActive = activeFile && activeFile.path === node.path ? 'active' : '';
            return `
                <div class="tree-file-row ${isActive}" onclick="vaultSelectByPath('${node.path}')" title="${node.name}">
                    <i class="${getIconClass(node.category, node.ext)}"></i>
                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${node.name}</span>
                    <span class="tree-file-size">${node.size}</span>
                </div>
            `;
        }
    }

    function countChildren(folderNode) {
        let count = 0;
        function countRec(n) {
            if (n.type === 'file') count++;
            else if (n.children) n.children.forEach(countRec);
        }
        if (folderNode.children) folderNode.children.forEach(countRec);
        return count;
    }

    window.vaultToggleFolder = function (rowEl) {
        const node = rowEl.closest('.tree-node');
        if (node) {
            node.classList.toggle('expanded');
        }
    };

    window.vaultSelectByPath = function (path) {
        if (!vaultData) return;
        const file = vaultData.files.find(f => f.path === path);
        if (file) {
            selectFile(file);
            // Highlight active row in sidebar
            document.querySelectorAll('.tree-file-row').forEach(row => {
                if (row.getAttribute('onclick')?.includes(path)) {
                    row.classList.add('active');
                } else {
                    row.classList.remove('active');
                }
            });
        }
    };

    function selectFile(file) {
        activeFile = file;

        // Update Breadcrumb & Header Info
        const crumbEl = document.getElementById('vaultBreadcrumb');
        if (crumbEl) {
            const parts = file.path.split('/');
            const folderPart = parts.slice(0, -1).join(' / ');
            crumbEl.innerHTML = `<span>${folderPart}</span> <i class="fas fa-chevron-right" style="font-size: 0.65rem;"></i> <span class="active-file">${file.name}</span>`;
        }

        // Update Action Buttons
        const downloadBtn = document.getElementById('vaultDownloadBtn');
        if (downloadBtn) {
            downloadBtn.onclick = function (e) {
                if (e) e.preventDefault();
                window.vaultTriggerSecureDownload(file.path, file.name);
            };
        }

        const fileExt = (file.ext || file.extension || (file.name && file.name.includes('.') ? file.name.split('.').pop() : '')).toLowerCase();
        file.ext = fileExt;
        if (!file.category) {
            if (['dxf', 'dwg'].includes(fileExt)) file.category = 'cad';
            else if (['xls', 'xlsx', 'csv'].includes(fileExt)) file.category = 'excel';
            else if (['doc', 'docx'].includes(fileExt)) file.category = 'word';
            else if (fileExt === 'pdf') file.category = 'pdf';
            else if (['jpg', 'jpeg', 'png', 'svg', 'webp', 'ico'].includes(fileExt)) file.category = 'image';
            else if (['std', 'py', 'js', 'json', 'lsp'].includes(fileExt)) file.category = 'code';
            else if (fileExt === 'rvt') file.category = 'bim';
            else if (['ppt', 'pptx'].includes(fileExt)) file.category = 'presentation';
            else file.category = 'other';
        }

        const sizeBadge = document.getElementById('vaultFileSizeBadge');
        if (sizeBadge) {
            sizeBadge.textContent = `${(fileExt || 'FILE').toUpperCase()} • ${file.size || ''}`;
        }

        // Route to appropriate viewer engine
        hideAllStages();
        showLoading(true, `Loading ${file.name}...`);

        setTimeout(() => {
            switch (file.category) {
                case 'cad':
                    if (file.ext === 'dxf') {
                        renderDxfFile(file);
                    } else if (file.ext === 'dwg') {
                        const companionDxfPath = file.path.replace(/\.dwg$/i, '.dxf');
                        const hasCompanion = vaultData && vaultData.files && vaultData.files.some(f => f.path.toLowerCase() === companionDxfPath.toLowerCase());
                        if (hasCompanion) {
                            renderDxfFile(file, companionDxfPath);
                        } else {
                            renderDwgAsset(file);
                        }
                    } else {
                        renderDwgAsset(file);
                    }
                    break;
                case 'excel':
                    renderExcelFile(file);
                    break;
                case 'word':
                    renderWordFile(file);
                    break;
                case 'pdf':
                    renderPdfFile(file);
                    break;
                case 'code':
                    renderCodeFile(file);
                    break;
                case 'image':
                    renderImageFile(file);
                    break;
                case 'bim':
                    renderBinaryAsset(file, 'Autodesk Revit BIM Model', 'fas fa-cube icon-cad', 'Native Autodesk Revit BIM model and 3D architectural/structural dataset. Download to view in Autodesk Revit / BIM 360.');
                    break;
                case 'presentation':
                    renderBinaryAsset(file, 'PowerPoint Presentation', 'fas fa-file-powerpoint icon-word', 'Presentation deck deliverable. Download to view slides in Microsoft PowerPoint.');
                    break;
                case 'rcdc':
                    renderBinaryAsset(file, 'Bentley RCDC Concrete File', 'fas fa-cube icon-code', 'Bentley RCDC structural concrete design and automated reinforcement detailing file. Open with Bentley RCDC Connect Edition.');
                    break;
                case 'archive':
                    renderBinaryAsset(file, 'Compressed Archive / Backup', 'fas fa-file-zipper icon-archive', 'Archived project deliverable or backup file.');
                    break;
                default:
                    renderBinaryAsset(file, (file.ext ? file.ext.toUpperCase() : 'Structured') + ' File', 'fas fa-file-lines', 'Binary/Structured Project Asset.');
                    break;
            }
        }, 30);
    }

    function hideAllStages() {
        document.querySelectorAll('.viewport-stage').forEach(el => {
            el.classList.remove('active');
            el.style.display = 'none';
        });
    }

    function activateStage(stageId, displayType = 'flex') {
        hideAllStages();
        const stage = document.getElementById(stageId);
        if (stage) {
            stage.classList.add('active');
            stage.style.display = displayType;
        }
        return stage;
    }

    function showLoading(show, message = 'Loading...') {
        const overlay = document.getElementById('vaultLoadingOverlay');
        const text = document.getElementById('vaultLoadingText');
        if (!overlay) return;
        if (show) {
            if (text) text.textContent = message;
            overlay.classList.add('active');
        } else {
            overlay.classList.remove('active');
        }
    }

    // ==========================================
    // 1. CAD DXF / DWG RENDERER (Pure Canvas Engine)
    // ==========================================
    let cadRafPending = false;
    function requestCadRender() {
        if (!cadRafPending) {
            cadRafPending = true;
            window.requestAnimationFrame(() => {
                cadRafPending = false;
                drawCadCanvas();
            });
        }
    }

    // ==========================================
    // 1. CAD DXF / DWG RENDERER (High-DPI 60FPS Pure Canvas Engine)
    // ==========================================
    async function renderDxfFile(file, overridePath = null) {
        activateStage('dxfStage', 'flex');

        try {
            const fetchPath = overridePath || file.path;
            const res = await fetch(encodeURI(fetchPath));
            if (!res.ok) throw new Error(`Could not fetch CAD file (${res.status})`);
            const dxfText = await res.text();

            let parser;
            if (window.DxfParser) {
                parser = new window.DxfParser();
            } else {
                throw new Error('DxfParser library not loaded');
            }

            const dxf = parser.parseSync(dxfText);
            const rawEntities = dxf.entities || [];

            // 1. Initial geometric pass to compute physical extents & median text height
            const geomBBox = calculateInitialGeomBBox(rawEntities);
            const maxDim = Math.max(geomBBox.maxX - geomBBox.minX, geomBBox.maxY - geomBBox.minY) || 100;

            let textHeights = [];
            rawEntities.forEach(e => {
                if ((e.type === 'TEXT' || e.type === 'MTEXT') && (e.textHeight || e.height)) {
                    const h = e.textHeight || e.height;
                    if (h > 0 && h < maxDim * 0.4) textHeights.push(h);
                }
            });
            textHeights.sort((a, b) => a - b);
            let medianTextH = textHeights.length > 0 ? textHeights[Math.floor(textHeights.length / 2)] : 0;
            if (!medianTextH || medianTextH <= 0) {
                if (maxDim < 250) medianTextH = 0.22;
                else if (maxDim < 3000) medianTextH = 10.0;
                else medianTextH = 150.0;
            }

            // Preprocess entities for high performance (pre-color, pre-bbox, pre-clean, readability)
            cadEntities = preprocessCadEntities(rawEntities, maxDim, medianTextH);
            window.__cadEntities = cadEntities;

            // Calculate Bounding Box
            cadBBox = calculateDxfBBox(cadEntities);

            // Update meta overlay
            const countEl = document.getElementById('cadEntityCount');
            if (countEl) countEl.textContent = `${file.name} • ${cadEntities.length.toLocaleString()} CAD Entities`;

            resetCadView();
            drawCadCanvas();
        } catch (err) {
            if (file.ext === 'dwg') {
                renderDwgAsset(file);
                return;
            }
            if (err.name === 'AbortError' || err.message?.includes('aborted') || err.message?.includes('Failed to fetch')) {
                // Ignore transient network aborts during rapid switching
                showLoading(false);
                return;
            }
            console.warn('CAD file vector parse notice:', err.message);
            renderBinaryAsset(file, file.ext.toUpperCase() + ' Drawing', 'fas fa-drafting-compass icon-cad', 'Could not parse CAD vector content: ' + err.message);
        } finally {
            showLoading(false);
        }
    }

    function calculateInitialGeomBBox(entities) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        function pt(x, y) {
            if (x !== undefined && !isNaN(x)) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
            }
            if (y !== undefined && !isNaN(y)) {
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
        entities.forEach(e => {
            if (e.type === 'LINE' && e.vertices && e.vertices.length >= 2) {
                pt(e.vertices[0].x, e.vertices[0].y);
                pt(e.vertices[1].x, e.vertices[1].y);
            } else if ((e.type === 'LWPOLYLINE' || e.type === 'POLYLINE') && e.vertices) {
                for (let i = 0; i < e.vertices.length; i++) pt(e.vertices[i].x, e.vertices[i].y);
            } else if (e.verticesCoordinates) {
                for (let i = 0; i < e.verticesCoordinates.length; i += 2) {
                    pt(e.verticesCoordinates[i], e.verticesCoordinates[i + 1]);
                }
            } else if (e.center) {
                const r = e.radius || 10;
                pt(e.center.x - r, e.center.y - r);
                pt(e.center.x + r, e.center.y + r);
            }
        });
        if (minX === Infinity || minX === maxX) {
            minX = 0; minY = 0; maxX = 1000; maxY = 1000;
        }
        return { minX, minY, maxX, maxY };
    }

    function preprocessCadEntities(entities, maxDim = 1000, medianTextH = 10) {
        return entities.map(e => {
            // Determine layer color once
            let color = '#38bdf8';
            if (e.layer) {
                const l = e.layer.toLowerCase();
                if (l.includes('rebar') || l.includes('steel') || l.includes('bar') || l.includes('stirrup') || l.includes('tie')) {
                    color = '#fbbf24';
                } else if (l.includes('beam') || l.includes('col') || l.includes('slab') || l.includes('conc')) {
                    color = '#34d399';
                } else if (l.includes('dim') || l.includes('text') || l.includes('schedule') || l.includes('mark')) {
                    color = '#f8fafc';
                } else if (l.includes('grid') || l.includes('axis') || l.includes('center')) {
                    color = '#f87171';
                } else if (l.includes('section') || l.includes('hatch')) {
                    color = '#94a3b8';
                }
            }
            e._color = color;

            // Precompute bounding box
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            function pt(x, y) {
                if (x !== undefined && !isNaN(x)) {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                }
                if (y !== undefined && !isNaN(y)) {
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }

            if (e.type === 'LINE' && e.vertices && e.vertices.length >= 2) {
                pt(e.vertices[0].x, e.vertices[0].y);
                pt(e.vertices[1].x, e.vertices[1].y);
            } else if ((e.type === 'LWPOLYLINE' || e.type === 'POLYLINE') && e.vertices) {
                for (let i = 0; i < e.vertices.length; i++) pt(e.vertices[i].x, e.vertices[i].y);
            } else if (e.verticesCoordinates) {
                for (let i = 0; i < e.verticesCoordinates.length; i += 2) {
                    pt(e.verticesCoordinates[i], e.verticesCoordinates[i + 1]);
                }
            } else if (e.center) {
                const r = e.radius || 10;
                pt(e.center.x - r, e.center.y - r);
                pt(e.center.x + r, e.center.y + r);
            } else if (e.type === 'TEXT' || e.type === 'MTEXT') {
                let p = null;
                let textAlign = 'left';
                let textBaseline = 'bottom';

                if (e.type === 'MTEXT') {
                    p = e.position || e.startPoint;
                    const ap = e.attachmentPoint || 1;
                    if (ap === 2 || ap === 5 || ap === 8) textAlign = 'center';
                    else if (ap === 3 || ap === 6 || ap === 9) textAlign = 'right';
                    else textAlign = 'left';

                    if (ap === 1 || ap === 2 || ap === 3) textBaseline = 'top';
                    else if (ap === 4 || ap === 5 || ap === 6) textBaseline = 'middle';
                    else textBaseline = 'bottom';
                } else {
                    // AutoCAD DXF rule: if justification (halign or valign) is non-zero,
                    // Group code 11 (parsed as endPoint) is the alignment insertion point!
                    if ((e.halign && e.halign !== 0) || (e.valign && e.valign !== 0)) {
                        p = e.endPoint || e.startPoint || e.position;
                    } else {
                        p = e.startPoint || e.position;
                    }

                    if (e.halign === 1 || e.halign === 4) textAlign = 'center';
                    else if (e.halign === 2) textAlign = 'right';
                    else textAlign = 'left';

                    if (e.valign === 1) textBaseline = 'bottom';
                    else if (e.valign === 2) textBaseline = 'middle';
                    else if (e.valign === 3) textBaseline = 'top';
                    else textBaseline = 'bottom';
                }

                if (p) {
                    const rawText = Array.isArray(e.text) ? e.text.join(' ') : String(e.text || '');
                    e._cleanText = cleanCadText(rawText);
                    let h = e.textHeight || e.height;
                    if (!h || h <= 0 || h > maxDim * 0.3) {
                        h = medianTextH;
                    }
                    e._h = Math.max(h, 0.05);

                    // CAD Readability Rule:
                    // Text should read from left to right (or bottom to top).
                    // If text rotation would render upside down (between 90 deg and 270 deg),
                    // rotate by 180 degrees (Math.PI) so it is upright!
                    let rotDeg = e.rotation || 0;
                    let rad = (rotDeg * Math.PI) / 180;
                    let norm = rad % (2 * Math.PI);
                    if (norm > Math.PI) norm -= 2 * Math.PI;
                    if (norm < -Math.PI) norm += 2 * Math.PI;
                    if (Math.abs(norm) > Math.PI / 2 + 0.01) {
                        norm = norm > 0 ? norm - Math.PI : norm + Math.PI;
                    }
                    e._rot = norm;
                    e._pt = p;
                    e._textAlign = textAlign;
                    e._textBaseline = textBaseline;

                    // Comprehensive bounding box considering text length, alignments and rotation
                    const textLen = (e._cleanText || '').length || 1;
                    const textW = textLen * e._h * 0.75;
                    const textH = e._h * 1.2;

                    let x0 = 0, x1 = textW;
                    if (textAlign === 'center') {
                        x0 = -textW / 2;
                        x1 = textW / 2;
                    } else if (textAlign === 'right') {
                        x0 = -textW;
                        x1 = 0;
                    }

                    let y0 = -textH * 0.25, y1 = textH;
                    if (textBaseline === 'middle') {
                        y0 = -textH / 2;
                        y1 = textH / 2;
                    } else if (textBaseline === 'top') {
                        y0 = -textH;
                        y1 = 0;
                    }

                    const rot = e._rot || 0;
                    const cos = Math.cos(rot);
                    const sin = Math.sin(rot);

                    const corners = [
                        { x: x0, y: y0 },
                        { x: x1, y: y0 },
                        { x: x1, y: y1 },
                        { x: x0, y: y1 }
                    ];

                    for (let c = 0; c < 4; c++) {
                        const rx = p.x + (corners[c].x * cos - corners[c].y * sin);
                        const ry = p.y + (corners[c].x * sin + corners[c].y * cos);
                        pt(rx, ry);
                    }
                }
            } else if (e.type === 'DIMENSION') {
                if (e.linearOrAngularPoint1) pt(e.linearOrAngularPoint1.x, e.linearOrAngularPoint1.y);
                if (e.linearOrAngularPoint2) pt(e.linearOrAngularPoint2.x, e.linearOrAngularPoint2.y);
                if (e.middleOfText) {
                    pt(e.middleOfText.x, e.middleOfText.y);

                    // Determine actual measurement value
                    let val = e.actualMeasurement;
                    if ((val === undefined || isNaN(val) || val <= 0) && e.linearOrAngularPoint1 && e.linearOrAngularPoint2) {
                        val = Math.hypot(e.linearOrAngularPoint2.x - e.linearOrAngularPoint1.x, e.linearOrAngularPoint2.y - e.linearOrAngularPoint1.y);
                    }

                    // Format dimension measurement based on drawing scale
                    let formattedVal = '';
                    if (val !== undefined && !isNaN(val) && val > 0) {
                        if (maxDim < 250) {
                            // Meter scale (SI Metric): e.g. 8.05m or 6.81m
                            formattedVal = (Math.round(val * 100) / 100).toFixed(2).replace(/\.00$/, '') + 'm';
                        } else if (maxDim < 3000) {
                            // Architectural units (inches): convert to feet and inches e.g. 396 -> 33'-0", 60 -> 5'-0"
                            const totalInches = Math.round(val * 2) / 2;
                            const feet = Math.floor(totalInches / 12);
                            const inches = totalInches % 12;
                            if (inches === 0) {
                                formattedVal = `${feet}'-0"`;
                            } else if (inches % 1 === 0) {
                                formattedVal = `${feet}'-${inches}"`;
                            } else {
                                formattedVal = `${feet}'-${Math.floor(inches)} 1/2"`;
                            }
                        } else {
                            // Engineering units (millimeters): e.g. 3924, 1500
                            formattedVal = Math.round(val).toLocaleString();
                        }
                    }

                    // Clean raw text and handle AutoCAD placeholder '<>'
                    const rawText = Array.isArray(e.text) ? e.text.join(' ') : String(e.text || '');
                    const cleaned = cleanCadText(rawText);

                    let dimText = '';
                    if (!cleaned || cleaned === '<>') {
                        dimText = formattedVal;
                    } else if (cleaned.includes('<>')) {
                        dimText = cleaned.replace(/<>/g, formattedVal).trim();
                    } else {
                        // User specified explicit custom text in AutoCAD (e.g. 22' 4" or 26' 5")
                        dimText = cleaned;
                    }

                    e._dimText = dimText;

                    // Calibrate dimension text height to match drawing scale
                    let dimH = e.textHeight || e.height;
                    if (!dimH || dimH <= 0 || dimH > maxDim * 0.25) {
                        dimH = medianTextH;
                    }
                    e._dimH = Math.max(dimH, 0.05);

                    // Dimension rotation with standard CAD readability rule
                    let dimRot = e.rotation || 0;
                    let rad = (dimRot * Math.PI) / 180;
                    let norm = rad % (2 * Math.PI);
                    if (norm > Math.PI) norm -= 2 * Math.PI;
                    if (norm < -Math.PI) norm += 2 * Math.PI;
                    if (Math.abs(norm) > Math.PI / 2 + 0.01) {
                        norm = norm > 0 ? norm - Math.PI : norm + Math.PI;
                    }
                    e._dimRot = norm;

                    if (dimText) {
                        const dw = dimText.length * dimH * 0.75;
                        pt(e.middleOfText.x - dw / 2, e.middleOfText.y - dimH / 2);
                        pt(e.middleOfText.x + dw / 2, e.middleOfText.y + dimH / 2);
                    }
                }
            }

            e._minX = minX; e._maxX = maxX; e._minY = minY; e._maxY = maxY;
            return e;
        });
    }

    function calculateDxfBBox(entities) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        entities.forEach(e => {
            if (e._minX !== undefined && e._minX !== Infinity) {
                if (e._minX < minX) minX = e._minX;
                if (e._maxX > maxX) maxX = e._maxX;
                if (e._minY < minY) minY = e._minY;
                if (e._maxY > maxY) maxY = e._maxY;
            }
        });

        if (minX === Infinity || minX === maxX) {
            minX = 0; minY = 0; maxX = 1000; maxY = 1000;
        }
        return { minX, minY, maxX, maxY };
    }

    function cleanCadText(str) {
        if (!str) return '';
        return String(str)
            .replace(/\\P/gi, ' ')
            .replace(/\\X/gi, ' ')
            .replace(/\\f[^;]*;/gi, '')
            .replace(/\\[A-Za-z][^;]*;/gi, '')
            .replace(/\\[A-Za-z0-9]+/g, '')
            .replace(/%%[uo]/gi, '')
            .replace(/%%c/gi, 'Ø')
            .replace(/%%d/gi, '°')
            .replace(/%%p/gi, '±')
            .replace(/[{}]/g, '')
            .replace(/\\~/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function resetCadView() {
        const canvas = document.getElementById('cadCanvas');
        if (!canvas) return;
        const rect = canvas.parentElement.getBoundingClientRect();
        // High-DPI support: render at native device pixel ratio (capped at 2x for smooth 60fps)
        const dpr = Math.min(window.devicePixelRatio || 1, 1.25); // Throttled DPR for smooth, low-temp rendering
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);

        const w = (cadBBox.maxX - cadBBox.minX) || 100;
        const h = (cadBBox.maxY - cadBBox.minY) || 100;

        const scaleX = (canvas.width * 0.88) / w;
        const scaleY = (canvas.height * 0.88) / h;
        cadTransform.scale = Math.min(scaleX, scaleY);

        const cx = (cadBBox.minX + cadBBox.maxX) / 2;
        const cy = (cadBBox.minY + cadBBox.maxY) / 2;

        cadTransform.x = canvas.width / 2 - cx * cadTransform.scale;
        cadTransform.y = canvas.height / 2 + cy * cadTransform.scale;
    }

    function drawCadCanvas() {
        const canvas = document.getElementById('cadCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: false });
        ctx.fillStyle = '#0a0d14';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw Dark Engineering Grid
        drawCadGrid(ctx, canvas);

        const scale = cadTransform.scale;
        // Viewport bounds in world coordinates with generous buffer (1.5x screen dimension)
        // Completely eliminates culling pop-in / disappearance of columns and text during scroll and pan
        const pad = Math.max(canvas.width, canvas.height) * 1.5 / scale;
        const vMinX = (-cadTransform.x) / scale - pad;
        const vMaxX = (canvas.width - cadTransform.x) / scale + pad;
        const vMinY = (cadTransform.y - canvas.height) / scale - pad;
        const vMaxY = (cadTransform.y) / scale + pad;

        ctx.save();
        ctx.translate(cadTransform.x, cadTransform.y);
        ctx.scale(scale, -scale); // Invert Y so up is positive

        const defaultLineWidth = Math.max(0.75 / scale, 0.45);
        ctx.lineWidth = defaultLineWidth;

        // Draw Entities with Frustum Culling
        for (let i = 0; i < cadEntities.length; i++) {
            const e = cadEntities[i];

            // Culling: skip entities entirely outside visible screen
            if (e._maxX !== undefined && (e._maxX < vMinX || e._minX > vMaxX || e._maxY < vMinY || e._minY > vMaxY)) {
                continue;
            }

            ctx.strokeStyle = e._color || '#38bdf8';

            if (e.type === 'LINE') {
                if (e.vertices && e.vertices.length >= 2) {
                    ctx.beginPath();
                    ctx.moveTo(e.vertices[0].x, e.vertices[0].y);
                    ctx.lineTo(e.vertices[1].x, e.vertices[1].y);
                    ctx.stroke();
                }
            } else if (e.type === 'LWPOLYLINE' || e.type === 'POLYLINE') {
                if (e.vertices && e.vertices.length > 0) {
                    ctx.beginPath();
                    ctx.moveTo(e.vertices[0].x, e.vertices[0].y);
                    for (let j = 1; j < e.vertices.length; j++) {
                        ctx.lineTo(e.vertices[j].x, e.vertices[j].y);
                    }
                    if (e.shape || e.isClosed) ctx.closePath();
                    ctx.stroke();
                } else if (e.verticesCoordinates && e.verticesCoordinates.length >= 4) {
                    ctx.beginPath();
                    ctx.moveTo(e.verticesCoordinates[0], e.verticesCoordinates[1]);
                    for (let j = 2; j < e.verticesCoordinates.length; j += 2) {
                        ctx.lineTo(e.verticesCoordinates[j], e.verticesCoordinates[j + 1]);
                    }
                    if (e.shape || e.isClosed) ctx.closePath();
                    ctx.stroke();
                }
            } else if (e.type === 'CIRCLE') {
                ctx.beginPath();
                ctx.arc(e.center.x, e.center.y, e.radius, 0, Math.PI * 2);
                ctx.stroke();
            } else if (e.type === 'ARC') {
                ctx.beginPath();
                ctx.arc(e.center.x, e.center.y, e.radius, e.startAngle, e.endAngle);
                ctx.stroke();
            } else if (e.type === 'TEXT' || e.type === 'MTEXT') {
                // Sub-pixel LOD: skip text if it renders smaller than 1.8 pixels on screen
                if ((e._h * scale) < 1.8) continue;

                if (e._pt && e._cleanText) {
                    ctx.save();
                    ctx.translate(e._pt.x, e._pt.y);
                    if (e._rot) ctx.rotate(e._rot);
                    ctx.scale(1, -1);

                    ctx.font = `600 ${e._h}px 'Consolas', 'Courier New', monospace`;
                    ctx.fillStyle = e._color || '#f8fafc';
                    ctx.textAlign = e._textAlign || 'left';
                    ctx.textBaseline = e._textBaseline || 'bottom';

                    ctx.fillText(e._cleanText, 0, 0);
                    ctx.restore();
                }
            } else if (e.type === 'DIMENSION') {
                if (e.linearOrAngularPoint1 && e.linearOrAngularPoint2) {
                    ctx.beginPath();
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
                    ctx.lineWidth = Math.max(0.6 / scale, 0.4);
                    ctx.moveTo(e.linearOrAngularPoint1.x, e.linearOrAngularPoint1.y);
                    ctx.lineTo(e.linearOrAngularPoint2.x, e.linearOrAngularPoint2.y);
                    ctx.stroke();
                }

                if (e.middleOfText && e._dimText && (e._dimH * scale >= 1.5)) {
                    ctx.save();
                    ctx.translate(e.middleOfText.x, e.middleOfText.y);
                    if (e._dimRot) ctx.rotate(e._dimRot);
                    ctx.scale(1, -1);
                    ctx.font = `600 ${Math.max(e._dimH, 0.05)}px 'Consolas', 'Courier New', monospace`;
                    ctx.fillStyle = '#f8fafc';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(e._dimText, 0, 0);
                    ctx.restore();
                }
            }
        }

        ctx.restore();
    }

    function drawCadGrid(ctx, canvas) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.lineWidth = 1;
        const step = 45;
        for (let x = 0; x < canvas.width; x += step) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += step) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
        }
    }

    function initCadCanvasInteractions() {
        const canvas = document.getElementById('cadCanvas');
        if (!canvas) return;

        canvas.addEventListener('mousedown', function (e) {
            isPanning = true;
            panStart = { x: e.clientX, y: e.clientY };
        });

        window.addEventListener('mousemove', function (e) {
            if (!isPanning) return;
            const dpr = Math.min(window.devicePixelRatio || 1, 1.25); // Throttled DPR for smooth, low-temp rendering
            const dx = (e.clientX - panStart.x) * dpr;
            const dy = (e.clientY - panStart.y) * dpr;
            panStart = { x: e.clientX, y: e.clientY };
            cadTransform.x += dx;
            cadTransform.y += dy;
            requestCadRender();
        });

        window.addEventListener('mouseup', function () {
            isPanning = false;
        });

        // Zoom centered on mouse cursor with smooth RAF batching
        canvas.addEventListener('wheel', function (e) {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const dpr = Math.min(window.devicePixelRatio || 1, 1.25); // Throttled DPR for smooth, low-temp rendering
            const mouseX = (e.clientX - rect.left) * dpr;
            const mouseY = (e.clientY - rect.top) * dpr;

            const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;

            cadTransform.x = mouseX - (mouseX - cadTransform.x) * zoomFactor;
            cadTransform.y = mouseY - (mouseY - cadTransform.y) * zoomFactor;
            cadTransform.scale *= zoomFactor;
            requestCadRender();
        }, { passive: false });

        // Double click to fit view
        canvas.addEventListener('dblclick', function () {
            resetCadView();
            requestCadRender();
        });
    }

    window.cadZoomIn = function () {
        const canvas = document.getElementById('cadCanvas');
        if (!canvas) return;
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        cadTransform.x = cx - (cx - cadTransform.x) * 1.25;
        cadTransform.y = cy - (cy - cadTransform.y) * 1.25;
        cadTransform.scale *= 1.25;
        requestCadRender();
    };

    window.cadZoomOut = function () {
        const canvas = document.getElementById('cadCanvas');
        if (!canvas) return;
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        cadTransform.x = cx - (cx - cadTransform.x) * 0.8;
        cadTransform.y = cy - (cy - cadTransform.y) * 0.8;
        cadTransform.scale *= 0.8;
        requestCadRender();
    };

    window.cadResetView = function () {
        resetCadView();
        requestCadRender();
    };

    // ==========================================
    // 2. EXCEL SPREADSHEET RENDERER (SheetJS)
    // ==========================================
    let currentWorkbook = null;

    async function renderExcelFile(file) {
        activateStage('excelStage', 'flex');

        try {
            const res = await fetch(encodeURI(file.path));
            const arrayBuffer = await res.arrayBuffer();

            if (!window.XLSX) throw new Error('SheetJS XLSX library not loaded');

            currentWorkbook = XLSX.read(arrayBuffer, { type: 'array' });
            const sheetTabs = document.getElementById('excelSheetTabs');
            sheetTabs.innerHTML = '';

            currentWorkbook.SheetNames.forEach((sheetName, index) => {
                const tab = document.createElement('div');
                tab.className = `excel-tab ${index === 0 ? 'active' : ''}`;
                tab.textContent = sheetName;
                tab.onclick = () => {
                    document.querySelectorAll('.excel-tab').forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    displayWorksheet(sheetName);
                };
                sheetTabs.appendChild(tab);
            });

            if (currentWorkbook.SheetNames.length > 0) {
                displayWorksheet(currentWorkbook.SheetNames[0]);
            }
        } catch (err) {
            console.error('Error rendering Excel file:', err);
            renderBinaryAsset(file, 'Excel Bar Bending Schedule', 'fas fa-file-excel icon-excel', 'Could not parse spreadsheet: ' + err.message);
        } finally {
            showLoading(false);
        }
    }

    function displayWorksheet(sheetName) {
        const tableContainer = document.getElementById('excelTableContainer');
        if (!currentWorkbook || !tableContainer) return;

        const sheet = currentWorkbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        if (rows.length === 0) {
            tableContainer.innerHTML = `<div style="padding: 30px; text-align: center; color: var(--vault-text-dim);">Empty Sheet</div>`;
            return;
        }

        let maxCols = 0;
        rows.forEach(r => { if (r.length > maxCols) maxCols = r.length; });

        let html = '<table class="excel-table">';
        
        // Header letters (A, B, C...)
        html += '<thead><tr><th class="excel-row-num">#</th>';
        for (let c = 0; c < maxCols; c++) {
            html += `<th>${getExcelColumnLabel(c)}</th>`;
        }
        html += '</tr></thead><tbody>';

        rows.forEach((row, rIdx) => {
            html += `<tr><td class="excel-row-num">${rIdx + 1}</td>`;
            for (let c = 0; c < maxCols; c++) {
                const val = row[c] !== undefined ? row[c] : '';
                html += `<td>${escapeHtml(String(val))}</td>`;
            }
            html += '</tr>';
        });

        html += '</tbody></table>';
        tableContainer.innerHTML = html;
    }

    function getExcelColumnLabel(colIndex) {
        let label = '';
        while (colIndex >= 0) {
            label = String.fromCharCode((colIndex % 26) + 65) + label;
            colIndex = Math.floor(colIndex / 26) - 1;
        }
        return label;
    }

    // ==========================================
    // 3. WORD DOCUMENT RENDERER (A4 Document Paper)
    // ==========================================
    async function renderWordFile(file) {
        activateStage('wordStage', 'block');
        const container = document.getElementById('wordContent');

        // Check pre-rendered fallback (instant high-fidelity A4 Word layout)
        if (window.VAULT_PREVIEWS && window.VAULT_PREVIEWS[file.path]) {
            container.innerHTML = window.VAULT_PREVIEWS[file.path].html;
            const stage = document.getElementById('wordStage');
            if (stage) stage.scrollTop = 0;
            // Force eager loading for initial visible pages
            const initialImgs = container.querySelectorAll('.word-page:nth-child(-n+3) img');
            initialImgs.forEach(img => {
                img.loading = 'eager';
            });
            showLoading(false);
            return;
        }

        // Check if there is a matching companion PDF deliverable
        let companionPdf = null;
        if (vaultData && vaultData.files) {
            const pdfPath = file.path.replace(/\.docx?$/i, '.pdf');
            companionPdf = vaultData.files.find(f => f.path.toLowerCase() === pdfPath.toLowerCase());
        }

        if (companionPdf) {
            // Render directly in native high-clarity Browser PDF Controls
            renderPdfFile(companionPdf);
            return;
        }

        // Mammoth fallback wrapped in professional white A4 paper sheet
        try {
            const res = await fetch(encodeURI(file.path));
            const arrayBuffer = await res.arrayBuffer();

            if (!window.mammoth) throw new Error('Mammoth.js library not loaded');

            const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
            container.innerHTML = `
                <div class="word-doc-toolbar">
                    <div class="word-toolbar-meta">
                        <i class="fas fa-file-word icon-word"></i>
                        <span>${file.name}</span>
                        <span class="word-toolbar-badge">Formatted Word Document</span>
                    </div>
                </div>
                <div class="word-pages-container">
                    <div class="word-page" style="padding: 48px 56px; background: #ffffff !important; color: #1e293b; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 15px; line-height: 1.65; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                        ${result.value || '<p>No content extracted from Word document.</p>'}
                    </div>
                </div>
            `;
            const stage = document.getElementById('wordStage');
            if (stage) stage.scrollTop = 0;
        } catch (err) {
            console.error('Error rendering Word doc:', err);
            renderBinaryAsset(file, 'Word Document', 'fas fa-file-word icon-word', 'Could not parse Word document: ' + err.message);
        } finally {
            showLoading(false);
        }
    }

    // ==========================================
    // 4. PDF DOCUMENT RENDERER (Native Browser Controls)
    // ==========================================
    function renderPdfFile(file) {
        activateStage('pdfStage', 'flex');
        const pdfFrame = document.getElementById('pdfFrame');
        if (pdfFrame) {
            pdfFrame.src = encodeURI(file.path);
        }
        showLoading(false);
    }

    // ==========================================
    // 5. CODE / SCRIPT RENDERER (Prism.js)
    // ==========================================
    async function renderCodeFile(file) {
        // Defensive check: Guard against large files or misclassified binaries locking up Prism.js
        if (file.sizeBytes && file.sizeBytes > 500 * 1024) {
            renderBinaryAsset(file, (file.ext ? file.ext.toUpperCase() : 'Code') + ' File', 'fas fa-code icon-code', 'Large source file (' + file.size + '). Use the download button below to inspect locally.');
            return;
        }

        activateStage('codeStage', 'flex');
        const codeEl = document.getElementById('codeContent');

        const banner3d = document.getElementById('code3dBanner');
        if (banner3d) {
            const isStd = (file.ext === 'std' || file.name.toLowerCase().endsWith('.std'));
            banner3d.style.display = isStd ? 'flex' : 'none';
            if (isStd) {
                const isRcc = file.name.toLowerCase().includes('rcc') || file.name.toLowerCase().includes('rcdc') || file.name.toLowerCase().includes('detailing');
                const titleEl = document.getElementById('code3dBannerTitle');
                const btnEl = document.getElementById('code3dBannerBtn');
                if (isRcc) {
                    banner3d.style.background = 'rgba(0, 229, 255, 0.12)';
                    banner3d.style.borderBottom = '1px solid rgba(0, 229, 255, 0.35)';
                    if (titleEl) {
                        titleEl.style.color = '#00e5ff';
                        titleEl.innerHTML = '<i class="fas fa-shield-halved"></i> <strong>Bentley RCDC Concrete Detailing</strong> (Columns, Beams &amp; Footings Schedule)';
                    }
                    if (btnEl) {
                        btnEl.style.background = '#00e5ff';
                        btnEl.style.color = '#050b14';
                        btnEl.style.boxShadow = '0 0 12px rgba(0, 229, 255, 0.4)';
                        btnEl.innerHTML = '<i class="fas fa-shield-halved"></i> Launch RCC Detailing 3D Model';
                        btnEl.onclick = () => window.open3DViewer('rcc');
                    }
                } else {
                    banner3d.style.background = 'rgba(255, 215, 0, 0.12)';
                    banner3d.style.borderBottom = '1px solid rgba(255, 215, 0, 0.3)';
                    if (titleEl) {
                        titleEl.style.color = '#ffd700';
                        titleEl.innerHTML = '<i class="fas fa-cube"></i> <strong>Bentley STAAD.Pro 2025 Structural Space Frame</strong> (100 Joints, 188 Members)';
                    }
                    if (btnEl) {
                        btnEl.style.background = '#ffd700';
                        btnEl.style.color = '#000';
                        btnEl.style.boxShadow = '0 0 10px rgba(255, 215, 0, 0.3)';
                        btnEl.innerHTML = '<i class="fas fa-cube"></i> Launch Interactive 3D Model View';
                        btnEl.onclick = () => window.open3DViewer();
                    }
                }
            }
        }

        // Check pre-rendered fallback (instant on file:///)
        if (window.VAULT_PREVIEWS && window.VAULT_PREVIEWS[file.path]) {
            codeEl.textContent = window.VAULT_PREVIEWS[file.path].text;
            codeEl.className = 'language-clike';
            if (file.ext === 'lsp') codeEl.className = 'language-lisp';
            if (window.Prism) Prism.highlightElement(codeEl);
            showLoading(false);
            return;
        }

        try {
            const res = await fetch(encodeURI(file.path));
            const text = await res.text();

            // Detect binary garbage in case an unclassified binary was routed here
            if (text.includes('\0') || (text.slice(0, 1000).split('').filter(c => c.charCodeAt(0) < 9 || (c.charCodeAt(0) > 13 && c.charCodeAt(0) < 32)).length > 10)) {
                renderBinaryAsset(file, (file.ext ? file.ext.toUpperCase() : 'Binary') + ' Asset', 'fas fa-file-code icon-code', 'Binary format file. Download to view in its native application.');
                return;
            }

            codeEl.textContent = text;
            codeEl.className = 'language-clike';
            if (file.ext === 'lsp') codeEl.className = 'language-lisp';
            if (file.ext === 'py') codeEl.className = 'language-python';
            if (file.ext === 'json') codeEl.className = 'language-json';

            if (window.Prism && text.length <= 250000) {
                Prism.highlightElement(codeEl);
            }
        } catch (err) {
            console.error('Error rendering code:', err);
            codeEl.textContent = 'Failed to load script content: ' + err.message;
        } finally {
            showLoading(false);
        }
    }

    // ==========================================
    // 6. IMAGE RENDERER
    // ==========================================
    function renderImageFile(file) {
        activateStage('imageStage', 'flex');
        const img = document.getElementById('imageViewerEl');
        if (img) {
            img.src = encodeURI(file.path);
        }
        showLoading(false);
    }

    // ==========================================
    // 7. AUTOCAD DWG ASSET RENDERER
    // ==========================================
    function renderDwgAsset(file) {
        activateStage('binaryStage', 'flex');

        document.getElementById('binaryTitle').textContent = file.name;
        document.getElementById('binaryType').textContent = 'AutoCAD DWG Drawing';
        document.getElementById('binaryIcon').className = 'binary-card-icon fas fa-drafting-compass icon-cad';
        document.getElementById('binarySize').textContent = file.size;
        document.getElementById('binaryFolder').textContent = file.folder || 'Root';

        // Check for companion DXF or PDF
        let companionDxf = null;
        if (vaultData && vaultData.files) {
            const dxfName = file.name.replace(/\.dwg$/i, '.dxf');
            companionDxf = vaultData.files.find(f => f.name.toLowerCase() === dxfName.toLowerCase());
            if (!companionDxf && file.name.toLowerCase().includes('master')) {
                companionDxf = vaultData.files.find(f => f.name.includes('COLUMN LAYOUT.dxf')) || vaultData.files.find(f => f.ext === 'dxf');
            }
        }

        let descHtml = 'Autodesk AutoCAD native DWG binary model container. You can download the native CAD drawing directly for full editing in Autodesk AutoCAD or Civil 3D.';
        if (companionDxf) {
            descHtml += `<br><br><span style="color: var(--vault-gold-bright); font-size: 0.82rem;"><i class="fas fa-lightbulb"></i> Tip: Interactive vector DXF sheets for this structural model are available in the vault!</span>`;
        }
        document.getElementById('binaryDesc').innerHTML = descHtml;

        const dl = document.getElementById('binaryDownloadBtn');
        if (dl) {
            dl.href = '#';
            dl.onclick = function (e) {
                e.preventDefault();
                window.vaultTriggerSecureDownload(file.path, file.name);
            };
        }

        showLoading(false);
    }

    // ==========================================
    // 8. GENERIC BINARY / ASSET CARD
    // ==========================================
    function renderBinaryAsset(file, title, iconClass, description) {
        activateStage('binaryStage', 'flex');

        document.getElementById('binaryTitle').textContent = file.name;
        document.getElementById('binaryType').textContent = title;
        document.getElementById('binaryIcon').className = 'binary-card-icon ' + iconClass;
        document.getElementById('binaryDesc').innerHTML = description;
        document.getElementById('binarySize').textContent = file.size;
        document.getElementById('binaryFolder').textContent = file.folder || 'Root';

        const dl = document.getElementById('binaryDownloadBtn');
        if (dl) {
            dl.href = '#';
            dl.onclick = function (e) {
                e.preventDefault();
                window.vaultTriggerSecureDownload(file.path, file.name);
            };
        }

        showLoading(false);
    }

    function escapeHtml(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // ==========================================
    // 9. SECURITY PASSCODE DIALER MODAL
    // ==========================================
    let secDownloadTarget = { path: '', name: '' };
    let secCurrentPin = '';
    let secKeydownHandler = null;

    window.vaultTriggerSecureDownload = function (filePath, fileName) {
        secDownloadTarget = { path: filePath, name: fileName };
        secCurrentPin = '';

        const modal = document.getElementById('vaultSecurityModal');
        const nameEl = document.getElementById('vaultSecFileName');
        const pinEl = document.getElementById('vaultSecPinDisplay');
        const errEl = document.getElementById('vaultSecErrorMsg');

        if (nameEl) nameEl.textContent = fileName || 'project_asset';
        if (pinEl) {
            pinEl.className = 'vault-sec-pin-display';
            pinEl.innerHTML = '<span class="vault-sec-pin-placeholder">Enter Passcode</span>';
            pinEl.style.borderColor = '';
            pinEl.style.color = '';
        }
        if (errEl) {
            errEl.textContent = '';
            errEl.style.display = 'none';
        }

        if (modal) {
            modal.classList.add('active');
        }

        // Bind keyboard listener once
        if (!secKeydownHandler) {
            secKeydownHandler = function (e) {
                const secModal = document.getElementById('vaultSecurityModal');
                if (!secModal || !secModal.classList.contains('active')) return;

                if (e.key >= '0' && e.key <= '9') {
                    e.preventDefault();
                    window.vaultDialDigit(e.key);
                } else if (e.key === 'Backspace') {
                    e.preventDefault();
                    window.vaultDialBackspace();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    window.vaultCloseSecurityModal();
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    window.vaultVerifyPasscode();
                }
            };
            window.addEventListener('keydown', secKeydownHandler);
        }
    };

    window.vaultCloseSecurityModal = function () {
        const modal = document.getElementById('vaultSecurityModal');
        if (modal) {
            modal.classList.remove('active');
        }
        secCurrentPin = '';
    };

    window.vaultDialDigit = function (digit) {
        if (secCurrentPin.length >= 8) return;
        secCurrentPin += digit;
        updatePinDisplay();
        clearPinError();
    };

    window.vaultDialClear = function () {
        secCurrentPin = '';
        updatePinDisplay();
        clearPinError();
    };

    window.vaultDialBackspace = function () {
        if (secCurrentPin.length > 0) {
            secCurrentPin = secCurrentPin.slice(0, -1);
            updatePinDisplay();
            clearPinError();
        }
    };

    function updatePinDisplay() {
        const pinEl = document.getElementById('vaultSecPinDisplay');
        if (!pinEl) return;

        if (secCurrentPin.length === 0) {
            pinEl.innerHTML = '<span class="vault-sec-pin-placeholder">Enter Passcode</span>';
            pinEl.classList.remove('focus');
        } else {
            pinEl.classList.add('focus');
            pinEl.innerHTML = secCurrentPin.split('').map(d => `<span style="display:inline-block; margin:0 4px; font-family: monospace;">${d}</span>`).join('');
        }
    }

    function clearPinError() {
        const errEl = document.getElementById('vaultSecErrorMsg');
        const pinEl = document.getElementById('vaultSecPinDisplay');
        if (errEl) {
            errEl.textContent = '';
            errEl.style.display = 'none';
        }
        if (pinEl) {
            pinEl.classList.remove('shake');
            pinEl.style.borderColor = '';
        }
    }

    window.vaultTriggerDownloadCurrent = function () {
        if (activeFile) {
            window.vaultTriggerSecureDownload(activeFile.path, activeFile.name);
        } else {
            const fallback = (vaultData && vaultData.files) ? (vaultData.files.find(f => f.name.includes('PROJECT STAGE 1 DOCUMENTATION.pdf')) || vaultData.files[0]) : null;
            if (fallback) {
                window.vaultTriggerSecureDownload(fallback.path, fallback.name);
            }
        }
    };

    window.vaultVerifyPasscode = async function () {
        const pinEl = document.getElementById('vaultSecPinDisplay');
        const errEl = document.getElementById('vaultSecErrorMsg');

        if (secCurrentPin === '0') {
            // SUCCESS - Authorized
            if (pinEl) {
                pinEl.style.borderColor = '#22c55e';
                pinEl.style.color = '#22c55e';
                pinEl.innerHTML = '<i class="fas fa-check-circle" style="color:#22c55e; margin-right:6px;"></i> Verified';
            }
            if (errEl) {
                errEl.style.display = 'block';
                errEl.style.color = '#22c55e';
                errEl.innerHTML = '<i class="fas fa-circle-check"></i> Security Passcode Accepted! Downloading...';
            }

            const targetPath = secDownloadTarget.path;
            const targetName = secDownloadTarget.name || 'download';

            // High-reliability dual method download:
            // 1. Fetch as Blob & use ObjectURL (forces direct file download in all modern browsers)
            let downloaded = false;
            try {
                const encodedPath = encodeURI(targetPath);
                const resp = await fetch(encodedPath);
                if (resp.ok) {
                    const blob = await resp.blob();
                    const blobUrl = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.style.display = 'none';
                    link.href = blobUrl;
                    link.setAttribute('download', targetName);
                    document.body.appendChild(link);
                    link.click();
                    setTimeout(() => {
                        window.URL.revokeObjectURL(blobUrl);
                        link.remove();
                    }, 2000);
                    downloaded = true;
                }
            } catch (fetchErr) {
                console.warn('Direct blob download fallback to standard link', fetchErr);
            }

            // 2. Direct anchor fallback if Blob fetch was blocked or failed
            if (!downloaded) {
                const link = document.createElement('a');
                link.style.display = 'none';
                link.href = encodeURI(targetPath);
                link.setAttribute('download', targetName);
                link.setAttribute('target', '_blank');
                document.body.appendChild(link);
                link.click();
                setTimeout(() => link.remove(), 1000);
            }

            // Auto-close modal after brief delay
            setTimeout(() => {
                window.vaultCloseSecurityModal();
                if (pinEl) {
                    pinEl.style.borderColor = '';
                    pinEl.style.color = '';
                }
            }, 800);
        } else {
            // INVALID PASSCODE - Denied
            if (pinEl) {
                pinEl.classList.remove('shake');
                void pinEl.offsetWidth; // Trigger reflow
                pinEl.classList.add('shake');
                pinEl.style.borderColor = '#ef4444';
                pinEl.style.color = '#ef4444';
                setTimeout(() => {
                    if (pinEl && secCurrentPin !== '0') {
                        pinEl.style.borderColor = '';
                        pinEl.style.color = '';
                    }
                }, 600);
            }
            if (errEl) {
                errEl.style.display = 'block';
                errEl.style.color = '#f87171';
                errEl.innerHTML = '<i class="fas fa-circle-xmark"></i> Access Denied: Invalid security passcode.';
            }
        }
    };

    // Close when clicking modal backdrop outside dialog
    document.addEventListener('click', function (e) {
        const modal = document.getElementById('vaultSecurityModal');
        if (modal && e.target === modal) {
            window.vaultCloseSecurityModal();
        }
    });
})();

