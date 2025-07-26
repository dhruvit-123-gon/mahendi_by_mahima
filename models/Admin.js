// models/Admin.js
const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  resetToken: String,
  resetTokenExpiry: Date
});

module.exports = mongoose.model('Admin', adminSchema);
