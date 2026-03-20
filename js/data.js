/**
 * data.js
 * LocalStorage wrapper acting as our mock database.
 */

const DB_KEY = 'disasterHelpDb';

// Seed users that should always exist
const SEED_USERS = [
  {
    id: 'usr_admin',
    name: 'System Admin',
    phone: '0000000000',
    password: 'admin',
    role: 'admin',
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'usr_volunteer_helper',
    name: 'Helper',
    phone: '123456',
    password: 'Shubham',
    role: 'volunteer',
    createdAt: '2026-01-01T00:00:00.000Z'
  }
];

const initialData = {
  users: [...SEED_USERS],
  requests: [],
  alerts: [],
  chats: {}
};

// Initialize DB - always ensure seed users are present
function initDb() {
  if (!localStorage.getItem(DB_KEY)) {
    localStorage.setItem(DB_KEY, JSON.stringify(initialData));
  } else {
    // Merge seed users into existing DB so they always exist
    const db = JSON.parse(localStorage.getItem(DB_KEY));
    let changed = false;
    SEED_USERS.forEach(seed => {
      if (!db.users.find(u => u.id === seed.id)) {
        db.users.push(seed);
        changed = true;
      }
    });
    if (changed) localStorage.setItem(DB_KEY, JSON.stringify(db));
  }
}

// Get the full DB
function getDb() {
  return JSON.parse(localStorage.getItem(DB_KEY));
}

// Save DB
function saveDb(data) {
  localStorage.setItem(DB_KEY, JSON.stringify(data));
}

// Check if a user matches
function findUser(phoneOrUsername, password, role) {
  const db = getDb();
  if (role === 'admin') {
    // Admin username is always the literal string 'admin'
    if (phoneOrUsername.toLowerCase() !== 'admin') return undefined;
    return db.users.find(u => u.role === 'admin' && u.password === password);
  }
  return db.users.find(u => u.phone === phoneOrUsername && u.password === password && u.role === role);
}

// Register a new user
function createUser(user) {
  const db = getDb();
  // Check if phone already exists for this role
  if (db.users.find(u => u.phone === user.phone && u.role === user.role)) {
    throw new Error('Phone number already registered for this role');
  }

  const newUser = {
    id: 'usr_' + Date.now().toString(36) + Math.random().toString(36).substr(2),
    ...user,
    createdAt: new Date().toISOString()
  };

  db.users.push(newUser);
  saveDb(db);
  return newUser;
}

// Session Management
function setSession(user) {
  localStorage.setItem('currentUser', JSON.stringify({
    id: user.id,
    name: user.name,
    role: user.role
  }));
}

function getSession() {
  const s = localStorage.getItem('currentUser');
  return s ? JSON.parse(s) : null;
}

function clearSession() {
  localStorage.removeItem('currentUser');
}

function requireAuth(allowedRoles) {
  const session = getSession();
  if (!session) {
    window.location.href = 'login.html';
    return null;
  }
  if (allowedRoles && !allowedRoles.includes(session.role)) {
    // Redirect based on actual role
    if (session.role === 'admin') window.location.href = 'admin-dashboard.html';
    else if (session.role === 'volunteer') window.location.href = 'volunteer-dashboard.html';
    else window.location.href = 'victim-dashboard.html';
    return null;
  }
  return session;
}

// Run init immediately on load
initDb();
