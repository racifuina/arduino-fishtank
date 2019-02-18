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
String PORT = "8080";
String LAST_FEED = "";
String CURRENTSETTINGS = "000000000000000000000000";
boolean manualFeed = false;
int countTimeCommand;
boolean found = false;

SoftwareSerial esp8266(4, 5);

void setup() {
  Serial.begin(9600);
  esp8266.begin(9600);
  myservo.attach(SERVO_PIN);
  clock.begin();
  feed();
  sendCommand("AT+RST", 3, "OK");
  sendCommand("AT", 5, "OK");
  sendCommand("AT+CWJAP=\"" + AP + "\",\"" + PASS + "\"", 20, "OK");
  sendCommand("AT+CIPMUX=0", 5, "OK");
  sendCommand("AT+CIPMODE=0", 5, "OK");
}

void loop() {

  //LECTURA DE pH
  float Po = (1023 - analogRead(ph_pin)); //lectura analogica de la sonda (voltaje).
  float pHm = map(Po, 290, 406, 400, 700); //Conversión del valor obtenido del sensor en voltaje a nivel de pH en cientos.
  float pH = (pHm / 100); //División del valor de ph en cientos para obtener valor de ph verdadero.

  //LECTURA DE Temperatura
  Vo = analogRead(ThermistorPin); //lectura analogica del pin del Thermistor (Sensor de temperatura)(voltaje).
  R2 = R1 * (1023.0 / (float)Vo - 1.0); //
  logR2 = log(R2);
  T = (1.0 / (c1 + c2 * logR2 + c3 * logR2 * logR2 * logR2));
  T = T - 273.15; //Conversión de temperatura de Kelvin's a ºCentigrados.

  //FASE DE ENVÍO DE DATOS
  sendCommand("AT+CIPSTART=\"TCP\",\"" + HOST + "\"," + PORT, 5, "OK");
  String dataString = "GET /data?T=" + String(T) + "&P=" + String(pH) + "&F=" + LAST_FEED + "&S=" + CURRENTSETTINGS + "&M=" + manualFeed + " HTTP/1.1";
  manualFeed = false; //Reset de la variable de alimentación manual.
  sendCommand("AT+CIPSEND=" + String(dataString.length() + 4),5,"OK"); //Enviar comando para habilitar el envío de datos con
  sendData(dataString, 5, "SEND OK");

  //FASE FINAL
  delay(2000); //Pausa de 2 segundos.
}

void feed() {
  myservo.write(180);
  delay(1500);
  myservo.write(0);
  dt = clock.getDateTime();
  LAST_FEED = String(clock.dateFormat("YmdHi", dt));
}

void sendCommand(String command, int maxTime, char readReply[]) {
  Serial.print("Command => ");
  Serial.print(command);
  Serial.print(" ");
  delay(200);
  esp8266.println(command);
  delay(500);

  while (countTimeCommand < maxTime) {
    if (esp8266.find(readReply)) {
      found = true;
      break;
    }
    Serial.println("COMMAND RETRY");
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

void sendData(String command, int maxTime, char readReply[]) {
  Serial.print("DATA => ");
  Serial.print(command);
  Serial.print(" ");
  esp8266.println(command);
  delay(200);
  esp8266.println("");
  delay(1000);

  while (countTimeCommand < maxTime) {
    if (esp8266.find(readReply)) {
      found = true;
      break;
    }
    //esp8266.println("");
    Serial.println("DATA RETRY");
    countTimeCommand++;
    //delay(20);
  }

  Serial.print(" RESPONSE ");
  Serial.print(" (");
  Serial.print(esp8266.available());
  Serial.println("): ");

  if (esp8266.available() > 44) {
    if (esp8266.find("=")) {
      int position = 0;
      CURRENTSETTINGS = "";
      while(esp8266.available()) {
        char t = esp8266.read();
        Serial.print(t);
        if (position < 24) {
          CURRENTSETTINGS = CURRENTSETTINGS + String(t);
        }

        int year = 0;
        int month = 0;
        int day = 0;
        int hour = 0;
        int minute = 0;
        int second = 0;
        //YYYYMMDDHHmmss
        if (position == 24) {
          year += int(t) * 1000;
        }
        if (position == 25) {
          year += int(t) * 100;
        }
        if (position == 26) {
          year += int(t) * 10;
        }
        if (position == 27) {
          year += int(t);
        }

        if (position == 28) {
          month += int(t) * 10;
        }
        if (position == 29) {
          month += int(t);
        }

        if (position == 30) {
          day += int(t) * 10;
        }
        if (position == 31) {
          day += int(t);
        }

        if (position == 30) {
          minute += int(t) * 10;
        }
        if (position == 31) {
          minute += int(t);
        }

        if (position == 30) {
          second += int(t) * 10;
        }
        if (position == 31) {
          second += int(t);
        }

        if (position > 31) {
          Serial.print(year);
          Serial.print("-");
          Serial.print(month);
          Serial.print("-");
          Serial.print(day);
          Serial.print(" ");

          Serial.print(hour);
          Serial.print(":");
          Serial.print(minute);
          Serial.print(":");
          Serial.print(second);
          Serial.println("");
        }

        position++;
      }
    } else {
      Serial.print("not a valid SERVER response");
    }
  } else if (esp8266.find("FEED")) {
    Serial.print("FEED");
    manualFeed = true;
    feed();
  } else {
    Serial.print("OK");
  }

  Serial.println("");

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
