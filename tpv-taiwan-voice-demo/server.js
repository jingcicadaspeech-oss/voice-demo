const http = require("http");
const fs = require("fs");
const https = require("https");
const path = require("path");

const rootDir = __dirname;
const port = Number(process.env.PORT || 3000);

loadDotEnv(path.join(rootDir, ".env"));

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === "/api/create-web-call") {
      await handleCreateWebCall(req, res);
      return;
    }

    const pathname = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
    const filePath = path.normalize(path.join(rootDir, pathname));

    if (!filePath.startsWith(rootDir)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    fs.readFile(filePath, (error, data) => {
      if (error) {
        sendJson(res, error.code === "ENOENT" ? 404 : 500, { error: "Not found" });
        return;
      }

      const extension = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        "Content-Type": mimeTypes[extension] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(data);
    });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Unexpected server error" });
  }
});

server.listen(port, () => {
  console.log(`TPV Taiwan demo running at http://localhost:${port}`);
});

async function handleCreateWebCall(req, res) {
  if (req.method === "GET") {
    sendJson(res, 200, {
      ok: true,
      message: "TPV Taiwan voice call endpoint is available locally. Use POST to create a call.",
      environment: {
        hasApiKey: Boolean(process.env.RETELL_API_KEY),
        hasAgentId: Boolean(process.env.TPV_TAIWAN_AGENT_ID),
      },
    });
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  const apiKey = process.env.RETELL_API_KEY;
  const agentId = process.env.TPV_TAIWAN_AGENT_ID;
  const body = await readJsonBody(req);

  if (!apiKey || !agentId) {
    sendJson(res, 500, {
      error: "Missing voice service environment variable.",
      details: {
        hasApiKey: Boolean(apiKey),
        hasAgentId: Boolean(agentId),
      },
    });
    return;
  }

  const response = await postJson("https://api.retellai.com/v2/create-web-call", apiKey, {
    agent_id: agentId,
    metadata: {
      source: body.source || "tpv-taiwan-demo",
      created_from: "local-web-demo",
    },
  });

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

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;

    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}
