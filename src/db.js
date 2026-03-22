import { db as firestore } from './firebase.js';
import { 
  collection, doc, onSnapshot, setDoc, addDoc, updateDoc, 
  query, where, orderBy, serverTimestamp, getDocs, limit, deleteDoc
} from "firebase/firestore";

const DB_KEYS = {
  PRODUCTOS: 'heladeria_productos',
  VENTAS: 'heladeria_ventas',
  CIERRES: 'heladeria_cierres',
  CUENTAS: 'heladeria_cuentas',
  APERTURAS: 'heladeria_aperturas',
  INSUMOS: 'heladeria_insumos',
  COCINA: 'heladeria_cocina',
  GASTOS: 'heladeria_gastos',
  OPCIONES: 'heladeria_opciones',
  USUARIOS: 'heladeria_usuarios',
};

const DB_VERSION = 1;

// Initialize WebSockets for Local Network Sync (KDS)
let socket = null;
try {
  socket = io();
  socket.on('connect', () => {
    console.log('✅ Conectado al servidor KDS via WebSockets');
  });

  socket.on('sync-kds', (data) => {
    const pedidos = getCollection(DB_KEYS.COCINA);
    
    if (data.action === 'added') {
      const exists = pedidos.find(p => p.id === data.payload.id);
      if (!exists) {
        pedidos.push(data.payload);
        saveCollection(DB_KEYS.COCINA, pedidos);
        emit('cocina-added', data.payload);
      }
    } else if (data.action === 'updated') {
      const index = pedidos.findIndex(p => p.id === data.payload.id);
      if (index !== -1) {
        pedidos[index].estado = data.payload.estado;
        saveCollection(DB_KEYS.COCINA, pedidos);
        emit('cocina-updated', pedidos[index]);
      } else {
        // En caso super extremo de que falte, se inserta
        pedidos.push(data.payload);
        saveCollection(DB_KEYS.COCINA, pedidos);
        emit('cocina-added', data.payload);
      }
    }
  });

} catch(e) {
  console.warn('Socket.IO no está disponible temporalmente', e);
}

export function getOpcionesColeccion() {
  return getCollection(DB_KEYS.OPCIONES);
}

export function initOpciones() {
  const existing = getCollection(DB_KEYS.OPCIONES);
  // Solo cargamos defaults si está vacío.
  if (existing.length === 0) {
    let _id = 1;
    const initial = [];
    const _sab = ['Chocolate', 'Vainilla', 'Fresa', 'Mora', 'Maracuyá', 'Chicle'];
    const _cob = ['Chocolate', 'Manjar', 'Chicle', 'Mora', 'Fresa', 'Maracuyá'];
    const _top = ['Oreo', 'Chips Ahoy', 'Barquillo', 'Barriletes', 'Trululú', 'M&M', 'Gusanitos', 'Grageas', 'Chocolate blanco', 'Chocolate negro', 'Chocolate colores', 'Almendra', 'Nuez', 'Maní', 'Granola', 'Pasas', 'Fresas', 'Mora', 'Piña'];
    const _ext = [{ nombre: 'Topping extra', precio: 0.20 }, { nombre: 'Jalea extra', precio: 0.20 }, { nombre: 'Queso extra', precio: 0.60 }, { nombre: 'Crema extra', precio: 0.60 }];
    const _not = ['Sin fruta', 'Sin crema', 'Sin cobertura', 'Extra topping', 'Extra frío'];

    _sab.forEach(n => initial.push({ id: _id++, nombre: n, tipo: 'sabor', activo: true, precio: 0 }));
    _cob.forEach(n => initial.push({ id: _id++, nombre: n, tipo: 'cobertura', activo: true, precio: 0 }));
    _top.forEach(n => initial.push({ id: _id++, nombre: n, tipo: 'topping', activo: true, precio: 0 }));
    _ext.forEach(e => initial.push({ id: _id++, nombre: e.nombre, tipo: 'extra', activo: true, precio: e.precio }));
    _not.forEach(n => initial.push({ id: _id++, nombre: n, tipo: 'nota', activo: true, precio: 0 }));

    saveCollection(DB_KEYS.OPCIONES, initial);
  }
}

export function updateOpcion(id, updates) {
  const ops = getCollection(DB_KEYS.OPCIONES);
  const idx = ops.findIndex(o => o.id === Number(id));
  if (idx !== -1) {
    ops[idx] = { ...ops[idx], ...updates };
    
    // Shadow write (local)
    saveCollection(DB_KEYS.OPCIONES, ops);
    emit('opciones-changed', ops);
    
    // Cloud update
    updateDoc(doc(firestore, 'opciones', id.toString()), updates).catch(err => {
      console.error("Error al actualizar opción en Firestore:", err);
    });
  }
}

export function addOpcion(opcion) {
  const ops = getCollection(DB_KEYS.OPCIONES);
  const id = ops.length > 0 ? Math.max(...ops.map(o => o.id)) + 1 : 1;
  const newOp = {
    ...opcion,
    id,
  };
  
  // Shadow write (local)
  ops.push(newOp);
  saveCollection(DB_KEYS.OPCIONES, ops);
  emit('opciones-changed', ops);
  
  // Cloud write
  setDoc(doc(firestore, 'opciones', id.toString()), newOp).catch(err => {
    console.error("Error al subir opción a Firestore:", err);
  });

  return newOp;
}

export function deleteOpcion(id) {
  let ops = getCollection(DB_KEYS.OPCIONES);
  ops = ops.filter(o => o.id !== Number(id));
  
  // Shadow write (local)
  saveCollection(DB_KEYS.OPCIONES, ops);
  emit('opciones-changed', ops);
  
  // Cloud delete
  deleteDoc(doc(firestore, 'opciones', id.toString())).catch(err => {
    console.error("Error al eliminar opción de Firestore:", err);
  });
}

// Proxies for legacy arrays
export const SABORES_HELADO = new Proxy([], {
  get(target, prop) {
    const arr = getOpcionesColeccion().filter(o => o.tipo === 'sabor' && o.activo).map(o => o.nombre);
    const method = arr[prop]; return typeof method === 'function' ? method.bind(arr) : arr[prop];
  }
});

export const COBERTURAS_LIQUIDAS = new Proxy([], {
  get(target, prop) {
    const arr = getOpcionesColeccion().filter(o => o.tipo === 'cobertura' && o.activo).map(o => o.nombre);
    const method = arr[prop]; return typeof method === 'function' ? method.bind(arr) : arr[prop];
  }
});

export const TOPPINGS = new Proxy([], {
  get(target, prop) {
    const arr = getOpcionesColeccion().filter(o => o.tipo === 'topping' && o.activo).map(o => o.nombre);
    const method = arr[prop]; return typeof method === 'function' ? method.bind(arr) : arr[prop];
  }
});

export const EXTRAS = new Proxy([], {
  get(target, prop) {
    const arr = getOpcionesColeccion().filter(o => o.tipo === 'extra' && o.activo);
    const method = arr[prop]; return typeof method === 'function' ? method.bind(arr) : arr[prop];
  }
});

export const NOTAS_RAPIDAS = new Proxy([], {
  get(target, prop) {
    const arr = getOpcionesColeccion().filter(o => o.tipo === 'nota' && o.activo).map(o => o.nombre);
    const method = arr[prop]; return typeof method === 'function' ? method.bind(arr) : arr[prop];
  }
});

// Precios configurables por tipo de opción extra
const DEFAULT_PRECIOS_EXTRA = { sabores: 1.00, coberturas: 0.20, toppings: 0.20 };

export function getPreciosExtra() {
  const stored = localStorage.getItem('yoguice_precios_extra');
  return stored ? JSON.parse(stored) : { ...DEFAULT_PRECIOS_EXTRA };
}

export function setPreciosExtra(precios) {
  localStorage.setItem('yoguice_precios_extra', JSON.stringify(precios));
}

