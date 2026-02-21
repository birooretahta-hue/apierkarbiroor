# apibirtar

ESP32'den gelen sensor verilerini alan, saklayan ve web paneline canli ileten Node.js + Express API.

## Kurulum

```bash
cmd /c npm install
```

`.env` olustur:

```powershell
Copy-Item .env.example .env
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

## Railway Deploy

Bu repo Railway icin hazir. `railway.json` ile:

- `npm start` ile baslar
- `GET /health` ile healthcheck yapar

Deploy adimlari:

1. Reponu GitHub'a push et.
2. Railway'de `New Project` -> `Deploy from GitHub repo` sec.
3. Gerekirse sadece `MAX_SENSOR_READINGS` gibi env degiskenlerini ekle.
4. `PORT` degiskenini ekleme, Railway otomatik verir.

Railway URL ile test:

```powershell
$env:TEST_API_BASE_URL = "https://apierkarbiroor-production.up.railway.app/"
cmd /c npm run test:ingest
```

## Ortam Degiskenleri

- `PORT` (varsayilan: `3000`)
- `MAX_SENSOR_READINGS` (varsayilan: `1000`)
- `TEST_DEVICE_ID` (smoke testte kullanilir)
- `TEST_API_BASE_URL` (opsiyonel: uzaktaki API'yi test etmek icin)

PowerShell:

```powershell
$env:PORT = "3000"
cmd /c npm start
```

`.env` ile:

```env
PORT=3000
MAX_SENSOR_READINGS=1000
```

## Test Sistemi

Otomatik testler:

```bash
cmd /c npm test
```

Smoke test (calisan API akisi):

```bash
cmd /c npm run test:ingest
```

`npm test` su kontrolleri yapar:

- `GET /health`
- `POST /api/v1/sensors/ingest` (API key olmadan)
- Veri dogrulama hatalari

`npm run test:ingest` su kontrolleri yapar:

- `GET /health`
- `POST /api/v1/sensors/ingest`
- `GET /api/v1/sensors/latest`

## Sensor Endpointleri

- `POST /api/v1/sensors/ingest` (ESP32 veri gonderir)
- `GET /api/v1/sensors/latest?deviceId=esp32-1`
- `GET /api/v1/sensors/history?deviceId=esp32-1&limit=50`
- `GET /api/v1/sensors/stream?deviceId=esp32-1` (SSE canli akis)

### POST /api/v1/sensors/ingest

Header:

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
