require("dotenv").config(); 
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");
const db = require("../db/authQueries");
const nodemailer = require("nodemailer");
const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL;

const JWT_SECRET = process.env.JWT_SECRET;

const transporter = nodemailer.createTransport({
  host: "smtp.mail.yahoo.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const user = await db.getUser(username);

      if (!user) {
        return done(null, false, { message: "Incorrect username" });
      }

      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        return done(null, false, { message: "Incorrect password" });
      }

      return done(null, user);
    } catch (err) {
      return done(err);
    }
  })
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await db.findUser(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

async function signup(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { firstname, lastname, username, email, password, confPassword } = req.body;

    // Check for existing username/email if email is provided
    const checkInfo = await db.checkUsernameEmail(username, email || null);
    if (checkInfo) {
      return res.status(400).json({ error: "Username or email already exists" });
    }

    if (password !== confPassword) {
      return res.status(400).json({ error: "Passwords do not match" });
    }

    const newFirstname = firstname.charAt(0).toUpperCase() + firstname.slice(1).toLowerCase();
    const newLastname = lastname.charAt(0).toUpperCase() + lastname.slice(1).toLowerCase();

    const checkName = await db.checkName(newFirstname, newLastname);
    if (checkName) {
      return res.status(400).json({ error: "First and last name combination already in use" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.addUser(newFirstname, newLastname, req.body, hashedPassword);

    // Send email notification to superadmin
    if (process.env.SUPERADMIN_EMAIL) {
      const mailOptions = {
        from: `"Fantasy Bowling App" <${process.env.SMTP_USER}>`,
        to: process.env.SUPERADMIN_EMAIL,
        subject: "New User Registration",
        text: `A new user has registered:\n\nName: ${newFirstname} ${newLastname}\nUsername: ${username}` +
              (email ? `\nEmail: ${email}` : ""),
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error("Error sending registration email:", error);
        } else {
          console.log("Registration email sent:", info.response);
        }
      });
    }

    res.json({ message: "User registered successfully!" });
  } catch (error) {
    console.error("Signup Error:", error);
    res.status(500).json({ error: "Something went wrong" });
  }
}

async function login(req, res) {
  const { username, password } = req.body;

  try {
    const user = await db.getUser(username);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "1h" });
    res.json({ token, user: { id: user.id, name: user.username, email: user.email } });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ error: "Login failed" });
  }
}

async function getUser(req, res) {
  const authHeader = req.headers.authorization;

  if (!authHeader) return res.json(null);

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;

    if (!userId) return res.json(null);

    const user = await db.findUser(userId);

    if (!user) return res.json(null);

    // Sort players by numeric position
    if (user.team && user.team.players) {
      user.team.players.sort((a, b) => {
        const posA = isNaN(parseInt(a.position)) ? Infinity : parseInt(a.position);
        const posB = isNaN(parseInt(b.position)) ? Infinity : parseInt(b.position);
        return posA - posB;
      });
    }

    res.json({ ...user, token });
  } catch (err) {
    console.error("getUser error:", err);
    return res.json(null);
  }
}

async function forgotPassword(req, res) {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required." });
  }

  try {
    const user = await db.getUserByEmail(email);

    if (!user) {
      // Avoid revealing if email exists
      return res.status(200).json({ message: "If that email is in our system, we sent a reset link." });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");
    const expires = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    await db.setResetToken(user.id, hashedToken, expires);

    const resetURL = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    await sendPasswordResetEmail(user.email, resetURL);

    return res.status(200).json({ message: "If that email is in our system, we sent a reset link." });
  } catch (error) {
    console.error("Error in forgotPassword:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
}

async function sendPasswordResetEmail(to, resetURL) {
  const transporter = nodemailer.createTransport({
    service: "yahoo", // or your provider
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const mailOptions = {
    from: process.env.SMTP_USER,
    to,
    subject: "Password Reset Request",
    html: `<p>You requested a password reset.</p>
           <p>Click <a href="${resetURL}">here</a> to reset your password. This link expires in 1 hour.</p>`,
  };

  await transporter.sendMail(mailOptions);
}

async function resetPassword(req, res) {
  const { token } = req.params;
  const { password, confirmPassword } = req.body;

  if (!password || !confirmPassword) {
    return res.status(400).json({ error: "Password and confirm password are required." });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: "Passwords do not match." });
  }

  try {
    // Hash token to compare
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // Find user by reset token and make sure not expired
    const user = await db.getUserByResetToken(hashedToken);

    if (!user || user.resetPasswordExpires < new Date()) {
      return res.status(400).json({ error: "Token is invalid or has expired." });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user: set new password, clear token fields
    await db.updatePasswordAndClearResetToken(user.id, hashedPassword);

    res.status(200).json({ message: "Password has been reset successfully. You can now log in." });
  } catch (error) {
    console.error("Error in resetPassword:", error);
    res.status(500).json({ error: "Internal server error." });
  }
}

module.exports = {
  signup, 
  login, 
  getUser,
  forgotPassword, 
  resetPassword,
};

