const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const dataDir = path.join(__dirname, "data");
const dbPath = path.join(dataDir, "school.db");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
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
`);

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

function getBills(studentId) {
  return db
    .prepare("SELECT id, label, amount FROM bills WHERE student_id_ref = ? ORDER BY position, id")
    .all(studentId)
    .map((bill) => ({
      id: bill.id,
      label: bill.label,
      amount: bill.amount
    }));
}

function withBills(student) {
  return {
    ...student,
    bills: getBills(student.id)
  };
}

function createStudent(student, bills) {
  const insertStudent = db.prepare(`
    INSERT INTO students (
      id, student_name, student_id, grade_level, guardian_name,
      guardian_contact, username, password, created_at
    )
    VALUES (
      @id, @studentName, @studentId, @gradeLevel, @guardianName,
      @guardianContact, @username, @password, @createdAt
    )
  `);

  const insertBill = db.prepare(`
    INSERT INTO bills (student_id_ref, label, amount, position)
    VALUES (?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    insertStudent.run(student);
    bills.forEach((bill, index) => {
      insertBill.run(student.id, bill.label, bill.amount, index);
    });
  });

  transaction();
  return withBills(student);
}

function findStudentByUsername(username) {
  const row = db.prepare("SELECT * FROM students WHERE username = ?").get(username);
  return rowToStudent(row);
}

function findStudentByLogin(username, password) {
  const row = db
    .prepare("SELECT * FROM students WHERE username = ? AND password = ?")
    .get(username, password);
  const student = rowToStudent(row);
  return student ? withBills(student) : null;
}

function getAllStudents() {
  return db
    .prepare("SELECT * FROM students ORDER BY created_at DESC")
    .all()
    .map(rowToStudent)
    .map(withBills);
}

function getStudentById(id) {
  const student = rowToStudent(db.prepare("SELECT * FROM students WHERE id = ?").get(id));
  return student ? withBills(student) : null;
}

function addBill(studentId, bill) {
  const nextPosition =
    db.prepare("SELECT COALESCE(MAX(position), -1) + 1 AS next_position FROM bills WHERE student_id_ref = ?").get(studentId)
      .next_position || 0;

  db.prepare("INSERT INTO bills (student_id_ref, label, amount, position) VALUES (?, ?, ?, ?)").run(
    studentId,
    bill.label,
    bill.amount,
    nextPosition
  );

  return getStudentById(studentId);
}

function updateBill(studentId, billId, bill) {
  const result = db
    .prepare("UPDATE bills SET label = ?, amount = ? WHERE student_id_ref = ? AND id = ?")
    .run(bill.label, bill.amount, studentId, billId);

  return result.changes > 0 ? getStudentById(studentId) : null;
}

function removeBill(studentId, billId) {
  db.prepare("DELETE FROM bills WHERE student_id_ref = ? AND id = ?").run(studentId, billId);
  return getStudentById(studentId);
}

module.exports = {
  addBill,
  createStudent,
  findStudentByLogin,
  findStudentByUsername,
  getAllStudents,
  getStudentById,
  removeBill,
  updateBill
};
