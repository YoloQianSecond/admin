// src/lib/mail-graph.ts
import { Client } from "@microsoft/microsoft-graph-client";
import { ClientSecretCredential } from "@azure/identity";
import "isomorphic-fetch";
import type { Message, Recipient } from "@microsoft/microsoft-graph-types";

const TENANT_ID = process.env.MS_TENANT_ID!;
const CLIENT_ID = process.env.MS_CLIENT_ID!;
const CLIENT_SECRET = process.env.MS_CLIENT_SECRET!;
const MAIL_SENDER = process.env.MAIL_SENDER!; // e.g. support@odyssey-cup.com

if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET || !MAIL_SENDER) {
  // Don't crash the process; just log loudly.
  console.error("[mail-graph] Missing Graph env vars");
}

function graphClient(): Client {
  const cred = new ClientSecretCredential(TENANT_ID, CLIENT_ID, CLIENT_SECRET);
  return Client.initWithMiddleware({
    debugLogging: false,
    authProvider: {
      getAccessToken: async () => {
        const token = await cred.getToken("https://graph.microsoft.com/.default");
        if (!token?.token) throw new Error("Failed to acquire Graph token");
        return token.token;
      },
    },
  });
}

export async function sendMailGraph(
  to: string,
  subject: string,
  html: string,
  opts?: {
    cc?: string[];
    bcc?: string[];
    replyTo?: string;
    saveToSentItems?: boolean;
  }
) {
  const client = graphClient();

  const toRecipients: Recipient[] = (to ? [to] : []).map(a => ({
    emailAddress: { address: a },
  }));
  const ccRecipients: Recipient[] = (opts?.cc ?? []).map(a => ({
    emailAddress: { address: a },
  }));
  const bccRecipients: Recipient[] = (opts?.bcc ?? []).map(a => ({
    emailAddress: { address: a },
  }));

  const message: Message = {
    subject,
    // Note: msgraph types expect "text" | "html" (lowercase)
    body: { contentType: "html", content: html },
    toRecipients,
    ...(ccRecipients.length ? { ccRecipients } : {}),
    ...(bccRecipients.length ? { bccRecipients } : {}),
    ...(opts?.replyTo ? { replyTo: [{ emailAddress: { address: opts.replyTo } }] } : {}),
  };

  const saveToSentItems = opts?.saveToSentItems ?? true;

  await client
    .api(`/users/${encodeURIComponent(MAIL_SENDER)}/sendMail`)
    .post({ message, saveToSentItems });

  console.log(`[mail] Graph sent: ${subject} → ${to}`);
}
