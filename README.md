# apibirtar

ESP32'den gelen sensor verilerini alan, saklayan ve web paneline canli ileten Node.js + Express API.

## Kurulum

```bash
cmd /c npm install
```

## Calistirma

Gelisim:

```bash
cmd /c npm run dev
```

Normal:

```bash
cmd /c npm start
```

Sunucu acildiginda:

- API: `http://localhost:3000`
- Web panel: `http://localhost:3000/`

## Ortam Degiskenleri

- `PORT` (varsayilan: `3000`)
- `DEVICE_API_KEY` (varsayilan: `esp32-demo-key`)
- `MAX_SENSOR_READINGS` (varsayilan: `1000`)

PowerShell:

```powershell
$env:DEVICE_API_KEY = "benim-gizli-anahtarim"
cmd /c npm start
```

## Sensor Endpointleri

- `POST /api/v1/sensors/ingest` (ESP32 veri gonderir)
- `GET /api/v1/sensors/latest?deviceId=esp32-1`
- `GET /api/v1/sensors/history?deviceId=esp32-1&limit=50`
- `GET /api/v1/sensors/stream?deviceId=esp32-1` (SSE canli akis)

### POST /api/v1/sensors/ingest

Header:

- `x-device-key: <DEVICE_API_KEY>`
- `Content-Type: application/json`

Body ornegi:

```json
{
  "deviceId": "esp32-1",
  "temperature": 24.6,
  "humidity": 52.1,
  "soundLevel": 31.4,
  "battery": 87
}
```

`curl` testi:

```bash
curl -X POST http://localhost:3000/api/v1/sensors/ingest ^
  -H "x-device-key: esp32-demo-key" ^
  -H "Content-Type: application/json" ^
  -d "{\"deviceId\":\"esp32-1\",\"temperature\":24.6,\"humidity\":52.1,\"soundLevel\":31.4}"
```

## ESP32 Ornek Kod

```cpp
#include <WiFi.h>
#include <HTTPClient.h>

const char* ssid = "WIFI_ADI";
const char* pass = "WIFI_SIFRE";
const char* apiUrl = "http://192.168.1.10:3000/api/v1/sensors/ingest";
const char* apiKey = "esp32-demo-key";

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, pass);
  while (WiFi.status() != WL_CONNECTED) delay(500);
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(apiUrl);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-device-key", apiKey);

    float sicaklik = 24.5;   // kendi sensor degerini koy
    float nem = 50.0;        // kendi sensor degerini koy
    float ses = 30.2;        // kendi sensor degerini koy

    String body = "{\"deviceId\":\"esp32-1\",\"temperature\":" + String(sicaklik, 1) +
                  ",\"humidity\":" + String(nem, 1) +
                  ",\"soundLevel\":" + String(ses, 1) + "}";

    int code = http.POST(body);
    Serial.println(code);
    http.end();
  }

  delay(5000);
}
```
