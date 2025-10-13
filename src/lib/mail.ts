// src/lib/mail.ts
// Microsoft Graph (OAuth2) mailer — no SMTP, MFA-safe

import "isomorphic-fetch";
import { Client } from "@microsoft/microsoft-graph-client";
import { ClientSecretCredential } from "@azure/identity";

// ---- Required env (Graph client credentials) ----
const MS_TENANT_ID = process.env.MS_TENANT_ID || "";
const MS_CLIENT_ID = process.env.MS_CLIENT_ID || "";
const MS_CLIENT_SECRET = process.env.MS_CLIENT_SECRET || "";
const MAIL_SENDER = process.env.MAIL_SENDER || ""; // e.g. support@yourdomain.com

// ---- Optional branding / admin ----
const FROM_NAME = process.env.FROM_NAME || "Odyssey Cup"; // display name
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";

// Lazily-initialized Graph client
let graphClient: Client | null = null;

function getGraph(): Client | null {
  if (graphClient) return graphClient;

  if (!MS_TENANT_ID || !MS_CLIENT_ID || !MS_CLIENT_SECRET || !MAIL_SENDER) {
    console.warn(
      "[mail-graph] Missing MS_TENANT_ID / MS_CLIENT_ID / MS_CLIENT_SECRET / MAIL_SENDER — emails will be logged only"
    );
    return null;
  }

  const credential = new ClientSecretCredential(MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET);

  graphClient = Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => {
        const token = await credential.getToken("https://graph.microsoft.com/.default");
        if (!token?.token) throw new Error("Failed to acquire Graph access token");
        return token.token;
      },
    },
  });

  return graphClient;
}

// ---------------- Generic Send Wrapper (Graph) ----------------
async function sendEmailRaw(to: string, subject: string, html: string) {
  if (!to) return;

  const client = getGraph();
  if (!client) {
    // Dev fallback: just log instead of sending
    console.log(`[mail:dev] To=${to} | Subject="${subject}"`);
    return;
  }

  try {
    const message = {
      subject,
      body: { contentType: "HTML", content: html },
      toRecipients: [{ emailAddress: { address: to } }],
      from: { emailAddress: { name: FROM_NAME, address: MAIL_SENDER } }, // display name
      // If you need reply-to that differs from sender, uncomment:
      // replyTo: [{ emailAddress: { address: "hello@yourbrand.com" } }],
    };

    await client.api(`/users/${encodeURIComponent(MAIL_SENDER)}/sendMail`).post({
      message,
      saveToSentItems: true,
    });

    console.log(`[mail] Graph sent: ${subject} → ${to}`);
  } catch (err: any) {
    console.error("[mail] Graph send failed:", err?.message || err);
  }
}

// ---------------- High-Level Functions (unchanged API) ----------------
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
