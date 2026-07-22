/** Motor de cotação compartilhado (STL analisado ou catálogo curado). */

export const MATERIAL_DENSITIES: Record<string, number> = {
  PLA: 1.24,
  ABS: 1.04,
  PETG: 1.27,
  RESINA: 1.15,
};

export const MATERIAL_COST_PER_GRAM: Record<string, number> = {
  PLA: 0.12,
  ABS: 0.1,
  PETG: 0.13,
  RESINA: 0.25,
};

export type QuoteInput = {
  volumeMm3: number;
  boundingBox: { width: number; depth: number; height: number };
  trianglesCount?: number;
  filename: string;
  material?: string;
  infillPercent?: number;
  layerHeight?: string;
  infillPattern?: string;
  royaltyPrice?: number;
};

export type QuoteResult = {
  success: true;
  filename: string;
  trianglesCount: number;
  boundingBox: { width: number; depth: number; height: number };
  metrics: {
    rawVolumeMm3: number;
    realVolumeCm3: number;
    weightG: number;
    timeHours: number;
    timeFormatted: string;
  };
  pricing: {
    materialCost: number;
    machineCost: number;
    makerProfit: number;
    makerPayout: number;
    platformFee: number;
    royaltyPrice: number;
    totalPrice: number;
  };
};

function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m} min`;
  return `${h}h ${m}min`;
}

export function computeQuote(input: QuoteInput): QuoteResult {
  const material = (input.material || "PLA").toUpperCase();
  const infillPercent = input.infillPercent ?? 20;
  const layerHeight = input.layerHeight || "0.20";
  const infillPattern = input.infillPattern || "grid";
  const royaltyPrice = input.royaltyPrice ?? 0;

  const infillRatio = infillPercent / 100;
  const patternWeightMultiplier =
    infillPattern === "gyroid" ? 1.05 : infillPattern === "honeycomb" ? 1.08 : 1.0;

  const realVolumeCm3 =
    (input.volumeMm3 / 1000) * (infillRatio * 0.7 + 0.3) * patternWeightMultiplier;

  const density = MATERIAL_DENSITIES[material] || 1.24;
  const estimatedWeightG = realVolumeCm3 * density;

  const layerTimeMultiplier =
    layerHeight === "0.12" ? 1.6 : layerHeight === "0.28" ? 0.7 : 1.0;

  const timeToPrintHours = Math.max(0.5, (estimatedWeightG / 18) * layerTimeMultiplier);

  const costPerGram = MATERIAL_COST_PER_GRAM[material] || 0.12;
  const materialCost = estimatedWeightG * costPerGram;
  const machineCost = timeToPrintHours * 12.0;
  const makerProfit = (materialCost + machineCost) * 0.4;
  const makerPayout = materialCost + machineCost + makerProfit;
  const platformFee = makerPayout * 0.25;
  const totalPrice = makerPayout + platformFee + royaltyPrice;

  return {
    success: true,
    filename: input.filename,
    trianglesCount: input.trianglesCount ?? 0,
    boundingBox: input.boundingBox,
    metrics: {
      rawVolumeMm3: Math.round(input.volumeMm3),
      realVolumeCm3: Math.round(realVolumeCm3 * 100) / 100,
      weightG: Math.round(estimatedWeightG * 10) / 10,
      timeHours: Math.round(timeToPrintHours * 10) / 10,
      timeFormatted: formatHours(timeToPrintHours),
    },
    pricing: {
      materialCost: Math.round(materialCost * 100) / 100,
      machineCost: Math.round(machineCost * 100) / 100,
      makerProfit: Math.round(makerProfit * 100) / 100,
      makerPayout: Math.round(makerPayout * 100) / 100,
      platformFee: Math.round(platformFee * 100) / 100,
      royaltyPrice: Math.round(royaltyPrice * 100) / 100,
      totalPrice: Math.round(totalPrice * 100) / 100,
    },
  };
}
