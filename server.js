const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const database = require("./database");

const root = __dirname;
const port = process.env.PORT || 3000;
const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

const defaultBills = [
  { label: "Tuition Fee", amount: 18500 },
  { label: "Books and Modules", amount: 4250 },
  { label: "Laboratory Fee", amount: 2100 },
  { label: "Student Services", amount: 1850 }
];

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".json": "application/json; charset=utf-8"
};

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
      }
    });

    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function publicStudent(student) {
  return {
    id: student.id,
    studentName: student.studentName,
    studentId: student.studentId,
    gradeLevel: student.gradeLevel,
    guardianName: student.guardianName,
    guardianContact: student.guardianContact,
    username: student.username,
    bills: student.bills || [],
    createdAt: student.createdAt
  };
}

function requireAdmin(req, res) {
  const password = req.headers["x-admin-password"];

  if (password !== adminPassword) {
    sendJson(res, 401, { error: "Incorrect admin password." });
    return false;
  }

  return true;
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const filePath = path.normalize(path.join(root, pathname));

  if (!filePath.startsWith(root)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      fs.readFile(path.join(root, "index.html"), (fallbackError, fallbackContent) => {
        if (fallbackError) {
          sendJson(res, 404, { error: "Not found" });
          return;
        }

        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(fallbackContent);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    res.end(content);
  });
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "POST" && url.pathname === "/api/students") {
    const body = await readBody(req);
    const requiredFields = ["studentName", "studentId", "gradeLevel", "guardianName", "guardianContact", "username", "password"];
    const missingField = requiredFields.find((field) => !String(body[field] || "").trim());

    if (missingField) {
      sendJson(res, 400, { error: "Please complete all student account fields." });
      return;
    }

    if (database.findStudentByUsername(body.username)) {
      sendJson(res, 409, { error: "Username already exists." });
      return;
    }

    const student = database.createStudent(
      {
        id: crypto.randomUUID(),
        studentName: body.studentName,
        studentId: body.studentId,
        gradeLevel: body.gradeLevel,
        guardianName: body.guardianName,
        guardianContact: body.guardianContact,
        username: body.username,
        password: body.password,
        createdAt: new Date().toISOString()
      },
      defaultBills.map((bill) => ({ ...bill }))
    );

    sendJson(res, 201, { student: publicStudent(student) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/student/login") {
    const body = await readBody(req);
    const student = database.findStudentByLogin(body.username, body.password);

    if (!student) {
      sendJson(res, 401, { error: "Incorrect username or password." });
      return;
    }

    sendJson(res, 200, { student: publicStudent(student) });
    return;
  }

  if (url.pathname === "/api/admin/students") {
    if (!requireAdmin(req, res)) return;

    sendJson(res, 200, { students: database.getAllStudents().map(publicStudent) });
    return;
  }

  const billMatch = url.pathname.match(/^\/api\/admin\/students\/([^/]+)\/bills(?:\/(\d+))?$/);

  if (billMatch) {
    if (!requireAdmin(req, res)) return;

    const studentId = billMatch[1];
    const billId = Number(billMatch[2]);

    if (!database.getStudentById(studentId)) {
      sendJson(res, 404, { error: "Student not found." });
      return;
    }

    if (req.method === "POST" && !billMatch[2]) {
      const body = await readBody(req);
      const student = database.addBill(studentId, {
        label: body.label || "New Bill",
        amount: Number(body.amount) || 0
      });
      sendJson(res, 200, { student: publicStudent(student) });
      return;
    }

    if (req.method === "PUT" && billMatch[2]) {
      const body = await readBody(req);
      const student = database.updateBill(studentId, billId, {
        label: body.label || "Bill",
        amount: Number(body.amount) || 0
      });

      if (!student) {
        sendJson(res, 404, { error: "Bill not found." });
        return;
      }

      sendJson(res, 200, { student: publicStudent(student) });
      return;
    }

    if (req.method === "DELETE" && billMatch[2]) {
      const student = database.removeBill(studentId, billId);
      sendJson(res, 200, { student: publicStudent(student) });
      return;
    }
  }

  sendJson(res, 404, { error: "API route not found." });
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith("/api/")) {
    handleApi(req, res).catch(() => {
      sendJson(res, 500, { error: "Server error." });
    });
    return;
  }

  serveStatic(req, res);
});

server.listen(port, () => {
  console.log(`SPAI website running at http://localhost:${port}`);
});
