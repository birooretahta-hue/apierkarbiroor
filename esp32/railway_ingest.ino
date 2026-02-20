#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>

const char* ssid = "WIFI_ADI";
const char* pass = "WIFI_SIFRE";
const char* apiUrl = "https://<senin-servisin>.up.railway.app/api/v1/sensors/ingest";
const char* deviceId = "esp32-1";

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, pass);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi baglandi");
  randomSeed(micros());
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    WiFiClientSecure client;
    // Test/prototip icin sertifika dogrulamasini kapatir.
    // Uretimde sunucu sertifikasi pinning yapman onerilir.
    client.setInsecure();

    HTTPClient http;
    if (http.begin(client, apiUrl)) {
      http.addHeader("Content-Type", "application/json");

      float temperature = 20.0 + random(0, 100) / 10.0;
      float humidity = 40.0 + random(0, 300) / 10.0;
      float soundLevel = 25.0 + random(0, 200) / 10.0;

      String body = "{\"deviceId\":\"" + String(deviceId) +
                    "\",\"temperature\":" + String(temperature, 1) +
                    ",\"humidity\":" + String(humidity, 1) +
                    ",\"soundLevel\":" + String(soundLevel, 1) + "}";

      int code = http.POST(body);
      String response = http.getString();

      Serial.print("HTTP code: ");
      Serial.println(code);
      Serial.println(response);

      http.end();
    } else {
      Serial.println("HTTP begin basarisiz");
    }
  } else {
    Serial.println("WiFi baglantisi yok");
  }

  delay(5000);
}
