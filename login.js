const loginForm = document.querySelector("#studentLoginForm");
const loginMessage = document.querySelector("#studentLoginMessage");
const sessionKey = "spaiStudentSession";

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

  sessionStorage.setItem(sessionKey, JSON.stringify(result.student));
  loginMessage.innerHTML = `Welcome, ${escapeHtml(result.student.studentName)}. Opening your dashboard...`;
  window.location.href = "student.html";
});
