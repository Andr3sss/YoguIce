// ========================================
// 🍦 Heladería POS - Recordatorios Module
// CRUD de recordatorios programados (avisos por hora)
// ========================================

import * as db from '../db.js';
import { formatTime } from '../main.js';

// Orden de la semana en UI (lunes primero), valor = getDay() (0=Dom)
const WEEKDAYS = [
  { v: 1, label: 'Lun' },
  { v: 2, label: 'Mar' },
  { v: 3, label: 'Mié' },
  { v: 4, label: 'Jue' },
  { v: 5, label: 'Vie' },
  { v: 6, label: 'Sáb' },
  { v: 0, label: 'Dom' },
];

let showForm = false;
let editingId = null;
let draft = null;          // borrador del formulario en edición/creación
let _subscribed = false;   // evita acumular listeners en cada rerender

function todayStr() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

function blankDraft() {
  return {
    titulo: '',
    nota: '',
    hora: '18:00',
    tipo: 'diario',
    dias: [],
    fecha: todayStr(),
    prioridad: 'normal',
    activo: true,
  };
}

function recurrenceLabel(r) {
  if (r.tipo === 'diario') return 'Todos los días';
  if (r.tipo === 'unico') {
    try {
      return new Date(r.fecha + 'T00:00:00').toLocaleDateString('es', { day: 'numeric', month: 'long' });
    } catch { return r.fecha; }
  }
  if (r.tipo === 'semanal') {
    const dias = (r.dias || []).slice().sort((a, b) => {
      // Reordenar con lunes primero
      const ord = d => (d === 0 ? 7 : d);
      return ord(a) - ord(b);
    });
    if (dias.length === 0) return 'Sin días';
    if (dias.length === 7) return 'Todos los días';
    return dias.map(d => WEEKDAYS.find(w => w.v === d)?.label || '').join(' · ');
  }
  return '';
}

// ========================================
// Render
// ========================================

export function render() {
  const recordatorios = db.getRecordatorios()
    .slice()
    .sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));

  return `
    <div id="rec-page">
      <div class="page-header" style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <h2>⏰ Recordatorios</h2>
          <p>Programa avisos que aparecerán automáticamente a la hora indicada en todas las pantallas</p>
        </div>
        <button class="btn btn-primary" id="btn-add-rec">➕ Nuevo Recordatorio</button>
      </div>

      <div class="rec-grid">
        ${recordatorios.length === 0 ? `
          <div class="empty-state" style="grid-column: 1/-1;">
            <div class="empty-icon">⏰</div>
            <h3>No hay recordatorios</h3>
            <p>Crea uno para no olvidar tareas como hacer el cuadre o revisar el inventario</p>
          </div>
        ` : recordatorios.map(renderCard).join('')}
      </div>

      ${showForm ? renderForm() : ''}
    </div>
  `;
}

function renderCard(r) {
  const esAlta = r.prioridad === 'alta';
  return `
    <div class="rec-card ${!r.activo ? 'inactive' : ''} ${esAlta ? 'priority-alta' : ''}">
      <div class="rec-card-head">
        <div class="rec-card-time">${formatTime(r.hora)}</div>
        <label class="toggle-switch" title="Activar / Pausar">
          <input type="checkbox" ${r.activo ? 'checked' : ''} data-toggle-id="${r.id}" />
          <span class="toggle-slider"></span>
        </label>
      </div>
      <div class="rec-card-title">${esAlta ? '🚨 ' : ''}${escapeHtml(r.titulo)}</div>
      ${r.nota ? `<div class="rec-card-note">${escapeHtml(r.nota)}</div>` : ''}
      <div class="rec-card-badges">
        <span class="rec-badge">🔁 ${recurrenceLabel(r)}</span>
        ${esAlta ? `<span class="rec-badge alta">Prioridad alta</span>` : ''}
      </div>
      <div class="rec-card-actions">
        <button class="btn btn-ghost btn-sm" data-edit-id="${r.id}">✏️ Editar</button>
        <button class="btn btn-ghost btn-sm" data-delete-id="${r.id}" style="color: var(--danger);">🗑️</button>
      </div>
    </div>
  `;
}

