const homeAnnouncements = document.querySelector("#homeAnnouncements");
const homeEvents = document.querySelector("#homeEvents");

const fallbackAnnouncements = [
  { category: "Important", title: "Enrollment Requirements", description: "Prepare report card, birth certificate, and recent ID photo." },
  { category: "Reminder", title: "Wear Complete School Uniform", description: "Students should wear proper uniform and ID during school days." }
];

const fallbackEvents = [
  { eventDate: "June 3", title: "First Day Orientation", description: "Orientation for students and guardians." },
  { eventDate: "June 14", title: "Parent Meeting", description: "Class advisers meet parents and guardians." }
];

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

function renderMiniUpdates(container, items, type) {
  container.innerHTML = items
    .slice(0, 3)
    .map((item) => {
      const label = type === "event" ? item.eventDate : item.category;
      return `
        <article class="mini-update">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(item.title)}</strong>
          <p>${escapeHtml(item.description)}</p>
        </article>
      `;
    })
    .join("");
}

fetch("/api/announcements")
  .then((response) => response.json())
  .then((data) => renderMiniUpdates(homeAnnouncements, data.announcements.length ? data.announcements : fallbackAnnouncements, "announcement"))
  .catch(() => renderMiniUpdates(homeAnnouncements, fallbackAnnouncements, "announcement"));

fetch("/api/events")
  .then((response) => response.json())
  .then((data) => renderMiniUpdates(homeEvents, data.events.length ? data.events : fallbackEvents, "event"))
  .catch(() => renderMiniUpdates(homeEvents, fallbackEvents, "event"));
