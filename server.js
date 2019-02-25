require('dotenv').config(); //CONFIGURACIÓN Y LECTURA DE VARIABLES DE ENTORNO.
console.log("*****  Starting mipecera.online Server *****");
//CONFIGURACIÓN DE LIBRERÍAS Y DEPENDENCIAS
const HTTP_PORT = process.env.PORT || 8080; //PUERTO DONDE SE HABILITARÁ EL SERVIDOR HTTP
const mongoose = require("mongoose"); //DRIVER DE CONEXIÓN A BASE DE DATOS DE MONGODB
const passport = require('passport'); //LIBRERÍA ENCARGADA DE AUTENTICAR Y MANEJAR LAS SESIONES DE USUARIOS
const LocalStrategy = require('passport-local').Strategy; //ESTRATEGÍA DE AUTENTICACIÓN LOCAL (USUARIO Y CONTRASEÑA)
const session = require('express-session'); //GESTION DE SESIONES DE USUARIOS
const sharedsession = require("express-socket.io-session"); //GESTION DE SESIONES DE USUARIOS EN WEBSOCKET.
const MongoStore = require('connect-mongo')(session); //DRIVER PARA GUARDAR SESIONES EN BASE DE DATOS.
const express = require("express"); //GESTOR DE SERVIDOR Y API
const app = express(); //CREACIÓN DEL SERVIDOR DE EXPRESS.JS
const http = require("http").Server(app); //CREACIÓN DEL SERVIDOR HTTP
const io = require("socket.io")(http); //INCIALIZACIÓN DEL WEBSOCKET
const moment = require('moment-timezone'); //LIBRERÍA QUE CONTROLA EL TIEMPO (FECHA Y HORA)
const fs = require('fs'); //SISTEMA DE ARCHIVOS (FILE SYSTEM)
const ejs = require('ejs'); //RENDERIZADOR DE VISTAS HTML
const bodyParser = require('body-parser'); //VALIDADOR DE PARAMETROS HTTP
const flash = require('connect-flash'); //GESTOR DE ALARMAS Y ALERTAS EN HTML
const nodemailer = require("nodemailer"); //DRIVER DE CORREO ELECTRÓNICO
const smtpTransportRequire = require("nodemailer-smtp-transport"); //DRIVER DE CORREO ELECTRÓNICO PARA GMAIL
mongoose.Promise = global.Promise; //GESTOR DE PROMESAS DE JAVASCRIPT

let mustFeed = false; //VARIABLE QUE INDICA SI HAY QUE ALIMENTAR MANUALMENTE O NO.

let currentSettings = { //CONFIGURACION DE ALIMENTACIÓN AUTOMÁTICA Y DE ENVÍO DE ALERTAS.
    feedSchedule: {
        h00: false,
        h01: false,
        h02: false,
        h03: false,
        h04: false,
        h05: false,
        h06: false,
        h07: false,
        h08: false,
        h09: false,
        h10: false,
        h11: false,
        h12: false,
        h13: false,
        h14: false,
        h15: false,
        h16: false,
        h17: false,
        h18: false,
        h19: false,
        h20: false,
        h21: false,
        h22: false,
        h23: false,
    },
    ph: {
        min: 4,
        max: 8
    },
    temp: {
        min: 15,
        max: 35
    },
    alertEmails: [process.env.EMAIL_USER]
};

let lastRecord = { //ÚLTIMO REGISTRO ENVIADO POR EL DISPOSITIVO
    date: "--",
    ph: 0,
    temp: 0,
    lastFeed: "--"
};

const smtpTransport = nodemailer.createTransport(smtpTransportRequire({ //CONNECTAR A SERVIDOR DE CORREOS ELECTRÓNICOS
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
}));

const User = require("./models/User"); //MODELO DE USUARIO EN BASE DE DATOS

passport.use(new LocalStrategy({ //ESTRATEGIA PARA AUTENTICAR AL USUARIO
    usernameField: 'email',
    passwordField: 'password'
}, function (email, password, done) {
    User.findOne({ //BUSCAR EN BASE DE DATOS EL CORREO ELECTRÓNICO
        email: email
    }).then(function (user) {
        if (!user) {
            return done(null, false, {
                message: 'Usuario incorrecto.'
            });
        }
        user.validatePassword(password, function validationResult(isValid) { //VALIDAR LA CONTRASEÑA.
            if (!isValid) {
                return done(null, false, {
                    message: 'Contraseña incorrecta.'
                });
            }
            return done(null, user, {
                message: 'Inicio de sesión exitoso.'
            });
        });
    }, function (error) {
        return done(null, false, {
            message: "Error de servidor. Por favor intente de nuevo."
        });
    });
}));

