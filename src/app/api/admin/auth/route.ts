import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  getAuthenticatedAdmin,
  getClearSessionCookieConfig,
  getSessionCookieConfig,
} from "@/lib/server/crypto-auth";
import { verifyAdminLogin } from "@/lib/server/data-store";

export async function GET() {
  const session = await getAuthenticatedAdmin();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({
    authenticated: true,
    user: { email: session.email, role: session.role },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const email = (body.email || "").trim();
    const password = body.password || "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "Ingresá tu correo electrónico y contraseña de administrador." },
        { status: 400 }
      );
    }

    const isValid = verifyAdminLogin(email, password);
    if (!isValid) {
      return NextResponse.json(
        { error: "Credenciales de administrador inválidas." },
        { status: 401 }
      );
    }

    const token = createSessionToken(email);
    const response = NextResponse.json({
      ok: true,
      user: { email, role: "admin" },
    });
    response.cookies.set(getSessionCookieConfig(token));
    return response;
  } catch {
    return NextResponse.json(
      { error: "Error al procesar el inicio de sesión." },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(getClearSessionCookieConfig());
  return response;
}
