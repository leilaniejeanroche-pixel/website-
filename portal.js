const form = document.querySelector("#accountForm");
const accountList = document.querySelector("#accountList");

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

function renderCreatedAccount(account) {
  accountList.innerHTML = `
    <article class="account-item">
      <div>
        <strong>${escapeHtml(account.studentName)}</strong>
        <span>${escapeHtml(account.studentId)} | ${escapeHtml(account.gradeLevel)}</span>
      </div>
      <div>
        <small>Guardian</small>
        <span>${escapeHtml(account.guardianName)}</span>
      </div>
      <div>
        <small>Username</small>
        <span>${escapeHtml(account.username)}</span>
      </div>
      <a class="small-button" href="student.html">Student Login</a>
    </article>
  `;
}

accountList.innerHTML = '<p class="empty-message">Created accounts are stored in the backend. Use Admin to view all students.</p>';

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const account = Object.fromEntries(formData.entries());

  const response = await fetch("/api/students", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(account)
  });

  const result = await response.json();

  if (!response.ok) {
    accountList.innerHTML = `<p class="empty-message">${escapeHtml(result.error || "Unable to create account.")}</p>`;
    return;
  }

  form.reset();
  renderCreatedAccount(result.student);
});
