#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <SPI.h>
#include <MFRC522.h>

// ===== Pins (ESP32 + MFRC522) =====
#define RST_PIN  22     // RST to GPIO22
#define SS_PIN   5      // SDA/SS to GPIO5
// SPI: SCK=18, MOSI=23, MISO=19

// ===== WiFi Credentials (Primary and Fallback) =====
static const char WIFI_SSID_PRIMARY[] = "The Metropolitan WiFi";
static const char WIFI_PASS_PRIMARY[] = "invitedclubs";
static const char WIFI_SSID_FALLBACK[] = "Not Your Mothers WiFi";
static const char WIFI_PASS_FALLBACK[] = "240Blima35!!";

// ===== Supabase =====
static const char SUPABASE_URL[]    = "https://yyqbzhxwksmefrrfiuou.supabase.co/rest/v1/rfid_scans";
static const char SUPABASE_APIKEY[] = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5cWJ6aHh3a3NtZWZycmZpdW91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2OTQ1NTcsImV4cCI6MjA3MDI3MDU1N30.pkJvCevT3hBM1GTwg7Rsht1Z7MLCOcBfirhIgOINsR0";

// ===== Station =====
static const char* STATION_ID = "aa777174-2312-4f77-a2e0-167f3edf6714"; // Station 2 ID - Using provided UUID

// ===== Globals =====
MFRC522 rfid(SS_PIN, RST_PIN);

// Safe manual init to avoid hangs inside PCD_Init on marginal wiring
static bool initRFIDSafe() {
  // Avoid library soft reset which may hang on marginal links; rely on external RST pulse already done
  delay(5);

  // Sanity check: read VersionReg a few times with timeout protection
  int ok = 0; byte v = 0;
  for (int i = 0; i < 3; ++i) {
    Serial.print("  initSafe[ver]"); Serial.print(i);
    // Safe read with timeout
    unsigned long start = millis();
    v = 0;
    while (millis() - start < 50) { // 50ms timeout per read
      v = rfid.PCD_ReadRegister(MFRC522::VersionReg);
      if (v == 0x91 || v == 0x92) {
        ok++;
        break;
      }
      delay(2);
    }
    Serial.print(": 0x"); Serial.println(v, HEX);
    delay(10);
  }
  
  // Only continue if at least one read worked
  if (ok == 0) {
    Serial.println("  No valid version reads, skipping init");
    return false;
  }

  Serial.println("  Setting timer registers...");
  // Configure timer as in MFRC522.cpp defaults - with timeouts
  bool success = true;
  success &= safeWriteReg(MFRC522::TModeReg, 0x80);
  success &= safeWriteReg(MFRC522::TPrescalerReg, 0xA9);
  success &= safeWriteReg(MFRC522::TReloadRegH, 0x03);
  success &= safeWriteReg(MFRC522::TReloadRegL, 0xE8);
  
  Serial.println("  Setting ASK and mode registers...");
  // 100% ASK, CRC preset
  success &= safeWriteReg(MFRC522::TxASKReg, 0x40);
  success &= safeWriteReg(MFRC522::ModeReg, 0x3D);

  Serial.println("  Turning antenna on...");
  // Antenna on (simplified)
  success &= safeWriteReg(MFRC522::TxControlReg, 0x83); // Direct antenna control

  delay(5);

  // Final verification
  v = rfid.PCD_ReadRegister(MFRC522::VersionReg);
  Serial.print("  initSafe[final]: 0x"); Serial.println(v, HEX);
  return success && ((ok > 0) || (v == 0x91 || v == 0x92));
}

