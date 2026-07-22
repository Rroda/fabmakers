/**
 * Gera STLs ASCII mínimos (caixa) para o catálogo curado — D016.
 * node scripts/gen-catalog-stls.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "public", "catalog");

const models = [
  { file: "gancho_parede_fm.stl", w: 80, d: 40, h: 60 },
  { file: "suporte_celular_fm.stl", w: 90, d: 70, h: 85 },
  { file: "presilha_cabos_fm.stl", w: 25, d: 15, h: 20 },
  { file: "organizador_gaveta_fm.stl", w: 120, d: 80, h: 45 },
  { file: "engrenagem_reposicao_fm.stl", w: 50, d: 50, h: 20 },
  { file: "vaso_geometrico_fm.stl", w: 100, d: 100, h: 120 },
  { file: "gancho_bike_fm.stl", w: 140, d: 60, h: 100 },
  { file: "case_pi_fm.stl", w: 95, d: 65, h: 35 },
];

/** Caixa axis-aligned em mm — 12 triângulos (demo FabMakers). */
function boxAsciiStl(name, w, d, h) {
  const x0 = 0,
    y0 = 0,
    z0 = 0;
  const x1 = w,
    y1 = d,
    z1 = h;
  const faces = [
    // bottom z0
    [
      [x0, y0, z0],
      [x1, y0, z0],
      [x1, y1, z0],
    ],
    [
      [x0, y0, z0],
      [x1, y1, z0],
      [x0, y1, z0],
    ],
    // top z1
    [
      [x0, y0, z1],
      [x1, y1, z1],
      [x1, y0, z1],
    ],
    [
      [x0, y0, z1],
      [x0, y1, z1],
      [x1, y1, z1],
    ],
    // front y0
    [
      [x0, y0, z0],
      [x1, y0, z1],
      [x1, y0, z0],
    ],
    [
      [x0, y0, z0],
      [x0, y0, z1],
      [x1, y0, z1],
    ],
    // back y1
    [
      [x0, y1, z0],
      [x1, y1, z0],
      [x1, y1, z1],
    ],
    [
      [x0, y1, z0],
      [x1, y1, z1],
      [x0, y1, z1],
    ],
    // left x0
    [
      [x0, y0, z0],
      [x0, y1, z0],
      [x0, y1, z1],
    ],
    [
      [x0, y0, z0],
      [x0, y1, z1],
      [x0, y0, z1],
    ],
    // right x1
    [
      [x1, y0, z0],
      [x1, y0, z1],
      [x1, y1, z1],
    ],
    [
      [x1, y0, z0],
      [x1, y1, z1],
      [x1, y1, z0],
    ],
  ];

  const lines = [`solid ${name}`];
  for (const tri of faces) {
    lines.push("  facet normal 0 0 0");
    lines.push("    outer loop");
    for (const [x, y, z] of tri) {
      lines.push(`      vertex ${x.toFixed(3)} ${y.toFixed(3)} ${z.toFixed(3)}`);
    }
    lines.push("    endloop");
    lines.push("  endfacet");
  }
  lines.push(`endsolid ${name}`);
  return lines.join("\n") + "\n";
}

fs.mkdirSync(outDir, { recursive: true });
for (const m of models) {
  const body = boxAsciiStl(m.file.replace(/\.stl$/i, ""), m.w, m.d, m.h);
  const dest = path.join(outDir, m.file);
  fs.writeFileSync(dest, body, "utf8");
  console.log("wrote", dest, `(${body.length} bytes)`);
}
console.log("OK — public/catalog/*.stl");
