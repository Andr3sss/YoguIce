// ========================================
// 🍦 Heladería POS - Main Entry Point
// ========================================

import * as db from './db.js';
const { initDB, on, isDiaAbierto, getAperturaHoy } = db;

// Import modules
import * as ventas from './modules/ventas.js';
import * as cuadre from './modules/cuadre.js';
import * as historial from './modules/historial.js';
import * as historialVentas from './modules/historialVentas.js';

import * as reportes from './modules/reportes.js';
import * as productos from './modules/productos.js';
import * as estadisticas from './modules/estadisticas.js';
import * as cocina from './modules/cocina.js';
import * as gastos from './modules/gastos.js';
import * as recordatorios from './modules/recordatorios.js';
import * as auth from './modules/auth.js';
import { preloadSounds, playSound } from './modules/sounds.js';

// ========================================
// Helpers (exported for modules)
// ========================================

export function formatCurrency(amount) {
  return '$' + Number(amount).toFixed(2);
}

export function formatTime(timeStr) {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  return parts[0] + ':' + parts[1];
}

// ========================================
// Toast notification
// ========================================

window.showToast = function (message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.style.display = 'block';
  toast.style.animation = 'toastIn 0.3s ease forwards';

  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => {
      toast.style.display = 'none';
    }, 300);
  }, 2000);
};

// ========================================
// Custom Confirm Modal (replaces confirm())
// ========================================

let confirmResolve = null;
let promptResolve = null;

function setupPromptModal() {
  const modal = document.getElementById('prompt-modal');
  const cancelBtn = document.getElementById('prompt-cancel-btn');
  const okBtn = document.getElementById('prompt-ok-btn');
  const input = document.getElementById('prompt-input');

  const close = (val) => {
    modal.style.display = 'none';
    if (promptResolve) promptResolve(val);
    promptResolve = null;
  };

  cancelBtn.addEventListener('click', () => close(null));
  
  okBtn.addEventListener('click', () => {
    close(input.value);
  });

  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') close(input.value);
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) close(null);
  });
}

function setupConfirmModal() {
  const modal = document.getElementById('confirm-modal');
  const cancelBtn = document.getElementById('confirm-cancel-btn');
  const okBtn = document.getElementById('confirm-ok-btn');

  cancelBtn.addEventListener('click', () => {
    modal.style.display = 'none';
    if (confirmResolve) confirmResolve(false);
    confirmResolve = null;
  });

  okBtn.addEventListener('click', () => {
    modal.style.display = 'none';
    if (confirmResolve) confirmResolve(true);
    confirmResolve = null;
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
      if (confirmResolve) confirmResolve(false);
      confirmResolve = null;
    }
  });
}

/**
 * Shows a styled confirmation modal. Returns a Promise<boolean>.
 * @param {object} opts - { icon, title, message, details, confirmText, confirmClass }
 */
window.showConfirm = function (opts = {}) {
  const modal = document.getElementById('confirm-modal');
  document.getElementById('confirm-icon').textContent = opts.icon || '⚠️';
  document.getElementById('confirm-title').textContent = opts.title || '¿Estás seguro?';
  document.getElementById('confirm-message').innerHTML = opts.message || 'Esta acción no se puede deshacer.';

  const detailsEl = document.getElementById('confirm-details');
  detailsEl.innerHTML = opts.details || '';
  detailsEl.style.display = opts.details ? 'block' : 'none';

  const okBtn = document.getElementById('confirm-ok-btn');
  okBtn.textContent = opts.confirmText || 'Confirmar';
  okBtn.className = `btn ${opts.confirmClass || 'btn-danger'} btn-lg`;

  modal.style.display = 'flex';

  return new Promise((resolve) => {
    confirmResolve = resolve;
  });
};

/**
 * Shows a styled prompt modal. Returns a Promise<string|null>.
 * @param {object} opts - { icon, title, message, defaultValue, confirmText, type }
 */
window.showPrompt = function (opts = {}) {
  const modal = document.getElementById('prompt-modal');
  const input = document.getElementById('prompt-input');
  
  document.getElementById('prompt-icon').textContent = opts.icon || '💰';
  document.getElementById('prompt-title').textContent = opts.title || 'Ingresar valor';
  document.getElementById('prompt-message').textContent = opts.message || '';
  
  input.value = opts.defaultValue !== undefined ? opts.defaultValue : '';
  input.type = opts.type || 'text';
  
  const okBtn = document.getElementById('prompt-ok-btn');
  okBtn.textContent = opts.confirmText || 'Confirmar';

  modal.style.display = 'flex';
  setTimeout(() => input.focus(), 100);
  
  return new Promise(resolve => { promptResolve = resolve; });
};

