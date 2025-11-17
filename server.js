const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const express = require("express");

const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  require("dotenv").config({ path: envPath });
}

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const MERCHANT_IDENTIFIER = process.env.MERCHANT_IDENTIFIER || "";
const MERCHANT_DOMAIN = process.env.MERCHANT_DOMAIN || "";
const MERCHANT_DISPLAY_NAME = process.env.MERCHANT_DISPLAY_NAME || "Demo Store";

const staticDir = path.join(__dirname, "applepay");
app.use(express.static(staticDir));
app.get("/", (_req, res) => res.redirect("/create-merchant.html"));

function loadFile(label, filePath) {
  if (!filePath) {
    throw new Error(`Missing env for ${label}`);
  }
  const resolved = path.isAbsolute(filePath)
    ? filePath
    : path.join(__dirname, filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`${label} not found at ${resolved}`);
  }
  return fs.readFileSync(resolved);
}

let merchantAgent;
function getMerchantAgent() {
  if (merchantAgent) return merchantAgent;

  const cert = loadFile(
    "MERCHANT_CERT_PATH",
    process.env.MERCHANT_CERT_PATH || ""
  );
  const key = loadFile("MERCHANT_KEY_PATH", process.env.MERCHANT_KEY_PATH || "");

  merchantAgent = new https.Agent({
    cert,
    key,
    passphrase: process.env.MERCHANT_KEY_PASSPHRASE || undefined,
  });
  return merchantAgent;
}

function validateAppleURL(rawUrl) {
  const url = new URL(rawUrl);
  const allowedHosts = [
    "apple-pay-gateway.apple.com",
    "apple-pay-gateway-nc-pod1.apple.com",
    "apple-pay-gateway-nc-pod2.apple.com",
    "apple-pay-gateway-cert.apple.com",
    "apple-pay-gateway-ncn.apple.com",
    "apple-pay-gateway-nc-prod.apple.com",
    "cn-apple-pay-gateway.apple.com",
  ];
  if (!allowedHosts.some((host) => url.hostname.endsWith(host))) {
    throw new Error("Invalid validation URL host");
  }
  return url;
}

function requestMerchantSession(validationURL, payload) {
  const data = JSON.stringify(payload);
  const url = validateAppleURL(validationURL);

  const options = {
    hostname: url.hostname,
    path: url.pathname + url.search,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(data),
    },
    agent: getMerchantAgent(),
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(body));
          } catch (err) {
            reject(new Error("Apple response parse error"));
          }
        } else {
          reject(
            new Error(
              `Apple validation failed (${res.statusCode}): ${body.toString()}`
            )
          );
        }
      });
    });

    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

app.post("/apple-pay/validate-merchant", async (req, res) => {
  try {
    const { validationURL, merchantIdentifier, displayName, domainName } =
      req.body || {};
    if (!validationURL) {
      return res.status(400).json({ error: "validationURL required" });
    }
    const payload = {
      merchantIdentifier: merchantIdentifier || MERCHANT_IDENTIFIER,
      displayName: displayName || MERCHANT_DISPLAY_NAME,
      initiative: "web",
      initiativeContext: domainName || MERCHANT_DOMAIN,
    };
    if (!payload.merchantIdentifier || !payload.initiativeContext) {
      return res
        .status(400)
        .json({ error: "Merchant identifier/domain not configured" });
    }

    const merchantSession = await requestMerchantSession(
      validationURL,
      payload
    );
    res.json(merchantSession);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

function startServer() {
  const devCertPath = process.env.DEV_SSL_CERT_PATH;
  const devKeyPath = process.env.DEV_SSL_KEY_PATH;

  if (devCertPath && devKeyPath) {
    const httpsOptions = {
      cert: loadFile("DEV_SSL_CERT_PATH", devCertPath),
      key: loadFile("DEV_SSL_KEY_PATH", devKeyPath),
      passphrase: process.env.DEV_SSL_KEY_PASSPHRASE || undefined,
    };
    https
      .createServer(httpsOptions, app)
      .listen(PORT, () =>
        console.log(`HTTPS server ready at https://localhost:${PORT}`)
      );
  } else {
    console.warn(
      "DEV_SSL_CERT_PATH/DEV_SSL_KEY_PATH not set. Starting HTTP server (Apple Pay JS requires HTTPS)."
    );
    http
      .createServer(app)
      .listen(PORT, () =>
        console.log(`HTTP server ready at http://localhost:${PORT}`)
      );
  }
}

startServer();

