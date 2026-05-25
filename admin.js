const studentList = document.querySelector("#adminStudentList");
const adminLogin = document.querySelector("#adminLogin");
const adminLoginForm = document.querySelector("#adminLoginForm");
const adminLoginMessage = document.querySelector("#adminLoginMessage");
const adminSections = document.querySelectorAll(".portal-hero, .admin-grid");
const selectedStudentTitle = document.querySelector("#selectedStudentTitle");
const openStudentPage = document.querySelector("#openStudentPage");
const billForm = document.querySelector("#billForm");
const editableBillList = document.querySelector("#editableBillList");
const adminBillTotal = document.querySelector("#adminBillTotal");

const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0
});

let selectedIndex = 0;
let adminPassword = "";
let students = [];

function setAdminVisible(isVisible) {
  adminSections.forEach((section) => {
    section.hidden = !isVisible;
  });
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };

    return entities[character];
  });
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-admin-password": adminPassword,
      ...(options.headers || {})
    }
  });
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "Request failed.");
  }

  return result;
}

async function loadStudents() {
  const result = await api("/api/admin/students");
  students = result.students;
  renderStudents();
}

function renderStudents() {
  if (students.length === 0) {
    studentList.innerHTML = '<p class="empty-message">No student accounts yet. Create one in the Student Portal first.</p>';
    selectedStudentTitle.textContent = "No student selected";
    editableBillList.innerHTML = "";
    adminBillTotal.textContent = peso.format(0);
    billForm.hidden = true;
    openStudentPage.href = "portal.html";
    return;
  }

  if (selectedIndex >= students.length) {
    selectedIndex = 0;
  }

  studentList.innerHTML = students
    .map(
      (student, index) => `
        <button class="admin-student-button ${index === selectedIndex ? "active" : ""}" type="button" data-index="${index}">
          <strong>${escapeHtml(student.studentName)}</strong>
          <span>${escapeHtml(student.studentId)} | ${escapeHtml(student.gradeLevel)}</span>
        </button>
      `
    )
    .join("");

  billForm.hidden = false;
  renderEditor();
}

function renderEditor() {
  const student = students[selectedIndex];

  if (!student) return;

  selectedStudentTitle.textContent = student.studentName;
  openStudentPage.href = "student.html";

  editableBillList.innerHTML = (student.bills || [])
    .map(
      (bill, billIndex) => `
        <div class="editable-bill-item">
          <label>
            Bill name
            <input data-bill-id="${bill.id}" data-bill-index="${billIndex}" data-field="label" value="${escapeHtml(bill.label)}">
          </label>
          <label>
            Amount
            <input data-bill-id="${bill.id}" data-bill-index="${billIndex}" data-field="amount" type="number" min="0" step="1" value="${Number(bill.amount) || 0}">
          </label>
          <button class="danger-button" type="button" data-remove-bill="${bill.id}">Remove</button>
        </div>
      `
    )
    .join("");

  const total = (student.bills || []).reduce((sum, bill) => sum + (Number(bill.amount) || 0), 0);
  adminBillTotal.textContent = peso.format(total);
}

studentList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-index]");
  if (!button) return;

  selectedIndex = Number(button.dataset.index);
  renderStudents();
});

billForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const student = students[selectedIndex];
  if (!student) return;

  const formData = new FormData(billForm);

  await api(`/api/admin/students/${student.id}/bills`, {
    method: "POST",
    body: JSON.stringify({
      label: formData.get("billName"),
      amount: Number(formData.get("billAmount")) || 0
    })
  });

  billForm.reset();
  await loadStudents();
});

editableBillList.addEventListener("change", async (event) => {
  const input = event.target;
  if (!input.dataset.field) return;

  const student = students[selectedIndex];
  const bill = student.bills[Number(input.dataset.billIndex)];
  const nextBill = {
    ...bill,
    [input.dataset.field]: input.dataset.field === "amount" ? Number(input.value) || 0 : input.value
  };

  await api(`/api/admin/students/${student.id}/bills/${input.dataset.billId}`, {
    method: "PUT",
    body: JSON.stringify(nextBill)
  });

  await loadStudents();
});

editableBillList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-remove-bill]");
  if (!button) return;

  const student = students[selectedIndex];

  await api(`/api/admin/students/${student.id}/bills/${button.dataset.removeBill}`, {
    method: "DELETE"
  });

  await loadStudents();
});

adminLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(adminLoginForm);
  adminPassword = String(formData.get("adminPassword") || "");

  try {
    await loadStudents();
  } catch (error) {
    adminLoginMessage.textContent = error.message;
    return;
  }

  adminLogin.hidden = true;
  setAdminVisible(true);
});

setAdminVisible(false);
