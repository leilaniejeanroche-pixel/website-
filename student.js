const profile = document.querySelector("#studentProfile");
const subjectList = document.querySelector("#subjectList");
const billList = document.querySelector("#billList");
const billTotal = document.querySelector("#billTotal");
const loginForm = document.querySelector("#studentLoginForm");
const loginMessage = document.querySelector("#studentLoginMessage");
const privateContent = document.querySelectorAll(".private-content");

const subjectsByLevel = {
  default: ["English", "Mathematics", "Science", "Filipino", "Araling Panlipunan", "MAPEH", "Values Education"],
  senior: ["Oral Communication", "General Mathematics", "Earth and Life Science", "Personal Development", "Physical Education", "Research"]
};

const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0
});

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

function getSubjects(gradeLevel) {
  if (gradeLevel === "Grade 11" || gradeLevel === "Grade 12") {
    return subjectsByLevel.senior;
  }

  return subjectsByLevel.default;
}

function showPrivateContent() {
  privateContent.forEach((section) => {
    section.hidden = false;
  });
}

function renderAccount(account) {
  const subjects = getSubjects(account.gradeLevel);
  const bills = account.bills || [];
  const total = bills.reduce((sum, bill) => sum + (Number(bill.amount) || 0), 0);

  profile.innerHTML = `
    <div>
      <p class="eyebrow">Student Account</p>
      <h1>${escapeHtml(account.studentName)}</h1>
      <p>${escapeHtml(account.studentId)} | ${escapeHtml(account.gradeLevel)}</p>
    </div>
    <div class="profile-card">
      <span>Guardian</span>
      <strong>${escapeHtml(account.guardianName)}</strong>
      <small>${escapeHtml(account.guardianContact)}</small>
    </div>
  `;

  subjectList.innerHTML = subjects
    .map((subject) => `<div class="subject-item">${escapeHtml(subject)}</div>`)
    .join("");

  billList.innerHTML = bills
    .map(
      (bill) => `
        <div class="bill-item">
          <span>${escapeHtml(bill.label)}</span>
          <strong>${peso.format(Number(bill.amount) || 0)}</strong>
        </div>
      `
    )
    .join("");

  billTotal.textContent = peso.format(total);
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(loginForm);
  const credentials = Object.fromEntries(formData.entries());

  const response = await fetch("/api/student/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials)
  });

  const result = await response.json();

  if (!response.ok) {
    loginMessage.textContent = result.error || "Incorrect username or password.";
    return;
  }

  loginMessage.textContent = "";
  loginForm.closest(".login-panel").hidden = true;
  showPrivateContent();
  renderAccount(result.student);
});