export function getPrecioExtraPorTipo(tipo) {
  return getPreciosExtra()[tipo] ?? 0.20;
}
// Menú Oficial Heladería
const DEFAULT_PRODUCTS = [
  // WAFFLES
  { id: 1, nombre: 'Waffle Tradicional', precio: 5.00, categoria: 'WAFFLES', activo: true, emoji: '🧇', 
    opciones: { sabores: {min: 2, max: 2}, coberturas: {min: 1, max: 1}, toppings: {min: 0, max: 0}, incluye_desc: '2 sabores helado, fruta, crema, 1 cobertura' }},
  { id: 2, nombre: 'Waffle Durazno', precio: 5.00, categoria: 'WAFFLES', activo: true, emoji: '🧇', 
    opciones: { sabores: {min: 1, max: 1}, coberturas: {min: 0, max: 0}, toppings: {min: 0, max: 0}, incluye_desc: '1 sabor, fresa, durazno, crema' }},
  { id: 3, nombre: 'Waffle con Queso', precio: 5.00, categoria: 'WAFFLES', activo: true, emoji: '🧇', 
    opciones: { sabores: {min: 1, max: 1}, coberturas: {min: 1, max: 1}, toppings: {min: 0, max: 0}, incluye_desc: '1 sabor, fruta, crema, queso, 1 cobertura' }},
  { id: 4, nombre: 'Waffle con Frutas', precio: 4.00, categoria: 'WAFFLES', activo: true, emoji: '🧇', 
    opciones: { sabores: {min: 0, max: 0}, coberturas: {min: 0, max: 0}, toppings: {min: 0, max: 0}, incluye_desc: 'Frutas de temporada' }},
  { id: 5, nombre: 'Bubble Waffle', precio: 3.50, categoria: 'WAFFLES', activo: true, emoji: '🧇', 
    opciones: { sabores: {min: 1, max: 1}, coberturas: {min: 1, max: 1}, toppings: {min: 0, max: 0}, incluye_desc: '1 sabor, fresa, crema, 1 cobertura' }},
  { id: 6, nombre: 'Bubble Waffle Oreo', precio: 3.50, categoria: 'WAFFLES', activo: true, emoji: '🧇', 
    opciones: { sabores: {min: 1, max: 1}, coberturas: {min: 0, max: 0}, toppings: {min: 0, max: 0}, incluye_desc: '1 sabor, fresa, crema, oreo' }},
  { id: 7, nombre: 'Bubble Waffle Queso', precio: 3.50, categoria: 'WAFFLES', activo: true, emoji: '🧇', 
    opciones: { sabores: {min: 1, max: 1}, coberturas: {min: 1, max: 1}, toppings: {min: 0, max: 0}, incluye_desc: '1 sabor, queso, crema, 1 cobertura' }},

  // TULIPANES
  { id: 8, nombre: 'Tulipán Doble', precio: 2.00, categoria: 'TULIPANES', activo: true, emoji: '🍧', 
    opciones: { sabores: {min: 2, max: 2}, coberturas: {min: 1, max: 1}, toppings: {min: 2, max: 2}, incluye_desc: '2 sabores, 1 cobertura, 2 toppings' }},
  { id: 9, nombre: 'Tulipán Triple', precio: 3.00, categoria: 'TULIPANES', activo: true, emoji: '🍧', 
    opciones: { sabores: {min: 3, max: 3}, coberturas: {min: 1, max: 1}, toppings: {min: 2, max: 2}, incluye_desc: '3 sabores, 1 cobertura, 2 toppings' }},
  { id: 10, nombre: 'Tulipán Queso', precio: 2.80, categoria: 'TULIPANES', activo: true, emoji: '🧀', 
    opciones: { sabores: {min: 2, max: 2}, coberturas: {min: 1, max: 1}, toppings: {min: 0, max: 0}, incluye_desc: '2 sabores, crema, queso, 1 cobertura' }},

  // COPAS
  { id: 11, nombre: 'Copa Doble', precio: 2.00, categoria: 'COPAS', activo: true, emoji: '🍨', 
    opciones: { sabores: {min: 2, max: 2}, coberturas: {min: 1, max: 1}, toppings: {min: 2, max: 2}, incluye_desc: '2 sabores, 2 toppings, 1 cobertura' }},
  { id: 12, nombre: 'Copa Triple', precio: 3.00, categoria: 'COPAS', activo: true, emoji: '🍨', 
    opciones: { sabores: {min: 3, max: 3}, coberturas: {min: 1, max: 1}, toppings: {min: 2, max: 2}, incluye_desc: '3 sabores, 2 toppings, 1 cobertura' }},
  { id: 13, nombre: 'Copa Queso', precio: 3.00, categoria: 'COPAS', activo: true, emoji: '🧀', 
    opciones: { sabores: {min: 2, max: 2}, coberturas: {min: 1, max: 1}, toppings: {min: 0, max: 0}, incluye_desc: '2 sabores, fresa, banana, crema, queso, 1 cobertura' }},
  { id: 14, nombre: 'Copa Durazno con Queso', precio: 2.60, categoria: 'COPAS', activo: true, emoji: '🧀', 
    opciones: { sabores: {min: 1, max: 1}, coberturas: {min: 1, max: 1}, toppings: {min: 0, max: 0}, incluye_desc: '1 sabor, crema, queso, 1 cobertura' }},
  { id: 15, nombre: 'Copa Durazno sin Queso', precio: 2.25, categoria: 'COPAS', activo: true, emoji: '🍑', 
    opciones: { sabores: {min: 1, max: 1}, coberturas: {min: 1, max: 1}, toppings: {min: 0, max: 0}, incluye_desc: '1 sabor, crema, 1 cobertura' }},
  { id: 16, nombre: 'Banana Split', precio: 2.50, categoria: 'COPAS', activo: true, emoji: '🍌', 
    opciones: { sabores: {min: 2, max: 2}, coberturas: {min: 1, max: 1}, toppings: {min: 2, max: 2}, incluye_desc: '2 sabores, 2 toppings, 1 cobertura' }},
  { id: 17, nombre: 'Banana Split Triple', precio: 3.50, categoria: 'COPAS', activo: true, emoji: '🍌', 
    opciones: { sabores: {min: 3, max: 3}, coberturas: {min: 1, max: 1}, toppings: {min: 0, max: 0}, incluye_desc: '3 sabores, crema, queso, 1 cobertura' }},

  // POSTRES
  { id: 18, nombre: 'Brownie con Helado', precio: 2.80, categoria: 'POSTRES', activo: true, emoji: '🍫', 
    opciones: { sabores: {min: 1, max: 1}, coberturas: {min: 1, max: 1}, toppings: {min: 0, max: 0}, incluye_desc: '1 sabor helado, crema, 1 cobertura' }},
  { id: 19, nombre: 'Postre Individual', precio: 1.50, categoria: 'POSTRES', activo: true, emoji: '🍰', 
    variantes: [
      {nombre: 'Brownie', precio: 1.50}, 
      {nombre: 'Cheesecake Maracuyá', precio: 1.50}, 
      {nombre: 'Torta Manzana', precio: 1.50}, 
      {nombre: 'Torta Nuez', precio: 1.50}
    ] 
  },

  // TORTAS HELADAS
  { id: 20, nombre: 'Torta Helada Grande', precio: 20.00, categoria: 'TORTAS HELADAS', activo: true, emoji: '🎂', 
    variantes: [
      {nombre: 'Kinder', precio: 20}, {nombre: 'Ferrero', precio: 20}, {nombre: 'Tiramisú', precio: 20}
    ], 
    opciones: { personalizacion_nombre: { precio: 1.00, activa: true }, sabores: {min:0, max:0}, toppings: {min:0, max:0}, coberturas: {min:0, max:0} } },
  { id: 21, nombre: 'Torta Helada Junior', precio: 11.00, categoria: 'TORTAS HELADAS', activo: true, emoji: '🎂', 
    variantes: [
      {nombre: 'Kinder', precio: 11}, {nombre: 'Ferrero', precio: 11}
    ],
    opciones: { personalizacion_nombre: { precio: 1.00, activa: true }, sabores: {min:0, max:0}, toppings: {min:0, max:0}, coberturas: {min:0, max:0} } },

  // BEBIDAS
  { id: 22, nombre: 'Monster Shake', precio: 3.50, categoria: 'BEBIDAS', activo: true, emoji: '🧋', opciones: { sabores: {min: 1, max: 1}, toppings: {min:0, max:0}, coberturas: {min:0, max:0} } },
  { id: 23, nombre: 'Milk Shake', precio: 2.25, categoria: 'BEBIDAS', activo: true, emoji: '🥤', opciones: { sabores: {min: 1, max: 1} } },
  { id: 24, nombre: 'Nevado', precio: 3.25, categoria: 'BEBIDAS', activo: true, emoji: '❄️', opciones: { sabores: {min: 1, max: 1} } },
  { id: 25, nombre: 'Capuchino', precio: 1.50, categoria: 'BEBIDAS', activo: true, emoji: '☕' },
  { id: 26, nombre: 'Americano', precio: 1.25, categoria: 'BEBIDAS', activo: true, emoji: '☕' },
  { id: 27, nombre: 'Mocaccino', precio: 1.80, categoria: 'BEBIDAS', activo: true, emoji: '☕' },
  { id: 28, nombre: 'Choco Malvavisco', precio: 2.25, categoria: 'BEBIDAS', activo: true, emoji: '☕' },

  // PROMOCIONES
  { id: 29, nombre: 'Promo: 2 Copas Queso', precio: 5.50, categoria: 'PROMOCIONES', activo: true, emoji: '🏆', 
    opciones: { 
      promo: { cantidad: 2, label: 'Copa', perProduct: { sabores: {min:2, max:2}, coberturas: {min:1, max:1}, toppings: {min:0, max:0} } },
      sabores: {min: 4, max: 4}, coberturas: {min: 2, max: 2}, toppings: {min: 0, max: 0}, incluye_desc: '2 Copas completas (2 sabores + 1 cobertura c/u)' } },
  { id: 30, nombre: 'Promo: 2 Waffles Trad.', precio: 7.00, categoria: 'PROMOCIONES', activo: true, emoji: '🏆', 
    opciones: { 
      promo: { cantidad: 2, label: 'Waffle', perProduct: { sabores: {min:1, max:1}, coberturas: {min:1, max:1}, toppings: {min:0, max:0} } },
      sabores: {min: 2, max: 2}, coberturas: {min: 2, max: 2}, toppings: {min: 0, max: 0}, incluye_desc: '2 Waffles completos (1 sabor helado + 1 cobertura c/u)' } },
  { id: 31, nombre: 'Promo: 2 Bubble Waffle', precio: 6.50, categoria: 'PROMOCIONES', activo: true, emoji: '🏆', 
    opciones: { 
      promo: { cantidad: 2, label: 'Bubble Waffle', perProduct: { sabores: {min:1, max:1}, coberturas: {min:1, max:1}, toppings: {min:0, max:0} } },
      sabores: {min: 2, max: 2}, coberturas: {min: 2, max: 2}, toppings: {min: 0, max: 0}, incluye_desc: '2 Bubble Waffles (1 sabor + 1 cobertura c/u)' } },
  { id: 32, nombre: 'Promo: 2 Capu + 1 Brownie', precio: 3.99, categoria: 'PROMOCIONES', activo: true, emoji: '🏆' },
];

// ========================================
// Core helpers
// ========================================

