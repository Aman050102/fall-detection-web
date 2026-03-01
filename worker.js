export class StreamStorage {
  constructor(state) {
    this.currentFrame = null;
  }
  async fetch(request) {
    if (request.method === "PUT") {
      // ✅ รับข้อมูลแบบ Binary
      this.currentFrame = await request.arrayBuffer();
      return new Response("OK");
    }
    // ✅ ส่งกลับเป็นภาพ JPEG
    return new Response(this.currentFrame, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "no-cache"
      }
    });
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