// ========================================
// Modules registry
// ========================================

const modules = {
  ventas,
  cuadre,
  historial,
  historialVentas,
  reportes,
  productos,
  estadisticas,
  cocina,
  gastos,
  recordatorios,
};

let currentPage = 'ventas';
let currentModule = null;

// ========================================
// Navigation
// ========================================

function afterRender(container, module) {
  // Re-trigger animation
  container.style.animation = 'none';
  container.offsetHeight; // force reflow
  container.style.animation = 'fadeIn 0.2s ease';

  // Init module
  if (module && module.init) module.init();
}

function navigateTo(page) {
  // Cleanup current module
  if (currentModule && currentModule.cleanup) {
    currentModule.cleanup();
  }

  currentPage = page;
  currentModule = modules[page];

  // Render page
  const container = document.getElementById('page-container');
  if (container && currentModule) {
    const renderResult = currentModule.render();
    
    // Support both sync and async render
    if (renderResult instanceof Promise) {
      renderResult.then(html => {
        container.innerHTML = html;
        afterRender(container, currentModule);
      });
    } else {
      container.innerHTML = renderResult;
      afterRender(container, currentModule);
    }
  }

  // Handle KDS full screen layout (hide sidebar)
  if (page === 'cocina') {
    document.body.classList.add('kds-mode');
  } else {
    document.body.classList.remove('kds-mode');
  }

  // Update nav buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });
}

function checkPermissions() {
  const user = db.getCurrentUser();
  if (!user) return;

  const role = user.rol; // jefe, mesero, desarrollador
  const navButtons = document.querySelectorAll('.nav-btn');

  navButtons.forEach(btn => {
    const page = btn.dataset.page;
    let allowed = true;

    if (role === 'mesero') {
      const isDesktop = window.innerWidth >= 1024;
      // Mesero has access to Ventas, Cocina, and (on Desktop) Cuadre/Gastos
      const desktopOnly = ['cuadre', 'gastos'];
      const basicAccess = ['ventas', 'cocina', 'recordatorios'];

      if (desktopOnly.includes(page)) {
        allowed = isDesktop;
      } else if (!basicAccess.includes(page)) {
        allowed = false;
      }
    }

    if (!allowed) {
      btn.style.display = 'none';
    } else {
      btn.style.display = 'flex';
    }
  });

  // Render user info in sidebar
  const userContainer = document.getElementById('user-info-container');
  if (userContainer) {
    userContainer.innerHTML = `
      <div class="sidebar-user-info">
        <div class="user-avatar">${user.nombre.charAt(0)}</div>
        <div class="user-details">
          <h4>${user.nombre}</h4>
          <p>${user.rol}</p>
        </div>
      </div>
      <div class="logout-btn-container" style="display:flex; flex-direction:column; gap:8px;">
        ${user.rol === 'desarrollador' ? `
          <button class="btn-logout" id="reset-db-btn" style="background:rgba(239, 68, 68, 0.1); color:var(--danger); border:1px solid rgba(239, 68, 68, 0.2);">
            <span>🧹</span> Reseteo Producción
          </button>
        ` : ''}
        <button class="btn-logout" id="logout-btn">
          <span>🚪</span> Cerrar Sesión
        </button>
      </div>
    `;

    document.getElementById('logout-btn').addEventListener('click', auth.logout);
    
    const resetBtn = document.getElementById('reset-db-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', async () => {
        const ok = await window.showConfirm({
          title: '⚠️ ¿BORRAR TODO EL HISTORIAL?',
          message: 'Esta acción borrará todas las ventas, cierres y gastos de prueba. <strong>Los productos y suministros se mantendrán.</strong>',
          confirmText: 'SÍ, LIMPIAR TODO',
          confirmClass: 'btn-danger'
        });

        if (ok) {
          window.showToast('🧹 Limpiando base de datos...', 'info');
          await db.resetToProduction();
          window.showToast('✨ Sistema listo para producción', 'success');
          setTimeout(() => window.location.reload(), 1500);
        }
      });
    }
  }
}

// Expose globally for modules
window.navigateTo = navigateTo;

// ========================================
// Clock
// ========================================

