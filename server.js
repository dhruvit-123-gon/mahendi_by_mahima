require('dotenv').config();
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: './public/uploads/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage });


const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// MongoDB Connection
// mongoose.connect('mongodb://127.0.0.1:27017/mehendiDB', {
mongoose.connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.log('❌ MongoDB Connection Error:', err));

// Schemas
const customerSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,
    resetToken: String,
    resetTokenExpiry: Date,
    createdAt: { type: Date, default: Date.now }
});

const bookingSchema = new mongoose.Schema({
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    name: String,
    phone: String,
    email: String,
    package: String,
    date: String,
    createdAt: { type: Date, default: Date.now }
});

const productSchema = new mongoose.Schema({
    name: String,
    price: Number,
    category: String,
    imageUrl: String,    // For image link
    imageFile: String,   // For uploaded image path (e.g., /uploads/image.jpg)
});

const referralSchema = new mongoose.Schema({
    code: { type: String, unique: true },
    usageCount: { type: Number, default: 0 },
    discount: { type: Number, default: 10 },
    createdAt: { type: Date, default: Date.now }
});

const contactSchema = new mongoose.Schema({
    name: String,
    email: String,
    phone: String,
    message: String,
    createdAt: { type: Date, default: Date.now }
});



// ADD YOUR ORDER SCHEMA HERE 👇
const orderSchema = new mongoose.Schema({
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    items: [{
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        quantity: Number,
        price: Number
    }],
    totalAmount: Number,
    address: String,
    phone: String,
    paymentStatus: String,
    razorpayOrderId: String,
    status: { type: String, default: 'Pending' },
    createdAt: { type: Date, default: Date.now }
});

const Order = mongoose.model('Order', orderSchema);




//Update status (admin)
app.post('/api/admin/update-order-status/:id', checkAdmin, async (req, res) => {
    const { status } = req.body;
    await Order.findByIdAndUpdate(req.params.id, { status });
    res.json({ success: true, message: 'Order status updated' });
});

//Cancel order (customer)
app.post('/api/customer/cancel-order/:id', async (req, res) => {
    const order = await Order.findById(req.params.id);

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.status !== 'Order Placed') return res.status(400).json({ success: false, message: 'Cannot cancel after processing' });

    order.status = 'Cancelled';
    await order.save();

    res.json({ success: true, message: 'Order cancelled' });
});

