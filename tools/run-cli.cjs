// Runner headless: usa EXACTAMENTE la lógica de src/lib/transform.ts (compilada a tools/_build)
// para generar los 5 formatos desde los archivos reales, sin abrir el navegador.
//
//   1) npx tsc src/lib/transform.ts --rootDir src/lib --outDir tools/_build \
//          --module commonjs --target es2019 --esModuleInterop --skipLibCheck --moduleResolution node
//   2) node tools/run-cli.cjs
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const { transformAll } = require("./_build/transform.js");

// Carpeta con los datos (un nivel arriba del repo). Ajustable por argumento.
const DATA = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(__dirname, "..", "..", "Encuesta_tu_voz_fundamental");
const OUT = path.join(DATA, "salidas_pipeline");
fs.mkdirSync(OUT, { recursive: true });

const F_RESP  = "Diagnostico CAI Planeacion Estrategica 2027-2037 16062026 1200.xlsx";
const F_ADMIN = path.join("bd", "REPORTE ADMIN - DOCENTES - OPS - APA CON CARGO VIGENTE 2026-05-27.xlsx");
const F_MATR  = path.join("bd", "Reporte_general__Matriculados_2026-1-1.xlsx");

function load(rel) {
  const p = path.join(DATA, rel);
  if (!fs.existsSync(p)) throw new Error("No existe: " + p);
  return XLSX.read(fs.readFileSync(p), { type: "buffer", cellDates: true });
}

const resp  = load(F_RESP);
const admin = load(F_ADMIN);
const matr  = load(F_MATR);

const r = transformAll(resp, admin, matr);

for (const a of r.archivos) {
  const wb = XLSX.utils.book_new();
  for (const s of a.sheets) {
    const ws = XLSX.utils.aoa_to_sheet([s.header, ...s.rows], { cellDates: true, dateNF: "yyyy-mm-dd hh:mm:ss" });
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  XLSX.writeFile(wb, path.join(OUT, a.filename));
  console.log("  ✓", a.filename);
}

console.log("\nRESUMEN:");
console.log(JSON.stringify(r.resumen, null, 2));
console.log("\nSalidas en:", OUT);