// Safe register write with timeout
static bool safeWriteReg(MFRC522::PCD_Register reg, byte value) {
  unsigned long start = millis();
  byte readback = 0;
  
  // Try the write with timeout
  rfid.PCD_WriteRegister(reg, value);
  
  // Verify with readback and timeout
  while (millis() - start < 50) { // 50ms timeout
    readback = rfid.PCD_ReadRegister(reg);
    if (readback == value) {
      return true;
    }
    delay(2);
  }
  
  Serial.print("  Write failed: reg 0x");
  Serial.print(reg, HEX);
  Serial.print(" expected 0x");
  Serial.print(value, HEX);
  Serial.print(" got 0x");
  Serial.println(readback, HEX);
  return false;
}

static void sendToSupabase(const String& uid) {
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠️ No Wi-Fi connection — skipping Supabase send.");
    return;
  }
  
  // Create secure client with more permissive SSL settings
  WiFiClientSecure client;
  client.setInsecure(); // Disable certificate verification
  client.setTimeout(12000); // Increase timeout to 12 seconds
  
  Serial.println("📡 Initializing HTTP request...");
  HTTPClient http;
  
  // Begin HTTP session with detailed error handling
  if (!http.begin(client, SUPABASE_URL)) { 
    Serial.println("❌ http.begin failed - possible memory or connection issue"); 
    return; 
  }
  
  // Add required headers
  http.addHeader("apikey", SUPABASE_APIKEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_APIKEY);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Prefer", "return=minimal"); // Minimize response size
  
  // Create JSON payload
  String payload; payload.reserve(200);
  payload += "{";
  payload += "\"station_id\":\""; payload += STATION_ID; payload += "\",";
  payload += "\"uid\":\""; payload += uid; payload += "\"}";

  Serial.print("📤 Sending to Supabase: "); Serial.println(payload);
  
  // Set timeouts
  http.setTimeout(10000); // 10 second timeout
  
  // Send the POST request
  Serial.println("⏳ Sending POST request...");
  unsigned long requestStart = millis();
  int code = http.POST(payload);
  unsigned long requestTime = millis() - requestStart;
  
  // Detailed response handling with diagnostics
  Serial.print("POST Response Code: "); Serial.print(code); 
  Serial.print(" (took "); Serial.print(requestTime); Serial.println("ms)");
  
  if (code == -1) {
    Serial.print("❌ HTTP Error: "); 
    Serial.println(http.errorToString(code));
    Serial.println("   Common causes: SSL handshake failed, timeout, or connection refused");
    Serial.println("   Ensure Supabase URL is correct and internet connection is stable");
  } else if (code == 201) {
    Serial.println("✅ Data successfully sent to Supabase!");
  } else if (code > 0) {
    String resp = http.getString();
    Serial.print("📄 Response: "); Serial.println(resp);
  }
  
  http.end();
  Serial.println("HTTP session closed");
}