passport.serializeUser(function (user, done) { //FUNCIÓN ENCARGADA DE GUARDAR LA SESIÓN DEL USUARIO.
    done(null, user._id);
});

passport.deserializeUser(function (userId, done) { //FUNCIÓN ENCARGADA DE OBTENER LA SESIÓN DEL USUARIO.
    User.findById(userId, function (err, user) {
        done(err, user);
    });
});

//CONFIGURACIÓN DE CONEXIÓN A BASE DE DATOS DE MONGODB
const mongooseOptions = {
    user: process.env.DB_USERNAME,
    pass: process.env.DB_PASSWORD,
    useCreateIndex: true,
    useNewUrlParser: true,
    autoReconnect: true
}

mongoose.connect("mongodb://" + process.env.DB_URL + "/mipecera", mongooseOptions); //CONECTAR A BASE DE DATOS

//CONFIGURACIÓN DE EXPRESS MIDDLEWARE
app.use(express.static('public')); //CARPETA DE ACCESO PUBLICO (.JS, .CSS, IMAGENES, ETC.).
app.set('views', __dirname + '/views/'); //CARPETA CON LAS VISTAS HTML PARA USAR
app.engine('html', ejs.renderFile); //INICIALIZACIÓN DE LA LIBRERÍA QUE VA A RENDERIZAR LAS VISTAS
app.set('view engine', 'ejs'); //CONFIGURACIÓN DE LA LIBRERÍA QUE VA A RENDERIZAR LAS VISTAS
app.use(flash()); //INCIALIZAR LA LIBRERÍA GESTORA DE ALERTAS EN HTML
app.use(bodyParser.urlencoded({ //LIBRERÍA QUE VALIDA LOS DATOS ENVIADOS EN FORMULARIOS
    extended: true,
}));

const customSession = session({ //CONFIGURACIÓN DE LA COOKIE DE SESIÓN DE USUARIO.
    secret: process.env.TOKEN_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 2592000000, //TIEMPO DE VIDA DE LA SESIÓN  => 1 MES
    },
    store: new MongoStore({
        mongooseConnection: mongoose.connection
    })
});
//CONFIGURACIÓN DELA SESIÓN DE USUARIO
app.use(customSession);
app.use(passport.initialize());
app.use(passport.session());


//FUNCIÓN DE MIDDLEWARE PARA EXPRESS.JS ENCARGADA DE REVISAR QUE LA REQUEST HTTP SEA DE UN USUARIO QUE HAYA INICIADO SESIÓN.
function requireAuthentication(req, res, next) {
    if (!req.isAuthenticated()) {
        req.session.returnTo = req.url;
        req.flash("error", "Debes iniciar sesión para acceder a este recurso");
        res.redirect('/login');
    } else {
        next();
    }
};

app.get('/login', function (req, res) { //RUTA LOGIN PARA INCIAR SESIÓN. O CREAR EL NUEVO USUARIO SI NO EXISTE NINGUNO AÚN.
    User.countDocuments().then(userCount => {
        if (userCount > 0) {
            res.render(__dirname + '/views/authentication/login.html', {
                message: req.flash('message'),
                error: req.flash('error')
            });
        } else {
            res.render(__dirname + '/views/authentication/newuser.html', {
                message: req.flash('message'),
                error: req.flash('error')
            });
        }
    }, error => {
        res.status(500);
        return res.sendFile(__dirname + '/views/http_errors/500.html');
    });
});

app.post('/login', passport.authenticate('local', { //POST HTTP LOGIN. RECIBE PARAMETROS DE INICIO DE SESIÓN (USUARIO Y CONTRASEÑA) Y LOS VALIDA.
    successRedirect: '/',
    successReturnToOrRedirect: "/",
    failureRedirect: '/login',
    failureFlash: true
}));

app.post('/user', (req, res) => { //POST HTTP USER. RECIBE LA INFORMACIÓN PARA LA CREACIÓN DE UN NUEVO USUARIO.
    User.countDocuments().then(userCount => {
        if (userCount > 0) {
            res.status(500);
            return res.sendFile(__dirname + '/views/http_errors/500.html');
        } else {
            new User(req.body).save().then(user => {
                req.flash('message', "Usuario Creado Exitosamente")
                res.redirect("/login")
            });
        }
    }, error => {
        res.status(500);
        return res.sendFile(__dirname + '/views/http_errors/500.html');
    });
});

