// ========================================
// 🍦 Heladería POS - Gastos + Suministros
// ========================================

import * as db from '../db.js';
import { formatCurrency } from '../main.js';

let activeTab = 'gastos'; // 'gastos' | 'suministros'
let editingInsumoId = null;

export function render() {
  return `
    <div class="page-header">
      <h2>💸 Gastos & 📦 Suministros</h2>
      <p>Controla los egresos operativos y el catálogo de inventario</p>
    </div>

    <!-- Tab Switcher -->
    <div class="tab-switcher" id="gastos-tabs">
      <button class="tab-btn ${activeTab === 'gastos' ? 'active' : ''}" data-tab="gastos">
        💸 Gastos
      </button>
      <button class="tab-btn ${activeTab === 'suministros' ? 'active' : ''}" data-tab="suministros">
        📦 Suministros
      </button>
    </div>

    <div id="tab-content">
      ${activeTab === 'gastos' ? renderGastosTab() : renderSuministrosTab()}
    </div>
  `;
}

function renderGastosTab() {
  // Ahora solo mostramos los gastos exclusivos del día actual (sesión abierta)
  const gastos = db.getGastosForJornada().slice().sort((a, b) => b.timestamp - a.timestamp);
  const summary = db.getGastosSummary();
  const isAbierto = db.isDiaAbierto();

  return `
    <div style="max-width: 900px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 24px;">
      
      <!-- New Gasto Form -->
      <div class="card" style="padding: 24px;">
        <h3 style="margin-top: 0; margin-bottom: 20px; font-size: 18px;">➕ Registrar Gasto</h3>
        
        <div class="form-group">
          <label class="form-label">Descripción del Gasto</label>
          <input type="text" id="gasto-desc" class="form-input" placeholder="Ej: Compra de leche, Pago luz..." maxlength="50" ${!isAbierto ? 'disabled' : ''} />
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Monto ($)</label>
            <input type="number" id="gasto-monto" class="form-input" placeholder="0.00" step="0.01" min="0.01" ${!isAbierto ? 'disabled' : ''} />
          </div>
          <div class="form-group">
            <label class="form-label">Categoría</label>
            <select id="gasto-cat" class="form-input" ${!isAbierto ? 'disabled' : ''}>
              <option value="Insumos">Insumos</option>
              <option value="Servicios">Servicios</option>
              <option value="Personal">Personal</option>
              <option value="Mantenimiento">Mantenimiento</option>
              <option value="Otros">Otros</option>
            </select>
          </div>
        </div>

        ${!isAbierto ? `
          <div style="background: rgba(239, 68, 68, 0.1); color: var(--danger); padding: 12px; border-radius: 8px; font-size: 13px; margin-bottom: 16px; border: 1px solid rgba(239, 68, 68, 0.2); text-align: center; font-weight: 600;">
            ⚠️ El día está cerrado. Abre la caja para registrar gastos.
          </div>
        ` : ''}

        <button class="btn btn-primary btn-lg" id="btn-save-gasto" style="width: 100%; margin-top: 8px;" ${!isAbierto ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>
          💾 Guardar Gasto
        </button>
      </div>

      <!-- Summary Stats -->
      <div style="display: flex; flex-direction: column; gap: 24px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <div class="stat-card" style="padding: 16px; text-align: center; background: rgba(255, 107, 157, 0.1); border: 1px solid rgba(255, 107, 157, 0.2);">
            <div class="stat-desc" style="font-size: 11px; text-transform: uppercase; color: var(--accent-pink);">Gastos Hoy (Sesión)</div>
            <div class="stat-number" style="font-size: 24px; margin-top: 4px; color: #fff;">${formatCurrency(summary.daily)}</div>
          </div>
          <div class="stat-card" style="padding: 16px; text-align: center; background: rgba(107, 217, 255, 0.1); border: 1px solid rgba(107, 217, 255, 0.2);">
            <div class="stat-desc" style="font-size: 11px; text-transform: uppercase; color: #6bd9ff;">Gastos de la Semana</div>
            <div class="stat-number" style="font-size: 24px; margin-top: 4px; color: #fff;">${formatCurrency(summary.weekly)}</div>
          </div>
        </div>

        <div class="stat-card lavender" style="padding: 24px; text-align: center;">
          <div class="stat-desc" style="font-size: 12px; text-transform: uppercase;">Total Gastos Históricos</div>
          <div class="stat-number" style="font-size: 32px; margin-top: 4px;">${formatCurrency(summary.total)}</div>
        </div>

        <div class="card" style="padding: 20px; flex-grow: 1;">
          <h3 style="margin-top: 0; margin-bottom: 16px; font-size: 16px;">📋 Últimos Gastos</h3>
          
          <div class="table-container" style="border: none; max-height: 400px; overflow-y: auto;">
            ${gastos.length === 0 ? `
              <div style="text-align: center; color: var(--text-muted); padding: 40px 0;">
                <p>No hay gastos registrados aún</p>
              </div>
            ` : `
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Concepto</th>
                    <th style="text-align: right;">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  ${gastos.slice(0, 10).map(g => `
                    <tr>
                      <td style="font-size: 12px; color: var(--text-muted);">${g.fecha}</td>
                      <td>
                        <div style="font-weight: 500;">${g.descripcion}</div>
                        <div style="font-size: 10px; opacity: 0.6;">${g.categoria}</div>
                      </td>
                      <td style="text-align: right; font-weight: 700; color: var(--danger);">${formatCurrency(g.monto)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderSuministrosTab() {
  const insumos = db.getInsumos().sort((a, b) => (a.id || 0) - (b.id || 0));

  return `
    <div class="suministros-layout">
      <!-- Add New Suministro -->
      <div class="card suministros-add-card">
        <h3>➕ Agregar Suministro</h3>
        <div class="suministros-add-row">
          <input 
            type="text" 
            id="new-insumo-name" 
            class="form-input" 
            placeholder="Nombre del suministro..." 
            maxlength="50"
          />
          <button class="btn btn-primary" id="btn-add-insumo">
            ➕ Agregar
          </button>
        </div>
        <p class="suministros-hint">
          💡 Los suministros aparecerán en la pantalla de apertura del día para registrar el inventario inicial.
        </p>
      </div>

      <!-- Suministros Table -->
      <div class="card suministros-table-card">
        <div class="suministros-table-header">
          <h3>📦 Suministros del Inventario</h3>
          <span class="suministros-count">${insumos.length} items</span>
        </div>

        <div class="suministros-list">
          ${insumos.length === 0 ? `
            <div class="suministros-empty">
              <span>No hay suministros registrados</span>
            </div>
          ` : insumos.map(ins => `
            <div class="suministro-row ${ins.activo === false ? 'inactivo' : ''}" data-id="${ins.firestoreId || ins.id}">
              ${editingInsumoId === (ins.firestoreId || ins.id) ? `
                <input 
                  type="text" 
                  class="form-input suministro-edit-input" 
                  value="${ins.nombre}" 
                  id="edit-input-${ins.firestoreId || ins.id}"
                  autofocus
                />
                <div class="suministro-actions">
                  <button class="suministro-btn btn-save-edit" 
                    data-id="${ins.firestoreId || ins.id}" 
                    data-action="save-insumo">
                    💾 Guardar
                  </button>
                  <button class="suministro-btn btn-cancel-edit" data-action="cancel-edit">
                    ✕
                  </button>
                </div>
              ` : `
                <div class="suministro-info">
                  <span class="suministro-num">${ins.id || '—'}</span>
                  <span class="suministro-name">${ins.nombre}</span>
                  ${ins.activo === false ? '<span class="inactivo-badge">Inactivo</span>' : ''}
                </div>
                <div class="suministro-actions">
                  <button class="suministro-btn btn-toggle-active ${ins.activo === false ? 'off' : 'on'}"
                    data-id="${ins.firestoreId || ins.id}"
                    data-numeric-id="${ins.id}"
                    data-action="toggle-insumo"
                    title="${ins.activo === false ? 'Activar' : 'Desactivar'}">
                    ${ins.activo === false ? '🔴' : '🟢'}
                  </button>
                  <button class="suministro-btn btn-edit-insumo"
                    data-id="${ins.firestoreId || ins.id}"
                    data-action="edit-insumo"
                    title="Editar nombre">
                    ✏️
                  </button>
                  <button class="suministro-btn btn-delete-insumo"
                    data-id="${ins.firestoreId || ins.id}"
                    data-numeric-id="${ins.id}"
                    data-action="delete-insumo"
                    title="Eliminar">
                    🗑️
                  </button>
                </div>
              `}
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

export function init() {
  const container = document.getElementById('page-container');
  if (!container) return;

  // Tab switching
  container.addEventListener('click', handleClick);
  container.addEventListener('keydown', handleKeydown);

  // Gastos save button
  const btnSave = document.getElementById('btn-save-gasto');
  if (btnSave) {
    btnSave.addEventListener('click', handleSaveGasto);
  }

  // Sync listeners
  db.on('gastos-changed', rerender);
  db.on('insumos-changed', rerender);
}

async function handleSaveGasto() {
  if (!db.isDiaAbierto()) {
    window.showToast('⚠️ No se pueden registrar gastos con el día cerrado', 'error');
    return;
  }
  const descInput = document.getElementById('gasto-desc');
  const montoInput = document.getElementById('gasto-monto');
  const catInput = document.getElementById('gasto-cat');

  const descripcion = descInput.value.trim();
  const monto = parseFloat(montoInput.value);
  const categoria = catInput.value;

  if (!descripcion || isNaN(monto) || monto <= 0) {
    window.showToast('❌ Ingresa una descripción y un monto válido', 'error');
    return;
  }

  const confirmed = await window.showConfirm({
    icon: '💸',
    title: '¿Registrar este gasto?',
    message: `Se descontará <b>${formatCurrency(monto)}</b> de los balances globales.`,
    details: `<div style="text-align:center; padding: 10px; background: rgba(0,0,0,0.05); border-radius: 8px;"><b>${descripcion}</b> (${categoria})</div>`,
    confirmText: '💸 Registrar Gasto',
    confirmClass: 'btn-danger'
  });

  if (!confirmed) return;

  const result = await db.addGasto({ descripcion, monto, categoria });
  if (result) {
    window.showToast('✅ Gasto registrado correctamente', 'success');
    rerender();
  }
}

async function handleClick(e) {
  const target = e.target.closest('[data-action], [data-tab], #btn-add-insumo');
  if (!target) return;

  // Tab switching
  const tab = target.dataset.tab;
  if (tab) {
    activeTab = tab;
    editingInsumoId = null;
    rerender();
    return;
  }

  const action = target.dataset.action;
  const id = target.dataset.id;
  const numericId = parseInt(target.dataset.numericId);

  // Add new insumo
  if (target.id === 'btn-add-insumo' || action === 'add-insumo') {
    const input = document.getElementById('new-insumo-name');
    const nombre = input?.value?.trim();
    if (!nombre) {
      window.showToast('❌ Escribe el nombre del suministro', 'error');
      return;
    }
    await db.addInsumo(nombre);
    window.showToast(`✅ "${nombre}" agregado al inventario`, 'success');
    return;
  }

  // Toggle activo
  if (action === 'toggle-insumo') {
    const current = db.getInsumos().find(i => i.firestoreId === id || String(i.id) === String(numericId));
    if (!current) return;
    const newActivo = current.activo === false ? true : false;
    await db.updateInsumo(numericId || id, { activo: newActivo });
    window.showToast(newActivo ? '✅ Suministro activado' : '🔴 Suministro desactivado', 'info');
    return;
  }

  // Start editing
  if (action === 'edit-insumo') {
    editingInsumoId = id;
    rerender();
    const input = document.getElementById(`edit-input-${id}`);
    if (input) { input.focus(); input.select(); }
    return;
  }

  // Save edit
  if (action === 'save-insumo') {
    const input = document.getElementById(`edit-input-${id}`);
    const nombre = input?.value?.trim();
    if (!nombre) {
      window.showToast('❌ El nombre no puede estar vacío', 'error');
      return;
    }
    const ins = db.getInsumos().find(i => i.firestoreId === id || String(i.id) === String(id));
    await db.updateInsumo(ins?.id || id, { nombre });
    editingInsumoId = null;
    window.showToast('✅ Suministro actualizado', 'success');
    return;
  }

  // Cancel edit
  if (action === 'cancel-edit') {
    editingInsumoId = null;
    rerender();
    return;
  }

  // Delete insumo
  if (action === 'delete-insumo') {
    const ins = db.getInsumos().find(i => i.firestoreId === id || String(i.id) === String(numericId));
    const confirmed = await window.showConfirm({
      icon: '🗑️',
      title: '¿Eliminar suministro?',
      message: `Se eliminará permanentemente <b>${ins?.nombre || 'este suministro'}</b>.`,
      confirmText: '🗑️ Eliminar',
      confirmClass: 'btn-danger'
    });
    if (!confirmed) return;
    await db.deleteInsumo(ins?.id || numericId || id);
    window.showToast('🗑️ Suministro eliminado', 'error');
    return;
  }
}

function handleKeydown(e) {
  if (e.key === 'Enter') {
    // Enter in new insumo input → add
    if (e.target.id === 'new-insumo-name') {
      document.getElementById('btn-add-insumo')?.click();
    }
    // Enter in edit input → save
    if (e.target.classList.contains('suministro-edit-input')) {
      const id = editingInsumoId;
      const input = document.getElementById(`edit-input-${id}`);
      const nombre = input?.value?.trim();
      if (nombre) {
        const ins = db.getInsumos().find(i => i.firestoreId === id || String(i.id) === String(id));
        db.updateInsumo(ins?.id || id, { nombre }).then(() => {
          editingInsumoId = null;
          rerender();
          window.showToast('✅ Suministro actualizado', 'success');
        });
      }
    }
    // Enter in gasto description → move to monto
    if (e.target.id === 'gasto-desc') {
      document.getElementById('gasto-monto')?.focus();
    }
  }
  if (e.key === 'Escape' && editingInsumoId) {
    editingInsumoId = null;
    rerender();
  }
}

function rerender() {
  const container = document.getElementById('page-container');
  if (container) {
    container.innerHTML = render();
    init();
  }
}

export function cleanup() {
  db.off('gastos-changed', rerender);
  db.off('insumos-changed', rerender);
  editingInsumoId = null;
}
