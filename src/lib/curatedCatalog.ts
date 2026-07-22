/**
 * Catálogo curado FabMakers (D006) — seed de demanda.
 * Sem scrape de MakerWorld. Assets de referência (Unsplash) + geometria demo.
 */

export type CuratedModel = {
  id: string;
  title: string;
  description: string;
  /** Preview image URL */
  image: string;
  filename: string;
  /** Path público do STL demo (D016) */
  stlUrl: string;
  category: string;
  /** Volume sólido estimado mm³ (para cotação) */
  volumeMm3: number;
  boundingBox: { width: number; depth: number; height: number };
  trianglesCount: number;
  defaultMaterial: "PLA" | "PETG" | "ABS";
  licenseNote: string;
};

export const CURATED_CATALOG: CuratedModel[] = [
  {
    id: "fm-hook-wall",
    title: "Gancho de parede reforçado",
    description: "Gancho utilitário para carga leve — ideal para PLA/PETG.",
    image: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&auto=format&fit=crop&q=60",
    filename: "gancho_parede_fm.stl",
    stlUrl: "/catalog/gancho_parede_fm.stl",
    category: "Utilidade",
    volumeMm3: 28000,
    boundingBox: { width: 80, depth: 40, height: 60 },
    trianglesCount: 12400,
    defaultMaterial: "PETG",
    licenseNote: "Demo FabMakers — uso na plataforma",
  },
  {
    id: "fm-phone-stand",
    title: "Suporte de celular minimalista",
    description: "Apoio de mesa estável; cotação rápida em PLA.",
    image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&auto=format&fit=crop&q=60",
    filename: "suporte_celular_fm.stl",
    stlUrl: "/catalog/suporte_celular_fm.stl",
    category: "Utilidade",
    volumeMm3: 42000,
    boundingBox: { width: 90, depth: 70, height: 85 },
    trianglesCount: 18200,
    defaultMaterial: "PLA",
    licenseNote: "Demo FabMakers — uso na plataforma",
  },
  {
    id: "fm-cable-clip",
    title: "Presilha organizadora de cabos",
    description: "Peça pequena, barata, ótima para testar a fila.",
    image: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&auto=format&fit=crop&q=60",
    filename: "presilha_cabos_fm.stl",
    stlUrl: "/catalog/presilha_cabos_fm.stl",
    category: "Utilidade",
    volumeMm3: 4500,
    boundingBox: { width: 25, depth: 15, height: 20 },
    trianglesCount: 3200,
    defaultMaterial: "PLA",
    licenseNote: "Demo FabMakers — uso na plataforma",
  },
  {
    id: "fm-drawer-org",
    title: "Organizador modular de gaveta",
    description: "Módulo empilhável — volume médio.",
    image: "https://images.unsplash.com/photo-1600080972464-8e5f35f63d08?w=600&auto=format&fit=crop&q=60",
    filename: "organizador_gaveta_fm.stl",
    stlUrl: "/catalog/organizador_gaveta_fm.stl",
    category: "Casa",
    volumeMm3: 95000,
    boundingBox: { width: 120, depth: 80, height: 45 },
    trianglesCount: 22100,
    defaultMaterial: "PLA",
    licenseNote: "Demo FabMakers — uso na plataforma",
  },
  {
    id: "fm-gear-spare",
    title: "Engrenagem de reposição",
    description: "Peça mecânica de exemplo — PETG recomendado.",
    image: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&auto=format&fit=crop&q=60",
    filename: "engrenagem_reposicao_fm.stl",
    stlUrl: "/catalog/engrenagem_reposicao_fm.stl",
    category: "Mecânica",
    volumeMm3: 18000,
    boundingBox: { width: 50, depth: 50, height: 12 },
    trianglesCount: 15600,
    defaultMaterial: "PETG",
    licenseNote: "Demo FabMakers — uso na plataforma",
  },
  {
    id: "fm-planter",
    title: "Vaso geometrico pequeno",
    description: "Decorativo; bom para mostrar cotação com infill baixo.",
    image: "https://images.unsplash.com/photo-1578500494198-246f612d3b3d?w=600&auto=format&fit=crop&q=60",
    filename: "vaso_geometrico_fm.stl",
    stlUrl: "/catalog/vaso_geometrico_fm.stl",
    category: "Decoração",
    volumeMm3: 110000,
    boundingBox: { width: 100, depth: 100, height: 120 },
    trianglesCount: 28400,
    defaultMaterial: "PLA",
    licenseNote: "Demo FabMakers — uso na plataforma",
  },
  {
    id: "fm-bike-hook",
    title: "Gancho de bicicleta",
    description: "Carga maior — ABS/PETG na cotação.",
    image: "https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=600&auto=format&fit=crop&q=60",
    filename: "gancho_bike_fm.stl",
    stlUrl: "/catalog/gancho_bike_fm.stl",
    category: "Utilidade",
    volumeMm3: 160000,
    boundingBox: { width: 140, depth: 60, height: 100 },
    trianglesCount: 31200,
    defaultMaterial: "ABS",
    licenseNote: "Demo FabMakers — uso na plataforma",
  },
  {
    id: "fm-pi-case",
    title: "Case Raspberry Pi (demo)",
    description: "Caixa eletrônica de referência — furos e volume médio.",
    image: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=60",
    filename: "case_pi_fm.stl",
    stlUrl: "/catalog/case_pi_fm.stl",
    category: "Eletrônica",
    volumeMm3: 52000,
    boundingBox: { width: 95, depth: 65, height: 35 },
    trianglesCount: 19800,
    defaultMaterial: "PLA",
    licenseNote: "Demo FabMakers — uso na plataforma",
  },
];

export function getCuratedModel(id: string): CuratedModel | undefined {
  return CURATED_CATALOG.find((m) => m.id === id);
}

export function getCuratedStlUrl(catalogId: string | null | undefined): string | null {
  if (!catalogId) return null;
  return getCuratedModel(catalogId)?.stlUrl ?? null;
}
