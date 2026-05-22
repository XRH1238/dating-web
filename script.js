const supabaseConfig = {
  url: "https://ueqlgutndwkfuffzkcxo.supabase.co",
  key: "sb_publishable_EplbiVXxWhAdBKKSF70RVQ_pPls9SSw",
};

const tables = {
  plans: "love_plans",
  records: "love_records",
  todos: "love_todos",
  photos: "love_photos",
};

const storageBucket = "love-photos";

const state = {
  client: null,
  backendReady: false,
  plans: [],
  records: [],
  todos: [],
  photos: [],
};

const panel = document.querySelector("#quick-panel");
const form = document.querySelector("#quick-form");
const panelTitle = document.querySelector("#panel-title");
const panelLabel = document.querySelector("#panel-label");
const todoForm = document.querySelector("#todo-form");
const photoInput = document.querySelector("#photo-input");
const cloudStatus = document.querySelector("#cloud-status");
let activeType = "plan";

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindEvents();
  renderAll();
  connectSupabase();
  await loadRemoteData();
}

function bindEvents() {
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

  form.addEventListener("submit", handleQuickSubmit);
  todoForm.addEventListener("submit", handleTodoSubmit);
  photoInput.addEventListener("change", handlePhotoUpload);
}

function connectSupabase() {
  if (!window.supabase) {
    setCloudStatus("Supabase SDK 加载失败，请检查网络。", "error");
    return;
  }

  state.client = window.supabase.createClient(supabaseConfig.url, supabaseConfig.key);
  state.backendReady = true;
  setCloudStatus("已连接 Supabase，正在同步内容。", "success");
}

async function loadRemoteData() {
  if (!state.backendReady) {
    return;
  }

  try {
    const [plans, records, todos, photos] = await Promise.all([
      fetchTable(tables.plans),
      fetchTable(tables.records),
      fetchTable(tables.todos),
      fetchTable(tables.photos),
    ]);

    state.plans = plans;
    state.records = records;
    state.todos = todos;
    state.photos = photos;
    renderAll();
    setCloudStatus("Supabase 同步完成。", "success");
  } catch (error) {
    setCloudStatus(`读取 Supabase 数据失败：${error.message}`, "error");
  }
}

async function fetchTable(tableName) {
  const { data, error } = await state.client.from(tableName).select("*").order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}

async function handleQuickSubmit(event) {
  event.preventDefault();
  const data = new FormData(form);
  const entry = {
    title: data.get("title").trim(),
    date: data.get("date").trim(),
    description: data.get("description").trim(),
  };

  if (!entry.title || !entry.date || !entry.description) {
    return;
  }

  try {
    if (activeType === "plan") {
      await createItem(tables.plans, entry, "plans");
    } else {
      await createItem(tables.records, entry, "records");
    }

    form.reset();
    closePanel();
    renderAll();
  } catch (error) {
    setCloudStatus(`保存失败：${error.message}`, "error");
  }
}

async function handleTodoSubmit(event) {
  event.preventDefault();
  const input = todoForm.elements.todo;
  const value = input.value.trim();

  if (!value) {
    return;
  }

  try {
    await createItem(tables.todos, { text: value, done: false }, "todos");
    input.value = "";
    renderTodos();
  } catch (error) {
    setCloudStatus(`添加失败：${error.message}`, "error");
  }
}

async function handlePhotoUpload(event) {
  const files = [...event.target.files].filter((file) => file.type.startsWith("image/"));
  photoInput.value = "";

  if (!files.length) {
    return;
  }

  setCloudStatus("正在上传照片...", "loading");

  for (const file of files) {
    try {
      const path = `gallery/${Date.now()}-${safeFileName(file.name)}`;
      const { error: uploadError } = await state.client.storage.from(storageBucket).upload(path, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false,
      });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = state.client.storage.from(storageBucket).getPublicUrl(path);
      await createItem(
        tables.photos,
        {
          name: file.name,
          path,
          url: data.publicUrl,
        },
        "photos"
      );
    } catch (error) {
      setCloudStatus(`照片上传失败：${error.message}`, "error");
      return;
    }
  }

  renderPhotos();
  setCloudStatus("照片上传完成。", "success");
}

