import { getToken } from "next-auth/jwt";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req });

    if (!token || !token.email) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json({ success: false, error: "Workspace name is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: token.email },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const workspace = await prisma.workspace.create({
      data: {
        name,
        users: {
          connect: { id: user.id },
        },
      },
    });

    return NextResponse.json({ success: true, workspace });
  } catch (error: any) {
    console.error("[WORKSPACE_CREATE_ERROR]", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
