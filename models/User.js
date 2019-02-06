var mongoose = require("mongoose");
var bcrypt = require('bcrypt');
const path = require("path");
var Schema = mongoose.Schema;
var SALT_WORK_FACTOR = 10;

var UserSchema = new Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    name: String,
    password: String,
});

UserSchema.methods.validatePassword = function (candidatePassword, callback) {
    bcrypt.compare(candidatePassword, this.password, function (err, isMatch) {
        if (err) {
            callback(false);
        } else {
            callback(isMatch);
        }

    });
}

UserSchema.pre('save', function (next) {
    var user = this;
    // only hash the password if it has been modified (or is new)
    if (!user.isModified('password')) {
        return next();
    } else {
        if (user.token == undefined) {
            // generate a salt
            bcrypt.genSalt(SALT_WORK_FACTOR, function (err, salt) {
                if (err) return next(err);
                // hash the password using our new salt
                bcrypt.hash(user.password, salt, function (err, hash) {
                    if (err) return next(err);
                    // override the cleartext password with the hashed one
                    user.password = hash;
                    next();
                });
            });
        } else {
            return next();
        }
    }
});

module.exports = mongoose.model("users", UserSchema);
