import { NextRequest, NextResponse } from "next/server";
import { analyzeSTL } from "@/lib/stlParser";

// Densidades de materiais mais comuns em g/cm³
const MATERIAL_DENSITIES: Record<string, number> = {
  PLA: 1.24,
  ABS: 1.04,
  PETG: 1.27,
  RESINA: 1.15
};

// Custo do material por grama (R$/g) com base no preço de mercado por Kg
const MATERIAL_COST_PER_GRAM: Record<string, number> = {
  PLA: 0.12,    // R$ 120 / Kg
  ABS: 0.10,    // R$ 100 / Kg
  PETG: 0.13,   // R$ 130 / Kg
  RESINA: 0.25  // R$ 250 / Kg
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const material = (formData.get("material") as string || "PLA").toUpperCase();
    const infillPercent = parseInt(formData.get("infill") as string || "20", 10);
    const royaltyPrice = parseFloat(formData.get("royalty") as string || "0.0");
    const layerHeight = formData.get("layerHeight") as string || "0.20";
    const infillPattern = formData.get("infillPattern") as string || "grid";

    if (!file) {
      return NextResponse.json(
        { error: "Nenhum arquivo STL foi enviado." },
        { status: 400 }
      );
    }

    // Lê o arquivo como Buffer na memória
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Roda o analisador geométrico STL
    const analysis = analyzeSTL(buffer);

    // 1. Cálculo do Volume Real com base no Infill (Preenchimento) e Padrão
    // Uma peça nunca é impressa 100% oca nem 100% sólida por padrão.
    // Fórmula empírica: cascas e perímetros representam 30% do material do volume total sólido,
    // e o infill representa os 70% restantes.
    const infillRatio = infillPercent / 100;
    
    // Multiplicador de padrão de preenchimento (Giroide consome +5%, Colmeia +8% devido às curvas/linhas extras)
    const patternWeightMultiplier = 
      infillPattern === "gyroid" ? 1.05 : 
      infillPattern === "honeycomb" ? 1.08 : 1.00;

    const realVolumeCm3 = (analysis.volume / 1000) * (infillRatio * 0.7 + 0.3) * patternWeightMultiplier;

    // 2. Peso Estimado em Gramas (Volume em cm³ * Densidade g/cm³)
    const density = MATERIAL_DENSITIES[material] || 1.24;
    const estimatedWeightG = realVolumeCm3 * density;

    // 3. Tempo Estimado de Impressão (Baseado em impressoras modernas como Bambu Lab / K1)
    // Multiplicador de tempo por altura de camada (0.12mm aumenta o tempo em 60%, 0.28mm reduz o tempo em 30%)
    const layerTimeMultiplier = 
      layerHeight === "0.12" ? 1.60 : 
      layerHeight === "0.28" ? 0.70 : 1.00;

    // Velocidade de deposição média de 18 gramas por hora.
    // Adiciona-se 0.5 horas (30 minutos) fixas para aquecimento, setup de mesa e calibração inicial.
    const timeToPrintHours = Math.max(0.5, (estimatedWeightG / 18) * layerTimeMultiplier);

    // 4. Detalhamento Financeiro (Precificação)
    const costPerGram = MATERIAL_COST_PER_GRAM[material] || 0.12;
    const materialCost = estimatedWeightG * costPerGram;
    
    // R$ 12,00 por hora de máquina (energia, desgaste, manutenção)
    const machineCost = timeToPrintHours * 12.00;
    
    // Lucro do Maker parceiro (40% sobre o custo operacional)
    const makerProfit = (materialCost + machineCost) * 0.40;
    
    const makerPayout = materialCost + machineCost + makerProfit;

    // Taxa da plataforma FabMakers (25% sobre o pagamento do Maker, representando 20% do preço final do cliente)
    const platformFee = makerPayout * 0.25;

    // Preço total cobrado ao cliente
    const totalPrice = makerPayout + platformFee + royaltyPrice;

    return NextResponse.json({
      success: true,
      filename: file.name,
      trianglesCount: analysis.trianglesCount,
      boundingBox: analysis.boundingBox,
      metrics: {
        rawVolumeMm3: Math.round(analysis.volume),
        realVolumeCm3: Math.round(realVolumeCm3 * 100) / 100,
        weightG: Math.round(estimatedWeightG * 10) / 10,
        timeHours: Math.round(timeToPrintHours * 10) / 10,
        timeFormatted: formatHours(timeToPrintHours)
      },
      pricing: {
        materialCost: Math.round(materialCost * 100) / 100,
        machineCost: Math.round(machineCost * 100) / 100,
        makerProfit: Math.round(makerProfit * 100) / 100,
        makerPayout: Math.round(makerPayout * 100) / 100,
        platformFee: Math.round(platformFee * 100) / 100,
        royaltyPrice: Math.round(royaltyPrice * 100) / 100,
        totalPrice: Math.round(totalPrice * 100) / 100
      }
    });

  } catch (error: any) {
    console.error("Erro no processamento do STL:", error);
    return NextResponse.json(
      { error: "Falha ao analisar o arquivo STL geométrico.", details: error.message },
      { status: 500 }
    );
  }
}

function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m} min`;
  return `${h}h ${m}min`;
}
