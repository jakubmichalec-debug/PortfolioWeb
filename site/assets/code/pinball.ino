#include <MD_Parola.h>
#include <MD_MAX72xx.h>

// ---------------- DOT MATRIX ----------------
#define HARDWARE_TYPE MD_MAX72XX::FC16_HW
#define MAX_DEVICES 4

#define TOP_MATRIX_CS_PIN 7
#define BOTTOM_MATRIX_CS_PIN A0

MD_Parola topMatrix = MD_Parola(HARDWARE_TYPE, TOP_MATRIX_CS_PIN, MAX_DEVICES);
MD_Parola bottomMatrix = MD_Parola(HARDWARE_TYPE, BOTTOM_MATRIX_CS_PIN, MAX_DEVICES);

// ---------------- INPUTS ----------------
const int trigPin = 2;
const int echoPin = A5;

// Buttons switched in code
const int leftButtonPin  = 4;
const int rightButtonPin = 3;

const int lowTargetPin   = A1;
const int highTargetPin  = A4;

// ---------------- OUTPUTS ----------------
const int leftFlipperOut  = 6;
const int rightFlipperOut = 5;
const int reloadOut       = 8;

// ---------------- GAME STATE ----------------
bool gameActive = false;
int ballsLeft = 0;
int score = 0;

bool ballWasDetected = false;

bool lastLowTargetState = HIGH;
bool lastHighTargetState = HIGH;

bool leftFlipperWasPressed = false;
bool rightFlipperWasPressed = false;

// ---------------- SETTINGS ----------------
const unsigned long reloadDelayMs = 3000;
const unsigned long reloadPulseMs = 300;

const unsigned long flipperFullPulseMs = 80;
const int flipperHoldPWM = 120;
const unsigned long maxHoldTimeMs = 1500;

// Reload triggers under 26 mm
const int lostBallDistanceMm = 26;

const unsigned long lostSensorCooldownMs = 10000;
unsigned long lastLostDetectionTime = 0;

// Print HC-SR04 distance every 5 seconds
unsigned long lastDistancePrintTime = 0;
const unsigned long distancePrintIntervalMs = 5000;

const int lowTargetPoints = 10;
const int highTargetPoints = 50;

void setup() {
  Serial.begin(9600);
  delay(500);

  Serial.println();
  Serial.println("===== PINBALL SYSTEM STARTING =====");

  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);

  pinMode(leftButtonPin, INPUT_PULLUP);
  pinMode(rightButtonPin, INPUT_PULLUP);

  pinMode(lowTargetPin, INPUT_PULLUP);
  pinMode(highTargetPin, INPUT_PULLUP);

  Serial.println("Inputs ready");

  pinMode(leftFlipperOut, OUTPUT);
  pinMode(rightFlipperOut, OUTPUT);
  pinMode(reloadOut, OUTPUT);

  analogWrite(leftFlipperOut, 0);
  analogWrite(rightFlipperOut, 0);
  digitalWrite(reloadOut, LOW);

  Serial.println("Outputs ready");

  topMatrix.begin();
  bottomMatrix.begin();

  topMatrix.setIntensity(2);
  bottomMatrix.setIntensity(2);

  topMatrix.displayClear();
  bottomMatrix.displayClear();

  topMatrix.setTextAlignment(PA_CENTER);
  bottomMatrix.setTextAlignment(PA_CENTER);

  Serial.println("Matrix displays initialized");

  Serial.println("System ready");
  Serial.println("Starting game automatically...");
  Serial.println("Reload trigger: distance under 26 mm");
  Serial.println("===================================");

  startGame();
}

void loop() {
  printDistanceEvery5Sec();

  if (!gameActive) {
    analogWrite(leftFlipperOut, 0);
    analogWrite(rightFlipperOut, 0);
    return;
  }

  handleLeftFlipper();
  handleRightFlipper();
  handleTargets();
  handleLostBall();
}

// ---------------- DISPLAY ----------------

void showMatrixText(const char* topText, const char* bottomText) {
  Serial.print("DISPLAY -> TOP: ");
  Serial.print(topText);
  Serial.print(" | BOTTOM: ");
  Serial.println(bottomText);

  topMatrix.displayClear();
  bottomMatrix.displayClear();

  topMatrix.setTextAlignment(PA_CENTER);
  bottomMatrix.setTextAlignment(PA_CENTER);

  topMatrix.print(topText);
  bottomMatrix.print(bottomText);
}

void showGameScreen() {
  char bottomBuffer[20];
  sprintf(bottomBuffer, "%d B:%d", score, ballsLeft);

  showMatrixText("SCORE", bottomBuffer);

  Serial.print("GAME SCREEN -> Score: ");
  Serial.print(score);
  Serial.print(" | Balls left: ");
  Serial.println(ballsLeft);
}

// ---------------- GAME ----------------

void startGame() {
  Serial.println("Starting new game...");

  gameActive = true;
  ballsLeft = 3;
  score = 0;

  ballWasDetected = false;
  lastLostDetectionTime = 0;

  showMatrixText("START", "GAME");
  delay(1500);

  showMatrixText("TAKE", "BALL");

  Serial.println("Reload solenoid pulse");
  pulseOutput(reloadOut, reloadPulseMs);

  delay(1000);
  showGameScreen();

  Serial.println("Game active");
}

