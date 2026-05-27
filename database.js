const fs = require("fs");
const path = require("path");

const usePostgres = Boolean(process.env.DATABASE_URL);

let sqliteDb;
let pgPool;
let useJsonStore = false;
const dataDir = path.join(__dirname, "data");
const jsonDbPath = path.join(dataDir, "db.json");

if (usePostgres) {
  const { Pool } = require("pg");

  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined
  });
} else {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  try {
    const Database = require("better-sqlite3");
    const dbPath = path.join(dataDir, "school.db");
    sqliteDb = new Database(dbPath);
    sqliteDb.pragma("journal_mode = WAL");
  } catch (error) {
    useJsonStore = true;
    console.warn("better-sqlite3 is unavailable. Using data/db.json fallback storage.");
  }
}

function normalizeJsonStore(store = {}) {
  return {
    students: Array.isArray(store.students) ? store.students : [],
    events: Array.isArray(store.events) ? store.events : [],
    announcements: Array.isArray(store.announcements) ? store.announcements : [],
    digitalForms: Array.isArray(store.digitalForms) ? store.digitalForms : []
  };
}

function readJsonStore() {
  if (!fs.existsSync(jsonDbPath)) {
    return normalizeJsonStore();
  }

  try {
    return normalizeJsonStore(JSON.parse(fs.readFileSync(jsonDbPath, "utf8")));
  } catch (error) {
    return normalizeJsonStore();
  }
}

function writeJsonStore(store) {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  fs.writeFileSync(jsonDbPath, JSON.stringify(normalizeJsonStore(store), null, 2));
}

function nextId(items) {
  return items.reduce((largest, item) => Math.max(largest, Number(item.id) || 0), 0) + 1;
}

const sqliteSchema = `
  CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    student_name TEXT NOT NULL,
    student_id TEXT NOT NULL,
    grade_level TEXT NOT NULL,
    guardian_name TEXT NOT NULL,
    guardian_contact TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id_ref TEXT NOT NULL,
    label TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (student_id_ref) REFERENCES students(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_date TEXT NOT NULL,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    important INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS digital_forms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    button_label TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0
  );
`;

const postgresSchema = `
  CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    student_name TEXT NOT NULL,
    student_id TEXT NOT NULL,
    grade_level TEXT NOT NULL,
    guardian_name TEXT NOT NULL,
    guardian_contact TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bills (
    id SERIAL PRIMARY KEY,
    student_id_ref TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    event_date TEXT NOT NULL,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS announcements (
    id SERIAL PRIMARY KEY,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    important INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS digital_forms (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    button_label TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0
  );
`;

function rowToStudent(row) {
  if (!row) return null;

  return {
    id: row.id,
    studentName: row.student_name,
    studentId: row.student_id,
    gradeLevel: row.grade_level,
    guardianName: row.guardian_name,
    guardianContact: row.guardian_contact,
    username: row.username,
    password: row.password,
    createdAt: row.created_at
  };
}

function rowToBill(row) {
  return {
    id: row.id,
    label: row.label,
    amount: Number(row.amount) || 0
  };
}

function rowToEvent(row) {
  return {
    id: row.id,
    eventDate: row.event_date,
    category: row.category,
    title: row.title,
    description: row.description
  };
}

function rowToAnnouncement(row) {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    description: row.description,
    important: Boolean(row.important)
  };
}

function rowToDigitalForm(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    buttonLabel: row.button_label
  };
}

async function init() {
  if (usePostgres) {
    await pgPool.query(postgresSchema);
    return;
  }

  if (useJsonStore) {
    writeJsonStore(readJsonStore());
    return;
  }

  sqliteDb.exec(sqliteSchema);
}

async function getBills(studentId) {
  if (usePostgres) {
    const result = await pgPool.query(
      "SELECT id, label, amount FROM bills WHERE student_id_ref = $1 ORDER BY position, id",
      [studentId]
    );
    return result.rows.map(rowToBill);
  }

  if (useJsonStore) {
    const store = readJsonStore();
    const student = store.students.find((item) => item.id === studentId);
    return (student?.bills || []).map((bill) => ({
      id: bill.id,
      label: bill.label,
      amount: Number(bill.amount) || 0
    }));
  }

  return sqliteDb
    .prepare("SELECT id, label, amount FROM bills WHERE student_id_ref = ? ORDER BY position, id")
    .all(studentId)
    .map(rowToBill);
}

