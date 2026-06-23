const puppeteer = require('puppeteer');

(async () => {
    console.log("Launching headless browser...");
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    console.log("Navigating to EarthCam...");
    await page.goto('https://www.earthcam.com/usa/dc/washingtonmonument/?cam=wamo', {
        waitUntil: 'networkidle2'
    });

    console.log("Waiting for subframes to mount...");
    await new Promise(resolve => setTimeout(resolve, 5000));

    try {
        console.log("🕵️‍♂️ Scanning for Google Funding Choices button...");
        const frames = page.frames();
        for (const frame of frames) {
            const acceptButton = await frame.$('button.fc-vendor-preferences-accept-all, button .fc-button-label');
            if (acceptButton) {
                await acceptButton.click();
                console.log("💥 Consent modal accepted.");
                await new Promise(resolve => setTimeout(resolve, 2000));
                break;
            }
        }
    } catch (error) {
        console.log("Modal bypass skipped:", error.message);
    }

    console.log("Waiting for video stream playback to clear...");
    await new Promise(resolve => setTimeout(resolve, 5000));

    try {
        const containerSelector = '#video_container, .cam-player-vjs, .player-container, #player';
        console.log(`🎯 Targeting video container box: ${containerSelector}`);

        await page.waitForSelector(containerSelector, { timeout: 10000 });
        const container = await page.$(containerSelector);
        const box = await container.boundingBox();

        if (box) {
            console.log(`Snapping container boundaries: X:${Math.round(box.x)} Y:${Math.round(box.y)} W:${Math.round(box.width)} H:${Math.round(box.height)}`);
            await page.screenshot({
                path: 'raw_capture.png',
                clip: {
                    x: Math.round(box.x),
                                  y: Math.round(box.y),
                                  width: Math.round(box.width),
                                  height: Math.round(box.height)
                }
            });
            console.log("Raw snapshot captured successfully!");
        } else {
            throw new Error("Container found but coordinates returned null geometry values.");
        }

    } catch (error) {
        console.error("Execution failure targeting player box, applying baseline viewport clip fallback:", error.message);
        await page.screenshot({
            path: 'raw_capture.png',
            clip: { x: 320, y: 180, width: 1280, height: 720 }
        });
    }

    await browser.close();
})();
