/**
 * Roda todos os E2E FabMakers em sequência.
 * Uso: node scripts/e2e-all.mjs [BASE_URL]
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.argv[2] || process.env.BASE_URL || "https://fabmakers.com.br";

const scripts = [
  "e2e-catalog-job.mjs",
  "e2e-designer-job.mjs",
  "e2e-channel-job.mjs",
  "e2e-tech-job.mjs",
  "e2e-h5-funnel.mjs",
];

console.log(`E2E ALL @ ${BASE}\n`);

let failed = 0;
for (const name of scripts) {
  const file = path.join(__dirname, name);
  console.log(`—— ${name} ——`);
  const r = spawnSync(process.execPath, [file, BASE], {
    encoding: "utf8",
    stdio: "inherit",
  });
  if (r.status !== 0) {
    failed += 1;
    console.error(`FAIL ${name} (exit ${r.status})\n`);
  } else {
    console.log(`OK ${name}\n`);
  }
}

if (failed) {
  console.error(`E2E ALL: ${failed}/${scripts.length} falharam`);
  process.exit(1);
}
console.log(`PASS — E2E ALL (${scripts.length}/${scripts.length})`);
