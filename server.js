require('dotenv').config();
console.log("*****  Starting mipecera.online Server *****");
console.log(" - NODE_ENV", process.env.NODE_ENV)

const HTTP_PORT = process.env.PORT || 8080;
const TCP_PORT = process.env.TCP_PORT || 3000;
const mongoose = require("mongoose");
const path = require("path");
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
const sharedsession = require("express-socket.io-session");
const MongoStore = require('connect-mongo')(session);
const express = require("express");
const app = express();
const http = require("http").Server(app);
const io = require("socket.io")(http);
const moment = require('moment-timezone');
const net = require('net');
const fs = require('fs');
const ejs = require('ejs');
const bodyParser = require('body-parser');
const flash = require('connect-flash');
const nodemailer = require("nodemailer");
const smtpTransportRequire = require("nodemailer-smtp-transport");
const CronJob = require('cron').CronJob;
mongoose.Promise = global.Promise;
let mustFeed = false;
let currentSettings = {
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
    }
};

let lastRecord = {
    date: "--",
    ph: 0,
    temp: 0,
    lastFeed: "--"
};

const smtpTransport = nodemailer.createTransport(smtpTransportRequire({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
}));

const User = require("./models/User");
const Record = require("./models/Record");

passport.use(new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password'
}, function (email, password, done) {
    User.findOne({
        email: email
    }).then(function (user) {
        if (!user) {
            return done(null, false, {
                message: 'Usuario incorrecto.'
            });
        }
        user.validatePassword(password, function validationResult(isValid) {
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

passport.serializeUser(function (user, done) {
    done(null, user._id);
});

passport.deserializeUser(function (userId, done) {
    User.findById(userId, function (err, user) {
        done(err, user);
    });
});

const mongooseOptions = {
    user: process.env.DB_USERNAME,
    pass: process.env.DB_PASSWORD,
    useCreateIndex: true,
    useNewUrlParser: true,
    autoReconnect: true
}

mongoose.connect("mongodb://" + process.env.DB_URL + "/mipecera", mongooseOptions);
const db = mongoose.connection;

db.once('open', function () {
    console.log(" - Connected to MongoDB :) " + process.env.DB_URL);
});

db.once('error', function (e) {
    console.log(" - DB Error: " + e);
    mongoose.disconnect();
});

db.on('reconnected', function () {
    console.log('MongoDB reconnected!');
});

db.on('disconnected', function () {
    console.log('MongoDB disconnected!');
});

//EXPRESS MIDDLEWARE SETUP
app.use(express.static('public'));
app.set('views', __dirname + '/views/');
app.engine('html', ejs.renderFile);
app.set('view engine', 'ejs');
app.use(flash());
app.use(bodyParser.urlencoded({
    extended: true,
}));

const customSession = session({
    secret: process.env.TOKEN_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 2592000000,
    },
    store: new MongoStore({
        mongooseConnection: db
    })
});

app.use(customSession);
app.use(passport.initialize());
app.use(passport.session());

io.on("connection", socket => {

});

function requireAuthentication(req, res, next) {
    if (!req.isAuthenticated()) {
        req.session.returnTo = req.url;
        req.flash("error", "Debes iniciar sesión para acceder a este recurso");
        res.redirect('/login');
    } else {
        next();
    }
};

app.get('/login', function (req, res) {
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

app.post('/login', passport.authenticate('local', {
    successRedirect: '/',
    successReturnToOrRedirect: "/",
    failureRedirect: '/login',
    failureFlash: true
}));

app.post('/user', (req, res) => {
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
        console.log(error);
        res.status(500);
        return res.sendFile(__dirname + '/views/http_errors/500.html');
    });
});

function updateLastRecord(sensorData) {
    if (sensorData.P && sensorData.T && sensorData.F) {
        lastRecord.ph = parseFloat(sensorData.P)
        lastRecord.temp = parseFloat(sensorData.T)
        lastRecord.date = moment(new Date()).tz('America/Guatemala').format("DD/MMM/YYYY HH:mm");
        let lastFeed = moment.tz(sensorData.F, "YYYYMMDDHHmm", "America/Guatemala")
        lastRecord.lastFeed = moment(lastFeed).tz('America/Guatemala').format("DD/MMM/YYYY HH:mm");
        io.emit("newRecord", lastRecord);
        if (sensorData.M == "1") {
            mustFeed = false;
        }
    }
}

app.get('/data', function (req, res) {
    newLog("<b>HTTP Device: " + JSON.stringify(req.query) + "</b>");
    updateLastRecord(req.query);

    res.removeHeader('Content-Type');
    res.removeHeader('X-Powered-By');
    res.removeHeader('Content-Length');
    res.removeHeader('Transfer-Encoding');
    res.removeHeader('ETag');
    res.removeHeader('Date');

    res.removeHeader('Connection');

    if (mustFeed) {
        res.end("FEED");
        newLog("FEED");
    } else {
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
            let replyDate = moment(new Date()).tz('America/Guatemala').format("YYYYMMDDHHmmss");
            connection.write("TIME=" + feedString + "CLK=" + replyDate);
            newLog("Server: TIME=" + feedString + "CLK=" + replyDate);
        } else {
            newLog("OK");
            res.end("OK");
        }

    }

});

app.get('/logout', function (req, res) {
    if (req.isAuthenticated()) {
        req.logout();
    }
    res.redirect('/login');
});

app.get('/', requireAuthentication, function (req, res) {
    return res.render(__dirname + '/views/dashboard.html', {
        message: req.flash('message'),
        error: req.flash('error'),
        lastRecord: lastRecord
    });
});

app.get('/feed', requireAuthentication, function (req, res) {
    mustFeed = true;
    req.flash('message', "Se enviará el comando a la pecera.");
    res.redirect('/');
});


app.get('/settings', requireAuthentication, function (req, res) {
    return res.render(__dirname + '/views/settings.html', {
        message: req.flash('message'),
        error: req.flash('error'),
        currentSettings: currentSettings,
        lastRecord: lastRecord
    });
});

app.post('/settings', requireAuthentication, function (req, res) {

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

app.get('/monitor', function (req, res) {
    return res.sendFile(__dirname + '/views/monitor.html');
});

app.get('*', function (req, res) {
    return res.sendFile(__dirname + '/views/http_errors/404.html');
});

app.use((err, req, res, next) => {
    console.log(err);
    if (res.headersSent) {
        return next(err)
    } else {
        res.status(500);
        return res.sendFile(__dirname + '/views/http_errors/500.html');
    }
});

function newLog(log) {
    io.emit("newLog", log)
}

http.listen(HTTP_PORT, function () {
    console.log(" - Web Server Started :)");
});

process.on("uncaughtException", function (err) {
    console.log("uncaughtException", err);
});

process.on('unhandledRejection', function (err) {
    console.log("unhandledRejection", err);
});
