export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/live-frame") {
      // This special endpoint pulls the current live frame extraction directly from Google's active stream delivery network!
      const targetUrl = "https://img.youtube.com/vi/oDCAAfOSqvA/maxresdefault_live.jpg";
      
      try {
        const response = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
          }
        });

        if (!response.ok) {
          return new Response("Failed to fetch live broadcast frame", { status: response.status });
        }

        const newHeaders = new Headers(response.headers);
        newHeaders.set("Access-Control-Allow-Origin", "*");
        // Short cache limits keep the frame pool shifting dynamically with the active stream!
        newHeaders.set("Cache-Control", "public, max-age=30, must-revalidate");

        return new Response(response.body, {
          status: response.status,
          headers: newHeaders
        });
      } catch (err) {
        return new Response("Proxy Stream Error: " + err.message, { status: 500 });
      }
    }

    return env.ASSETS.fetch(request);
  }
};
