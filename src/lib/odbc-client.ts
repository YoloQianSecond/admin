import 'server-only';
import 'dotenv/config';
import odbc from 'odbc';

type OdbcParam = string | number | boolean | Buffer | Date | null;

function ensureLen(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  return value.length > max ? value.slice(0, max) : value;
}

const nn = <T>(v: T | null | undefined): T | null => (v === undefined ? null : v);

type ConnWithEvents = odbc.Connection & {
  on?: (event: 'error', listener: (err: unknown) => void) => void;
};

const connStr =
  `DRIVER=ODBC Driver 18 for SQL Server;` +
  `SERVER=${process.env.SQL_HOST};` +
  `DATABASE=${process.env.SQL_DB};` +
  `UID=${process.env.SQL_USER};PWD=${process.env.SQL_PASSWORD};` +
  `Encrypt=yes;TrustServerCertificate=no;` +
  `ColumnEncryption=Enabled;` +
  `KeyStoreAuthentication=KeyVaultClientSecret;` +
  `KeyStorePrincipalId=${process.env.CLIENT_ID};` +
  `KeyStoreSecret=${process.env.CLIENT_SECRET};`;

let pool: odbc.Connection | null = null;

interface SqlError extends Error {
  number?: number;
}

export async function getConnection(): Promise<odbc.Connection> {
  if (!pool) {
    pool = await odbc.connect(connStr);
    (pool as ConnWithEvents).on?.('error', (e: unknown) => console.error('[ODBC error]', e));
  }
  return pool;
}

/* ------------------------ READ (enforced) ------------------------ */
export async function readAllTeamMembers() {
  const cn = await getConnection();
  const rows = await cn.query<{
    id: string;
    createdAt: string;
    updatedAt: string;
    name: string;
    email: string;
    teamName: string | null;
    teamTricode: string | null;
    discordId: string | null;
    gameId: string | null;
    role: string;
  }>(`
    SELECT
      id, createdAt, updatedAt,
      name, email, teamName, teamTricode, discordId, gameId, role
    FROM dbo.TeamMember
    ORDER BY createdAt DESC;
  `);
  return rows;
}

/* ------------------------ INSERT (enforced) ------------------------ */
export async function insertTeamMemberAE(data: {
  name: string;
  email: string;
  teamName?: string | null;
  teamTricode?: string | null;
  discordId?: string | null;
  gameId?: string | null;
  role?: string; // default MEMBER
  passportId?: string | null;
  nationalId?: string | null;
  bankDetails?: string | null;
  phone?: string | null;
}) {
  const cn = await getConnection();
  const role = (data.role ?? 'MEMBER').toUpperCase();

  // 1) Duplicate email
  {
    const rows = await cn.query<{ id: string }>(
      `SELECT TOP 1 id FROM dbo.TeamMember WHERE email = ?;`,
      [data.email] as unknown as (string | number)[]
    );
    if (rows.length > 0) {
      const err: SqlError = new Error('Duplicate email');
      err.number = 2627;
      throw err;
    }
  }

  // 2) One COACH/LEADER per team
  if (data.teamTricode && (role === 'COACH' || role === 'LEADER')) {
    const rows = await cn.query<{ id: string }>(
      `SELECT TOP 1 id FROM dbo.TeamMember WHERE teamTricode = ? AND role = ?;`,
      [data.teamTricode, role] as unknown as (string | number)[]
    );
    if (rows.length > 0) {
      const err: SqlError = new Error(`${role} already exists for this team`);
      err.number = 2601;
      throw err;
    }
  }

  // 3) Insert
  const sql = `
    INSERT INTO dbo.TeamMember
      (id, createdAt, updatedAt, name, email, teamName, teamTricode,
       discordId, gameId, role, passportId, nationalId, bankDetails, phone)
    OUTPUT INSERTED.id
    VALUES
      (NEWID(), SYSUTCDATETIME(), SYSUTCDATETIME(),
       ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `;

  const params: OdbcParam[] = [
    nn(data.name),
    nn(data.email),
    nn(data.teamName),
    ensureLen(data.teamTricode, 3),
    nn(data.discordId),
    nn(data.gameId),
    role,
    nn(data.passportId),
    nn(data.nationalId),
    nn(data.bankDetails),
    nn(data.phone),
  ];

  const result = await cn.query<{ id: string }>(
    sql,
    params as unknown as (string | number)[]
  );
  return result[0]?.id;
}