// order status
app.post('/api/admin/update-order-status/:orderId', async (req, res) => {
    const { orderId } = req.params;
    const { status } = req.body;

    try {
        await Order.findByIdAndUpdate(orderId, { status: status });
        res.json({ success: true, message: 'Order status updated!' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error updating status' });
    }
});

app.get('/api/customer/orders/:id', async (req, res) => {
    try {
        const orders = await Order.find({ customerId: req.params.id })
            .populate('items.productId', 'name') // so you can show product name
            .sort({ createdAt: -1 });

        res.json(orders);
    } catch (err) {
        res.status(500).json({ message: 'Failed to load orders' });
    }
});

// tracking order
app.get('/api/order-tracking/:orderId', async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.json({
      success: true,
      status: order.status,
      orderDate: order.createdAt // <-- required for delivery estimate
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Models
const Customer = mongoose.model('Customer', customerSchema);
const Booking = mongoose.model('Booking', bookingSchema);
const Product = mongoose.model('Product', productSchema);
const Referral = mongoose.model('Referral', referralSchema);
const Contact = mongoose.model('Contact', contactSchema);

// Admin Constants
const ADMIN_USER = 'dhruvitgondaliya120@gmail.com';
const ADMIN_PASS = 'dhruvit@12345';
const ADMIN_TOKEN = 'admin123token';

// ===================
// Customer APIs
// ===================

// Customer Signup
app.post('/api/customer/signup', async (req, res) => {
    const { name, email, password } = req.body;

    try {
        const existing = await Customer.findOne({ email });
        if (existing) return res.status(400).json({ success: false, message: 'Email already exists' });

        const customer = new Customer({ name, email, password });
        await customer.save();
        res.json({ success: true, message: 'Customer registered' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Signup error' });
    }
});

// Customer Login
app.post('/api/customer/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const customer = await Customer.findOne({ email });
        if (customer && customer.password === password) {
            res.json({
                success: true,
                customer: { id: customer._id, name: customer.name, email: customer.email }
            });
        } else {
            res.status(401).json({ success: false, message: 'Invalid email or password' });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: 'Login error' });
    }
});

// forgot password
const nodemailer = require('nodemailer');


const Admin = require('./models/Admin');

// In-memory storage for admin OTPs (for demo)
let adminOtps = {};

/* -------------------- CUSTOMER FORGOT PASSWORD -------------------- */

// Send OTP to customer
app.post('/api/customer/forgot-password', async (req, res) => {
    const { email } = req.body;

    try {
        const customer = await Customer.findOne({ email });
        if (!customer) return res.status(404).json({ success: false, message: 'Email not found' });

        const otp = Math.floor(100000 + Math.random() * 900000);
        customer.resetToken = otp;
        customer.resetTokenExpiry = Date.now() + 15 * 60 * 1000;
        await customer.save();

        const testAccount = await nodemailer.createTestAccount();
        const transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass
            }
        });

        const info = await transporter.sendMail({
            from: '"Mehendi by Mahima" <no-reply@mehendi.com>',
            to: email,
            subject: "Password Reset OTP",
            html: `<b>Your OTP is: ${otp}</b>`
        });

        console.log('OTP for customer:', otp);
        console.log('Preview URL:', nodemailer.getTestMessageUrl(info));

        res.json({ success: true, message: 'OTP sent to customer email', previewURL: nodemailer.getTestMessageUrl(info) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error sending OTP' });
    }
});

// change customer password
app.post('/api/customer/change-password', async (req, res) => {
    const { customerId, oldPassword, newPassword } = req.body;

    try {
        const customer = await Customer.findById(customerId);
        if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });

        if (customer.password !== oldPassword) {
            return res.status(401).json({ success: false, message: 'Incorrect current password' });
        }

        customer.password = newPassword;
        await customer.save();

        res.json({ success: true, message: 'Password changed successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});



// Reset customer password
app.post('/api/customer/reset-password', async (req, res) => {
    const { email, otp, newPassword } = req.body;

    try {
        const customer = await Customer.findOne({ email });
        if (!customer || customer.resetToken != otp || customer.resetTokenExpiry < Date.now()) {
            return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
        }

        customer.password = newPassword;
        customer.resetToken = null;
        customer.resetTokenExpiry = null;
        await customer.save();

        res.json({ success: true, message: 'Customer password reset successful' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error resetting password' });
    }
});

/* -------------------- ADMIN FORGOT PASSWORD -------------------- */

// Send OTP to admin
app.post('/api/admin/send-otp', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    try {
        const testAccount = await nodemailer.createTestAccount();
        const transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass
            }
        });

        const info = await transporter.sendMail({
            from: 'admin@mehendi.com',
            to: email,
            subject: 'Admin OTP',
            text: `Your OTP is ${otp}`
        });

        adminOtps[email] = otp;
        console.log('Admin OTP:', otp);
        console.log('Preview URL:', nodemailer.getTestMessageUrl(info));

        res.json({ success: true, message: "OTP sent to admin email", previewURL: nodemailer.getTestMessageUrl(info) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server failed to send OTP." });
    }
});

// Reset admin password
app.post('/api/admin/reset-password', async (req, res) => {
    const { email, otp, newPassword } = req.body;

    if (!adminOtps[email] || adminOtps[email] !== otp) {
        return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    try {
        const admin = await Admin.findOne({ email });
        if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });

        admin.password = newPassword;
        await admin.save();

        delete adminOtps[email];

        res.json({ success: true, message: 'Admin password reset successful' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error resetting admin password' });
    }
});


// invoice
const PDFDocument = require('pdfkit');
const fs = require('fs');


app.get('/api/invoice/:orderId', async (req, res) => {
    const { orderId } = req.params;
    const order = await Order.findById(orderId).populate('customerId').populate('items.productId');

    if (!order) return res.status(404).send('Order not found');

    const doc = new PDFDocument({ margin: 40 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${orderId}.pdf`);
    doc.pipe(res);

    // === 1. Add Logo ===
    const logoPath = path.join(__dirname, 'public', 'logonew.png'); // put logo in /public/logo.png
    if (fs.existsSync(logoPath)) {
        doc.image(logoPath, { width: 100, align: 'left' });
    }

    // === 2. Business Details ===
    doc.fontSize(20).text('Mehendi by Mahima', { align: 'right' });
    doc.fontSize(12).text('www.mehendibymahima.com', { align: 'right' });
    doc.text('info@mehendi.com', { align: 'right' });
    doc.moveDown(1.5);

    // === 3. Customer & Order Info ===
    doc.fontSize(14).text(`Invoice for Order ID: ${order._id}`);
    doc.moveDown();
    doc.fontSize(12).text(`Customer Name: ${order.customerId.name}`);
    doc.text(`Email: ${order.customerId.email}`);
    doc.text(`Phone: ${order.phone}`);
    doc.text(`Address: ${order.address}`);
    doc.text(`Order Date: ${new Date(order.createdAt).toLocaleDateString()}`);
    doc.moveDown();

    // === 4. Item Table Header ===
    doc.fontSize(14).text('Items Purchased:', { underline: true });
    doc.moveDown(0.5);

    // === 5. Items ===
    order.items.forEach((item, index) => {
        doc.fontSize(12).text(`${index + 1}. ${item.productId.name} x${item.quantity} = ₹${item.price}`);
    });

    doc.moveDown();

    // === 6. Summary ===
    doc.fontSize(13).text(`Total Amount: ₹${order.totalAmount}`);
    doc.text(`Payment Status: ${order.paymentStatus}`);
    doc.text(`Order Status: ${order.status}`);
    doc.moveDown(2);

    // === 7. Thank You Note ===
    doc
        .fontSize(14)
        .fillColor('#7b2d26')
        .text('Thank you for your order!', { align: 'center' })
        .moveDown()
        .fontSize(12)
        .fillColor('black')
        .text('We hope you loved your Mehendi experience. Reach out anytime for more designs!', { align: 'center' });

    doc.end();
});





// API to upload profile picture
app.post('/api/customer/upload-profile/:id', upload.single('profilePic'), async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.id);
        customer.profileImage = '/uploads/' + req.file.filename;
        await customer.save();
        res.json({ success: true, message: 'Profile image updated', imageUrl: customer.profileImage });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Upload error' });
    }
});


// Get Customer Profile
app.get('/api/customer/profile/:id', async (req, res) => {
    const customer = await Customer.findById(req.params.id);
    if (customer) {
        res.json({ success: true, customer });
    } else {
        res.status(404).json({ success: false, message: 'Customer not found' });
    }
});

// Update Customer Profile
app.put('/api/customer/profile/:id', async (req, res) => {
    const { name, phone, address } = req.body;
    const customer = await Customer.findById(req.params.id);
    if (customer) {
        customer.name = name;
        customer.phone = phone;
        customer.address = address;
        await customer.save();
        res.json({ success: true, message: 'Profile updated successfully' });
    } else {
        res.status(404).json({ success: false, message: 'Customer not found' });
    }
});


// ===================
// Admin Login
// ===================

app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;

    if (username === ADMIN_USER && password === ADMIN_PASS) {
        res.json({ success: true, token: ADMIN_TOKEN });
    } else {
        res.status(401).json({ success: false, message: 'Invalid admin credentials' });
    }
});

function checkAdmin(req, res, next) {
    const token = req.headers['authorization'];
    if (token === ADMIN_TOKEN) next();
    else res.status(403).json({ success: false, message: 'Unauthorized' });
}




// ===================
// Booking API
// ===================

app.post('/api/book', async (req, res) => {
    try {
        const booking = new Booking(req.body);
        await booking.save();
        res.json({ success: true, message: 'Booking confirmed!' });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

// ===================
// Product APIs
// ===================

app.post('/api/products', checkAdmin, async (req, res) => {
    const product = new Product(req.body);
    await product.save();
    res.json({ success: true, message: 'Product added' });
});

app.get('/api/products', async (req, res) => {
    const products = await Product.find();
    res.json(products);
});// Product Image Upload (URL or File)
app.post('/api/products/upload', checkAdmin, upload.single('imageFile'), async (req, res) => {
    const { name, price, category, imageUrl } = req.body;

    const product = new Product({
        name,
        price,
        category,
        imageUrl: imageUrl || '',
        imageFile: req.file ? '/uploads/' + req.file.filename : ''
    });

    await product.save();
    res.json({ success: true, message: 'Product added with image!' });
});


// ===================
// Referral APIs
// ===================

app.post('/api/referral', async (req, res) => {
    const { code } = req.body;
    const referral = await Referral.findOne({ code });

    if (!referral) return res.status(404).json({ success: false, message: 'Invalid referral code' });

    referral.usageCount += 1;
    await referral.save();

    res.json({ success: true, discount: referral.discount, message: 'Referral applied' });
});

app.post('/api/admin/referral', checkAdmin, async (req, res) => {
    const referral = new Referral(req.body);
    await referral.save();
    res.json({ success: true, message: 'Referral created' });
});

// ===================
// Contact Us API
// ===================

app.post('/api/contact', async (req, res) => {
    try {
        const contact = new Contact(req.body);
        await contact.save();
        res.json({ success: true, message: 'Thank you! Your message has been received.' });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

// ===================
// Admin Dashboard APIs
// ===================

app.get('/api/admin/bookings', checkAdmin, async (req, res) => {
    const bookings = await Booking.find().sort({ createdAt: -1 });
    res.json(bookings);
});

app.get('/api/admin/products', checkAdmin, async (req, res) => {
    const products = await Product.find();
    res.json(products);
});

app.get('/api/admin/referrals', checkAdmin, async (req, res) => {
    const referrals = await Referral.find();
    res.json(referrals);
});

app.get('/api/admin/contacts', checkAdmin, async (req, res) => {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    res.json(contacts);
});

// ===================
// Admin Delete APIs
// ===================

// Delete Booking
app.delete('/api/admin/booking/:id', checkAdmin, async (req, res) => {
    await Booking.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Booking deleted successfully' });
});

// Delete Product
app.delete('/api/admin/product/:id', checkAdmin, async (req, res) => {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Product deleted successfully' });
});

// Delete Referral
app.delete('/api/admin/referral/:id', checkAdmin, async (req, res) => {
    await Referral.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Referral deleted successfully' });
});

// Delete Contact
app.delete('/api/admin/contact/:id', checkAdmin, async (req, res) => {
    await Contact.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Contact message deleted successfully' });
});

// Customer Place Order
app.post('/api/order', async (req, res) => {
    try {
        const order = new Order(req.body);
        await order.save();
        res.json({ success: true, message: 'Order placed successfully!' });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

// Admin Get Orders
app.get('/api/admin/orders', checkAdmin, async (req, res) => {
    try {
        const orders = await Order.find()
            .populate('customerId', 'name email')    // Show customer details
            .populate('items.productId', 'name price') // Show product names
            .sort({ createdAt: -1 });

        res.json(orders);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.delete('/api/admin/order/:id', checkAdmin, async (req, res) => {
    try {
        await Order.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Order deleted successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});



// ===================
// Server Start
// ===================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