app.get('/data', function (req, res) {
    newLog("<b>DISPOSITIVO: " + JSON.stringify(req.query) + "</b>");

    if (req.query.P && req.query.T && req.query.F) {
        lastRecord.ph = parseFloat(req.query.P);
        lastRecord.temp = parseFloat(req.query.T);
        lastRecord.date = moment(new Date()).tz('America/Guatemala').format("DD/MMM/YYYY HH:mm");
        let lastFeed = moment.tz(req.query.F, "YYYYMMDDHHmm", "America/Guatemala")
        lastRecord.lastFeed = moment(lastFeed).tz('America/Guatemala').format("DD/MMM/YYYY HH:mm");
        io.emit("newRecord", lastRecord);

        if (lastRecord.ph < currentSettings.ph.min || lastRecord.ph > currentSettings.ph.max) {
            sendPhAlertMail(lastRecord.ph);
        }

        if (lastRecord.temp < currentSettings.temp.min || lastRecord.temp > currentSettings.temp.max) {
            sendTempAlertMail(lastRecord.temp);
        }

        if (req.query.M == "1") {
            mustFeed = false;
            sendManualFeedMail();
        }

        if (req.query.A == "1") {
            sendAutoFeedMail();
            mustFeed = false;
        }
    }

    //QUITAR TODOS LOS HEADERS PARA EVITAR ENVIAR DATOS NO NECESARIOS AL DISPOSITIVO.
    res.removeHeader('Content-Type');
    res.removeHeader('X-Powered-By');
    res.removeHeader('Content-Length');
    res.removeHeader('Transfer-Encoding');
    res.removeHeader('ETag');
    res.removeHeader('Date');
    res.removeHeader('Connection');

    if (mustFeed) { //SI LA VARIABLE ES true, ENVIAR EL COMANDO PARA ALIMENTAR MANUALMENTE.
        res.end("FEED");
        newLog("FEED");
    } else { //REVISAR QUE LA CONFIGURACIÓN DE ALIMENTACIÓN AUTOMÁTICA QUE ENVIÓ EL DISPOSITIVO SEA LA MISMA QUE ESTÁ CONFIGURADA EN EL SERVIDOR
        let feedString = ""
        currentSettings.feedSchedule.h00 ? feedString += "Y" : feedString += "0";
        currentSettings.feedSchedule.h01 ? feedString += "Y" : feedString += "0";
        currentSettings.feedSchedule.h02 ? feedString += "Y" : feedString += "0";
        currentSettings.feedSchedule.h03 ? feedString += "Y" : feedString += "0";
        currentSettings.feedSchedule.h04 ? feedString += "Y" : feedString += "0";
        currentSettings.feedSchedule.h05 ? feedString += "Y" : feedString += "0";
        currentSettings.feedSchedule.h06 ? feedString += "Y" : feedString += "0";
        currentSettings.feedSchedule.h07 ? feedString += "Y" : feedString += "0";
        currentSettings.feedSchedule.h08 ? feedString += "Y" : feedString += "0";
        currentSettings.feedSchedule.h09 ? feedString += "Y" : feedString += "0";
        currentSettings.feedSchedule.h10 ? feedString += "Y" : feedString += "0";
        currentSettings.feedSchedule.h11 ? feedString += "Y" : feedString += "0";
        currentSettings.feedSchedule.h12 ? feedString += "Y" : feedString += "0";
        currentSettings.feedSchedule.h13 ? feedString += "Y" : feedString += "0";
        currentSettings.feedSchedule.h14 ? feedString += "Y" : feedString += "0";
        currentSettings.feedSchedule.h15 ? feedString += "Y" : feedString += "0";
        currentSettings.feedSchedule.h16 ? feedString += "Y" : feedString += "0";
        currentSettings.feedSchedule.h17 ? feedString += "Y" : feedString += "0";
        currentSettings.feedSchedule.h18 ? feedString += "Y" : feedString += "0";
        currentSettings.feedSchedule.h19 ? feedString += "Y" : feedString += "0";
        currentSettings.feedSchedule.h20 ? feedString += "Y" : feedString += "0";
        currentSettings.feedSchedule.h21 ? feedString += "Y" : feedString += "0";
        currentSettings.feedSchedule.h22 ? feedString += "Y" : feedString += "0";
        currentSettings.feedSchedule.h23 ? feedString += "Y" : feedString += "0";

        if (req.query.S != feedString) {
            //SI LA CONFIGURACIÓN DE ALIMENTACIÓN AUTOMÁTICA ES DISTINTA, HAY QUE ENVIARLE LA CADENA AL DISPOSITIVO, JUNTO CON LA HORA Y FECHA PARA QUE SE SINCRONICE.
            let replyDate = moment(new Date()).tz('America/Guatemala').format("YYYYMMDDHHmmss");
            res.end("TIME=" + feedString + replyDate);
            newLog("Server: TIME=" + feedString + replyDate);

        } else {
            //SI LA CONFIGURACIÓN ESTA CORRECTA Y NO HAY QUE ALIEMTNAR MANUALMENTE, ENVIAR OK
            newLog("OK");
            res.end("OK");
        }
    }
});

