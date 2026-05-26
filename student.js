const profile = document.querySelector("#studentProfile");
const dashboard = document.querySelector("#studentDashboard");
const subjectList = document.querySelector("#subjectList");
const billList = document.querySelector("#billList");
const billTotal = document.querySelector("#billTotal");
const sessionKey = "spaiStudentSession";

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

function showLoginRequired() {
  dashboard.hidden = true;
  profile.innerHTML = `
    <div>
      <p class="eyebrow">Login Required</p>
      <h1>Student dashboard is private</h1>
      <p>Please sign in first to view your subjects and bill.</p>
      <a class="contact-button" href="login.html">Go to Student Login</a>
    </div>
  `;
}

function renderAccount(account) {
  const subjects = getSubjects(account.gradeLevel);
  const bills = account.bills || [];
  const total = bills.reduce((sum, bill) => sum + (Number(bill.amount) || 0), 0);

  profile.innerHTML = `
    <div>
      <p class="eyebrow">Student Dashboard</p>
      <h1>${escapeHtml(account.studentName)}</h1>
      <p>${escapeHtml(account.studentId)} | ${escapeHtml(account.gradeLevel)}</p>
      <button class="small-button logout-button" id="logoutButton" type="button">Log Out</button>
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

  document.querySelector("#logoutButton").addEventListener("click", () => {
    sessionStorage.removeItem(sessionKey);
    window.location.href = "login.html";
  });
}

const storedSession = sessionStorage.getItem(sessionKey);

if (!storedSession) {
  showLoginRequired();
} else {
  renderAccount(JSON.parse(storedSession));
}
