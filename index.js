require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const { google } = require("googleapis");

// 1) Configure GoogleAuth using the file path
const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS, // e.g. "/etc/secrets/sa-key.json"
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });

// 2) Set up Nodemailer
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.post("/send", async (req, res) => {
  const { recipient } = req.body;
  const clickLink = `${process.env.BASE_URL}/track?rcpt=${encodeURIComponent(
    recipient
  )}`;

  const mailOptions = {
    from: process.env.SMTP_USER,
    to: recipient,
    subject: "Important: Verify Your Account",
    html: `<p>Please <a href="${clickLink}">click here</a> to verify.</p>`,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.toString() });
  }
});

app.get("/track", async (req, res) => {
  const rcpt = req.query.rcpt;
  const timestamp = new Date().toISOString();
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.SHEET_ID,
      range: "Sheet1!A:C",
      valueInputOption: "RAW",
      requestBody: { values: [[timestamp, rcpt, "Yes"]] },
    });
  } catch (err) {
    console.error("🔴 Sheets append failed:", err.message);
  }
  res.send("<h1>Thanks—your click is recorded!</h1>");
});

// 3) Use Render's port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`✅ Server listening at http://localhost:${PORT}`)
);
