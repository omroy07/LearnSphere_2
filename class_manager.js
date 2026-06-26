// class_manager.js – Handles teacher class sessions and progress aggregation

const CLASS_SESSIONS_KEY = 'learnsphere_class_sessions_v1';

function _loadClasses() {
  try {
    const raw = localStorage.getItem(CLASS_SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('LearnSphere: Failed to load class sessions', e);
    return [];
  }
}

function _saveClasses(classes) {
  try {
    localStorage.setItem(CLASS_SESSIONS_KEY, JSON.stringify(classes));
  } catch (e) {
    console.warn('LearnSphere: Failed to save class sessions', e);
  }
}

function generateInviteCode(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function createClassSession({ name, topics = [], dueDate }) {
  const classes = _loadClasses();
  const id = 'cls_' + Date.now();
  const inviteCode = generateInviteCode();
  const newClass = {
    id,
    name,
    inviteCode,
    topics,
    dueDate: dueDate || null,
    attempts: [], // each { studentId, quizId, score }
    createdAt: new Date().toISOString()
  };
  classes.push(newClass);
  _saveClasses(classes);
  return newClass;
}

function recordClassAttempt(classId, { studentId = 'anonymous', quizId, score }) {
  if (!classId) return;
  const classes = _loadClasses();
  const cls = classes.find(c => c.id === classId);
  if (!cls) return;
  cls.attempts.push({ studentId, quizId, score, timestamp: Date.now() });
  _saveClasses(classes);
}

function getClassStats(classId) {
  const classes = _loadClasses();
  const cls = classes.find(c => c.id === classId);
  if (!cls) return null;
  const total = cls.attempts.length;
  const avgScore = total ? (cls.attempts.reduce((a, b) => a + b.score, 0) / total).toFixed(2) : '-';
  const bestScore = total ? Math.max(...cls.attempts.map(a => a.score)).toFixed(2) : '-';
  return { ...cls, totalAttempts: total, avgScore, bestScore };
}

function getAllClassStats() {
  const classes = _loadClasses();
  return classes.map(c => {
    const total = c.attempts.length;
    const avgScore = total ? (c.attempts.reduce((a, b) => a + b.score, 0) / total).toFixed(2) : '-';
    const bestScore = total ? Math.max(...c.attempts.map(a => a.score)).toFixed(2) : '-';
    return { id: c.id, name: c.name, inviteCode: c.inviteCode, totalAttempts: total, avgScore, bestScore };
  });
}

// Expose globally for other modules
window.classManager = {
  createClassSession,
  recordClassAttempt,
  getClassStats,
  getAllClassStats
};