function getCollection(key) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveCollection(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

// Safe rounding for monetary values (avoids floating point issues)
export function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

// ========================================
// Event bus for real-time updates
// ========================================

const listeners = {};

export function on(event, callback) {
  if (!listeners[event]) listeners[event] = [];
  listeners[event].push(callback);
}

export function off(event, callback) {
  if (!listeners[event]) return;
  listeners[event] = listeners[event].filter(cb => cb !== callback);
}

function emit(event, data) {
  if (!listeners[event]) return;
  listeners[event].forEach(cb => cb(data));
}

// ========================================
// 🔥 Firebase Real-time Shadowing Engine
// ========================================

const shadowStore = {
  aperturas: [],
  cuentas: [],
  cocina: [],
  ventas: [],
  gastos: [],
  productos: [],
  categorias: [],
  usuarios: [],
};

let isSynced = false;

export function startCloudSync() {
  console.log('🔥 Iniciando Simbiosis con Firestore...');

  // Sync Jornadas (Aperturas/Cierres)
  onSnapshot(collection(firestore, 'jornadas'), (snapshot) => {
    shadowStore.aperturas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    saveCollection(DB_KEYS.APERTURAS, shadowStore.aperturas);
    emit('apertura-changed', getAperturaHoy());
  });

  // Sync Cuentas
  console.log('📡 Subscribing to Cuentas onSnapshot...');
  onSnapshot(collection(firestore, 'cuentas'), (snapshot) => {
    console.log(`🔄 Firestore Sync: Received ${snapshot.docs.length} cuentas (Source: ${snapshot.metadata.hasPendingWrites ? 'Local' : 'Server'})`);
    shadowStore.cuentas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    saveCollection(DB_KEYS.CUENTAS, shadowStore.cuentas);
    emit('cuentas-changed', shadowStore.cuentas);
    
    // Emit for individual updated accounts if needed
    snapshot.docChanges().forEach(change => {
      if (change.type === "modified") {
        emit('cuenta-updated', { id: change.doc.id, ...change.doc.data() });
      }
    });
  }, (error) => {
    console.error('❌ Firestore Cuentas Sync Error:', error);
  });

  // Sync Cocina (KDS)
  onSnapshot(query(collection(firestore, 'cocina_kds'), orderBy('timestamp', 'asc')), (snapshot) => {
    shadowStore.cocina = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    saveCollection(DB_KEYS.COCINA, shadowStore.cocina);
    emit('cocina-sync', shadowStore.cocina);
    snapshot.docChanges().forEach(change => {
      if (change.type === "added") emit('cocina-added', { id: change.doc.id, ...change.doc.data() });
      if (change.type === "modified") emit('cocina-updated', { id: change.doc.id, ...change.doc.data() });
    });
  });

  // Sync Ventas (Last 500 for performance)
  onSnapshot(query(collection(firestore, 'ventas'), orderBy('timestamp', 'desc'), limit(500)), (snapshot) => {
    shadowStore.ventas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    saveCollection(DB_KEYS.VENTAS, shadowStore.ventas);
    emit('sales-changed', shadowStore.ventas);
  });

  // Sync Gastos
  onSnapshot(collection(firestore, 'gastos'), (snapshot) => {
    shadowStore.gastos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    saveCollection(DB_KEYS.GASTOS, shadowStore.gastos);
    emit('gastos-changed', shadowStore.gastos);
  });

  // Sync Insumos (Inventory)
  onSnapshot(collection(firestore, 'insumos'), (snapshot) => {
    if (snapshot.docs.length > 0) {
      const insumos = snapshot.docs.map(d => ({ firestoreId: d.id, ...d.data() }));
      saveCollection(DB_KEYS.INSUMOS, insumos);
      emit('insumos-changed', insumos);
    } else {
      // Seed Firestore with real default insumos if it's empty
      const local = getCollection(DB_KEYS.INSUMOS);
      const toSeed = local.length > 0 ? local : DEFAULT_INSUMOS;
      toSeed.forEach(ins => {
        addDoc(collection(firestore, 'insumos'), { id: ins.id, nombre: ins.nombre, activo: ins.activo }).catch(console.error);
      });
    }
  }, (err) => console.error('❌ Firestore Insumos Sync Error:', err));

  // Sync Categorias
  onSnapshot(collection(firestore, 'categorias'), (snapshot) => {
    shadowStore.categorias = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    saveCollection(DB_KEYS.CATEGORIAS, shadowStore.categorias);
    emit('categories-changed', shadowStore.categorias);
  });

  // Sync Productos (Real-time Menu)
  onSnapshot(collection(firestore, 'productos'), (snapshot) => {
    console.log(`🔄 Firestore Sync: Received ${snapshot.docs.length} productos`);
    if (snapshot.docs.length > 0) {
      shadowStore.productos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      saveCollection(DB_KEYS.PRODUCTOS, shadowStore.productos);
      emit('products-changed', shadowStore.productos);
    } else {
      // Si la nube está vacía pero local tiene datos, subirlos (seed)
      const localProds = getCollection(DB_KEYS.PRODUCTOS);
      if (localProds.length > 0) {
        console.log("📤 Subiendo productos locales a la nube como semilla...");
        localProds.forEach(p => {
          setDoc(doc(firestore, 'productos', p.id.toString()), p).catch(console.error);
        });
      }
    }
  }, (error) => {
    console.error('❌ Firestore Productos Sync Error:', error);
  });

  // Sync Opciones (Flavors, Toppings, Extras)
  onSnapshot(collection(firestore, 'opciones'), (snapshot) => {
    console.log(`🔄 Firestore Sync: Received ${snapshot.docs.length} opciones`);
    if (snapshot.docs.length > 0) {
      const ops = snapshot.docs.map(doc => ({ id: Number(doc.id), ...doc.data() }));
      saveCollection(DB_KEYS.OPCIONES, ops);
      emit('opciones-changed', ops);
    } else {
      // Seed if cloud is empty
      const localOps = getCollection(DB_KEYS.OPCIONES);
      if (localOps.length > 0) {
        console.log("📤 Subiendo opciones locales a la nube como semilla...");
        localOps.forEach(o => {
          setDoc(doc(firestore, 'opciones', o.id.toString()), o).catch(console.error);
        });
      }
    }
  }, (error) => {
    console.error('❌ Firestore Opciones Sync Error:', error);
  });

  // Sync Usuarios
  onSnapshot(collection(firestore, 'usuarios'), (snapshot) => {
    console.log(`🔄 Firestore Sync: Received ${snapshot.docs.length} usuarios`);
    if (snapshot.docs.length > 0) {
      shadowStore.usuarios = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      saveCollection(DB_KEYS.USUARIOS, shadowStore.usuarios);
      emit('users-changed', shadowStore.usuarios);
    } else {
      // Seed if cloud is empty
      const localUsers = getCollection(DB_KEYS.USUARIOS);
      if (localUsers.length > 0) {
        console.log("📤 Subiendo usuarios locales a la nube como semilla...");
        localUsers.forEach(u => {
          setDoc(doc(firestore, 'usuarios', u.id.toString()), u).catch(console.error);
        });
      }
    }
  }, (error) => {
    console.error('❌ Firestore Usuarios Sync Error:', error);
  });

  isSynced = true;
}

// ========================================
// Products CRUD
// ========================================

export function initProducts() {
  const existing = getCollection(DB_KEYS.PRODUCTOS);
  // Solo cargamos defaults si está vacío. 
  // La sincronización con Firestore se encargará de actualizar esto si hay datos en la nube.
  if (existing.length === 0) {
    saveCollection(DB_KEYS.PRODUCTOS, DEFAULT_PRODUCTS);
  } else {
    // Migration: patch PROMOCIONES products with promo field if missing
    let needsSave = false;
    for (const p of existing) {
      if (p.categoria === 'PROMOCIONES' && p.opciones && !p.opciones.promo) {
        const defaultProd = DEFAULT_PRODUCTS.find(dp => dp.id === p.id);
        if (defaultProd?.opciones?.promo) {
          p.opciones.promo = defaultProd.opciones.promo;
          // Also update the incluye_desc if available
          if (defaultProd.opciones.incluye_desc) p.opciones.incluye_desc = defaultProd.opciones.incluye_desc;
          needsSave = true;
          // Push to Firestore
          setDoc(doc(firestore, 'productos', p.id.toString()), p).catch(console.error);
        }
      }
    }

    // Force patch for Promo ID 30 (Waffles) if it has the old min: 2 config
    const p30 = existing.find(p => p.id === 30 || p.id === '30');
    if (p30 && p30.opciones?.promo?.perProduct?.sabores?.min === 2) {
      console.log('🩹 Aplicando parche de configuración para Promo ID 30 (2 Waffles)...');
      const def30 = DEFAULT_PRODUCTS.find(dp => dp.id === 30);
      if (def30) {
        p30.opciones = JSON.parse(JSON.stringify(def30.opciones));
        needsSave = true;
        // Update Firestore
        setDoc(doc(firestore, 'productos', '30'), p30).catch(console.error);
      }
    }

    if (needsSave) {
      saveCollection(DB_KEYS.PRODUCTOS, existing);
      console.log('🔄 Migrated PROMOCIONES products with promo sub-product data');
    }
  }
}

export function getProducts() {
  return getCollection(DB_KEYS.PRODUCTOS);
}

export function getActiveProducts() {
  return getProducts().filter(p => p.activo);
}

export function getProductById(id) {
  return getProducts().find(p => p.id === id || p.id === Number(id));
}

export function addProduct(product) {
  const products = getProducts();
  const id = products.length > 0 ? Math.max(...products.map(p => typeof p.id === 'number' ? p.id : 0)) + 1 : 1;
  const newProduct = {
    ...product,
    id,
  };
  
  // Shadow write (local)
  products.push(newProduct);
  saveCollection(DB_KEYS.PRODUCTOS, products);
  emit('products-changed', products);
  
  // Cloud write
  setDoc(doc(firestore, 'productos', id.toString()), newProduct).catch(err => {
    console.error("Error al subir producto a Firestore:", err);
  });

  return newProduct;
}

export function updateProduct(id, updates) {
  const products = getProducts();
  const index = products.findIndex(p => p.id === id || p.id === Number(id));
  if (index === -1) return null;
  products[index] = { ...products[index], ...updates };
  
  // Shadow write (local)
  saveCollection(DB_KEYS.PRODUCTOS, products);
  emit('products-changed', products);
  
  // Cloud update
  updateDoc(doc(firestore, 'productos', id.toString()), updates).catch(err => {
    console.error("Error al actualizar producto en Firestore:", err);
  });

  return products[index];
}

export function deleteProduct(id) {
  let products = getProducts();
  products = products.filter(p => p.id !== id && p.id !== Number(id));
  
  // Shadow write (local)
  saveCollection(DB_KEYS.PRODUCTOS, products);
  emit('products-changed', products);
  
  // Cloud delete
  deleteDoc(doc(firestore, 'productos', id.toString())).catch(err => {
    console.error("Error al eliminar producto de Firestore:", err);
  });
}

export async function importCatalog(data) {
  const { productos, opciones } = data;
  if (productos && Array.isArray(productos)) {
    saveCollection(DB_KEYS.PRODUCTOS, productos);
    const pPromises = productos.map(p => setDoc(doc(firestore, 'productos', p.id.toString()), p));
    await Promise.all(pPromises);
  }
  if (opciones && Array.isArray(opciones)) {
    saveCollection(DB_KEYS.OPCIONES, opciones);
    const oPromises = opciones.map(o => setDoc(doc(firestore, 'opciones', o.id.toString()), o));
    await Promise.all(oPromises);
  }
}

// ========================================
// Categories CRUD
// ========================================

export function initCategories() {
  const existing = getCollection(DB_KEYS.CATEGORIAS);
  const initialNames = ['WAFFLES', 'TULIPANES', 'COPAS', 'POSTRES', 'TORTAS HELADAS', 'BEBIDAS', 'PROMOCIONES'];
  
  if (existing.length === 0) {
    const cats = initialNames.map((name, index) => ({ id: index + 1, nombre: name }));
    saveCollection(DB_KEYS.CATEGORIAS, cats);
  } else {
    // Asegurar que no falte ninguna de las básicas si el usuario las borró por error
    let changed = false;
    initialNames.forEach((name, index) => {
      if (!existing.find(c => c.nombre === name)) {
        const nextId = existing.length > 0 ? Math.max(...existing.map(c => c.id)) + 1 : index + 1;
        existing.push({ id: nextId, nombre: name });
        changed = true;
      }
    });
    if (changed) {
      saveCollection(DB_KEYS.CATEGORIAS, existing);
    }
  }
}

export function getCategories() {
  const cats = getCollection(DB_KEYS.CATEGORIAS);
  const products = getCollection(DB_KEYS.PRODUCTOS);
  
  // Auto-sincronizar categorías que existan en productos pero no en la tabla de categorías
  const catNames = new Set(cats.map(c => c.nombre?.toUpperCase()));
  let maxId = cats.length > 0 ? Math.max(...cats.map(c => c.id)) : 0;
  let changed = false;
  
  for (const p of products) {
    const pCat = p.categoria?.toUpperCase();
    if (pCat && !catNames.has(pCat)) {
      maxId++;
      cats.push({ id: maxId, nombre: pCat });
      catNames.add(pCat);
      changed = true;
    }
  }
  
  if (changed) {
    saveCollection(DB_KEYS.CATEGORIAS, cats);
  }
  
  return cats;
}

export async function addCategory(name) {
  const cats = getCategories();
  const id = cats.length > 0 ? Math.max(...cats.map(c => c.id)) + 1 : 1;
  const newCat = { id, nombre: name.toUpperCase() };
  cats.push(newCat);
  saveCollection(DB_KEYS.CATEGORIAS, cats);
  
  // Cloud write
  await setDoc(doc(firestore, 'categorias', id.toString()), newCat);
  
  emit('categories-changed', cats);
  return newCat;
}

export async function updateCategory(id, newName) {
  const cats = getCategories();
  const index = cats.findIndex(c => c.id === id || c.id === Number(id));
  if (index === -1) return null;
  
  const oldName = cats[index].nombre;
  cats[index].nombre = newName.toUpperCase();
  saveCollection(DB_KEYS.CATEGORIAS, cats);

  // Cloud update
  await updateDoc(doc(firestore, 'categorias', id.toString()), { nombre: cats[index].nombre });

  // Actualizar productos asociados
  const products = getProducts();
  let changed = false;
  products.forEach(p => {
    if (p.categoria === oldName) {
      p.categoria = cats[index].nombre;
      changed = true;
    }
  });
  if (changed) {
    saveCollection(DB_KEYS.PRODUCTOS, products);
    emit('products-changed', products);
    // Nota: El sync de productos con Firebase debería manejar esto si existiera full sync.
    // Como parece que productos no tiene onSnapshot bidireccional en productos.js, 
    // lo ideal sería actualizar cada producto en Firestore también.
    for (const p of products) {
      if (p.categoria === cats[index].nombre) {
        await setDoc(doc(firestore, 'productos', p.id.toString()), p);
      }
    }
  }

  emit('categories-changed', cats);
  return cats[index];
}

export async function deleteCategory(id) {
  const cats = getCategories();
  const cat = cats.find(c => c.id === id || c.id === Number(id));
  if (!cat) return;

  // Verificar si hay productos
  const products = getProducts();
  const hasProducts = products.some(p => p.categoria === cat.nombre);
  if (hasProducts) {
    throw new Error('No se puede eliminar una categoría que tiene productos.');
  }

  const newCats = cats.filter(c => c.id !== id && c.id !== Number(id));
  saveCollection(DB_KEYS.CATEGORIAS, newCats);
  
  // Cloud delete
  await deleteDoc(doc(firestore, 'categorias', id.toString()));
  
  emit('categories-changed', newCats);
}

// ========================================
const DEFAULT_INSUMOS = [
  { id: 1,  nombre: 'Vasos de Soft',           activo: true },
  { id: 2,  nombre: 'Vasos de Soft Doble',      activo: true },
  { id: 3,  nombre: 'Conos',                    activo: true },
  { id: 4,  nombre: 'Conos Dobles',             activo: true },
  { id: 5,  nombre: 'Tulipanes',                activo: true },
  { id: 6,  nombre: 'Fresas con Crema',         activo: true },
  { id: 7,  nombre: 'Vasos de Café',            activo: true },
  { id: 8,  nombre: 'Quesos',                   activo: true },
  { id: 9,  nombre: 'Brownie',                  activo: true },
  { id: 10, nombre: 'Cheesecake de Maracuyá',   activo: true },
  { id: 11, nombre: 'Coca Lata',                activo: true },
  { id: 12, nombre: 'Coca Botella',             activo: true },
  { id: 13, nombre: 'Agua',                     activo: true },
  { id: 14, nombre: 'Fuce Tea',                 activo: true },
  { id: 15, nombre: 'Banana',                   activo: true },
  { id: 16, nombre: 'Tarrina de Waffle',        activo: true },
  { id: 17, nombre: 'Tarrina de Banana',        activo: true },
  { id: 18, nombre: 'Tarrina para Llevar',      activo: true },
  { id: 19, nombre: 'Tarrina Medios Litros',    activo: true },
  { id: 20, nombre: 'Tiramisú',                 activo: true },
  { id: 21, nombre: 'Cremas',                   activo: true },
  { id: 22, nombre: 'Balas',                    activo: true },
];

// Names of old test insumos to detect and replace
const OLD_TEST_INSUMOS = ['Conos', 'Vasos Pequeños', 'Vasos Grandes', 'Cucharas', 'Tarrinas'];

export function getInsumos() {
  const stored = getCollection(DB_KEYS.INSUMOS);
  // Detect old test data (exactly 5 items with the old names)
  const isOldTestData = stored.length > 0 && stored.length <= 5 &&
    stored.every(i => OLD_TEST_INSUMOS.includes(i.nombre));
  if (stored.length === 0 || isOldTestData) {
    saveCollection(DB_KEYS.INSUMOS, DEFAULT_INSUMOS);
    return DEFAULT_INSUMOS;
  }
  return stored;
}

export function getActiveInsumos() {
  return getInsumos().filter(i => i.activo !== false);
}

export async function addInsumo(nombre) {
  const existing = getInsumos();
  const maxId = existing.length > 0 ? Math.max(...existing.map(i => Number(i.id) || 0)) : 0;
  const newInsumo = { id: maxId + 1, nombre: nombre.trim(), activo: true };
  const ref = await addDoc(collection(firestore, 'insumos'), newInsumo);
  newInsumo.firestoreId = ref.id;
  existing.push(newInsumo);
  saveCollection(DB_KEYS.INSUMOS, existing);
  emit('insumos-changed', existing);
  return newInsumo;
}

export async function updateInsumo(id, changes) {
  const insumos = getInsumos();
  const idx = insumos.findIndex(i => i.id === id || i.firestoreId === id);
  if (idx === -1) return;
  Object.assign(insumos[idx], changes);
  saveCollection(DB_KEYS.INSUMOS, insumos);
  emit('insumos-changed', insumos);
  // Update in Firestore - find by firestoreId or query by id
  const fid = insumos[idx].firestoreId;
  if (fid) {
    await updateDoc(doc(firestore, 'insumos', fid), changes);
  } else {
    // Query by numeric id field
    const q = query(collection(firestore, 'insumos'), where('id', '==', id));
    const snap = await getDocs(q);
    snap.forEach(d => updateDoc(d.ref, changes));
  }
}

export async function deleteInsumo(id) {
  let insumos = getInsumos();
  const target = insumos.find(i => i.id === id || i.firestoreId === id);
  if (!target) return;
  insumos = insumos.filter(i => i !== target);
  saveCollection(DB_KEYS.INSUMOS, insumos);
  emit('insumos-changed', insumos);
  const fid = target.firestoreId;
  if (fid) {
    await deleteDoc(doc(firestore, 'insumos', fid));
  } else {
    const q = query(collection(firestore, 'insumos'), where('id', '==', id));
    const snap = await getDocs(q);
    snap.forEach(d => deleteDoc(d.ref));
  }
}

// ========================================
// Sales CRUD
// ========================================

export function getSales() {
  return getCollection(DB_KEYS.VENTAS);
}

export function addSale(producto, metodoPago, cuentaId = null) {
  const sales = getSales();
  const now = new Date();
  const sale = {
    id: generateId(),
    producto_id: producto.id,
    producto_nombre: producto.nombre,
    precio: producto.precio,
    metodo_pago: metodoPago,
    fecha: getLocalDate(),
    hora: now.toTimeString().split(' ')[0],
    usuario: 'Cajero',
    timestamp: now.getTime(),
    cuenta_id: cuentaId,
  };
  sales.push(sale);
  saveCollection(DB_KEYS.VENTAS, sales);
  emit('sale-added', sale);
  emit('sales-changed', sales);
  return sale;
}

// Batch-add sales from a closed cuenta (more efficient)
export function addSalesFromCuenta(cuenta, metodoPago) {
  const sales = getSales();
  const now = new Date();
  const newSales = [];
  cuenta.items.forEach(item => {
    for (let i = 0; i < item.cantidad; i++) {
      const sale = {
        id: generateId(),
        producto_id: item.producto_id,
        producto_nombre: item.nombre,
        precio: item.precio,
        metodo_pago: metodoPago,
        fecha: getLocalDate(),
        hora: now.toTimeString().split(' ')[0],
        usuario: 'Cajero',
        timestamp: now.getTime(),
        cuenta_id: cuenta.id,
      };
      sales.push(sale);
      newSales.push(sale);
    }
  });
  saveCollection(DB_KEYS.VENTAS, sales);
  newSales.forEach(s => emit('sale-added', s));
  emit('sales-changed', sales);
  return newSales;
}

export function getTodaySales() {
  const today = getLocalDate();
  return getSales().filter(s => s.fecha === today);
}

/**
 * Get sales only from the CURRENT jornada (after the current apertura).
 * If no apertura is open, falls back to getTodaySales().
 */
export function getSalesForJornada() {
  const apertura = getAperturaHoy();
  if (!apertura || apertura.estado !== 'abierto') {
    // If day is closed, show sales from the last apertura's range
    if (apertura && apertura.estado === 'cerrado') {
      return getSales().filter(s => s.timestamp >= apertura.timestamp_apertura && s.timestamp <= apertura.timestamp_cierre);
    }
    return [];
  }
  // Only sales made after this apertura opened
  return getSales().filter(s => s.timestamp >= apertura.timestamp_apertura);
}

/**
 * Get cuentas only from the CURRENT jornada.
 */
export function getCuentasForJornada() {
  const apertura = getAperturaHoy();
  if (!apertura || apertura.estado !== 'abierto') {
    if (apertura && apertura.estado === 'cerrado') {
      return getCuentas().filter(c => c.timestamp_apertura >= apertura.timestamp_apertura && c.timestamp_apertura <= apertura.timestamp_cierre);
    }
    return [];
  }
  return getCuentas().filter(c => c.timestamp_apertura >= apertura.timestamp_apertura);
}

export function getSalesByDate(dateStr) {
  return getSales().filter(s => s.fecha === dateStr);
}

export function getSalesByDateRange(startDate, endDate) {
  return getSales().filter(s => s.fecha >= startDate && s.fecha <= endDate);
}

export function deleteSale(id) {
  let sales = getSales();
  sales = sales.filter(s => s.id !== id);
  saveCollection(DB_KEYS.VENTAS, sales);
  emit('sales-changed', sales);
}

// ========================================
// Cuentas (Tickets) CRUD
// ========================================

export function getCuentas() {
  return getCollection(DB_KEYS.CUENTAS);
}

export function getNextCuentaNumber() {
  const apertura = getAperturaHoy();
  let cuentas;
  if (apertura && apertura.estado === 'abierto') {
    // Only count cuentas created after the current apertura
    cuentas = getCuentas().filter(c => c.timestamp_apertura >= apertura.timestamp_apertura);
  } else {
    cuentas = getCuentas();
  }
  if (cuentas.length === 0) return 1;
  return Math.max(...cuentas.map(c => c.numero || 0)) + 1;
}

/**
 * Retorna las mesas que han sido ocupadas en los últimos 5 minutos o están abiertas.
 */
export function getMesasOcupadasReciente() {
  const apertura = getAperturaHoy();
  if (!apertura || apertura.estado !== 'abierto') return [];

  const ahora = Date.now();
  const CINCO_MINUTOS = 5 * 60 * 1000;

  return getCuentas()
    .filter(c => {
      // Cuentas de la jornada actual
      if (c.timestamp_apertura < apertura.timestamp_apertura) return false;
      
      // Si la cuenta está abierta, la mesa está ocupada
      if (c.estado === 'abierta') return true;
      
      // Si la cuenta se cerró hace menos de 5 minutos, la mesa sigue "caliente"
      if (c.estado === 'pagada' && c.timestamp_cierre && (ahora - c.timestamp_cierre < CINCO_MINUTOS)) {
        return true;
      }
      
      return false;
    })
    .map(c => c.mesa)
    .filter(Boolean); // Solo las que tienen mesa asignada
}

export async function createCuenta(mesa = null) {
  const apertura = getAperturaHoy();
  if (!apertura || apertura.estado !== 'abierto') {
    throw new Error('No se puede crear una cuenta sin una apertura de caja activa.');
  }

  const cuentas = getCuentas();
  const now = new Date();
  const id = generateId();
  const cuenta = {
    id,
    numero: getNextCuentaNumber(),
    mesa,
    estado: 'abierta',
    items: [],
    total: 0,
    metodo_pago: null,
    fecha_apertura: getLocalDate(),
    hora_apertura: now.toTimeString().split(' ')[0],
    fecha_cierre: null,
    hora_cierre: null,
    timestamp_apertura: now.getTime(),
    timestamp_cierre: null,
  };

  // Shadow write
  cuentas.push(cuenta);
  saveCollection(DB_KEYS.CUENTAS, cuentas);
  
  // Emit IMMEDIATELY so local UI updates
  emit('cuenta-created', cuenta);
  emit('cuentas-changed', cuentas);

  // Cloud write (awaited for cross-device sync)
  await setDoc(doc(firestore, 'cuentas', id), cuenta);
  
  return cuenta;
}

export function getCuentaById(id) {
  return getCuentas().find(c => c.id === id);
}

export function getCuentasAbiertas() {
  return getCuentas().filter(c => c.estado === 'abierta');
}

export async function addItemToCuenta(cuentaId, producto, config = null) {
  const cuentas = getCuentas();
  const cuenta = cuentas.find(c => c.id === cuentaId);
  if (!cuenta || cuenta.estado !== 'abierta') return null;

  let finalName = producto.nombre;
  let finalPrice = producto.precio;
  let detailsText = '';

  if (config) {
    if (config.variante) {
      finalName = `${producto.nombre} ${config.variante.nombre}`;
      finalPrice = config.variante.precio;
    }
    const details = [];
    if (config.sabores && config.sabores.length > 0) details.push(`Sab: ${config.sabores.join(', ')}`);
    if (config.coberturas && config.coberturas.length > 0) details.push(`Cob: ${config.coberturas.join(', ')}`);
    if (config.toppings && config.toppings.length > 0) details.push(`Top: ${config.toppings.join(', ')}`);
    
    // Precio por opciones extra (sabores/coberturas/toppings con "(Extra)")
    const preciosExtra = getPreciosExtra();
    const extraSabores = (config.sabores || []).filter(s => s.includes('(Extra)')).length;
    const extraCoberturas = (config.coberturas || []).filter(s => s.includes('(Extra)')).length;
    const extraToppings = (config.toppings || []).filter(s => s.includes('(Extra)')).length;
    const costoExtrasOpciones = round2(
      (extraSabores * (preciosExtra.sabores || 1.00)) +
      (extraCoberturas * (preciosExtra.coberturas || 0.20)) +
      (extraToppings * (preciosExtra.toppings || 0.20))
    );
    if (costoExtrasOpciones > 0) {
      finalPrice += costoExtrasOpciones;
    }

    if (config.extras && config.extras.length > 0) {
      const extraDesc = config.extras.map(e => `+${e.nombre}`).join(', ');
      details.push(`Extras: ${extraDesc}`);
      const extrasCosto = config.extras.reduce((sum, e) => sum + e.precio, 0);
      finalPrice += extrasCosto;
    }
    
    if (config.notas && config.notas.length > 0) details.push(`📝 ${config.notas}`);
    detailsText = details.join(' | ');
  }

  const itemConfigId = `${producto.id}_${finalName}_${detailsText}`;
  const existingItem = cuenta.items.find(i => i.configId === itemConfigId || (!i.configId && i.producto_id === producto.id && !config));

  if (existingItem) {
    existingItem.cantidad++;
  } else {
    cuenta.items.push({
      configId: itemConfigId,
      producto_id: Math.floor(producto.id),
      nombre: finalName,
      precio: finalPrice,
      emoji: producto.emoji || '🍦',
      cantidad: 1,
      detalles: detailsText,
      notaCocina: config?.notas || ''
    });
  }

  cuenta.total = round2(cuenta.items.reduce((sum, i) => sum + round2(i.precio * i.cantidad), 0));

  // Shadow write (instant local persistence)
  saveCollection(DB_KEYS.CUENTAS, cuentas);
  
  // Emit IMMEDIATELY so local UI updates
  emit('cuenta-updated', cuenta);
  emit('cuentas-changed', cuentas);

  // Cloud write (awaited for cross-device sync)
  await updateDoc(doc(firestore, 'cuentas', cuenta.id), {
    items: cuenta.items,
    total: cuenta.total
  });

  return cuenta;
}

export async function incrementItemQty(cuentaId, configIdOrProdId) {
  const cuentas = getCuentas();
  const cuenta = cuentas.find(c => c.id === cuentaId);
  if (!cuenta || cuenta.estado !== 'abierta') return null;

  const itemIndex = cuenta.items.findIndex(i => i.configId === configIdOrProdId || i.producto_id == configIdOrProdId);
  if (itemIndex === -1) return null;

  cuenta.items[itemIndex].cantidad++;
  cuenta.total = round2(cuenta.items.reduce((sum, i) => sum + round2(i.precio * i.cantidad), 0));

  // Shadow write (instant local persistence)
  saveCollection(DB_KEYS.CUENTAS, cuentas);
  
  // Emit IMMEDIATELY so UI updates from local data
  emit('cuenta-updated', cuenta);
  emit('cuentas-changed', cuentas);

  // Cloud write (awaited for cross-device sync)
  await updateDoc(doc(firestore, 'cuentas', cuenta.id), {
    items: cuenta.items,
    total: cuenta.total
  });

  return cuenta;
}

export async function removeItemFromCuenta(cuentaId, configIdOrProdId) {
  const cuentas = getCuentas();
  const cuenta = cuentas.find(c => c.id === cuentaId);
  if (!cuenta || cuenta.estado !== 'abierta') return null;

  const itemIndex = cuenta.items.findIndex(i => i.configId === configIdOrProdId || i.producto_id === configIdOrProdId);
  if (itemIndex === -1) return null;

  if (cuenta.items[itemIndex].cantidad > 1) {
    cuenta.items[itemIndex].cantidad--;
  } else {
    cuenta.items.splice(itemIndex, 1);
  }

  cuenta.total = round2(cuenta.items.reduce((sum, i) => sum + round2(i.precio * i.cantidad), 0));

  // Shadow write (instant local persistence)
  saveCollection(DB_KEYS.CUENTAS, cuentas);
  
  // Emit IMMEDIATELY so UI updates from local data
  emit('cuenta-updated', cuenta);
  emit('cuentas-changed', cuentas);

  // Cloud write (awaited for cross-device sync)
  await updateDoc(doc(firestore, 'cuentas', cuenta.id), {
    items: cuenta.items,
    total: cuenta.total
  });

  return cuenta;
}

export async function deleteItemFromCuenta(cuentaId, configIdOrProdId) {
  const cuentas = getCuentas();
  const cuenta = cuentas.find(c => c.id === cuentaId);
  if (!cuenta || cuenta.estado !== 'abierta') return null;

  cuenta.items = cuenta.items.filter(i => i.configId !== configIdOrProdId && i.producto_id !== configIdOrProdId);
  cuenta.total = round2(cuenta.items.reduce((sum, i) => sum + round2(i.precio * i.cantidad), 0));

  // Shadow write (instant local persistence)
  saveCollection(DB_KEYS.CUENTAS, cuentas);
  
  // Emit IMMEDIATELY so UI updates from local data
  emit('cuenta-updated', cuenta);
  emit('cuentas-changed', cuentas);

  // Cloud write (awaited for cross-device sync)
  await updateDoc(doc(firestore, 'cuentas', cuenta.id), {
    items: cuenta.items,
    total: cuenta.total
  });

  return cuenta;
}

export async function cobrarCuenta(cuentaId, metodoPago) {
  const cuentas = getCuentas();
  const cuenta = cuentas.find(c => c.id === cuentaId);
  if (!cuenta || cuenta.estado !== 'abierta') return null;
  if (cuenta.items.length === 0) return null;

  const now = new Date();
  cuenta.estado = 'cerrada';
  cuenta.metodo_pago = metodoPago;
  cuenta.fecha_cierre = getLocalDate();
  cuenta.hora_cierre = now.toTimeString().split(' ')[0];
  cuenta.timestamp_cierre = now.getTime();

  // Shadow write
  saveCollection(DB_KEYS.CUENTAS, cuentas);

  // Emit IMMEDIATELY so local UI updates
  emit('cuenta-cerrada', cuenta);
  emit('cuentas-changed', cuentas);

  // Cloud write (awaited for cross-device sync)
  await updateDoc(doc(firestore, 'cuentas', cuenta.id), cuenta);

  // Generate sales
  const sales = getSales();
  const newSales = [];
  cuenta.items.forEach(item => {
    for (let i = 0; i < item.cantidad; i++) {
      const id = generateId();
      const sale = {
        id,
        producto_id: item.producto_id,
        producto_nombre: item.nombre,
        precio: item.precio,
        metodo_pago: metodoPago,
        fecha: cuenta.fecha_cierre,
        hora: cuenta.hora_cierre,
        usuario: 'Cajero',
        timestamp: now.getTime(),
        cuenta_id: cuenta.id,
      };
      sales.push(sale);
      newSales.push(sale);
      
      // Cloud write
      setDoc(doc(firestore, 'ventas', id), sale).catch(err => {
        console.error("Error al registrar venta en Firestore:", err);
      });
    }
  });

  // Local persistence for sales
  saveCollection(DB_KEYS.VENTAS, sales);
  
  // Emits for UI update
  newSales.forEach(s => emit('sale-added', s));
  emit('sales-changed', sales);

  return cuenta;
}

export async function cancelarCuenta(cuentaId) {
  const cuentas = getCuentas();
  const cuenta = cuentas.find(c => c.id === cuentaId);
  if (!cuenta || cuenta.estado !== 'abierta') return null;

  const now = new Date();
  cuenta.estado = 'cancelada';
  cuenta.fecha_cierre = getLocalDate();
  cuenta.hora_cierre = now.toTimeString().split(' ')[0];
  cuenta.timestamp_cierre = now.getTime();

  // Shadow write
  saveCollection(DB_KEYS.CUENTAS, cuentas);
  
  // Emit IMMEDIATELY so local UI updates
  emit('cuenta-cancelada', cuenta);
  emit('cuentas-changed', cuentas);

  // Cloud write (awaited for cross-device sync)
  await updateDoc(doc(firestore, 'cuentas', cuenta.id), cuenta);

  return cuenta;
}

export function getTodayCuentas() {
  const apertura = getAperturaHoy();
  if (!apertura) return [];
  const sessionStart = apertura.timestamp_apertura;
  return getCuentas().filter(c => c.timestamp_apertura >= sessionStart);
}

export function getCuentasCerradasHoy() {
  const apertura = getAperturaHoy();
  if (!apertura) return [];
  
  const sessionStart = apertura.timestamp_apertura;
  const sessionEnd = apertura.timestamp_cierre || Infinity;
  
  return getCuentas().filter(c => 
    c.estado === 'cerrada' && 
    c.timestamp_cierre >= sessionStart &&
    c.timestamp_cierre <= sessionEnd
  );
}

export function calcCuentasSummary(cuentas) {
  const cerradas = cuentas.filter(c => c.estado === 'cerrada');
  const canceladas = cuentas.filter(c => c.estado === 'cancelada');
  const totalIngresos = round2(cerradas.reduce((sum, c) => sum + c.total, 0));
  return {
    total_cuentas: cuentas.length,
    cerradas: cerradas.length,
    canceladas: canceladas.length,
    abiertas: cuentas.filter(c => c.estado === 'abierta').length,
    total_ingresos: totalIngresos,
    promedio_por_cliente: cerradas.length > 0 ? round2(totalIngresos / cerradas.length) : 0,
  };
}

// ========================================
// Cash Closings CRUD
// ========================================

/**
 * getCierres: Derives from the Firestore-synced jornadas collection.
 * Jornadas with estado='cerrado' that have a cierre object ARE the cierres.
 * This ensures historial survives localStorage clears.
 */
export function getCierres() {
  return getAperturas()
    .filter(a => a.estado === 'cerrado' && a.cierre)
    .map(a => ({
      ...a.cierre,
      id: a.id,
      fecha: a.fecha,
      efectivo_inicial: a.efectivo_inicial,
      inventario_diario: a.inventario_diario || [],
      timestamp: a.timestamp_cierre || a.timestamp_apertura,
    }))
    .sort((a, b) => b.timestamp - a.timestamp);
}

export function addCierre(cierre) {
  // addCierre data is embedded in the jornada via cerrarDia().
  // This function keeps backward compat but no longer needs a separate collection.
  emit('cierres-changed', getCierres());
}

export function getCierreByDate(dateStr) {
  return getCierres().find(c => c.fecha === dateStr);
}

// ========================================
// Aggregation helpers
// ========================================

export function calcTotalsByMethod(sales) {
  const totals = { efectivo: 0, tarjeta: 0, transferencia: 0 };
  sales.forEach(s => {
    if (totals[s.metodo_pago] !== undefined) {
      totals[s.metodo_pago] = round2(totals[s.metodo_pago] + s.precio);
    }
  });
  return totals;
}

export function groupSalesByCuenta(sales) {
  const groups = {};
  sales.forEach(s => {
    const key = s.cuenta_id || s.id;
    if (!groups[key]) {
      groups[key] = {
        id: key,
        total: 0,
        metodo_pago: s.metodo_pago,
        fecha: s.fecha,
        hora: s.hora,
        usuario: s.usuario
      };
    }
    groups[key].total = round2(groups[key].total + s.precio);
  });
  return Object.values(groups);
}

export function calcDaySummary(sales) {
  const totals = calcTotalsByMethod(sales);
  const grouped = groupSalesByCuenta(sales);
  const total = round2(sales.reduce((sum, s) => sum + s.precio, 0));
  return {
    ...totals,
    total,
    count: grouped.length,
    average: grouped.length > 0 ? round2(total / grouped.length) : 0,
  };
}

// ========================================
// Statistics helpers
// ========================================

export function getTopProducts(sales, limit = 5) {
  const counts = {};
  sales.forEach(s => {
    if (!counts[s.producto_nombre]) {
      counts[s.producto_nombre] = { nombre: s.producto_nombre, cantidad: 0, total: 0 };
    }
    counts[s.producto_nombre].cantidad++;
    counts[s.producto_nombre].total += s.precio;
  });
  return Object.values(counts)
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, limit);
}