// ---------------- FLIPPERS ----------------

void handleLeftFlipper() {
  bool buttonPressed = digitalRead(leftButtonPin) == LOW;

  if (!buttonPressed) {
    analogWrite(leftFlipperOut, 0);
    leftFlipperWasPressed = false;
    return;
  }

  if (!leftFlipperWasPressed) {
    leftFlipperWasPressed = true;

    Serial.println("LEFT FLIPPER PRESSED");

    analogWrite(leftFlipperOut, 255);
    delay(flipperFullPulseMs);
  }

  unsigned long holdStart = millis();

  while (digitalRead(leftButtonPin) == LOW) {
    analogWrite(leftFlipperOut, flipperHoldPWM);

    if (millis() - holdStart >= maxHoldTimeMs) {
      analogWrite(leftFlipperOut, 0);
      Serial.println("LEFT FLIPPER SAFETY OFF");
      break;
    }
  }

  analogWrite(leftFlipperOut, 0);
  Serial.println("LEFT FLIPPER RELEASED");
}

void handleRightFlipper() {
  bool buttonPressed = digitalRead(rightButtonPin) == LOW;

  if (!buttonPressed) {
    analogWrite(rightFlipperOut, 0);
    rightFlipperWasPressed = false;
    return;
  }

  if (!rightFlipperWasPressed) {
    rightFlipperWasPressed = true;

    Serial.println("RIGHT FLIPPER PRESSED");

    analogWrite(rightFlipperOut, 255);
    delay(flipperFullPulseMs);
  }

  unsigned long holdStart = millis();

  while (digitalRead(rightButtonPin) == LOW) {
    analogWrite(rightFlipperOut, flipperHoldPWM);

    if (millis() - holdStart >= maxHoldTimeMs) {
      analogWrite(rightFlipperOut, 0);
      Serial.println("RIGHT FLIPPER SAFETY OFF");
      break;
    }
  }

  analogWrite(rightFlipperOut, 0);
  Serial.println("RIGHT FLIPPER RELEASED");
}

// ---------------- TARGETS ----------------

void handleTargets() {
  bool lowTargetState = digitalRead(lowTargetPin);
  bool highTargetState = digitalRead(highTargetPin);

  if (lastLowTargetState == HIGH && lowTargetState == LOW) {
    score += lowTargetPoints;

    Serial.println("LOW TARGET HIT +10");

    showMatrixText("+10", "POINTS");
    delay(300);
    showGameScreen();
  }

  if (lastHighTargetState == HIGH && highTargetState == LOW) {
    score += highTargetPoints;

    Serial.println("HIGH TARGET HIT +50");

    showMatrixText("+50", "POINTS");
    delay(300);
    showGameScreen();
  }

  lastLowTargetState = lowTargetState;
  lastHighTargetState = highTargetState;
}

// ---------------- LOST BALL SENSOR ----------------

void handleLostBall() {
  if (millis() - lastLostDetectionTime < lostSensorCooldownMs) {
    return;
  }

  int distance = readDistanceMm();

  bool ballDetected = distance > 0 && distance < lostBallDistanceMm;

  if (!ballWasDetected && ballDetected) {
    lastLostDetectionTime = millis();

    Serial.print("BALL LOST DETECTED | Distance: ");
    Serial.print(distance);
    Serial.println(" mm");

    ballsLeft--;

    Serial.print("Balls left now: ");
    Serial.println(ballsLeft);

    if (ballsLeft > 0) {
      showMatrixText("BALL", "LOST");

      delay(reloadDelayMs);

      showMatrixText("RE", "LOAD");

      Serial.println("Reload solenoid pulse");
      pulseOutput(reloadOut, reloadPulseMs);

      delay(700);
      showGameScreen();
    } else {
      showMatrixText("GAME", "OVER");

      gameActive = false;

      Serial.println("GAME OVER");
      Serial.println("Restarting new game automatically...");

      delay(3000);
      startGame();
    }
  }

  ballWasDetected = ballDetected;
}

// ---------------- HC-SR04 DISTANCE PRINT ----------------

void printDistanceEvery5Sec() {
  if (millis() - lastDistancePrintTime >= distancePrintIntervalMs) {
    lastDistancePrintTime = millis();

    int distance = readDistanceMm();

    Serial.print("HC-SR04 distance: ");

    if (distance == -1) {
      Serial.println("NO READING");
    } else {
      Serial.print(distance);
      Serial.println(" mm");

      if (distance < lostBallDistanceMm) {
        Serial.println(">>> BALL DETECTED / RELOAD TRIGGER AREA <<<");
      } else {
        Serial.println("No ball detected");
      }
    }
  }
}

int readDistanceMm() {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);

  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  long duration = pulseIn(echoPin, HIGH, 30000);

  if (duration == 0) {
    return -1;
  }

  int distanceMm = duration * 0.343 / 2.0;
  return distanceMm;
}

// ---------------- OUTPUT PULSE ----------------

void pulseOutput(int pin, unsigned long durationMs) {
  Serial.print("PULSE pin ");
  Serial.print(pin);
  Serial.print(" for ");
  Serial.print(durationMs);
  Serial.println(" ms");

  digitalWrite(pin, HIGH);
  delay(durationMs);
  digitalWrite(pin, LOW);
}