function updateClock() {
  const clockEl = document.getElementById('sidebar-clock');
  if (clockEl) {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
}

// ========================================
// Apertura status in sidebar
// ========================================

function updateAperturaStatus() {
  const el = document.getElementById('apertura-status');
  if (!el) return;

  const abierto = isDiaAbierto();
  const apertura = getAperturaHoy();

  if (abierto && apertura) {
    el.innerHTML = `<span class="apertura-dot open"></span><span class="apertura-text">Día abierto · ${formatTime(apertura.hora_apertura)}</span>`;
    el.className = 'apertura-status open';
  } else if (apertura && apertura.estado === 'cerrado') {
    el.innerHTML = `<span class="apertura-dot closed"></span><span class="apertura-text">Día cerrado</span>`;
    el.className = 'apertura-status closed';
  } else {
    el.innerHTML = `<span class="apertura-dot pending"></span><span class="apertura-text">Sin apertura</span>`;
    el.className = 'apertura-status pending';
  }
}

// ========================================
// Payment modal handlers
// ========================================

function setupPaymentModal() {
  const modal = document.getElementById('payment-modal');
  const closeBtn = document.getElementById('modal-close');

  // Close button
  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  // Click outside to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
  });

  // Payment method buttons
  document.querySelectorAll('.payment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const method = btn.dataset.method;
      if (currentModule && currentModule.handlePayment) {
        currentModule.handlePayment(method);
      }
    });
  });
}

// ========================================
// ⏰ Reminders Engine (global popup scheduler)
// ========================================

const SNOOZE_MIN = 10;
let reminderQueue = [];
let reminderShowing = false;

function rmTodayStr() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

function rmGetJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || fallback); }
  catch { return JSON.parse(fallback); }
}

function checkRecordatorios() {
  // Only show reminders to logged-in users
  if (!db.getCurrentUser()) return;

  const now = new Date();
  const nowMs = now.getTime();
  const today = rmTodayStr();
  const weekday = now.getDay(); // 0=Dom .. 6=Sab
  const GRACE_MS = 2 * 60 * 1000; // margen para no perder el aviso si el navegador retrasó el chequeo

  // 1) Snoozes that are due
  const snoozes = rmGetJSON('recordatorios_snooze', '[]');
  const stillSnoozed = [];
  let snoozeChanged = false;
  for (const s of snoozes) {
    if (now.getTime() >= s.fireAt) {
      const rec = db.getRecordatorios().find(r => r.id === s.id);
      if (rec) enqueueReminder(rec);
      snoozeChanged = true;
    } else {
      stillSnoozed.push(s);
    }
  }
  if (snoozeChanged) localStorage.setItem('recordatorios_snooze', JSON.stringify(stillSnoozed));

  // 2) Scheduled reminders
  const fired = rmGetJSON('recordatorios_disparados', '{}');
  let firedChanged = false;

  // Prune fired keys that are not from today (keeps the map small)
  for (const k of Object.keys(fired)) {
    if (!k.includes(today)) { delete fired[k]; firedChanged = true; }
  }

  const activos = db.getRecordatorios().filter(r => r.activo);
  for (const r of activos) {
    // ¿Aplica hoy según su recurrencia?
    let matchesDay = false;
    if (r.tipo === 'diario') matchesDay = true;
    else if (r.tipo === 'semanal') matchesDay = Array.isArray(r.dias) && r.dias.includes(weekday);
    else if (r.tipo === 'unico') matchesDay = r.fecha === today;
    if (!matchesDay) continue;

    // Momento programado para hoy
    const [hh, mm] = (r.hora || '').split(':').map(Number);
    if (Number.isNaN(hh) || Number.isNaN(mm)) continue;
    const sched = new Date(now);
    sched.setHours(hh, mm, 0, 0);
    const diff = nowMs - sched.getTime();

    // Disparar solo si ya llegó la hora y estamos dentro de la ventana de gracia
    // (evita reavivar avisos viejos al abrir la app horas después)
    if (diff < 0 || diff > GRACE_MS) continue;

    const key = `${r.id}_${today}_${r.hora}`;
    if (fired[key]) continue;
    fired[key] = true;
    firedChanged = true;

    enqueueReminder(r);

    // One-time reminders deactivate themselves after firing
    if (r.tipo === 'unico') {
      db.updateRecordatorio(r.id, { activo: false });
    }
  }

  if (firedChanged) localStorage.setItem('recordatorios_disparados', JSON.stringify(fired));
}

