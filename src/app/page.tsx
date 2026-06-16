"use client";

import { useState } from "react";
import {
  readWorkbook,
  transformAll,
  descargar,
  type Resultado,
  type OutputFile,
} from "@/lib/transform";
import type * as XLSX from "xlsx";

type SlotKey = "resp" | "admin" | "matr";

type SlotDef = {
  key: SlotKey;
  nombre: string;
  desc: string;
  pista: string; // texto que suele contener el nombre del archivo
};

const SLOTS: SlotDef[] = [
  {
    key: "resp",
    nombre: "Respuestas del formulario",
    desc: "Diagnóstico CAI – Planeación Estratégica (la última actualización).",
    pista: "diagnostico",
  },
  {
    key: "admin",
    nombre: "Reporte de personal",
    desc: "REPORTE ADMIN – docentes / administrativos / OPS / APA con cargo vigente.",
    pista: "reporte admin",
  },
  {
    key: "matr",
    nombre: "Reporte de matriculados",
    desc: "Reporte general de estudiantes matriculados.",
    pista: "matricul",
  },
];

type EstadoSlot = { wb: XLSX.WorkBook; fileName: string } | { error: string } | null;

export default function Home() {
  const [slots, setSlots] = useState<Record<SlotKey, EstadoSlot>>({ resp: null, admin: null, matr: null });
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  async function onFile(key: SlotKey, file: File | undefined) {
    if (!file) return;
    setResultado(null);
    setError(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = readWorkbook(buf);
      setSlots((s) => ({ ...s, [key]: { wb, fileName: file.name } }));
    } catch {
      setSlots((s) => ({ ...s, [key]: { error: "No se pudo leer el archivo. ¿Es un .xlsx válido?" } }));
    }
  }

  const todosListos =
    slots.resp && "wb" in slots.resp && slots.admin && "wb" in slots.admin && slots.matr && "wb" in slots.matr;

  function generar() {
    if (!todosListos) return;
    setProcesando(true);
    setError(null);
    setResultado(null);
    // pequeño timeout para permitir que el botón muestre "Procesando..."
    setTimeout(() => {
      try {
        const r = transformAll(
          (slots.resp as { wb: XLSX.WorkBook }).wb,
          (slots.admin as { wb: XLSX.WorkBook }).wb,
          (slots.matr as { wb: XLSX.WorkBook }).wb,
        );
        setResultado(r);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ocurrió un error procesando los archivos.");
      } finally {
        setProcesando(false);
      }
    }, 50);
  }

  function descargarTodo(archivos: OutputFile[]) {
    archivos.forEach((a, i) => setTimeout(() => descargar(a), i * 400));
  }

  const fmt = (n: number) => n.toLocaleString("es-CO");

  return (
    <div className="contenedor">
      <header>
        <h1>Transformador CAI</h1>
        <p>
          Sube los tres Excel, genera los reportes y descárgalos. Todo se procesa en tu navegador: los datos
          (incluidas las cédulas) no se envían a ningún servidor.
        </p>
      </header>

      <h2 className="titulo-paso"><span className="paso-num">1</span>Sube los archivos</h2>
      <div className="slots">
        {SLOTS.map((slot) => {
          const estado = slots[slot.key];
          const cargado = estado && "wb" in estado;
          const err = estado && "error" in estado;
          return (
            <div key={slot.key} className={`slot${cargado ? " ok" : ""}`}>
              <div className="info">
                <p className="nombre-slot">{slot.nombre}</p>
                <p className="desc">{slot.desc}</p>
                {cargado && <p className="estado cargado">✓ {(estado as { fileName: string }).fileName}</p>}
                {err && <p className="estado error">✕ {(estado as { error: string }).error}</p>}
              </div>
              <label className="btn-file">
                {cargado ? "Cambiar" : "Seleccionar"}
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => onFile(slot.key, e.target.files?.[0])}
                />
              </label>
            </div>
          );
        })}
      </div>

      <h2 className="titulo-paso"><span className="paso-num">2</span>Genera los reportes</h2>
      <div className="acciones">
        <button className="btn" disabled={!todosListos || procesando} onClick={generar}>
          {procesando ? "Procesando…" : "Generar reportes"}
        </button>
        {!todosListos && <span className="desc">Faltan archivos por subir.</span>}
      </div>

      {error && <div className="alerta">⚠️ {error}</div>}

      {resultado && (
        <>
          <div className="resumen">
            <h3>Resumen del procesamiento</h3>
            <div className="grid-stats">
              <div className="stat"><div className="num">{fmt(resultado.resumen.filas)}</div><div className="lbl">Respuestas (filas)</div></div>
              <div className="stat"><div className="num">{fmt(resultado.resumen.personas)}</div><div className="lbl">Personas únicas (con ID)</div></div>
              <div className="stat"><div className="num">{fmt(resultado.resumen.duplicadosEliminados)}</div><div className="lbl">Duplicados eliminados</div></div>
              <div className="stat"><div className="num">{fmt(resultado.resumen.filasLargo)}</div><div className="lbl">Filas formato largo</div></div>
              <div className="stat"><div className="num">{fmt(resultado.resumen.docPart)} / {fmt(resultado.resumen.docPob)}</div><div className="lbl">Docentes (participaron / universo)</div></div>
              <div className="stat"><div className="num">{fmt(resultado.resumen.estPart)} / {fmt(resultado.resumen.estPob)}</div><div className="lbl">Estudiantes (participaron / universo)</div></div>
              <div className="stat"><div className="num">{fmt(resultado.resumen.admPart)} / {fmt(resultado.resumen.admPob)}</div><div className="lbl">Administrativos (participaron / universo)</div></div>
            </div>
          </div>

          <h2 className="titulo-paso"><span className="paso-num">3</span>Descarga los resultados</h2>
          <div className="acciones">
            <button className="btn" onClick={() => descargarTodo(resultado.archivos)}>Descargar todo</button>
          </div>
          <div className="descargas">
            {resultado.archivos.map((a) => (
              <div key={a.filename} className="descarga">
                <span className="fn">📄 {a.filename}</span>
                <button className="btn secundario" onClick={() => descargar(a)}>Descargar</button>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="nota">
        Reglas aplicadas: se elimina cada cédula duplicada conservando la primera respuesta; nadie se filtra por el
        cruce (graduados y externos se conservan); el universo (población) sale de los reportes oficiales. Personas ≠
        respuestas: muchas personas respondieron varias veces.
      </p>
    </div>
  );
}
