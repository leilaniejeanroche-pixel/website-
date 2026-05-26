const announcementsList = document.querySelector("#announcementsList");

const fallbackAnnouncements = [
  {
    category: "Important",
    title: "Enrollment Requirements",
    description: "Please prepare report card, birth certificate, good moral certificate, and recent ID photo for enrollment processing.",
    important: true
  },
  {
    category: "Reminder",
    title: "Wear Complete School Uniform",
    description: "Students are reminded to wear the proper school uniform and ID during school days.",
    important: false
  },
  {
    category: "Office",
    title: "Payment Office Schedule",
    description: "The school office is open for account concerns from Monday to Friday, 8:00 AM to 4:00 PM.",
    important: false
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

function renderAnnouncements(announcements) {
  announcementsList.innerHTML = announcements
    .map(
      (announcement) => `
        <article class="announcement-card ${announcement.important ? "important" : ""}">
          <p class="eyebrow">${escapeHtml(announcement.category)}</p>
          <h2>${escapeHtml(announcement.title)}</h2>
          <p>${escapeHtml(announcement.description)}</p>
        </article>
      `
    )
    .join("");
}

fetch("/api/announcements")
  .then((response) => response.json())
  .then((data) => renderAnnouncements(data.announcements.length ? data.announcements : fallbackAnnouncements))
  .catch(() => renderAnnouncements(fallbackAnnouncements));
