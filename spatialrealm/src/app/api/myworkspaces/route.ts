import { getToken } from "next-auth/jwt";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req });

    if (!token?.email) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: token.email },
      include: { workspace: true },
    });

    return NextResponse.json({ success: true, workspaces: user?.workspace || [] });
  } catch (error: any) {
    console.error("[MYWORKSPACES_ERROR]", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}