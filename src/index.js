
export default {
  async fetch(request, env) {
    // ==========================================
    // 1. CONFIGURATION
    // ==========================================

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

    // ==========================================
    // 2. CORS
    // ==========================================

    if (request.method === "OPTIONS") {
      if (origin !== allowedOrigin) {
        return new Response(null, { status: 403 });
      }

      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    if (origin && origin !== allowedOrigin) {
      return json({
        status: "error",
        message: "Origin not allowed"
      }, 403);
    }

    // ==========================================
    // 3. HEALTH CHECK
    // ==========================================

    if (request.method === "GET") {
      return json({
        status: "success",
        message: "SMD Well Member API is running"
      });
    }

    if (request.method !== "POST") {
      return json({
        status: "error",
        message: "Method not allowed"
      }, 405);
    }

    // ==========================================
    // 4. CHECK ENVIRONMENT VARIABLES
    // ==========================================

    if (!env.GAS_URL || !env.API_SECRET) {
      return json({
        status: "error",
        message: "API configuration is missing"
      }, 500);
    }

    try {
      // ========================================
      // 5. READ REQUEST BODY
      // ========================================

      let body;

      try {
        body = await request.json();
      } catch {
        return json({
          status: "error",
          message: "รูปแบบข้อมูล JSON ไม่ถูกต้อง"
        }, 400);
      }

      const displayName =
        String(body.displayName || "").trim();

      const firstname =
        String(body.firstname || "").trim();

      const lastname =
        String(body.lastname || "").trim();

      const lineUserId =
        String(body.lineUserId || "").trim();

      const profileImageUrl =
        String(body.profileImageUrl || "").trim();

      // ========================================
      // 6. VALIDATE MEMBER DATA
      // ========================================

      if (!firstname || !lastname || !lineUserId) {
        return json({
          status: "error",
          message:
            "กรุณากรอกชื่อ นามสกุล และข้อมูล LINE ให้ครบ"
        }, 400);
      }

      // ตรวจสอบรูปโปรไฟล์ HTTPS
      let validProfileImageUrl = "";

      try {
        const imageUrl = new URL(profileImageUrl);

        if (imageUrl.protocol === "https:") {
          validProfileImageUrl = imageUrl.href;
        }
      } catch {
        validProfileImageUrl = "";
      }

      // ========================================
      // 7. SAVE MEMBER TO GOOGLE SHEETS
      // ========================================

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
        console.error(
          "Invalid Google Apps Script response:",
          responseText.slice(0, 500)
        );

        return json({
          status: "error",
          message:
            "Google Apps Script ตอบกลับไม่ใช่ JSON"
        }, 502);
      }

      if (!gasResponse.ok) {
        return json({
          status: "error",
          message:
            result.message ||
            "Google Apps Script request failed"
        }, 502);
      }

      // ต้องบันทึกสำเร็จก่อนจึงส่งการ์ด
      if (result.status !== "success") {
        return json(result);
      }

      // ========================================
      // 8. CHECK LINE CHANNEL ACCESS TOKEN
      // ========================================

      if (!env.LINE_CHANNEL_ACCESS_TOKEN) {
        return json({
          ...result,
          cardSent: false,
          cardMessage:
            "บันทึกสมาชิกสำเร็จ แต่ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN"
        });
      }

      // ========================================
      // 9. PREPARE PROFILE AND MEMBER NAME
      // ========================================

      const lineDisplayName =
        displayName || "สมาชิก SMD Well";

      const fullName =
        `${firstname} ${lastname}`;

      // ========================================
      // 10. BUILD FLEX MESSAGE CARD
      // ========================================

      const cardContents = [
        {
          type: "text",
          text: "WELCOME TO",
          size: "sm",
          color: "#8A9B86",
          align: "center",
          weight: "bold",
          margin: "sm"
        },
        {
          type: "text",
          text: "SMD WELL",
          size: "3xl",
          weight: "bold",
          color: "#294D40",
          align: "center",
          wrap: true,
          margin: "sm"
        },
        {
          type: "text",
          text: "MEMBER",
          size: "sm",
          color: "#63866A",
          align: "center",
          weight: "bold",
          margin: "xs"
        },
        {
          type: "separator",
          color: "#DCE8DC",
          margin: "lg"
        }
      ];

      // รูปโปรไฟล์ LINE แสดงบนการ์ด
      if (validProfileImageUrl) {
        cardContents.push({
          type: "image",
          url: validProfileImageUrl,
          size: "xl",
          aspectRatio: "1:1",
          aspectMode: "cover",
          align: "center",
          margin: "lg"
        });
      }

      // ชื่อโปรไฟล์และชื่อสมาชิก
      cardContents.push(
        {
          type: "text",
          text: lineDisplayName,
          size: "xl",
          weight: "bold",
          color: "#294D40",
          align: "center",
          wrap: true,
          margin: "lg"
        },
        {
          type: "text",
          text: `สมาชิก ${fullName}`,
          size: "sm",
          color: "#69756C",
          align: "center",
          wrap: true,
          margin: "sm"
        },
        {
          type: "separator",
          color: "#DCE8DC",
          margin: "xl"
        },
        {
          type: "text",
          text:
            "ขอบคุณที่ให้ความสนใจ\n" +
            "เรายินดีต้อนรับคุณเข้าสู่ครอบครัวของเรา ♡",
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
            {
              type: "text",
              text: "🌿\nHEALTH",
              size: "xxs",
              color: "#63866A",
              align: "center",
              flex: 1,
              wrap: true
            },
            {
              type: "text",
              text: "♡\nWELLNESS",
              size: "xxs",
              color: "#63866A",
              align: "center",
              flex: 1,
              wrap: true
            },
            {
              type: "text",
              text: "☼\nBALANCE",
              size: "xxs",
              color: "#63866A",
              align: "center",
              flex: 1,
              wrap: true
            },
            {
              type: "text",
              text: "♧\nHAPPINESS",
              size: "xxs",
              color: "#63866A",
              align: "center",
              flex: 1,
              wrap: true
            }
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

      // ========================================
      // 11. PUSH WELCOME CARD TO LINE USER
      // ========================================

      try {
        const lineResponse = await fetch(
          "https://api.line.me/v2/bot/message/push",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization":
                `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`
            },
            body: JSON.stringify({
              to: lineUserId,
              messages: [flexMessage]
            })
          }
        );

        if (!lineResponse.ok) {
          const lineErrorText =
            await lineResponse.text();

          console.error(
            "LINE Push API error:",
            lineResponse.status,
            lineErrorText
          );

          return json({
            ...result,
            cardSent: false,
            cardMessage:
              `บันทึกสมาชิกแล้ว แต่ส่งการ์ดไม่สำเร็จ (HTTP ${lineResponse.status})`
          });
        }

        return json({
          ...result,
          cardSent: true,
          cardMessage: "ส่งการ์ดต้อนรับสำเร็จ"
        });

      } catch (lineError) {
        console.error(
          "LINE request failed:",
          lineError
        );

        return json({
          ...result,
          cardSent: false,
          cardMessage:
            "บันทึกสมาชิกแล้ว แต่เชื่อมต่อ LINE เพื่อส่งการ์ดไม่สำเร็จ"
        });
      }

    } catch (error) {
      console.error("API error:", error);

      return json({
        status: "error",
        message:
          "เกิดข้อผิดพลาดใน API Worker กรุณาตรวจสอบ Logs"
      }, 500);
    }
  }
};
