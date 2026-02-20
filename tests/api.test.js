const assert = require("node:assert/strict");
const { once } = require("node:events");
const test = require("node:test");

const { resetForTests, start } = require("../src/server");

let server;
let baseUrl;

const requestJson = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  return { response, body };
};

test.before(async () => {
  server = start(0);
  await once(server, "listening");

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Sunucu portu alinamadi");
  }

  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.beforeEach(() => {
  resetForTests();
});

test.after(async () => {
  if (!server) return;
  await new Promise((resolve) => server.close(resolve));
});

test("GET /health returns status ok", async () => {
  const { response, body } = await requestJson("/health");
  assert.equal(response.status, 200);
  assert.equal(body.status, "ok");
  assert.equal(body.service, "esp32-sensor-api");
});

test("POST /api/v1/sensors/ingest works without api key", async () => {
  const payload = {
    deviceId: "esp32-test-1",
    temperature: 25.2,
    humidity: 48.3,
    soundLevel: 29.1,
  };

  const ingest = await requestJson("/api/v1/sensors/ingest", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  assert.equal(ingest.response.status, 201);
  assert.equal(ingest.body.deviceId, payload.deviceId);
  assert.equal(ingest.body.temperature, payload.temperature);

  const latest = await requestJson(
    `/api/v1/sensors/latest?deviceId=${encodeURIComponent(payload.deviceId)}`
  );

  assert.equal(latest.response.status, 200);
  assert.equal(latest.body.deviceId, payload.deviceId);
  assert.equal(latest.body.temperature, payload.temperature);
});

test("POST /api/v1/sensors/ingest validates numeric fields", async () => {
  const invalidPayload = {
    deviceId: "esp32-test-2",
    temperature: "bad-value",
  };

  const ingest = await requestJson("/api/v1/sensors/ingest", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(invalidPayload),
  });

  assert.equal(ingest.response.status, 400);
  assert.equal(ingest.body.message, "temperature numeric olmalidir");
});
