const profile = document.querySelector("#studentProfile");
const dashboard = document.querySelector("#studentDashboard");
const subjectList = document.querySelector("#subjectList");
const billList = document.querySelector("#billList");
const billTotal = document.querySelector("#billTotal");
const balanceStatusCard = document.querySelector("#balanceStatusCard");
const balanceStatusLabel = document.querySelector("#balanceStatusLabel");
const balanceDueDate = document.querySelector("#balanceDueDate");
const balanceReminder = document.querySelector("#balanceReminder");
const dashboardOverview = document.querySelector("#dashboardOverview");
const dashboardLists = document.querySelector("#dashboardLists");
const balanceCardAmount = document.querySelector("#balanceCardAmount");
const eventCardTitle = document.querySelector("#eventCardTitle");
const eventCardDate = document.querySelector("#eventCardDate");
const announcementCardCount = document.querySelector("#announcementCardCount");
const dashboardAnnouncements = document.querySelector("#dashboardAnnouncements");
const dashboardEvents = document.querySelector("#dashboardEvents");
const topbarStudentName = document.querySelector("#topbarStudentName");
const topbarStudentMeta = document.querySelector("#topbarStudentMeta");
const topbarLogoutButton = document.querySelector("#topbarLogoutButton");
const quickActions = document.querySelector(".student-quick-actions");
const researchChecklist = document.querySelector("#researchChecklist");
const requestForm = document.querySelector("#requestForm");
const requestList = document.querySelector("#requestList");
const lostFoundForm = document.querySelector("#lostFoundForm");
const lostFoundList = document.querySelector("#lostFoundList");
const sessionKey = "spaiStudentSession";
const requestsKey = "spaiStudentRequests";
const lostFoundKey = "spaiLostFoundItems";
const researchKey = "spaiResearchProgress";
let activeAccount = null;

const researchMilestones = [
  "Choose research title",
  "Submit chapter 1",
  "Adviser consultation",
  "Data gathering",
  "Final defense"
];

