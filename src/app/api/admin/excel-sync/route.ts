import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { getCurrentViewer } from "@/infrastructure/auth/pintofruta-auth";

export const runtime = "nodejs";

const contentType = "application/vnd.ms-excel.sheet.macroEnabled.12";

async function findSynchronizerFile() {
  const locations = [
    path.join(process.cwd(), "artifacts"),
    path.join(process.cwd(), "public", "downloads"),
  ];

  for (const directory of locations) {
    try {
      const files = await readdir(directory);
      const candidates = files
        .filter((file) => /^PintoFruta_Catalogo_Sincronizador(?:_v\d+)?\.xlsm$/i.test(file) || /^Sincronizador de precios\.xlsm$/i.test(file))
        .sort((left, right) => {
          const leftVersion = Number(left.match(/_v(\d+)\.xlsm$/i)?.[1] ?? 0);
          const rightVersion = Number(right.match(/_v(\d+)\.xlsm$/i)?.[1] ?? 0);
          return rightVersion - leftVersion;
        });
      const fileName = candidates[0];
      if (fileName) return { fileName, filePath: path.join(directory, fileName) };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  throw new Error("No hay un sincronizador Excel empaquetado.");
}

export async function GET() {
  try {
    const viewer = await getCurrentViewer();
    if (!viewer?.authenticated || !viewer.isAdmin) {
      return Response.json({ ok: false, error: "No autorizado." }, { status: 403 });
    }

    const { filePath } = await findSynchronizerFile();
    const buffer = await readFile(filePath);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": 'attachment; filename="Sincronizador de precios.xlsm"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[admin-excel-sync]", error instanceof Error ? error.message : error);
    return Response.json({ ok: false, error: "No se pudo descargar el sincronizador de precios." }, { status: 500 });
  }
}
