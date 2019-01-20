#include <Servo.h>
#include <Wire.h>//Libreria encargada de manejar la comunicación I2C con la pantalla.
#include <DS3231.h>
#include <SoftwareSerial.h>
#include "ESP8266.h"

int ph_pin = A2; // A2 -> PIN de lectura de la sonda (Analogico 2).

int SERVO_PIN = 9;
int ThermistorPin = 0;
int Vo;
float R1 = 10000;
float logR2, R2, T;
float c1 = 1.009249522e-03, c2 = 2.378405444e-04, c3 = 2.019202697e-07;
Servo myservo;
DS3231 clock;
RTCDateTime dt;

#define SSID        "Naboo"
#define PASSWORD    "f6eb902f72"
#define HOST_NAME   "157.230.159.39"
#define HOST_PORT   (3180)

SoftwareSerial mySerial(4, 5);
ESP8266 wifi(mySerial);

void setup() {
  myservo.attach(SERVO_PIN);
  myservo.write(0);
  clock.begin();
  //clock.setDateTime(__DATE__, __TIME__); // Set sketch compiling time
  // Manual (Year, Month, Day, Hour, Minute, Second)
  clock.setDateTime(1992, 1, 31, 0, 0, 0);

  Serial.begin(9600);


  delay(1000);
}

void loop() {
  float Po = (1023 - analogRead(ph_pin)); //lectura analogica de la sonda (voltaje).
  float pHm = map(Po, 290, 406, 400, 700); //Conversión del valor obtenido del sensor en voltaje a nivel de pH.
  float pH = (pHm/100);

  Vo = analogRead(ThermistorPin);
  R2 = R1 * (1023.0 / (float)Vo - 1.0);
  logR2 = log(R2);
  T = (1.0 / (c1 + c2*logR2 + c3*logR2*logR2*logR2));
  T = T - 273.15;

  Serial.print("{\"t\": \"");
  Serial.print(T);
  Serial.print("\"}");
  Serial.println("");

  dt = clock.getDateTime();
  Serial.println(dt.hour);

//  Serial.println(clock.dateFormat("H", dt));
  delay(1000);
}

void feed() {
  myservo.write(180);
  delay(1500);
  myservo.write(0);
}

void connectTCPServer() {
  Serial.print("TCP SERVER CONNECTION\r\n");

  if (wifi.createTCP(HOST_NAME, HOST_PORT)) {
    Serial.print("- CREATE TCP OK!\r\n");
    delay(500);
  } else {
    Serial.print("- CREATE TCP ERROR!\r\n");
    delay(500);
  }
}

void disconnectTCPServer() {
  Serial.print("TCP SERVER DISCONNECTION\r\n");

  if (wifi.releaseTCP()) {
    Serial.print("- RELEASE TCP OK!\r\n");
    delay(500);
  } else {
    Serial.print("- RELEASE TCP ER!\r\n");
    delay(500);
  }
}
