const login = document.querySelector("#billingLogin");
const loginForm = document.querySelector("#billingLoginForm");
const loginMessage = document.querySelector("#billingLoginMessage");
const privateSections = document.querySelectorAll(".billing-private");
const studentList = document.querySelector("#billingStudentList");
const searchInput = document.querySelector("#billingSearch");
const billingForm = document.querySelector("#billingForm");
const billingList = document.querySelector("#billingList");
const billingStudentTitle = document.querySelector("#billingStudentTitle");
const billingStudentMeta = document.querySelector("#billingStudentMeta");
const billingTotal = document.querySelector("#billingTotal");

const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0
});

let adminPassword = "";
let students = [];
let selectedIndex = 0;

function setPrivateVisible(isVisible) {
  privateSections.forEach((section) => {
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

function filteredStudents() {
  const term = searchInput.value.trim().toLowerCase();
  if (!term) return students;

  return students.filter((student) =>
    [student.studentName, student.studentId, student.gradeLevel].join(" ").toLowerCase().includes(term)
  );
}

function renderStudentList() {
  const visibleStudents = filteredStudents();

  if (visibleStudents.length === 0) {
    studentList.innerHTML = '<p class="empty-message">No student accounts found.</p>';
    return;
  }

  studentList.innerHTML = visibleStudents
    .map((student) => {
      const index = students.findIndex((item) => item.id === student.id);
      const total = (student.bills || []).reduce((sum, bill) => sum + (Number(bill.amount) || 0), 0);

      return `
        <button class="admin-student-button ${index === selectedIndex ? "active" : ""}" type="button" data-index="${index}">
          <strong>${escapeHtml(student.studentName)}</strong>
          <span>${escapeHtml(student.studentId)} | ${escapeHtml(student.gradeLevel)}</span>
          <small>${peso.format(total)}</small>
        </button>
      `;
    })
    .join("");
}

function renderBilling() {
  const student = students[selectedIndex];

  if (!student) {
    billingStudentTitle.textContent = "No student selected";
    billingStudentMeta.textContent = "Create student accounts first.";
    billingTotal.textContent = peso.format(0);
    billingList.innerHTML = "";
    billingForm.hidden = true;
    return;
  }

  billingForm.hidden = false;
  billingStudentTitle.textContent = student.studentName;
  billingStudentMeta.textContent = `${student.studentId} | ${student.gradeLevel} | ${student.guardianName}`;

  const bills = student.bills || [];
  const total = bills.reduce((sum, bill) => sum + (Number(bill.amount) || 0), 0);
  billingTotal.textContent = peso.format(total);

  if (bills.length === 0) {
    billingList.innerHTML = '<p class="empty-message">No bill items yet.</p>';
    return;
  }

  billingList.innerHTML = bills
    .map(
      (bill) => `
        <div class="billing-row">
          <label>
            Bill
            <input data-bill-id="${bill.id}" data-field="label" value="${escapeHtml(bill.label)}">
          </label>
          <label>
            Amount
            <input data-bill-id="${bill.id}" data-field="amount" type="number" min="0" step="1" value="${Number(bill.amount) || 0}">
          </label>
          <button class="danger-button" type="button" data-remove-bill="${bill.id}">Remove</button>
        </div>
      `
    )
    .join("");
}

function renderAll() {
  renderStudentList();
  renderBilling();
}

async function loadStudents() {
  const result = await api("/api/admin/students");
  students = result.students;
  if (selectedIndex >= students.length) selectedIndex = 0;
  renderAll();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  adminPassword = String(formData.get("adminPassword") || "");

  try {
    await loadStudents();
  } catch (error) {
    loginMessage.textContent = error.message;
    return;
  }

  login.hidden = true;
  setPrivateVisible(true);
});

searchInput.addEventListener("input", renderStudentList);

studentList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-index]");
  if (!button) return;

  selectedIndex = Number(button.dataset.index);
  renderAll();
});

billingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const student = students[selectedIndex];
  if (!student) return;

  const formData = new FormData(billingForm);
  await api(`/api/admin/students/${student.id}/bills`, {
    method: "POST",
    body: JSON.stringify({
      label: formData.get("billName"),
      amount: Number(formData.get("billAmount")) || 0
    })
  });

  billingForm.reset();
  await loadStudents();
});

billingList.addEventListener("change", async (event) => {
  const input = event.target;
  if (!input.dataset.field) return;

  const student = students[selectedIndex];
  const bill = student.bills.find((item) => String(item.id) === String(input.dataset.billId));
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

billingList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-remove-bill]");
  if (!button) return;

  const student = students[selectedIndex];
  await api(`/api/admin/students/${student.id}/bills/${button.dataset.removeBill}`, {
    method: "DELETE"
  });

  await loadStudents();
});

setPrivateVisible(false);