void setup() {
  delay(1200);
  Serial.begin(115200);
  Serial.println();
  Serial.println("🔌 Booting (Station 2)...");

  // WiFi - Enhanced connection with multiple attempts
  WiFi.mode(WIFI_STA);
  WiFi.disconnect(true);  // Clear any previous connection
  delay(1000);
  
  bool connected = false;
  
  // Try primary WiFi with multiple attempts
  for (int attempt = 1; attempt <= 3 && !connected; attempt++) {
    Serial.print("Connecting to Primary WiFi (Attempt "); Serial.print(attempt); Serial.print("/3): ");
    Serial.println(WIFI_SSID_PRIMARY);
    
    WiFi.begin(WIFI_SSID_PRIMARY, WIFI_PASS_PRIMARY);
    
    // Wait up to 20 seconds with status checks
    uint32_t start = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
      delay(500);
      Serial.print('.');
      
      // Check for specific error states
      if (WiFi.status() == WL_CONNECT_FAILED) {
        Serial.println("\n❌ Connection failed - wrong password?");
        break;
      }
      if (WiFi.status() == WL_NO_SSID_AVAIL) {
        Serial.println("\n❌ Network not found");
        break;
      }
    }
    Serial.println();
    
    if (WiFi.status() == WL_CONNECTED) {
      connected = true;
      Serial.print("✅ Connected to Primary WiFi - IP: "); Serial.println(WiFi.localIP());
      Serial.print("Signal Strength: "); Serial.print(WiFi.RSSI()); Serial.println(" dBm");
    } else {
      Serial.println("Primary attempt failed, retrying...");
      WiFi.disconnect();
      delay(2000);
    }
  }
  
  // Try fallback WiFi if primary failed
  if (!connected) {
    for (int attempt = 1; attempt <= 3 && !connected; attempt++) {
      Serial.print("Connecting to Fallback WiFi (Attempt "); Serial.print(attempt); Serial.print("/3): ");
      Serial.println(WIFI_SSID_FALLBACK);
      
      WiFi.begin(WIFI_SSID_FALLBACK, WIFI_PASS_FALLBACK);
      
      uint32_t start = millis();
      while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
        delay(500);
        Serial.print('.');
        
        if (WiFi.status() == WL_CONNECT_FAILED) {
          Serial.println("\n❌ Connection failed - wrong password?");
          break;
        }
        if (WiFi.status() == WL_NO_SSID_AVAIL) {
          Serial.println("\n❌ Network not found");
          break;
        }
      }
      Serial.println();
      
      if (WiFi.status() == WL_CONNECTED) {
        connected = true;
        Serial.print("✅ Connected to Fallback WiFi - IP: "); Serial.println(WiFi.localIP());
        Serial.print("Signal Strength: "); Serial.print(WiFi.RSSI()); Serial.println(" dBm");
      } else {
        Serial.println("Fallback attempt failed, retrying...");
        WiFi.disconnect();
        delay(2000);
      }
    }
  }
  
  if (!connected) {
    Serial.println("❌ ALL WiFi connection attempts failed!");
    Serial.println("📡 Scanning for available networks...");
    int n = WiFi.scanNetworks();
    for (int i = 0; i < n; i++) {
      Serial.print("  Found: "); Serial.print(WiFi.SSID(i));
      Serial.print(" (Signal: "); Serial.print(WiFi.RSSI(i)); Serial.println(" dBm)");
    }
  }

  // Enhanced SPI and RFID initialization with detailed logging
  Serial.println("Starting SPI bus initialization...");
  SPI.begin();
  Serial.println("SPI bus initialized successfully");
  
  Serial.println("Starting RFID reader initialization...");
  rfid.PCD_Init();
  
  // Check RFID reader version to verify initialization
  byte v = rfid.PCD_ReadRegister(MFRC522::VersionReg);
  Serial.print("RFID Reader Version: 0x");
  Serial.println(v, HEX);
  
  if (v == 0x91 || v == 0x92) {
    Serial.println("✅ MFRC522 RFID reader initialized successfully!");
  } else {
    Serial.println("⚠️ MFRC522 initialization might have issues. Unexpected version.");
  }
  
  Serial.println("📶 RFID Reader Ready (Station 2). Scan a tag...");
}

// Global tracking variables
static unsigned long lastScanTime = 0;
static String lastUID = "";
static byte consecutiveFailures = 0;
static unsigned long lastWiFiCheckTime = 0;