async function createItem(tableName, payload, stateKey) {
  requireBackend();
  const { data, error } = await state.client.from(tableName).insert(payload).select().single();

  if (error) {
    throw error;
  }

  state[stateKey].unshift(data);
  setCloudStatus("已保存到 Supabase。", "success");
}

async function updateItem(tableName, id, patch, stateKey) {
  requireBackend();
  const { data, error } = await state.client.from(tableName).update(patch).eq("id", id).select().single();

  if (error) {
    throw error;
  }

  state[stateKey] = state[stateKey].map((item) => (item.id === id ? data : item));
  setCloudStatus("已更新 Supabase 内容。", "success");
}

async function removeItem(tableName, id, stateKey) {
  requireBackend();
  const { error } = await state.client.from(tableName).delete().eq("id", id);

  if (error) {
    throw error;
  }

  state[stateKey] = state[stateKey].filter((item) => item.id !== id);
  setCloudStatus("已从 Supabase 删除。", "success");
}

function requireBackend() {
  if (!state.backendReady) {
    throw new Error("Supabase 尚未连接，请刷新页面或检查配置。");
  }
}

function renderAll() {
  renderPlans();
  renderRecords();
  renderTodos();
  renderPhotos();
  renderNextTrip();
}

function renderPlans() {
  const list = document.querySelector("#plan-list");

  if (!state.plans.length) {
    renderEmpty(list, "还没有出游计划。", "点击“添加计划”，把下一次想去的地方写下来。", "empty-state");
    return;
  }

  list.className = "plan-list";
  list.innerHTML = state.plans.map(renderPlanItem).join("");
  list.querySelectorAll("[data-delete-plan]").forEach((button) => {
    button.addEventListener("click", async () => {
      await removeItem(tables.plans, button.dataset.deletePlan, "plans");
      renderAll();
    });
  });
}

function renderPlanItem(plan) {
  return `
    <article class="mini-plan">
      <span class="date-pill">${escapeHtml(formatShortDate(plan.date))}</span>
      <div>
        <h3>${escapeHtml(plan.title)}</h3>
        <p>${escapeHtml(plan.description)}</p>
        <div class="item-actions">
          <span>${escapeHtml(plan.date)}</span>
          <button type="button" data-delete-plan="${escapeHtml(plan.id)}">删除</button>
        </div>
      </div>
    </article>
  `;
}

function renderRecords() {
  const list = document.querySelector("#record-list");

  if (!state.records.length) {
    renderEmpty(list, "还没有出游记录。", "旅行回来后，可以把那天发生的事写在这里。", "timeline empty-state");
    return;
  }

  list.className = "timeline";
  list.innerHTML = state.records.map(renderRecordItem).join("");
  list.querySelectorAll("[data-delete-record]").forEach((button) => {
    button.addEventListener("click", async () => {
      await removeItem(tables.records, button.dataset.deleteRecord, "records");
      renderAll();
    });
  });
}

function renderRecordItem(record) {
  return `
    <article class="timeline-item">
      <time>${escapeHtml(record.date)}</time>
      <div>
        <h3>${escapeHtml(record.title)}</h3>
        <p>${escapeHtml(record.description)}</p>
        <div class="item-actions">
          <button type="button" data-delete-record="${escapeHtml(record.id)}">删除</button>
        </div>
      </div>
    </article>
  `;
}

function renderTodos() {
  const list = document.querySelector("#todo-list");

  if (!state.todos.length) {
    renderEmpty(list, "还没有想做的事。", "从上面的输入框开始添加。", "todo-list empty-state");
    return;
  }

  list.className = "todo-list";
  list.innerHTML = state.todos.map(renderTodoItem).join("");

  list.querySelectorAll("[data-toggle-todo]").forEach((checkbox) => {
    checkbox.addEventListener("change", async () => {
      await updateItem(tables.todos, checkbox.dataset.toggleTodo, { done: checkbox.checked }, "todos");
      renderTodos();
    });
  });

  list.querySelectorAll("[data-edit-todo]").forEach((button) => {
    button.addEventListener("click", async () => {
      const item = state.todos.find((todo) => String(todo.id) === button.dataset.editTodo);
      const nextText = window.prompt("修改这件想一起做的事", item?.text || "");

      if (!nextText || !nextText.trim()) {
        return;
      }

      await updateItem(tables.todos, button.dataset.editTodo, { text: nextText.trim() }, "todos");
      renderTodos();
    });
  });

  list.querySelectorAll("[data-delete-todo]").forEach((button) => {
    button.addEventListener("click", async () => {
      await removeItem(tables.todos, button.dataset.deleteTodo, "todos");
      renderTodos();
    });
  });
}

