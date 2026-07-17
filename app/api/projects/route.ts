import { NextRequest, NextResponse } from "next/server";
import { readDb, writeDb, Project } from "@/lib/db";

export async function GET() {
  try {
    const db = readDb();
    const userId = db.currentSessionUserId || "usr-admin"; // Fallback to usr-admin
    const userProjects = db.projects.filter(p => p.userId === userId);
    return NextResponse.json({ success: true, projects: userProjects });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = readDb();
    const userId = db.currentSessionUserId || "usr-admin"; // Fallback
    const body = await req.json();

    const {
      startupName,
      industry,
      projectType,
      expectedUsers,
      expectedGrowth,
      budget,
      region,
      needAI,
      needKubernetes,
      needHighAvailability,
      storageRequirement
    } = body;

    if (!startupName) {
      return NextResponse.json({ success: false, message: "Startup Name is required." }, { status: 400 });
    }

    const newProject: Project = {
      id: `proj-${Date.now()}`,
      userId,
      startupName,
      industry: industry || "General",
      projectType: projectType || "Web App",
      expectedUsers: Number(expectedUsers) || 1000,
      expectedGrowth: expectedGrowth || "stable",
      budget: Number(budget) || 100,
      region: region || "us-east",
      needAI: !!needAI,
      needKubernetes: !!needKubernetes,
      needHighAvailability: !!needHighAvailability,
      storageRequirement: storageRequirement || "low",
      createdAt: new Date().toISOString().split('T')[0]
    };

    db.projects.push(newProject);
    writeDb(db);

    return NextResponse.json({ success: true, project: newProject });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const db = readDb();
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("id");

    if (!projectId) {
      return NextResponse.json({ success: false, message: "Project ID is required." }, { status: 400 });
    }

    const initialLength = db.projects.length;
    db.projects = db.projects.filter(p => p.id !== projectId);
    
    // Also clear associated evaluations
    db.evaluations = db.evaluations.filter(e => e.projectId !== projectId);

    if (db.projects.length === initialLength) {
      return NextResponse.json({ success: false, message: "Project not found." }, { status: 404 });
    }

    writeDb(db);
    return NextResponse.json({ success: true, message: "Project deleted." });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