function renderForm() {
  const d = draft;
  return `
    <div class="modal-overlay" id="rec-form-overlay">
      <div class="modal" style="max-width: 520px; width: 95%;">
        <div class="modal-header">
          <h2>${editingId ? '✏️ Editar Recordatorio' : '➕ Nuevo Recordatorio'}</h2>
          <button class="modal-close" id="btn-close-rec-form">&times;</button>
        </div>

        <div style="padding: 4px 4px 8px 4px; display:flex; flex-direction:column; gap:16px;">
          <div class="form-group">
            <label class="form-label">Título *</label>
            <input type="text" class="form-input" id="rec-titulo" placeholder="Ej: Hacer el cuadre de caja" value="${escapeAttr(d.titulo)}" />
          </div>

          <div class="form-group">
            <label class="form-label">Nota (opcional)</label>
            <input type="text" class="form-input" id="rec-nota" placeholder="Detalle adicional…" value="${escapeAttr(d.nota)}" />
          </div>

          <div class="form-group">
            <label class="form-label">Hora *</label>
            ${renderTimeWheel(d.hora)}
          </div>

          <div style="display:flex; gap:12px;">
            <div class="form-group" style="flex:1.4;">
              <label class="form-label">Repetición</label>
              <select class="form-select" id="rec-tipo">
                <option value="diario" ${d.tipo === 'diario' ? 'selected' : ''}>Todos los días</option>
                <option value="semanal" ${d.tipo === 'semanal' ? 'selected' : ''}>Días de la semana</option>
                <option value="unico" ${d.tipo === 'unico' ? 'selected' : ''}>Una sola vez (fecha)</option>
              </select>
            </div>
            <div class="form-group" style="flex:1;">
              <label class="form-label">Prioridad</label>
              <select class="form-select" id="rec-prioridad">
                <option value="normal" ${d.prioridad === 'normal' ? 'selected' : ''}>Normal</option>
                <option value="alta" ${d.prioridad === 'alta' ? 'selected' : ''}>Alta 🚨</option>
              </select>
            </div>
          </div>

          ${d.tipo === 'semanal' ? `
            <div class="form-group">
              <label class="form-label">Elige los días</label>
              <div class="rec-days">
                ${WEEKDAYS.map(w => `
                  <button type="button" class="rec-day-btn ${d.dias.includes(w.v) ? 'active' : ''}" data-day="${w.v}">${w.label}</button>
                `).join('')}
              </div>
            </div>
          ` : ''}

          ${d.tipo === 'unico' ? `
            <div class="form-group">
              <label class="form-label">Fecha</label>
              <input type="date" class="form-input" id="rec-fecha" value="${d.fecha}" />
            </div>
          ` : ''}
        </div>

        <div class="confirm-modal-actions" style="margin-top: 8px;">
          <button class="btn btn-ghost btn-lg" id="btn-cancel-rec">Cancelar</button>
          <button class="btn btn-success btn-lg" id="btn-save-rec">💾 Guardar</button>
        </div>
      </div>
    </div>
  `;
}

// ========================================
// Rueda de hora (carrusel scroll-snap)
// ========================================

const TW_ITEM_H = 40; // alto de cada ítem (debe coincidir con el CSS)

function pad2(n) {
  return String(n).padStart(2, '0');
}

