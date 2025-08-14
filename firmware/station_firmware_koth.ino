#include <SPI.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// WiFi credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Supabase API endpoints
const String supabaseUrl = "YOUR_SUPABASE_URL";
const String supabaseKey = "YOUR_SUPABASE_ANON_KEY";
const String scanEndpoint = "/api/rfid-scan";
const String stationControlEndpoint = "/api/station-control"; // New endpoint for station control

// Station configuration
const String stationId = "STATION_UUID"; // Replace with the actual UUID from your database
const String stationName = "Station 1"; // For display purposes only

// RC522 pins
#define SS_PIN 5
#define RST_PIN 22
MFRC522 rfid(SS_PIN, RST_PIN);

// LED pins for status indicators
#define LED_SCAN 2      // Built-in LED for scan indication
#define LED_ERROR 15    // Red LED for errors
#define LED_SUCCESS 4   // Green LED for successful scan

// Variables
unsigned long lastScanTime = 0;
unsigned long scanCooldown = 3000; // 3 seconds between scans
String lastScannedUID = "";

void setup() {
  Serial.begin(115200);
  SPI.begin();
  rfid.PCD_Init();
  
  // Initialize LEDs
  pinMode(LED_SCAN, OUTPUT);
  pinMode(LED_ERROR, OUTPUT);
  pinMode(LED_SUCCESS, OUTPUT);
  digitalWrite(LED_SCAN, LOW);
  digitalWrite(LED_ERROR, LOW);
  digitalWrite(LED_SUCCESS, LOW);
  
  // Connect to WiFi
  connectToWiFi();
  
  Serial.println("RFID Station Ready");
  Serial.print("Station ID: ");
  Serial.println(stationId);
  Serial.print("Station Name: ");
  Serial.println(stationName);
}

void loop() {
  // Check if WiFi is connected, reconnect if needed
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi connection lost. Reconnecting...");
    connectToWiFi();
  }
  
  // Check if there's a new card
  if (!rfid.PICC_IsNewCardPresent()) {
    return;
  }
  
  // Read the card
  if (!rfid.PICC_ReadCardSerial()) {
    return;
  }
  
  // Get current time
  unsigned long currentTime = millis();
  
  // Check for scan cooldown
  if (currentTime - lastScanTime < scanCooldown) {
    Serial.println("Scan cooldown active. Please wait.");
    blinkLED(LED_ERROR, 3, 100);
    return;
  }
  
  // Get RFID UID
  String uid = getUID();
  
  // Avoid duplicate scans
  if (uid == lastScannedUID) {
    Serial.println("Same card scanned. Ignoring.");
    blinkLED(LED_ERROR, 2, 200);
    return;
  }
  
  // Update last scan info
  lastScanTime = currentTime;
  lastScannedUID = uid;
  
  // Indicate scan
  digitalWrite(LED_SCAN, HIGH);
  Serial.println("Card detected!");
  Serial.print("UID: ");
  Serial.println(uid);
  
  // Send scan to server
  bool scanSuccess = sendScanToServer(uid);
  
  // Update station control for King of the Hill
  bool controlSuccess = updateStationControl(uid);
  
  // Indicate result
  if (scanSuccess && controlSuccess) {
    Serial.println("Scan and control update successful");
    blinkLED(LED_SUCCESS, 3, 200);
  } else {
    Serial.println("Scan or control update failed");
    blinkLED(LED_ERROR, 5, 100);
  }
  
  digitalWrite(LED_SCAN, LOW);
  delay(100);
}

void connectToWiFi() {
  Serial.print("Connecting to WiFi...");
  WiFi.begin(ssid, password);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
    blinkLED(LED_SCAN, 1, 100);
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.print("Connected to WiFi. IP: ");
    Serial.println(WiFi.localIP());
    blinkLED(LED_SUCCESS, 2, 500);
  } else {
    Serial.println();
    Serial.println("Failed to connect to WiFi!");
    blinkLED(LED_ERROR, 10, 100);
  }
}

String getUID() {
  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    uid += (rfid.uid.uidByte[i] < 0x10 ? "0" : "");
    uid += String(rfid.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();
  return uid;
}

bool sendScanToServer(String uid) {
  HTTPClient http;
  
  // Construct the full URL
  String url = supabaseUrl + scanEndpoint;
  
  // Prepare the JSON payload
  DynamicJsonDocument doc(256);
  doc["rfid_uid"] = uid;
  doc["station_id"] = stationId;
  
  // Serialize JSON to string
  String jsonPayload;
  serializeJson(doc, jsonPayload);
  
  Serial.print("Sending scan to server: ");
  Serial.println(jsonPayload);
  
  // Begin HTTP connection
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", supabaseKey);
  http.addHeader("Authorization", "Bearer " + supabaseKey);
  
  // Send POST request
  int httpCode = http.POST(jsonPayload);
  bool success = false;
  
  if (httpCode > 0) {
    String payload = http.getString();
    Serial.print("HTTP Response code: ");
    Serial.println(httpCode);
    Serial.print("Response: ");
    Serial.println(payload);
    success = (httpCode == 200 || httpCode == 201);
  } else {
    Serial.print("HTTP Error: ");
    Serial.println(http.errorToString(httpCode));
  }
  
  http.end();
  return success;
}

bool updateStationControl(String uid) {
  HTTPClient http;
  
  // Construct the full URL
  String url = supabaseUrl + stationControlEndpoint;
  
  // Prepare the JSON payload
  DynamicJsonDocument doc(256);
  doc["rfid_uid"] = uid;
  doc["station_id"] = stationId;
  
  // Serialize JSON to string
  String jsonPayload;
  serializeJson(doc, jsonPayload);
  
  Serial.print("Updating station control: ");
  Serial.println(jsonPayload);
  
  // Begin HTTP connection
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", supabaseKey);
  http.addHeader("Authorization", "Bearer " + supabaseKey);
  
  // Send POST request
  int httpCode = http.POST(jsonPayload);
  bool success = false;
  
  if (httpCode > 0) {
    String payload = http.getString();
    Serial.print("Control HTTP Response code: ");
    Serial.println(httpCode);
    Serial.print("Response: ");
    Serial.println(payload);
    success = (httpCode == 200 || httpCode == 201);
  } else {
    Serial.print("HTTP Error: ");
    Serial.println(http.errorToString(httpCode));
  }
  
  http.end();
  return success;
}

void blinkLED(int pin, int times, int delayMs) {
  for (int i = 0; i < times; i++) {
    digitalWrite(pin, HIGH);
    delay(delayMs);
    digitalWrite(pin, LOW);
    delay(delayMs);
  }
}
