export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/live-frame") {
      // Pull dynamic target parameter or fall back to default Washington Monument ID
      let videoId = url.searchParams.get("vid") || "oDCAAfOSqvA";
      
      // Clean target parsing just in case someone pastes a full web link into the argument field
      if (videoId.includes("v=")) {
        videoId = videoId.split("v=")[1].split("&")[0];
      }

      const targetUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault_live.jpg`;
      
      try {
        const response = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
          }
        });

        if (!response.ok) {
          return new Response("Failed to fetch target live stream snapshot", { status: response.status });
        }

        const newHeaders = new Headers(response.headers);
        newHeaders.set("Access-Control-Allow-Origin", "*");
        newHeaders.set("Cache-Control", "public, max-age=15, must-revalidate");

        return new Response(response.body, { status: 200, headers: newHeaders });
      } catch (err) {
        return new Response("Proxy Engine Error: " + err.message, { status: 500 });
      }
    }

    return env.ASSETS.fetch(request);
  }
};
