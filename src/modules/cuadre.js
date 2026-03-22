// ========================================
// 🍦 Heladería POS - Cuadre de Caja Module
// Apertura y cierre del día + reconciliación
// ========================================

import * as db from '../db.js';
import { formatCurrency, formatTime } from '../main.js';

const TEMP_CONCILIACION_KEY = 'heladeria_tmp_conciliacion';
let conciliacionTransferencias = [];

function saveTempConciliacion() {
  localStorage.setItem(TEMP_CONCILIACION_KEY, JSON.stringify(conciliacionTransferencias));
}

function loadTempConciliacion() {
  try {
    const data = localStorage.getItem(TEMP_CONCILIACION_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

export function render() {
  const apertura = db.getAperturaHoy();

  // State machine: no apertura → show apertura form
  //                abierto → show cierre form
  //                cerrado → show cierre completed
  if (!apertura) {
    return renderAperturaForm();
  } else if (apertura.estado === 'abierto') {
    // Load reconciliation state from localStorage to prevent data loss on navigation
    conciliacionTransferencias = loadTempConciliacion();
    return renderCierreForm(apertura);
  } else {
    return renderCierreDone(apertura);
  }
}

// ========================================
// 1. Apertura del día
// ========================================

function renderAperturaForm() {
  const insumos = db.getActiveInsumos();

  return `
    <div class="page-header">
      <h2>☀️ Apertura del Día</h2>
      <p>Abre la caja para comenzar a registrar ventas</p>
    </div>

    <!-- Dashboard Layout Wrapper -->
    <div style="max-width: 900px; margin: 0 auto;">
      
      <!-- Dashboard Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 24px; margin-bottom: 24px;">
        
        <!-- Left Column: Financials -->
        <div class="card" style="padding: 32px 24px; text-align: center; display: flex; flex-direction: column; justify-content: center; align-items: center;">
          <div style="width: 72px; height: 72px; padding: 16px; border-radius: 50%; background: rgba(16, 185, 129, 0.1); font-size: 32px; display: flex; align-items: center; justify-content: center; margin-bottom: 20px;">🔓</div>
          <h3 style="font-size: 22px; margin-top: 0; margin-bottom: 12px;">Iniciar jornada</h3>
          <p style="color: var(--text-secondary); font-size: 14px; margin-bottom: 32px; max-width: 250px;">
            Ingresa la cantidad de efectivo físico con la que abre tu caja hoy.
          </p>

          <div class="form-group" style="width: 100%; max-width: 300px; text-align: left;">
            <label class="form-label" style="font-size: 13px; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">Efectivo Inicial en Caja ($)</label>
            <input type="number" id="efectivo-inicial" class="form-input large" placeholder="0.00" step="0.01" min="0" value="0" style="font-size: 28px; text-align: center; font-weight: 700; color: var(--accent-mint);" />
          </div>
        </div>

        <!-- Right Column: Inventory -->
        ${insumos.length > 0 ? `
          <div class="card" style="padding: 24px; display: flex; flex-direction: column;">
            <h4 style="margin-top: 0; margin-bottom: 16px; font-size: 16px; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
              <span>📦</span> Inventario Inicial
            </h4>
            <div style="background: var(--bg-tertiary); padding: 16px; border-radius: var(--radius-md); flex-grow: 1; display: flex; flex-direction: column;">
              
              <div style="display: grid; grid-template-columns: 1fr 100px; gap: 12px; font-size: 12px; color: var(--text-muted); margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border-color);">
                <div>INSUMO</div>
                <div style="text-align: center;">CANTIDAD</div>
              </div>
              
              <div style="max-height: 300px; overflow-y: auto; padding-right: 8px;">
                ${insumos.map(i => `
                  <div style="display: grid; grid-template-columns: 1fr 100px; gap: 12px; align-items: center; margin-bottom: 12px;">
                    <div style="font-size: 14px; font-weight: 500;">${i.nombre}</div>
                    <input type="number" class="form-input inventario-inicial-input" data-id="${i.id}" data-nombre="${i.nombre}" placeholder="0" min="0" value="0" style="text-align: center; font-size: 15px; font-weight: 600;" />
                  </div>
                `).join('')}
              </div>

            </div>
          </div>
        ` : `
          <div class="card" style="padding: 24px; text-align: center; color: var(--text-muted);">
            <p>No hay insumos activos para inventariar.</p>
          </div>
        `}

      </div>

      <button class="btn btn-primary btn-lg" style="width: 100%; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);" id="btn-abrir-dia">
        ☀️ Abrir Caja y Comenzar Día
      </button>
      
    </div>
  `;
}

// ========================================
// 2. Cierre de caja (Formulario interactivo)
// ========================================

function renderCierreForm(apertura) {
  const jornadaSales = db.getSalesForJornada();
  const summary = db.calcDaySummary(jornadaSales);
  
  const groupedTransfers = db.groupSalesByCuenta(jornadaSales.filter(s => s.metodo_pago === 'transferencia'));
  const transferenciasCount = groupedTransfers.length;
  const transferenciasDetalle = groupedTransfers.map(g => g.total);
  
  const jornadaGastos = db.getGastosForJornada();
  const totalGastos = db.round2(jornadaGastos.reduce((sum, g) => sum + (g.monto || 0), 0));

  const totalEsperado = db.round2(apertura.efectivo_inicial + summary.efectivo - totalGastos);

  return `
    <div class="page-header">
      <h2>💰 Cuadre de Caja</h2>
      <p>Finaliza la jornada y concilia el efectivo</p>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 24px; max-width: 1000px; margin: 0 auto;">
      
      <!-- Seccion Totales -->
      <div class="card" style="padding: 24px;">
        <h3 style="margin-top: 0; margin-bottom: 20px; font-size: 18px; display: flex; align-items: center; gap: 8px;">
          📊 Totales del Sistema
        </h3>

        <div class="cuadre-info-row" style="margin-bottom: 12px; font-size: 14px;">
          <span class="text-muted">☀️ Apertura</span>
          <span>${formatTime(apertura.hora_apertura)}</span>
        </div>
        
        <div class="cuadre-info-row" style="margin-bottom: 16px; font-size: 15px;">
          <span>💵 Efectivo inicial</span>
          <div style="display: flex; align-items: center; gap: 8px;">
            <strong>${formatCurrency(apertura.efectivo_inicial)}</strong>
            <button id="btn-edit-efectivo-inicial" style="background:none; border:none; color:var(--accent-mint); cursor:pointer; font-size:14px; padding:0; display:flex; align-items:center;" title="Editar efectivo inicial">✏️</button>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 16px;">
          <div style="background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.1); padding: 12px; border-radius: var(--radius-sm); text-align: center;">
            <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">EFECTIVO</div>
            <strong style="color: var(--accent-mint); font-size: 16px;">${formatCurrency(summary.efectivo)}</strong>
          </div>
          <div style="background: rgba(99, 102, 241, 0.05); border: 1px solid rgba(99, 102, 241, 0.1); padding: 12px; border-radius: var(--radius-sm); text-align: center;">
            <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">TARJETA</div>
            <strong style="color: var(--accent-blue); font-size: 16px;">${formatCurrency(summary.tarjeta)}</strong>
          </div>
          <div style="background: rgba(168, 85, 247, 0.05); border: 1px solid rgba(168, 85, 247, 0.1); padding: 12px; border-radius: var(--radius-sm); text-align: center;">
            <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">TRANSFER.</div>
            <strong style="color: var(--accent-lavender); font-size: 16px;">${formatCurrency(summary.transferencia)}</strong>
          </div>
          <div style="background: rgba(248, 113, 113, 0.05); border: 1px solid rgba(248, 113, 113, 0.1); padding: 12px; border-radius: var(--radius-sm); text-align: center;">
            <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">GASTOS DEL DÍA</div>
            <strong style="color: var(--danger); font-size: 16px;">${formatCurrency(totalGastos)}</strong>
          </div>
        </div>

        <div style="padding: 16px; background: rgba(255, 107, 157, 0.05); border: 1px dashed rgba(255, 107, 157, 0.3); border-radius: var(--radius-sm); text-align: center; margin-bottom: 24px;">
          <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 4px; letter-spacing: 1px;">Total Ventas del Día</div>
          <div style="font-size: 32px; font-weight: 800; color: var(--accent-pink);">${formatCurrency(summary.total)}</div>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">${summary.count} ventas · ${db.getTodayCuentas().length} cuentas cerradas</div>
        </div>

        <div class="cuadre-info-row" style="background: rgba(110, 231, 183, 0.08); padding: 16px; border-radius: var(--radius-sm); border-left: 4px solid var(--accent-mint); margin-bottom: 8px;">
          <span style="font-weight: 600;">💵 Efectivo esperado en caja</span>
          <strong style="font-size: 22px; color: var(--accent-mint);">${formatCurrency(totalEsperado)}</strong>
        </div>
        <div style="font-size: 11px; color: var(--text-muted); text-align: center; margin-bottom: 24px;">
          Inicial (${formatCurrency(apertura.efectivo_inicial)}) + Ventas Efec. (${formatCurrency(summary.efectivo)}) - Gastos (${formatCurrency(totalGastos)})
        </div>

        <div class="form-group">
          <label class="form-label" style="font-weight: 700;">💵 Efectivo contado en físico ($)</label>
          <input type="number" id="efectivo-real" class="form-input large" placeholder="0.00" step="0.01" style="font-size: 24px; font-weight: 800; text-align: center;" />
        </div>

        <button class="btn btn-ghost btn-lg" style="width: 100%; margin-top: 12px;" id="btn-calcular">
          🧮 Calcular Diferencia
        </button>

        <div id="cuadre-result" style="margin-top: 16px;"></div>

        <button class="btn btn-primary btn-lg" style="width: 100%; margin-top: 16px; display: none;" id="btn-cerrar-dia">
          🔒 Cerrar Jornada Definitivamente
        </button>
      </div>

      <!-- Seccion Reconciliacion y Otros -->
      <div style="display: flex; flex-direction: column; gap: 24px;">
        
        <!-- Reconciliacion de Transferencias -->
        <div class="card" style="padding: 24px;">
          <h3 style="margin-top: 0; margin-bottom: 16px; font-size: 16px; display: flex; align-items: center; gap: 8px;">
            📱 Conciliación de Transferencias
          </h3>
          
          <div style="background: rgba(168, 85, 247, 0.05); border: 1px solid rgba(168, 85, 247, 0.1); border-radius: var(--radius-md); padding: 16px; margin-bottom: 20px; position: relative; overflow: hidden;">
            <div style="position: absolute; top: -20px; right: -20px; width: 60px; height: 60px; background: var(--accent-lavender); filter: blur(40px); opacity: 0.1;"></div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <span style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px; font-weight: 600;">Registros del Sistema</span>
              <span style="font-size: 16px; font-weight: 800; color: var(--accent-lavender);" id="conciliacion-total-sistema" data-total="${summary.transferencia}" data-count="${transferenciasCount}">
                ${formatCurrency(summary.transferencia)}
              </span>
            </div>
            
            <div style="display: flex; align-items: baseline; gap: 8px;">
              <strong style="font-size: 22px; color: var(--text-primary); font-weight: 800;">${transferenciasCount}</strong>
              <span style="font-size: 13px; color: var(--text-secondary); opacity: 0.8;">ventas detectadas hoy</span>
            </div>

            ${transferenciasDetalle.length > 0 ? `
              <div style="margin-top: 12px; padding-top: 12px; border-top: 1px dashed rgba(255,255,255,0.1);">
                <button id="btn-toggle-system-audit" style="background: none; border: none; padding: 0; color: var(--accent-lavender); font-size: 11px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s; outline: none;">
                  <span id="audit-toggle-icon">🔍</span> <span id="audit-toggle-text">Ver desglose detallado</span>
                </button>
                <div id="system-audit-details" style="display: none; margin-top: 12px; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 8px; animation: fadeIn 0.3s ease;">
                  ${transferenciasDetalle.map((m, idx) => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: rgba(0,0,0,0.2); border-radius: 6px; font-size: 12px; border: 1px solid rgba(255,255,255,0.03);">
                      <span style="color: var(--text-muted); font-size: 9px; font-weight: 500;">#${idx + 1}</span>
                      <span style="font-weight: 700; color: var(--text-primary);">${formatCurrency(m)}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}
          </div>

          <div style="display: grid; grid-template-columns: 1fr 100px auto; gap: 8px; margin-bottom: 16px;">
            <input type="text" id="transfer-ref" class="form-input" placeholder="Referencia/Nombre" />
            <input type="number" id="transfer-monto" class="form-input" placeholder="Monto" step="0.01" />
            <button class="btn btn-ghost" id="btn-add-transfer" style="padding: 0 16px;">➕</button>
          </div>

          <div id="conciliacion-table-container"></div>
        </div>

        <!-- Inventario Final -->
        ${apertura.inventario_inicial && apertura.inventario_inicial.length > 0 ? `
          <div class="card" style="padding: 24px;">
            <h4 style="margin-top: 0; margin-bottom: 8px; font-size: 16px; display: flex; align-items: center; gap: 8px;">
              <span>📦</span> Inventario Final
            </h4>
            <p style="color: var(--text-muted); font-size: 12px; margin-bottom: 16px;">
              Contabiliza los insumos restantes al cerrar.
            </p>
            
            <div style="background: var(--bg-tertiary); padding: 16px; border-radius: var(--radius-md); flex-grow: 1; display: flex; flex-direction: column;">
              
              <div style="display: grid; grid-template-columns: 1fr 60px 80px; gap: 12px; font-size: 11px; color: var(--text-muted); margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid var(--border-color);">
                <div>INSUMO</div>
                <div style="text-align: center;">INICIAL</div>
                <div style="text-align: center;">FINAL</div>
              </div>
              
              <div style="max-height: 250px; overflow-y: auto; padding-right: 4px;">
                ${apertura.inventario_inicial.map(i => `
                  <div style="display: grid; grid-template-columns: 1fr 60px 80px; gap: 12px; align-items: center; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.02);">
                    <div style="font-weight: 500; font-size: 13px;">${i.nombre}</div>
                    <div style="text-align: center; font-size: 13px; color: var(--text-secondary); background: rgba(0,0,0,0.1); border-radius: 4px; padding: 4px 0;">${i.cantidad}</div>
                    <input type="number" class="form-input inventario-final-input" data-id="${i.id}" data-nombre="${i.nombre}" placeholder="0" min="0" value="0" style="text-align: center; font-size: 14px; font-weight: bold; padding: 6px;" />
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        ` : ''}

      </div>
    </div>
  `;
}

// ========================================
// 3. Cierre completado
// ========================================

function renderCierreDone(apertura) {
  const c = apertura.cierre;
  if (!c) {
    return `
      <div class="page-header">
        <h2>💰 Cuadre de Caja</h2>
        <p>El día fue cerrado</p>
      </div>
      <div class="card" style="max-width: 500px; margin: 0 auto; text-align: center; padding: 48px;">
        <div style="font-size: 64px; margin-bottom: 16px;">🔒</div>
        <h3>Día cerrado</h3>
        <p style="color: var(--text-muted);">Cerrado a las ${formatTime(apertura.hora_cierre)}</p>
        
        <button class="btn btn-ghost" id="btn-reabrir-dia" style="margin-top: 24px; color: var(--accent-pink); border: 1px dashed var(--accent-pink); padding: 12px 24px;">
          🔄 Re-abrir Jornada (Emergencia)
        </button>
      </div>
    `;
  }

  const diff = c.diferencia;
  const statusClass = Math.abs(diff) < 0.01 ? 'success' : diff < 0 ? 'danger' : 'warning';
  const statusIcon = Math.abs(diff) < 0.01 ? '✅' : diff < 0 ? '❌' : '⚠️';
  const statusMsg = Math.abs(diff) < 0.01 ? 'Caja cuadrada correctamente' : diff < 0 ? 'Faltante en caja' : 'Sobrante en caja';

  return `
    <div class="page-header">
      <h2>💰 Cuadre de Caja</h2>
      <p>Cierre del día completado</p>
    </div>

    <div style="max-width: 900px; margin: 0 auto;">
      
      <div class="card" style="text-align: center; padding: 24px; margin-bottom: 24px; border-bottom: 4px solid var(--${statusClass});">
        <div style="font-size: 48px; margin-bottom: 16px;">${statusIcon}</div>
        <h3 style="font-size: 24px; font-weight: 800; margin-bottom: 4px;">${statusMsg}</h3>
        <p style="font-size: 14px; color: var(--text-muted);">
          Abierto: ${formatTime(apertura.hora_apertura)} &rarr; Cerrado: ${formatTime(apertura.hora_cierre)}
        </p>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 24px; margin-bottom: 24px;">
        
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div class="card" style="padding: 16px;">
            <h4 style="margin-top: 0; margin-bottom: 16px; font-size: 15px; color: var(--text-secondary);">📊 Resumen de Ingresos</h4>
            
            <div class="cuadre-info-row" style="margin-bottom: 16px; font-size: 15px;">
              <span>💵 Efectivo inicial</span>
              <strong>${formatCurrency(apertura.efectivo_inicial)}</strong>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px;">
              <div class="stat-row cash" style="padding: 16px; flex-direction: column; align-items: flex-start; gap: 6px;">
                <span class="stat-label" style="font-size: 12px;">Efectivo Ventas</span>
                <span class="stat-value" style="font-size: 20px;">${formatCurrency(c.total_efectivo_sistema)}</span>
              </div>
              <div class="stat-row card" style="padding: 16px; flex-direction: column; align-items: flex-start; gap: 6px;">
                <span class="stat-label" style="font-size: 12px;">Tarjeta</span>
                <span class="stat-value" style="font-size: 20px;">${formatCurrency(c.total_tarjeta)}</span>
              </div>
              <div class="stat-row transfer" style="padding: 16px; flex-direction: column; align-items: flex-start; gap: 6px;">
                <span class="stat-label" style="font-size: 12px;">Transferencia</span>
                <span class="stat-value" style="font-size: 20px;">${formatCurrency(c.total_transferencia)}</span>
              </div>
              <div class="stat-row" style="padding: 16px; flex-direction: column; align-items: flex-start; gap: 6px; background: rgba(248, 113, 113, 0.1); border: 1px solid rgba(248, 113, 113, 0.1);">
                <span class="stat-label" style="font-size: 12px;">Gastos</span>
                <span class="stat-value" style="font-size: 20px; color: var(--danger);">${formatCurrency(c.total_gastos || 0)}</span>
              </div>
            </div>
            
            <div style="padding: 16px; background: rgba(255, 107, 157, 0.05); border: 1px dashed rgba(255, 107, 157, 0.3); border-radius: var(--radius-sm); text-align: center; margin-bottom: 16px;">
              <span class="stat-label" style="font-size: 12px;">TOTAL VENTAS BRUTAS</span>
              <div class="stat-value" style="font-size: 24px; color: var(--accent-pink); font-weight: 800;">${formatCurrency(c.total_dia)}</div>
            </div>

            <div style="margin-bottom: 8px; padding: 0 12px; display: flex; justify-content: space-between; font-size: 13px;">
              <span class="text-muted">Ventas (Efec + Transf)</span>
              <span>${formatCurrency(db.round2(c.total_efectivo_sistema + c.total_transferencia))}</span>
            </div>
            
            ${c.conciliacion_transferencias && c.conciliacion_transferencias.sistema_detalles ? `
              <div style="margin: 0 8px 16px 8px; padding: 16px; background: rgba(168, 85, 247, 0.03); border: 1px solid rgba(168, 85, 247, 0.08); border-radius: var(--radius-md);">
                <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 12px; letter-spacing: 1px; font-weight: 600; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px;">Audit Logs · Sistema</div>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: 8px;">
                  ${c.conciliacion_transferencias.sistema_detalles.map((m, idx) => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: rgba(0,0,0,0.1); border-radius: 6px; font-size: 11px; border: 1px solid rgba(255,255,255,0.03);">
                      <span style="color: var(--text-muted); font-size: 9px;">#${idx+1}</span>
                      <span style="font-weight: 700; color: var(--transfer-color);">${formatCurrency(m)}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}
            
            <div class="cuadre-info-row" style="margin-bottom: 12px; background: rgba(110, 231, 183, 0.08); padding: 12px; border-radius: var(--radius-sm);">
              <span>💵 Efectivo esperado</span>
              <strong>${formatCurrency(c.total_esperado || 0)}</strong>
            </div>
            
            <div class="cuadre-info-row" style="margin-bottom: 16px; padding: 0 12px;">
              <span>💵 Efectivo contado</span>
              <strong>${formatCurrency(c.efectivo_real)}</strong>
            </div>

            <div class="cuadre-result ${statusClass}" style="padding: 16px;">
              <div class="result-message" style="font-size: 14px;">Diferencia Final</div>
              <div class="result-amount" style="font-size: 32px; color: ${Math.abs(diff) < 0.01 ? 'var(--success)' : diff < 0 ? 'var(--danger)' : 'var(--warning)'}; border: none; margin-top: 4px;">
                ${Math.abs(diff) < 0.01 ? '$0.00' : formatCurrency(Math.abs(diff))}
                <span style="font-size: 14px; font-weight: normal; margin-left: 8px;">${diff < -0.01 ? '(faltante)' : diff > 0.01 ? '(sobrante)' : ''}</span>
              </div>
            </div>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 16px;">
          ${c.conciliacion_transferencias ? `
            <div class="card" style="padding: 16px; background: var(--bg-tertiary);">
              <h4 style="margin-top: 0; margin-bottom: 16px; font-size: 15px;">📱 Transferencias Conciliadas</h4>
              <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 8px;">
                <span class="text-muted">Sistema (${c.conciliacion_transferencias.cantidad_sistema}):</span>
                <strong>${formatCurrency(c.conciliacion_transferencias.total_sistema)}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 12px;">
                <span class="text-muted">Manual (${c.conciliacion_transferencias.cantidad_ingresadas}):</span>
                <strong>${formatCurrency(c.conciliacion_transferencias.total_ingresadas)}</strong>
              </div>
              <div style="padding: 8px; border-radius: 4px; background: ${Math.abs(c.conciliacion_transferencias.diferencia) < 0.01 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'}; color: ${Math.abs(c.conciliacion_transferencias.diferencia) < 0.01 ? 'var(--success)' : 'var(--danger)'}; text-align: center; font-size: 12px; font-weight: 600;">
                ${Math.abs(c.conciliacion_transferencias.diferencia) < 0.01 ? '✅ Cuadrado' : `⚠️ Diferencia: ${formatCurrency(c.conciliacion_transferencias.diferencia)}`}
              </div>
            </div>
          ` : ''}

          ${apertura.inventario_diario && apertura.inventario_diario.length > 0 ? `
            <div class="card" style="padding: 16px; background: var(--bg-tertiary); flex-grow: 1;">
              <h4 style="margin-top: 0; margin-bottom: 16px; font-size: 15px;">📦 Consumo de Insumos</h4>
              <div style="display: grid; grid-template-columns: 1fr 60px 60px 60px; gap: 8px; font-size: 11px; color: var(--text-muted); margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 4px;">
                <div>INSUMO</div><div>INI</div><div>FIN</div><div>USO</div>
              </div>
              <div style="max-height: 300px; overflow-y: auto;">
                ${apertura.inventario_diario.map(i => `
                  <div style="display: grid; grid-template-columns: 1fr 60px 60px 60px; gap: 8px; font-size: 12px; margin-bottom: 6px;">
                    <div>${i.nombre}</div>
                    <div style="text-align: center;">${i.cantidad_inicial}</div>
                    <div style="text-align: center;">${i.cantidad_final}</div>
                    <div style="text-align: center; font-weight: bold; color: var(--accent-pink);">${i.consumo}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      </div>

      <button class="btn btn-primary btn-lg" style="width: 100%;" id="btn-nueva-jornada">
        ☀️ Abrir Nueva Jornada
      </button>
    </div>
  `;
}

// ========================================
// Init & Event handlers
// ========================================

export function init() {
  const btnAbrir = document.getElementById('btn-abrir-dia');
  if (btnAbrir) {
    btnAbrir.addEventListener('click', async () => {
      const input = document.getElementById('efectivo-inicial');
      const efectivo = parseFloat(input.value) || 0;
      if (efectivo < 0) {
        window.showToast('❌ La cantidad no puede ser negativa', 'error');
        return;
      }
      const inventarioInicial = Array.from(document.querySelectorAll('.inventario-inicial-input')).map(input => ({
        id: Number(input.dataset.id),
        nombre: input.dataset.nombre,
        cantidad: parseInt(input.value) || 0
      }));

      const ap = await db.abrirDia(efectivo, inventarioInicial);
      if (ap) {
        window.showToast('☀️ Día abierto correctamente', 'success');
        if (window.navigateTo) window.navigateTo('cuadre');
      } else {
        window.showToast('⚠️ El día ya fue abierto', 'error');
      }
    });
  }

  db.off('apertura-changed', rerender);
  db.off('sales-changed', rerender);
  db.on('apertura-changed', rerender);
  db.on('sales-changed', rerender);
  db.on('gastos-changed', rerender);
  
  if (document.getElementById('conciliacion-table-container')) {
    renderConciliacionTable();
  }

  const btnAddTransfer = document.getElementById('btn-add-transfer');
  if (btnAddTransfer) {
    btnAddTransfer.addEventListener('click', () => {
      const montoInput = document.getElementById('transfer-monto');
      const refInput = document.getElementById('transfer-ref');
      const monto = parseFloat(montoInput.value);

      if (isNaN(monto) || monto <= 0) {
        window.showToast('❌ Monto inválido', 'error');
        return;
      }

      conciliacionTransferencias.push({
        id: Date.now(),
        numero: conciliacionTransferencias.length + 1,
        monto: db.round2(monto),
        referencia: refInput.value.trim()
      });

      saveTempConciliacion();
      montoInput.value = '';
      refInput.value = '';
      renderConciliacionTable();
    });
  }

  const btnToggleAudit = document.getElementById('btn-toggle-system-audit');
  if (btnToggleAudit) {
    btnToggleAudit.addEventListener('click', () => {
      const details = document.getElementById('system-audit-details');
      const icon = document.getElementById('audit-toggle-icon');
      const text = document.getElementById('audit-toggle-text');
      const isHidden = details.style.display === 'none';
      
      details.style.display = isHidden ? 'grid' : 'none';
      icon.innerHTML = isHidden ? '📖' : '🔍';
      text.innerHTML = isHidden ? 'Ocultar desglose detallado' : 'Ver desglose detallado';
      btnToggleAudit.style.opacity = isHidden ? '1' : '0.8';
    });
  }

  const tableContainer = document.getElementById('conciliacion-table-container');
  if (tableContainer) {
    tableContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-delete-transfer');
      if (btn) {
        const id = parseInt(btn.dataset.id);
        conciliacionTransferencias = conciliacionTransferencias.filter(t => t.id !== id);
        conciliacionTransferencias.forEach((t, i) => t.numero = i + 1);
        saveTempConciliacion();
        renderConciliacionTable();
      }
    });
  }

  const btnCalc = document.getElementById('btn-calcular');
  if (btnCalc) btnCalc.addEventListener('click', calcularDiferencia);

  const btnCerrar = document.getElementById('btn-cerrar-dia');
  if (btnCerrar) btnCerrar.addEventListener('click', handleCerrarDia);

  const btnNuevaJornada = document.getElementById('btn-nueva-jornada');
  if (btnNuevaJornada) {
    btnNuevaJornada.addEventListener('click', () => {
      const container = document.getElementById('page-container');
      if (container) {
        container.innerHTML = renderAperturaForm();
        init();
      }
    });
  }

  // Emergency Re-open (only visible if day is closed)
  const btnReabrir = document.getElementById('btn-reabrir-dia');
  if (btnReabrir) {
    btnReabrir.addEventListener('click', async () => {
      const confirmed = await window.showConfirm({
        icon: '🔄',
        title: '¿Re-abrir jornada?',
        message: 'Esto restaurará el estado "Abierto" para que puedas seguir registrando ventas y gastos hoy.',
        confirmText: 'Sí, re-abrir',
        confirmClass: 'btn-primary'
      });
      
      if (confirmed) {
        const ok = await db.reabrirDia();
        if (ok) {
          window.showToast('☀️ Jornada restaurada', 'success');
          rerender();
        }
      }
    });
  }

  const btnEdit = document.getElementById('btn-edit-efectivo-inicial');
  if (btnEdit) {
    btnEdit.addEventListener('click', async () => {
      const apertura = db.getAperturaHoy();
      const current = apertura.efectivo_inicial;
      const newVal = await window.showPrompt({
        title: '💰 Editar Efectivo Inicial',
        message: 'Ingresa el nuevo monto de efectivo inicial en caja:',
        defaultValue: current,
        confirmText: 'Actualizar',
        type: 'number'
      });
      if (newVal !== null) {
        await db.updateEfectivoInicial(parseFloat(newVal));
        window.showToast('Efectivo inicial actualizado', 'success');
        rerender();
      }
    });
  }
}

function calcularDiferencia() {
  const input = document.getElementById('efectivo-real');
  const efectivoReal = parseFloat(input.value);
  if (isNaN(efectivoReal) || efectivoReal < 0) {
    window.showToast('❌ Ingresa una cantidad válida', 'error');
    return;
  }

  const apertura = db.getAperturaHoy();
  const summary = db.calcDaySummary(db.getSalesForJornada());
  const totalGastos = db.round2(db.getGastosForJornada().reduce((sum, g) => sum + (g.monto || 0), 0));
  const totalEsperado = db.round2(apertura.efectivo_inicial + summary.efectivo - totalGastos);
  const diferencia = db.round2(efectivoReal - totalEsperado);

  const resultEl = document.getElementById('cuadre-result');
  const statusClass = Math.abs(diferencia) < 0.01 ? 'success' : diferencia < 0 ? 'danger' : 'warning';
  const statusIcon = Math.abs(diferencia) < 0.01 ? '✅' : diferencia < 0 ? '❌' : '⚠️';
  const statusMsg = Math.abs(diferencia) < 0.01 ? 'Caja cuadrada correctamente' : diferencia < 0 ? 'Faltante en caja' : 'Sobrante en caja';

  resultEl.innerHTML = `
    <div class="cuadre-result ${statusClass}">
      <div class="result-icon">${statusIcon}</div>
      <div class="result-message">${statusMsg}</div>
      <div class="result-amount" style="color: ${statusClass === 'success' ? 'var(--success)' : statusClass === 'danger' ? 'var(--danger)' : 'var(--warning)'}; border: none;">
        ${Math.abs(diferencia) < 0.01 ? '$0.00' : formatCurrency(Math.abs(diferencia))}
      </div>
      <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
        Esperado: ${formatCurrency(totalEsperado)} | Contado: ${formatCurrency(efectivoReal)}
      </div>
    </div>
  `;

  document.getElementById('btn-cerrar-dia').style.display = 'block';
}

async function handleCerrarDia() {
  const input = document.getElementById('efectivo-real');
  const efectivoReal = parseFloat(input.value);
  const apertura = db.getAperturaHoy();
  const jornadaSales = db.getSalesForJornada();
  const summary = db.calcDaySummary(jornadaSales);
  const totalGastos = db.round2(db.getGastosForJornada().reduce((sum, g) => sum + (g.monto || 0), 0));
  const totalEsperado = db.round2(apertura.efectivo_inicial + summary.efectivo - totalGastos);
  const diferencia = db.round2(efectivoReal - totalEsperado);

  const groupedTransfers = db.groupSalesByCuenta(jornadaSales.filter(s => s.metodo_pago === 'transferencia'));
  const transferenciasCount = groupedTransfers.length;
  const totalIngresadas = db.round2(conciliacionTransferencias.reduce((sum, t) => sum + t.monto, 0));
  const diffTransferencias = db.round2(totalIngresadas - summary.transferencia);

  const cuentasAbiertas = db.getCuentasAbiertas();
  let warningMsg = 'Se guardará el cierre definitivo del día. No se puede deshacer.';
  if (cuentasAbiertas.length > 0) warningMsg = `Hay ${cuentasAbiertas.length} cuenta(s) abierta(s). Se cerrarán como canceladas. <br/>` + warningMsg;
  if (Math.abs(diffTransferencias) > 0.01 || transferenciasCount !== conciliacionTransferencias.length) {
    warningMsg = `⚠️ <b>Atención:</b> Diferencia en conciliación.<br/>` + warningMsg;
  }

  const confirmed = await window.showConfirm({
    icon: '🔒', title: '¿Cerrar el día?', message: warningMsg,
    confirmText: '🔒 Cerrar día', confirmClass: 'btn-primary',
  });
  if (!confirmed) return;

  for (const c of cuentasAbiertas) await db.cancelarCuenta(c.id);

  const dataCierre = {
    total_efectivo_sistema: summary.efectivo, total_tarjeta: summary.tarjeta, total_transferencia: summary.transferencia,
    total_dia: summary.total, total_gastos: totalGastos, total_esperado: totalEsperado, efectivo_real: efectivoReal,
    diferencia: diferencia, num_ventas: summary.count,
    conciliacion_transferencias: {
      cantidad_sistema: transferenciasCount, total_sistema: summary.transferencia,
      cantidad_ingresadas: conciliacionTransferencias.length, total_ingresadas: totalIngresadas,
      diferencia: diffTransferencias, detalle: conciliacionTransferencias,
      sistema_detalles: groupedTransfers.map(g => g.total)
    }
  };

  const inventarioFinal = Array.from(document.querySelectorAll('.inventario-final-input')).map(i => ({
    id: Number(i.dataset.id), nombre: i.dataset.nombre, cantidad: parseInt(i.value) || 0
  }));

  await db.cerrarDia(dataCierre, inventarioFinal);
  conciliacionTransferencias = [];
  localStorage.removeItem(TEMP_CONCILIACION_KEY);
  window.showToast('🔒 Día cerrado correctamente', 'success');
  if (window.navigateTo) window.navigateTo('cuadre');
}

function renderConciliacionTable() {
  const container = document.getElementById('conciliacion-table-container');
  if (!container) return;
  const totalSistemaEl = document.getElementById('conciliacion-total-sistema');
  const countSistema = parseInt(totalSistemaEl.dataset.count);
  const totalSistema = parseFloat(totalSistemaEl.dataset.total);
  const countIngresadas = conciliacionTransferencias.length;
  const totalIngresadas = db.round2(conciliacionTransferencias.reduce((sum, t) => sum + t.monto, 0));
  const diferencia = db.round2(totalIngresadas - totalSistema);

  container.innerHTML = `
    ${conciliacionTransferencias.length > 0 ? `
      <div class="table-container" style="background: rgba(0,0,0,0.1); max-height: 200px; overflow-y: auto; margin-bottom: 12px;">
        <table style="font-size: 13px;">
          <thead style="position: sticky; top: 0; background: var(--bg-tertiary);">
            <tr><th>#</th><th>Valor</th><th>Ref</th><th></th></tr>
          </thead>
          <tbody>
            ${conciliacionTransferencias.map(t => `
              <tr>
                <td style="text-align: center; color: var(--text-muted);">${t.numero}</td>
                <td style="font-weight: 600;">${formatCurrency(t.monto)}</td>
                <td style="font-size: 12px;">${t.referencia || '-'}</td>
                <td style="text-align: right;"><button class="btn btn-ghost btn-sm btn-delete-transfer" data-id="${t.id}" style="color: var(--danger);">🗑️</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : '<div style="text-align: center; padding: 12px; color: var(--text-muted); font-size: 13px;">Sin transferencias manuales</div>'}
    <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: 8px;">
      <div style="font-size: 14px; font-weight: 600; color: ${countIngresadas === countSistema && Math.abs(diferencia) < 0.01 ? 'var(--success)' : 'var(--text-primary)'};">
        ${formatCurrency(totalIngresadas)} (${countIngresadas}/${countSistema})
      </div>
    </div>
  `;
}

function rerender() {
  const container = document.getElementById('page-container');
  if (container) {
    container.innerHTML = render();
    init();
  }
}

export function cleanup() {
  db.off('apertura-changed', rerender);
  db.off('sales-changed', rerender);
  db.off('gastos-changed', rerender);
}
