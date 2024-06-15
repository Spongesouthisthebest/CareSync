const express = require("express");
const session = require('express-session');
const stripe = require("stripe")('sk_test_51P4TSoSFPrVdKBVbmjp9LASNKS33nvJlYFF5lrve0DX2ld9rKePslNPDZZW21aH0MyFfeGpDv0WAuWRgMsMpeV9000LM8mZYSC');
const mongoose = require("mongoose");
const bodyParser = require("body-parser");

const app = express();
const port = 6474;
const YOUR_DOMAIN = 'http://localhost:6474';

app.use(session({
    secret: '123',
    resave: false,
    saveUninitialized: false
}));
app.use(express.static("public"));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

mongoose.connect('mongodb+srv://aishahussain13579:a9831122132@adainsta.tfexlrz.mongodb.net/CareSync')
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('Could not connect to MongoDB', err));

const userSchema = new mongoose.Schema({
    username: String,
    password: String,
    paid: { type: Boolean, default: false }
});

const User = mongoose.model('User', userSchema);

// User auth
app.get('/', (req, res) => {
    res.sendFile("templates/login.html", { root: __dirname });
});

app.get('/sign-up', (req, res) => {
    res.sendFile("templates/sign-up.html", { root: __dirname });
});

app.post('/sign', async (req, res) => {
    try {
        const { username, password } = req.body;

        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(409).send("Username already exists. Please choose a different username.");
        }

        const newUser = new User({
            username: username,
            password: password
        });
        await newUser.save();
        console.log("User created successfully!");

        // Create a Stripe checkout session
        const session = await stripe.checkout.sessions.create({
            line_items: [
                {
                    price_data: {
                        currency: 'inr',
                        product_data: {
                            name: 'Membership Fee',
                        },
                        unit_amount: 334100,
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${YOUR_DOMAIN}/success?userId=${newUser._id}`,
            cancel_url: `${YOUR_DOMAIN}/cancel`,
        });

        res.redirect(303, session.url);
    } catch (error) {
        console.error("Error creating new user:", error);
        res.status(500).send("Error creating new user, this is a server-side problem, please try again later.");
    }
});

app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).send("Invalid username or password");
        }
        if (password === user.password) {
            req.session.user = user;
            res.redirect("/home");
        } else {
            res.status(401).send("Invalid username or password");
        }
    } catch (error) {
        console.error("Error logging in:", error);
        res.status(500).send("Error logging in, please try again later.");
    }
});

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
    if (req.session.user) {
        return next();
    } else {
        res.redirect('/');
    }
}

// Success and Cancel routes for payment
app.get('/success', async (req, res) => {
    try {
        const userId = req.query.userId;
        await User.findByIdAndUpdate(userId, { paid: true });
        res.sendFile("templates/success.html", { root: __dirname });
    } catch (error) {
        console.error("Error updating payment status:", error);
        res.status(500).send("Error updating payment status, please try again later.");
    }
});

app.get('/cancel', (req, res) => {
    res.sendFile("templates/cancel.html", { root: __dirname });
});

// Routes
app.get("/home", isAuthenticated, (req, res) => {
    res.sendFile("templates/index.html", { root: __dirname });
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
