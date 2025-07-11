require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const { google } = require("googleapis");

// —————— 1) Configure Google Sheets via service account JSON ——————
const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });

// —————— 2) Configure Nodemailer SMTP using Gmail ——————
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// —————— 3) Express setup ——————
const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// —————— Utility: Append a click to Sheets ——————
async function recordClick(recipient) {
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.SHEET_ID,
      range: "Sheet1!A:C",
      valueInputOption: "RAW",
      requestBody: {
        values: [[new Date().toISOString(), recipient, "Yes"]],
      },
    });
  } catch (err) {
    console.error("🔴 Sheets append failed:", err.message);
    throw err;
  }
}

// —————— 4) POST /send ——————
app.post("/send", async (req, res) => {
  const { recipient } = req.body;
  if (!recipient) {
    return res.status(400).json({ success: false, error: "Missing recipient" });
  }

  const clickLink =
    "http://localhost:3000/track?rcpt=" + encodeURIComponent(recipient);

  const mailOptions = {
    from: process.env.SMTP_USER,
    to: recipient,
    subject: "Important: Verify Your Account",
    html: `
      <p>Dear user,</p>
      <p>Please <a href="${clickLink}">click here</a> to verify your account.</p>
      <p>Thank you.</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return res.json({ success: true });
  } catch (err) {
    console.error("🔴 SMTP sendMail failed:", err.message);
    return res
      .status(500)
      .json({ success: false, error: "Failed to send email" });
  }
});

// —————— 5) GET /track ——————
app.get("/track", async (req, res) => {
  const rcpt = req.query.rcpt;
  if (!rcpt) {
    return res.status(400).send("Missing rcpt query parameter");
  }

  try {
    await recordClick(rcpt);
    res.send("<h1>Thank you — your click has been recorded!</h1>");
  } catch {
    res.status(500).send("<h1>Error recording click.</h1>");
  }
});

// —————— 6) Launch server ——————
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`✅ Server listening at http://localhost:${PORT}`)
);
