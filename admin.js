const adminLogin = document.querySelector("#adminLogin");
const adminLoginForm = document.querySelector("#adminLoginForm");
const adminLoginMessage = document.querySelector("#adminLoginMessage");
const adminSections = document.querySelectorAll(".portal-hero, .admin-summary, .admin-tools, .content-editor");
const eventForm = document.querySelector("#eventForm");
const announcementForm = document.querySelector("#announcementForm");
const digitalFormForm = document.querySelector("#digitalFormForm");
const adminEventsList = document.querySelector("#adminEventsList");
const adminAnnouncementsList = document.querySelector("#adminAnnouncementsList");
const adminFormsList = document.querySelector("#adminFormsList");
const studentCount = document.querySelector("#studentCount");
const eventCount = document.querySelector("#eventCount");
const announcementCount = document.querySelector("#announcementCount");
const formCount = document.querySelector("#formCount");

let adminPassword = "";
let students = [];
let events = [];
let announcements = [];
let digitalForms = [];

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

async function loadContent() {
  const [eventsResult, announcementsResult, formsResult] = await Promise.all([
    api("/api/admin/events"),
    api("/api/admin/announcements"),
    api("/api/admin/forms")
  ]);

  events = eventsResult.events;
  announcements = announcementsResult.announcements;
  digitalForms = formsResult.forms;
  renderEventsEditor();
  renderAnnouncementsEditor();
  renderFormsEditor();
  renderSummary();
}

function renderSummary() {
  studentCount.textContent = students.length;
  eventCount.textContent = events.length;
  announcementCount.textContent = announcements.length;
  formCount.textContent = digitalForms.length;
}

function renderStudents() {
  renderSummary();
}

function renderEventsEditor() {
  if (events.length === 0) {
    adminEventsList.innerHTML = '<p class="empty-message">No events yet. Add the first school event above.</p>';
    return;
  }

  adminEventsList.innerHTML = events
    .map(
      (event) => `
        <div class="content-editor-item">
          <label>
            Date
            <input data-event-id="${event.id}" data-field="eventDate" value="${escapeHtml(event.eventDate)}">
          </label>
          <label>
            Category
            <input data-event-id="${event.id}" data-field="category" value="${escapeHtml(event.category)}">
          </label>
          <label>
            Title
            <input data-event-id="${event.id}" data-field="title" value="${escapeHtml(event.title)}">
          </label>
          <label>
            Description
            <textarea data-event-id="${event.id}" data-field="description">${escapeHtml(event.description)}</textarea>
          </label>
          <button class="danger-button" type="button" data-remove-event="${event.id}">Remove</button>
        </div>
      `
    )
    .join("");
}

function renderAnnouncementsEditor() {
  if (announcements.length === 0) {
    adminAnnouncementsList.innerHTML = '<p class="empty-message">No announcements yet. Add the first announcement above.</p>';
    return;
  }

  adminAnnouncementsList.innerHTML = announcements
    .map(
      (announcement) => `
        <div class="content-editor-item">
          <label>
            Category
            <input data-announcement-id="${announcement.id}" data-field="category" value="${escapeHtml(announcement.category)}">
          </label>
          <label>
            Title
            <input data-announcement-id="${announcement.id}" data-field="title" value="${escapeHtml(announcement.title)}">
          </label>
          <label>
            Description
            <textarea data-announcement-id="${announcement.id}" data-field="description">${escapeHtml(announcement.description)}</textarea>
          </label>
          <label class="checkbox-label">
            <input data-announcement-id="${announcement.id}" data-field="important" type="checkbox" ${announcement.important ? "checked" : ""}>
            Important
          </label>
          <button class="danger-button" type="button" data-remove-announcement="${announcement.id}">Remove</button>
        </div>
      `
    )
    .join("");
}