app.get('/logout', function (req, res) { //RUTA ENCARGADA DE CERRAR SESIÓN.
    if (req.isAuthenticated()) {
        req.logout();
    }
    res.redirect('/login');
});

app.get('/', requireAuthentication, function (req, res) { //RUTA QUE MUESTRA EL DASHBOARD
    return res.render(__dirname + '/views/dashboard.html', {
        message: req.flash('message'),
        error: req.flash('error'),
        lastRecord: lastRecord
    });
});

app.get('/feed', requireAuthentication, function (req, res) { //RUTA PARA EJECUTAR UNA ALIMENTACIÓN AUTOMÁTICA
    mustFeed = true;
    req.flash('message', "Se enviará el comando a la pecera.");
    res.redirect('/');
});

app.get('/settings', requireAuthentication, function (req, res) { //RUTA QUE MUESTRA LA VISTA DE CONFIGURACIÓN DE ALERTAS Y ALIMENTACIÓN AUTOMÁTICA.
    return res.render(__dirname + '/views/settings.html', {
        message: req.flash('message'),
        error: req.flash('error'),
        currentSettings: currentSettings,
        lastRecord: lastRecord
    });
});

app.post('/settings', requireAuthentication, function (req, res) {
    //POST HTTP, RECIBE LOS PARAMETROS PARA ACTUALIZAR LA CONFIGURACION DE ALERTAS Y ALIMENTACIÓN AUTOMÁTICA.

    currentSettings.alertEmails = req.body.alertEmails.filter(word => word.length > 1);

    currentSettings.temp.min = parseFloat(req.body.temp.min);
    currentSettings.temp.max = parseFloat(req.body.temp.max);

    currentSettings.ph.min = parseFloat(req.body.ph.min);
    currentSettings.ph.max = parseFloat(req.body.ph.max);

    currentSettings.feedSchedule.h00 = (req.body.h00 == "true");
    currentSettings.feedSchedule.h01 = (req.body.h01 == "true");
    currentSettings.feedSchedule.h02 = (req.body.h02 == "true");
    currentSettings.feedSchedule.h03 = (req.body.h03 == "true");
    currentSettings.feedSchedule.h04 = (req.body.h04 == "true");
    currentSettings.feedSchedule.h05 = (req.body.h05 == "true");
    currentSettings.feedSchedule.h06 = (req.body.h06 == "true");
    currentSettings.feedSchedule.h07 = (req.body.h07 == "true");
    currentSettings.feedSchedule.h08 = (req.body.h08 == "true");
    currentSettings.feedSchedule.h09 = (req.body.h09 == "true");
    currentSettings.feedSchedule.h10 = (req.body.h10 == "true");
    currentSettings.feedSchedule.h11 = (req.body.h11 == "true");
    currentSettings.feedSchedule.h12 = (req.body.h12 == "true");
    currentSettings.feedSchedule.h13 = (req.body.h13 == "true");
    currentSettings.feedSchedule.h14 = (req.body.h14 == "true");
    currentSettings.feedSchedule.h15 = (req.body.h15 == "true");
    currentSettings.feedSchedule.h16 = (req.body.h16 == "true");
    currentSettings.feedSchedule.h17 = (req.body.h17 == "true");
    currentSettings.feedSchedule.h18 = (req.body.h18 == "true");
    currentSettings.feedSchedule.h19 = (req.body.h19 == "true");
    currentSettings.feedSchedule.h20 = (req.body.h20 == "true");
    currentSettings.feedSchedule.h21 = (req.body.h21 == "true");
    currentSettings.feedSchedule.h22 = (req.body.h22 == "true");
    currentSettings.feedSchedule.h23 = (req.body.h23 == "true");

    req.flash('message', "Sus cambios se han guardado exitosamente");
    res.redirect('/settings');
});

