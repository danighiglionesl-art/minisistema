import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/server/crypto-auth";
import {
  deletePortfolioProject,
  upsertPortfolioProject,
} from "@/lib/server/data-store";
import { PortfolioProject } from "@/types/minisistema";
import { sanitizeText } from "@/lib/validation";

export async function PUT(request: NextRequest) {
  const admin = await getAuthenticatedAdmin();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Partial<PortfolioProject>;
    const name = sanitizeText(body.name, 160);
    const activity = sanitizeText(body.activity, 140);
    const description = sanitizeText(body.description, 1500);
    const problemSolved = sanitizeText(body.problemSolved, 1500);

    if (!name || !activity || !description) {
      return NextResponse.json(
        { error: "Nombre, actividad y descripción del proyecto son obligatorios." },
        { status: 400 }
      );
    }

    const id =
      sanitizeText(body.id, 80) ||
      name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    const project: PortfolioProject = {
      id,
      name,
      logoUrl: body.logoUrl ? sanitizeText(body.logoUrl, 400) : undefined,
      description,
      activity,
      problemSolved: problemSolved || "Solución digital personalizada.",
      features: Array.isArray(body.features)
        ? body.features.map((f) => sanitizeText(f, 160)).filter(Boolean)
        : [],
      screenshots: Array.isArray(body.screenshots)
        ? body.screenshots.map((s) => sanitizeText(s, 400)).filter(Boolean)
        : [],
      status: body.status || "En preparación de caso",
      publicUrl: body.publicUrl ? sanitizeText(body.publicUrl, 400) : undefined,
      published: Boolean(body.published),
    };

    const projects = upsertPortfolioProject(project);
    return NextResponse.json({ ok: true, projects });
  } catch {
    return NextResponse.json(
      { error: "No se pudo guardar el proyecto." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const admin = await getAuthenticatedAdmin();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Falta el ID del proyecto." }, { status: 400 });
  }

  const projects = deletePortfolioProject(id);
  return NextResponse.json({ ok: true, projects });
}
