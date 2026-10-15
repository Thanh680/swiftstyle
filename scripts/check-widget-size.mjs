// Budget de performance (§ 10) : le script du widget doit rester sous 10 ko gzippés.
// Vérifié à chaque build, pas une fois au lancement.
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const BUDGET = 10 * 1024;
const file = new URL("../public/v1/widget.js", import.meta.url);
const raw = readFileSync(file);
const gz = gzipSync(raw, { level: 9 }).length;

console.log(`widget.js : ${(raw.length / 1024).toFixed(1)} ko, ${(gz / 1024).toFixed(1)} ko gzip (budget ${BUDGET / 1024} ko)`);
if (gz > BUDGET) {
  console.error("Budget dépassé.");
  process.exit(1);
}