// Check and reconnect WiFi if needed
static bool checkWiFiConnection() {
  if (WiFi.status() == WL_CONNECTED) {
    return true;
  }
  
  // WiFi is disconnected, attempt to reconnect with multiple attempts
  Serial.println("🔌 WiFi disconnected, reconnecting...");
  WiFi.disconnect(true);  // Clear any previous connection
  delay(1000);
  WiFi.mode(WIFI_STA);
  
  bool connected = false;
  
  // Try primary WiFi with multiple attempts
  for (int attempt = 1; attempt <= 3 && !connected; attempt++) {
    Serial.print("Reconnecting to Primary WiFi (Attempt "); Serial.print(attempt); Serial.print("/3): ");
    Serial.println(WIFI_SSID_PRIMARY);
    
    WiFi.begin(WIFI_SSID_PRIMARY, WIFI_PASS_PRIMARY);
    
    // Wait up to 20 seconds with status checks
    unsigned long startAttempt = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 20000) {
      delay(500);
      Serial.print('.');
      
      // Check for specific error states
      if (WiFi.status() == WL_CONNECT_FAILED) {
        Serial.println("\n❌ Connection failed - wrong password?");
        break;
      }
      if (WiFi.status() == WL_NO_SSID_AVAIL) {
        Serial.println("\n❌ Network not found");
        break;
      }
    }
    Serial.println();
    
    if (WiFi.status() == WL_CONNECTED) {
      connected = true;
      Serial.print("✅ Reconnected to Primary WiFi - IP: "); Serial.println(WiFi.localIP());
      Serial.print("Signal Strength: "); Serial.print(WiFi.RSSI()); Serial.println(" dBm");
    } else {
      Serial.println("Primary reconnect attempt failed, retrying...");
      WiFi.disconnect();
      delay(2000);
    }
  }
  
  // Try fallback WiFi if primary failed
  if (!connected) {
    for (int attempt = 1; attempt <= 3 && !connected; attempt++) {
      Serial.print("Reconnecting to Fallback WiFi (Attempt "); Serial.print(attempt); Serial.print("/3): ");
      Serial.println(WIFI_SSID_FALLBACK);
      
      WiFi.begin(WIFI_SSID_FALLBACK, WIFI_PASS_FALLBACK);
      
      unsigned long startAttempt = millis();
      while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 20000) {
        delay(500);
        Serial.print('.');
        
        if (WiFi.status() == WL_CONNECT_FAILED) {
          Serial.println("\n❌ Connection failed - wrong password?");
          break;
        }
        if (WiFi.status() == WL_NO_SSID_AVAIL) {
          Serial.println("\n❌ Network not found");
          break;
        }
      }
      Serial.println();
      
      if (WiFi.status() == WL_CONNECTED) {
        connected = true;
        Serial.print("✅ Reconnected to Fallback WiFi - IP: "); Serial.println(WiFi.localIP());
        Serial.print("Signal Strength: "); Serial.print(WiFi.RSSI()); Serial.println(" dBm");
      } else {
        Serial.println("Fallback reconnect attempt failed, retrying...");
        WiFi.disconnect();
        delay(2000);
      }
    }
  }
  
  // Check result
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("✅ WiFi reconnected. IP: ");
    Serial.println(WiFi.localIP());
    return true;
  } else {
    Serial.println("❌ WiFi reconnect failed");
    return false;
  }
}

void loop() {
  // Enhanced RFID detection with detailed logging
  
  // Check for new cards with debug info every 2 seconds
  static unsigned long lastDebugTime = 0;
  if (millis() - lastDebugTime > 2000) {
    Serial.println("Waiting for RFID tag...");
    lastDebugTime = millis();
  }
  
  // First check - new card present
  if (!rfid.PICC_IsNewCardPresent()) {
    delay(10);
    return;
  }
  
  Serial.println("Card detected! Attempting to read...");
  
  // Second check - can read card serial
  if (!rfid.PICC_ReadCardSerial()) {
    Serial.println("⚠️ Card detected but couldn't read serial - try again");
    delay(10);
    return;
  }
  
  Serial.println("✅ Card read successfully!");

  // Build UID string (uppercase, spaced)
  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) uid += "0";  // Add leading zero for single digit hex
    uid += String(rfid.uid.uidByte[i], HEX);
    if (i < rfid.uid.size - 1) uid += " ";
  }
  uid.toUpperCase();

  Serial.print("🎯 Card UID: ");
  Serial.println(uid);

  if (WiFi.status() == WL_CONNECTED) {
    sendToSupabase(uid);
  } else {
    Serial.println("⚠️ No Wi-Fi connection — skipping Supabase send.");
  }

  rfid.PICC_HaltA();
  delay(600);
}
