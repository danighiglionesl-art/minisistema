import zlib from "node:zlib";
import { NextRequest, NextResponse } from "next/server";

const GZIP_THRESHOLD_BYTES = 100_000;

/**
 * Serializa JSON y aplica gzip automáticamente cuando el payload supera ~100 KB
 * y el cliente acepta gzip. Esto evita el límite de 4.5 MB de respuesta en Vercel
 * Serverless Functions para bases grandes (ej. catalog_db / ventas_db de 10 MB)
 * y acelera drásticamente la carga inicial del ERP y del Carrito Online.
 */
export function jsonResponseMaybeGzip(
  req: NextRequest,
  data: unknown,
  init?: { status?: number; headers?: Record<string, string> }
): NextResponse {
  const status = init?.status ?? 200;
  const extraHeaders = init?.headers ?? {};
  const jsonStr = JSON.stringify(data);
  const rawBuf = Buffer.from(jsonStr, "utf8");
  const acceptEnc = (req.headers.get("accept-encoding") || "").toLowerCase();

  if (rawBuf.byteLength >= GZIP_THRESHOLD_BYTES && acceptEnc.includes("gzip")) {
    const gz = zlib.gzipSync(rawBuf, { level: 4 });
    return new NextResponse(gz, {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Encoding": "gzip",
        "Content-Length": String(gz.byteLength),
        Vary: "Accept-Encoding",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        ...extraHeaders,
      },
    });
  }

  return new NextResponse(rawBuf, {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Length": String(rawBuf.byteLength),
      "Cache-Control": "no-store, no-cache, must-revalidate",
      ...extraHeaders,
    },
  });
}
