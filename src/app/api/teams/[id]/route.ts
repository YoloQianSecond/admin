import { NextRequest, NextResponse } from "next/server";
import { withCors, corsPreflight } from "@/lib/cors";
import {
  updateTeamMemberAE,
  deleteTeamMemberById,
} from "@/lib/odbc-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["LEADER", "MEMBER", "SUBSTITUTE", "COACH"] as const;
type Role = (typeof ALLOWED_ROLES)[number];

export async function OPTIONS() {
  return corsPreflight();
}

/* -------------------------------------------------------------------------- */
/*                               PATCH (Update)                               */
/* -------------------------------------------------------------------------- */
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = await req.json();

  const role = body.role ? String(body.role).toUpperCase() : undefined;
  if (role && !ALLOWED_ROLES.includes(role as Role)) {
    return withCors(
      NextResponse.json(
        { ok: false, error: `Invalid role. Use one of: ${ALLOWED_ROLES.join(", ")}` },
        { status: 400 }
      )
    );
  }

  try {
    const updatedId = await updateTeamMemberAE(id, {
      name: body.name ?? undefined,
      email: body.email ?? undefined,
      teamName: body.teamName ?? undefined,
      teamTricode: body.teamTricode ?? undefined,
      discordId: body.discordId ?? undefined,
      gameId: body.gameId ?? undefined,
      role: role as Role ?? undefined,
      passportId: body.passportId ?? undefined,
      nationalId: body.nationalId ?? undefined,
      bankDetails: body.bankDetails ?? undefined,
      phone: body.phone ?? undefined,
    });

    return withCors(
      NextResponse.json({ ok: true, id: updatedId }, { status: 200 })
    );
  } catch (err: unknown) {
    const msg = (err as Error).message || "Server error";

    if (msg.includes("Duplicate email")) {
      return withCors(
        NextResponse.json(
          { ok: false, error: "Duplicate email. Each email must be unique." },
          { status: 409 }
        )
      );
    }

    if (msg.includes("COACH")) {
      return withCors(
        NextResponse.json(
          { ok: false, error: "Coach already exists for this team" },
          { status: 409 }
        )
      );
    }

    if (msg.includes("LEADER")) {
      return withCors(
        NextResponse.json(
          { ok: false, error: "Team captain (leader) already exists for this team" },
          { status: 409 }
        )
      );
    }

    console.error("PATCH /teams/[id] error:", err);
    return withCors(
      NextResponse.json({ ok: false, error: msg }, { status: 500 })
    );
  }
}

/* -------------------------------------------------------------------------- */
/*                               DELETE (Remove)                              */
/* -------------------------------------------------------------------------- */
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  try {
    const count = await deleteTeamMemberById(id);
    if (count === 0) {
      return withCors(
        NextResponse.json({ ok: false, error: "Member not found." }, { status: 404 })
      );
    }
    return withCors(NextResponse.json({ ok: true }));
  } catch (err: unknown) {
    console.error("DELETE /teams/[id] error:", err);
    return withCors(
      NextResponse.json({ ok: false, error: "Delete failed." }, { status: 500 })
    );
  }
}
