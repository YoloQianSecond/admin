/* eslint-disable @typescript-eslint/no-explicit-any */
import * as sql from "mssql";
import { DefaultAzureCredential, TokenCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";

/**
 * Minimal manual AKV provider (substitute for Tedious's internal class)
 * Tedious looks for getKey(), wrapKey(), unwrapKey(), and sign().
 * Only getKey() and unwrapKey() are required for AE read/write.
 */
interface AkvProvider {
  getKey(keyPath: string): Promise<Buffer>;
  unwrapKey(keyPath: string): Promise<Buffer>;
  wrapKey?(): Promise<never>;
  sign?(): Promise<Buffer>;
}

function createManualAkvProvider(credential: TokenCredential): AkvProvider {
  return {
    /** Called by Tedious to unwrap a column encryption key */
    async getKey(keyPath: string): Promise<Buffer> {
      try {
        const vaultUrl = keyPath.split("/keys/")[0];
        const secretName = keyPath.split("/").pop()!;
        const client = new SecretClient(vaultUrl, credential);
        const secret = await client.getSecret(secretName);
        if (!secret.value) throw new Error(`Secret ${secretName} not found`);
        return Buffer.from(secret.value, "base64");
      } catch (err) {
        console.error("[AKV getKey] Failed:", err);
        throw err;
      }
    },
    /** Tedious sometimes calls unwrapKey() alias of getKey() */
    async unwrapKey(keyPath: string): Promise<Buffer> {
      return this.getKey(keyPath);
    },
    async wrapKey(): Promise<never> {
      throw new Error("wrapKey() not implemented — not required for read/decrypt");
    },
    async sign(): Promise<Buffer> {
      return Buffer.alloc(0);
    },
  };
}

/* ─────────────────────────────────────────────────────────────── */
export const TRICODE_LEN = 3;

const credential = new DefaultAzureCredential();
const akvProvider: AkvProvider = createManualAkvProvider(credential);

/** Parse Prisma-style SQL Server URL into mssql config */
function parsePrismaSqlServerUrl(url: string): sql.config {
  const raw = url.replace(/^sqlserver:\/\//, "");
  const parts = raw.split(";").filter(Boolean);
  const [host, portStr] = parts[0].split(":");
  const kv: Record<string, string> = {};
  for (let i = 1; i < parts.length; i++) {
    const [k, v] = parts[i].split("=");
    if (k && v !== undefined) kv[k.trim().toLowerCase()] = v.trim();
  }

  const encrypt = ["true", "1", "yes"].includes((kv["encrypt"] ?? "").toLowerCase());
  const useSqlAuth = process.env.USE_SQL_AUTH === "true";

  const options: sql.IOptions = {
    encrypt,
    columnEncryption: true,
    keyVaultProvider: akvProvider,
    trustServerCertificate: false,
    requestTimeout: 15000,
  };

  return {
    server: host,
    port: portStr ? Number(portStr) : undefined,
    database: kv["database"],
    user: useSqlAuth ? kv["user"] : undefined,
    password: useSqlAuth ? kv["password"] : undefined,
    authentication: useSqlAuth
      ? undefined
      : ({ type: "azure-active-directory-default", options: {} } as unknown as sql.config["authentication"]),
    options,
  } as sql.config;
}

/* ─────────────────────────────────────────────────────────────── */
let poolPromise: Promise<sql.ConnectionPool> | null = null;

export async function getAePool(): Promise<sql.ConnectionPool> {
  if (!poolPromise) {
    const url = process.env.DATABASE_URL;
    if (!url?.startsWith("sqlserver://")) {
      throw new Error("DATABASE_URL missing or invalid");
    }
    try {
      const cfg = parsePrismaSqlServerUrl(url);
      poolPromise = new sql.ConnectionPool(cfg).connect();
      const pool = await poolPromise;
      pool.on("error", (e: unknown) => console.error("[MSSQL pool error]", e));
      return pool;
    } catch (err) {
      console.error("[MSSQL connect error]", err);
      throw err;
    }
  }
  return poolPromise;
}

/* ─────────────────────────────────────────────────────────────── */
export type TeamMemberInsert = {
  name: string;
  email: string;
  teamName?: string | null;
  teamTricode?: string | null;
  discordId?: string | null;
  gameId?: string | null;
  role?: string | null;
  passportId?: string | null;
  nationalId?: string | null;
  bankDetails?: string | null;
  phone?: string | null;
};

/** Insert encrypted team member */
export async function insertTeamMemberAE(data: TeamMemberInsert): Promise<string | undefined> {
  const p = await getAePool();
  try {
    const r = await p
      .request()
      .input("name", sql.NVarChar(255), data.name)
      .input("email", sql.NVarChar(255), data.email)
      .input("teamName", sql.NVarChar(255), data.teamName ?? null)
      .input("teamTricode", sql.NVarChar(255), data.teamTricode ?? null)
      .input("discordId", sql.NVarChar(255), data.discordId ?? null)
      .input("gameId", sql.NVarChar(255), data.gameId ?? null)
      .input("role", sql.NVarChar(255), data.role ?? "MEMBER")
      .input("passportId", sql.NVarChar(255), data.passportId ?? null)
      .input("nationalId", sql.NVarChar(255), data.nationalId ?? null)
      .input("bankDetails", sql.NVarChar(255), data.bankDetails ?? null)
      .input("phone", sql.NVarChar(255), data.phone ?? null)
      .query(`
        DECLARE @o TABLE (id NVARCHAR(255));
        INSERT INTO dbo.TeamMember
          (id, createdAt, updatedAt, name, email, teamName, teamTricode, discordId, gameId, role, passportId, nationalId, bankDetails, phone)
        OUTPUT INSERTED.id INTO @o(id)
        VALUES
          (NEWID(), SYSUTCDATETIME(), SYSUTCDATETIME(),
           @name, @email, @teamName, @teamTricode, @discordId, @gameId, @role, @passportId, @nationalId, @bankDetails, @phone);
        SELECT id FROM @o;
      `);
    return r.recordset?.[0]?.id;
  } catch (err) {
    console.error("[insertTeamMemberAE error]", err);
    throw err;
  }
}

/* ─────────────────────────────────────────────────────────────── */
export async function existsRoleForTeamAE(teamTricode: string, role: "COACH" | "LEADER") {
  const p = await getAePool();
  const r = await p
    .request()
    .input("teamTricode", sql.NVarChar(255), teamTricode)
    .input("role", sql.NVarChar(255), role)
    .query(`
      SELECT TOP 1 id
      FROM dbo.TeamMember
      WHERE teamTricode = @teamTricode AND role = @role
    `);
  return (r.recordset?.length ?? 0) > 0;
}

/* ─────────────────────────────────────────────────────────────── */
export function isSqlDuplicateError(err: unknown): boolean {
  const n =
    (err as { number?: number })?.number ??
    (err as { errno?: number })?.errno ??
    (err as { code?: number })?.code ??
    (err as { originalError?: { info?: { number?: number }; number?: number } })
      ?.originalError?.info?.number ??
    (err as { originalError?: { number?: number } })?.originalError?.number;
  const num = typeof n === "string" ? Number(n) : n;
  return num === 2601 || num === 2627;
}
