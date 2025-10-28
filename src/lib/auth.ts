// src/lib/auth.ts
import { cookies } from "next/headers";
import { getValidSession } from "./session";

export async function requireAdminSession() {
  // 👇 Next.js 15: cookies() is async
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("admin_session")?.value;

  const session = await getValidSession(sessionId);
  if (!session) throw new Error("UNAUTHENTICATED");
  return session;
}
