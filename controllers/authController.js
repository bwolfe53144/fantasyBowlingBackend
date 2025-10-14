require("dotenv").config();
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");
const nodemailer = require("nodemailer");
const db = require("../db/authQueries");

const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL;
const JWT_SECRET = process.env.JWT_SECRET;

// ✅ Create reusable email transporter for Brevo SMTP
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT, 10),
  secure: false, // use TLS
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false, // avoids certain TLS errors
  },
});

// --- PASSPORT STRATEGY ---
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

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await db.findUser(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// --- SIGNUP ---
async function signup(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { firstname, lastname, username, email, password, confPassword } = req.body;

    const checkInfo = await db.checkUsernameEmail(username, email || null);
    if (checkInfo) return res.status(400).json({ error: "Username or email already exists" });

    if (password !== confPassword)
      return res.status(400).json({ error: "Passwords do not match" });

    const newFirstname = firstname.charAt(0).toUpperCase() + firstname.slice(1).toLowerCase();
    const newLastname = lastname.charAt(0).toUpperCase() + lastname.slice(1).toLowerCase();

    const checkName = await db.checkName(newFirstname, newLastname);
    if (checkName)
      return res.status(400).json({ error: "First and last name combination already in use" });

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.addUser(newFirstname, newLastname, req.body, hashedPassword);

    // Notify superadmin
    if (SUPERADMIN_EMAIL) {
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_FROM,
          to: SUPERADMIN_EMAIL,
          subject: "New User Registration",
          text:
            `A new user has registered:\n\n` +
            `Name: ${newFirstname} ${newLastname}\nUsername: ${username}` +
            (email ? `\nEmail: ${email}` : ""),
        });
        console.log("✅ Registration email sent via Brevo SMTP");
      } catch (err) {
        console.error("❌ Error sending registration email:", err);
      }
    }

    res.json({ message: "User registered successfully!" });
  } catch (error) {
    console.error("Signup Error:", error);
    res.status(500).json({ error: "Something went wrong" });
  }
}

// --- LOGIN ---
async function login(req, res) {
  const { username, password } = req.body;

  try {
    const user = await db.getUser(username);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "24h" });
    res.json({ token, user: { id: user.id, name: user.username, email: user.email } });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ error: "Login failed" });
  }
}

// --- GET USER ---
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

    // Sort players by position
    if (user.team?.players) {
      user.team.players.sort((a, b) => {
        const posA = isNaN(parseInt(a.position)) ? Infinity : parseInt(a.position);
        const posB = isNaN(parseInt(b.position)) ? Infinity : parseInt(b.position);
        return posA - posB;
      });

      user.team.players = user.team.players.map((player) => ({
        ...player,
        tradePlayers: player.tradePlayers.map((tp) => ({
          id: tp.id,
          playerId: tp.playerId,
          tradeId: tp.tradeId,
          role: tp.role,
          trade: tp.trade
            ? {
                status: tp.trade.status,
                fromTeam: tp.trade.fromTeam,
                toTeam: tp.trade.toTeam,
              }
            : null,
        })),
      }));
    }

    res.json({ ...user, token });
  } catch (err) {
    console.error("getUser error:", err);
    return res.json(null);
  }
}

// --- FORGOT PASSWORD ---
async function forgotPassword(req, res) {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required." });

  try {
    const user = await db.getUserByEmail(email);
    if (!user) {
      return res.status(200).json({
        message: "If that email is in our system, we sent a reset link.",
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");
    const expires = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    await db.setResetToken(user.id, hashedToken, expires);

    const resetURL = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    await sendPasswordResetEmail(user.email, resetURL);

    res.status(200).json({
      message: "If that email is in our system, we sent a reset link.",
    });
  } catch (error) {
    console.error("Error in forgotPassword:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
}

// --- SEND PASSWORD RESET EMAIL ---
async function sendPasswordResetEmail(to, resetURL) {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject: "Password Reset Request",
      html: `<p>You requested a password reset.</p>
             <p>Click <a href="${resetURL}">here</a> to reset your password. This link expires in 1 hour.</p>`,
    });
    console.log(`✅ Password reset email sent to ${to}`);
  } catch (error) {
    console.error("❌ Error sending password reset email:", error);
  }
}

// --- RESET PASSWORD ---
async function resetPassword(req, res) {
  const { token } = req.params;
  const { password, confirmPassword } = req.body;

  if (!password || !confirmPassword)
    return res.status(400).json({ error: "Password and confirm password are required." });

  if (password !== confirmPassword)
    return res.status(400).json({ error: "Passwords do not match." });

  try {
    // Hash the token from the URL to match database
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    console.log("Received token:", token);
    console.log("Hashed token:", hashedToken);

    // Look up the user by hashed token
    const user = await db.getUserByResetToken(hashedToken);
    console.log("User fetched from DB:", user);

    if (!user) {
      console.log("No user found with this token");
      return res.status(400).json({ error: "Token is invalid or has expired." });
    }

    console.log("Token expires at:", user.resetPasswordExpires);
    console.log("Current time:", new Date());

    if (user.resetPasswordExpires < new Date()) {
      console.log("Token has expired");
      return res.status(400).json({ error: "Token is invalid or has expired." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.updatePasswordAndClearResetToken(user.id, hashedPassword);

    res.status(200).json({
      message: "Password has been reset successfully. You can now log in.",
    });
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

