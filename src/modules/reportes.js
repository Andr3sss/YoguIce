// ========================================
// 🍦 Heladería POS - Reportes Module
// Sales reports with charts (day/week/month)
// ========================================

import * as db from '../db.js';
import { formatCurrency } from '../main.js';

let currentFilter = 'semana';

export async function render() {
  const content = await renderReport(currentFilter);
  return `
    <div class="page-header">
      <h2>📊 Reportes de Ventas</h2>
      <p>Análisis de ventas por período</p>
    </div>

    <div class="filter-tabs">
      <button class="filter-tab ${currentFilter === 'dia' ? 'active' : ''}" data-filter="dia">Hoy</button>
      <button class="filter-tab ${currentFilter === 'semana' ? 'active' : ''}" data-filter="semana">Semana</button>
      <button class="filter-tab ${currentFilter === 'mes' ? 'active' : ''}" data-filter="mes">Mes</button>
      <button class="filter-tab ${currentFilter === 'todo' ? 'active' : ''}" data-filter="todo">Todo</button>
    </div>

    <div id="report-content">
      ${content}
    </div>
  `;
}

async function getFilteredSales(filter) {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  switch (filter) {
    case 'dia':
      return db.getSalesByDate(todayStr);
    case 'semana': {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return db.getSalesByDateRange(weekAgo.toISOString().split('T')[0], todayStr);
    }
    case 'mes': {
      const monthAgo = new Date(today);
      monthAgo.setDate(monthAgo.getDate() - 30);
      return db.getSalesByDateRange(monthAgo.toISOString().split('T')[0], todayStr);
    }
    case 'todo':
      return await db.getGlobalSales();
    default:
      return db.getSales();
  }
}

async function getFilteredGastos(filter) {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  switch (filter) {
    case 'dia':
      return await db.getGlobalGastos(todayStr, todayStr);
    case 'semana': {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return await db.getGlobalGastos(weekAgo.toISOString().split('T')[0], todayStr);
    }
    case 'mes': {
      const monthAgo = new Date(today);
      monthAgo.setDate(monthAgo.getDate() - 30);
      return await db.getGlobalGastos(monthAgo.toISOString().split('T')[0], todayStr);
    }
    case 'todo':
      return await db.getGlobalGastos();
    default:
      return db.getGastos();
  }
}

function getFilteredAperturas(filter) {
  const allAperturas = db.getHistorialAperturas();
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  switch (filter) {
    case 'dia':
      return allAperturas.filter(a => a.fecha === todayStr);
    case 'semana': {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekStr = weekAgo.toISOString().split('T')[0];
      return allAperturas.filter(a => a.fecha >= weekStr && a.fecha <= todayStr);
    }
    case 'mes': {
      const monthAgo = new Date(today);
      monthAgo.setDate(monthAgo.getDate() - 30);
      const monthStr = monthAgo.toISOString().split('T')[0];
      return allAperturas.filter(a => a.fecha >= monthStr && a.fecha <= todayStr);
    }
    case 'todo':
      return allAperturas;
    default:
      return allAperturas;
  }
}

function calcInventarioSummary(aperturas) {
  const summary = {};
  
  // 1. Pre-llenar con todos los insumos activos registrados actualmente
  const currentInsumos = db.getInsumos().filter(i => i.activo !== false);
  currentInsumos.forEach(ins => {
    // Usamos string para las keys por seguridad (Firestore ID / legacy numeric)
    const key = String(ins.id || ins.firestoreId);
    summary[key] = { nombre: ins.nombre, id: key, inicial: 0, final: 0, consumo: 0 };
  });

  // 2. Sumar el consumo de las aperturas/cierres
  aperturas.forEach(ap => {
    if (ap.inventario_diario) {
      ap.inventario_diario.forEach(item => {
        const key = String(item.id);
        if (!summary[key]) {
          summary[key] = { nombre: item.nombre, id: key, inicial: 0, final: 0, consumo: 0 };
        }
        summary[key].inicial += item.cantidad_inicial || 0;
        summary[key].final += item.cantidad_final || 0;
        summary[key].consumo += item.consumo || 0;
      });
    }
  });

  // 3. Filtrar: Mostrar siempre los activos + los inactivos que tengan consumo registrado en este periodo
  const resultObj = Object.values(summary)
    .filter(item => {
      const isCurrentlyActive = currentInsumos.some(i => String(i.id || i.firestoreId) === item.id);
      return isCurrentlyActive || item.consumo > 0 || item.inicial > 0 || item.final > 0;
    })
    .sort((a, b) => b.consumo - a.consumo);
  
  console.log("Inventario Summary => ", resultObj);
  return resultObj;
}

