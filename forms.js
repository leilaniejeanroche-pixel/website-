const formsList = document.querySelector("#formsList");

const fallbackForms = [
  {
    title: "Inquiry Form",
    description: "Send questions about admissions, school records, or general school information.",
    buttonLabel: "Submit Inquiry"
  },
  {
    title: "Enrollment Request",
    description: "Request enrollment assistance and provide basic student information.",
    buttonLabel: "Send Request"
  },
  {
    title: "Leave Request",
    description: "Submit a student leave or absence request for school review.",
    buttonLabel: "Submit Leave"
  },
  {
    title: "Feedback Form",
    description: "Share comments, suggestions, or concerns with the school office.",
    buttonLabel: "Send Feedback"
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

function renderForms(forms) {
  formsList.innerHTML = forms
    .map(
      (form) => `
        <article class="info-form form-card">
          <h2>${escapeHtml(form.title)}</h2>
          <p>${escapeHtml(form.description)}</p>
          <label>Full name<input type="text" placeholder="Your name"></label>
          <label>Contact details<input type="text" placeholder="Phone or email"></label>
          <label>Message<textarea placeholder="Write your request"></textarea></label>
          <button class="contact-button" type="button">${escapeHtml(form.buttonLabel)}</button>
        </article>
      `
    )
    .join("");
}

fetch("/api/forms")
  .then((response) => response.json())
  .then((data) => renderForms(data.forms.length ? data.forms : fallbackForms))
  .catch(() => renderForms(fallbackForms));
