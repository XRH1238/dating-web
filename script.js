const countdownEl = document.querySelector("[data-trip-date]");
const daysLeftEl = document.querySelector("#days-left");

if (countdownEl && daysLeftEl) {
  const target = new Date(countdownEl.dataset.tripDate).getTime();
  const now = Date.now();
  const days = Math.max(0, Math.ceil((target - now) / (1000 * 60 * 60 * 24)));
  daysLeftEl.textContent = String(days);
}

const panel = document.querySelector("#quick-panel");
const form = document.querySelector("#quick-form");
const panelTitle = document.querySelector("#panel-title");
const panelLabel = document.querySelector("#panel-label");
let activeType = "plan";

document.querySelectorAll("[data-open-panel]").forEach((button) => {
  button.addEventListener("click", () => {
    activeType = button.dataset.openPanel;
    panelTitle.textContent = activeType === "plan" ? "添加出游计划" : "写一条出游记录";
    panelLabel.textContent = activeType === "plan" ? "New Plan" : "New Memory";
    panel.classList.add("is-open");
    panel.setAttribute("aria-hidden", "false");
    form.elements.title.focus();
  });
});

document.querySelector(".panel-close").addEventListener("click", closePanel);
panel.addEventListener("click", (event) => {
  if (event.target === panel) {
    closePanel();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && panel.classList.contains("is-open")) {
    closePanel();
  }
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const entry = {
    title: data.get("title").trim(),
    date: data.get("date").trim(),
    description: data.get("description").trim(),
  };

  if (activeType === "plan") {
    addPlan(entry);
  } else {
    addRecord(entry);
  }

  form.reset();
  closePanel();
});

function closePanel() {
  panel.classList.remove("is-open");
  panel.setAttribute("aria-hidden", "true");
}

function addPlan(entry) {
  const list = document.querySelector("#plan-list");
  const article = document.createElement("article");
  article.className = "mini-plan";
  article.innerHTML = `
    <span class="date-pill">${escapeHtml(entry.date.slice(-5) || entry.date)}</span>
    <div>
      <h3>${escapeHtml(entry.title)}</h3>
      <p>${escapeHtml(entry.description)}</p>
    </div>
  `;
  list.prepend(article);
}

function addRecord(entry) {
  const list = document.querySelector("#record-list");
  const article = document.createElement("article");
  article.className = "timeline-item";
  article.innerHTML = `
    <time>${escapeHtml(entry.date)}</time>
    <div>
      <h3>${escapeHtml(entry.title)}</h3>
      <p>${escapeHtml(entry.description)}</p>
    </div>
  `;
  list.prepend(article);
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[char];
  });
}
