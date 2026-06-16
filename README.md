# Encuesta_tu_voz_fundamental_pipeline_etl

**Transformador CAI** — app en **Next.js** para procesar el Diagnóstico CAI (pipeline ETL).
Subes los 3 Excel, le das a *Generar* y descargas los reportes. **Todo se procesa en el
navegador**: los datos (incluidas las cédulas) no se envían a ningún servidor.

> ⚠️ Este repositorio contiene **solo la app**. Los archivos Excel con datos
> personales (cédulas, nombres, correos) **no se versionan** — están bloqueados en
> `.gitignore`. Nunca subas esos archivos al repositorio.

---

## ▶️ Cómo usarla

### Primera vez (instalar)
- Doble clic en **`Instalar dependencias.bat`**
  (o en una terminal dentro de esta carpeta: `npm install`).
  Requiere **Node.js** instalado.

### Cada vez que quieras usarla
1. Doble clic en **`Iniciar app.bat`** (o `npm run dev`).
2. Abre en el navegador: **http://localhost:3000**
3. Sube los 3 archivos:
   - **Respuestas del formulario** — `Diagnostico CAI Planeacion Estrategica ...`
   - **Reporte de personal** — `REPORTE ADMIN ...`
   - **Reporte de matriculados** — `Reporte_general__Matriculados_ ...`
4. Pulsa **Generar reportes** y luego **Descargar todo** (o cada archivo aparte).
5. Para cerrarla: cierra la ventana negra (o `Ctrl + C`).

---

## 📦 Qué genera (5 archivos)

1. `1. Respuestas unicas con ID.xlsx` — una fila por persona (cédula única) + `ID` + todas las columnas.
2. `2. Respuestas formato largo (ID-Pregunta-Respuesta).xlsx` — `ID | Pregunta | Respuesta`.
3. `Diagnostico_CAI_Respondieron_NORMALIZADA.xlsx` — `ID | Unidad Regional | Tipo de Participante | Programa o Área`.
4. `Diagnostico_CAI_Respondieron_Normalizado.xlsx` — formato largo (igual que #2).
5. `Reporte CAI - Poblacion vs Participacion.xlsx` — universo vs participación (docentes, estudiantes, administrativos).

Todos comparten la columna **`ID`** (1…N) para cruzarse entre sí.

---

## 📐 Reglas (idénticas al flujo en Python)

- Se elimina cada **cédula duplicada** conservando la **primera** respuesta y se agrega un `ID`.
- **Nadie se filtra por el cruce:** graduados/externos se conservan.
- El **universo (población) sale de los reportes oficiales**:
  docentes/administrativos del REPORTE ADMIN (docente = cargo docente / personal académico),
  estudiantes de MATRICULADOS (por municipio y por programa, consolidando nombres).
- `PARTICIPARON` = cuántos del universo respondieron (cruce por cédula).
- `META (80%)` = techo(población × 0,8).

---

## 🧩 Estructura del código

```
src/
  app/
    page.tsx       ← interfaz (subir, generar, descargar)
    layout.tsx
    globals.css
  lib/
    transform.ts   ← TODO el flujo de transformación (lectura, dedup, ID,
                     formato largo, NORMALIZADA y población vs participación)
```

Si cambian los textos de las preguntas o nombres de columnas, ajusta las
listas/constantes al inicio de `src/lib/transform.ts`.

> Resultado verificado contra el archivo del 16-jun-2026: 15.125 respuestas →
> **10.782 personas únicas**; docentes 1.029/942, estudiantes 13.291/7.997,
> administrativos 795/748.
