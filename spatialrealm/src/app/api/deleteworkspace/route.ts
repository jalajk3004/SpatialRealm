import { getToken } from "next-auth/jwt";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(req: NextRequest) {
  try {
    const token = await getToken({ req });
    if (!token?.email) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { name } = await req.json();

    if (!name) {
      return NextResponse.json({ success: false, error: "Workspace name is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: token.email } });

    const workspace = await prisma.workspace.findFirst({
      where: {
        name,
        users: { some: { id: user?.id } },
      },
    });

    if (!workspace) {
      return NextResponse.json({ success: false, error: "Workspace not found or not authorized" }, { status: 404 });
    }

    await prisma.workspace.delete({ where: { id: workspace.id } });

    return NextResponse.json({ success: true, message: "Workspace deleted" });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}