// ========================================
// 🔔 YOGU-ICE POS - Sound Notifications
// ========================================
//
// Generates audio cues using the Web Audio API (zero network dependency).
// - Kitchen sounds: Desktop/TV only (width > 1024px)
// - Payment sounds: All devices
// - Includes debounce to prevent audio saturation
//

let audioCtx = null;

// Cooldown tracker: prevents the same sound from overlapping
const lastPlayed = {};
const COOLDOWN_MS = 800; // Minimum ms between the same sound

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Resume if suspended (browser autoplay policy)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// ── Tone generators ──────────────────────────────────────

function playTone(freq, duration, type = 'sine', volume = 0.35) {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

// 🆕 NEW ORDER — Attention-grabbing double ding-dong (high-low bell)
function soundNewOrder() {
  playTone(880, 0.15, 'sine', 0.45);     // A5 — bright ding
  setTimeout(() => playTone(1175, 0.20, 'sine', 0.40), 150); // D6 — higher dong
  setTimeout(() => playTone(880, 0.25, 'sine', 0.30), 370);  // A5 repeat (softer)
}

// 🔄 UPDATE ORDER — Short double-bleep
function soundUpdateOrder() {
  playTone(660, 0.08, 'square', 0.20);   // E5 — quick bleep
  setTimeout(() => playTone(880, 0.10, 'square', 0.18), 120); // A5 — second bleep
}

// ✅ PAYMENT — Pleasant ascending success chime
function soundPayment() {
  playTone(523, 0.12, 'sine', 0.35);     // C5
  setTimeout(() => playTone(659, 0.12, 'sine', 0.35), 120);  // E5
  setTimeout(() => playTone(784, 0.12, 'sine', 0.35), 240);  // G5
  setTimeout(() => playTone(1047, 0.30, 'sine', 0.30), 360); // C6 — sustained
}

// ❌ CANCEL — Descending soft alert (reversed chime)
function soundCancel() {
  playTone(784, 0.12, 'triangle', 0.30);  // G5
  setTimeout(() => playTone(587, 0.12, 'triangle', 0.28), 150); // D5
  setTimeout(() => playTone(440, 0.25, 'triangle', 0.22), 300); // A4 — low finish
}

// ⏰ REMINDER — Calm but noticeable triple bell chime
function soundReminder() {
  playTone(784, 0.18, 'sine', 0.40);                          // G5
  setTimeout(() => playTone(988, 0.18, 'sine', 0.40), 200);   // B5
  setTimeout(() => playTone(784, 0.30, 'sine', 0.32), 420);   // G5 sustained
}

// ── Sound map ────────────────────────────────────────────

const SOUND_FUNCTIONS = {
  'new-order':    soundNewOrder,
  'update-order': soundUpdateOrder,
  'payment':      soundPayment,
  'cancel':       soundCancel,
  'reminder':     soundReminder,
};

/**
 * Pre-load audio context on first user interaction.
 * Called once on app init.
 */
export function preloadSounds() {
  // Create context eagerly (will be resumed on first click)
  getAudioContext();
  // Ensure AudioContext resumes on first user click (autoplay policy)
  const resumeAudio = () => {
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    document.removeEventListener('click', resumeAudio);
  };
  document.addEventListener('click', resumeAudio);
  console.log('🔔 Sistema de sonidos inicializado (Web Audio API)');
}

/**
 * Check if the current viewport is a desktop/large screen.
 */
function isDesktop() {
  return window.innerWidth > 1024;
}

/**
 * Play a UI sound with debounce protection.
 * @param {'new-order'|'update-order'|'payment'|'cancel'|'reminder'} action
 * @param {boolean} desktopOnly - If true, only plays on screens > 1024px
 */
export function playSound(action, desktopOnly = false) {
  // Device filter
  if (desktopOnly && !isDesktop()) return;

  // Cooldown check
  const now = Date.now();
  if (lastPlayed[action] && (now - lastPlayed[action] < COOLDOWN_MS)) return;
  lastPlayed[action] = now;

  const fn = SOUND_FUNCTIONS[action];
  if (fn) {
    try {
      fn();
    } catch (e) {
      // Silent fail — audio context not yet ready
    }
  }
}