/* ------------------------ UPDATE (enforced) ------------------------ */
export async function updateTeamMemberAE(
  id: string,
  patch: {
    name?: string | null;
    email?: string | null;
    teamName?: string | null;
    teamTricode?: string | null;
    discordId?: string | null;
    gameId?: string | null;
    role?: 'LEADER' | 'MEMBER' | 'SUBSTITUTE' | 'COACH' | null;
    passportId?: string | null;
    nationalId?: string | null;
    bankDetails?: string | null;
    phone?: string | null;
  }
) {
  const cn = await getConnection();

  // Read current (for rule checks)
  const cur = await cn.query<{
    email: string;
    teamTricode: string | null;
    role: string;
  }>(
    `SELECT email, teamTricode, role FROM dbo.TeamMember WHERE id = ?;`,
    [id] as unknown as (string | number)[]
  );
  if (cur.length === 0) throw new Error('Not found');

  const nextEmail = patch.email ?? cur[0].email;
  const nextRole = (patch.role ?? cur[0].role).toUpperCase();
  const nextTri = (patch.teamTricode ?? cur[0].teamTricode) || null;

  // A) Duplicate email
  if (nextEmail.toLowerCase() !== cur[0].email.toLowerCase()) {
    const dup = await cn.query<{ id: string }>(
      `SELECT TOP 1 id FROM dbo.TeamMember WHERE email = ? AND id <> ?;`,
      [nextEmail, id] as unknown as (string | number)[]
    );
    if (dup.length > 0) {
      const err: SqlError = new Error('Duplicate email');
      err.number = 2627;
      throw err;
    }
  }

  // B) Leader/Coach constraint
  if (nextTri && (nextRole === 'COACH' || nextRole === 'LEADER')) {
    const clash = await cn.query<{ id: string }>(
      `SELECT TOP 1 id FROM dbo.TeamMember WHERE teamTricode = ? AND role = ? AND id <> ?;`,
      [nextTri, nextRole, id] as unknown as (string | number)[]
    );
    if (clash.length > 0) {
      const err: SqlError = new Error(`${nextRole} already exists for this team`);
      err.number = 2601;
      throw err;
    }
  }

  // Build dynamic SET
  const sets: string[] = [];
  const vals: OdbcParam[] = [];

  const push = (col: string, v: unknown, transform?: (x: unknown) => unknown) => {
    const val = (transform ? transform(v) : v) as string | null | undefined;
    if (val !== undefined) {
      sets.push(`${col} = ?`);
      vals.push(nn(val));
    }
  };

  push('name', patch.name);
  push('email', patch.email);
  push('teamName', patch.teamName);
  push('teamTricode', ensureLen(patch.teamTricode, 3));
  push('discordId', patch.discordId);
  push('gameId', patch.gameId);
  push('role', patch.role, (r) => (r ? String(r).toUpperCase() : r));
  push('passportId', patch.passportId);
  push('nationalId', patch.nationalId);
  push('bankDetails', patch.bankDetails);
  push('phone', patch.phone);

  sets.push('updatedAt = SYSUTCDATETIME()');

  if (sets.length === 1) return id;

  const sql = `
    UPDATE dbo.TeamMember
       SET ${sets.join(', ')}
     OUTPUT INSERTED.id
     WHERE id = ?;
  `;
  vals.push(id);

  const result = await cn.query<{ id: string }>(
    sql,
    vals as unknown as (string | number)[]
  );
  return result[0]?.id;
}

/* ------------------------ DELETE ------------------------ */
export async function deleteTeamMemberById(id: string) {
  const cn = await getConnection();
  const res = await cn.query(
    `DELETE FROM dbo.TeamMember WHERE id = ?;`,
    [id] as unknown as (string | number)[]
  );
  return res.count ?? 0;
}

/* ------------------------ READ LATEST ------------------------ */
export async function readLatestTeamMembers(limit = 5) {
  const cn = await getConnection();
  const rows = await cn.query<{
    id: string;
    createdAt: string;
    name: string;
    email: string;
    teamName: string | null;
    teamTricode: string | null;
    role: string;
    phone: string | null;
  }>(`
    SELECT TOP (${limit})
      id, createdAt, name, email, teamName, teamTricode, role, phone
    FROM dbo.TeamMember
    ORDER BY createdAt DESC;
  `);
  return rows;
}
