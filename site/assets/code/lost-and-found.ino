#include <Servo.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <MFRC522.h>

const int servoPin = 2;
const int redLedPin = 3;
const int greenLedPin = 4;
const int buzzerPin = 5;
const int rstPin = 9;
const int sdaPin = 10;

LiquidCrystal_I2C lcd(0x27, 16, 2);
MFRC522 rfid(sdaPin, rstPin);
Servo lockerServo;

String masterCard = "D34611DA";
String personalTags[] = { "538CC9D9", "77C01C2F" };
String itemTags[10] = { "B180BD02", "3D801C2F" };
String itemDescriptions[10] = { "", "" };
String itemOwners[10] = { "538CC9D9", "538CC9D9" };
int itemCount = 2;
bool masterMode = false;

void setup() {
  lcd.init();
  lcd.backlight();
  SPI.begin();
  rfid.PCD_Init();
  pinMode(redLedPin, OUTPUT);
  pinMode(greenLedPin, OUTPUT);
  pinMode(buzzerPin, OUTPUT);
  lockerServo.attach(servoPin);
  lockerServo.write(0);
  Serial.begin(9600);
  lcd.clear();
  lcd.print("Locker Ready");
  while (true) {
    if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
      break;
    }
  }
}

void loop() {
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) {
    return;
  }

  String scannedTag = getRFIDTag();

  if (scannedTag == masterCard) {
    masterMode = true;
    lcd.clear();
    lcd.print("Master Mode On");
    tone(buzzerPin, 1000, 500);
    delay(2000);
    lcd.clear();

    Serial.println("Scan item to register:");
    while (true) {
      if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
        String itemTag = getRFIDTag();
        lcd.clear();
        lcd.print("Register Item");
        Serial.println("Enter description for item:");

        while (!Serial.available())
          ;
        String description = Serial.readString();
        description.trim();

        itemTags[itemCount] = itemTag;
        itemDescriptions[itemCount] = description;
        itemOwners[itemCount] = "538CC9D9";
        itemCount++;

        lcd.clear();
        lcd.print("Item Registered");
        handleLocker();  // Open locker to allow item placement
        lcd.setCursor(0, 1);
        lcd.print(description);
        delay(3000);

        break;
      }
    }

    masterMode = false;
    lcd.clear();
    lcd.print("Master Mode Off");
    delay(2000);

    if (itemCount > 0) {
      autoListDescriptions();
    }
    return;
  }

  bool isPersonalTag = false;
  for (String tag : personalTags) {
    if (scannedTag == tag) {
      isPersonalTag = true;
      break;
    }
  }

  if (isPersonalTag && !masterMode) {
    if (itemCount == 0) {
      lcd.clear();
      lcd.print("No Items");
      delay(3000);
      lcd.clear();
      lcd.print("Locker Ready");
      tone(buzzerPin, 500, 500);
      delay(2000);
      return;
    }

    bool foundMatch = false;
    for (int i = 0; i < itemCount; i++) {
      if (itemOwners[i] == scannedTag) {
        lcd.clear();
        lcd.print("Item ID: ");
        lcd.print(itemTags[i]);
        handleLocker();

        for (int j = i; j < itemCount - 1; j++) {
          itemTags[j] = itemTags[j + 1];
          itemOwners[j] = itemOwners[j + 1];
          itemDescriptions[j] = itemDescriptions[j + 1];
        }
        itemTags[itemCount - 1] = "";
        itemOwners[itemCount - 1] = "";
        itemDescriptions[itemCount - 1] = "";
        itemCount--;

        if (itemCount > 0) {
          autoListDescriptions();
        } else {
          lcd.clear();
          lcd.print("Locker Ready");
        }

        foundMatch = true;
        break;

        foundMatch = true;
        break;
      }
    }

    if (!foundMatch) {
      lcd.clear();
      lcd.print("No Items Found");
      tone(buzzerPin, 500, 500);
      delay(3000);
      autoListDescriptions();
    }
    return;
  }

  lcd.clear();
  lcd.print("Access Denied");
  tone(buzzerPin, 500, 500);
  flashRedLed();
  delay(3000);
  lcd.clear();
  lcd.print("Locker Ready");
}

String getRFIDTag() {
  String tag = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) tag += "0";
    tag += String(rfid.uid.uidByte[i], HEX);
  }
  tag.toUpperCase();
  rfid.PICC_HaltA();
  return tag;
}

void handleLocker() {
  digitalWrite(greenLedPin, HIGH);
  tone(buzzerPin, 1000, 500);
  lockerServo.write(0);
  delay(8000);
  lockerServo.write(90);
  digitalWrite(greenLedPin, LOW);
}

void flashRedLed() {
  for (int i = 0; i < 3; i++) {
    digitalWrite(redLedPin, HIGH);
    delay(500);
    digitalWrite(redLedPin, LOW);
    delay(500);
  }
}

void autoListDescriptions() {
  int currentIndex = 0;
  while (true) {
    lcd.clear();
    lcd.print(itemDescriptions[currentIndex]);
    delay(3000);
    currentIndex = (currentIndex + 1) % itemCount;

    if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
      break;
    }
  }
}
