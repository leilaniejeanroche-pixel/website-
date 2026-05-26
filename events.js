const eventsList = document.querySelector("#eventsList");

const fallbackEvents = [
  {
    eventDate: "June 3",
    category: "Opening Activity",
    title: "First Day Orientation",
    description: "Students and guardians are invited to attend orientation for classroom reminders, schedules, and school policies."
  },
  {
    eventDate: "June 14",
    category: "Meeting",
    title: "Parent Meeting",
    description: "Class advisers will meet parents and guardians to discuss student support and school expectations."
  },
  {
    eventDate: "July 5",
    category: "Campus Activity",
    title: "Clean and Green Day",
    description: "A campus care activity for students, teachers, and school staff."
  }
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

function renderEvents(events) {
  eventsList.innerHTML = events
    .map(
      (event, index) => `
        <article class="news-card ${index === 0 ? "featured" : ""}">
          <span class="date-badge">${escapeHtml(event.eventDate)}</span>
          <p class="eyebrow">${escapeHtml(event.category)}</p>
          <h2>${escapeHtml(event.title)}</h2>
          <p>${escapeHtml(event.description)}</p>
        </article>
      `
    )
    .join("");
}

fetch("/api/events")
  .then((response) => response.json())
  .then((data) => renderEvents(data.events.length ? data.events : fallbackEvents))
  .catch(() => renderEvents(fallbackEvents));
