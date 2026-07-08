const http = require("http");
const fs = require("fs");
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
    if (req.method === "POST" && req.url === "/api/create-web-call") {
      await handleCreateWebCall(req, res);
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
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
  console.log(`Hisense US TV demo running at http://localhost:${port}`);
});

async function handleCreateWebCall(req, res) {
  const apiKey = process.env.RETELL_API_KEY;
  const body = await readJsonBody(req);
  const agentKey = typeof body.agentKey === "string" ? body.agentKey : "hisense_us_tv";
  const agentIds = {
    hisense_us_tv: process.env.HISENSE_US_TV_AGENT_ID,
    hisense_us_tv_chinese: process.env.HISENSE_US_TV_CHINESE_AGENT_ID,
  };
  const agentId = agentIds[agentKey];

  if (!apiKey || !agentId) {
    sendJson(res, 500, {
      error: "Missing RETELL_API_KEY or selected Hisense agent ID in environment.",
    });
    return;
  }

  const response = await fetch("https://api.retellai.com/v2/create-web-call", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      agent_id: agentId,
      metadata: {
        source: body.source || "hisense-us-tv-demo",
        agent_key: agentKey,
        created_from: "local-web-demo",
      },
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    sendJson(res, response.status, {
      error: data.message || data.error || "Create web call request failed.",
      details: data,
    });
    return;
  }

  sendJson(res, 200, data);
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
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) process.env[key] = value;
  }
}
