const https = require("https");

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let rawBody = "";

    req.on("data", (chunk) => {
      rawBody += chunk;
    });

    req.on("end", () => {
      if (!rawBody) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(rawBody));
      } catch (error) {
        reject(new Error("Invalid JSON request body."));
      }
    });

    req.on("error", reject);
  });
}

function postJson(url, apiKey, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const request = https.request(
      url,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (response) => {
        let rawResponse = "";

        response.on("data", (chunk) => {
          rawResponse += chunk;
        });

        response.on("end", () => {
          let data = {};

          try {
            data = rawResponse ? JSON.parse(rawResponse) : {};
          } catch (error) {
            data = { raw: rawResponse };
          }

          resolve({
            ok: response.statusCode >= 200 && response.statusCode < 300,
            status: response.statusCode,
            data,
          });
        });
      }
    );

    request.on("error", reject);
    request.write(body);
    request.end();
  });
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    sendJson(res, 200, {
      ok: true,
      message: "Hisense voice call endpoint is deployed. Use POST to create a call.",
      environment: {
        hasApiKey: Boolean(process.env.RETELL_API_KEY),
        hasEnglishAgentId: Boolean(process.env.HISENSE_US_TV_AGENT_ID),
        hasChineseAgentId: Boolean(process.env.HISENSE_US_TV_CHINESE_AGENT_ID),
      },
    });
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  try {
    const apiKey = process.env.RETELL_API_KEY;
    const body = await readBody(req);
    const agentKey =
      typeof body.agentKey === "string" ? body.agentKey : "hisense_us_tv";
    const agentIds = {
      hisense_us_tv: process.env.HISENSE_US_TV_AGENT_ID,
      hisense_us_tv_chinese: process.env.HISENSE_US_TV_CHINESE_AGENT_ID,
    };
    const agentId = agentIds[agentKey];

    if (!apiKey || !agentId) {
      sendJson(res, 500, {
        error: "Missing voice service environment variable.",
        details: {
          hasApiKey: Boolean(apiKey),
          selectedAgentKey: agentKey,
          hasSelectedAgentId: Boolean(agentId),
        },
      });
      return;
    }

    const response = await postJson(
      "https://api.retellai.com/v2/create-web-call",
      apiKey,
      {
        agent_id: agentId,
        metadata: {
          source: body.source || "hisense-us-tv-demo",
          agent_key: agentKey,
          created_from: "vercel-web-demo",
        },
      }
    );

    if (!response.ok) {
      sendJson(res, response.status || 500, {
        error:
          response.data.message ||
          response.data.error ||
          `Create web call request failed with status ${response.status}.`,
        status: response.status,
        details: response.data,
      });
      return;
    }

    sendJson(res, 200, response.data);
  } catch (error) {
    sendJson(res, 500, {
      error: error && error.message ? error.message : "Unexpected server error.",
    });
  }
};
