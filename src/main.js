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
      const basicAccess = ['ventas', 'cocina'];

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
