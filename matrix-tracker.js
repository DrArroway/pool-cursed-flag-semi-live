window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('flagCanvas');
    const ctx = canvas.getContext('2d');
    const statusDiv = document.getElementById('status');

    let starBackgroundColors = Array.from({length: 50}, () => "#1a2c42");
    let rawWebcamImage = null;
    let currentMode = "proxy-latest";
    let zoomMode = false;

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
    }

    document.getElementById('toggleCalibrateBtn').addEventListener('click', (e) => {
        const panel = document.getElementById('calibrationPanel');
        if (panel.style.display === 'none') {
            panel.style.display = 'block';
            config.debug = true;
            document.getElementById('toggleDebug').checked = true;
            e.target.textContent = "❌ Close Calibration Panel";
            e.target.classList.add('btn-secondary');
        } else {
            panel.style.display = 'none';
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

    function get50StarColorsFromTrapezoid(sCtx, imgW, imgH) {
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
                    colors.push(`rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`);
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
        // Base native image dimensions
        const baseW = 1280;
        const baseH = 720;

        // Target display dimensions
        const displayW = 820;
        const displayH = 460;

        if (rawWebcamImage) {
            const sampleCanvas = document.createElement('canvas');
            sampleCanvas.width = rawWebcamImage.width;
            sampleCanvas.height = rawWebcamImage.height;
            const sCtx = sampleCanvas.getContext('2d');
            sCtx.drawImage(rawWebcamImage, 0, 0);
            starBackgroundColors = get50StarColorsFromTrapezoid(sCtx, rawWebcamImage.width, rawWebcamImage.height);
        }

        // Apply 1:1 view sizing toggles
        if (config.debug) {
            canvas.width = displayW;
            canvas.height = displayH;
        } else {
            canvas.width = baseW;
            canvas.height = baseH;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Calculate layout anchors based on current configuration variables
        const currentCenterX = baseW * config.x;
        const currentCenterY = baseH * (config.y + (config.h / 2));

        // State View 1: Zoom Viewport Mode
        if (zoomMode && rawWebcamImage && !config.debug) {
            const sourceX = rawWebcamImage.width * (config.x - config.w * config.p);
            const sourceY = rawWebcamImage.height * config.y;
            const sourceWidth = rawWebcamImage.width * (config.w * config.p * 2);
            const sourceHeight = rawWebcamImage.height * config.h;

            ctx.drawImage(
                rawWebcamImage,
                Math.max(0, sourceX), Math.max(0, sourceY),
                          Math.min(rawWebcamImage.width, sourceWidth), Math.min(rawWebcamImage.height, sourceHeight),
                          0, 0, canvas.width, canvas.height
            );
            return;
        }

        // State View 2: Calibration Mode 1:1 Clean Viewport
        if (config.debug && rawWebcamImage) {
            ctx.save();
            // Calculate absolute bounding slice centered around the pool trapezoid nodes
            let cropX = Math.floor(currentCenterX - (displayW / 2));
            let cropY = Math.floor(currentCenterY - (displayH / 2));

            // Constrain viewport crops inside physical image bounds
            cropX = Math.max(0, Math.min(baseW - displayW, cropX));
            cropY = Math.max(0, Math.min(baseH - displayH, cropY));

            ctx.drawImage(rawWebcamImage, cropX, cropY, displayW, displayH, 0, 0, displayW, displayH);

            // Render calibration framing matrix using relative coordinate transformations
            ctx.strokeStyle = "#00ff00";
            ctx.lineWidth = 3;

            const tlX = (baseW * config.x) - cropX;
            const trX = tlX + (baseW * config.w);
            const topY = (baseH * config.y) - cropY;

            const bottomW = (baseW * config.w) * config.p;
            const wDiff = bottomW - (baseW * config.w);
            const blX = tlX - (wDiff / 2);
            const brX = blX + bottomW;
            const bottomY = topY + (baseH * config.h);

            ctx.beginPath();
            ctx.moveTo(tlX, topY); ctx.lineTo(trX, topY); ctx.lineTo(brX, bottomY); ctx.lineTo(blX, bottomY);
            ctx.closePath();
            ctx.stroke();

            // Draw targeting nodes directly onto transformed context spaces
            const xSpacingC = (baseW * config.w) / 12;
            const ySpacingC = (baseH * config.h) / 10;
            let starIdx = 0;

            for (let row = 1; row <= 9; row++) {
                const progress = (row - 1) / 8;
                const currentRowW = (baseW * config.w) * (1 + progress * (config.p - 1));
                const wDiffRow = currentRowW - (baseW * config.w);
                const rStartX = (baseW * config.x) - (wDiffRow / 2) - cropX;

                const isEvenRow = (row % 2 === 0);
                const starsInRow = isEvenRow ? 5 : 6;
                const starXStart = rStartX + (isEvenRow ? (currentRowW / 12) * 2 : (currentRowW / 12));

                for (let col = 0; col < starsInRow; col++) {
                    const nodeX = starXStart + (col * (currentRowW / 12) * 2);
                    const nodeY = topY + (row * ySpacingC);
                    ctx.fillStyle = starBackgroundColors[starIdx] || "#1a2c42";
                    starIdx++;

                    ctx.fillRect(nodeX - 7, nodeY - 7, 14, 14);
                    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1;
                    ctx.strokeRect(nodeX - 7, nodeY - 7, 14, 14);
                }
            }
            ctx.restore();
            return;
        }

        // State View 3: Native Standard View Flag Rendering
        const stripeHeight = baseH / 13;
        for (let i = 0; i < 13; i++) {
            ctx.fillStyle = (i % 2 === 0) ? "#b22234" : "#ffffff";
            ctx.fillRect(0, i * stripeHeight, baseW, stripeHeight);
        }

        const cantonWidth = baseW * 0.4;
        const cantonHeight = stripeHeight * 7;
        ctx.fillStyle = "#1a2c42";
        ctx.fillRect(0, 0, cantonWidth, cantonHeight);

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

        starCoordinates.forEach((star) => {
            ctx.fillStyle = "#ffffff";
            drawActualStar(star.x, star.y, 5, 7.5, 3.2);
        });
    }

    syncSlidersToConfig();
    initArchiveCatalogUI();

    setInterval(() => {
        if (currentMode === "proxy-latest") loadLatestProxyImage();
    }, 60000);
});