function renderTodoItem(todo) {
  return `
    <div class="todo-item">
      <label class="todo-check">
        <input type="checkbox" data-toggle-todo="${escapeHtml(todo.id)}" ${todo.done ? "checked" : ""} />
        <span>${escapeHtml(todo.text)}</span>
      </label>
      <div class="item-actions">
        <button type="button" data-edit-todo="${escapeHtml(todo.id)}">修改</button>
        <button type="button" data-delete-todo="${escapeHtml(todo.id)}">删除</button>
      </div>
    </div>
  `;
}

function renderPhotos() {
  const empty = document.querySelector(".gallery-upload");
  const grid = document.querySelector("#gallery-grid");

  if (!state.photos.length) {
    empty.classList.remove("is-hidden");
    grid.innerHTML = "";
    return;
  }

  empty.classList.add("is-hidden");
  grid.innerHTML = state.photos.map(renderPhotoItem).join("");
  grid.querySelectorAll("[data-delete-photo]").forEach((button) => {
    button.addEventListener("click", async () => {
      await removePhoto(button.dataset.deletePhoto);
      renderPhotos();
    });
  });
}

function renderPhotoItem(photo) {
  return `
    <figure class="photo-card">
      <img src="${escapeHtml(photo.url || "")}" alt="${escapeHtml(photo.name || "旅行照片")}" />
      <figcaption>
        <span>${escapeHtml(photo.name || "未命名照片")}</span>
        <button type="button" data-delete-photo="${escapeHtml(photo.id)}">删除</button>
      </figcaption>
    </figure>
  `;
}

async function removePhoto(id) {
  const photo = state.photos.find((item) => String(item.id) === String(id));

  if (photo?.path) {
    const { error: storageError } = await state.client.storage.from(storageBucket).remove([photo.path]);
    if (storageError) {
      throw storageError;
    }
  }

  await removeItem(tables.photos, id, "photos");
}

function renderNextTrip() {
  const card = document.querySelector(".next-trip-card");
  const title = card.querySelector("strong");
  const date = card.querySelector(".trip-date");
  const count = card.querySelector(".countdown span");
  const hint = card.querySelector(".countdown small");
  const futurePlans = state.plans
    .map((plan) => ({ ...plan, parsedDate: parseDate(plan.date) }))
    .filter((plan) => plan.parsedDate && plan.parsedDate.getTime() >= startOfToday().getTime())
    .sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());
  const nextPlan = futurePlans[0];

  if (!nextPlan) {
    title.textContent = "还没有填写";
    date.textContent = "在出游计划里写下第一站";
    count.textContent = "--";
    hint.textContent = "等待出发";
    return;
  }

  const tripDate = parseDate(nextPlan.date);
  const days = Math.max(0, Math.ceil((tripDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  title.textContent = nextPlan.title;
  date.textContent = nextPlan.date;
  count.textContent = String(days);
  hint.textContent = days === 0 ? "今天出发" : "天后出发";
}

function renderEmpty(element, title, hint, className) {
  element.className = className;
  element.innerHTML = `
    <p>${escapeHtml(title)}</p>
    <span>${escapeHtml(hint)}</span>
  `;
}

function closePanel() {
  panel.classList.remove("is-open");
  panel.setAttribute("aria-hidden", "true");
}

function setCloudStatus(message, type = "loading") {
  cloudStatus.textContent = message;
  cloudStatus.dataset.status = type;
}

function formatShortDate(date) {
  const text = String(date || "").trim();
  const match = text.match(/(\d{1,2})[.\-/月](\d{1,2})/);
  return match ? `${match[1].padStart(2, "0")}.${match[2].padStart(2, "0")}` : text.slice(-5) || "--";
}

function parseDate(date) {
  const text = String(date || "").trim().replace(/\./g, "-").replace(/\//g, "-");
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function safeFileName(name) {
  const normalized = name.replace(/\s+/g, "-").replace(/[^\w.\-\u4e00-\u9fa5]/g, "");
  return normalized || "photo.jpg";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
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
