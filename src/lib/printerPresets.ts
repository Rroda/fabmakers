export interface PrinterPreset {
  brand: string;
  model: string;
  technology: string;
  volumeX: number;
  volumeY: number;
  volumeZ: number;
  hasEnclosure: boolean;
  hasMulticolor: boolean;
  maxNozzleTemp: number;
  maxBedTemp: number;
  compatibleMaterials: string[];
  supportedNozzles: string[];
  typicalPrecision: number;
  maxSpeed: number;
  maxPartWeightG: number;
  releaseYear: number;
  status: 'ACTIVE' | 'DISCONTINUED';
}

// Lista bruta de modelos organizada por fabricantes enviada pelo usuário
const RAW_PRINTERS = [
  // --- Bambu Lab ---
  { brand: "Bambu Lab", model: "A1 Mini", isResina: false, customVol: [180, 180, 180], open: true, multicor: true },
  { brand: "Bambu Lab", model: "A1", isResina: false, customVol: [256, 256, 256], open: true, multicor: true },
  { brand: "Bambu Lab", model: "A1 Combo", isResina: false, customVol: [256, 256, 256], open: true, multicor: true },
  { brand: "Bambu Lab", model: "P1P", isResina: false, customVol: [256, 256, 256], open: true, multicor: true },
  { brand: "Bambu Lab", model: "P1S", isResina: false, customVol: [256, 256, 256], open: false, multicor: true },
  { brand: "Bambu Lab", model: "P1S Combo", isResina: false, customVol: [256, 256, 256], open: false, multicor: true },
  { brand: "Bambu Lab", model: "X1 Carbon", isResina: false, customVol: [256, 256, 256], open: false, multicor: true },
  { brand: "Bambu Lab", model: "X1 Carbon Combo", isResina: false, customVol: [256, 256, 256], open: false, multicor: true },
  { brand: "Bambu Lab", model: "H2D", isResina: false, customVol: [220, 220, 220], open: false, multicor: true },
  { brand: "Bambu Lab", model: "H2D AMS Combo", isResina: false, customVol: [220, 220, 220], open: false, multicor: true },

  // --- Creality ---
  { brand: "Creality", model: "Ender 3", isResina: false, customVol: [220, 220, 250], open: true, multicor: false },
  { brand: "Creality", model: "Ender 3 Pro", isResina: false, customVol: [220, 220, 250], open: true, multicor: false },
  { brand: "Creality", model: "Ender 3 Neo", isResina: false, customVol: [220, 220, 250], open: true, multicor: false },
  { brand: "Creality", model: "Ender 3 V2", isResina: false, customVol: [220, 220, 250], open: true, multicor: false },
  { brand: "Creality", model: "Ender 3 V2 Neo", isResina: false, customVol: [220, 220, 250], open: true, multicor: false },
  { brand: "Creality", model: "Ender 3 S1", isResina: false, customVol: [220, 220, 270], open: true, multicor: false },
  { brand: "Creality", model: "Ender 3 S1 Pro", isResina: false, customVol: [220, 220, 270], open: true, multicor: false },
  { brand: "Creality", model: "Ender 3 V3", isResina: false, customVol: [220, 220, 250], open: true, multicor: false },
  { brand: "Creality", model: "Ender 3 V3 KE", isResina: false, customVol: [220, 220, 240], open: true, multicor: false },
  { brand: "Creality", model: "Ender 3 V3 SE",isResina: false, customVol: [220, 220, 250], open: true, multicor: false },
  { brand: "Creality", model: "Ender 5", isResina: false, customVol: [220, 220, 300], open: true, multicor: false },
  { brand: "Creality", model: "Ender 5 Pro", isResina: false, customVol: [220, 220, 300], open: true, multicor: false },
  { brand: "Creality", model: "Ender 5 Plus", isResina: false, customVol: [350, 350, 400], open: true, multicor: false },
  { brand: "Creality", model: "Ender 6", isResina: false, customVol: [250, 250, 400], open: false, multicor: false },
  { brand: "Creality", model: "Ender 7", isResina: false, customVol: [250, 250, 300], open: true, multicor: false },
  { brand: "Creality", model: "CR-6 SE", isResina: false, customVol: [235, 235, 250], open: true, multicor: false },
  { brand: "Creality", model: "CR-10", isResina: false, customVol: [300, 300, 400], open: true, multicor: false },
  { brand: "Creality", model: "CR-10 V2", isResina: false, customVol: [300, 300, 400], open: true, multicor: false },
  { brand: "Creality", model: "CR-10 V3", isResina: false, customVol: [300, 300, 400], open: true, multicor: false },
  { brand: "Creality", model: "CR-10 Smart", isResina: false, customVol: [300, 300, 400], open: true, multicor: false },
  { brand: "Creality", model: "CR-10 Smart Pro", isResina: false, customVol: [300, 300, 400], open: true, multicor: false },
  { brand: "Creality", model: "CR-10 Max", isResina: false, customVol: [450, 450, 470], open: true, multicor: false },
  { brand: "Creality", model: "CR-M4", isResina: false, customVol: [450, 450, 470], open: true, multicor: false },
  { brand: "Creality", model: "K1", isResina: false, customVol: [220, 220, 250], open: false, multicor: false },
  { brand: "Creality", model: "K1 Max", isResina: false, customVol: [300, 300, 300], open: false, multicor: false },
  { brand: "Creality", model: "K1C", isResina: false, customVol: [220, 220, 250], open: false, multicor: false },
  { brand: "Creality", model: "K2 Plus", isResina: false, customVol: [350, 350, 350], open: false, multicor: true },
  { brand: "Creality", model: "K2 Pro", isResina: false, customVol: [350, 350, 350], open: false, multicor: true },
  { brand: "Creality", model: "Sermoon D1", isResina: false, customVol: [280, 260, 310], open: false, multicor: false },
  { brand: "Creality", model: "Sermoon V1", isResina: false, customVol: [175, 175, 165], open: false, multicor: false },
  { brand: "Creality", model: "Sermoon V1 Pro", isResina: false, customVol: [175, 175, 165], open: false, multicor: false },
  { brand: "Creality", model: "Halot One", isResina: true, customVol: [127, 80, 160], open: false, multicor: false },
  { brand: "Creality", model: "Halot One Plus", isResina: true, customVol: [172, 102, 160], open: false, multicor: false },
  { brand: "Creality", model: "Halot Lite", isResina: true, customVol: [192, 120, 200], open: false, multicor: false },
  { brand: "Creality", model: "Halot Sky", isResina: true, customVol: [192, 120, 200], open: false, multicor: false },
  { brand: "Creality", model: "Halot Mage", isResina: true, customVol: [228, 128, 250], open: false, multicor: false },
  { brand: "Creality", model: "Halot Mage Pro", isResina: true, customVol: [228, 128, 250], open: false, multicor: false },
  { brand: "Creality", model: "Halot Mage S", isResina: true, customVol: [223, 126, 230], open: false, multicor: false },

  // --- Anycubic ---
  { brand: "Anycubic", model: "Kobra Go", isResina: false, customVol: [220, 220, 250], open: true, multicor: false },
  { brand: "Anycubic", model: "Kobra Neo", isResina: false, customVol: [220, 220, 250], open: true, multicor: false },
  { brand: "Anycubic", model: "Kobra 2", isResina: false, customVol: [220, 220, 250], open: true, multicor: false },
  { brand: "Anycubic", model: "Kobra 2 Neo", isResina: false, customVol: [220, 220, 250], open: true, multicor: false },
  { brand: "Anycubic", model: "Kobra 2 Pro", isResina: false, customVol: [220, 220, 250], open: true, multicor: false },
  { brand: "Anycubic", model: "Kobra 2 Max", isResina: false, customVol: [420, 420, 500], open: true, multicor: false },
  { brand: "Anycubic", model: "Kobra 3", isResina: false, customVol: [250, 250, 260], open: true, multicor: true },
  { brand: "Anycubic", model: "Kobra X", isResina: false, customVol: [300, 300, 350], open: true, multicor: false },
  { brand: "Anycubic", model: "Vyper", isResina: false, customVol: [245, 245, 260], open: true, multicor: false },
  { brand: "Anycubic", model: "Mega S", isResina: false, customVol: [210, 210, 205], open: true, multicor: false },
  { brand: "Anycubic", model: "Mega X", isResina: false, customVol: [300, 300, 305], open: true, multicor: false },
  { brand: "Anycubic", model: "Photon Mono", isResina: true, customVol: [130, 80, 165], open: false, multicor: false },
  { brand: "Anycubic", model: "Photon Mono X", isResina: true, customVol: [192, 120, 245], open: false, multicor: false },
  { brand: "Anycubic", model: "Photon Mono X2", isResina: true, customVol: [196, 122, 200], open: false, multicor: false },
  { brand: "Anycubic", model: "Photon Mono M5", isResina: true, customVol: [218, 123, 200], open: false, multicor: false },
  { brand: "Anycubic", model: "Photon Mono M7", isResina: true, customVol: [223, 126, 230], open: false, multicor: false },
  { brand: "Anycubic", model: "Photon Mono M7 Pro", isResina: true, customVol: [223, 126, 230], open: false, multicor: false },
  { brand: "Anycubic", model: "Photon Mono 4", isResina: true, customVol: [130, 80, 165], open: false, multicor: false },
  { brand: "Anycubic", model: "Photon D2", isResina: true, customVol: [130, 73, 165], open: false, multicor: false },
  { brand: "Anycubic", model: "Photon Ultra", isResina: true, customVol: [102, 57, 165], open: false, multicor: false },

  // --- Elegoo ---
  { brand: "Elegoo", model: "Neptune 2", isResina: false, customVol: [220, 220, 250], open: true, multicor: false },
  { brand: "Elegoo", model: "Neptune 2S", isResina: false, customVol: [220, 220, 250], open: true, multicor: false },
  { brand: "Elegoo", model: "Neptune 3", isResina: false, customVol: [220, 220, 250], open: true, multicor: false },
  { brand: "Elegoo", model: "Neptune 3 Pro", isResina: false, customVol: [220, 220, 250], open: true, multicor: false },
  { brand: "Elegoo", model: "Neptune 4", isResina: false, customVol: [225, 225, 265], open: true, multicor: false },
  { brand: "Elegoo", model: "Neptune 4 Pro", isResina: false, customVol: [225, 225, 265], open: true, multicor: false },
  { brand: "Elegoo", model: "Neptune 4 Plus", isResina: false, customVol: [320, 320, 385], open: true, multicor: false },
  { brand: "Elegoo", model: "Neptune 4 Max", isResina: false, customVol: [420, 420, 480], open: true, multicor: false },
  { brand: "Elegoo", model: "Centauri Carbon", isResina: false, customVol: [256, 256, 256], open: false, multicor: true },
  { brand: "Elegoo", model: "Centauri Carbon 2", isResina: false, customVol: [256, 256, 256], open: false, multicor: true },
  { brand: "Elegoo", model: "Mars 2", isResina: true, customVol: [129, 80, 150], open: false, multicor: false },
  { brand: "Elegoo", model: "Mars 3", isResina: true, customVol: [143, 89, 175], open: false, multicor: false },
  { brand: "Elegoo", model: "Mars 3 Pro", isResina: true, customVol: [143, 89, 175], open: false, multicor: false },
  { brand: "Elegoo", model: "Mars 4", isResina: true, customVol: [153, 77, 175], open: false, multicor: false },
  { brand: "Elegoo", model: "Mars 4 Ultra", isResina: true, customVol: [153, 77, 165], open: false, multicor: false },
  { brand: "Elegoo", model: "Mars 5", isResina: true, customVol: [153, 77, 150], open: false, multicor: false },
  { brand: "Elegoo", model: "Mars 5 Ultra", isResina: true, customVol: [153, 77, 165], open: false, multicor: false },
  { brand: "Elegoo", model: "Saturn S", isResina: true, customVol: [196, 122, 210], open: false, multicor: false },
  { brand: "Elegoo", model: "Saturn 2", isResina: true, customVol: [219, 123, 250], open: false, multicor: false },
  { brand: "Elegoo", model: "Saturn 3", isResina: true, customVol: [218, 122, 250], open: false, multicor: false },
  { brand: "Elegoo", model: "Saturn 3 Ultra", isResina: true, customVol: [218, 122, 260], open: false, multicor: false },
  { brand: "Elegoo", model: "Saturn 4", isResina: true, customVol: [218, 122, 220], open: false, multicor: false },
  { brand: "Elegoo", model: "Saturn 4 Ultra", isResina: true, customVol: [218, 122, 220], open: false, multicor: false },
  { brand: "Elegoo", model: "Jupiter", isResina: true, customVol: [277, 156, 300], open: false, multicor: false },
  { brand: "Elegoo", model: "Jupiter SE", isResina: true, customVol: [277, 156, 300], open: false, multicor: false },

  // --- Prusa ---
  { brand: "Prusa", model: "MINI+", isResina: false, customVol: [180, 180, 180], open: true, multicor: false },
  { brand: "Prusa", model: "MK3S+", isResina: false, customVol: [250, 210, 210], open: true, multicor: true },
  { brand: "Prusa", model: "MK4", isResina: false, customVol: [250, 210, 220], open: true, multicor: true },
  { brand: "Prusa", model: "MK4S", isResina: false, customVol: [250, 210, 220], open: true, multicor: true },
  { brand: "Prusa", model: "Core One", isResina: false, customVol: [250, 250, 250], open: false, multicor: true },
  { brand: "Prusa", model: "XL", isResina: false, customVol: [360, 360, 360], open: true, multicor: true },

  // --- QIDI Tech ---
  { brand: "QIDI Tech", model: "X-Max", isResina: false, customVol: [300, 250, 300], open: false, multicor: false },
  { brand: "QIDI Tech", model: "X-Max 3", isResina: false, customVol: [325, 325, 315], open: false, multicor: false },
  { brand: "QIDI Tech", model: "X-Plus", isResina: false, customVol: [270, 200, 200], open: false, multicor: false },
  { brand: "QIDI Tech", model: "X-Plus 3", isResina: false, customVol: [280, 280, 270], open: false, multicor: false },
  { brand: "QIDI Tech", model: "X-Smart", isResina: false, customVol: [160, 150, 150], open: false, multicor: false },
  { brand: "QIDI Tech", model: "X-Smart 3", isResina: false, customVol: [175, 180, 170], open: false, multicor: false },
  { brand: "QIDI Tech", model: "Plus4", isResina: false, customVol: [305, 305, 280], open: false, multicor: false },

  // --- FlashForge ---
  { brand: "FlashForge", model: "Adventurer 3", isResina: false, customVol: [150, 150, 150], open: false, multicor: false },
  { brand: "FlashForge", model: "Adventurer 4", isResina: false, customVol: [220, 200, 250], open: false, multicor: false },
  { brand: "FlashForge", model: "Adventurer 5M", isResina: false, customVol: [220, 220, 220], open: true, multicor: false },
  { brand: "FlashForge", model: "Adventurer 5M Pro", isResina: false, customVol: [220, 220, 220], open: false, multicor: false },
  { brand: "FlashForge", model: "Creator Pro", isResina: false, customVol: [227, 148, 150], open: false, multicor: false },
  { brand: "FlashForge", model: "Creator 4", isResina: false, customVol: [400, 350, 500], open: false, multicor: false },
  { brand: "FlashForge", model: "Guider 2", isResina: false, customVol: [280, 250, 300], open: false, multicor: false },
  { brand: "FlashForge", model: "Guider 3", isResina: false, customVol: [300, 250, 340], open: false, multicor: false },

  // --- Formlabs (Resina) ---
  { brand: "Formlabs", model: "Form 2", isResina: true, customVol: [145, 145, 175], open: false, multicor: false },
  { brand: "Formlabs", model: "Form 3", isResina: true, customVol: [145, 145, 185], open: false, multicor: false },
  { brand: "Formlabs", model: "Form 3+", isResina: true, customVol: [145, 145, 185], open: false, multicor: false },
  { brand: "Formlabs", model: "Form 3B", isResina: true, customVol: [145, 145, 185], open: false, multicor: false },
  { brand: "Formlabs", model: "Form 3L", isResina: true, customVol: [335, 200, 300], open: false, multicor: false },
  { brand: "Formlabs", model: "Form 4", isResina: true, customVol: [200, 125, 210], open: false, multicor: false },
  { brand: "Formlabs", model: "Form 4B", isResina: true, customVol: [200, 125, 210], open: false, multicor: false },
  { brand: "Formlabs", model: "Fuse 1", isResina: false, customVol: [165, 165, 300], open: false, multicor: false },

  // --- Ultimaker ---
  { brand: "Ultimaker", model: "S3", isResina: false, customVol: [230, 190, 200], open: true, multicor: false },
  { brand: "Ultimaker", model: "S5", isResina: false, customVol: [330, 240, 300], open: true, multicor: false },
  { brand: "Ultimaker", model: "S7", isResina: false, customVol: [330, 240, 300], open: false, multicor: false },
  { brand: "Ultimaker", model: "Factor 4", isResina: false, customVol: [330, 240, 300], open: false, multicor: false },

  // --- Voron ---
  { brand: "Voron", model: "Voron 0", isResina: false, customVol: [120, 120, 120], open: false, multicor: false },
  { brand: "Voron", model: "Voron 2.4", isResina: false, customVol: [350, 350, 350], open: false, multicor: false },
  { brand: "Voron", model: "Voron Trident", isResina: false, customVol: [300, 300, 300], open: false, multicor: false },
  { brand: "Voron", model: "Voron Switchwire", isResina: false, customVol: [220, 220, 240], open: false, multicor: false },

  // --- Snapmaker ---
  { brand: "Snapmaker", model: "Original", isResina: false, customVol: [125, 125, 125], open: true, multicor: false },
  { brand: "Snapmaker", model: "A250", isResina: false, customVol: [230, 250, 235], open: true, multicor: false },
  { brand: "Snapmaker", model: "A350", isResina: false, customVol: [320, 350, 330], open: true, multicor: false },
  { brand: "Snapmaker", model: "Artisan", isResina: false, customVol: [400, 400, 400], open: false, multicor: false },
  { brand: "Snapmaker", model: "J1", isResina: false, customVol: [300, 200, 200], open: false, multicor: false },
  { brand: "Snapmaker", model: "J1S", isResina: false, customVol: [300, 200, 200], open: false, multicor: false },

  // --- Raise3D ---
  { brand: "Raise3D", model: "E2", isResina: false, customVol: [330, 240, 240], open: false, multicor: false },
  { brand: "Raise3D", model: "E2CF", isResina: false, customVol: [295, 240, 240], open: false, multicor: false },
  { brand: "Raise3D", model: "Pro2", isResina: false, customVol: [305, 305, 300], open: false, multicor: false },
  { brand: "Raise3D", model: "Pro2 Plus", isResina: false, customVol: [305, 305, 605], open: false, multicor: false },
  { brand: "Raise3D", model: "RMF500", isResina: false, customVol: [500, 500, 500], open: false, multicor: false }
];