app.get('/monitor', function (req, res) { //RUTA QUE MUESTRA EL MONITOR DE COMUNICACIÓN ENTRE EL SERVIDOR Y EL DISPOSITIVO DE LA PECERA.
    return res.sendFile(__dirname + '/views/monitor.html');
});

app.get('*', function (req, res) { //GESTOR DE ERRORES DE ARCHIVO NO ENCONTRADO 404.
    return res.sendFile(__dirname + '/views/http_errors/404.html');
});

app.use((err, req, res, next) => { //GESTOR DE ERRORES DE SERVIDOR (500).
    if (res.headersSent) {
        return next(err)
    } else {
        res.status(500);
        return res.sendFile(__dirname + '/views/http_errors/500.html');
    }
});

function newLog(log) { //ENVÍA LA CADENA DE DATOS DEL PARAMETRO (log) POR WEBSOCKET PARA MOSTRARLO EN EL MONITOR
    io.emit("newLog", log);
}

function sendAutoFeedMail() {
    var mailOptions = {
        from: '"mipecera.online" <' + process.env.EMAIL_USER + '>',
        to: [currentSettings.alertEmails],
        subject: "Alimentación Automática",
        text: "Se ha realizado una alimentación automática.\n\nFecha: " + moment(new Date()).tz('America/Guatemala').format("DD-MM-YYYY HH:mm") + "\n\n",
    }

    smtpTransport.sendMail(mailOptions, (error, response) => {
        if (error) {
            console.log("Message Not Send", error);
        } else {
            console.log("Mail Send", );
        }
    });
}

function sendManualFeedMail() {
    var mailOptions = {
        from: '"mipecera.online" <' + process.env.EMAIL_USER + '>',
        to: [currentSettings.alertEmails],
        subject: "Alimentación Manual",
        text: "Se ha realizado una alimentación manual.\n\nFecha: " + moment(new Date()).tz('America/Guatemala').format("DD-MM-YYYY HH:mm") + "\n\n",
    }

    smtpTransport.sendMail(mailOptions, (error, response) => {
        if (error) {
            console.log("Message Not Send", error);
        } else {
            console.log("Mail Send", );
        }
    });
}

var lastPhAlertMail = new Date(0);

function sendPhAlertMail(ph) {
    if (new Date().getTime() - lastPhAlertMail.getTime() > 3600000) {
        lastPhAlertMail = new Date();
        var mailOptions = {
            from: '"mipecera.online" <' + process.env.EMAIL_USER + '>',
            to: [currentSettings.alertEmails],
            subject: "pH no Saludable",
            text: "Se ha reportado un valor de pH no Saludable.\n\npH: " + ph + "\n\nFecha: " + moment(new Date()).tz('America/Guatemala').format("DD-MM-YYYY HH:mm") + "\n\n",
        }

        smtpTransport.sendMail(mailOptions, (error, response) => {
            if (error) {
                console.log("Message Not Send", error);
            } else {
                console.log("Mail Send", );
            }
        });
    }

}

var lastTempAlertMail = new Date(0);

function sendTempAlertMail(temp) {
    if (new Date().getTime() - lastTempAlertMail.getTime() > 3600000) {
        lastTempAlertMail = new Date();
        var mailOptions = {
            from: '"mipecera.online" <' + process.env.EMAIL_USER + '>',
            to: [currentSettings.alertEmails],
            subject: "Temperatura no saludable",
            text: "Se ha reportado un valor de Temperatura no Saludable.\n\nTemperatura: " + temp + "\n\nFecha: " + moment(new Date()).tz('America/Guatemala').format("DD-MM-YYYY HH:mm") + "\n\n",
        }

        smtpTransport.sendMail(mailOptions, (error, response) => {
            if (error) {
                console.log("Message Not Send", error);
            } else {
                console.log("Mail Send", );
            }
        });
    }
}

http.listen(HTTP_PORT, function () { //INICIO DEL SERVIDOR HTTP
    console.log(" - Web Server Started :)");
});

//GESTIÓN DE ERRORES
process.on("uncaughtException", function (err) {
    console.log("uncaughtException", err);
});

process.on('unhandledRejection', function (err) {
    console.log("unhandledRejection", err);
});