function renderTimeWheel(hora) {
  const hours = Array.from({ length: 24 }, (_, i) => pad2(i));
  const mins = Array.from({ length: 60 }, (_, i) => pad2(i));
  const col = (id, unit, items) => `
    <div class="tw-col" id="${id}" data-unit="${unit}">
      <div class="tw-spacer"></div>
      ${items.map(v => `<div class="tw-item" data-val="${v}">${v}</div>`).join('')}
      <div class="tw-spacer"></div>
    </div>`;

  return `
    <div class="time-wheel" id="rec-hora-wheel">
      ${col('tw-hours', 'h', hours)}
      <div class="tw-sep">:</div>
      ${col('tw-mins', 'm', mins)}
      <div class="tw-highlight"></div>
    </div>
  `;
}

function initTimeWheel() {
  const wheel = document.getElementById('rec-hora-wheel');
  if (!wheel || !draft) return;
  const [hStr, mStr] = (draft.hora || '18:00').split(':');
  setupWheelColumn(document.getElementById('tw-hours'), parseInt(hStr, 10) || 0, 23);
  setupWheelColumn(document.getElementById('tw-mins'), parseInt(mStr, 10) || 0, 59);
}

function setupWheelColumn(col, initialIndex, maxIndex) {
  if (!col) return;

  // Posicionar sin animación en el valor inicial
  col.scrollTop = initialIndex * TW_ITEM_H;
  markSelected(col, initialIndex);

  let settleTimer;
  col.addEventListener('scroll', () => {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      const idx = Math.max(0, Math.min(maxIndex, Math.round(col.scrollTop / TW_ITEM_H)));
      markSelected(col, idx);
      updateHoraFromWheels();
    }, 70);
    // Resaltado en vivo mientras se arrastra
    const liveIdx = Math.max(0, Math.min(maxIndex, Math.round(col.scrollTop / TW_ITEM_H)));
    markSelected(col, liveIdx);
  });

  // Clic en un ítem para seleccionarlo
  col.querySelectorAll('.tw-item').forEach((item, i) => {
    item.addEventListener('click', () => {
      col.scrollTo({ top: i * TW_ITEM_H, behavior: 'smooth' });
      markSelected(col, i);
      setTimeout(updateHoraFromWheels, 120);
    });
  });
}

function markSelected(col, idx) {
  col.querySelectorAll('.tw-item').forEach((it, i) => {
    it.classList.toggle('selected', i === idx);
  });
}

function updateHoraFromWheels() {
  const hCol = document.getElementById('tw-hours');
  const mCol = document.getElementById('tw-mins');
  if (!hCol || !mCol || !draft) return;
  const hIdx = Math.max(0, Math.min(23, Math.round(hCol.scrollTop / TW_ITEM_H)));
  const mIdx = Math.max(0, Math.min(59, Math.round(mCol.scrollTop / TW_ITEM_H)));
  draft.hora = `${pad2(hIdx)}:${pad2(mIdx)}`;
}

// ========================================
// Init / eventos
// ========================================

export function init() {
  ensureSubscription();

  // Nuevo
  document.getElementById('btn-add-rec')?.addEventListener('click', () => {
    editingId = null;
    draft = blankDraft();
    showForm = true;
    rerender();
  });

  // Toggle activo
  document.querySelectorAll('[data-toggle-id]').forEach(input => {
    input.addEventListener('change', () => {
      db.updateRecordatorio(input.dataset.toggleId, { activo: input.checked });
    });
  });

  // Editar
  document.querySelectorAll('[data-edit-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const rec = db.getRecordatorios().find(r => r.id === btn.dataset.editId);
      if (!rec) return;
      editingId = rec.id;
      draft = { ...blankDraft(), ...rec, dias: [...(rec.dias || [])] };
      showForm = true;
      rerender();
    });
  });

  // Eliminar
  document.querySelectorAll('[data-delete-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const rec = db.getRecordatorios().find(r => r.id === btn.dataset.deleteId);
      const ok = await window.showConfirm({
        icon: '🗑️',
        title: '¿Eliminar recordatorio?',
        message: `Se eliminará <strong>${escapeHtml(rec?.titulo || '')}</strong>.`,
        confirmText: 'Sí, eliminar',
        confirmClass: 'btn-danger',
      });
      if (ok) {
        await db.deleteRecordatorio(btn.dataset.deleteId);
        window.showToast('Recordatorio eliminado', 'success');
      }
    });
  });

  // Eventos del formulario
  if (showForm) initFormEvents();
}

