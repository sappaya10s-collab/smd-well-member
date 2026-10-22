
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


      // ส่งการ์ดเฉพาะเมื่อบันทึกสมาชิกสำเร็จ
      if (result.status !== "success") {
        return json(result);
      }

      if (!env.LINE_CHANNEL_ACCESS_TOKEN) {
        return json({
          ...result,
          cardSent: false,
          cardMessage: "ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN"
        });
      }

      const profileImageUrl = String(body.profileImageUrl || "").trim();
      const fullName = `${firstname} ${lastname}`;

      const cardContents = [
        {
          type: "text",
          text: "BETTER HEALTH, BRIGHTER YOU",
          size: "xs",
          color: "#6B8C70",
          align: "center",
          weight: "bold",
          wrap: true
        }
      ];

      // ใช้รูปโปรไฟล์ LINE ถ้ามี
      if (/^https:\/\/.+/i.test(profileImageUrl)) {
        cardContents.push({
          type: "image",
          url: profileImageUrl,
          size: "100px",
          aspectRatio: "1:1",
          aspectMode: "cover",
          align: "center",
          cornerRadius: "xxl",
          margin: "lg"
        });
      }

      cardContents.push(
        {
          type: "text",
          text: fullName,
          size: "xl",
          weight: "bold",
          color: "#294D40",
          align: "center",
          wrap: true,
          margin: "lg"
        },
        {
          type: "separator",
          color: "#91AD91",
          margin: "xl"
        },
        {
          type: "box",
          layout: "horizontal",
          backgroundColor: "#E8EFDC",
          cornerRadius: "xxl",
          paddingAll: "lg",
          margin: "xl",
          justifyContent: "center",
          alignItems: "center",
          contents: [
            {
              type: "text",
              text: "✓",
              size: "xl",
              weight: "bold",
              color: "#568C60",
              flex: 0
            },
            {
              type: "text",
              text: "ลงทะเบียนสำเร็จ",
              size: "lg",
              weight: "bold",
              color: "#315B40",
              margin: "md",
              flex: 0,
              wrap: true
            }
          ]
        },
        {
          type: "text",
          text: "ขอบคุณที่ให้ความสนใจ\nเรายินดีต้อนรับคุณเข้าสู่ครอบครัวของเรา ♡",
          size: "sm",
          color: "#69756C",
          align: "center",
          wrap: true,
          margin: "xl"
        },
        {
          type: "box",
          layout: "horizontal",
          spacing: "sm",
          margin: "xl",
          contents: [
            { type: "text", text: "🌿\nHEALTH", size: "xxs", color: "#63866A", align: "center", flex: 1, wrap: true },
            { type: "text", text: "♡\nWELLNESS", size: "xxs", color: "#63866A", align: "center", flex: 1, wrap: true },
            { type: "text", text: "☼\nBALANCE", size: "xxs", color: "#63866A", align: "center", flex: 1, wrap: true },
            { type: "text", text: "♧\nHAPPINESS", size: "xxs", color: "#63866A", align: "center", flex: 1, wrap: true }
          ]
        },
        {
          type: "text",
          text: "YOUR WELLNESS JOURNEY STARTS HERE",
          size: "xxs",
          color: "#8A9B86",
          align: "center",
          wrap: true,
          margin: "xl"
        }
      );

      const flexMessage = {
        type: "flex",
        altText: "ยินดีต้อนรับสู่ SMD Well Member",
        contents: {
          type: "bubble",
          size: "kilo",
          body: {
            type: "box",
            layout: "vertical",
            backgroundColor: "#FFFDF8",
            paddingAll: "22px",
            contents: cardContents
          }
        }
      };

      try {
        const lineResponse = await fetch(
          "https://api.line.me/v2/bot/message/push",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`
            },
            body: JSON.stringify({
              to: lineUserId,
              messages: [flexMessage]
            })
          }
        );

        if (!lineResponse.ok) {
          return json({
            ...result,
            cardSent: false,
            cardMessage: `บันทึกสมาชิกแล้ว แต่ LINE ส่งการ์ดไม่สำเร็จ (HTTP ${lineResponse.status})`
          });
        }

        return json({
          ...result,
          cardSent: true
        });

      } catch (lineError) {
        return json({
          ...result,
          cardSent: false,
          cardMessage: "บันทึกสมาชิกแล้ว แต่เชื่อมต่อ LINE เพื่อส่งการ์ดไม่สำเร็จ"
        });
      }
    }
  }
};
