#include <SPI.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// WiFi credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Station configuration - DO NOT CHANGE THESE UUIDs
// Station 1: "04bc0dd5-a929-40f7-85d4-db99555b21db"
// Station 3: "e8a06b61-7a9e-4252-8606-cd6ebcc9f396"
const char* STATION_UUID = "04bc0dd5-a929-40f7-85d4-db99555b21db"; // Change for each station
const char* GAME_ID = "a492f49a-8a95-443c-9d78-0eacb43327b0";

// Supabase configuration
const char* SUPABASE_URL = "https://yyqbzhxwksmefrrfiuou.supabase.co/rest/v1/rfid_scans";
const char* SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5cWJ6aHh3a3NtZWZycmZpdW91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2OTQ1NTcsImV4cCI6MjA3MDI3MDU1N30.pkJvCevT3hBM1GTwg7Rsht1Z7MLCOcBfirhIgOINsR0";

// RFID reader pins
#define RST_PIN 22
#define SS_PIN  5

MFRC522 rfid(SS_PIN, RST_PIN);
MFRC522::MIFARE_Key key;

// Helper function to get UID as string
String getUID() {
  String uidString = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) {
      uidString += "0";
    }
    uidString += String(rfid.uid.uidByte[i], HEX);
    uidString.toUpperCase();
    if (i < rfid.uid.size - 1) {
      uidString += " ";
    }
  }
  return uidString;
}

void setup() {
  Serial.begin(115200);
  
  // Initialize SPI and RFID
  SPI.begin();
  rfid.PCD_Init();
  
  // Print RFID reader details
  rfid.PCD_DumpVersionToSerial();
  
  // Connect to WiFi
  Serial.println();
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);
  
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  
  Serial.println();
  Serial.print("✅ IP: ");
  Serial.println(WiFi.localIP());
  Serial.print("📶 RFID Reader Ready (");
  Serial.print(STATION_UUID == "04bc0dd5-a929-40f7-85d4-db99555b21db" ? "Station 1" : "Station 3");
  Serial.println("). Scan a tag...");
}

void loop() {
  // Check if a new RFID card is present
  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    String uid = getUID();
    Serial.print("🎯 Card UID: ");
    Serial.println(uid);
    
    // Send to Supabase
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("📡 Initializing HTTP request...");
      
      HTTPClient http;
      http.begin(SUPABASE_URL);
      http.addHeader("Content-Type", "application/json");
      http.addHeader("apikey", SUPABASE_KEY);
      http.addHeader("Authorization", "Bearer " + String(SUPABASE_KEY));
      http.addHeader("Prefer", "return=minimal");
      
      // Create JSON payload
      String jsonPayload = "{\"game_id\":\"" + String(GAME_ID) + "\",\"station_id\":\"" + String(STATION_UUID) + "\",\"uid\":\"" + uid + "\"}";
      
      Serial.print("📤 Sending to Supabase: ");
      Serial.println(jsonPayload);
      
      Serial.println("⏳ Sending POST request...");
      unsigned long startTime = millis();
      int httpResponseCode = http.POST(jsonPayload);
      unsigned long duration = millis() - startTime;
      
      Serial.print("POST Response Code: ");
      Serial.print(httpResponseCode);
      Serial.print(" (took ");
      Serial.print(duration);
      Serial.println("ms)");
      
      if (httpResponseCode > 0) {
        String response = http.getString();
        Serial.print("📄 Response: ");
        Serial.println(response);
        
        // Try to parse and debug the response JSON
        if (response.length() > 0) {
          DynamicJsonDocument doc(1024);
          DeserializationError error = deserializeJson(doc, response);
          
          if (!error) {
            Serial.println("✅ JSON Response parsed successfully");
            if (doc.containsKey("code")) {
              Serial.print("❌ Error code: ");
              Serial.println(doc["code"].as<String>());
            }
            if (doc.containsKey("message")) {
              Serial.print("❌ Error message: ");
              Serial.println(doc["message"].as<String>());
            }
            if (doc.containsKey("hint")) {
              Serial.print("💡 Hint: ");
              Serial.println(doc["hint"].as<String>());
            }
            if (doc.containsKey("details")) {
              Serial.print("🔍 Details: ");
              Serial.println(doc["details"].as<String>());
            }
          } else {
            Serial.print("❌ JSON parse error: ");
            Serial.println(error.c_str());
          }
        }
        
        // Brief delay
        delay(200);
      } else {
        Serial.print("❌ Error: ");
        Serial.println(http.errorToString(httpResponseCode));
        
        // Brief delay on error
        delay(500);
      }
      
      http.end();
      Serial.println("HTTP session closed");
      Serial.println();
    } else {
      Serial.println("❌ WiFi not connected");
    }
    
    // Halt PICC and stop encryption
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
    
    // Wait before reading the same card again
    delay(1000);
  }
}