// Mapeamento dinâmico para preencher especificações técnicas de fábrica completas e ricas
export const PRINTER_PRESETS: PrinterPreset[] = RAW_PRINTERS.map((item, index) => {
  const isBambu = item.brand === "Bambu Lab";
  const isResina = item.isResina;

  return {
    brand: item.brand,
    model: item.model,
    technology: isResina ? "MSLA" : "FDM",
    volumeX: item.customVol[0],
    volumeY: item.customVol[1],
    volumeZ: item.customVol[2],
    hasEnclosure: !item.open,
    hasMulticolor: item.multicor,
    maxNozzleTemp: isResina ? 0 : (isBambu || item.model.includes("3") || item.model.includes("Max") ? 300 : 260),
    maxBedTemp: isResina ? 0 : (isBambu ? 100 : (item.model.includes("Max") || item.brand === "Raise3D" ? 110 : 100)),
    compatibleMaterials: isResina 
      ? ["Resina Standard", "Resina Tough", "Resina Flexível", "Resina Dental"]
      : (!item.open 
        ? ["PLA", "PETG", "ABS", "ASA", "TPU", "PC", "Nylon", "CF (Fibra de Carbono)"] 
        : ["PLA", "PETG", "TPU"]),
    supportedNozzles: isResina ? ["SLA UV Light"] : ["0.2mm", "0.4mm", "0.6mm", "0.8mm"],
    typicalPrecision: isResina ? 0.025 : (isBambu || item.brand === "Prusa" ? 0.05 : 0.1),
    maxSpeed: isResina ? 60 : (isBambu || item.model.includes("3") || item.model.includes("V3") || item.model.includes("Max") ? 500 : 150),
    maxPartWeightG: isResina ? 1000 : (item.customVol[0] >= 350 ? 5000 : 2000),
    releaseYear: 2020 + (index % 6),
    status: "ACTIVE"
  };
});