function renderFormsEditor() {
  if (digitalForms.length === 0) {
    adminFormsList.innerHTML = '<p class="empty-message">No digital forms yet. Add the first form above.</p>';
    return;
  }

  adminFormsList.innerHTML = digitalForms
    .map(
      (form) => `
        <div class="content-editor-item">
          <label>
            Form title
            <input data-form-id="${form.id}" data-field="title" value="${escapeHtml(form.title)}">
          </label>
          <label>
            Description
            <textarea data-form-id="${form.id}" data-field="description">${escapeHtml(form.description)}</textarea>
          </label>
          <label>
            Button label
            <input data-form-id="${form.id}" data-field="buttonLabel" value="${escapeHtml(form.buttonLabel)}">
          </label>
          <button class="danger-button" type="button" data-remove-form="${form.id}">Remove</button>
        </div>
      `
    )
    .join("");
}

eventForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(eventForm);
  await api("/api/admin/events", {
    method: "POST",
    body: JSON.stringify(Object.fromEntries(formData.entries()))
  });

  eventForm.reset();
  await loadContent();
});

adminEventsList.addEventListener("change", async (event) => {
  const input = event.target;
  if (!input.dataset.field) return;

  const currentEvent = events.find((item) => String(item.id) === String(input.dataset.eventId));
  const nextEvent = {
    ...currentEvent,
    [input.dataset.field]: input.value
  };

  await api(`/api/admin/events/${input.dataset.eventId}`, {
    method: "PUT",
    body: JSON.stringify(nextEvent)
  });

  await loadContent();
});

adminEventsList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-remove-event]");
  if (!button) return;

  await api(`/api/admin/events/${button.dataset.removeEvent}`, {
    method: "DELETE"
  });

  await loadContent();
});

announcementForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(announcementForm);
  await api("/api/admin/announcements", {
    method: "POST",
    body: JSON.stringify({
      category: formData.get("category"),
      title: formData.get("title"),
      description: formData.get("description"),
      important: formData.get("important") === "on"
    })
  });

  announcementForm.reset();
  await loadContent();
});

adminAnnouncementsList.addEventListener("change", async (event) => {
  const input = event.target;
  if (!input.dataset.field) return;

  const currentAnnouncement = announcements.find((item) => String(item.id) === String(input.dataset.announcementId));
  const nextAnnouncement = {
    ...currentAnnouncement,
    [input.dataset.field]: input.dataset.field === "important" ? input.checked : input.value
  };

  await api(`/api/admin/announcements/${input.dataset.announcementId}`, {
    method: "PUT",
    body: JSON.stringify(nextAnnouncement)
  });

  await loadContent();
});

adminAnnouncementsList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-remove-announcement]");
  if (!button) return;

  await api(`/api/admin/announcements/${button.dataset.removeAnnouncement}`, {
    method: "DELETE"
  });

  await loadContent();
});

digitalFormForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(digitalFormForm);
  await api("/api/admin/forms", {
    method: "POST",
    body: JSON.stringify(Object.fromEntries(formData.entries()))
  });

  digitalFormForm.reset();
  await loadContent();
});

adminFormsList.addEventListener("change", async (event) => {
  const input = event.target;
  if (!input.dataset.field) return;

  const currentForm = digitalForms.find((item) => String(item.id) === String(input.dataset.formId));
  const nextForm = {
    ...currentForm,
    [input.dataset.field]: input.value
  };

  await api(`/api/admin/forms/${input.dataset.formId}`, {
    method: "PUT",
    body: JSON.stringify(nextForm)
  });

  await loadContent();
});

adminFormsList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-remove-form]");
  if (!button) return;

  await api(`/api/admin/forms/${button.dataset.removeForm}`, {
    method: "DELETE"
  });

  await loadContent();
});

adminLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(adminLoginForm);
  adminPassword = String(formData.get("adminPassword") || "");

  try {
    await loadStudents();
    await loadContent();
  } catch (error) {
    adminLoginMessage.textContent = error.message;
    return;
  }

  adminLogin.hidden = true;
  setAdminVisible(true);
});

setAdminVisible(false);
