const path = require("path");
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const DEVICE_API_KEY = process.env.DEVICE_API_KEY || "esp32-demo-key";
const MAX_SENSOR_READINGS = Number(process.env.MAX_SENSOR_READINGS) || 1000;

app.use(cors());
app.use(express.json({ limit: "32kb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

let nextTodoId = 2;
let todos = [
  {
    id: 1,
    title: "Ilk gorev",
    completed: false,
    createdAt: new Date().toISOString(),
  },
];

let nextReadingId = 1;
let sensorReadings = [];
const sensorStreamClients = new Set();

const parseBool = (value) => {
  if (value === undefined) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
};

const toNumberOrNull = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return number;
};

const normalizeDeviceId = (value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const getLatestSensorReading = (deviceId) => {
  if (sensorReadings.length === 0) return null;
  if (!deviceId) return sensorReadings[sensorReadings.length - 1];

  for (let index = sensorReadings.length - 1; index >= 0; index -= 1) {
    const reading = sensorReadings[index];
    if (reading.deviceId === deviceId) return reading;
  }

  return null;
};

const trimSensorHistory = () => {
  if (sensorReadings.length <= MAX_SENSOR_READINGS) return;
  sensorReadings = sensorReadings.slice(sensorReadings.length - MAX_SENSOR_READINGS);
};

const sendSensorUpdateToStreams = (reading) => {
  const payload = `event: sensor\ndata: ${JSON.stringify(reading)}\n\n`;
  for (const client of sensorStreamClients) {
    if (client.deviceId && client.deviceId !== reading.deviceId) {
      continue;
    }
    try {
      client.res.write(payload);
    } catch (_error) {
      sensorStreamClients.delete(client);
    }
  }
};

const requireDeviceApiKey = (req, res, next) => {
  const key = req.get("x-device-key");
  if (key !== DEVICE_API_KEY) {
    return res.status(401).json({ message: "Gecersiz x-device-key" });
  }
  return next();
};

const createHistoryResponse = (req) => {
  const deviceId = normalizeDeviceId(req.query.deviceId);
  const rawLimit = req.query.limit;
  const parsedLimit = rawLimit !== undefined ? Number(rawLimit) : 100;
  const safeLimit = Number.isFinite(parsedLimit)
    ? Math.max(1, Math.min(Math.trunc(parsedLimit), 500))
    : 100;

  const filtered = deviceId
    ? sensorReadings.filter((reading) => reading.deviceId === deviceId)
    : sensorReadings;

  return filtered.slice(-safeLimit).reverse();
};

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "esp32-sensor-api",
  });
});

app.post("/api/v1/sensors/ingest", requireDeviceApiKey, (req, res) => {
  const body = req.body || {};
  const deviceId = normalizeDeviceId(body.deviceId);

  if (!deviceId) {
    return res.status(400).json({ message: "deviceId zorunludur" });
  }

  const metrics = {};
  const metricMap = [
    ["temperature", body.temperature],
    ["humidity", body.humidity],
    ["soundLevel", body.soundLevel ?? body.sound],
    ["pressure", body.pressure],
    ["battery", body.battery],
  ];

  for (const [key, value] of metricMap) {
    if (value === undefined) continue;
    const number = toNumberOrNull(value);
    if (number === null) {
      return res.status(400).json({ message: `${key} numeric olmalidir` });
    }
    metrics[key] = number;
  }

  if (Object.keys(metrics).length === 0) {
    return res
      .status(400)
      .json({ message: "En az bir sensor alani gonderilmelidir" });
  }

  let measuredAt = new Date();
  if (body.timestamp !== undefined) {
    measuredAt = new Date(body.timestamp);
    if (Number.isNaN(measuredAt.getTime())) {
      return res.status(400).json({ message: "timestamp gecersiz" });
    }
  }

  const reading = {
    id: nextReadingId++,
    deviceId,
    ...metrics,
    timestamp: measuredAt.toISOString(),
    receivedAt: new Date().toISOString(),
  };

  sensorReadings.push(reading);
  trimSensorHistory();
  sendSensorUpdateToStreams(reading);

  return res.status(201).json(reading);
});

