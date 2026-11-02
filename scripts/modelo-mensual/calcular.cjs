// Calcula el libro con HyperFormula y extrae los resultados que hay que replicar.
const { HyperFormula } = require('hyperformula');
const fs = require('fs');
const [,, ENTRADA, SALIDA] = process.argv;
const { prendas, ubicaciones, escenarios } = JSON.parse(fs.readFileSync(ENTRADA, 'utf8'));
const iso = (n) => (typeof n === 'number' && n > 30000) ? new Date(Date.UTC(1899,11,30) + n*86400000).toISOString().slice(0,10) : (n===null||n===''? null : n);
const res = [];
for (const e of escenarios) {
  const t0 = Date.now();
  const hf = HyperFormula.buildFromSheets(e.libro, { licenseKey: 'gpl-v3' });
  const id = (s) => hf.getSheetId(s);
  const col = (c) => c.split('').reduce((a, x) => a*26 + x.charCodeAt(0)-64, 0) - 1;
  const v = (s, ref) => { const m = /([A-Z]+)(\d+)/.exec(ref); let x = hf.getCellValue({ sheet: id(s), col: col(m[1]), row: +m[2]-1 }); if (x && typeof x === 'object' && x.value) x = x.value; return x === undefined ? null : x; };
  const r = {};
  const en = e.entrada;
  r.lavado = { I: en.lavado.map((_,i)=>v('Lavado_detalle',`I${11+i}`)), M: en.lavado.map((_,i)=>v('Lavado_detalle',`M${11+i}`)), B7:v('Lavado_detalle','B7'), E7:v('Lavado_detalle','E7'), H7:v('Lavado_detalle','H7') };
  r.procesado = { R: en.procesado.map((_,i)=>v('Procesado_detalle',`R${11+i}`)), S: en.procesado.map((_,i)=>v('Procesado_detalle',`S${11+i}`)), // MOD en Excel toma el signo del divisor y en HyperFormula el del dividendo: al cruzar
    // medianoche Excel da las horas reales y aquí saldrían negativas, así que se ajusta.
    U: en.procesado.map((_,i)=>{const u=v('Procesado_detalle',`U${11+i}`);return typeof u==='number'&&u<0?u+24:u;}), W: en.procesado.map((_,i)=>v('Procesado_detalle',`W${11+i}`)), B7:v('Procesado_detalle','B7'), E7:v('Procesado_detalle','E7') };
  r.operacion = { C: Array.from({length:31},(_,i)=>v('Operacion',`C${11+i}`)), D: Array.from({length:31},(_,i)=>v('Operacion',`D${11+i}`)), A: Array.from({length:31},(_,i)=>iso(v('Operacion',`A${11+i}`))),
    f45: ['B','C','D','E','F','G','H'].map(c=>v('Operacion',`${c}45`)), f46: ['B','C','D','E','F','G','H'].map(c=>v('Operacion',`${c}46`)), f47: ['B','C','D','E','F','G','H'].map(c=>v('Operacion',`${c}47`)), B49:v('Operacion','B49') };
  r.incidencias = { K: en.incidencias.map((_,i)=>v('Incidencias',`K${11+i}`)), B113:v('Incidencias','B113'),B114:v('Incidencias','B114'),B115:v('Incidencias','B115'),B116:v('Incidencias','B116') };
  r.equipos = { D: en.equipos.map((_,i)=>v('Equipos',`D${11+i}`)), B33:v('Equipos','B33'),D33:v('Equipos','D33'),F33:v('Equipos','F33'),B89:v('Equipos','B89'),D89:v('Equipos','D89') };
  r.retiros = { I: en.retiros.map((_,i)=>v('Retiros_importes',`I${11+i}`)), moneda:[114,115,116].map(f=>['B','C','D'].map(c=>v('Retiros_importes',`${c}${f}`))), concepto:[123,124,125].map(f=>['B','C','D'].map(c=>v('Retiros_importes',`${c}${f}`))) };
  r.acciones = { I: en.acciones.map((_,i)=>v('Acciones',`I${11+i}`)), B113:v('Acciones','B113'),B114:v('Acciones','B114'),B115:v('Acciones','B115') };
  r.inventario = { M: e.filasConteo.map(f=>v('Inventario',`M${f}`)), K: e.filasConteo.map(f=>v('Inventario',`K${f}`)), H7:v('Inventario','H7'), B7:iso(v('Inventario','B7')), E7:v('Inventario','E7'),
    articulos: prendas.map((_,i)=>{const f=483+i; return {A:v('Inventario',`A${f}`),B:v('Inventario',`B${f}`),C:v('Inventario',`C${f}`),D:v('Inventario',`D${f}`),E:v('Inventario',`E${f}`),F:v('Inventario',`F${f}`),G:v('Inventario',`G${f}`),H:v('Inventario',`H${f}`),I:iso(v('Inventario',`I${f}`)),J:iso(v('Inventario',`J${f}`)),K:v('Inventario',`K${f}`)};}) };
  const R = (ref)=>v('Resumen',ref);
  r.resumen = { B12:R('B12'),B13:R('B13'),B14:R('B14'),B15:R('B15'),B16:R('B16'),B17:R('B17'),B18:R('B18'),B19:R('B19'),B20:R('B20'),D12:R('D12'),G12:R('G12'),G13:R('G13'),G14:R('G14'),G15:R('G15'),G16:R('G16'),G17:R('G17'),G18:R('G18'),G19:R('G19'),
    B41:R('B41'),B42:R('B42'),B43:R('B43'),B44:R('B44'),G41:R('G41'),G42:R('G42'),G43:R('G43'),G44:R('G44'),G45:R('G45'),B50:R('B50'),B51:R('B51'),B52:R('B52'),B53:R('B53'),B54:R('B54'),
    articulos:[59,60,61,62,63,64,65,66].map(f=>[R(`B${f}`),R(`C${f}`),R(`D${f}`)]), G51:R('G51'),H51:R('H51'),I51:R('I51'),G52:R('G52'),H52:R('H52'),I52:R('I52'),G53:R('G53'),H53:R('H53'),I53:R('I53'),G56:R('G56'),H56:R('H56'),I56:R('I56'),G57:R('G57'),G58:R('G58'),G61:R('G61'),G62:R('G62'),G63:R('G63'),
    areas:[87,88,89,90].map(f=>[R(`B${f}`),R(`C${f}`),R(`D${f}`)]), rev:[97,98,99,100].map(f=>[R(`B${f}`),R(`C${f}`),R(`D${f}`)]), G87:R('G87'),H87:R('H87'),G89:R('G89'),H89:R('H89') };
  res.push({ entrada: en, esperado: r });
  // Errores de fórmula: delatan una función que HyperFormula no sabe calcular.
  const errs = {};
  for (const s of hf.getSheetNames()) { const vals = hf.getSheetValues(id(s)); for (const f of vals) for (const c of f) if (c && typeof c==='object') { errs[`${s}:${c.value}`]=(errs[`${s}:${c.value}`]||0)+1; } }
  console.log(en.nombre, 'ms', Date.now()-t0, 'errores', JSON.stringify(errs));
}
fs.writeFileSync(SALIDA, JSON.stringify({ prendas, ubicaciones, escenarios: res }, null, 1));
