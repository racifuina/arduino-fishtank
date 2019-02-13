var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var Record = new Schema({
    ph: Number,
    temp: Number,
}, {
    timestamps: true
});

module.exports = mongoose.model("records", Record);
