const fs = require("fs");
const path = require("path");

const usePostgres = Boolean(process.env.DATABASE_URL);

let sqliteDb;
let pgPool;

if (usePostgres) {
  const { Pool } = require("pg");

  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined
  });
} else {
  const Database = require("better-sqlite3");
  const dataDir = path.join(__dirname, "data");
  const dbPath = path.join(dataDir, "school.db");

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  sqliteDb = new Database(dbPath);
  sqliteDb.pragma("journal_mode = WAL");
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

async function init() {
  if (usePostgres) {
    await pgPool.query(postgresSchema);
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

  sqliteDb.prepare("DELETE FROM bills WHERE student_id_ref = ? AND id = ?").run(studentId, billId);
  return getStudentById(studentId);
}

module.exports = {
  addBill,
  createStudent,
  findStudentByLogin,
  findStudentByUsername,
  getAllStudents,
  getStudentById,
  init,
  removeBill,
  updateBill
};