function enqueueReminder(rec) {
  if (reminderQueue.find(r => r.id === rec.id)) return; // already queued
  reminderQueue.push(rec);
  if (!reminderShowing) showNextReminder();
}

function showNextReminder() {
  if (reminderQueue.length === 0) { reminderShowing = false; return; }
  reminderShowing = true;

  const rec = reminderQueue[0];
  const modal = document.getElementById('reminder-modal');
  const card = document.getElementById('reminder-card');
  if (!modal || !card) { reminderShowing = false; return; }

  const esAlta = rec.prioridad === 'alta';
  document.getElementById('reminder-icon').textContent = esAlta ? '🚨' : '⏰';
  document.getElementById('reminder-time').textContent = formatTime(rec.hora);
  document.getElementById('reminder-title').textContent = rec.titulo;

  const noteEl = document.getElementById('reminder-note');
  noteEl.textContent = rec.nota || '';
  noteEl.style.display = rec.nota ? 'block' : 'none';

  const metaEl = document.getElementById('reminder-meta');
  metaEl.textContent = rec.creado_por ? `Programado por ${rec.creado_por}` : '';

  card.classList.toggle('priority-alta', esAlta);
  modal.style.display = 'flex';

  playSound('reminder', false);
}

function dismissCurrentReminder(snooze) {
  const rec = reminderQueue.shift();
  if (snooze && rec) {
    const snoozes = rmGetJSON('recordatorios_snooze', '[]');
    // Replace any existing snooze for this reminder
    const filtered = snoozes.filter(s => s.id !== rec.id);
    filtered.push({ id: rec.id, fireAt: Date.now() + SNOOZE_MIN * 60 * 1000 });
    localStorage.setItem('recordatorios_snooze', JSON.stringify(filtered));
    window.showToast(`⏰ Pospuesto ${SNOOZE_MIN} min`, 'info');
  }

  const modal = document.getElementById('reminder-modal');
  if (modal) modal.style.display = 'none';
  reminderShowing = false;

  // Show the next queued reminder (if any) after a short beat
  if (reminderQueue.length > 0) setTimeout(showNextReminder, 400);
}

function setupReminderModal() {
  document.getElementById('reminder-done-btn')?.addEventListener('click', () => dismissCurrentReminder(false));
  document.getElementById('reminder-snooze-btn')?.addEventListener('click', () => dismissCurrentReminder(true));
}

// ========================================
// Init
// ========================================

function init() {
  // Initialize database
  db.initDB();

  // Setup navigation
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      navigateTo(btn.dataset.page);
    });
  });

  // Setup modals
  setupPaymentModal();
  setupConfirmModal();
  setupPromptModal();
  setupReminderModal();

  // ⏰ Reminders scheduler — checks every 10s regardless of current page
  checkRecordatorios();
  setInterval(checkRecordatorios, 10000);
  // Chequeo inmediato al volver a la pestaña (los navegadores ralentizan timers en segundo plano)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkRecordatorios(); });
  window.addEventListener('focus', checkRecordatorios);

  // Start clock
  updateClock();
  setInterval(updateClock, 1000);

  // Apertura status
  updateAperturaStatus();
  db.on('apertura-changed', updateAperturaStatus);

  // 🔔 Sound notifications
  preloadSounds();
  db.on('cocina-added', () => playSound('new-order', true));       // Desktop only
  db.on('cocina-updated', () => playSound('update-order', true));  // Desktop only
  db.on('cuenta-cerrada', () => playSound('payment', false));      // All devices
  db.on('cuenta-cancelada', () => playSound('cancel', true));      // Desktop only

  // Navigate to default page
  const user = db.getCurrentUser();
  if (!user) {
    const container = document.getElementById('page-container');
    container.innerHTML = auth.render();
    auth.init();
    // Hide sidebar content when not logged in
    document.getElementById('sidebar').style.display = 'none';
    document.getElementById('main-content').style.marginLeft = '0';
    document.getElementById('main-content').style.width = '100%';
  } else {
    document.getElementById('sidebar').style.display = 'md' === 'xs' ? 'none' : 'flex'; // Reset sidebar
    checkPermissions();
    // Add resize listener to re-check permissions (Desktop vs Mobile for waiters)
    window.addEventListener('resize', checkPermissions);
    navigateTo('ventas');
  }
}

// Start app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
