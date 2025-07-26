const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    name: String,
    phone: String,
    email: String,
    package: String,
    date: String,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Booking', BookingSchema);
