require("dotenv").config();

const { start } = require("../src/server");

const PORT = Number(process.env.PORT) || 3000;
const API_BASE_URL = process.env.TEST_API_BASE_URL || `http://localhost:${PORT}`;
const DEVICE_API_KEY = process.env.DEVICE_API_KEY || "esp32-demo-key";
const TEST_DEVICE_ID = process.env.TEST_DEVICE_ID || "esp32-test-1";

const parseJson = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_error) {
    return text;
  }
};

const requestJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  const body = await parseJson(response);
  return { response, body };
};

const run = async () => {
  let server;
  const isRemoteTest = Boolean(process.env.TEST_API_BASE_URL);

  if (!isRemoteTest) {
    server = start(PORT);
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  try {
    const health = await requestJson(`${API_BASE_URL}/health`);
    if (!health.response.ok) {
      throw new Error(`Health check basarisiz: ${health.response.status}`);
    }

    const payload = {
      deviceId: TEST_DEVICE_ID,
      temperature: 24.6,
      humidity: 51.2,
      soundLevel: 30.4,
      battery: 87,
      timestamp: new Date().toISOString(),
    };

    const ingest = await requestJson(`${API_BASE_URL}/api/v1/sensors/ingest`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-device-key": DEVICE_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    if (ingest.response.status !== 201) {
      throw new Error(
        `Ingest basarisiz (${ingest.response.status}): ${JSON.stringify(ingest.body)}`
      );
    }

    const latest = await requestJson(
      `${API_BASE_URL}/api/v1/sensors/latest?deviceId=${encodeURIComponent(TEST_DEVICE_ID)}`
    );
    if (!latest.response.ok) {
      throw new Error(`Latest basarisiz: ${latest.response.status}`);
    }

    console.log("Smoke test basarili.");
    console.log("Ingest:", ingest.body);
    console.log("Latest:", latest.body);
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  }
};

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
