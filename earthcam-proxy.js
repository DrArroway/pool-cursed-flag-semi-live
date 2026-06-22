export default {
  async fetch(request, env, ctx) {
    // Target EarthCam's actual live static snapshot path
    const targetUrl = "https://images.earthcam.com/ec_stills_plugins/static/wamo.jpg";
    
    // Construct alternative target if you prefer the YouTube stream frame capture
    // const targetUrl = "https://img.youtube.com/vi/iNhVvbGBP3Q/maxresdefault.jpg";

    try {
      // Simulate a real browser request to get past scraping firewalls
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Referer': 'https://www.earthcam.com/'
        }
      });

      if (!response.ok) {
        return new Response(`Failed to fetch stream frame: ${response.statusText}`, { status: response.status });
      }

      // Clone original response headers and append permissive CORS policy
      const newHeaders = new Headers(response.headers);
      newHeaders.set("Access-Control-Allow-Origin", "*");
      newHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      newHeaders.set("Cache-Control", "no-cache, no-store, must-revalidate"); // Force fresh pool frames

      // Deliver the clean image stream straight to your canvas pipeline
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });
    } catch (err) {
      return new Response("Proxy Server Connection Error: " + err.message, { status: 500 });
    }
  }
};