// src/lib/mail.ts
// Gmail SMTP mailer with Nodemailer + full logging

import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_SECURE = String(process.env.SMTP_SECURE || "true") === "true"; // true for 465, false for 587
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const FROM_EMAIL = process.env.FROM_EMAIL || SMTP_USER || "no-reply@example.com";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";

// ---------------- SMTP Transport Setup ----------------
let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;

  if (!SMTP_USER || !SMTP_PASS) {
    console.warn("[mail] SMTP_USER or SMTP_PASS missing — emails will be logged only");
    return null;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  // Verify connection at startup
  transporter.verify((err) => {
    if (err) {
      console.error("[mail] SMTP connection failed:", err);
    } else {
      console.log("[mail] SMTP connection OK");
    }
  });

  return transporter;
}

// ---------------- Generic Send Wrapper ----------------
async function sendEmailRaw(to: string, subject: string, html: string) {
  if (!to) return;

  const tx = getTransporter();
  if (!tx) {
    // Dev fallback: just log instead of sending
    console.log(`[mail:dev] To=${to} | Subject="${subject}"`);
    return;
  }

  try {
    const info = await tx.sendMail({
      from: `Odyssey Cup <${FROM_EMAIL}>`,
      to,
      subject,
      html,
    });
    console.log(`[mail] Sent: ${subject} → ${to} (id=${info.messageId})`);
  } catch (err) {
    console.error("[mail] Send failed:", err);
  }
}

// ---------------- High-Level Functions ----------------
export async function sendRegistrationEmail(to: string, teamName: string, tricode: string) {
  const subject = `You're registered: ${teamName} (${tricode})`;
  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
      <h2>🎮 Odyssey Cup – Registration Confirmed</h2>
      <p>Hi,</p>
      <p>Your team <strong>${teamName}</strong> (<strong>${tricode}</strong>) has been successfully registered.</p>
      <p>We'll email schedules, rules, and check-in details soon. Keep an eye on your inbox.</p>
      <hr/>
      <p style="font-size:12px;color:#666">If this wasn't you, reply to this email.</p>
    </div>
  `;
  await sendEmailRaw(to, subject, html);
}

export async function sendAdminDigest(emails: string[], teamName: string, tricode: string) {
  if (!ADMIN_EMAIL) return;

  const subject = `New Team Registered: ${teamName} (${tricode})`;
  const list = emails.map((e) => `• ${e}`).join("<br/>");
  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
      <h3>New Team Registered</h3>
      <p><strong>${teamName}</strong> (${tricode})</p>
      <p><strong>Members:</strong><br/>${list}</p>
    </div>
  `;
  await sendEmailRaw(ADMIN_EMAIL, subject, html);
}

export async function sendOtpEmail(to: string, code: string) {
  const subject = `Your Admin Login Code: ${code}`;
  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
      <h2>🔐 Admin Login Code</h2>
      <p>Use this 6-digit code to sign in:</p>
      <p style="font-size:24px;font-weight:bold;letter-spacing:3px">${code}</p>
      <p>This code will expire in 10 minutes. If you didn't request it, ignore this email.</p>
    </div>
  `;
  await sendEmailRaw(to, subject, html);
}