const subjectsByLevel = {
  default: [
    { subject: "English", teacher: "Mrs. Maria Santos" },
    { subject: "Mathematics", teacher: "Mr. Daniel Cruz" },
    { subject: "Science", teacher: "Ms. Angelica Reyes" },
    { subject: "Filipino", teacher: "Mrs. Lorna Garcia" },
    { subject: "Araling Panlipunan", teacher: "Mr. Paolo Ramos" },
    { subject: "MAPEH", teacher: "Ms. Clara Mendoza" },
    { subject: "Values Education", teacher: "Mrs. Elena Flores" }
  ],
  senior: [
    { subject: "Oral Communication", teacher: "Mrs. Maria Santos" },
    { subject: "General Mathematics", teacher: "Mr. Daniel Cruz" },
    { subject: "Earth and Life Science", teacher: "Ms. Angelica Reyes" },
    { subject: "Personal Development", teacher: "Mrs. Elena Flores" },
    { subject: "Physical Education", teacher: "Ms. Clara Mendoza" },
    { subject: "Research", teacher: "Mr. Paolo Ramos" }
  ]
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
  dashboardOverview.hidden = true;
  dashboardLists.hidden = true;
  quickActions.hidden = true;
  document.querySelector(".feature-grid").hidden = true;
  topbarStudentName.textContent = "Student Profile";
  topbarStudentMeta.textContent = "Please sign in";
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
  activeAccount = account;
  const subjects = getSubjects(account.gradeLevel);
  const bills = account.bills || [];
  const total = bills.reduce((sum, bill) => sum + (Number(bill.amount) || 0), 0);
  const balanceStatus = getBalanceStatus(total);

  topbarStudentName.textContent = account.studentName;
  topbarStudentMeta.textContent = `${account.studentId} | ${account.gradeLevel}`;
  balanceCardAmount.textContent = peso.format(total);
  balanceStatusCard.className = `balance-status-card ${balanceStatus.className}`;
  balanceStatusLabel.textContent = balanceStatus.label;
  balanceDueDate.textContent = `Due Date: ${balanceStatus.dueDate}`;
  balanceReminder.textContent = balanceStatus.reminder;

  profile.innerHTML = `
    <div>
      <p class="eyebrow">Student Dashboard</p>
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
    .map(
      (item) => `
        <div class="subject-item">
          <span>${escapeHtml(item.subject)}</span>
          <small>${escapeHtml(item.teacher)}</small>
        </div>
      `
    )
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
  renderResearchChecklist();
  renderRequests();
  renderLostFound();
}

function getBalanceStatus(total) {
  if (total <= 0) {
    return {
      className: "paid",
      label: "Paid",
      dueDate: "No active due date",
      reminder: "Your account has no remaining balance."
    };
  }

  const today = new Date();
  const dueDate = new Date(today.getFullYear(), 5, 20);
  const daysUntilDue = Math.ceil((dueDate - today) / 86400000);

  if (daysUntilDue < 0) {
    return {
      className: "overdue",
      label: "Overdue",
      dueDate: "June 20",
      reminder: "Please settle your balance at the cashier as soon as possible."
    };
  }

  if (daysUntilDue <= 7) {
    return {
      className: "near-due",
      label: "Near due date",
      dueDate: "June 20",
      reminder: "Your payment deadline is near. Prepare your payment before the due date."
    };
  }

  return {
    className: "pending",
    label: "Pending",
    dueDate: "June 20",
    reminder: "You still have time before the payment deadline."
  };
}

function readStoredList(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch (error) {
    return [];
  }
}

function writeStoredList(key, items) {
  localStorage.setItem(key, JSON.stringify(items));
}

function getStudentKey() {
  return activeAccount ? activeAccount.studentId || activeAccount.username || activeAccount.studentName : "guest";
}

function renderResearchChecklist() {
  const progress = readStoredList(researchKey);
  const studentKey = getStudentKey();
  const completed = progress.find((item) => item.studentKey === studentKey)?.completed || [];

  researchChecklist.innerHTML = researchMilestones
    .map(
      (milestone, index) => `
        <label class="tracker-item">
          <input type="checkbox" data-research-index="${index}" ${completed.includes(index) ? "checked" : ""}>
          <span>${escapeHtml(milestone)}</span>
        </label>
      `
    )
    .join("");
}

function saveResearchProgress(index, isChecked) {
  const progress = readStoredList(researchKey);
  const studentKey = getStudentKey();
  let studentProgress = progress.find((item) => item.studentKey === studentKey);

  if (!studentProgress) {
    studentProgress = { studentKey, studentName: activeAccount.studentName, completed: [] };
    progress.push(studentProgress);
  }

  studentProgress.completed = isChecked
    ? Array.from(new Set([...studentProgress.completed, index]))
    : studentProgress.completed.filter((item) => item !== index);

  writeStoredList(researchKey, progress);
}

function renderRequests() {
  const studentKey = getStudentKey();
  const requests = readStoredList(requestsKey).filter((item) => item.studentKey === studentKey);

  if (requests.length === 0) {
    requestList.innerHTML = '<p class="empty-message">No requests submitted yet.</p>';
    return;
  }

  requestList.innerHTML = requests
    .slice(-3)
    .reverse()
    .map(
      (request) => `
        <article>
          <strong>${escapeHtml(request.type)}</strong>
          <span>${escapeHtml(request.status)} | ${escapeHtml(request.date)}</span>
          <small>${escapeHtml(request.details)}</small>
        </article>
      `
    )
    .join("");
}

function renderLostFound() {
  const items = readStoredList(lostFoundKey);

  if (items.length === 0) {
    lostFoundList.innerHTML = '<p class="empty-message">No lost or found items posted yet.</p>';
    return;
  }

  lostFoundList.innerHTML = items
    .slice(-4)
    .reverse()
    .map(
      (item) => `
        <article>
          <strong>${escapeHtml(item.type)}: ${escapeHtml(item.item)}</strong>
          <span>${escapeHtml(item.location)} | ${escapeHtml(item.status)}</span>
          <small>Posted by ${escapeHtml(item.studentName)}</small>
        </article>
      `
    )
    .join("");
}

function renderCompactList(container, items, emptyMessage) {
  if (!items.length) {
    container.innerHTML = `<p class="empty-message">${escapeHtml(emptyMessage)}</p>`;
    return;
  }

  container.innerHTML = items
    .slice(0, 3)
    .map(
      (item) => `
        <article>
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.meta)}</span>
        </article>
      `
    )
    .join("");
}

async function loadDashboardContent() {
  try {
    const [announcementsResponse, eventsResponse] = await Promise.all([
      fetch("/api/announcements"),
      fetch("/api/events")
    ]);

    if (!announcementsResponse.ok || !eventsResponse.ok) {
      throw new Error("Dashboard content is unavailable.");
    }

    const announcementsResult = await announcementsResponse.json();
    const eventsResult = await eventsResponse.json();
    const announcements = announcementsResult.announcements || [];
    const events = eventsResult.events || [];
    const sortedAnnouncements = [...announcements].sort((first, second) => Number(second.important) - Number(first.important));
    const nextEvent = events[0];

    announcementCardCount.textContent = `${announcements.length} New Posts`;
    eventCardTitle.textContent = nextEvent ? nextEvent.title : "School Event";
    eventCardDate.textContent = nextEvent ? nextEvent.eventDate : "See calendar";

    renderCompactList(
      dashboardAnnouncements,
      sortedAnnouncements.map((item) => ({
        title: item.title,
        meta: `${item.important ? "Urgent" : item.category || "General"}`
      })),
      "No announcements posted yet."
    );

    renderCompactList(
      dashboardEvents,
      events.map((item) => ({
        title: item.title,
        meta: item.eventDate || item.category || "School calendar"
      })),
      "No events posted yet."
    );
  } catch (error) {
    announcementCardCount.textContent = "0 New Posts";
    eventCardTitle.textContent = "School Calendar";
    eventCardDate.textContent = "Open events";
    renderCompactList(dashboardAnnouncements, [], "Announcements load when the server is running.");
    renderCompactList(dashboardEvents, [], "Events load when the server is running.");
  }
}

topbarLogoutButton.addEventListener("click", () => {
  sessionStorage.removeItem(sessionKey);
  window.location.href = "login.html";
});

researchChecklist.addEventListener("change", (event) => {
  const input = event.target.closest("[data-research-index]");
  if (!input) return;
  saveResearchProgress(Number(input.dataset.researchIndex), input.checked);
});

requestForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!activeAccount) return;

  const formData = new FormData(requestForm);
  const requests = readStoredList(requestsKey);
  requests.push({
    id: Date.now(),
    studentKey: getStudentKey(),
    studentName: activeAccount.studentName,
    studentId: activeAccount.studentId,
    type: formData.get("type"),
    details: formData.get("details"),
    status: "Pending",
    date: new Date().toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })
  });

  writeStoredList(requestsKey, requests);
  requestForm.reset();
  renderRequests();
});

lostFoundForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!activeAccount) return;

  const formData = new FormData(lostFoundForm);
  const items = readStoredList(lostFoundKey);
  items.push({
    id: Date.now(),
    studentKey: getStudentKey(),
    studentName: activeAccount.studentName,
    type: formData.get("type"),
    item: formData.get("item"),
    location: formData.get("location"),
    status: "Open",
    date: new Date().toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })
  });

  writeStoredList(lostFoundKey, items);
  lostFoundForm.reset();
  renderLostFound();
});

const storedSession = sessionStorage.getItem(sessionKey);

if (!storedSession) {
  showLoginRequired();
} else {
  renderAccount(JSON.parse(storedSession));
  loadDashboardContent();
}