function initFormEvents() {
  const close = () => { showForm = false; editingId = null; draft = null; rerender(); };

  document.getElementById('btn-close-rec-form')?.addEventListener('click', close);
  document.getElementById('btn-cancel-rec')?.addEventListener('click', close);
  document.getElementById('rec-form-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'rec-form-overlay') close();
  });

  // Cambio de tipo de repetición → re-render para mostrar campos condicionales
  document.getElementById('rec-tipo')?.addEventListener('change', (e) => {
    captureForm();
    draft.tipo = e.target.value;
    rerender();
  });

  // Selección de días (semanal)
  document.querySelectorAll('.rec-day-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      captureForm();
      const day = Number(btn.dataset.day);
      if (draft.dias.includes(day)) {
        draft.dias = draft.dias.filter(d => d !== day);
      } else {
        draft.dias.push(day);
      }
      rerender();
    });
  });

  // Guardar
  document.getElementById('btn-save-rec')?.addEventListener('click', saveRecordatorio);

  // Rueda de hora (carrusel)
  initTimeWheel();
}

// Lee los valores actuales del formulario al borrador (evita perder lo escrito al re-render)
function captureForm() {
  if (!draft) return;
  const get = id => document.getElementById(id);
  if (get('rec-titulo')) draft.titulo = get('rec-titulo').value;
  if (get('rec-nota')) draft.nota = get('rec-nota').value;
  if (get('rec-prioridad')) draft.prioridad = get('rec-prioridad').value;
  if (get('rec-fecha')) draft.fecha = get('rec-fecha').value;
  // La hora la mantiene la rueda en draft.hora; capturamos su posición exacta por si acaso
  if (get('rec-hora-wheel')) updateHoraFromWheels();
}

async function saveRecordatorio() {
  captureForm();

  if (!draft.titulo.trim()) {
    window.showToast('Escribe un título', 'error');
    return;
  }
  if (!draft.hora) {
    window.showToast('Elige una hora', 'error');
    return;
  }
  if (draft.tipo === 'semanal' && draft.dias.length === 0) {
    window.showToast('Selecciona al menos un día', 'error');
    return;
  }
  if (draft.tipo === 'unico' && !draft.fecha) {
    window.showToast('Elige una fecha', 'error');
    return;
  }

  const payload = {
    titulo: draft.titulo.trim(),
    nota: draft.nota.trim(),
    hora: draft.hora,
    tipo: draft.tipo,
    dias: draft.tipo === 'semanal' ? draft.dias : [],
    fecha: draft.tipo === 'unico' ? draft.fecha : todayStr(),
    prioridad: draft.prioridad,
    activo: draft.activo !== false,
  };

  if (editingId) {
    await db.updateRecordatorio(editingId, payload);
    window.showToast('Recordatorio actualizado', 'success');
  } else {
    await db.addRecordatorio(payload);
    window.showToast('Recordatorio creado', 'success');
  }

  showForm = false;
  editingId = null;
  draft = null;
  rerender();
}

// ========================================
// Helpers
// ========================================

function ensureSubscription() {
  if (_subscribed) return;
  _subscribed = true;
  // Refrescar la lista cuando la nube envíe cambios (otro dispositivo)
  db.on('recordatorios-changed', () => {
    // Solo si esta página está montada y no hay un formulario abierto (para no pisar lo que el usuario escribe)
    if (document.getElementById('rec-page') && !showForm) rerender();
  });
}

function rerender() {
  const container = document.getElementById('page-container');
  if (container && document.getElementById('rec-page')) {
    container.innerHTML = render();
    init();
  }
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function escapeAttr(str) {
  return escapeHtml(str);
}

export function cleanup() {}
