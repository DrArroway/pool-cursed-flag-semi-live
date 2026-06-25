window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('flagCanvas');
    const ctx = canvas.getContext('2d');
    const statusDiv = document.getElementById('status');

    let rawWebcamImage = null;
    let currentMode = "proxy-latest";

    let config = {
        x: 0.505,
        y: 0.609,
        w: 0.018,
        h: 0.155,
        p: 2.25
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
        maxLabel.textContent = `of ${count}`;

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
        metaBox.textContent = `⏰ Est. Capture: ~ ${displayHr}:${displayMin} ${ampm} EDT`;
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
    }

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
        currentMode = val;
        const archivePicker = document.getElementById('archivePickerContainer');

        if (val === 'archive-browse') {
            if (archivePicker) archivePicker.style.display = 'block';
            document.getElementById('valSource').textContent = "📅 Archive Flow Mode";
            document.getElementById('valSource').className = "badge bg-info text-dark";
            syncArchiveInputConstraints();
            loadCustomArchiveTarget();
        } else {
            if (archivePicker) archivePicker.style.display = 'none';
            document.getElementById('valSource').textContent = "🟢 Latest Capture Frame";
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
            statusDiv.textContent = `Active Calibration Matrix target loaded: semiLivePics/${subfolderFile}`;
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
                    statusDiv.innerHTML = `<span style="color: #f85149;">❌ Error: Target file could not be located in directory storage mapping.</span>`;
                    return;
                }
                const path = alternatives[altIndex++];
                statusDiv.textContent = `Retrying lookup location: ${path}...`;
                const altImg = new Image();
                altImg.src = path;
                altImg.onload = function() {
                    rawWebcamImage = altImg;
                    statusDiv.textContent = `Active alternative asset targeted successfully: ${path}`;
                    drawFlag();
                };
                altImg.onerror = tryNextAlternative;
            }
            tryNextAlternative();
        };
    }

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
                    statusDiv.textContent = `Displaying workspace snapshot: archive-${todayStr}_${currentCheckIndex - 1}.jpg`;
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

    function drawFlag() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 1. Draw the clean background picture across the entire viewport workspace
        if (rawWebcamImage) {
            ctx.drawImage(rawWebcamImage, 0, 0, canvas.width, canvas.height);
        } else {
            ctx.fillStyle = "#161b22";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = "#8b949e";
            ctx.font = "18px sans-serif";
            ctx.fillText("No capture image loaded yet.", canvas.width/2 - 110, canvas.height/2);
            return;
        }

        // 2. Compute 50 Calibration Coordinates matching full aspect layout space
        const baseStartX = canvas.width * config.x;
        const baseStartY = canvas.height * config.y;
        const targetW = canvas.width * config.w;
        const targetH = canvas.height * config.h;

        const points = [];

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
                points.push({ x: pixelX, y: pixelY });
            }
        }

        // 3. Render tracking box crosshairs cleanly right on top of the pool water
        points.forEach(pt => {
            ctx.fillStyle = "rgba(0, 255, 0, 0.4)";
            ctx.fillRect(pt.x - 7, pt.y - 7, 14, 14);

            ctx.save();
            ctx.strokeStyle = "#ff3333";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(pt.x - 9, pt.y); ctx.lineTo(pt.x + 9, pt.y);
            ctx.moveTo(pt.x, pt.y - 9); ctx.lineTo(pt.x, pt.y + 9);
            ctx.stroke();
            ctx.restore();
        });

        // 4. Draw outer border trapezoid perimeter path wrapper
        ctx.save();
        ctx.strokeStyle = "#00ff00";
        ctx.lineWidth = 2.5;
        const tlX = canvas.width * config.x, trX = tlX + (canvas.width * config.w), topY = canvas.height * config.y;
        const bottomW = (canvas.width * config.w) * config.p, wDiff = bottomW - (canvas.width * config.w);
        const blX = tlX - (wDiff / 2), brX = blX + bottomW, bottomY = topY + (canvas.height * config.h);

        ctx.beginPath();
        ctx.moveTo(tlX, topY); ctx.lineTo(trX, topY); ctx.lineTo(brX, bottomY); ctx.lineTo(blX, bottomY);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
    }

    syncSlidersToConfig();
    initArchiveCatalogUI();

    setInterval(() => {
        if (currentMode === "proxy-latest") loadLatestProxyImage();
    }, 60000);
});