async function withBills(student) {
  return {
    ...student,
    bills: await getBills(student.id)
  };
}

async function createStudent(student, bills) {
  if (usePostgres) {
    const client = await pgPool.connect();

    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO students (
          id, student_name, student_id, grade_level, guardian_name,
          guardian_contact, username, password, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          student.id,
          student.studentName,
          student.studentId,
          student.gradeLevel,
          student.guardianName,
          student.guardianContact,
          student.username,
          student.password,
          student.createdAt
        ]
      );

      for (const [index, bill] of bills.entries()) {
        await client.query(
          "INSERT INTO bills (student_id_ref, label, amount, position) VALUES ($1, $2, $3, $4)",
          [student.id, bill.label, bill.amount, index]
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    return withBills(student);
  }

  if (useJsonStore) {
    const store = readJsonStore();
    store.students.push({
      ...student,
      bills: bills.map((bill, index) => ({
        id: index + 1,
        label: bill.label,
        amount: Number(bill.amount) || 0
      }))
    });
    writeJsonStore(store);
    return withBills(student);
  }

  const insertStudent = sqliteDb.prepare(`
    INSERT INTO students (
      id, student_name, student_id, grade_level, guardian_name,
      guardian_contact, username, password, created_at
    )
    VALUES (
      @id, @studentName, @studentId, @gradeLevel, @guardianName,
      @guardianContact, @username, @password, @createdAt
    )
  `);

  const insertBill = sqliteDb.prepare(`
    INSERT INTO bills (student_id_ref, label, amount, position)
    VALUES (?, ?, ?, ?)
  `);

  const transaction = sqliteDb.transaction(() => {
    insertStudent.run(student);
    bills.forEach((bill, index) => {
      insertBill.run(student.id, bill.label, bill.amount, index);
    });
  });

  transaction();
  return withBills(student);
}

async function findStudentByUsername(username) {
  if (usePostgres) {
    const result = await pgPool.query("SELECT * FROM students WHERE username = $1", [username]);
    return rowToStudent(result.rows[0]);
  }

  if (useJsonStore) {
    return readJsonStore().students.find((student) => student.username === username) || null;
  }

  return rowToStudent(sqliteDb.prepare("SELECT * FROM students WHERE username = ?").get(username));
}

async function findStudentByLogin(username, password) {
  let student;

  if (usePostgres) {
    const result = await pgPool.query("SELECT * FROM students WHERE username = $1 AND password = $2", [
      username,
      password
    ]);
    student = rowToStudent(result.rows[0]);
  } else if (useJsonStore) {
    student =
      readJsonStore().students.find((item) => item.username === username && item.password === password) || null;
  } else {
    student = rowToStudent(
      sqliteDb.prepare("SELECT * FROM students WHERE username = ? AND password = ?").get(username, password)
    );
  }

  return student ? withBills(student) : null;
}

async function getAllStudents() {
  if (usePostgres) {
    const result = await pgPool.query("SELECT * FROM students ORDER BY created_at DESC");
    return Promise.all(result.rows.map(rowToStudent).map(withBills));
  }

  if (useJsonStore) {
    return readJsonStore()
      .students.slice()
      .sort((first, second) => String(second.createdAt).localeCompare(String(first.createdAt)))
      .map((student) => ({
        ...student,
        bills: student.bills || []
      }));
  }

  return Promise.all(
    sqliteDb
      .prepare("SELECT * FROM students ORDER BY created_at DESC")
      .all()
      .map(rowToStudent)
      .map(withBills)
  );
}

async function getStudentById(id) {
  let student;

  if (usePostgres) {
    const result = await pgPool.query("SELECT * FROM students WHERE id = $1", [id]);
    student = rowToStudent(result.rows[0]);
  } else if (useJsonStore) {
    student = readJsonStore().students.find((item) => item.id === id) || null;
  } else {
    student = rowToStudent(sqliteDb.prepare("SELECT * FROM students WHERE id = ?").get(id));
  }

  return student ? withBills(student) : null;
}

async function addBill(studentId, bill) {
  if (usePostgres) {
    const positionResult = await pgPool.query(
      "SELECT COALESCE(MAX(position), -1) + 1 AS next_position FROM bills WHERE student_id_ref = $1",
      [studentId]
    );
    await pgPool.query("INSERT INTO bills (student_id_ref, label, amount, position) VALUES ($1, $2, $3, $4)", [
      studentId,
      bill.label,
      bill.amount,
      positionResult.rows[0].next_position || 0
    ]);
    return getStudentById(studentId);
  }

  if (useJsonStore) {
    const store = readJsonStore();
    const student = store.students.find((item) => item.id === studentId);
    if (!student) return null;
    student.bills = student.bills || [];
    student.bills.push({
      id: nextId(student.bills),
      label: bill.label,
      amount: Number(bill.amount) || 0
    });
    writeJsonStore(store);
    return getStudentById(studentId);
  }

  const nextPosition =
    sqliteDb
      .prepare("SELECT COALESCE(MAX(position), -1) + 1 AS next_position FROM bills WHERE student_id_ref = ?")
      .get(studentId).next_position || 0;

  sqliteDb.prepare("INSERT INTO bills (student_id_ref, label, amount, position) VALUES (?, ?, ?, ?)").run(
    studentId,
    bill.label,
    bill.amount,
    nextPosition
  );

  return getStudentById(studentId);
}

async function updateBill(studentId, billId, bill) {
  if (usePostgres) {
    const result = await pgPool.query(
      "UPDATE bills SET label = $1, amount = $2 WHERE student_id_ref = $3 AND id = $4",
      [bill.label, bill.amount, studentId, billId]
    );
    return result.rowCount > 0 ? getStudentById(studentId) : null;
  }

  if (useJsonStore) {
    const store = readJsonStore();
    const student = store.students.find((item) => item.id === studentId);
    const currentBill = student?.bills?.find((item) => String(item.id) === String(billId));
    if (!currentBill) return null;
    currentBill.label = bill.label;
    currentBill.amount = Number(bill.amount) || 0;
    writeJsonStore(store);
    return getStudentById(studentId);
  }

  const result = sqliteDb
    .prepare("UPDATE bills SET label = ?, amount = ? WHERE student_id_ref = ? AND id = ?")
    .run(bill.label, bill.amount, studentId, billId);

  return result.changes > 0 ? getStudentById(studentId) : null;
}

async function removeBill(studentId, billId) {
  if (usePostgres) {
    await pgPool.query("DELETE FROM bills WHERE student_id_ref = $1 AND id = $2", [studentId, billId]);
    return getStudentById(studentId);
  }

  if (useJsonStore) {
    const store = readJsonStore();
    const student = store.students.find((item) => item.id === studentId);
    if (student) {
      student.bills = (student.bills || []).filter((bill) => String(bill.id) !== String(billId));
      writeJsonStore(store);
    }
    return getStudentById(studentId);
  }

  sqliteDb.prepare("DELETE FROM bills WHERE student_id_ref = ? AND id = ?").run(studentId, billId);
  return getStudentById(studentId);
}

async function listEvents() {
  if (usePostgres) {
    const result = await pgPool.query("SELECT * FROM events ORDER BY position, id");
    return result.rows.map(rowToEvent);
  }

  if (useJsonStore) {
    return readJsonStore().events;
  }

  return sqliteDb.prepare("SELECT * FROM events ORDER BY position, id").all().map(rowToEvent);
}

async function addEvent(event) {
  if (usePostgres) {
    const positionResult = await pgPool.query("SELECT COALESCE(MAX(position), -1) + 1 AS next_position FROM events");
    await pgPool.query(
      "INSERT INTO events (event_date, category, title, description, position) VALUES ($1, $2, $3, $4, $5)",
      [event.eventDate, event.category, event.title, event.description, positionResult.rows[0].next_position || 0]
    );
    return listEvents();
  }

  if (useJsonStore) {
    const store = readJsonStore();
    store.events.push({
      id: nextId(store.events),
      eventDate: event.eventDate,
      category: event.category,
      title: event.title,
      description: event.description
    });
    writeJsonStore(store);
    return listEvents();
  }

  const nextPosition = sqliteDb.prepare("SELECT COALESCE(MAX(position), -1) + 1 AS next_position FROM events").get()
    .next_position;
  sqliteDb
    .prepare("INSERT INTO events (event_date, category, title, description, position) VALUES (?, ?, ?, ?, ?)")
    .run(event.eventDate, event.category, event.title, event.description, nextPosition || 0);
  return listEvents();
}

async function updateEvent(id, event) {
  if (usePostgres) {
    await pgPool.query("UPDATE events SET event_date = $1, category = $2, title = $3, description = $4 WHERE id = $5", [
      event.eventDate,
      event.category,
      event.title,
      event.description,
      id
    ]);
    return listEvents();
  }

  if (useJsonStore) {
    const store = readJsonStore();
    const currentEvent = store.events.find((item) => String(item.id) === String(id));
    if (currentEvent) {
      currentEvent.eventDate = event.eventDate;
      currentEvent.category = event.category;
      currentEvent.title = event.title;
      currentEvent.description = event.description;
      writeJsonStore(store);
    }
    return listEvents();
  }

  sqliteDb
    .prepare("UPDATE events SET event_date = ?, category = ?, title = ?, description = ? WHERE id = ?")
    .run(event.eventDate, event.category, event.title, event.description, id);
  return listEvents();
}

async function removeEvent(id) {
  if (usePostgres) {
    await pgPool.query("DELETE FROM events WHERE id = $1", [id]);
    return listEvents();
  }

  if (useJsonStore) {
    const store = readJsonStore();
    store.events = store.events.filter((event) => String(event.id) !== String(id));
    writeJsonStore(store);
    return listEvents();
  }

  sqliteDb.prepare("DELETE FROM events WHERE id = ?").run(id);
  return listEvents();
}

async function listAnnouncements() {
  if (usePostgres) {
    const result = await pgPool.query("SELECT * FROM announcements ORDER BY position, id");
    return result.rows.map(rowToAnnouncement);
  }

  if (useJsonStore) {
    return readJsonStore().announcements;
  }

  return sqliteDb.prepare("SELECT * FROM announcements ORDER BY position, id").all().map(rowToAnnouncement);
}

async function addAnnouncement(announcement) {
  if (usePostgres) {
    const positionResult = await pgPool.query(
      "SELECT COALESCE(MAX(position), -1) + 1 AS next_position FROM announcements"
    );
    await pgPool.query(
      "INSERT INTO announcements (category, title, description, important, position) VALUES ($1, $2, $3, $4, $5)",
      [
        announcement.category,
        announcement.title,
        announcement.description,
        announcement.important ? 1 : 0,
        positionResult.rows[0].next_position || 0
      ]
    );
    return listAnnouncements();
  }

  if (useJsonStore) {
    const store = readJsonStore();
    store.announcements.push({
      id: nextId(store.announcements),
      category: announcement.category,
      title: announcement.title,
      description: announcement.description,
      important: Boolean(announcement.important)
    });
    writeJsonStore(store);
    return listAnnouncements();
  }

  const nextPosition = sqliteDb
    .prepare("SELECT COALESCE(MAX(position), -1) + 1 AS next_position FROM announcements")
    .get().next_position;
  sqliteDb
    .prepare("INSERT INTO announcements (category, title, description, important, position) VALUES (?, ?, ?, ?, ?)")
    .run(
      announcement.category,
      announcement.title,
      announcement.description,
      announcement.important ? 1 : 0,
      nextPosition || 0
    );
  return listAnnouncements();
}

async function updateAnnouncement(id, announcement) {
  if (usePostgres) {
    await pgPool.query(
      "UPDATE announcements SET category = $1, title = $2, description = $3, important = $4 WHERE id = $5",
      [announcement.category, announcement.title, announcement.description, announcement.important ? 1 : 0, id]
    );
    return listAnnouncements();
  }

  if (useJsonStore) {
    const store = readJsonStore();
    const currentAnnouncement = store.announcements.find((item) => String(item.id) === String(id));
    if (currentAnnouncement) {
      currentAnnouncement.category = announcement.category;
      currentAnnouncement.title = announcement.title;
      currentAnnouncement.description = announcement.description;
      currentAnnouncement.important = Boolean(announcement.important);
      writeJsonStore(store);
    }
    return listAnnouncements();
  }

  sqliteDb
    .prepare("UPDATE announcements SET category = ?, title = ?, description = ?, important = ? WHERE id = ?")
    .run(announcement.category, announcement.title, announcement.description, announcement.important ? 1 : 0, id);
  return listAnnouncements();
}

async function removeAnnouncement(id) {
  if (usePostgres) {
    await pgPool.query("DELETE FROM announcements WHERE id = $1", [id]);
    return listAnnouncements();
  }

  if (useJsonStore) {
    const store = readJsonStore();
    store.announcements = store.announcements.filter((announcement) => String(announcement.id) !== String(id));
    writeJsonStore(store);
    return listAnnouncements();
  }

  sqliteDb.prepare("DELETE FROM announcements WHERE id = ?").run(id);
  return listAnnouncements();
}

async function listDigitalForms() {
  if (usePostgres) {
    const result = await pgPool.query("SELECT * FROM digital_forms ORDER BY position, id");
    return result.rows.map(rowToDigitalForm);
  }

  if (useJsonStore) {
    return readJsonStore().digitalForms;
  }

  return sqliteDb.prepare("SELECT * FROM digital_forms ORDER BY position, id").all().map(rowToDigitalForm);
}

async function addDigitalForm(form) {
  if (usePostgres) {
    const positionResult = await pgPool.query(
      "SELECT COALESCE(MAX(position), -1) + 1 AS next_position FROM digital_forms"
    );
    await pgPool.query(
      "INSERT INTO digital_forms (title, description, button_label, position) VALUES ($1, $2, $3, $4)",
      [form.title, form.description, form.buttonLabel, positionResult.rows[0].next_position || 0]
    );
    return listDigitalForms();
  }

  if (useJsonStore) {
    const store = readJsonStore();
    store.digitalForms.push({
      id: nextId(store.digitalForms),
      title: form.title,
      description: form.description,
      buttonLabel: form.buttonLabel
    });
    writeJsonStore(store);
    return listDigitalForms();
  }

  const nextPosition = sqliteDb
    .prepare("SELECT COALESCE(MAX(position), -1) + 1 AS next_position FROM digital_forms")
    .get().next_position;
  sqliteDb
    .prepare("INSERT INTO digital_forms (title, description, button_label, position) VALUES (?, ?, ?, ?)")
    .run(form.title, form.description, form.buttonLabel, nextPosition || 0);
  return listDigitalForms();
}

async function updateDigitalForm(id, form) {
  if (usePostgres) {
    await pgPool.query(
      "UPDATE digital_forms SET title = $1, description = $2, button_label = $3 WHERE id = $4",
      [form.title, form.description, form.buttonLabel, id]
    );
    return listDigitalForms();
  }

  if (useJsonStore) {
    const store = readJsonStore();
    const currentForm = store.digitalForms.find((item) => String(item.id) === String(id));
    if (currentForm) {
      currentForm.title = form.title;
      currentForm.description = form.description;
      currentForm.buttonLabel = form.buttonLabel;
      writeJsonStore(store);
    }
    return listDigitalForms();
  }

  sqliteDb
    .prepare("UPDATE digital_forms SET title = ?, description = ?, button_label = ? WHERE id = ?")
    .run(form.title, form.description, form.buttonLabel, id);
  return listDigitalForms();
}

async function removeDigitalForm(id) {
  if (usePostgres) {
    await pgPool.query("DELETE FROM digital_forms WHERE id = $1", [id]);
    return listDigitalForms();
  }

  if (useJsonStore) {
    const store = readJsonStore();
    store.digitalForms = store.digitalForms.filter((form) => String(form.id) !== String(id));
    writeJsonStore(store);
    return listDigitalForms();
  }

  sqliteDb.prepare("DELETE FROM digital_forms WHERE id = ?").run(id);
  return listDigitalForms();
}

module.exports = {
  addAnnouncement,
  addBill,
  addDigitalForm,
  addEvent,
  createStudent,
  findStudentByLogin,
  findStudentByUsername,
  getAllStudents,
  getStudentById,
  init,
  listAnnouncements,
  listDigitalForms,
  listEvents,
  removeAnnouncement,
  removeBill,
  removeDigitalForm,
  removeEvent,
  updateAnnouncement,
  updateBill,
  updateDigitalForm,
  updateEvent
};
