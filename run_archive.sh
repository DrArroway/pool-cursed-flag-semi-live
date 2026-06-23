#!/bin/bash
cd ~/pool-archiver

STATE_FILE="archive_state.json"
TODAY=$(date +%Y-%m-%d)

# 1. TIME ZONE CHECK: Is it daytime in Washington, D.C.?
DC_HOUR=$(TZ="America/New_York" date +%H)

if [ "$DC_HOUR" -lt 6 ] || [ "$DC_HOUR" -gt 19 ]; then
    echo "🌙 Skipping: It is currently night time in Washington D.C. (${DC_HOUR}:00)."
    exit 0
fi

# 2. STATE LOGIC: Initialize state file if it doesn't exist
if [ ! -f "$STATE_FILE" ]; then
    echo '{"date":"","count":0,"last_run":0}' > "$STATE_FILE"
fi

LAST_DATE=$(node -p "require('./$STATE_FILE').date")
DAILY_COUNT=$(node -p "require('./$STATE_FILE').count")
LAST_RUN=$(node -p "require('./$STATE_FILE').last_run")
CURRENT_TIME=$(date +%s)

if [ "$LAST_DATE" != "$TODAY" ]; then
    DAILY_COUNT=0
fi

# 3. MAX IMAGES CHECK
if [ "$DAILY_COUNT" -ge 5 ]; then
    echo "⏸️ Skipping: Already captured maximum 5 images for today ($TODAY)."
    exit 0
fi

# 4. INTERVAL CHECK (2 hours minimum wait)
TIME_DIFF=$((CURRENT_TIME - LAST_RUN))
if [ "$LAST_DATE" == "$TODAY" ] && [ "$TIME_DIFF" -lt 7200 ]; then
    echo "⏳ Skipping: Last image was taken too recently ($((TIME_DIFF / 60)) minutes ago)."
    exit 0
fi

# ==========================================
# CONDITIONS PASSED -> CAPTURE THE PICTURE
# ==========================================
echo "📸 Capturing image $((DAILY_COUNT + 1))/5 for $TODAY..."
node capture.js

if [ ! -f "raw_capture.png" ]; then
    echo "Error: Puppeteer failed to generate snapshot."
    exit 1
fi

OUTPUT_NAME="semiLivePics/archive-${TODAY}_$((DAILY_COUNT + 1)).jpg"

# Apply gravity centered crop execution matrix cleanly
magick raw_capture.png -gravity Center -crop 16:9 +repage -resize 1280x720! "$OUTPUT_NAME"

echo "🎯 Frame saved successfully: $OUTPUT_NAME"
rm -f raw_capture.png

# Update tracking state metrics
NEW_COUNT=$((DAILY_COUNT + 1))
node -e "
  const fs = require('fs');
  const state = { date: '$TODAY', count: $NEW_COUNT, last_run: $CURRENT_TIME };
  fs.writeFileSync('$STATE_FILE', JSON.stringify(state));
"

# ==========================================
# AUTOMATED GITHUB UPLOAD
# ==========================================
echo "🚀 Preparing GitHub sync..."

# Pull any unexpected remote additions first to clear out block conditions
git pull origin main --rebase

# Ensure we track both the new image inside the folder and the state file update
git add "$OUTPUT_NAME" "$STATE_FILE"

# Commit with a clean automated message
git commit -m "Auto-archive capture: $OUTPUT_NAME [skip ci]"

# Push to your main branch
if git push origin main; then
    echo "📦 Successfully pushed $OUTPUT_NAME to GitHub!"
else
    echo "⚠️ Push failed. Image is saved locally and will sync on the next run."
fi