export function getSalesByHour(sales) {
  const hours = {};
  for (let i = 0; i < 24; i++) hours[i] = 0;
  sales.forEach(s => {
    const hour = parseInt(s.hora.split(':')[0]);
    hours[hour] += s.precio;
  });
  return hours;
}

export function getDailyTotals(sales, days = 7) {
  const result = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const offset = date.getTimezoneOffset() * 60000;
    const dateStr = new Date(date.getTime() - offset).toISOString().split('T')[0];
    const daySales = sales.filter(s => s.fecha === dateStr);
    const total = daySales.reduce((sum, s) => sum + s.precio, 0);
    result.push({
      fecha: dateStr,
      label: date.toLocaleDateString('es', { weekday: 'short', day: 'numeric' }),
      total,
      count: daySales.length,
    });
  }
  return result;
}

export function getMonthlyTotals(sales) {
  const months = {};
  sales.forEach(s => {
    const month = s.fecha.substring(0, 7); // YYYY-MM
    if (!months[month]) months[month] = { total: 0, count: 0 };
    months[month].total += s.precio;
    months[month].count++;
  });
  return Object.entries(months)
    .map(([month, data]) => ({
      month,
      label: new Date(month + '-01').toLocaleDateString('es', { month: 'short', year: 'numeric' }),
      ...data,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

// ========================================
// Init
// ========================================

export function initDB() {
  initOpciones();
  initCategories();
  initProducts();
  initUsers();
  startCloudSync();
}

// ========================================
// Apertura / Cierre del Día
// ========================================

function getAperturas() {
  return getCollection(DB_KEYS.APERTURAS);
}

function saveAperturas(data) {
  saveCollection(DB_KEYS.APERTURAS, data);
}

// Helper para obtener fecha local YYYY-MM-DD
function getLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getAperturaHoy() {
  const today = getLocalDate();
  const aperturas = getAperturas();
  // Buscamos la apertura de hoy, o la última si no hay de hoy (por si cambió de día a media jornada)
  const todayAperturas = aperturas.filter(a => a.fecha === today);
  if (todayAperturas.length > 0) {
    return todayAperturas.find(a => a.estado === 'abierto') || todayAperturas[todayAperturas.length - 1];
  }
  
  // Si no hay de hoy, pero hay una abierta de "ayer" (ej: noche), la tomamos
  const lastOpen = aperturas.find(a => a.estado === 'abierto');
  if (lastOpen) return lastOpen;

  // Sino retornamos la última registrada
  return aperturas[aperturas.length - 1] || null;
}

export async function abrirDia(efectivoInicial = 0, inventarioInicial = []) {
  const aperturas = getAperturas();
  const today = getLocalDate();
  const now = new Date();

  if (aperturas.find(a => a.fecha === today && a.estado === 'abierto')) return null;

  const id = generateId();
  const apertura = {
    id,
    fecha: today,
    hora_apertura: now.toTimeString().split(' ')[0],
    timestamp_apertura: now.getTime(),
    efectivo_inicial: round2(efectivoInicial),
    inventario_inicial: inventarioInicial,
    estado: 'abierto',
    hora_cierre: null,
    timestamp_cierre: null,
    cierre: null,
    inventario_diario: null,
  };

  // Shadow write (local)
  aperturas.push(apertura);
  saveAperturas(aperturas);
  
  // Cloud write (async)
  await setDoc(doc(firestore, 'jornadas', id), apertura);

  // Limpiar cocina de pedidos antiguos automáticamente al abrir el día
  await archivarPedidosAntiguosCocina();
  
  emit('apertura-changed', apertura);
  return apertura;
}

export async function updateEfectivoInicial(newAmount) {
  const aperturas = getAperturas();
  const apertura = aperturas.find(a => a.estado === 'abierto');
  if (!apertura) return null;

  apertura.efectivo_inicial = round2(newAmount);
  saveAperturas(aperturas);

  // Cloud write
  await updateDoc(doc(firestore, 'jornadas', apertura.id), {
    efectivo_inicial: apertura.efectivo_inicial
  });

  emit('apertura-changed', apertura);
  return apertura;
}

export async function cerrarDia(dataCierre, inventarioFinal = []) {
  const aperturas = getAperturas();
  const today = getLocalDate();
  
  // Buscamos específicamente la que está abierta
  const apertura = aperturas.find(a => a.estado === 'abierto');
  if (!apertura) return null;

  const now = new Date();
  apertura.estado = 'cerrado';
  apertura.hora_cierre = now.toTimeString().split(' ')[0];
  apertura.timestamp_cierre = now.getTime();
  apertura.cierre = dataCierre;
  
  const inventario_diario = [];
  const inicial = apertura.inventario_inicial || [];
  
  inicial.forEach(item_ini => {
    const item_fin = inventarioFinal.find(f => f.id === item_ini.id);
    const cantidad_inicial = item_ini.cantidad || 0;
    const cantidad_final = item_fin ? (item_fin.cantidad || 0) : 0;
    
    inventario_diario.push({
      id: item_ini.id,
      nombre: item_ini.nombre,
      cantidad_inicial,
      cantidad_final,
      consumo: cantidad_inicial - cantidad_final
    });
  });
  
  apertura.inventario_diario = inventario_diario;

  // Shadow write (local)
  saveAperturas(aperturas);

  // Cloud write
  await updateDoc(doc(firestore, 'jornadas', apertura.id), apertura);

  addCierre({
    ...dataCierre,
    fecha: today,
    efectivo_inicial: apertura.efectivo_inicial,
  });

  emit('apertura-changed', apertura);
  return apertura;
}

export async function reabrirDia() {
  const aperturas = getAperturas();
  // Buscamos la última cerrada (del día que sea)
  const apertura = aperturas.slice().reverse().find(a => a.estado === 'cerrado');
  if (!apertura) return null;

  apertura.estado = 'abierto';
  apertura.hora_cierre = null;
  apertura.timestamp_cierre = null;
  apertura.cierre = null;
  apertura.inventario_diario = null;

  saveAperturas(aperturas);
  // Re-write to Cloud
  const { doc, updateDoc, firestore } = await import('./firebase.js');
  await updateDoc(doc(firestore, 'jornadas', apertura.id), apertura);
  
  emit('apertura-changed', apertura);
  return apertura;
}

export function isDiaAbierto() {
  const ap = getAperturaHoy();
  return ap && ap.estado === 'abierto';
}

export function getHistorialAperturas() {
  return getAperturas().slice().sort((a, b) => b.timestamp_apertura - a.timestamp_apertura);
}

// ========================================
// Kitchen Display System (KDS)
// ========================================

export async function enviarACocina(cuentaId) {
  const cuenta = getCuentaById(cuentaId);
  if (!cuenta || cuenta.items.length === 0) return null;

  const pedidos = getCollection(DB_KEYS.COCINA);
  
  // Buscar si ya existe un pedido activo para esta cuenta
  const existingIndex = pedidos.findIndex(p => p.cuentaId === cuenta.id && p.estado !== 'listo');
  
  if (existingIndex !== -1) {
    // Actualizar pedido existente
    const pedido = pedidos[existingIndex];
    
    // Mapear items nuevos preservando el estado 'preparado' si ya existían
    const nuevosItems = cuenta.items.map(newItem => {
      // Intentamos encontrar el item anterior exacto por nombre y detalles para preservar su estado
      const oldItem = pedido.items.find(oi => oi.nombre === newItem.nombre && oi.detalles === newItem.detalles);
      return {
        ...newItem,
        preparado: oldItem ? !!oldItem.preparado : false
      };
    });

    pedido.items = nuevosItems;
    pedido.timestamp = Date.now();
    
    // Shadow write
    saveCollection(DB_KEYS.COCINA, pedidos);
    
    // Cloud update
    await updateDoc(doc(firestore, 'cocina_kds', pedido.id), {
      items: pedido.items,
      timestamp: pedido.timestamp,
      mesa: cuenta.mesa // Asegurar que se actualice la mesa si cambia (aunque usualmente no cambia)
    });
    
    localStorage.setItem('kds_ping', Date.now().toString());
    emit('cocina-updated', pedido);
    return pedido;
  } else {
    // Crear nuevo pedido
    const today = getLocalDate();
    const id = generateId();
    const nuevoPedido = {
      id,
      cuentaId: cuenta.id,
      mesa: cuenta.mesa, // Número de mesa real
      mesaNumero: cuenta.numero, // Correlativo del pedido
      timestamp: Date.now(),
      fecha: today,
      estado: 'pendiente',
      items: cuenta.items.map(item => ({ ...item, preparado: false }))
    };

    // Shadow write
    pedidos.push(nuevoPedido);
    saveCollection(DB_KEYS.COCINA, pedidos);
    
    // Cloud write
    await setDoc(doc(firestore, 'cocina_kds', id), nuevoPedido);
    
    localStorage.setItem('kds_ping', Date.now().toString());
    emit('cocina-added', nuevoPedido);
    return nuevoPedido;
  }
}

export async function actualizarItemCocina(pedidoId, itemIndex, preparado) {
  const pedidos = getCollection(DB_KEYS.COCINA);
  const index = pedidos.findIndex(p => p.id === pedidoId);
  if (index === -1) return null;

  const pedido = pedidos[index];
  if (pedido.items[itemIndex]) {
    pedido.items[itemIndex].preparado = preparado;
    
    // Shadow write
    saveCollection(DB_KEYS.COCINA, pedidos);
    
    // Cloud write
    await updateDoc(doc(firestore, 'cocina_kds', pedidoId), {
      items: pedido.items
    });
    
    localStorage.setItem('kds_ping', Date.now().toString());
    emit('cocina-updated', pedido);
    return pedido;
  }
  return null;
}

export function getPedidosCocina() {
  return getCollection(DB_KEYS.COCINA);
}

export async function actualizarEstadoCocina(pedidoId, nuevoEstado) {
  const pedidos = getCollection(DB_KEYS.COCINA);
  const index = pedidos.findIndex(p => p.id === pedidoId);
  
  if (index !== -1) {
    pedidos[index].estado = nuevoEstado;
    saveCollection(DB_KEYS.COCINA, pedidos);
    
    // Cloud update
    await updateDoc(doc(firestore, 'cocina_kds', pedidoId), { estado: nuevoEstado });
    
    localStorage.setItem('kds_ping', Date.now().toString());
    if (socket) {
      socket.emit('sync-kds', { action: 'updated', payload: pedidos[index] });
    }
    
    emit('cocina-updated', pedidos[index]);
    return pedidos[index];
  }
  return null;
}

export async function cancelarPedidoCocina(cuentaId) {
  const pedidos = getCollection(DB_KEYS.COCINA);
  const kdsPedidos = pedidos.filter(p => p.cuentaId === cuentaId && p.estado !== 'listo');
  
  if (kdsPedidos.length > 0) {
    for (const pedido of kdsPedidos) {
      pedido.estado = 'cancelado';
      await updateDoc(doc(firestore, 'cocina_kds', pedido.id), { estado: 'cancelado' });
    }
    
    saveCollection(DB_KEYS.COCINA, pedidos);
    localStorage.setItem('kds_ping', Date.now().toString());
    emit('cocina-updated', kdsPedidos[0]); // Emitir para el primero es suficiente para disparar render
    return true;
  }
  return false;
}

/**
 * Marca como 'listo' todos los pedidos de fechas anteriores que no estén finalizados.
 */
export async function archivarPedidosAntiguosCocina() {
  const today = getLocalDate();
  const pedidos = getCollection(DB_KEYS.COCINA);
  let changed = false;

  for (const p of pedidos) {
    // Si no tiene fecha (pedidos viejos) o su fecha es anterior a hoy
    if (p.estado !== 'listo' && p.estado !== 'cancelado' && (!p.fecha || p.fecha < today)) {
      p.estado = 'listo';
      changed = true;
      // Cloud update sin await para que sea rápido (optimistic approach)
      updateDoc(doc(firestore, 'cocina_kds', p.id), { estado: 'listo' }).catch(console.error);
    }
  }

  if (changed) {
    saveCollection(DB_KEYS.COCINA, pedidos);
    localStorage.setItem('kds_ping', Date.now().toString());
    emit('cocina-updated', null);
  }
  return changed;
}

// ========================================
// 💸 Gastos CRUD (New)
// ========================================

export function getGastos() {
  return shadowStore.gastos;
}

export async function addGasto(gasto) {
  if (!isDiaAbierto()) {
    console.warn("⚠️ Intento de registrar gasto con el día cerrado.");
    return null;
  }
  const id = generateId();
  const now = new Date();
  const nuevoGasto = {
    id,
    ...gasto,
    fecha: getLocalDate(),
    hora: now.toTimeString().split(' ')[0],
    timestamp: now.getTime()
  };

  // Shadow write
  shadowStore.gastos.push(nuevoGasto);
  saveCollection(DB_KEYS.GASTOS, shadowStore.gastos);
  
  // Cloud write
  await setDoc(doc(firestore, 'gastos', id), nuevoGasto);
  
  emit('gastos-changed', shadowStore.gastos);
  return nuevoGasto;
}

/**
 * Get expenses only from the CURRENT jornada (after the current apertura).
 */
export function getGastosForJornada() {
  const apertura = getAperturaHoy();
  if (!apertura || apertura.estado !== 'abierto') {
    // Si el día está cerrado, los gastos del día actual (sesión activa) quedan en 0 / vacíos.
    return [];
  }
  // Only expenses made after this apertura opened
  return getGastos().filter(g => g.timestamp >= apertura.timestamp_apertura);
}

export function getGastosSummary() {
  const all = getGastos();
  const now = new Date();
  
  // Daily (Current session)
  const daily = getGastosForJornada();
  
  // Weekly (Natural Week, starting Monday)
  const monday = new Date(now);
  const day = now.getDay(); // 0 is Sun, 1 is Mon
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  monday.setDate(diff);
  monday.setHours(0,0,0,0);
  
  const weekly = all.filter(g => g.timestamp >= monday.getTime());
  
  return {
    daily: daily.reduce((s, g) => s + (g.monto || 0), 0),
    weekly: weekly.reduce((s, g) => s + (g.monto || 0), 0),
    total: all.reduce((s, g) => s + (g.monto || 0), 0)
  };
}

// ========================================
// Global Cloud Reporting Queries
// ========================================

/**
 * Fetch sales from Firestore within a date range
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 */
export async function getGlobalSales(startDate = null, endDate = null) {
  const ventasRef = collection(firestore, 'ventas');
  let q;
  
  if (startDate && endDate) {
    q = query(
      ventasRef, 
      where('fecha', '>=', startDate), 
      where('fecha', '<=', endDate),
      orderBy('fecha', 'desc'),
      orderBy('hora', 'desc')
    );
  } else {
    q = query(ventasRef, orderBy('timestamp', 'desc'), limit(1000));
  }
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data());
}

/**
 * Fetch expenses from Firestore within a date range
 */
export async function getGlobalGastos(startDate = null, endDate = null) {
  const gastosRef = collection(firestore, 'gastos');
  let q;
  
  if (startDate && endDate) {
    q = query(
      gastosRef, 
      where('fecha', '>=', startDate), 
      where('fecha', '<=', endDate),
      orderBy('fecha', 'desc')
    );
  } else {
    q = query(gastosRef, orderBy('timestamp', 'desc'), limit(1000));
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data());
}

// ========================================
// 👤 Usuarios & Auth CRUD
// ========================================

export function getUsuarios() {
  return getCollection(DB_KEYS.USUARIOS);
}

export function initUsers() {
  const existing = getCollection(DB_KEYS.USUARIOS);
  if (existing.length === 0) {
    const defaults = [
      { id: 'u1', nombre: 'GERENTE', rol: 'jefe', pin: '112233', activo: true },
      { id: 'u2', nombre: 'MESERO 1', rol: 'mesero', pin: '445566', activo: true },
      { id: 'u3', nombre: 'DESARROLLADOR', rol: 'desarrollador', pin: '998877', activo: true }
    ];
    saveCollection(DB_KEYS.USUARIOS, defaults);
    return defaults;
  }
  return existing;
}

export function getUserByPIN(pin) {
  const users = getUsuarios();
  return users.find(u => u.pin === pin && u.activo) || null;
}

/**
 * Updates a user's pin (Developer only)
 */
export async function updateUserPIN(userId, newPin) {
  const users = getUsuarios();
  const index = users.findIndex(u => u.id === userId);
  if (index === -1) return null;
  
  users[index].pin = newPin;
  saveCollection(DB_KEYS.USUARIOS, users);
  
  await updateDoc(doc(firestore, 'usuarios', userId), { pin: newPin });
  emit('users-changed', users);
  return users[index];
}

let currentUser = JSON.parse(localStorage.getItem('heladeria_current_user') || 'null');

export function getCurrentUser() {
  return currentUser;
}

export function setCurrentUser(user) {
  currentUser = user;
  if (user) {
    localStorage.setItem('heladeria_current_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('heladeria_current_user');
  }
  emit('user-logged-in', user);
}

// ========================================
// 🧼 Production Prep: Reset Data
// ========================================

/**
 * PURGE all testing data (Ventas, Jornadas, Cuentas, Cocina, Gastos)
 * PRESERVES: Category, Products, Options, Insumos, Users.
 */
export async function resetToProduction() {
  const collectionsToClear = ['ventas', 'jornadas', 'cuentas', 'cocina_kds', 'gastos'];
  const localKeysToClear = [
    DB_KEYS.VENTAS, 
    DB_KEYS.APERTURAS, 
    DB_KEYS.CUENTAS, 
    DB_KEYS.COCINA, 
    DB_KEYS.GASTOS, 
    DB_KEYS.CIERRES
  ];

  console.log("🧹 Iniciando limpieza de base de datos...");

  // 1. Clear Local Storage
  localKeysToClear.forEach(key => localStorage.removeItem(key));

  // 2. Clear Firestore Collections
  for (const colName of collectionsToClear) {
    try {
      const qSnapshot = await getDocs(collection(firestore, colName));
      const deletePromises = qSnapshot.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deletePromises);
      console.log(`✅ Colección '${colName}' limpiada.`);
    } catch (err) {
      console.error(`❌ Error al limpiar colección '${colName}':`, err);
    }
  }

  console.log("✨ Base de datos purgada. Reiniciando...");
  
  // 3. Clear memory and push notification
  emit('database-reset', true);
  
  return true;
}


