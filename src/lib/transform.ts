// Flujo de transformación de datos del Diagnóstico CAI (portado del script Python).
// Todo corre en el navegador con SheetJS (xlsx). Las cédulas no salen del equipo.
import * as XLSX from "xlsx";

// ----------------------------------------------------------------- tipos
export type Matrix = { header: string[]; rows: unknown[][] };
export type SheetOut = { name: string; header: string[]; rows: unknown[][] };
export type OutputFile = { filename: string; sheets: SheetOut[] };

export type Resultado = {
  archivos: OutputFile[];
  resumen: {
    filas: number;
    personas: number;
    duplicadosEliminados: number;
    filasLargo: number;
    docPob: number;
    docPart: number;
    estPob: number;
    estPart: number;
    admPob: number;
    admPart: number;
  };
};

// ----------------------------------------------------------------- constantes
const SEDES_CANON: Record<string, string> = {
  FUSAGASUGA: "Fusagasugá", "FUSAGASUGÁ": "Fusagasugá",
  FACATATIVA: "Facatativá", "FACATATIVÁ": "Facatativá",
  CHIA: "Chía", "CHÍA": "Chía",
  SOACHA: "Soacha", GIRARDOT: "Girardot",
  UBATE: "Ubaté", "UBATÉ": "Ubaté",
  ZIPAQUIRA: "Zipaquirá", "ZIPAQUIRÁ": "Zipaquirá",
  BOGOTA: "Bogotá", "BOGOTÁ": "Bogotá",
};
const ORDEN_SEDES = ["Fusagasugá", "Facatativá", "Chía", "Soacha", "Girardot", "Ubaté", "Zipaquirá", "Bogotá"];

const PREGUNTAS_CLAVE = [
  "debe definir principalmente",
  "debe construirse y desarrollarse",
  "decisiones estrat",
  "transmoderna y translocal",
];

// ----------------------------------------------------------------- utilidades
export function readWorkbook(buf: ArrayBuffer): XLSX.WorkBook {
  return XLSX.read(buf, { type: "array", cellDates: true });
}

export function sheetToMatrix(wb: XLSX.WorkBook, sheetName?: string): Matrix {
  const name = sheetName ?? wb.SheetNames[0];
  const ws = wb.Sheets[name];
  if (!ws) throw new Error(`No se encontró la hoja "${name}".`);
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true });
  const header = (aoa[0] ?? []).map((h) => (h == null ? "" : String(h)));
  const rows = aoa.slice(1);
  return { header, rows };
}

function findSheet(wb: XLSX.WorkBook, includes: string): string | undefined {
  const up = includes.toUpperCase();
  return wb.SheetNames.find((s) => s.toUpperCase().includes(up));
}

function cell(row: unknown[], i: number): unknown {
  return i >= 0 && i < row.length ? row[i] : null;
}

function colIndex(header: string[], keyword: string): number {
  const k = keyword.toLowerCase();
  return header.findIndex((h) => h.toLowerCase().includes(k));
}
function colIndexes(header: string[], keyword: string): number[] {
  const k = keyword.toLowerCase();
  const out: number[] = [];
  header.forEach((h, i) => { if (h.toLowerCase().includes(k)) out.push(i); });
  return out;
}

function normCed(v: unknown): string {
  if (v == null) return "";
  let s = String(v).trim();
  if (s.endsWith(".0")) s = s.slice(0, -2);
  return s.replace(/\D/g, "");
}