async function renderReport(filter) {
  const sales = await getFilteredSales(filter);
  const gastos = await getFilteredGastos(filter);
  const aperturas = getFilteredAperturas(filter);

  const summary = db.calcDaySummary(sales);
  const totalGastos = gastos.reduce((sum, g) => sum + g.monto, 0);
  const utilidadNeta = summary.total - totalGastos;

  const dailyTotals = db.getDailyTotals(sales, filter === 'dia' ? 1 : filter === 'semana' ? 7 : filter === 'mes' ? 30 : 30);
  const topProducts = db.getTopProducts(sales);
  const inventarioSummary = calcInventarioSummary(aperturas);

  return `
    <!-- Stats Cards -->
    <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
      <div class="stat-card pink">
        <div class="stat-number">${formatCurrency(summary.total)}</div>
        <div class="stat-desc">Ingresos Brutos</div>
      </div>
      <div class="stat-card lavender" style="background: var(--bg-card); color: var(--danger); border: 1px solid var(--danger);">
        <div class="stat-number">${formatCurrency(totalGastos)}</div>
        <div class="stat-desc">Gastos / Egresos</div>
      </div>
      <div class="stat-card mint">
        <div class="stat-number" style="color: ${utilidadNeta >= 0 ? 'var(--success)' : 'var(--danger)'}">
          ${formatCurrency(utilidadNeta)}
        </div>
        <div class="stat-desc">Utilidad Neta</div>
      </div>
      <div class="stat-card" style="background: var(--bg-card); border: 1px solid var(--border);">
        <div class="stat-number">${summary.count}</div>
        <div class="stat-desc">Ventas Realizadas</div>
      </div>
    </div>

    <!-- Payment Methods Chart -->
    <div class="chart-container">
      <div class="chart-title">Ventas por Método de Pago</div>
      <div class="bar-chart" style="height: 180px; align-items: flex-end;">
        ${renderPaymentBars(summary)}
      </div>
    </div>

    <!-- Daily Sales Chart -->
    ${filter !== 'dia' ? `
      <div class="chart-container">
        <div class="chart-title">Ventas Diarias</div>
        <div class="bar-chart" style="height: 200px;">
          ${renderDailyBars(dailyTotals)}
        </div>
      </div>
    ` : ''}

    <!-- Top Products -->
    <div class="card" style="margin-top: 16px;">
      <div class="card-header">
        <h3 class="card-title">🏆 Productos Más Vendidos</h3>
      </div>
      ${topProducts.length > 0 ? `
        <div class="ranking-list">
          ${topProducts.map((p, i) => `
            <div class="ranking-item">
              <div class="ranking-position ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : 'other'}">${i + 1}</div>
              <div class="ranking-info">
                <div class="ranking-name">${p.nombre}</div>
                <div class="ranking-count">${p.cantidad} ventas</div>
              </div>
              <div class="ranking-amount">${formatCurrency(p.total)}</div>
            </div>
          `).join('')}
        </div>
      ` : '<div class="empty-state"><p>Sin datos para este período</p></div>'}
    </div>

    <!-- Inventory Usage -->
    <div class="card" style="margin-top: 16px;">
      <div class="card-header">
        <h3 class="card-title">📦 Consumo de Inventario</h3>
      </div>
      ${inventarioSummary.length > 0 ? `
        <div class="table-container" style="border: none;">
          <table>
            <thead>
              <tr>
                <th>Insumo</th>
                <th style="text-align: center;">Total Inicial</th>
                <th style="text-align: center;">Total Final</th>
                <th style="text-align: center;">Total Usado</th>
              </tr>
            </thead>
            <tbody>
              ${inventarioSummary.map(i => `
                <tr>
                  <td style="font-weight: 500;">${i.nombre}</td>
                  <td style="text-align: center; color: var(--text-secondary);">${i.inicial}</td>
                  <td style="text-align: center; color: var(--text-secondary);">${i.final}</td>
                  <td style="text-align: center; font-weight: bold; color: ${i.consumo > 0 ? 'var(--accent-pink)' : 'var(--text-primary)'};">${i.consumo}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : '<div class="empty-state"><p>No hay datos de inventario para este período</p></div>'}
    </div>

    <!-- Payment breakdown table -->
    <div class="card" style="margin-top: 16px;">
      <div class="card-header">
        <h3 class="card-title">💳 Desglose por Método de Pago</h3>
      </div>
      <div class="table-container" style="border: none;">
        <table>
          <thead>
            <tr>
              <th>Método</th>
              <th>Ventas</th>
              <th>Total</th>
              <th>% del Total</th>
            </tr>
          </thead>
          <tbody>
            ${renderPaymentTable(sales, summary)}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Expenses History -->
    <div class="card" style="margin-top: 16px;">
      <div class="card-header">
        <h3 class="card-title">💸 Historial de Gastos</h3>
        ${gastos.length > 0 ? `<span style="font-size: 14px; font-weight: 600; color: var(--danger); background: rgba(239, 68, 68, 0.1); padding: 4px 8px; border-radius: 6px;">Total: ${formatCurrency(totalGastos)}</span>` : ''}
      </div>
      ${gastos.length > 0 ? `
        <div class="table-container" style="border: none; max-height: 400px; overflow-y: auto;">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Concepto</th>
                <th>Categoría</th>
                <th style="text-align: right;">Monto</th>
              </tr>
            </thead>
            <tbody>
              ${gastos.slice().sort((a, b) => b.timestamp - a.timestamp).map(g => `
                <tr>
                  <td style="font-size: 13px; color: var(--text-muted);">${new Date(g.timestamp).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td style="font-weight: 500;">${g.descripcion || 'Sin descripción'}</td>
                  <td><span style="font-size: 11px; padding: 2px 6px; background: var(--bg-card); border-radius: 4px;">${g.categoria || 'Otros'}</span></td>
                  <td style="text-align: right; font-weight: bold; color: var(--danger);">${formatCurrency(g.monto)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : '<div class="empty-state"><p>No hay gastos registrados para este período</p></div>'}
    </div>
  `;
}

function renderPaymentBars(summary) {
  const max = Math.max(summary.efectivo, summary.tarjeta, summary.transferencia, 1);
  const items = [
    { label: 'Efectivo', value: summary.efectivo, color: 'mint' },
    { label: 'Tarjeta', value: summary.tarjeta, color: 'blue' },
    { label: 'Transferencia', value: summary.transferencia, color: 'lavender' },
  ];

  return items.map(item => `
    <div class="bar-col">
      <div class="bar-value">${formatCurrency(item.value)}</div>
      <div class="bar ${item.color}" style="height: ${Math.max((item.value / max) * 100, 3)}%;"></div>
      <div class="bar-label">${item.label}</div>
    </div>
  `).join('');
}

function renderDailyBars(dailyTotals) {
  const display = dailyTotals.slice(-10);
  const max = Math.max(...display.map(d => d.total), 1);

  return display.map(d => `
    <div class="bar-col">
      <div class="bar-value">${d.total > 0 ? formatCurrency(d.total) : '-'}</div>
      <div class="bar pink" style="height: ${Math.max((d.total / max) * 100, 3)}%;"></div>
      <div class="bar-label">${d.label}</div>
    </div>
  `).join('');
}

function renderPaymentTable(sales, summary) {
  const methods = ['efectivo', 'tarjeta', 'transferencia'];
  const icons = { efectivo: '💵', tarjeta: '💳', transferencia: '📱' };
  const colors = { efectivo: 'var(--cash-color)', tarjeta: 'var(--card-color)', transferencia: 'var(--transfer-color)' };

  return methods.map(method => {
    const count = sales.filter(s => s.metodo_pago === method).length;
    const total = summary[method];
    const pct = summary.total > 0 ? ((total / summary.total) * 100).toFixed(1) : '0.0';
    return `
      <tr>
        <td style="font-weight: 600; color: ${colors[method]};">
          ${icons[method]} ${method.charAt(0).toUpperCase() + method.slice(1)}
        </td>
        <td>${count}</td>
        <td style="font-weight: 700;">${formatCurrency(total)}</td>
        <td>${pct}%</td>
      </tr>
    `;
  }).join('');
}

export function init() {
  // Filter tab clicks
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', async () => {
      currentFilter = tab.dataset.filter;
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const content = await renderReport(currentFilter);
      const container = document.getElementById('report-content');
      if (container) container.innerHTML = content;
    });
  });

  // Cloud Sync listener
  db.on('sales-changed', refreshReport);
  db.on('gastos-changed', refreshReport);
}

async function refreshReport() {
  const content = await renderReport(currentFilter);
  const container = document.getElementById('report-content');
  if (container) container.innerHTML = content;
}

export function cleanup() {
  db.off('sales-changed', refreshReport);
  db.off('gastos-changed', refreshReport);
}
