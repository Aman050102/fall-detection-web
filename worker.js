export class StreamStorage {
  constructor(state) {
    this.currentFrame = null;
  }
  async fetch(request) {
    if (request.method === "PUT") {
      const data = await request.json();
      this.currentFrame = data.frame;
      return new Response("OK");
    }
    return new Response(JSON.stringify({ frame: this.currentFrame || null }));
  }
}

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
      const id = env.STREAM_DO.idFromName("global_stream");
      const obj = env.STREAM_DO.get(id);
      const response = await obj.fetch(request);
      const newResponse = new Response(response.body, response);
      Object.keys(corsHeaders).forEach(k => newResponse.headers.set(k, corsHeaders[k]));
      return newResponse;
    } catch (e) {
      return new Response("Error: " + e.message, { status: 500, headers: corsHeaders });
    }
  }
};
