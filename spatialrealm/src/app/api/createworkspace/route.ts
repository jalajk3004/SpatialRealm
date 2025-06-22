import prisma from '@/lib/prisma';
import dotenv from 'dotenv';

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
   try {
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json({ success: false, error: "Workspace name is required" }, { status: 400 });
    }

    const workspace = await prisma.workspace.create({
      data: {
        name,
      },
    });

    return NextResponse.json({ success: true, workspace });
  } catch (error: any) {
    console.error("[WORKSPACE_CREATE_ERROR]", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}