function txt(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

function primeraNoNula(row: unknown[], idxs: number[]): string | null {
  for (const i of idxs) {
    const v = cell(row, i);
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return null;
}

function canonSede(valor: string | null): string | null {
  if (valor == null) return null;
  const up = valor.trim().toUpperCase();
  return SEDES_CANON[up] ?? valor.trim();
}

function sedeDesdeTexto(t: unknown): string | null {
  if (t == null) return null;
  const up = String(t).toUpperCase();
  for (const key of Object.keys(SEDES_CANON)) {
    if (up.includes(key)) return SEDES_CANON[key];
  }
  return null;
}

function normPrograma(s: unknown): string {
  if (s == null) return "";
  return String(s)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function meta80(pob: number): number {
  return Math.ceil(pob * 0.8);
}

// ----------------------------------------------------------------- transform
export function transformAll(respWb: XLSX.WorkBook, adminWb: XLSX.WorkBook, matrWb: XLSX.WorkBook): Resultado {
  const resp = sheetToMatrix(respWb);
  const H = resp.header;

  const cedIdx = colIndex(H, "identificaci") >= 0 ? colIndex(H, "identificaci") : 7;

  // --- dedup por cédula (primera respuesta) + ID ---
  const seen = new Set<string>();
  const keptRows: unknown[][] = [];
  const keptKeys: string[] = [];
  for (const row of resp.rows) {
    if (row.every((c) => c == null)) continue; // saltar filas totalmente vacías
    const key = normCed(cell(row, cedIdx));
    if (seen.has(key)) continue;
    seen.add(key);
    keptRows.push(row);
    keptKeys.push(key);
  }
  const claves = new Set(keptKeys.filter((k) => k !== ""));
  const personas = keptRows.length;

  // ---------- (1) Respuestas únicas con ID ----------
  const wideHeader = ["ID", ...H.map((h) => (h === "ID" ? "ID_Formulario" : h))];
  const wideRows = keptRows.map((row, i) => [i + 1, ...H.map((_, c) => cell(row, c))]);
  const archivoWide: OutputFile = {
    filename: "1. Respuestas unicas con ID.xlsx",
    sheets: [{ name: "Respuestas", header: wideHeader, rows: wideRows }],
  };

  // ---------- (2)/(4) Formato largo ----------
  const pregCols: number[] = [];
  for (const clv of PREGUNTAS_CLAVE) {
    const c = colIndex(H, clv);
    if (c >= 0 && !pregCols.includes(c)) pregCols.push(c);
  }
  const largoRows: unknown[][] = [];
  keptRows.forEach((row, i) => {
    const id = i + 1;
    for (const c of pregCols) {
      const v = cell(row, c);
      if (v == null) continue;
      const etiqueta = H[c].trim();
      for (const op of String(v).split(";")) {
        const o = op.trim();
        if (o) largoRows.push([id, etiqueta, o]);
      }
    }
  });
  const largoSheet: SheetOut = { name: "Respuestas Normalizadas", header: ["ID", "Pregunta", "Respuesta"], rows: largoRows };
  const archivoLargo: OutputFile = { filename: "2. Respuestas formato largo (ID-Pregunta-Respuesta).xlsx", sheets: [largoSheet] };
  const archivoNormalizado: OutputFile = { filename: "Diagnostico_CAI_Respondieron_Normalizado.xlsx", sheets: [largoSheet] };

  // ---------- (3) NORMALIZADA ----------
  const sedeCols = colIndexes(H, "sede de la universidad");
  const progCols = colIndexes(H, "programa al que pertenece");
  const areaCol = colIndex(H, "rea a que pertenece");
  const tipoCol = colIndex(H, "tipo de participante");
  const progAreaCols = areaCol >= 0 ? [...progCols, areaCol] : progCols;
  const normRows = keptRows.map((row, i) => [
    i + 1,
    canonSede(primeraNoNula(row, sedeCols)),
    tipoCol >= 0 ? txt(cell(row, tipoCol)) : null,
    primeraNoNula(row, progAreaCols),
  ]);
  const archivoNormalizada: OutputFile = {
    filename: "Diagnostico_CAI_Respondieron_NORMALIZADA.xlsx",
    sheets: [{ name: "Hoja1", header: ["ID", "Unidad Regional", "Tipo de Participante", "Programa o Área"], rows: normRows }],
  };

  // ---------- (5) Población vs Participación ----------
  const a1 = sheetToMatrix(adminWb, findSheet(adminWb, "ADM") ?? adminWb.SheetNames[0]);
  const a2 = sheetToMatrix(adminWb, findSheet(adminWb, "OPS") ?? adminWb.SheetNames[1]);
  const a1Cargo = colIndex(a1.header, "cargo");
  const a1Sede = colIndex(a1.header, "sede");
  const a2Tipo = colIndex(a2.header, "tipo contrato");
  const a2Sede = colIndex(a2.header, "sede");

  type Persona = { ced: string; sede: string };
  const docentes: Persona[] = [];
  const admins: Persona[] = [];
  for (const row of a1.rows) {
    const ced = normCed(cell(row, 1));
    if (!ced) continue;
    const sede = sedeDesdeTexto(cell(row, a1Sede)) ?? "Fusagasugá";
    const esDoc = txt(cell(row, a1Cargo)).toUpperCase().includes("DOCENTE");
    (esDoc ? docentes : admins).push({ ced, sede });
  }
  for (const row of a2.rows) {
    const ced = normCed(cell(row, 1));
    if (!ced) continue;
    const sede = sedeDesdeTexto(cell(row, a2Sede)) ?? "Fusagasugá";
    const esDoc = txt(cell(row, a2Tipo)).toUpperCase().includes("ACADEMICO");
    (esDoc ? docentes : admins).push({ ced, sede });
  }
  // dedup por cédula; docente tiene prioridad
  const docMap = new Map<string, Persona>();
  for (const p of docentes) if (!docMap.has(p.ced)) docMap.set(p.ced, p);
  const admMap = new Map<string, Persona>();
  for (const p of admins) if (!docMap.has(p.ced) && !admMap.has(p.ced)) admMap.set(p.ced, p);
  const docArr = [...docMap.values()];
  const admArr = [...admMap.values()];

  // matriculados
  const matr = sheetToMatrix(matrWb);
  const mMunIdx = colIndex(matr.header, "municipio");
  const mProgIdx = colIndex(matr.header, "programa");
  const matMap = new Map<string, { ced: string; sede: string; prog: string }>();
  for (const row of matr.rows) {
    const ced = normCed(cell(row, 3));
    if (!ced || matMap.has(ced)) continue;
    const muni = cell(row, mMunIdx);
    const sede = sedeDesdeTexto(muni) ?? txt(muni);
    matMap.set(ced, { ced, sede, prog: normPrograma(cell(row, mProgIdx)) });
  }
  const matArr = [...matMap.values()];

  // helpers de agregación
  type Fila = [string, number, number, number];
  function tabla(items: { ced: string }[], grupoDe: (x: never) => string, etiqueta: string): SheetOut {
    const grupos = new Map<string, { pob: number; part: number }>();
    for (const it of items) {
      const g = grupoDe(it as never);
      const acc = grupos.get(g) ?? { pob: 0, part: 0 };
      acc.pob += 1;
      if (claves.has(it.ced)) acc.part += 1;
      grupos.set(g, acc);
    }
    const filas: Fila[] = [...grupos.entries()].map(([g, v]) => [g, v.pob, meta80(v.pob), v.part]);
    return { name: etiqueta, header: [etiqueta, "POBLACION", "META (80%)", "PARTICIPARON"], rows: filas };
  }
  function ordenarSede(s: SheetOut): SheetOut {
    s.rows.sort((a, b) => {
      const ia = ORDEN_SEDES.indexOf(String(a[0])); const ib = ORDEN_SEDES.indexOf(String(b[0]));
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    return s;
  }
  const total = (items: { ced: string }[]): Fila => {
    const pob = items.length;
    const part = items.filter((x) => claves.has(x.ced)).length;
    return ["TOTAL", pob, meta80(pob), part];
  };

  const tDoc = ordenarSede(tabla(docArr, (x: { sede: string }) => x.sede, "UNIDAD REGIONAL"));
  const tDocUni: SheetOut = { name: "Docentes_universo", header: ["UNIDAD REGIONAL", "POBLACION", "META (80%)", "PARTICIPARON"], rows: [total(docArr)] };
  const tEstUr = ordenarSede(tabla(matArr, (x: { sede: string }) => x.sede, "UNIDAD REGIONAL"));
  const tEstProg = tabla(matArr, (x: { prog: string }) => x.prog, "PROGRAMA");
  tEstProg.rows.sort((a, b) => (b[1] as number) - (a[1] as number));
  const tAdm: SheetOut = { name: "Administrativos", header: ["UNIDAD REGIONAL", "POBLACION", "META (80%)", "PARTICIPARON"], rows: [total(admArr)] };

  const archivoPoblacion: OutputFile = {
    filename: "Reporte CAI - Poblacion vs Participacion.xlsx",
    sheets: [
      { ...tDocUni, name: "Docentes_universo" },
      { ...tDoc, name: "Docentes" },
      { ...tEstUr, name: "Estudiantes unidad regional " },
      { ...tEstProg, name: "Estudiantes programa" },
      { ...tAdm, name: "Administrativos" },
    ],
  };

  const docPart = docArr.filter((x) => claves.has(x.ced)).length;
  const admPart = admArr.filter((x) => claves.has(x.ced)).length;
  const estPart = matArr.filter((x) => claves.has(x.ced)).length;

  return {
    archivos: [archivoWide, archivoLargo, archivoNormalizada, archivoNormalizado, archivoPoblacion],
    resumen: {
      filas: resp.rows.filter((r) => !r.every((c) => c == null)).length,
      personas,
      duplicadosEliminados: resp.rows.filter((r) => !r.every((c) => c == null)).length - personas,
      filasLargo: largoRows.length,
      docPob: docArr.length, docPart,
      estPob: matArr.length, estPart,
      admPob: admArr.length, admPart,
    },
  };
}

// ----------------------------------------------------------------- descarga
export function descargar(archivo: OutputFile): void {
  const wb = XLSX.utils.book_new();
  for (const s of archivo.sheets) {
    const ws = XLSX.utils.aoa_to_sheet([s.header, ...s.rows], { cellDates: true, dateNF: "yyyy-mm-dd hh:mm:ss" });
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  XLSX.writeFile(wb, archivo.filename);
}
