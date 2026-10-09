#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <SPI.h>
#include <MFRC522.h>

// Pin Definitions
const int redLed = 2;
const int greenLed = 3;
const int waterLevelSensor = 5;
const int buzzer = 6;
const int nmosWaterPump = 7;
const int rfidRst = 9;
const int rfidSda = 10;

// Create LCD Object: Address 0x27, 16 columns, 2 rows
LiquidCrystal_I2C lcd(0x27, 16, 2);

// Create RFID Object
MFRC522 rfid(rfidSda, rfidRst);

// Balance for RFID cards
int balance1 = 15; // UID: 6C F3 44 03
int balance2 = 5;  // UID: 5E EC 44 03

void setup() {
  Serial.begin(9600);
  initializePins();
  initializeLCD();
  initializeRFID();
  showStartupMessage();
}

void loop() {
  WaterLevelCheck();
  delay(5000); // Check water level every 5 seconds
}

// Method to initialize pins
void initializePins() {
  pinMode(redLed, OUTPUT);
  pinMode(greenLed, OUTPUT);
  pinMode(buzzer, OUTPUT);
  pinMode(nmosWaterPump, OUTPUT);
  pinMode(waterLevelSensor, INPUT);
}

// Method to initialize the LCD
void initializeLCD() {
  lcd.init();
  lcd.backlight();
}

// Method to initialize the RFID module
void initializeRFID() {
  SPI.begin();
  rfid.PCD_Init();
}

// Method to display the startup message
void showStartupMessage() {
  Serial.println("System Ready!");
  lcd.print("System Ready!");
  delay(4000);
  lcd.clear();
}

// Method to read water level sensor
bool isWaterLevelLow() {
  return digitalRead(waterLevelSensor) == LOW;
}

// Method to control the LEDs
void setLEDs(bool redOn, bool greenOn) {
  digitalWrite(redLed, redOn ? HIGH : LOW);
  digitalWrite(greenLed, greenOn ? HIGH : LOW);
}

// Method to control the buzzer
void controlBuzzer(bool on) {
  if (on) {
    tone(buzzer, 1000);
    delay(1000);
    noTone(buzzer);
  }
}

// Method to control the water pump
void controlWaterPump(bool on) {
  digitalWrite(nmosWaterPump, on ? HIGH : LOW);
}

// Method to display a message on the LCD
void displayMessage(const char* line1, const char* line2) {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(line1);
  lcd.setCursor(0, 1);
  lcd.print(line2);
}

// Method to check water level
bool waterLowMessageShown = false;

void WaterLevelCheck() {
  if (!isWaterLevelLow()) { // Water is present

    setLEDs(false, true); // Green LED ON, Red LED OFF
    controlBuzzer(false); // Buzzer OFF
    displayMessage("Welcome! Please", "scan bracelet");

    if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
      handleRFID();
    }
  } else { // Water is low
    if (!waterLowMessageShown) {
      Serial.println("Water Low! Refill required");
      waterLowMessageShown = true;
    }

    setLEDs(true, false); // Red LED ON, Green LED OFF
    for (int i = 0; i < 3; i++) { tone(buzzer, 1000); delay(300); noTone(buzzer); delay(300); } // Buzzer beeps for 1 second
    displayMessage("Water Low!", "Refill required");
  }
}

// Method to handle RFID scanning
void handleRFID() {
  String uid = "";
  Serial.println("Scanning NFC Tag...");

  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) {
      uid += "0"; // Add leading zero for single hex digits
    }
    uid += String(rfid.uid.uidByte[i], HEX);
  }
  uid.toUpperCase(); // Convert to uppercase for consistent comparison
  Serial.print("UID: ");
  Serial.println(uid);

  if (uid.equals("6CF34403")) { // Check UID 1

    Serial.print("Balance: ");
    Serial.println(balance1);

    processTransaction(&balance1);
  } else if (uid.equals("5EEC4403")) { // Check UID 2

    Serial.print("Balance: ");
    Serial.println(balance2);

    processTransaction(&balance2);
  } else {
    displayMessage("Unknown Tag", "Access Denied");
    delay(5000);
  }

  rfid.PICC_HaltA();
}

// Method to process the transaction
void processTransaction(int* balance) {
  if (*balance >= 6) {
    *balance -= 6;
    displayMessage("Pouring...", ("New balance: " + String(*balance)).c_str());
    delay(1000); // 1 second before water pump starts

    // Activate water pump and flashing green LED for 5 seconds
    for (int i = 0; i < 5; i++) {
      controlWaterPump(true); // Pump ON
      setLEDs(false, true);  // Green LED ON
      delay(500);
      setLEDs(false, false); // Green LED OFF
      delay(500);
    }

    controlWaterPump(false);
    delay(2000); // 2 seconds after water pump turns off
    displayMessage("Enjoy!", "");
    delay(3000);

  } else {
    displayMessage("Not enough funds", ("Balance: " + String(*balance)).c_str());
    for (int i = 0; i < 3; i++) { tone(buzzer, 1000); delay(300); noTone(buzzer); delay(300); }
    for (int i = 0; i < 4; i++) {
      setLEDs(true, false); // Red LED ON
      delay(500);
      setLEDs(false, false); // All LEDs OFF
      delay(500);
    }
  }

  displayMessage("Welcome!", "Scan bracelet");
}
