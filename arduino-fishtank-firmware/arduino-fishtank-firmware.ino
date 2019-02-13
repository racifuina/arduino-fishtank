#include <Servo.h>
#include <DS3231.h>
#include <SoftwareSerial.h>

int ph_pin = A2; // -> PIN de lectura de la sonda.
int ThermistorPin = A0; // -> PIN de lectura de sensor de Temperatura.

int SERVO_PIN = 9; // -> PIN de lectura de sensor de Temperatura.
int Vo;
float R1 = 10000;
float logR2, R2, T;
float c1 = 1.009249522e-03, c2 = 2.378405444e-04, c3 = 2.019202697e-07;
Servo myservo;
DS3231 clock;
RTCDateTime dt;

String AP = "Naboo";
String PASS = "f6eb902f72";
String HOST = "3.87.250.63";
String PORT = "3000";

int countTimeCommand;
boolean found = false;

SoftwareSerial esp8266(4, 5);


void setup() {
  Serial.begin(9600);
  esp8266.begin(115200);
  myservo.attach(SERVO_PIN);
  feed();
  clock.begin();
  //clock.setDateTime(__DATE__, __TIME__); // Set sketch compiling time
  Serial.print("TIME: ");
  dt = clock.getDateTime();
  Serial.println(clock.dateFormat("d-m-Y H:i:s", dt));
  sendCommand("AT+RST",5,"OK");
  sendCommand("AT",5,"OK");
  sendCommand("AT+CWJAP=\""+ AP +"\",\""+ PASS +"\"",20,"OK");
  sendCommand("AT+CIPMUX=1",5,"OK");
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

  String getData = "{\"T\":\"" + String(T) + "\",\"P\":\"" + String(pH) + "\"}";

  sendCommand("AT+CIPSTATUS",5,"STATUS");
  sendCommand("AT+CIPSTART=0,\"TCP\",\""+ HOST +"\","+ PORT,15,"OK");
  sendCommand("AT+CIPSEND=0," +String(getData.length()+2),4,">");
  sendCommand(getData, 5,"OK");

  if (esp8266.available()) {
    int serialLength = esp8266.available();
    char message[serialLength];
    for (int pos = 0; pos < serialLength; pos++) {
      message[pos] = esp8266.read();
    }
    message[esp8266.available()] = 0;
    Serial.print("Serial: ");
    Serial.println( message);
  }
  delay(2000);
}

void feed() {
  myservo.write(180);
  delay(1500);
  myservo.write(0);
}

void sendCommand(String command, int maxTime, char readReply[]) {
  Serial.print("Command => ");
  Serial.print(command);
  Serial.print(" ");

  while (countTimeCommand < maxTime) {
    esp8266.println(command);

    if (esp8266.find(readReply)) {
      found = true;
      break;
    }

    countTimeCommand++;
  }

  if (found == true) {
    Serial.println("Success");
    countTimeCommand = 0;
  }

  if (found == false) {
    Serial.println("Fail");
    countTimeCommand = 0;
  }

  found = false;
}
