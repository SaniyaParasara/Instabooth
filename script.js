/* ==========================================================================
   MODULE: INSTABOOTH MASTER CONTROLLER (CLIENT-SIDE)
   Project: Instabooth
   Version: 4.2 (Added Exit Navigation)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

    /* --- 0. INITIALIZATION --- */
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // Audio Context (Shutter Sound)
    const shutterSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3'); 
    shutterSound.volume = 0.5;

    /* --- 1. DOM ELEMENTS --- */
    const getEl = (id) => document.getElementById(id);
    
    const cursor = getEl('cursor');
    const appContainer = getEl('app-container');
    const landingPage = document.querySelector('main');

    // Screens
    const screens = {
        layout: getEl('screen-layout'),
        camera: getEl('screen-camera'),
        editor: getEl('screen-editor')
    };

    // UI Components
    const els = {
        video: getEl('video-feed'),
        canvas: getEl('final-canvas'),
        filmStrip: getEl('film-strip'),
        assetsGrid: getEl('assets-grid'),
        filtersList: getEl('filters-list'),
        activeFilterLabel: getEl('active-filter-name'),
        fileInput: getEl('file-input'),
        shutterBtn: getEl('btn-shutter'),
        nextBtn: getEl('btn-next'),
        instruction: getEl('instruction-text'),
        countNeeded: getEl('photo-count-needed'),
        filterBtn: getEl('btn-filter'),
        editorModal: getEl('editor-modal'),
        previewModal: getEl('preview-modal'),
        cropImage: getEl('image-to-crop'),
        previewImage: getEl('preview-image'),
        flash: getEl('flash'),
        countdownOverlay: getEl('countdown-overlay'),
        countdownText: getEl('countdown-text'),
        cameraControls: getEl('camera-controls'),
        appContainer: appContainer // Expose explicitly
    };

    /* --- 2. STATE MANAGEMENT --- */
    const state = {
        layout: 'layout-a',
        photos: [],
        currentFrame: 'ios-light',
        currentFilter: 'normal',
        inkMode: false,
        cameraStream: null,
        isGrayscale: false,
        isSessionActive: false,
        cropper: null,
        editIndex: -1,
        viewIndex: -1
    };

    /* --- 3. CONFIG: LAYOUTS (COORDINATE SYSTEM) --- */
    const layoutConfig = {
        'layout-a': { 
            count: 3, w: 600, h: 1800, 
            slots: [
                { x: 50, y: 150, w: 500, h: 450 }, 
                { x: 50, y: 650, w: 500, h: 450 }, 
                { x: 50, y: 1150, w: 500, h: 450 }
            ]
        },
        'layout-b': { 
            count: 4, w: 600, h: 1800, 
            slots: [
                { x: 40, y: 40, w: 520, h: 380 },
                { x: 40, y: 460, w: 520, h: 380 },
                { x: 40, y: 880, w: 520, h: 380 },
                { x: 40, y: 1300, w: 520, h: 380 }
            ]
        },
        'layout-c': { 
            count: 4, w: 1200, h: 1800, 
            slots: [
                { x: 60, y: 60, w: 520, h: 800 }, { x: 620, y: 60, w: 520, h: 800 },
                { x: 60, y: 940, w: 520, h: 800 }, { x: 620, y: 940, w: 520, h: 800 }
            ]
        },
        'layout-d': { 
            count: 1, w: 1200, h: 1500, 
            slots: [
                { x: 80, y: 80, w: 1040, h: 1040 } 
            ]
        }
    };

    /* --- 4. CONFIG: FILTERS --- */
    const filters = {
        'normal': { name: 'Normal', val: 'none' },
        'bw':     { name: 'B & W', val: 'grayscale(100%) contrast(1.15)' },
        'bright': { name: 'Bright', val: 'brightness(1.2) contrast(1.1) saturate(1.1)' },
        'warm':   { name: 'Warm', val: 'sepia(0.35) contrast(1.1) brightness(1.1) saturate(1.2)' },
        'cool':   { name: 'Cool', val: 'contrast(1.1) brightness(1.1) sepia(0.3) hue-rotate(190deg) saturate(0.9)' },
        'vintage':{ name: 'Vintage', val: 'sepia(0.5) contrast(1.2) brightness(0.9) saturate(0.9)' },
        'vivid':  { name: 'Vivid', val: 'saturate(1.8) contrast(1.2) brightness(1.05)' },
        'soft':   { name: 'Soft Glow', val: 'brightness(1.15) contrast(0.85) saturate(1.05)' }
    };

    /* --- 5. CONFIG: TEMPLATES --- */
    const templates = {
        'ios': [
            { id: 'ios-light', name: 'Bright Mode', type: 'color', val: '#ffffff' }, 
            { id: 'ios-dark', name: 'Dark Mode', type: 'color', val: '#18181b' },
        ],
        'mono': [
            { id: 'mono-cow', name: 'Moo Print', type: 'pattern', val: './assets/cow-pattern.jpg', border: false },
            { id: 'mono-check', name: 'Checkers', type: 'pattern', val: './assets/checker-pattern.jpg', border: false },
        ],
        'pastel': [
            { id: 'pastel-pink', name: 'Soft Pink', type: 'pattern', val: './assets/pastel-pink.png', border: false },
            { id: 'pastel-blue', name: 'Sky Blue', type: 'pattern', val: './assets/pastel-blue.png', border: false },
        ],
        'analog': [
            { id: 'film-tape', name: 'Vintage', type: 'pattern', val: './assets/vintage-paper.jpg', border: false },
            { id: 'film-strip', name: 'Vintage', type: 'pattern', val: './assets/film-strip.jpg', border: false },
            { id: 'news-strip', name: 'Sky Blue', type: 'pattern', val: './assets/news-strip.jpg', border: false },
            { id: 'letter-strip', name: 'Sky Blue', type: 'pattern', val: './assets/letter-strip.jpg', border:false },
        ]
    };

    /* =========================================
       PART 1: NAVIGATION
       ========================================= */
    
    // START APP
    window.startApp = () => {
        if(landingPage) {
            landingPage.style.transition = "opacity 0.5s ease";
            landingPage.style.opacity = "0";
            setTimeout(() => {
                landingPage.style.display = "none";
                els.appContainer.classList.remove('hidden');
                els.appContainer.classList.add('flex');
                setTimeout(() => els.appContainer.style.opacity = "1", 50);
            }, 500);
        } else {
            els.appContainer.classList.remove('hidden');
            els.appContainer.classList.add('flex');
        }
    };

    // EXIT APP (BACK TO HOME) - NEW FUNCTION ADDED
    window.exitApp = () => {
        stopCamera(); // Ensure camera is off
        els.appContainer.style.transition = "opacity 0.5s ease";
        els.appContainer.style.opacity = "0";
        
        setTimeout(() => {
            els.appContainer.classList.add('hidden');
            els.appContainer.classList.remove('flex');
            
            if(landingPage) {
                landingPage.style.display = "block";
                setTimeout(() => {
                    landingPage.style.opacity = "1";
                }, 50);
            }
        }, 500);
    };

    window.selectLayout = (id) => {
        state.layout = id;
        const count = layoutConfig[id].count;
        state.photos = new Array(count).fill(null);
        
        switchScreen('camera');
        renderFilmStrip();
        startCamera();
    };

    window.goToEditor = () => {
        const hasPhotos = state.photos.some(p => p !== null);
        if(!hasPhotos && !confirm("No photos taken. Continue?")) return;

        stopCamera();
        switchScreen('editor');
        switchTab('ios'); 
        renderFilters(); 
        setTimeout(drawCanvas, 100); 
    };

    window.restartApp = () => {
        if(confirm("Start a new session?")) {
            stopCamera();
            switchScreen('layout');
        }
    };

    function switchScreen(name) {
        Object.values(screens).forEach(s => {
            if(s) { s.classList.add('hidden'); s.classList.remove('flex'); }
        });
        if(screens[name]) {
            screens[name].classList.remove('hidden');
            screens[name].classList.add('flex');
        }
    }

    /* =========================================
       PART 2: CAMERA STUDIO
       ========================================= */
    
    async function startCamera() {
        if (state.cameraStream) return; 
        try {
            state.cameraStream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: "user", width: { ideal: 1920 }, height: { ideal: 1080 } }, 
                audio: false 
            });
            if(els.video) {
                els.video.srcObject = state.cameraStream;
                els.video.play();
            }
        } catch (err) {
            console.error("Camera Error:", err);
            alert("Camera access denied.");
        }
    }

    function stopCamera() {
        if (state.cameraStream) {
            state.cameraStream.getTracks().forEach(track => track.stop());
            state.cameraStream = null;
        }
    }

    window.stopCameraAndBack = () => { stopCamera(); switchScreen('layout'); };

    window.toggleFilter = () => {
        state.isGrayscale = !state.isGrayscale;
        if(els.video) els.video.classList.toggle('grayscale', state.isGrayscale);
    };

    window.startSession = async () => {
        if (state.isSessionActive) return;
        state.isSessionActive = true;
        els.cameraControls.classList.add('opacity-0', 'pointer-events-none');

        let nextSlot = state.photos.findIndex(p => p === null);
        
        while (nextSlot !== -1 && state.isSessionActive) {
            renderFilmStrip(); 
            highlightActiveSlot(nextSlot);
            
            const slotEl = els.filmStrip.children[nextSlot];
            if(slotEl) slotEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

            await runCountdown();
            await capturePhoto(nextSlot);
            
            await new Promise(r => setTimeout(r, 800)); 
            nextSlot = state.photos.findIndex(p => p === null);
        }

        state.isSessionActive = false;
        els.cameraControls.classList.remove('opacity-0', 'pointer-events-none');
        renderFilmStrip();
    };

    function highlightActiveSlot(index) {
        const slots = els.filmStrip.children;
        Array.from(slots).forEach(s => s.classList.remove('ring-4', 'ring-indigo-500'));
        if(slots[index]) slots[index].classList.add('ring-4', 'ring-indigo-500');
    }

    function runCountdown() {
        return new Promise(resolve => {
            els.countdownOverlay.classList.remove('hidden');
            let count = 3;
            els.countdownText.innerText = count;
            const timer = setInterval(() => {
                count--;
                if (count > 0) els.countdownText.innerText = count;
                else {
                    clearInterval(timer);
                    els.countdownOverlay.classList.add('hidden');
                    resolve();
                }
            }, 1000);
        });
    }

    function capturePhoto(index) {
        return new Promise(resolve => {
            if(els.flash) {
                els.flash.style.opacity = "1";
                setTimeout(() => els.flash.style.opacity = "0", 150);
            }
            shutterSound.play().catch(e => console.log(e));

            const canvas = document.createElement('canvas');
            canvas.width = els.video.videoWidth;
            canvas.height = els.video.videoHeight;
            const ctx = canvas.getContext('2d');
            
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            if(state.isGrayscale) ctx.filter = 'grayscale(100%)';
            ctx.drawImage(els.video, 0, 0);

            state.photos[index] = canvas.toDataURL('image/png', 1.0);
            renderFilmStrip();
            resolve();
        });
    }

    /* =========================================
       PART 3: SIDEBAR UI
       ========================================= */
    function renderFilmStrip() {
        if(!els.filmStrip) return;
        els.filmStrip.innerHTML = '';
        let remaining = 0;

        state.photos.forEach((img, index) => {
            const slot = document.createElement('div');
            if (img) {
                slot.className = "relative w-full aspect-[4/3] bg-white rounded-xl overflow-hidden shadow-md cursor-pointer";
                slot.innerHTML = `<img src="${img}" class="w-full h-full object-cover ${state.isGrayscale?'grayscale':''}">`;
                slot.onclick = () => openPreview(index);
            } else {
                remaining++;
                slot.className = "relative w-full aspect-[4/3] bg-white rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center";
                slot.innerHTML = `<span class="text-gray-300 font-bold">${index + 1}</span>`;
            }
            els.filmStrip.appendChild(slot);
        });

        if(els.instruction) {
            if (remaining === 0) {
                els.instruction.classList.add('hidden');
                els.nextBtn.classList.remove('hidden');
                els.nextBtn.classList.add('flex');
                els.shutterBtn.classList.add('hidden');
            } else {
                els.instruction.classList.remove('hidden');
                els.countNeeded.innerText = remaining;
                els.nextBtn.classList.add('hidden');
                els.nextBtn.classList.remove('flex');
                els.shutterBtn.classList.remove('hidden');
            }
        }
    }

    /* =========================================
       PART 4: UPLOAD & EDITING
       ========================================= */
    if (els.fileInput) {
        els.fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const nextSlot = state.photos.findIndex(p => p === null);
            if (nextSlot === -1) { alert("Layout full!"); return; }
            const reader = new FileReader();
            reader.onload = (evt) => openEditorModal(evt.target.result, nextSlot);
            reader.readAsDataURL(file);
        });
    }

    function openEditorModal(src, index) {
        state.editIndex = index;
        els.cropImage.src = src;
        els.editorModal.classList.remove('hidden');
        els.editorModal.classList.add('flex');
        if (state.cropper) state.cropper.destroy();
        setTimeout(() => {
            state.cropper = new Cropper(els.cropImage, { viewMode: 1, autoCropArea: 1, rotatable: true });
        }, 100);
    }

    window.saveEdit = () => {
        if (!state.cropper) return;
        state.photos[state.editIndex] = state.cropper.getCroppedCanvas({width: 1280}).toDataURL('image/png');
        state.cropper.destroy(); state.cropper = null;
        els.editorModal.classList.add('hidden'); els.editorModal.classList.remove('flex');
        renderFilmStrip();
        if (!screens.editor.classList.contains('hidden')) drawCanvas();
    };

    window.cancelEdit = () => {
        if (state.cropper) state.cropper.destroy();
        els.editorModal.classList.add('hidden'); els.editorModal.classList.remove('flex');
    };

    window.startEditingFromPreview = () => {
        if (state.viewIndex > -1) {
            window.closePreview();
            openEditorModal(state.photos[state.viewIndex], state.viewIndex);
        }
    };

    window.openPreview = (index) => {
        state.viewIndex = index;
        els.previewImage.src = state.photos[index];
        els.previewModal.classList.remove('hidden');
        els.previewModal.classList.add('flex');
    };

    window.closePreview = () => {
        els.previewModal.classList.add('hidden');
        els.previewModal.classList.remove('flex');
    };

    window.deleteCurrentPhoto = () => {
        if (state.viewIndex > -1 && confirm("Delete photo?")) {
            state.photos[state.viewIndex] = null;
            window.closePreview();
            renderFilmStrip();
            if (!screens.editor.classList.contains('hidden')) drawCanvas();
        }
    };


    /* =========================================
       PART 5: THE AUTO-PATTERN ENGINE (WITH FILTERS)
       ========================================= */
    
    window.drawCanvas = async () => {
        if(!els.canvas) return;

        const ctx = els.canvas.getContext('2d');
        const spec = layoutConfig[state.layout];
        const frame = getFrameStyle(state.currentFrame);
        const filterVal = filters[state.currentFilter].val;

        // 1. Setup Canvas
        els.canvas.width = spec.w;
        els.canvas.height = spec.h;

        // 2. DRAW LAYER 1: BACKGROUND (Pattern or Color)
        ctx.filter = 'none';
        
        if (frame.type === 'pattern' && frame.val) {
            try {
                const patImg = await loadImage(frame.val);
                drawCover(ctx, patImg, 0, 0, spec.w, spec.h);
            } catch (e) {
                console.error("Failed to load pattern:", frame.val, e);
                ctx.fillStyle = '#eeeeee'; 
                ctx.fillRect(0, 0, spec.w, spec.h);
            }
        } else {
            ctx.fillStyle = frame.val || '#ffffff';
            ctx.fillRect(0, 0, spec.w, spec.h);
        }

        // 3. DRAW LAYER 2: PHOTOS ON TOP
        if (spec.slots) {
            for (let i = 0; i < spec.slots.length; i++) {
                if (i >= state.photos.length) break;
                
                const photoSrc = state.photos[i];
                if (photoSrc) {
                    try {
                        const img = await loadImage(photoSrc);
                        const slot = spec.slots[i];

                        // Optional: Draw White Border (Layer 2.1)
                        ctx.filter = 'none';
                        if (frame.border) {
                            const borderSize = 15; 
                            ctx.fillStyle = '#ffffff';
                            ctx.fillRect(
                                slot.x - borderSize, 
                                slot.y - borderSize, 
                                slot.w + (borderSize * 2), 
                                slot.h + (borderSize * 2)
                            );
                        }
                        
                        // Draw Photo (Layer 2.2)
                        ctx.filter = filterVal;
                        drawCover(ctx, img, slot.x, slot.y, slot.w, slot.h);

                    } catch (e) {
                        console.error("Image render fail:", e);
                    }
                }
            }
        }

        // 4. Layer 3: Ink Filter / Overlays
        ctx.filter = 'none';
        if (state.inkMode) applyHalftone(ctx, spec.w, spec.h);
    };

    // --- CANVAS HELPERS ---

    function getFrameStyle(id) {
        for(const cat in templates) {
            const found = templates[cat].find(f => f.id === id);
            if(found) return found;
        }
        return templates['ios'][0];
    }

    function loadImage(src) {
        return new Promise(r => { 
            const i = new Image(); 
            i.crossOrigin = "Anonymous"; 
            i.onload = () => r(i); 
            i.onerror = () => r(null); 
            i.src = src; 
        });
    }

    function drawCover(ctx, img, x, y, w, h) {
        if(!img) return;
        const ratio = w / h;
        const imgRatio = img.width / img.height;
        let sx, sy, sWidth, sHeight;

        if (imgRatio > ratio) {
            sHeight = img.height;
            sWidth = img.height * ratio;
            sx = (img.width - sWidth) / 2;
            sy = 0;
        } else {
            sWidth = img.width;
            sHeight = img.width / ratio;
            sx = 0;
            sy = (img.height - sHeight) / 2;
        }
        ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, w, h);
    }

    function applyHalftone(ctx, w, h) {
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
            const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
            const val = avg > 120 ? 255 : 0; 
            data[i] = val; 
            data[i+1] = val; 
            data[i+2] = val;
        }
        ctx.putImageData(imgData, 0, 0);
    }


    /* =========================================
       PART 6: EDITOR UI (FRAMES & FILTERS)
       ========================================= */
    
    // 1. FRAME TABS & GRID
    window.switchTab = (category) => {
        if(els.filtersList && els.filtersList.innerHTML === '') renderFilters();

        document.querySelectorAll('.tab-btn').forEach(btn => {
            const isActive = btn.textContent.toLowerCase().includes(category) || 
                           (category === 'analog' && btn.textContent.includes('FILM'));
            if(isActive) {
                btn.classList.add('text-indigo-600', 'border-indigo-600');
                btn.classList.remove('text-gray-400', 'border-transparent');
            } else {
                btn.classList.remove('text-indigo-600', 'border-indigo-600');
                btn.classList.add('text-gray-400', 'border-transparent');
            }
        });

        els.assetsGrid.innerHTML = '';
        templates[category].forEach(item => {
            const btn = document.createElement('button');
            btn.className = "aspect-square rounded-lg border-2 transition-all relative group overflow-hidden shadow-sm bg-gray-50";
            
            if(item.type === 'pattern' && item.val) {
                btn.innerHTML = `<img src="${item.val}" class="w-full h-full object-cover">`;
            } else {
                btn.style.backgroundColor = item.val || item.bgColor || '#eee';
            }

            if (state.currentFrame === item.id) {
                btn.classList.add('border-indigo-600', 'ring-2', 'ring-indigo-600', 'ring-offset-2');
            } else {
                btn.classList.add('border-gray-200', 'hover:border-indigo-300');
            }
            
            btn.onclick = () => {
                state.currentFrame = item.id;
                switchTab(category); 
                drawCanvas();
            };
            els.assetsGrid.appendChild(btn);
        });
    };

    // 2. FILTER LIST GENERATOR
    function renderFilters() {
        if(!els.filtersList) return;
        els.filtersList.innerHTML = '';
        
        Object.keys(filters).forEach(key => {
            const f = filters[key];
            const btn = document.createElement('button');
            const isActive = state.currentFilter === key;
            
            btn.className = `flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold border transition-all whitespace-nowrap ${isActive ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`;
            btn.innerText = f.name;
            
            btn.onclick = () => { 
                state.currentFilter = key; 
                if(els.activeFilterLabel) els.activeFilterLabel.innerText = f.name;
                renderFilters();
                drawCanvas(); 
            };
            els.filtersList.appendChild(btn);
        });
    }

    window.toggleInkMode = () => {
        state.inkMode = !state.inkMode;
        const btn = getEl('btn-ink');
        if(btn) {
            if(state.inkMode) {
                btn.classList.add('bg-gray-800', 'text-white');
                btn.classList.remove('text-gray-500');
            } else {
                btn.classList.remove('bg-gray-800', 'text-white');
                btn.classList.add('text-gray-500');
            }
        }
        drawCanvas();
    };

    window.downloadStrip = () => {
        const link = document.createElement('a');
        link.download = `instabooth-${Date.now()}.png`;
        link.href = els.canvas.toDataURL('image/png', 1.0);
        link.click();
    };

    // --- BINDINGS ---
    if (cursor) {
        document.addEventListener('mousemove', (e) => {
            cursor.style.transform = `translate(${e.clientX - 8}px, ${e.clientY - 8}px)`;
        });
        document.body.addEventListener('mouseover', (e) => {
            if (e.target.closest('a, button, input, .interactive, img')) {
                cursor.classList.add('scale-[2.5]', 'bg-indigo-500/10', 'border-transparent');
            }
        });
        document.body.addEventListener('mouseout', (e) => {
            if (e.target.closest('a, button, input, .interactive, img')) {
                cursor.classList.remove('scale-[2.5]', 'bg-indigo-500/10', 'border-transparent');
            }
        });
    }

    document.querySelectorAll('button').forEach(btn => {
        if(btn.textContent.includes('START CAPTURING')) {
            btn.addEventListener('click', window.startApp);
        }
    });

});