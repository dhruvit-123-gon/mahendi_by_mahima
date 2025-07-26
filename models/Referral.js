const mongoose = require('mongoose');

const ReferralSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },
    usageCount: { type: Number, default: 0 },
    discount: { type: Number, default: 10 },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Referral', ReferralSchema);
