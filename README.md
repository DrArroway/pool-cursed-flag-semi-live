# Pool Cursed Flag (Semi-Live)

> "It's easier to change the flag than it is to fix the Reflecting Pool."

Welcome to the tracking station for the D.C. Reflecting Pool's ecosystem. This app dynamically repaints the stars of the USA flag using the current (well, semi-live) conditions and organic colors of the water.

---

## Why "Semi-Live"?

Fully live streaming video would be nice, sure. But after running the numbers, most people only need the image to look recent enough. Instead of burning through bandwidth, we grab a few strategic frames per day, push them here, and call it a day. It saves data, keeps the server happy, and honestly, nobody can tell the difference between a snapshot from 8 seconds ago and 6 hours ago anyway. 

---

## How It Works

The project runs on a basic pipeline of shell scripts, headless browser scraping, and canvas pixel manipulation:

### 1. The Image Capture Pipeline
* **capture.js**: A Puppeteer script that wakes up, goes to the live EarthCam feed, clicks past the cookie/consent banners automatically, and takes a widescreen screenshot of the pool.
* **run_archive.sh**: The automation engine. It runs the browser script, enforces custom time intervals between pictures so we don't spam the folder, automatically prunes redundant test frames, and updates the index file (history.json) in reverse-chronological order so the UI dropdown stays updated.

### 2. The Color Extraction (matrix-tracker.js)
* Instead of using generic procedural green colors, the script reads the raw webcam snapshots directly inside a hidden HTML5 canvas.
* It maps a non-uniform trapezoid shape right onto the coordinate boundaries of the pool. It checks the background light to see if the day is bright or dark, then cuts the pool perspective into 50 distinct regional zones—allowing every single star on the United Statesian design to claim its own personal shade of swamp water.

### 3. Atmospheric and Color Filters
* **Cloud Compensation:** On overcast or muddy days when the colors look flat, a custom S-Curve function stretches the contrast. If the image looks too dark, it automatically adds a calculated boost of warmth to the RGB channels.
* **Algae Isolation Filter:** A targeted color filter. When you turn it on, it aggressively boosts green channels (G > R & G > B) by 25% and tones down the other colors, forcing the flag of the US to look fully green from the bloom. You can turn this off to see the real, unadjusted data.

---

## Control Deck Features

* **Instant Canvas Loading:** A simple asynchronous engine that makes sure the images paint onto the screen correctly on the very first page load.
* **Clean Archive Browser:** Skip through time! Swap dates and cycle through the day's images instantly. The code uses a buttonless slider layout that fetches the files automatically as you change inputs.
* **Calibration Panel:** Real-time UI sliders that map bounding coordinates (X, Y, W, H) directly onto the canvas loop, so Muricans and international onlookers can adjust the box limits with immediate visual feedback.

---

## Running It

* **The Casual View:** Just go to https://drarroway.github.io/pool-cursed-flag-semi-live/ to watch the soup evolve.
* **The Hardcore Route:** Fork the repository, tweak the matrix, and host your own cron jobs if you are a terminally onlineA.

**Update Cadence:** Whenever I feel like turning on my computer.

---

## Disclaimer

I am not a professional programmer. I built this entire thing for the meme with a massive amount of help from Gemini. I know the code is held together by digital duct tape and prayer. 

Please don't slap me, I know it's AI slope code. It's just a joke! ^^
