import { NextRequest, NextResponse } from "next/server";
import { analyzeSTL } from "@/lib/stlParser";
import { computeQuote } from "@/lib/quoteEngine";
import { getCuratedModel } from "@/lib/curatedCatalog";

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";

    // Catálogo curado (D006) ou Model3D designer (L1/D021)
    if (contentType.includes("application/json")) {
      const body = await req.json();
      const catalogId = body.catalogId as string | undefined;
      const modelId = body.modelId as string | undefined;

      if (modelId) {
        const { prisma } = await import("@/lib/db");
        const { getCuratedModel } = await import("@/lib/curatedCatalog");
        const m = await prisma.model3D.findUnique({ where: { id: modelId } });
        if (!m) {
          return NextResponse.json({ error: "Modelo do designer não encontrado." }, { status: 404 });
        }
        // Geometria demo: reusa catálogo curado se fileUrl bater; senão presilha
        const curated =
          getCuratedModel("fm-cable-clip") ||
          getCuratedModel("fm-hook-wall");
        const result = computeQuote({
          volumeMm3: curated?.volumeMm3 ?? 4500,
          boundingBox: curated?.boundingBox ?? { width: 25, depth: 15, height: 20 },
          trianglesCount: curated?.trianglesCount ?? 3200,
          filename: m.title.replace(/\s+/g, "_").toLowerCase() + ".stl",
          material: body.material || curated?.defaultMaterial || "PLA",
          infillPercent: parseInt(String(body.infill ?? "20"), 10),
          layerHeight: body.layerHeight || "0.20",
          infillPattern: body.infillPattern || "grid",
          royaltyPrice: m.royaltyPrice,
        });
        return NextResponse.json({ ...result, modelId: m.id, fileUrl: m.fileUrl });
      }

      if (!catalogId) {
        return NextResponse.json(
          { error: "Informe catalogId, modelId ou envie um arquivo STL." },
          { status: 400 }
        );
      }
      const model = getCuratedModel(catalogId);
      if (!model) {
        return NextResponse.json({ error: "Modelo do catálogo não encontrado." }, { status: 404 });
      }

      const result = computeQuote({
        volumeMm3: model.volumeMm3,
        boundingBox: model.boundingBox,
        trianglesCount: model.trianglesCount,
        filename: model.filename,
        material: body.material || model.defaultMaterial,
        infillPercent: parseInt(String(body.infill ?? "20"), 10),
        layerHeight: body.layerHeight || "0.20",
        infillPattern: body.infillPattern || "grid",
        royaltyPrice: parseFloat(String(body.royalty ?? "0")),
      });

      return NextResponse.json(result);
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const material = (formData.get("material") as string) || "PLA";
    const infillPercent = parseInt((formData.get("infill") as string) || "20", 10);
    const royaltyPrice = parseFloat((formData.get("royalty") as string) || "0.0");
    const layerHeight = (formData.get("layerHeight") as string) || "0.20";
    const infillPattern = (formData.get("infillPattern") as string) || "grid";

    if (!file) {
      return NextResponse.json(
        { error: "Nenhum arquivo STL foi enviado." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const analysis = analyzeSTL(buffer);

    const result = computeQuote({
      volumeMm3: analysis.volume,
      boundingBox: analysis.boundingBox,
      trianglesCount: analysis.trianglesCount,
      filename: file.name,
      material,
      infillPercent,
      layerHeight,
      infillPattern,
      royaltyPrice,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("Erro no processamento da cotação:", error);
    return NextResponse.json(
      { error: "Falha ao processar cotação.", details: message },
      { status: 500 }
    );
  }
}
