window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('flagCanvas');
    const ctx = canvas.getContext('2d');
    const statusDiv = document.getElementById('status');

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

    const archiveCatalog = {
        "2026-06-25": { totalImages: 6, baseHour: 9, intervalMinutes: 45 },
        "2026-06-24": { totalImages: 1, baseHour: 12, intervalMinutes: 0 },
        "2026-06-23": { totalImages: 3, baseHour: 10, intervalMinutes: 0 }
    };

    function initArchiveCatalogUI() {
        const dateSelect = document.getElementById('archiveDateSelect');
        if (!dateSelect) return;
        dateSelect.innerHTML = "";

        Object.keys(archiveCatalog).sort().reverse().forEach(dateStr => {
            const opt = document.createElement('option');
            opt.value = dateStr;
            opt.textContent = dateStr;
            dateSelect.appendChild(opt);
        });

        dateSelect.addEventListener('change', syncArchiveInputConstraints);
        document.getElementById('archiveIndexInput').addEventListener('input', updateEstimatedTimeReadout);

        handleSourceViewToggle(document.getElementById('sourceSelector').value);
    }

    function syncArchiveInputConstraints() {
        const chosenDate = document.getElementById('archiveDateSelect').value;
        const indexInput = document.getElementById('archiveIndexInput');
        const maxLabel = document.getElementById('maxAvailableLabel');

        if (!chosenDate || !archiveCatalog[chosenDate]) return;

        const count = archiveCatalog[chosenDate].totalImages;
        indexInput.max = count;
        if (parseInt(indexInput.value) > count) {
            indexInput.value = count;
        }
        maxLabel.textContent = `of ${count} available`;

        updateEstimatedTimeReadout();
    }

    function updateEstimatedTimeReadout() {
        const chosenDate = document.getElementById('archiveDateSelect').value;
        const index = parseInt(document.getElementById('archiveIndexInput').value) || 1;
        const metaBox = document.getElementById('archiveMetaDetails');

        if (!chosenDate || !archiveCatalog[chosenDate]) {
            metaBox.style.display = 'none';
            return;
        }

        const dayData = archiveCatalog[chosenDate];
        let totalMinutes = (dayData.baseHour * 60) + dayData.intervalMinutes + ((index - 1) * 30);
        let hr = Math.floor(totalMinutes / 60);
        let min = totalMinutes % 60;
        let ampm = hr >= 12 ? 'PM' : 'AM';
        let displayHr = hr % 12 === 0 ? 12 : hr % 12;
        let displayMin = String(min).padStart(2, '0');

        metaBox.style.display = 'block';
        metaBox.textContent = `⏰ Capture Time: ~ ${displayHr}:${displayMin} ${ampm} EDT`;
    }

    function syncSlidersToConfig() {
        document.getElementById('boxX').value = config.x * 100;
        document.getElementById('valX').textContent = (config.x * 100).toFixed(1) + '%';

        document.getElementById('boxY').value = config.y * 100;
        document.getElementById('valY').textContent = (config.y * 100).toFixed(1) + '%';

        document.getElementById('boxW').value = config.w * 100;
        document.getElementById('valW').textContent = (config.w * 100).toFixed(1) + '%';

        document.getElementById('boxH').value = config.h * 100;
        document.getElementById('valH').textContent = (config.h * 100).toFixed(1) + '%';

        document.getElementById('boxP').value = config.p;
        document.getElementById('valP').textContent = config.p.toFixed(2) + 'x';

        document.getElementById('toggleDebug').checked = config.debug;
        document.getElementById('toggleCloudComp').checked = cloudCompensationActive;
        document.getElementById('toggleAlgaeIsolate').checked = algaeIsolationActive;
    }

    document.getElementById('toggleCalibrateBtn').addEventListener('click', (e) => {
        const panel = document.getElementById('calibrationPanel');
        const zoomCard = document.getElementById('zoomOpticCard');

        if (panel.style.display === 'none') {
            panel.style.display = 'block';
            if (zoomCard) zoomCard.style.display = 'block';

            config.debug = true;
            document.getElementById('toggleDebug').checked = true;
            e.target.textContent = "❌ Close Calibration Panel";
            e.target.classList.add('btn-secondary');
        } else {
            panel.style.display = 'none';
            if (zoomCard) {
                zoomCard.style.display = 'none';
                zoomMode = false;
                const zoomToggle = document.getElementById('toggleZoomMode');
                if (zoomToggle) zoomToggle.checked = false;
            }

            config.debug = false;
            document.getElementById('toggleDebug').checked = false;
            e.target.textContent = "🛠️ Open Calibration Panel";
            e.target.classList.remove('btn-secondary');
        }
        drawFlag();
    });

    document.getElementById('toggleZoomMode').addEventListener('change', (e) => {
        zoomMode = e.target.checked;
        drawFlag();
    });

    document.getElementById('toggleCloudComp').addEventListener('change', (e) => {
        cloudCompensationActive = e.target.checked;
        drawFlag();
    });

    document.getElementById('toggleAlgaeIsolate').addEventListener('change', (e) => {
        algaeIsolationActive = e.target.checked;
        drawFlag();
    });

    const inputs = [
        { id: 'boxX', key: 'x', div: 'valX', mult: 0.01, unit: '%' },
        { id: 'boxY', key: 'y', div: 'valY', mult: 0.01, unit: '%' },
        { id: 'boxW', key: 'w', div: 'valW', mult: 0.01, unit: '%' },
        { id: 'boxH', key: 'h', div: 'valH', mult: 0.01, unit: '%' },
        { id: 'boxP', key: 'p', div: 'valP', mult: 1, unit: 'x' }
    ];

    inputs.forEach(input => {
        document.getElementById(input.id).addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            config[input.key] = val * input.mult;
            document.getElementById(input.div).textContent = val.toFixed(input.id === 'boxP' ? 2 : 1) + input.unit;
            drawFlag();
        });
    });

    function handleSourceViewToggle(val) {
        const archivePicker = document.getElementById('archivePickerContainer');
        currentMode = val;

        if (val === 'archive-browse') {
            if (archivePicker) archivePicker.style.display = 'block';
            document.getElementById('valSource').textContent = "📅 Historical Archive Mode";
            document.getElementById('valSource').className = "badge bg-info text-dark";
            syncArchiveInputConstraints();
            loadCustomArchiveTarget();
        } else {
            if (archivePicker) archivePicker.style.display = 'none';
            document.getElementById('valSource').textContent = "🟢 Latest Local Capture";
            document.getElementById('valSource').className = "badge bg-success";
            loadLatestProxyImage();
        }
    }

    document.getElementById('sourceSelector').addEventListener('change', (e) => {
        handleSourceViewToggle(e.target.value);
    });

    document.getElementById('loadArchiveBtn').addEventListener('click', loadCustomArchiveTarget);

    function loadCustomArchiveTarget() {
        const chosenDate = document.getElementById('archiveDateSelect').value;
        const chosenIndex = document.getElementById('archiveIndexInput').value;
        if (!chosenDate) return;

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

    document.getElementById('toggleDebug').addEventListener('change', (e) => { config.debug = e.target.checked; drawFlag(); });

    function loadLatestProxyImage() {
        if (currentMode !== "proxy-latest") return;
        statusDiv.textContent = "Scanning workspace folders for latest snapshot capture...";

        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        let highestFoundImg = null;
        let currentCheckIndex = 1;

        function probeNextIndex() {
            if (currentMode !== "proxy-latest") return;
            const testImg = new Image();
            testImg.src = `./semiLivePics/archive-${todayStr}_${currentCheckIndex}.jpg?t=${Date.now()}`;
            testImg.onload = function() {
                highestFoundImg = testImg;
                currentCheckIndex++;
                probeNextIndex();
            };
            testImg.onerror = function() {
                if (highestFoundImg) {
                    rawWebcamImage = highestFoundImg;
                    statusDiv.textContent = `Displaying proxy snapshot: archive-${todayStr}_${currentCheckIndex - 1}.jpg`;
                    drawFlag();
                } else {
                    loadYesterdayFallback();
                }
            };
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
                drawFlag();
            };
        }
        probeNextIndex();
    }

    /**
     * Smart Atmospheric Color Pipeline Engine
     */
    function runColorCorrectionPipeline(r, g, b) {
        // 1. SMART ADAPTIVE CLOUD COMPENSATION
        if (cloudCompensationActive) {
            // Check if the overall image context is determined overcast/cloudy
            if (ambientSceneBrightness < 140) {
                // Calculate ambient variance ratio
                const deficiencyFactor = (140 - ambientSceneBrightness) / 140;

                // Adaptive Contrast S-Curve Stretch Formula
                // Pushes upper values to sunny highlights, deepens matching shadow floors
                const applySmartContrast = (val) => {
                    let norm = val / 255;
                    // S-Curve function to increase overall dynamic resolution punch
                    norm = 1 / (1 + Math.exp(-10 * (norm - 0.5)));

                    // Blend original grayed data with the expanded sunshine map relative to cloud density
                    return val + (norm * 255 - val) * (0.45 + deficiencyFactor * 0.2);
                };

                r = applySmartContrast(r);
                g = applySmartContrast(g);
                b = applySmartContrast(b);

                // Slight amber solar-hue bias shift injection to simulate sunlight temperature
                r = Math.min(255, r * 1.04);
                g = Math.min(255, g * 1.01);
                b = Math.min(255, b * 0.96);
            }
        }

        // 2. ALGAE ISOLATION FILTER LOGIC
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
        // Sample baseline environment matrix data to compute lighting state natively first
        try {
            const sampleWidth = Math.floor(imgW * 0.2);
            const sampleHeight = Math.floor(imgH * 0.2);
            const ambientData = sCtx.getImageData(Math.floor(imgW * 0.4), Math.floor(imgH * 0.2), sampleWidth, sampleHeight).data;
            let totalLum = 0;
            let sampleCount = 0;
            for (let i = 0; i < ambientData.length; i += 40) { // Step sequence to optimize loop lookup
                totalLum += (ambientData[i] + ambientData[i+1] + ambientData[i+2]) / 3;
                sampleCount++;
            }
            ambientSceneBrightness = totalLum / sampleCount;
        } catch (e) {
            ambientSceneBrightness = 150; // Fallback default baseline
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

        // =============================================================
        // ENHANCED VIEWPORT OPTIC (WITH SMART CONTRAST PREVIEW)
        // =============================================================
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
    initArchiveCatalogUI();

    setInterval(() => {
        if (currentMode === "proxy-latest") loadLatestProxyImage();
    }, 60000);
});
