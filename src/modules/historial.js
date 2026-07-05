// ========================================
// 🍦 Heladería POS - Historial Module
// History of daily cash closings
// ========================================

import * as db from '../db.js';
import { formatCurrency } from '../main.js';

let visibleCount = 30;

function defaultCutoffDate() {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return d.toISOString().split('T')[0];
}

function maxAllowedCutoffDate() {
  // Tope mínimo: no permitir archivar nada más reciente que hace 30 días,
  // para no romper los reportes de "mes en curso".
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split('T')[0];
}

export function render() {
  const allCierres = db.getCierres().slice().reverse();
  const cierres = allCierres.slice(0, visibleCount);
  const hasMore = allCierres.length > visibleCount;

  return `
    <div class="page-header">
      <h2>📋 Historial de Cierres</h2>
      <p>Registro de todos los cierres de caja realizados</p>
    </div>

    <div class="card" style="padding:16px; margin-bottom:16px; display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
      <label class="form-label" style="margin:0;">Archivar registros anteriores a:</label>
      <input type="date" id="archivo-cutoff-date" class="form-input" style="max-width:180px;"
             value="${defaultCutoffDate()}" max="${maxAllowedCutoffDate()}" />
      <button class="btn btn-danger" id="btn-archivar-exportar">📦 Archivar y Exportar</button>
    </div>

    ${allCierres.length === 0 ? `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <p>No hay cierres de caja registrados</p>
        <p style="font-size: 12px; margin-top: 8px;">Realiza tu primer cierre en la sección "Cuadre de Caja"</p>
      </div>
    ` : `
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Total Ventas</th>
              <th>Efectivo</th>
              <th>Tarjeta</th>
              <th>Transferencia</th>
              <th>Efectivo Contado</th>
              <th>Diferencia</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${cierres.map(c => {
              const diff = c.diferencia;
              const statusClass = Math.abs(diff) < 0.01 ? 'active' : diff < 0 ? 'inactive' : 'active';
              const statusLabel = Math.abs(diff) < 0.01 ? 'Cuadrada' : diff < 0 ? 'Faltante' : 'Sobrante';
              return `
                <tr>
                  <td style="font-weight: 600; color: var(--text-primary);">
                    ${new Date(c.fecha + 'T12:00:00').toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </td>
                  <td style="font-weight: 700; color: var(--accent-pink);">${formatCurrency(c.total_dia)}</td>
                  <td style="color: var(--cash-color);">${formatCurrency(c.total_efectivo_sistema)}</td>
                  <td style="color: var(--card-color);">${formatCurrency(c.total_tarjeta)}</td>
                  <td style="color: var(--transfer-color);">${formatCurrency(c.total_transferencia)}</td>
                  <td>${formatCurrency(c.efectivo_real)}</td>
                  <td style="font-weight: 700; color: ${Math.abs(diff) < 0.01 ? 'var(--success)' : diff < 0 ? 'var(--danger)' : 'var(--warning)'};">
                    ${Math.abs(diff) < 0.01 ? '$0.00' : (diff > 0 ? '+' : '-') + formatCurrency(Math.abs(diff))}
                  </td>
                  <td><span class="badge ${statusClass}">${statusLabel}</span></td>
                  <td>
                    <button class="btn btn-ghost btn-sm" data-detail-date="${c.fecha}">Ver detalle</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      ${hasMore ? `
        <button class="btn btn-ghost" id="btn-load-more-cierres" style="width:100%; margin-top:12px;">
          Cargar más (${allCierres.length - visibleCount} restantes)
        </button>
      ` : ''}

      <!-- Summary stats (siempre sobre TODOS los cierres, no solo los visibles) -->
      <div class="stats-grid" style="margin-top: 24px;">
        <div class="stat-card pink">
          <div class="stat-number">${allCierres.length}</div>
          <div class="stat-desc">Cierres Realizados</div>
        </div>
        <div class="stat-card mint">
          <div class="stat-number">${formatCurrency(allCierres.reduce((s, c) => s + c.total_dia, 0))}</div>
          <div class="stat-desc">Total Histórico</div>
        </div>
        <div class="stat-card lavender">
          <div class="stat-number">${formatCurrency(allCierres.length > 0 ? allCierres.reduce((s, c) => s + c.total_dia, 0) / allCierres.length : 0)}</div>
          <div class="stat-desc">Promedio por Día</div>
        </div>
        <div class="stat-card ${allCierres.filter(c => Math.abs(c.diferencia) < 0.01).length === allCierres.length ? 'mint' : 'peach'}">
          <div class="stat-number">${allCierres.filter(c => Math.abs(c.diferencia) < 0.01).length}/${allCierres.length}</div>
          <div class="stat-desc">Cajas Cuadradas</div>
        </div>
      </div>
    `}

    <!-- Detail modal -->
    <div id="detail-modal" class="modal-overlay" style="display:none;">
      <div class="modal" style="max-width: 560px;">
        <div class="modal-header">
          <h2>📋 Detalle del Día</h2>
          <button class="modal-close" id="detail-close">&times;</button>
        </div>
        <div id="detail-content"></div>
      </div>
    </div>
  `;
}

export function init() {
  // Detail buttons
  document.querySelectorAll('[data-detail-date]').forEach(btn => {
    btn.addEventListener('click', () => showDetail(btn.dataset.detailDate));
  });

  // Close detail modal
  const closeBtn = document.getElementById('detail-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      document.getElementById('detail-modal').style.display = 'none';
    });
  }

  const detailModal = document.getElementById('detail-modal');
  if (detailModal) {
    detailModal.addEventListener('click', (e) => {
      if (e.target === detailModal) detailModal.style.display = 'none';
    });
  }

  // Refresh when new cierres arrive from Firestore
  db.on('apertura-changed', rerender);
  db.on('cierres-changed', rerender);

  document.getElementById('btn-load-more-cierres')?.addEventListener('click', () => {
    visibleCount += 30;
    rerender();
  });

  document.getElementById('btn-archivar-exportar')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const input = document.getElementById('archivo-cutoff-date');
    const cutoff = input?.value;
    const maxAllowed = maxAllowedCutoffDate();

    if (!cutoff || cutoff > maxAllowed) {
      window.showToast(`⚠️ La fecha de corte debe ser al menos 30 días atrás (máximo permitido: ${maxAllowed})`, 'error');
      return;
    }

    btn.disabled = true;
    try {
      const { ejecutarArchivado } = await import('./archivo.js');
      await ejecutarArchivado(cutoff);
      rerender();
    } finally {
      btn.disabled = false;
    }
  });
}

function rerender() {
  const container = document.getElementById('page-container');
  if (container) {
    container.innerHTML = render();
    init();
  }
}

function showDetail(dateStr) {
  const sales = db.getSalesByDate(dateStr);
  const cierre = db.getCierreByDate(dateStr);
  const summary = db.calcDaySummary(sales);
  const dateLabel = new Date(dateStr + 'T12:00:00').toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const contentEl = document.getElementById('detail-content');

  // Agrupar ventas por producto
  const productSummary = {};
  sales.forEach(s => {
    const name = s.producto_nombre;
    if (!productSummary[name]) {
      productSummary[name] = { count: 0, total: 0 };
    }
    productSummary[name].count += 1;
    productSummary[name].total += Number(s.precio);
  });

  const groupedSales = Object.entries(productSummary)
    .sort((a, b) => b[1].count - a[1].count) // Ordenar por cantidad (mayor a menor)
    .map(([name, data]) => ({ name, count: data.count, total: data.total }));

  contentEl.innerHTML = `
    <p style="color: var(--text-secondary); margin-bottom: 16px;">${dateLabel}</p>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px;">
      <div class="stat-row cash" style="padding: 12px; flex-direction: column; align-items: center;">
        <span style="font-size: 12px; color: var(--text-muted);">Efectivo</span>
        <span style="font-size: 18px; font-weight: 700; color: var(--cash-color);">${formatCurrency(summary.efectivo)}</span>
      </div>
      <div class="stat-row card" style="padding: 12px; flex-direction: column; align-items: center;">
        <span style="font-size: 12px; color: var(--text-muted);">Tarjeta</span>
        <span style="font-size: 18px; font-weight: 700; color: var(--card-color);">${formatCurrency(summary.tarjeta)}</span>
      </div>
      <div class="stat-row transfer" style="padding: 12px; flex-direction: column; align-items: center;">
        <span style="font-size: 12px; color: var(--text-muted);">Transferencia</span>
        <span style="font-size: 18px; font-weight: 700; color: var(--transfer-color);">${formatCurrency(summary.transferencia)}</span>
      </div>
      <div class="stat-row" style="padding: 12px; flex-direction: column; align-items: center; background: rgba(255,107,157,0.1);">
        <span style="font-size: 12px; color: var(--text-muted);">Total</span>
        <span style="font-size: 18px; font-weight: 700; color: var(--accent-pink);">${formatCurrency(summary.total)}</span>
      </div>
    </div>

    <h4 style="font-size: 14px; color: var(--text-muted); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">Resumen de Productos Vendidos (${sales.length} items)</h4>
    <div style="max-height: 300px; overflow-y: auto;">
      ${groupedSales.length > 0 ? groupedSales.map(g => `
        <div class="sale-item" style="justify-content: space-between;">
          <div class="sale-info" style="display: flex; gap: 8px; align-items: center;">
            <span style="font-weight: 700; color: var(--text-primary);">${g.name}</span>
            <span style="color: var(--text-muted); font-size: 13px;">(${g.count} vendidos)</span>
          </div>
          <div style="display:flex;align-items:center;">
            <span class="sale-amount" style="color: var(--accent-pink); font-weight: 700;">${formatCurrency(g.total)}</span>
          </div>
        </div>
      `).join('') : '<p style="color: var(--text-muted); text-align: center; padding: 16px;">Sin ventas registradas</p>'}
    </div>
  `;

  document.getElementById('detail-modal').style.display = 'flex';
}

export function cleanup() {
  visibleCount = 30;
}
