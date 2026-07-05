// ========================================
// 🍦 Heladería POS - Archivado Histórico
// Exporta a Excel y luego limpia registros viejos de Firestore
// ========================================

import * as XLSX from 'xlsx';
import * as db from '../db.js';

/**
 * Exporta a un .xlsx (Ventas, Gastos, Cuentas, Cierres) todo lo anterior a cutoffDateStr,
 * pide confirmación de que la descarga fue correcta, y solo entonces borra esos registros
 * de Firestore. Nunca toca la jornada abierta ni cuentas abiertas.
 */
export async function ejecutarArchivado(cutoffDateStr) {
  const data = await db.getArchivableData(cutoffDateStr);
  const total = data.ventas.length + data.gastos.length + data.cuentas.length + data.jornadas.length;

  if (total === 0) {
    window.showToast('No hay registros anteriores a esa fecha para archivar.', 'info');
    return { archived: false };
  }

  const wb = XLSX.utils.book_new();
  // El Historial de Cierres va primero: es el dato principal que le interesa al negocio.
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flattenJornadas(data.jornadas)), 'Historial de Cierres');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flattenCuentas(data.cuentas)), 'Cuentas');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flattenVentas(data.ventas)), 'Ventas');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flattenGastos(data.gastos)), 'Gastos');

  const filename = `yoguice_archivo_hasta_${cutoffDateStr}.xlsx`;
  XLSX.writeFile(wb, filename);

  const descargaOk = await window.showConfirm({
    icon: '📥',
    title: '¿Se descargó el archivo correctamente?',
    message: `Verifica que <b>${filename}</b> se haya guardado en tu computadora y ábrelo para confirmar que los datos están correctos antes de continuar.`,
    details: `<div style="text-align:center;padding:10px;background:rgba(0,0,0,0.05);border-radius:8px;">
      ${data.ventas.length} ventas · ${data.gastos.length} gastos · ${data.cuentas.length} cuentas · ${data.jornadas.length} cierres
    </div>`,
    confirmText: '✅ Sí, se descargó bien — continuar',
    confirmClass: 'btn-primary'
  });
  if (!descargaOk) return { archived: false, exported: true };

  const borrarOk = await window.showConfirm({
    icon: '🗑️',
    title: '¿Eliminar estos registros de la nube?',
    message: `Se eliminarán permanentemente <b>${total} registros</b> anteriores al ${cutoffDateStr} de Firestore. Esta acción NO se puede deshacer.`,
    confirmText: '🗑️ Eliminar Definitivamente',
    confirmClass: 'btn-danger'
  });
  if (!borrarOk) return { archived: false, exported: true };

  window.showToast('🧹 Archivando registros...', 'info');
  const deleted = await db.archivarRegistros(data);
  const totalDeleted = deleted.ventas + deleted.gastos + deleted.cuentas + deleted.jornadas;
  window.showToast(`✅ Archivado completo: ${totalDeleted} registros eliminados`, 'success');
  return { archived: true, deleted };
}

/**
 * Una fila por cada cierre de caja — mismas columnas y mismo cálculo de "Estado"
 * que la tabla de Historial de Cierres en pantalla (src/modules/historial.js).
 */
function flattenJornadas(jornadas) {
  return jornadas.map(j => {
    const c = j.cierre || {};
    const diff = c.diferencia || 0;
    const estado = Math.abs(diff) < 0.01 ? 'Cuadrada' : diff < 0 ? 'Faltante' : 'Sobrante';
    return {
      'Fecha': j.fecha,
      'Total Ventas': c.total_dia,
      'Efectivo': c.total_efectivo_sistema,
      'Tarjeta': c.total_tarjeta,
      'Transferencia': c.total_transferencia,
      'Efectivo Contado': c.efectivo_real,
      'Diferencia': diff,
      'Estado': estado,
    };
  });
}

function flattenCuentas(cuentas) {
  return cuentas.map(c => ({
    'Número': c.numero,
    'Mesa': c.mesa || 'LLEVAR',
    'Estado': c.estado,
    'Total': c.total,
    'Método de Pago': c.metodo_pago,
    'Fecha Apertura': c.fecha_apertura,
    'Fecha Cierre': c.fecha_cierre,
    'Items': (c.items || []).map(i => `${i.cantidad}x ${i.nombre}`).join('; ')
  }));
}

function flattenVentas(ventas) {
  return ventas.map(v => ({
    'Fecha': v.fecha,
    'Hora': v.hora,
    'Producto': v.producto_nombre,
    'Precio': v.precio,
    'Método de Pago': v.metodo_pago,
  }));
}

function flattenGastos(gastos) {
  return gastos.map(g => ({
    'Fecha': g.fecha,
    'Hora': g.hora,
    'Descripción': g.descripcion,
    'Categoría': g.categoria,
    'Monto': g.monto,
  }));
}
