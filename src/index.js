
export default {
  async fetch(request, env) {
    const allowedOrigin =
      "https://smd-well-member-site.sappaya10s.workers.dev";

    const origin = request.headers.get("Origin") || "";
    const corsHeaders = {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json; charset=UTF-8",
      "Vary": "Origin"
    };

    function json(data, status = 200) {
      return new Response(JSON.stringify(data), {
        status,
        headers: corsHeaders
      });
    }

    if (request.method === "OPTIONS") {
      if (origin !== allowedOrigin) {
        return new Response(null, { status: 403 });
      }
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (origin && origin !== allowedOrigin) {
      return json({ status: "error", message: "Origin not allowed" }, 403);
    }

    if (request.method !== "POST") {
      return json({
        status: "success",
        message: "SMD Well Member API is running"
      });
    }

    if (!env.GAS_URL || !env.API_SECRET) {
      return json({
        status: "error",
        message: "API configuration is missing"
      }, 500);
    }

    try {
      const body = await request.json();

      const displayName = String(body.displayName || "").trim();
      const firstname = String(body.firstname || "").trim();
      const lastname = String(body.lastname || "").trim();
      const lineUserId = String(body.lineUserId || "").trim();

      if (!firstname || !lastname || !lineUserId) {
        return json({
          status: "error",
          message: "กรุณากรอกชื่อ นามสกุล และข้อมูล LINE ให้ครบ"
        }, 400);
      }

      const gasResponse = await fetch(env.GAS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          apiSecret: env.API_SECRET,
          displayName,
          firstname,
          lastname,
          lineUserId
        })
      });

      const responseText = await gasResponse.text();

      let result;
      try {
        result = JSON.parse(responseText);
      } catch {
        return json({
          status: "error",
          message: "Google Apps Script ตอบกลับไม่ใช่ JSON"
        }, 502);
      }

      if (!gasResponse.ok) {
        return json({
          status: "error",
          message: result.message || "Google Apps Script request failed"
        }, 502);
      }

      return json(result);
    } catch (error) {
      return json({
        status: "error",
        message: "เกิดข้อผิดพลาดในการเชื่อมต่อ API"
      }, 500);
    }
  }
};
