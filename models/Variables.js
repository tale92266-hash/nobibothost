const mongoose = require("mongoose");

const variableSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    value: { type: String, required: true }
});

const Variable = mongoose.model("Variable", variableSchema);

module.exports = Variable;
