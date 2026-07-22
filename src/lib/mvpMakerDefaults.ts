/** Frota/estoque demo do maker MVP (roda@) — Supply-first. */

export const MVP_DEMO_MACHINES = [
  {
    id: "mvp-p1s",
    brand: "Bambu Lab",
    model: "P1S",
    nozzle: "0.4mm",
    volume: "256x256x256mm",
    technology: "FDM",
    hasEnclosure: true,
    hasMulticolor: true,
    maxNozzleTemp: 300,
    maxBedTemp: 100,
    compatibleMaterials: ["PLA", "PETG", "ABS", "ASA", "TPU"],
    supportedNozzles: ["0.2mm", "0.4mm", "0.6mm"],
    typicalPrecision: 0.05,
    maxSpeed: 500,
    maxPartWeightG: 2000,
    releaseYear: 2023,
    status: "ACTIVE",
  },
];

export const MVP_DEMO_FILAMENTS = [
  { id: "mvp-pla-bk", type: "PLA", color: "Preto", weightG: 800 },
  { id: "mvp-petg-gy", type: "PETG", color: "Cinza", weightG: 600 },
];

export const MVP_DEMO_AVAILABILITY = {
  days: ["seg", "ter", "qua", "qui", "sex"],
  shifts: ["tarde", "noite"],
};