app.get("/api/v1/sensors/latest", (req, res) => {
  const deviceId = normalizeDeviceId(req.query.deviceId);
  const latest = getLatestSensorReading(deviceId);
  if (!latest) {
    return res.status(404).json({ message: "Sensor verisi bulunamadi" });
  }
  return res.status(200).json(latest);
});

app.get("/api/v1/sensors/history", (req, res) => {
  return res.status(200).json(createHistoryResponse(req));
});

app.get("/api/v1/sensors", (req, res) => {
  return res.status(200).json(createHistoryResponse(req));
});

app.get("/api/v1/sensors/stream", (req, res) => {
  const deviceId = normalizeDeviceId(req.query.deviceId);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const client = { res, deviceId };
  sensorStreamClients.add(client);

  res.write(`event: ready\ndata: {"status":"connected"}\n\n`);

  const latest = getLatestSensorReading(deviceId);
  if (latest) {
    res.write(`event: sensor\ndata: ${JSON.stringify(latest)}\n\n`);
  }

  const heartbeat = setInterval(() => {
    res.write(": ping\n\n");
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    sensorStreamClients.delete(client);
    res.end();
  });
});

app.get("/api/v1/todos", (req, res) => {
  const completed = parseBool(req.query.completed);
  if (completed === null) {
    return res.status(400).json({
      message: "completed query parametresi sadece true veya false olabilir",
    });
  }

  const result =
    completed === undefined
      ? todos
      : todos.filter((item) => item.completed === completed);

  return res.status(200).json(result);
});

app.get("/api/v1/todos/:id", (req, res) => {
  const id = Number(req.params.id);
  const todo = todos.find((item) => item.id === id);

  if (!todo) {
    return res.status(404).json({ message: "Kayit bulunamadi" });
  }

  return res.status(200).json(todo);
});

app.post("/api/v1/todos", (req, res) => {
  const { title, completed = false } = req.body;

  if (typeof title !== "string" || title.trim().length === 0) {
    return res
      .status(400)
      .json({ message: "title alani zorunlu ve string olmalidir" });
  }

  if (typeof completed !== "boolean") {
    return res.status(400).json({ message: "completed alani boolean olmalidir" });
  }

  const todo = {
    id: nextTodoId++,
    title: title.trim(),
    completed,
    createdAt: new Date().toISOString(),
  };

  todos.push(todo);
  return res.status(201).json(todo);
});

app.put("/api/v1/todos/:id", (req, res) => {
  const id = Number(req.params.id);
  const todo = todos.find((item) => item.id === id);

  if (!todo) {
    return res.status(404).json({ message: "Kayit bulunamadi" });
  }

  const { title, completed } = req.body;
  if (title !== undefined) {
    if (typeof title !== "string" || title.trim().length === 0) {
      return res
        .status(400)
        .json({ message: "title alani string ve bos olmamalidir" });
    }
    todo.title = title.trim();
  }

  if (completed !== undefined) {
    if (typeof completed !== "boolean") {
      return res
        .status(400)
        .json({ message: "completed alani boolean olmalidir" });
    }
    todo.completed = completed;
  }

  return res.status(200).json(todo);
});

app.delete("/api/v1/todos/:id", (req, res) => {
  const id = Number(req.params.id);
  const initialLength = todos.length;
  todos = todos.filter((item) => item.id !== id);

  if (todos.length === initialLength) {
    return res.status(404).json({ message: "Kayit bulunamadi" });
  }

  return res.status(204).send();
});

app.use((_req, res) => {
  res.status(404).json({ message: "Endpoint bulunamadi" });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: "Beklenmeyen bir hata olustu" });
});

const start = (port = PORT) =>
  app.listen(port, () => {
    console.log(`API calisiyor: http://localhost:${port}`);
  });

if (require.main === module) {
  start();
}

module.exports = { app, start };
