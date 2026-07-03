window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('flagCanvas');
    if (!canvas) {
        console.error("Critical Error: canvas target element with id 'flagCanvas' was not found in the DOM.");
        return;
    }
    const ctx = canvas.getContext('2d');
    const statusDiv = document.getElementById('status') || { set textContent(val) { console.log("Status:", val); }, set innerHTML(val) { console.log("Status HTML:", val); } };

    let starBackgroundColors = Array.from({length: 50}, () => "#1a2c42");
    let rawWebcamImage = null;
    let currentMode = "proxy-latest";
    let zoomMode = false;

    // Filter feature states
    let cloudCompensationActive = true;
    let algaeIsolationActive = true;

    // Global variable to keep track of calculated image atmospheric state
    let ambientSceneBrightness = 150;

    let config = {
        x: 0.505,
        y: 0.609,
        w: 0.018,
        h: 0.155,
        p: 2.25,
        debug: false
    };

    let archiveCatalog = {};

    // 1. Fetch catalog metadata safely for bounds checking
    fetch('./semiLivePics/catalog_registry.json')
    .then(res => res.ok ? res.json() : {})
    .then(data => {
        archiveCatalog = data;
        syncArchiveInputConstraints();
    })
    .catch(err => console.error('Catalog registry could not be resolved:', err));

    // 2. Initialize the dropdown and trigger the first image paint
    function initArchiveCatalogUI() {
        const dateSelect = document.getElementById('archiveDateSelect');
        if (!dateSelect) return;

        fetch('./history.json')
        .then(response => {
            if (!response.ok) throw new Error('Network history manifest missing');
            return response.json();
        })
        .then(dates => {
            dateSelect.innerHTML = '';

            dates.forEach(dateStr => {
                const opt = document.createElement('option');
                opt.value = dateStr;
                opt.textContent = dateStr;
                dateSelect.appendChild(opt);
            });

            syncArchiveInputConstraints();

            // 🚀 FORCE FIRST-LOAD PAINT:
            loadLatestProxyImage();
        })
        .catch(err => console.error('Error loading dynamic historical archive dropdown:', err));
    }

    // Fire the dropdown initializer immediately when the DOM content loads
    initArchiveCatalogUI();


    function syncArchiveInputConstraints() {
        const dateSelect = document.getElementById('archiveDateSelect');
        const indexInput = document.getElementById('archiveIndexInput');
        const maxLabel = document.getElementById('maxAvailableLabel');

        if (!dateSelect || !indexInput || !dateSelect.value) return;
        const chosenDate = dateSelect.value;

        // Fallback to 1 if the date entry isn't tracked in catalog registry yet
        const count = archiveCatalog[chosenDate] ? archiveCatalog[chosenDate].totalImages : 1;
        indexInput.max = count;
        if (parseInt(indexInput.value) > count) {
            indexInput.value = count;
        }
        if (maxLabel) {
            maxLabel.textContent = `of ${count} available`;
        }

        updateEstimatedTimeReadout();
    }

    function updateEstimatedTimeReadout() {
        const dateSelect = document.getElementById('archiveDateSelect');
        const indexInput = document.getElementById('archiveIndexInput');
        const metaBox = document.getElementById('archiveMetaDetails');

        if (!dateSelect || !indexInput || !metaBox || !dateSelect.value) return;
        const chosenDate = dateSelect.value;
        const index = parseInt(indexInput.value) || 1;

        // Use recorded values or default to starting at 6:00 AM D.C. local time
        const dayData = archiveCatalog[chosenDate] || { baseHour: 6, intervalMinutes: 0 };
        let totalMinutes = (dayData.baseHour * 60) + dayData.intervalMinutes + ((index - 1) * 30);
        let hr = Math.floor(totalMinutes / 60);
        let min = totalMinutes % 60;
        let ampm = hr >= 12 ? 'PM' : 'AM';
        let displayHr = hr % 12 === 0 ? 12 : hr % 12;
        let displayMin = String(min).padStart(2, '0');

        metaBox.style.display = 'block';
        metaBox.textContent = `⏰ Capture Time: ~ ${displayHr}:${displayMin} ${ampm} EDT`;
    }

    // 3. Attach interactive UI state event listeners safely
    const archiveDateEl = document.getElementById('archiveDateSelect');
    const archiveIndexEl = document.getElementById('archiveIndexInput');

    if (archiveDateEl) {
        archiveDateEl.addEventListener('change', () => {
            syncArchiveInputConstraints();
            if (currentMode === "archive-browse") {
                loadCustomArchiveTarget();
            }
        });
    }

    if (archiveIndexEl) {
        archiveIndexEl.addEventListener('input', () => {
            updateEstimatedTimeReadout();
            if (currentMode === "archive-browse") {
                loadCustomArchiveTarget();
            }
        });
    }

    function setElementValue(id, value) {
        const el = document.getElementById(id);
        if (el) el.value = value;
    }

    function setElementText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    function setElementChecked(id, checked) {
        const el = document.getElementById(id);
        if (el) el.checked = checked;
    }

    function syncSlidersToConfig() {
        setElementValue('boxX', config.x * 100);
        setElementText('valX', (config.x * 100).toFixed(1) + '%');

        setElementValue('boxY', config.y * 100);
        setElementText('valY', (config.y * 100).toFixed(1) + '%');

        setElementValue('boxW', config.w * 100);
        setElementText('valW', (config.w * 100).toFixed(1) + '%');

        setElementValue('boxH', config.h * 100);
        setElementText('valH', (config.h * 100).toFixed(1) + '%');

        setElementValue('boxP', config.p);
        setElementText('valP', config.p.toFixed(2) + 'x');

        setElementChecked('toggleDebug', config.debug);
        setElementChecked('toggleCloudComp', cloudCompensationActive);
        setElementChecked('toggleAlgaeIsolate', algaeIsolationActive);
    }

    const toggleCalibrateBtn = document.getElementById('toggleCalibrateBtn');
    if (toggleCalibrateBtn) {
        toggleCalibrateBtn.addEventListener('click', (e) => {
            const panel = document.getElementById('calibrationPanel');
            const zoomCard = document.getElementById('zoomOpticCard');

            if (panel && panel.style.display === 'none') {
                panel.style.display = 'block';
                if (zoomCard) zoomCard.style.display = 'block';

                config.debug = true;
                setElementChecked('toggleDebug', true);
                e.target.textContent = "❌ Close Calibration Panel";
                e.target.classList.add('btn-secondary');
            } else {
                if (panel) panel.style.display = 'none';
                if (zoomCard) {
                    zoomCard.style.display = 'none';
                    zoomMode = false;
                    setElementChecked('toggleZoomMode', false);
                }

                config.debug = false;
                setElementChecked('toggleDebug', false);
                e.target.textContent = "🛠️ Open Calibration Panel";
                e.target.classList.remove('btn-secondary');
            }
            drawFlag();
        });
    }

    const toggleZoomMode = document.getElementById('toggleZoomMode');
    if (toggleZoomMode) {
        toggleZoomMode.addEventListener('change', (e) => {
            zoomMode = e.target.checked;
            drawFlag();
        });
    }

    const toggleCloudComp = document.getElementById('toggleCloudComp');
    if (toggleCloudComp) {
        toggleCloudComp.addEventListener('change', (e) => {
            cloudCompensationActive = e.target.checked;
            drawFlag();
        });
    }

    const toggleAlgaeIsolate = document.getElementById('toggleAlgaeIsolate');
    if (toggleAlgaeIsolate) {
        toggleAlgaeIsolate.addEventListener('change', (e) => {
            algaeIsolationActive = e.target.checked;
            drawFlag();
        });
    }

    const inputs = [
        { id: 'boxX', key: 'x', div: 'valX', mult: 0.01, unit: '%' },
        { id: 'boxY', key: 'y', div: 'valY', mult: 0.01, unit: '%' },
        { id: 'boxW', key: 'w', div: 'valW', mult: 0.01, unit: '%' },
        { id: 'boxH', key: 'h', div: 'valH', mult: 0.01, unit: '%' },
        { id: 'boxP', key: 'p', div: 'valP', mult: 1, unit: 'x' }
    ];

    inputs.forEach(input => {
        const inputEl = document.getElementById(input.id);
        if (inputEl) {
            inputEl.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                config[input.key] = val * input.mult;
                setElementText(input.div, val.toFixed(input.id === 'boxP' ? 2 : 1) + input.unit);
                drawFlag();
            });
        }
    });

    function handleSourceViewToggle(val) {
        const archivePicker = document.getElementById('archivePickerContainer');
        currentMode = val;

        if (val === 'archive-browse') {
            if (archivePicker) archivePicker.style.display = 'block';
            setElementText('valSource', "📅 Historical Archive Mode");
            const valSourceEl = document.getElementById('valSource');
            if (valSourceEl) valSourceEl.className = "badge bg-info text-dark";
            syncArchiveInputConstraints();
            loadCustomArchiveTarget();
        } else {
            if (archivePicker) archivePicker.style.display = 'none';
            setElementText('valSource', "🟢 Latest Local Capture");
            const valSourceEl = document.getElementById('valSource');
            if (valSourceEl) valSourceEl.className = "badge bg-success";
            loadLatestProxyImage();
        }
    }

    const sourceSelector = document.getElementById('sourceSelector');
    if (sourceSelector) {
        sourceSelector.addEventListener('change', (e) => {
            handleSourceViewToggle(e.target.value);
        });
    }

    function loadCustomArchiveTarget() {
        const dateSelect = document.getElementById('archiveDateSelect');
        const indexInput = document.getElementById('archiveIndexInput');
        if (!dateSelect || !indexInput || !dateSelect.value) return;

        const chosenDate = dateSelect.value;
        const chosenIndex = indexInput.value;

        const subfolderFile = `archive-${chosenDate}_${chosenIndex}.jpg`;
        statusDiv.textContent = `Probing asset path: semiLivePics/${subfolderFile}...`;

        const img = new Image();
        img.src = `./semiLivePics/${subfolderFile}`;

        img.onload = function() {
            rawWebcamImage = img;
            statusDiv.textContent = `Loaded historical snapshot file successfully: semiLivePics/${subfolderFile}`;
            drawFlag();
        };

        img.onerror = function() {
            const alternatives = [
                `./archive-${chosenDate}.jpg`,
                `./archive-${chosenDate}-.jpg`,
                `./semiLivePics/archive-${chosenDate}.jpg`
            ];

            let altIndex = 0;
            function tryNextAlternative() {
                if (altIndex >= alternatives.length) {
                    statusDiv.innerHTML = `<span style="color: #f85149;">❌ Error: Target file could not be resolved across standard path locations.</span>`;
                    return;
                }
                const path = alternatives[altIndex++];
                statusDiv.textContent = `Retrying location: ${path}...`;
                const altImg = new Image();
                altImg.src = path;
                altImg.onload = function() {
                    rawWebcamImage = altImg;
                    statusDiv.textContent = `Loaded historical asset from alternative fallback: ${path}`;
                    drawFlag();
                };
                altImg.onerror = tryNextAlternative;
            }
            tryNextAlternative();
        };
    }

    const toggleDebug = document.getElementById('toggleDebug');
    if (toggleDebug) {
        toggleDebug.addEventListener('change', (e) => { config.debug = e.target.checked; drawFlag(); });
    }

    let isProbing = false;

    function loadLatestProxyImage() {
        if (currentMode !== "proxy-latest" || isProbing) return;
        isProbing = true;
        statusDiv.textContent = "Scanning workspace folders for latest snapshot capture...";

        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        let latestValidSrc = null;
        let lastValidIndex = 0;
        let currentCheckIndex = 1;

        function probeNextIndex() {
            if (currentMode !== "proxy-latest") {
                isProbing = false;
                return;
            }

            if (currentCheckIndex > 15) {
                finalizeLoad();
                return;
            }

            const testImg = new Image();
            const targetSrc = `./semiLivePics/archive-${todayStr}_${currentCheckIndex}.jpg?t=${Date.now()}`;

            testImg.onload = function() {
                latestValidSrc = targetSrc;
                lastValidIndex = currentCheckIndex;

                currentCheckIndex++;
                probeNextIndex();
            };
            testImg.onerror = function() {
                finalizeLoad();
            };
            testImg.src = targetSrc;
        }

        function finalizeLoad() {
            isProbing = false;
            if (latestValidSrc) {
                rawWebcamImage = new Image();
                rawWebcamImage.src = latestValidSrc;
                rawWebcamImage.onload = function() {
                    statusDiv.textContent = `Displaying proxy snapshot: archive-${todayStr}_${lastValidIndex}.jpg`;
                    drawFlag();
                };
            } else {
                loadYesterdayFallback();
            }
        }

        function loadYesterdayFallback() {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

            const fallbackImg = new Image();
            fallbackImg.src = `./semiLivePics/archive-${yesterdayStr}_1.jpg`;
            fallbackImg.onload = function() {
                if (currentMode !== "proxy-latest") return;
                rawWebcamImage = fallbackImg;
                statusDiv.textContent = `No captures found for today yet. Loaded fallback: archive-${yesterdayStr}_1.jpg`;
                drawFlag();
            };
            fallbackImg.onerror = function() {
                statusDiv.textContent = "⚠️ Could not resolve current or fallback image assets.";
            }
        }

        probeNextIndex();
    }

    /**
     * Smart Atmospheric Color Pipeline Engine
     */
    function runColorCorrectionPipeline(r, g, b) {
        if (cloudCompensationActive) {
            const applySmartContrast = (val) => {
                let norm = val / 255;
                norm = 1 / (1 + Math.exp(-8 * (norm - 0.5)));
                return val + (norm * 255 - val) * 0.5;
            };

            r = applySmartContrast(r);
            g = applySmartContrast(g);
            b = applySmartContrast(b);

            if (ambientSceneBrightness < 160) {
                const warmthFactor = (160 - ambientSceneBrightness) / 160;
                r = Math.min(255, r * (1.02 + warmthFactor * 0.04));
                g = Math.min(255, g * (1.01 + warmthFactor * 0.02));
                b = Math.min(255, b * 0.95);
            }
        }

        if (algaeIsolationActive) {
            if (g > r && g > b) {
                g = Math.min(255, g * 1.25);
                r *= 0.85;
                b *= 0.85;
            } else {
                r *= 0.9;
                b *= 0.95;
            }
        }
        return [Math.max(0, Math.min(255, r)), Math.max(0, Math.min(255, g)), Math.max(0, Math.min(255, b))];
    }

    function get50StarColorsFromTrapezoid(sCtx, imgW, imgH) {
        try {
            const sampleWidth = Math.floor(imgW * 0.2);
            const sampleHeight = Math.floor(imgH * 0.2);
            const ambientData = sCtx.getImageData(Math.floor(imgW * 0.4), Math.floor(imgH * 0.2), sampleWidth, sampleHeight).data;
            let totalLum = 0;
            let sampleCount = 0;
            for (let i = 0; i < ambientData.length; i += 40) {
                totalLum += (ambientData[i] + ambientData[i+1] + ambientData[i+2]) / 3;
                sampleCount++;
            }
            ambientSceneBrightness = totalLum / sampleCount;
        } catch (e) {
            ambientSceneBrightness = 150;
        }

        const colors = [];
        const baseStartX = imgW * config.x;
        const baseStartY = imgH * config.y;
        const targetW = imgW * config.w;
        const targetH = imgH * config.h;

        for (let row = 1; row <= 9; row++) {
            const progress = (row - 1) / 8;
            const currentRowWidth = targetW * (1 + progress * (config.p - 1));
            const widthDifference = currentRowWidth - targetW;
            const rowStartX = baseStartX - (widthDifference / 2);

            const xSpacing = currentRowWidth / 12;
            const ySpacing = targetH / 10;

            const isEvenRow = (row % 2 === 0);
            const starsInRow = isEvenRow ? 5 : 6;
            const starRowLeftEdge = rowStartX + (isEvenRow ? xSpacing * 2 : xSpacing);
            const pixelY = Math.floor(baseStartY + (row * ySpacing));

            for (let col = 0; col < starsInRow; col++) {
                const pixelX = Math.floor(starRowLeftEdge + (col * xSpacing * 2));
                const safeX = Math.max(0, Math.min(imgW - 1, pixelX));
                const safeY = Math.max(0, Math.min(imgH - 1, pixelY));

                try {
                    const pixel = sCtx.getImageData(safeX, safeY, 1, 1).data;
                    const corrected = runColorCorrectionPipeline(pixel[0], pixel[1], pixel[2]);
                    colors.push(`rgb(${corrected[0]}, ${corrected[1]}, ${corrected[2]})`);
                } catch(e) {
                    colors.push("#1a2c42");
                }
            }
        }
        return colors;
    }

    function drawActualStar(cx, cy, spikes, outerRadius, innerRadius) {
        let rot = Math.PI / 2 * 3, x = cx, y = cy, step = Math.PI / spikes;
        ctx.beginPath(); ctx.moveTo(cx, cy - outerRadius);
        for (let i = 0; i < spikes; i++) {
            x = cx + Math.cos(rot) * outerRadius; y = cy + Math.sin(rot) * outerRadius; ctx.lineTo(x, y); rot += step;
            x = cx + Math.cos(rot) * innerRadius; y = cy + Math.sin(rot) * innerRadius; ctx.lineTo(x, y); rot += step;
        }
        ctx.lineTo(cx, cy - outerRadius); ctx.closePath(); ctx.fill();
    }

    function drawFlag() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (rawWebcamImage) {
            const sampleCanvas = document.createElement('canvas');
            sampleCanvas.width = rawWebcamImage.width;
            sampleCanvas.height = rawWebcamImage.height;
            const sCtx = sampleCanvas.getContext('2d');
            sCtx.drawImage(rawWebcamImage, 0, 0);
            starBackgroundColors = get50StarColorsFromTrapezoid(sCtx, rawWebcamImage.width, rawWebcamImage.height);
        }

        if (zoomMode && rawWebcamImage) {
            const topY = canvas.height * config.y;
            const bottomY = topY + (canvas.height * config.h);
            const tlX = canvas.width * config.x;
            const bottomW = (canvas.width * config.w) * config.p;
            const wDiff = bottomW - (canvas.width * config.w);
            const blX = tlX - (wDiff / 2);

            const trapMinX = blX;
            const trapMaxX = blX + bottomW;
            const trapWidth = trapMaxX - trapMinX;
            const trapHeight = bottomY - topY;

            const paddingX = trapWidth * 0.15;
            const paddingY = trapHeight * 0.15;

            const sourceX = trapMinX - paddingX;
            const sourceY = topY - paddingY;
            const sourceWidth = trapWidth + (paddingX * 2);
            const sourceHeight = trapHeight + (paddingY * 2);

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            const tCtx = tempCanvas.getContext('2d');

            tCtx.drawImage(
                rawWebcamImage,
                Math.max(0, sourceX), Math.max(0, sourceY),
                           Math.min(rawWebcamImage.width, sourceWidth), Math.min(rawWebcamImage.height, sourceHeight),
                           0, 0, canvas.width, canvas.height
            );

            const imgData = tCtx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imgData.data;
            for (let i = 0; i < data.length; i += 4) {
                const corrected = runColorCorrectionPipeline(data[i], data[i+1], data[i+2]);
                data[i] = corrected[0];
                data[i+1] = corrected[1];
                data[i+2] = corrected[2];
            }
            tCtx.putImageData(imgData, 0, 0);
            ctx.drawImage(tempCanvas, 0, 0);

            ctx.save();
            ctx.scale(canvas.width / sourceWidth, canvas.height / sourceHeight);
            ctx.translate(-sourceX, -sourceY);

            ctx.strokeStyle = "#00ff00";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(tlX, topY);
            ctx.lineTo(tlX + (canvas.width * config.w), topY);
            ctx.lineTo(blX + bottomW, bottomY);
            ctx.lineTo(blX, bottomY);
            ctx.closePath();
            ctx.stroke();

            const ySpacingC = (canvas.height * config.h) / 10;
            let starIdx = 0;

            for (let row = 1; row <= 9; row++) {
                const progress = (row - 1) / 8;
                const currentRowW = (canvas.width * config.w) * (1 + progress * (config.p - 1));
                const wDiffRow = currentRowW - (canvas.width * config.w);
                const rStartX = (canvas.width * config.x) - (wDiffRow / 2);

                const isEvenRow = (row % 2 === 0);
                const starsInRow = isEvenRow ? 5 : 6;
                const starXStart = rStartX + (isEvenRow ? (currentRowW / 12) * 2 : (currentRowW / 12));

                for (let col = 0; col < starsInRow; col++) {
                    const nodeX = starXStart + (col * (currentRowW / 12) * 2);
                    const nodeY = topY + (row * ySpacingC);

                    ctx.fillStyle = starBackgroundColors[starIdx] || "#1a2c42";
                    starIdx++;

                    ctx.fillRect(nodeX - 5, nodeY - 5, 10, 10);
                    ctx.strokeStyle = "#ffffff";
                    ctx.lineWidth = 1;
                    ctx.strokeRect(nodeX - 5, nodeY - 5, 10, 10);
                }
            }
            ctx.restore();
            return;
        }

        const stripeHeight = canvas.height / 13;
        for (let i = 0; i < 13; i++) {
            ctx.fillStyle = (i % 2 === 0) ? "#b22234" : "#ffffff";
            ctx.fillRect(0, i * stripeHeight, canvas.width, stripeHeight);
        }

        const cantonWidth = canvas.width * 0.4;
        const cantonHeight = stripeHeight * 7;
        ctx.fillStyle = "#1a2c42";
        ctx.fillRect(0, 0, cantonWidth, cantonHeight);

        if (config.debug && rawWebcamImage) {
            ctx.save();
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            const tCtx = tempCanvas.getContext('2d');
            tCtx.drawImage(rawWebcamImage, 0, 0, canvas.width, canvas.height);

            const imgData = tCtx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imgData.data;
            for (let i = 0; i < data.length; i += 4) {
                const corrected = runColorCorrectionPipeline(data[i], data[i+1], data[i+2]);
                data[i] = corrected[0];
                data[i+1] = corrected[1];
                data[i+2] = corrected[2];
            }
            tCtx.putImageData(imgData, 0, 0);
            ctx.globalAlpha = 1.0;
            ctx.drawImage(tempCanvas, 0, 0);
            ctx.restore();
        }

        const xSpacing = cantonWidth / 12;
        const ySpacing = cantonHeight / 10;
        const starCoordinates = [];
        let starIndex = 0;

        for (let row = 1; row <= 9; row++) {
            const isEvenRow = (row % 2 === 0);
            const starsInRow = isEvenRow ? 5 : 6;
            const starXStart = isEvenRow ? xSpacing * 2 : xSpacing;

            for (let col = 0; col < starsInRow; col++) {
                const starX = starXStart + (col * xSpacing * 2);
                const starY = row * ySpacing;
                const algeaColor = starBackgroundColors[starIndex] || "#1a2c42";
                starIndex++;
                starCoordinates.push({ x: starX, y: starY, row: row, col: col, isEvenRow: isEvenRow, starsInRow: starsInRow, color: algeaColor });
            }
        }

        if (!config.debug) {
            starCoordinates.forEach((star) => {
                ctx.fillStyle = star.color;
                let tileLeft, tileRight;
                if (!star.isEvenRow) {
                    tileLeft = star.col * (xSpacing * 2);
                    tileRight = tileLeft + (xSpacing * 2);
                } else {
                    tileLeft = (star.col === 0) ? 0 : (star.x - xSpacing);
                    tileRight = (star.col === star.starsInRow - 1) ? cantonWidth : (star.x + xSpacing);
                }
                let tileTop = (star.row === 1) ? 0 : (star.y - (ySpacing / 2));
                let tileBottom = (star.row === 9) ? cantonHeight : (star.y + (ySpacing / 2));
                ctx.fillRect(tileLeft, tileTop, (tileRight - tileLeft) + 0.5, (tileBottom - tileTop) + 0.5);
            });
        }

        starCoordinates.forEach((star) => {
            if (!config.debug) {
                ctx.fillStyle = "#ffffff";
                drawActualStar(star.x, star.y, 5, 7.5, 3.2);
            } else {
                ctx.fillStyle = star.color;
                ctx.fillRect(star.x - 9, star.y - 9, 18, 18);
                ctx.save(); ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1;
                ctx.strokeRect(star.x - 9, star.y - 9, 18, 18); ctx.restore();
            }
        });

        if (config.debug) {
            ctx.save();
            ctx.strokeStyle = "#00ff00";
            ctx.lineWidth = 3;

            const tlX = canvas.width * config.x;
            const trX = tlX + (canvas.width * config.w);
            const topY = canvas.height * config.y;

            const bottomW = (canvas.width * config.w) * config.p;
            const wDiff = bottomW - (canvas.width * config.w);
            const blX = tlX - (wDiff / 2);
            const brX = blX + bottomW;
            const bottomY = topY + (canvas.height * config.h);

            ctx.beginPath();
            ctx.moveTo(tlX, topY); ctx.lineTo(trX, topY); ctx.lineTo(brX, bottomY); ctx.lineTo(blX, bottomY);
            ctx.closePath();
            ctx.stroke();
            ctx.restore();
        }
    }

    syncSlidersToConfig();

    setInterval(() => {
        if (currentMode === "proxy-latest") loadLatestProxyImage();
    }, 60000);
});
