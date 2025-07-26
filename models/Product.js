const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    name: String,
    description: String,
    price: Number,
    imageUrl: String,
    category: String,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Product', ProductSchema);
