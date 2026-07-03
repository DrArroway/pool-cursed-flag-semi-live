# Pool Cursed Flag (Semi-Live)

> "It's easier to change the flag than it is to fix the Reflecting Pool."

Welcome to the tracking station for the D.C. Reflecting Pool's ecosystem. This app dynamically repaints the stars of the American flag using the real-time (well, semi-live) atmospheric and organic conditions of the water.

---

## Why "Semi-Live"?

Fully live streaming video would be nice, sure. But after running the numbers, most people only need an image to feel "recent enough." Instead of burning through bandwidth, we grab a few strategic frames per day, push them here, and call it a day. It saves data, keeps the server happy, and honestly, nobody can tell the difference between a snapshot from 8 seconds ago and 6 hours ago anyway. 

---

## How It Works

The project runs on a pipeline of shell automation, headless scraping, and real-time canvas pixel manipulation:

### 1. The Asset Capture Pipeline
* **capture.js**: A Puppeteer-driven scraping script that wakes up, navigates to the live EarthCam feed, handlescookie/consent banners automatically, and snaps a widescreen capture of the pool.
* **run_archive.sh**: The automation engine. It orchestrates the browser execution, enforces custom time intervals between captures to ensure a clean tracking timeline, automatically prunes redundant test frames, and generates a dynamic reverse-chronological index (history.json) from the folder assets to update the UI dropdown.

### 2. The Color Extraction Matrix (matrix-tracker.js)
* Rather than using generic procedural green sludge, the script reads your raw webcam snapshots directly inside a hidden HTML5 canvas.
* It projects a tailored, non-uniform trapezoidal mapping matrix right onto the coordinate boundaries of the pool. It samples the background environmental light to establish a baseline scene brightness, then slices the perspective into 50 distinct regional anchor zones—allowing every single star to claim its own personal shade of swamp.

### 3. Smart Atmospheric Processing Engines
* **Cloud Compensation Engine:** On overcast or muddy days, flat midtones are salvaged via a custom S-Curve contrast-stretch function. If the scene leans dark, it injects a calculated boost of solar warmth into the RGB balance.
* **Algae Isolation Filter:** A targeted color-isolation algorithm. When toggled, it aggressively boosts green channels (G > R & G > B) by 25% while crushing competing values, forcing the flag to fully embrace the bloom. You can toggle this off to inspect the raw, unadulterated environmental data.

---

## Control Deck Features

* **Live Workspace Sync:** A seamless, asynchronous canvas initialization engine that ensures your assets paint perfectly onto the viewport on the very first page load.
* **Streamlined Archive Browser:** Skip through time! Swap dates and cycle through the day's iterations instantly via an interactive, buttonless slider layout that fetches assets natively as you change inputs.
* **Calibration Panel:** Real-time UI adjustment sliders mapping bounding coordinates (X, Y, W, H) and perspective scale factors directly to the canvas loop for immediate visual feedback.

---

## Running It

* **The Casual View:** Just go to https://drarroway.github.io/pool-cursed-flag-semi-live/ to watch the soup evolve.
* **The Hardcore Route:** Fork the repository, optimize the matrix, and host your own cron jobs if you are terminally online.

**Update Cadence:** Whenever I feel like turning on my computer.

---

## Disclaimer

I am not a professional programmer. I built this entire thing for the absolute meme with a massive amount of help from Gemini. I know the code is held together by digital duct tape and prayer. 

Please don't slap me, I know it's slope code. It's just a joke! ^^
