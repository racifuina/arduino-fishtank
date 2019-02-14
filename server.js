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
const net = require('net');
const moment = require('moment-timezone');
const fs = require('fs');
const ejs = require('ejs');
const bodyParser = require('body-parser');
const flash = require('connect-flash');
const nodemailer = require("nodemailer");
const smtpTransportRequire = require("nodemailer-smtp-transport");
const CronJob = require('cron').CronJob;
mongoose.Promise = global.Promise;

let lastRecord = {
    date: moment(new Date()).tz('America/Guatemala').format("DD/MMM/YYYY HH:mm"),
    ph: 0,
    temp: 0
}

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
    console.log("socket connected")
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

app.get('/data', function (req, res) {
    newLog("<b>HTTP Device: " + JSON.stringify(req.query) + "</b>");

    res.removeHeader('Content-Type');
    res.removeHeader('X-Powered-By');
    res.removeHeader('Content-Length');
    res.removeHeader('Transfer-Encoding');
    res.removeHeader('ETag');
    res.removeHeader('Date');
    res.removeHeader('Connection');
    res.end("FEED_HTTP");

});

app.get('/logout', function (req, res) {
    if (req.isAuthenticated()) {
        req.logout();
    }
    res.redirect('/login');
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

app.get('/monitor', function (req, res) {
    return res.sendFile(__dirname + '/views/monitor.html');
});

app.get('*', function (req, res) {
    return res.sendFile(__dirname + '/views/http_errors/404.html');
});

app.use((err, req, res, next) => {
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

net.createServer(connection => {
    newLog("<div style='color: green;'>device CONNECTED</div>");

    connection.on("data", buffer => {
        newLog("<b>Device: " + buffer.toString().trim() + "</b>");


        if (buffer.toString().trim().includes("AT+CIPSEND")) {
            return connection.destroy();
        }


        let replyDate = moment(new Date()).tz('America/Guatemala').format("YY-MM-DD,HH:mm:ss");

        let sensorData = JSON.parse(buffer.toString().trim());

        if (sensorData.P && sensorData.T) {
            lastRecord.ph = parseFloat(sensorData.P)
            lastRecord.temp = parseFloat(sensorData.T)
            lastRecord.date = moment(new Date()).tz('America/Guatemala').format("DD/MMM/YYYY HH:mm");
        }

        setTimeout(function () {
            newLog("FEED");
            connection.write("FEED");

        }, 500);
    });

    connection.on("close", hadError => {
        newLog("<div style='color: red;'>device DISCONNECTED</div>");
    });


}).listen(TCP_PORT, function () {
    console.log(' - TCP Server Started on port ' + TCP_PORT + ' :)');
});

http.listen(HTTP_PORT, function () {
    console.log(" - Web Server Started :)");
});

process.on("uncaughtException", function (err) {
    console.log("uncaughtException", err);
});

process.on('unhandledRejection', function (err) {
    console.log("unhandledRejection", err);
});
