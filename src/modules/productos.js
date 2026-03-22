// ========================================
// 🍦 Heladería POS - Productos Module
// Product CRUD management
// ========================================

import * as db from '../db.js';
import { formatCurrency } from '../main.js';

// Dynamic categories from DB
const EMOJIS = ['🍦', '🍨', '🍧', '🥤', '🧋', '🧇', '🏆', '🎂', '🍰', '🧁', '🍫', '🍬', '🍭', '☕', '🥛', '🫐', '🍓', '🍌'];

let activeCategory = 'WAFFLES';
let searchQuery = '';
let statusFilter = 'active'; // all, active, inactive
let editingId = null;
let showConfigPanel = false;
let showCategoryModal = false;
let showOpcionesModal = false;
let currentOpcionesTab = 'sabor'; // 'sabor', 'cobertura', 'topping', 'extra', 'nota'

export function render() {
  const products = db.getProducts();
  const filteredProducts = products.filter(p => {
    const isSearching = searchQuery.trim().length > 0;
    const matchesCat = isSearching ? true : p.categoria === activeCategory;
    const matchesSearch = p.nombre.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && p.activo) || 
                         (statusFilter === 'inactive' && !p.activo);
    return matchesCat && matchesSearch && matchesStatus;
  });

  const categories = db.getCategories();
  const categoryCounts = categories.reduce((acc, cat) => {
    acc[cat.nombre] = products.filter(p => p.categoria === cat.nombre).length;
    return acc;
  }, {});

  return `
    <div class="page-header" style="display:flex; justify-content:space-between; align-items:center;">
      <div>
        <h2>⚙️ Gestión de Catálogo</h2>
        <p>Configura productos, ingredientes y límites por categoría</p>
      </div>
      <div style="display:flex; gap: 8px;">
        <button class="btn btn-secondary" id="btn-import-catalog" style="background: rgba(255,255,255,0.1); color: var(--text-primary); border: 1px solid rgba(255,255,255,0.2);">
          <span>📥</span> Importar
        </button>
        <button class="btn btn-secondary" id="btn-export-catalog" style="background: rgba(255,255,255,0.1); color: var(--text-primary); border: 1px solid rgba(255,255,255,0.2);">
          <span>📤</span> Exportar
        </button>
        <button class="btn btn-primary" id="btn-add-product">
          ➕ Nuevo Producto
        </button>
      </div>
    </div>

    <div class="admin-layout">
      <!-- Nivel 1: Categorías -->
      <div class="admin-sidebar">
        <div style="padding: 0 8px 12px 8px; border-bottom: 1px solid rgba(255,255,255,0.05); margin-bottom: 12px; display:flex; flex-direction:column; gap:8px;">
          <button class="btn btn-ghost btn-sm w-100" id="btn-manage-cats" style="width:100%; justify-content: center; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">
            ⚙️ Categorías
          </button>
          <button class="btn btn-ghost btn-sm w-100" id="btn-manage-opts" style="width:100%; justify-content: center; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: var(--accent-mint);">
            🍧 Opciones Extra
          </button>
        </div>
        ${categories.map(cat => `
          <button class="admin-cat-btn ${activeCategory === cat.nombre ? 'active' : ''}" data-cat="${cat.nombre}">
            <span>${cat.nombre}</span>
            <span class="admin-cat-count">${categoryCounts[cat.nombre] || 0}</span>
          </button>
        `).join('')}
      </div>

      <!-- Nivel 2: Lista de Productos -->
      <div class="admin-main">
        <div class="admin-toolbar">
          <div class="search-wrapper">
            <span class="search-icon">🔍</span>
            <input type="text" class="admin-search" id="admin-search" placeholder="Buscar por nombre..." value="${searchQuery}" />
          </div>
          <select class="form-select" id="status-filter" style="width: 150px;">
            <option value="all" ${statusFilter === 'all' ? 'selected' : ''}>Todos</option>
            <option value="active" ${statusFilter === 'active' ? 'selected' : ''}>Activos</option>
            <option value="inactive" ${statusFilter === 'inactive' ? 'selected' : ''}>Inactivos</option>
          </select>
        </div>

        <div class="admin-grid">
          ${filteredProducts.length === 0 ? `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px; color: var(--text-muted);">
              <h3>No se encontraron productos</h3>
              <p>Cambia el filtro o añade un producto nuevo</p>
            </div>
          ` : filteredProducts.map(p => `
            <div class="admin-product-card ${!p.activo ? 'inactive' : ''}">
              <div class="card-top">
                <div class="card-emoji">${p.emoji || '🍦'}</div>
                <div class="card-info">
                  <div class="card-title">${p.nombre}</div>
                  <div class="card-price">${formatCurrency(p.precio)}</div>
                </div>
                <label class="toggle-switch">
                  <input type="checkbox" ${p.activo ? 'checked' : ''} data-toggle-id="${p.id}" />
                  <span class="toggle-slider"></span>
                </label>
              </div>
              
              <div style="font-size: 11px; color: var(--text-secondary); background: rgba(0,0,0,0.2); padding: 8px; border-radius: 6px;">
                ${p.opciones ? `
                  ⚙️ ${p.opciones.sabores?.max || 0} Sabores · 
                  ${p.opciones.toppings?.max || 0} Toppings · 
                  ${p.opciones.coberturas?.max || 0} Coberturas
                ` : 'Configuración estándar'}
              </div>

              <div class="card-actions">
                <button class="btn btn-ghost btn-sm" data-edit-id="${p.id}">✏️ Editar</button>
                <button class="btn btn-ghost btn-sm" data-delete-id="${p.id}" style="color: var(--danger);">🗑️</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- Capa de fondo para el panel de configuración -->
    <div class="admin-overlay ${showConfigPanel ? 'visible' : ''}" id="admin-overlay"></div>
    
    <div class="config-side-panel ${showConfigPanel ? 'open' : ''}" id="config-panel">
      ${renderConfigPanelContent()}
    </div>

    <!-- Nivel 4: Modal de Gestión de Categorías -->
    ${showCategoryModal ? renderCategoryModal() : ''}

    <!-- Nivel 5: Modal de Gestión de Opciones -->
    ${showOpcionesModal ? renderOpcionesModal() : ''}
  `;
}

function renderOpcionesModal() {
  const opciones = db.getOpcionesColeccion().filter(o => o.tipo === currentOpcionesTab);
  
  const tabs = [
    { id: 'sabor', label: '🍧 Sabores' },
    { id: 'cobertura', label: '🍯 Coberturas' },
    { id: 'topping', label: '🍬 Toppings' },
    { id: 'extra', label: '➕ Extras' },
    { id: 'nota', label: '📝 Notas' }
  ];

  return `
    <div class="modal-overlay" id="opt-modal-overlay">
      <div class="modal" style="max-width: 600px; width: 95%;">
        <div class="modal-header">
          <h2>🍧 Gestionar Opciones</h2>
          <button class="modal-close" id="btn-close-opt-modal">&times;</button>
        </div>
        
        <div style="display:flex; gap:8px; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px; overflow-x: auto;">
          ${tabs.map(t => `
            <button class="btn btn-sm ${currentOpcionesTab === t.id ? 'btn-primary' : 'btn-ghost'} opt-tab-btn" data-tab="${t.id}" style="white-space: nowrap;">
              ${t.label}
            </button>
          `).join('')}
        </div>

        <div style="margin-bottom: 16px; background: rgba(0,0,0,0.3); padding: 12px 16px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.08);">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
            <span style="font-size:18px;">💰</span>
            <div style="font-weight:700; font-size:13px;">Precios por opción extra</div>
          </div>
          <div style="display:flex; gap:12px; flex-wrap:wrap;">
            <div style="display:flex; align-items:center; gap:6px; background:rgba(0,0,0,0.2); padding:8px 12px; border-radius:8px; flex:1; min-width:140px;">
              <span style="font-size:12px;">🍧 Sabor</span>
              <span style="color:var(--accent-mint); font-weight:800;">$</span>
              <input type="number" id="precio-extra-sabores" class="form-input" value="${db.getPrecioExtraPorTipo('sabores').toFixed(2)}" step="0.05" min="0" style="width:65px; text-align:center; font-weight:800; font-size:14px; color:var(--accent-mint); background:rgba(0,0,0,0.3); border-radius:6px; padding:6px;" />
            </div>
            <div style="display:flex; align-items:center; gap:6px; background:rgba(0,0,0,0.2); padding:8px 12px; border-radius:8px; flex:1; min-width:140px;">
              <span style="font-size:12px;">🍯 Cobert.</span>
              <span style="color:var(--accent-mint); font-weight:800;">$</span>
              <input type="number" id="precio-extra-coberturas" class="form-input" value="${db.getPrecioExtraPorTipo('coberturas').toFixed(2)}" step="0.05" min="0" style="width:65px; text-align:center; font-weight:800; font-size:14px; color:var(--accent-mint); background:rgba(0,0,0,0.3); border-radius:6px; padding:6px;" />
            </div>
            <div style="display:flex; align-items:center; gap:6px; background:rgba(0,0,0,0.2); padding:8px 12px; border-radius:8px; flex:1; min-width:140px;">
              <span style="font-size:12px;">🍬 Topping</span>
              <span style="color:var(--accent-mint); font-weight:800;">$</span>
              <input type="number" id="precio-extra-toppings" class="form-input" value="${db.getPrecioExtraPorTipo('toppings').toFixed(2)}" step="0.05" min="0" style="width:65px; text-align:center; font-weight:800; font-size:14px; color:var(--accent-mint); background:rgba(0,0,0,0.3); border-radius:6px; padding:6px;" />
            </div>
          </div>
          <button class="btn btn-primary btn-sm" id="btn-save-precios-extra" style="margin-top:10px; width:100%;">💾 Guardar Precios</button>
        </div>

        <div style="margin-bottom: 20px; display:flex; gap: 8px;">
          <input type="text" id="new-opt-name" class="form-input" placeholder="Nombre de la nueva opción..." style="text-transform: uppercase;">
          ${currentOpcionesTab === 'extra' ? `
            <input type="number" id="new-opt-price" class="form-input" placeholder="Precio ($)" style="width: 100px;" step="0.05" min="0">
          ` : ''}
          <button class="btn btn-primary" id="btn-add-opt">Añadir</button>
        </div>

        <div style="max-height: 350px; overflow-y: auto; background: rgba(0,0,0,0.2); border-radius: 8px; padding: 8px;">
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="text-align: left; font-size: 11px; text-transform: uppercase; color: var(--text-muted);">
                <th style="padding: 8px;">Nombre</th>
                ${currentOpcionesTab === 'extra' ? '<th style="padding: 8px; width: 80px;">Precio</th>' : ''}
                <th style="padding: 8px; text-align: center; width: 60px;">Activo</th>
                <th style="padding: 8px; text-align: right; width: 90px;">Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${opciones.map(opt => `
                <tr style="border-top: 1px solid rgba(255,255,255,0.05); ${!opt.activo ? 'opacity: 0.5;' : ''}">
                  <td style="padding: 10px;">
                    <input type="text" class="form-input opt-input-name" data-id="${opt.id}" value="${opt.nombre}" style="background: transparent; border: none; padding: 4px; text-transform: uppercase;" />
                  </td>
                  ${currentOpcionesTab === 'extra' ? `
                    <td style="padding: 10px;">
                      <input type="number" class="form-input opt-input-price" data-id="${opt.id}" value="${opt.precio || 0}" step="0.05" style="background: transparent; border: none; padding: 4px; width: 70px;" />
                    </td>
                  ` : ''}
                  <td style="padding: 10px; text-align: center;">
                    <label class="toggle-switch" style="transform: scale(0.7); margin: 0;">
                      <input type="checkbox" class="opt-toggle-active" data-id="${opt.id}" ${opt.activo ? 'checked' : ''} />
                      <span class="toggle-slider"></span>
                    </label>
                  </td>
                  <td style="padding: 10px; text-align: right;">
                    <button class="btn btn-ghost btn-sm btn-save-opt" data-id="${opt.id}" title="Guardar cambios" style="padding: 4px;">💾</button>
                    <button class="btn btn-ghost btn-sm btn-delete-opt" data-id="${opt.id}" style="color: var(--danger); padding: 4px;" title="Eliminar">🗑️</button>
                  </td>
                </tr>
              `).join('')}
              ${opciones.length === 0 ? `<tr><td colspan="4" style="padding: 20px; text-align: center; color: var(--text-muted);">No hay opciones registradas</td></tr>` : ''}
            </tbody>
          </table>
        </div>

        <div class="modal-footer" style="margin-top: 20px; display: flex; justify-content: flex-end;">
          <button class="btn btn-secondary" id="btn-finish-opts">Cerrar</button>
        </div>
      </div>
    </div>
  `;
}

function renderCategoryModal() {
  const categories = db.getCategories();
  return `
    <div class="modal-overlay" id="cat-modal-overlay">
      <div class="modal" style="max-width: 600px; width: 95%;">
        <div class="modal-header">
          <h2>📁 Gestionar Categorías</h2>
          <button class="modal-close" id="btn-close-cat-modal">&times;</button>
        </div>
        
        <div style="margin-bottom: 20px; display:flex; gap: 8px;">
          <input type="text" id="new-cat-name" class="form-input" placeholder="Nombre de la nueva categoría..." style="text-transform: uppercase;">
          <button class="btn btn-primary" id="btn-add-cat">Añadir</button>
        </div>

        <div style="max-height: 350px; overflow-y: auto; background: rgba(0,0,0,0.2); border-radius: 8px; padding: 8px;">
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="text-align: left; font-size: 11px; text-transform: uppercase; color: var(--text-muted);">
                <th style="padding: 8px;">Nombre</th>
                <th style="padding: 8px; text-align: right; width: 90px;">Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${categories.map(cat => `
                <tr style="border-top: 1px solid rgba(255,255,255,0.05);">
                  <td style="padding: 10px;">
                    <input type="text" class="form-input cat-input-edit" data-id="${cat.id}" value="${cat.nombre}" style="background: transparent; border: none; padding: 4px; text-transform: uppercase;" />
                  </td>
                  <td style="padding: 10px; text-align: right;">
                    <button class="btn btn-ghost btn-sm btn-save-cat" data-id="${cat.id}" title="Guardar cambios" style="padding: 4px;">💾</button>
                    <button class="btn btn-ghost btn-sm btn-delete-cat" data-id="${cat.id}" style="color: var(--danger); padding: 4px;" title="Eliminar">🗑️</button>
                  </td>
                </tr>
              `).join('')}
              ${categories.length === 0 ? `<tr><td colspan="2" style="padding: 20px; text-align: center; color: var(--text-muted);">No hay categorías registradas</td></tr>` : ''}
            </tbody>
          </table>
        </div>
        
        <div style="margin-top: 20px; font-size: 12px; color: var(--text-muted); background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05); padding: 10px; border-radius: 6px;">
          ℹ️ Al renombrar una categoría, todos sus productos se actualizarán automáticamente.
        </div>

        <div class="modal-footer" style="margin-top: 20px; display: flex; justify-content: flex-end;">
          <button class="btn btn-secondary" id="btn-finish-cats">Cerrar</button>
        </div>
      </div>
    </div>
  `;
}

function renderConfigPanelContent() {
  if (editingId === null) return '';
  
  const isNew = editingId === -1;
  const p = isNew ? {
    nombre: '',
    precio: 0,
    categoria: activeCategory,
    emoji: '🍦',
    activo: true,
    opciones: { sabores: {min:0, max:0}, toppings: {min:0, max:0}, coberturas: {min:0, max:0}, extras: [], incluye_desc: '' }
  } : db.getProductById(editingId);

  if (!p) return '';

  return `
    <div class="config-panel-header">
      <div style="display:flex; align-items:center; gap: 12px;">
        <span style="font-size: 32px;">${p.emoji || '🍦'}</span>
        <div>
          <h3 style="margin:0;">Configurar</h3>
          <p style="margin:0; font-size: 13px; color: var(--text-muted);">${p.nombre}</p>
        </div>
      </div>
      <button class="modal-close" id="btn-close-config">&times;</button>
    </div>

    <div class="config-panel-body">
      <!-- Datos Básicos -->
      <!-- Datos Básicos -->
      <div class="config-group" style="position:relative; overflow:visible;">
        <label class="config-label">📝 Datos Generales</label>
        
        <div style="display:flex; flex-wrap: wrap; gap: 12px; margin-top: 12px; width: 100%; align-items: flex-end; position: relative; z-index: 5;">
          <div style="width: 80px;">
            <label style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 6px;">Emoji</label>
            <input type="text" id="config-emoji" class="form-input" value="${p.emoji || '🍦'}" style="text-align: center; font-size: 24px; padding: 8px; border-radius: 12px; background: rgba(0,0,0,0.2); margin:0;" />
          </div>
          
          <div style="flex: 1; min-width: 150px;">
            <label style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 6px;">Nombre del Producto</label>
            <input type="text" id="config-name" class="form-input" value="${p.nombre}" placeholder="Ej: Waffle Tradicional" style="font-size: 14px; padding: 12px; margin:0;" />
          </div>
          
          <div style="width: 100px;">
            <label style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 6px;">Precio ($)</label>
            <input type="number" id="config-price" class="form-input" value="${p.precio}" step="0.01" style="font-size: 15px; font-weight: bold; color: var(--accent-mint); text-align: center; padding: 12px; margin:0;" />
          </div>
        </div>

        <div style="position:absolute; top:-20px; right:-10px; font-size:90px; opacity:0.04; pointer-events:none; z-index: 1;">${p.emoji || '🍦'}</div>
      </div>

      <!-- Gestión de Sabores -->
      <div class="config-group">
        <div class="config-label-row">
          <label class="config-label">🍨 Límite de Sabores</label>
          <span class="config-badge">${db.SABORES_HELADO.length} Sabores activos</span>
        </div>
        <p style="font-size: 11px; color: var(--text-muted); margin-top: -4px;">Configura cuántos sabores puede elegir el cliente.</p>
        <div class="config-limits">
          <div class="limit-input-group">
            <label>Mínimo obligatorio</label>
            <input type="number" id="limit-sabores-min" class="limit-field" value="${p.opciones?.sabores?.min || 0}" min="0" />
          </div>
          <div class="limit-input-group">
            <label>Máximo permitido</label>
            <input type="number" id="limit-sabores-max" class="limit-field" value="${p.opciones?.sabores?.max || 0}" min="0" />
          </div>
        </div>
      </div>

      <!-- Gestión de Coberturas -->
      <div class="config-group">
        <div class="config-label-row">
          <label class="config-label">🍯 Límite de Coberturas</label>
          <span class="config-badge">${db.COBERTURAS_LIQUIDAS.length} Coberturas activas</span>
        </div>
        <p style="font-size: 11px; color: var(--text-muted); margin-top: -4px;">Configura cuántas coberturas líquidas incluye.</p>
        <div class="config-limits">
          <div class="limit-input-group">
            <label>Mínimo obligatorio</label>
            <input type="number" id="limit-coberturas-min" class="limit-field" value="${p.opciones?.coberturas?.min || 0}" min="0" />
          </div>
          <div class="limit-input-group">
            <label>Máximo permitido</label>
            <input type="number" id="limit-coberturas-max" class="limit-field" value="${p.opciones?.coberturas?.max || 0}" min="0" />
          </div>
        </div>
      </div>

      <!-- Gestión de Toppings -->
      <div class="config-group">
        <div class="config-label-row">
          <label class="config-label">🍬 Límite de Toppings</label>
          <span class="config-badge">${db.TOPPINGS.length} Toppings activos</span>
        </div>
        <p style="font-size: 11px; color: var(--text-muted); margin-top: -4px;">Configura la variedad de toppings secos a incluir.</p>
        <div class="config-limits">
          <div class="limit-input-group">
            <label>Mínimo obligatorio</label>
            <input type="number" id="limit-toppings-min" class="limit-field" value="${p.opciones?.toppings?.min || 0}" min="0" />
          </div>
          <div class="limit-input-group">
            <label>Máximo permitido</label>
            <input type="number" id="limit-toppings-max" class="limit-field" value="${p.opciones?.toppings?.max || 0}" min="0" />
          </div>
        </div>
      </div>

      <!-- Gestión de Extras -->
      <div class="config-group">
        <label class="config-label">➕ Extras Automáticos</label>
        <p style="font-size: 11px; color: var(--text-muted); margin-top: -4px;">Elige qué extras de pago se sugieren para este producto.</p>
        <div class="config-item-list">
          ${db.EXTRAS.map(ex => {
            const isEnabled = p.opciones?.extras?.includes(ex.nombre);
            return `
              <label class="config-chip" style="display:flex; align-items:center; gap:8px; cursor:pointer; transition: 0.2s ease; ${isEnabled ? 'background:var(--accent-pink-glow); border-color:var(--accent-pink); color: #fff;' : 'background: rgba(0,0,0,0.2);'}">
                <input type="checkbox" class="extra-check" data-extra="${ex.nombre}" ${isEnabled ? 'checked' : ''} style="accent-color: var(--accent-pink); transform: scale(1.2);" />
                <span>${ex.nombre} <b style="color:var(--accent-mint);">(+$${ex.precio.toFixed(2)})</b></span>
              </label>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Notas y Detalles -->
      <div class="config-group">
        <label class="config-label">📝 Descripción del Producto</label>
        <p style="font-size: 11px; color: var(--text-muted); margin-top: -4px;">¿Qué ingredientes incluye por defecto? (Se mostrará en cocina).</p>
        <textarea id="config-desc" class="form-input" style="height: 60px; font-size: 13px; resize: none; border-radius: 8px;">${p.opciones?.incluye_desc || ''}</textarea>
      </div>
    </div>

    <div class="config-footer">
      <button class="btn btn-ghost" id="btn-config-cancel">Cancelar</button>
      <button class="btn btn-primary" id="btn-config-save">Guardar Cambios</button>
    </div>
  `;
}

export function init() {
  // Category switches
  document.querySelectorAll('.admin-cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeCategory = btn.dataset.cat;
      rerender();
    });
  });

  // Manage Categories button
  const btnManageCats = document.getElementById('btn-manage-cats');
  if (btnManageCats) {
    btnManageCats.addEventListener('click', () => {
      showCategoryModal = true;
      rerender();
    });
  }

  // Category Modal Events
  if (showCategoryModal) {
    const closeCatModal = () => {
      showCategoryModal = false;
      rerender();
    };

    document.getElementById('btn-close-cat-modal')?.addEventListener('click', closeCatModal);
    document.getElementById('btn-finish-cats')?.addEventListener('click', closeCatModal);
    document.getElementById('cat-modal-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'cat-modal-overlay') closeCatModal();
    });

    // Add Category
    document.getElementById('btn-add-cat')?.addEventListener('click', async () => {
      const input = document.getElementById('new-cat-name');
      const name = input.value.trim();
      if (!name) return;
      await db.addCategory(name);
      input.value = '';
      rerender();
    });

    // Save/Update Category
    document.querySelectorAll('.btn-save-cat').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.dataset.id);
        const input = document.querySelector(`.cat-input-edit[data-id="${id}"]`);
        const newName = input.value.trim();
        if (newName) {
          await db.updateCategory(id, newName);
          window.showToast('✅ Categoría actualizada', 'success');
          rerender();
        }
      });
    });

    // Delete Category
    document.querySelectorAll('.btn-delete-cat').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.dataset.id);
        try {
          await db.deleteCategory(id);
          window.showToast('🗑️ Categoría eliminada', 'info');
          rerender();
        } catch (e) {
          window.showToast(`❌ ${e.message}`, 'error');
        }
      });
    });
  }

  // Manage Opciones button
  const btnManageOpts = document.getElementById('btn-manage-opts');
  if (btnManageOpts) {
    btnManageOpts.addEventListener('click', () => {
      showOpcionesModal = true;
      rerender();
    });
  }

  // Opciones Modal Events
  if (showOpcionesModal) {
    const closeOptModal = () => {
      showOpcionesModal = false;
      rerender();
    };

    document.getElementById('btn-close-opt-modal')?.addEventListener('click', closeOptModal);
    document.getElementById('btn-finish-opts')?.addEventListener('click', closeOptModal);
    document.getElementById('opt-modal-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'opt-modal-overlay') closeOptModal();
    });

    document.querySelectorAll('.opt-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentOpcionesTab = btn.dataset.tab;
        rerender();
      });
    });

    // Save extra option prices (per type)
    document.getElementById('btn-save-precios-extra')?.addEventListener('click', () => {
      const sabores = parseFloat(document.getElementById('precio-extra-sabores')?.value) || 1.00;
      const coberturas = parseFloat(document.getElementById('precio-extra-coberturas')?.value) || 0.20;
      const toppings = parseFloat(document.getElementById('precio-extra-toppings')?.value) || 0.20;
      db.setPreciosExtra({ sabores, coberturas, toppings });
      window.showToast(`✅ Precios actualizados: Sabor $${sabores.toFixed(2)}, Cobert. $${coberturas.toFixed(2)}, Topping $${toppings.toFixed(2)}`, 'success');
    });

    document.getElementById('btn-add-opt')?.addEventListener('click', () => {
      const nameInput = document.getElementById('new-opt-name');
      const nombre = nameInput.value.trim();
      const precioInput = document.getElementById('new-opt-price');
      const precio = precioInput ? parseFloat(precioInput.value) || 0 : 0;
      
      if (!nombre) return;
      db.addOpcion({ nombre, tipo: currentOpcionesTab, activo: true, precio });
      nameInput.value = '';
      if(precioInput) precioInput.value = '';
      rerender();
    });

    document.querySelectorAll('.btn-save-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.id);
        const nameInput = document.querySelector(`.opt-input-name[data-id="${id}"]`);
        const priceInput = document.querySelector(`.opt-input-price[data-id="${id}"]`);
        
        const updates = { nombre: nameInput.value.trim() };
        if (priceInput) updates.precio = parseFloat(priceInput.value) || 0;
        
        db.updateOpcion(id, updates);
        window.showToast('✅ Opción actualizada', 'success');
        rerender();
      });
    });

    document.querySelectorAll('.opt-toggle-active').forEach(toggle => {
      toggle.addEventListener('change', () => {
        const id = Number(toggle.dataset.id);
        db.updateOpcion(id, { activo: toggle.checked });
        window.showToast(toggle.checked ? '✅ Activado' : '⏸️ Desactivado', 'info');
        rerender();
      });
    });

    document.querySelectorAll('.btn-delete-opt').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.dataset.id);
        const confirmed = await window.showConfirm({
          icon: '🗑️',
          title: `¿Eliminar opción?`,
          message: 'Esta acción la eliminará de forma permanente.',
          confirmText: '🗑️ Eliminar',
          confirmClass: 'btn-danger',
        });
        if (confirmed) {
          db.deleteOpcion(id);
          window.showToast('🗑️ Opción eliminada', 'info');
          rerender();
        }
      });
    });
  }

  // Search input
  const searchInput = document.getElementById('admin-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      rerender();
    });
  }

  // Status Filter
  const statusEl = document.getElementById('status-filter');
  if (statusEl) {
    statusEl.addEventListener('change', (e) => {
      statusFilter = e.target.value;
      rerender();
    });
  }

  // Add product
  const btnAdd = document.getElementById('btn-add-product');
  if (btnAdd) btnAdd.addEventListener('click', () => {
    editingId = -1; // Special ID for new product
    showConfigPanel = true;
    rerender();
  });

  // Export/Import buttons
  const btnExport = document.getElementById('btn-export-catalog');
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      const data = {
        productos: db.getProducts(),
        opciones: db.getOpcionesColeccion()
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'catalogo_yoguice.json';
      a.click();
      URL.revokeObjectURL(url);
      window.showToast('Catálogo exportado exitosamente.', 'success');
    });
  }

  const btnImport = document.getElementById('btn-import-catalog');
  if (btnImport) {
    btnImport.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const data = JSON.parse(event.target.result);
            if (data.productos && data.opciones) {
              const confirm = await window.showConfirm({
                title: 'Importar Catálogo',
                message: `¿Estás seguro de importar ${data.productos.length} productos y ${data.opciones.length} opciones? Se añadirán a tu base de datos y podrían sobrescribir los actuales.`,
                confirmText: 'Importar'
              });
              
              if (confirm) {
                window.showToast('Importando... espera un momento', 'info');
                await db.importCatalog(data);
                window.showToast('¡Catálogo importado exitosamente!', 'success');
                setTimeout(() => window.location.reload(), 1500);
              }
            } else {
              window.showToast('El archivo JSON no tiene el formato correcto.', 'error');
            }
          } catch (err) {
            window.showToast('Error al leer el archivo.', 'error');
            console.error(err);
          }
        };
        reader.readAsText(file);
      };
      input.click();
    });
  }

  // Open Config (Edit)
  document.querySelectorAll('[data-edit-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      editingId = Number(btn.dataset.editId);
      showConfigPanel = true;
      rerender();
    });
  });

  // Delete product (Permanent delete)
  document.querySelectorAll('[data-delete-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const product = db.getProductById(Number(btn.dataset.deleteId));
      if (!product) return;

      const confirmed = await window.showConfirm({
        icon: '🗑️',
        title: `¿Eliminar "${product.nombre}"?`,
        message: 'Esta acción borrará el producto de forma permanente. Si solo quieres ocultarlo, usa el interruptor.',
        confirmText: '🗑️ Eliminar',
        confirmClass: 'btn-danger',
      });

      if (confirmed) {
        db.deleteProduct(product.id);
        window.showToast('🗑️ Producto eliminado', 'info');
        rerender();
      }
    });
  });

  // Toggle active
  document.querySelectorAll('[data-toggle-id]').forEach(toggle => {
    toggle.addEventListener('change', () => {
      db.updateProduct(Number(toggle.dataset.toggleId), { activo: toggle.checked });
      window.showToast(toggle.checked ? '✅ Producto activado' : '⏸️ Producto desactivado', 'info');
      // No rerender total para no perder el scroll
    });
  });

  // Config Panel actions
  const btnCloseConfig = document.getElementById('btn-close-config');
  const btnCancelConfig = document.getElementById('btn-config-cancel');
  const overlay = document.getElementById('admin-overlay');
  
  const close = () => {
    showConfigPanel = false;
    editingId = null;
    rerender();
  };

  if (btnCloseConfig) btnCloseConfig.addEventListener('click', close);
  if (btnCancelConfig) btnCancelConfig.addEventListener('click', close);
  if (overlay) overlay.addEventListener('click', close);

  // Save Config
  const btnSaveConfig = document.getElementById('btn-config-save');
  if (btnSaveConfig) {
    btnSaveConfig.addEventListener('click', async () => {
      const nombre = document.getElementById('config-name').value.trim();
      const emoji = document.getElementById('config-emoji').value.trim() || '🍦';
      const precio = parseFloat(document.getElementById('config-price').value) || 0;
      const incluye_desc = document.getElementById('config-desc').value.trim();
      
      const extras = Array.from(document.querySelectorAll('.extra-check:checked')).map(el => el.dataset.extra);
      
      const opciones = {
        sabores: {
          min: parseInt(document.getElementById('limit-sabores-min').value) || 0,
          max: parseInt(document.getElementById('limit-sabores-max').value) || 0
        },
        coberturas: {
          min: parseInt(document.getElementById('limit-coberturas-min').value) || 0,
          max: parseInt(document.getElementById('limit-coberturas-max').value) || 0
        },
        toppings: {
          min: parseInt(document.getElementById('limit-toppings-min').value) || 0,
          max: parseInt(document.getElementById('limit-toppings-max').value) || 0
        },
        extras,
        incluye_desc
      };

      if (!nombre) {
        window.showToast('❌ El nombre es obligatorio', 'error');
        return;
      }

      if (editingId === -1) {
        // Create new
        await db.addProduct({
          nombre,
          precio,
          emoji,
          categoria: activeCategory,
          activo: true,
          opciones
        });
        window.showToast('✨ Producto creado exitosamente', 'success');
      } else {
        // Update existing
        await db.updateProduct(editingId, { nombre, precio, emoji, opciones });
        window.showToast('✅ Configuración guardada', 'success');
      }
      close();
    });
  }
}

function rerender() {
  const container = document.getElementById('page-container');
  if (container) {
    // Preserve focus and cursor position
    const activeEl = document.activeElement;
    const isSearchInput = activeEl && activeEl.id === 'admin-search';
    const selectionStart = isSearchInput ? activeEl.selectionStart : null;
    const selectionEnd = isSearchInput ? activeEl.selectionEnd : null;

    container.innerHTML = render();
    init();

    // Restore focus and cursor
    if (isSearchInput) {
      const newSearchInput = document.getElementById('admin-search');
      if (newSearchInput) {
        newSearchInput.focus();
        newSearchInput.setSelectionRange(selectionStart, selectionEnd);
      }
    }
  }
}

export function cleanup() {}
