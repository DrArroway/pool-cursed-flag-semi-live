const puppeteer = require('puppeteer');

(async () => {
    console.log("Launching headless browser...");
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    // Maintain a clean 1280 base canvas scale mapping
    await page.setViewport({ width: 1280, height: 800 });

    console.log("Navigating to EarthCam...");
    await page.goto('https://www.earthcam.com/usa/dc/washingtonmonument/?cam=wamo', {
        waitUntil: 'networkidle2'
    });

    console.log("Waiting for subframes to mount...");
    await new Promise(resolve => setTimeout(resolve, 6000));

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

    console.log("Ensuring page view alignment...");
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log("Snapping pristine widescreen video clip context bounds...");
    // Shaves 68px off the top header and isolates the native 16:9 inner feed aspect ratio
    await page.screenshot({
        path: 'raw_capture.png',
        clip: { x: 72, y: 68, width: 1136, height: 639 }
    });
    console.log("Raw snapshot captured successfully!");

    await browser.close();
})();
