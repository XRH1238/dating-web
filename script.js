// Supabase
const supabaseConfig = {
  url: "https://ueqlgutndwkfuffzkcxo.supabase.co",
  key: "sb_publishable_EplbiVXxWhAdBKKSF70RVQ_pPls9SSw",
};
const tables = { plans: "love_plans", records: "love_records", todos: "love_todos", photos: "love_photos" };
const storageBucket = "love-photos";
const todoPageSize = 10;
const loveStartDate = "2025-09-06";
const milestoneDays = [300, 365, 520, 666, 999, 1314];

const transportTypes = ["高铁", "飞机", "自驾", "火车", "轮船", "其他"];
const transportVisuals = {
  // Adapted from OpenMoji 1F684 (CC BY-SA 4.0): https://openmoji.org/library/emoji-1F684/
  高铁: {
    name: "高铁", color: "#4E7FB3",
    icon: '<g transform="scale(.333333)"><path data-baseline="roof" style="fill:#fff;stroke:#1f1f1f;stroke-width:2;stroke-linejoin:round" d="M68 48 6.22 47.5 5.09 43.54 36.85 24.2H68Z"/><path data-baseline="base" style="fill:#9b9b9a;stroke:#1f1f1f;stroke-width:2;stroke-linejoin:round" d="M68 48v5.5H12.65a1 1 0 0 1-.5-1.87L18.41 48Z"/><path style="fill:#3f3f3f" d="M68 36.5H41.84a1.286 1.286 0 0 1-.69-2.37l7.26-4.62a12.86 12.86 0 0 1 6.9-2.01H68ZM15.61 36.5h9.5a12.86 12.86 0 0 0 6.9-2.01l7.26-4.62a1.286 1.286 0 0 0-.69-2.37h-7.2Z"/><path data-baseline="waist" style="fill:#d22f27;stroke:#1f1f1f;stroke-width:1.7;stroke-linejoin:round" d="M18.64 44H67.93V40h-43.3a5.7 5.7 0 0 0-3.07.89l-3.23 2.06a.57.57 0 0 0 .31 1.05Z"/></g>'
  },
  飞机: {
    name: "飞机", color: "#6D62B5",
    icon: '<path d="M21.7 11.1c.4.2.7.5.7.9s-.3.8-.7.9l-6.5 2.3-1.9 6h-2l.3-5.5-5.2 1.8-1.7 2H3.2l.8-3.7-2.4-1.3v-1.6l3 .4 7-2.5-.3-7.1h2l2 6 6.4.3v1.1Z"/>'
  },
  自驾: {
    name: "自驾", color: "#C06F4C",
    icon: '<path d="M6.2 5h11.6l2.1 5.3c1.1.5 1.8 1.5 1.8 2.7v5.2h-2.3V21h-2.2v-2.8H6.8V21H4.6v-2.8H2.3V13c0-1.2.7-2.2 1.8-2.7L6.2 5Zm1.5 2-1.2 3h11l-1.2-3H7.7ZM5.8 12.6a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8Zm12.4 0a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8Z"/>'
  },
  火车: {
    name: "火车", color: "#7D5A49",
    icon: '<path d="M7 2h10c1.7 0 3 1.3 3 3v10c0 1.5-1.1 2.7-2.5 3l2 3H17l-1.3-2H8.3L7 21H4.5l2-3C5.1 17.7 4 16.5 4 15V5c0-1.7 1.3-3 3-3Zm0 2c-.6 0-1 .4-1 1v4h12V5c0-.6-.4-1-1-1H7Zm-1 7v4c0 .6.4 1 1 1h10c.6 0 1-.4 1-1v-4H6Zm2.1 1.3a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4Zm7.8 0a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4Z"/><path d="M8 6h8v1.6H8z"/>'
  },
  轮船: {
    name: "轮船", color: "#3F8C8C",
    icon: '<path d="M10.8 2h2.4v3H17l2 5.2 3 .9-2.8 5.4c-.6 1.2-1.8 2-3.2 2-.9 0-1.8-.3-2.5-.9-.8.6-1.6.9-2.5.9s-1.8-.3-2.5-.9c-.8.6-1.6.9-2.5.9-1.4 0-2.6-.8-3.2-2L.2 11.1l3.8-.9L6 5h4.8V2ZM7.5 7l-1 2.7h11L16.5 7h-9Zm-4.2 5.6 1.3 2.7c.3.7.8 1 1.5 1 .6 0 1.2-.2 1.8-.8l.7-.7.7.7c.6.6 1.1.8 1.8.8.6 0 1.2-.2 1.8-.8l.7-.7.7.7c.6.6 1.1.8 1.8.8.7 0 1.2-.3 1.5-1l1.3-2.7-2.1-.6H5.4l-2.1.6ZM3.5 20c1.1 0 1.8.3 2.5.8.7-.5 1.5-.8 2.5-.8s1.8.3 2.5.8c.7-.5 1.5-.8 2.5-.8s1.8.3 2.5.8c.7-.5 1.5-.8 2.5-.8v2c-.7 0-1.2.2-1.7.7l-.8.7-.8-.7c-.5-.5-1-.7-1.7-.7s-1.2.2-1.7.7l-.8.7-.8-.7c-.5-.5-1-.7-1.7-.7s-1.2.2-1.7.7l-.8.7-.8-.7c-.5-.5-1-.7-1.7-.7v-2Z"/>'
  },
  其他: {
    name: "其他", color: "#8B6C91",
    icon: '<path d="M12 1.5A10.5 10.5 0 1 1 1.5 12 10.5 10.5 0 0 1 12 1.5Zm0 2A8.5 8.5 0 1 0 20.5 12 8.5 8.5 0 0 0 12 3.5Zm4.8 3.7-2.6 7-7 2.6 2.6-7 7-2.6Zm-3.1 3.1-2.3.9-.9 2.3 2.3-.9.9-2.3Z"/>'
  }
};
const provinceNames = {
  11: "北京", 12: "天津", 13: "河北", 14: "山西", 15: "内蒙古",
  21: "辽宁", 22: "吉林", 23: "黑龙江", 31: "上海", 32: "江苏",
  33: "浙江", 34: "安徽", 35: "福建", 36: "江西", 37: "山东",
  41: "河南", 42: "湖北", 43: "湖南", 44: "广东", 45: "广西",
  46: "海南", 50: "重庆", 51: "四川", 52: "贵州", 53: "云南",
  54: "西藏", 61: "陕西", 62: "甘肃", 63: "青海", 64: "宁夏",
  65: "新疆", 71: "台湾", 81: "香港", 82: "澳门",
};

// State
const state = {
  client: null, backendReady: false,
  plans: [], records: [], todos: [], photos: [], todoPage: 1,
  snapshotStore: null,
};

// DOM refs
const countdownEl = document.querySelector("[data-trip-date]");
const daysLeftEl = document.querySelector("#days-left");
const panel = document.querySelector("#quick-panel");
const form = document.querySelector("#quick-form");
const panelTitle = document.querySelector("#panel-title");
const panelLabel = document.querySelector("#panel-label");
const planFields = document.querySelector("#plan-fields");
const startDateInput = form && form.elements.start_date;
const endDateInput = form && form.elements.end_date;
const todoForm = document.querySelector("#todo-form");
const photoInput = document.querySelector("#photo-input");
const photoCityInput = document.querySelector("#photo-city");
const cloudStatus = document.querySelector("#cloud-status");
let activeType = "plan";
let cloudStatusTimer;

// Local SVG map state
let chinaMap = null;
let mapView = { scale: 1, x: 0, y: 0 };
let mapDrag = null;
let mapGeometry = null;
let mapFrame = 0;
let mapPriorityCities = new Set();
let mapCityLabels = [];
let administrativeCityIndex = null;

// ========== WGS-84 to GCJ-02 ==========
function wgs84ToGcj02(lng, lat) {
  var PI = Math.PI, A = 6378245.0, EE = 0.00669342162296594323;
  function _tLat(x, y) {
    var r = -100 + 2*x + 3*y + 0.2*y*y + 0.1*x*y + 0.2*Math.sqrt(Math.abs(x));
    r += (20*Math.sin(6*x*PI)+20*Math.sin(2*x*PI))*2/3;
    r += (20*Math.sin(y*PI)+40*Math.sin(y/3*PI))*2/3;
    r += (160*Math.sin(y/12*PI)+320*Math.sin(y*PI/30))*2/3;
    return r;
  }
  function _tLng(x, y) {
    var r = 300 + x + 2*y + 0.1*x*x + 0.1*x*y + 0.1*Math.sqrt(Math.abs(x));
    r += (20*Math.sin(6*x*PI)+20*Math.sin(2*x*PI))*2/3;
    r += (20*Math.sin(x*PI)+40*Math.sin(x/3*PI))*2/3;
    r += (150*Math.sin(x/12*PI)+300*Math.sin(x/30*PI))*2/3;
    return r;
  }
  if (lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271) return [lng, lat];
  var dLat = _tLat(lng-105, lat-35), dLng = _tLng(lng-105, lat-35);
  var radLat = lat/180*PI, magic = Math.sin(radLat);
  magic = 1 - EE*magic*magic;
  var sMagic = Math.sqrt(magic);
  return [
    lng + (dLng*180)/(A/sMagic*Math.cos(radLat)*PI),
    lat + (dLat*180)/((A*(1-EE))/(magic*sMagic)*PI)
  ];
}
function convertRing(ring) { return ring.map(function(p) { return wgs84ToGcj02(p[0], p[1]); }); }

function getFeatureCentroid(feature) {
  var coords = feature.geometry.coordinates;
  if (feature.geometry.type === "Polygon") coords = [coords];
  var ring = coords[0][0];
  var sl = 0, sL = 0, c = 0;
  var step = Math.max(1, Math.floor(ring.length / 20));
  for (var i = 0; i < ring.length; i += step) { sl += ring[i][0]; sL += ring[i][1]; c++; }
  sl += ring[ring.length-1][0]; sL += ring[ring.length-1][1]; c++;
  return wgs84ToGcj02(sl/c, sL/c);
}

// ========== Init ==========
document.addEventListener("DOMContentLoaded", init);
window.addEventListener("resize", scheduleMapView);

async function init() {
  bindEvents();
  connectSnapshotStore();
  loadCachedData();
  renderAll();
  connectSupabase();
  await loadRemoteData();
}

function bindEvents() {
  document.querySelectorAll("[data-open-panel]").forEach(function(btn) {
    btn.addEventListener("click", function() {
      activeType = btn.dataset.openPanel;
      panelTitle.textContent = activeType === "plan" ? "添加出游计划" : "写一条出游记录";
      panelLabel.textContent = activeType === "plan" ? "New Plan" : "New Memory";
      togglePlanFields(activeType === "plan");
      if (activeType === "plan") resetRouteEditor();
      panel.classList.add("is-open");
      panel.setAttribute("aria-hidden", "false");
      form.elements.title.focus();
    });
  });
  document.querySelector(".panel-close").addEventListener("click", closePanel);
  panel.addEventListener("click", function(e) { if (e.target === panel) closePanel(); });
  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape" && panel.classList.contains("is-open")) closePanel();
  });
  form.addEventListener("submit", async function(e) {
    e.preventDefault();
    var fd = new FormData(form);
    var date;
    try {
      date = window.MapLabelLayout.serializeDateRange(fd.get("start_date"), fd.get("end_date"));
      endDateInput.setCustomValidity("");
    } catch (error) {
      endDateInput.setCustomValidity(error.message);
      endDateInput.reportValidity();
      endDateInput.focus();
      return;
    }
    var entry = { title: fd.get("title").trim(), date: date, description: fd.get("description").trim() };
    if (activeType === "plan") {
      entry.segments = getRouteSegments();
      await savePlan(entry);
    } else {
      await saveRecord(entry);
    }
    form.reset();
    endDateInput.min = "";
    closePanel();
  });
  startDateInput.addEventListener("input", syncEndDateMinimum);
  endDateInput.addEventListener("input", syncEndDateMinimum);
  if (todoForm) {
    todoForm.addEventListener("submit", async function(e) {
      e.preventDefault();
      var input = todoForm.querySelector("input");
      if (!input || !input.value.trim()) return;
      await saveTodo(input.value.trim());
      input.value = "";
    });
  }
  if (photoInput) {
    photoInput.addEventListener("change", function() { uploadPhotos(this.files); });
  }
}

function syncEndDateMinimum() {
  endDateInput.min = startDateInput.value;
  var invalid = startDateInput.value && endDateInput.value && endDateInput.value < startDateInput.value;
  endDateInput.setCustomValidity(invalid ? "结束日期不能早于开始日期" : "");
}

function togglePlanFields(show) {
  if (planFields) planFields.style.display = show ? "" : "none";
}
function resetRouteEditor() {
  var container = document.querySelector("#route-segments");
  if (!container) return;
  container.innerHTML = "";
  addRouteSegment();
}

// ========== Panel ==========
function closePanel() {
  panel.classList.remove("is-open");
  panel.setAttribute("aria-hidden", "true");
}

// ========== Route Editor ==========
function addRouteSegment() {
  var container = document.querySelector("#route-segments");
  if (!container) return;
  var seg = document.createElement("div");
  seg.className = "route-segment-row";
  seg.innerHTML = '<input type="text" placeholder="出发城市" class="route-from" /><input type="text" placeholder="到达城市" class="route-to" /><select class="route-transport">' +
    transportTypes.map(function(t) { return '<option value="' + t + '">' + t + '</option>'; }).join("") +
    '</select><button type="button" class="route-remove-btn">×</button>';
  seg.querySelector(".route-remove-btn").addEventListener("click", function() {
    seg.remove();
  });
  container.appendChild(seg);
}
function getRouteSegments() {
  var rows = document.querySelectorAll("#route-segments .route-segment-row");
  var segments = [];
  rows.forEach(function(row) {
    var from = (row.querySelector(".route-from") || {}).value || "";
    var to = (row.querySelector(".route-to") || {}).value || "";
    var transport = (row.querySelector(".route-transport") || {}).value || "其他";
    if (from.trim() && to.trim()) segments.push({ from: from.trim(), to: to.trim(), transport: transport });
  });
  return segments;
}

function getAdministrativeCityIndex() {
  if (!administrativeCityIndex && window.CHINA_CITIES_GEOJSON && window.MapLabelLayout) {
    administrativeCityIndex = window.MapLabelLayout.buildAdministrativeCityIndex(
      window.CHINA_CITIES_GEOJSON.features
    );
  }
  return administrativeCityIndex;
}

function resolveCity(name) {
  return window.MapLabelLayout.resolveAdministrativeCity(getAdministrativeCityIndex(), name);
}

document.addEventListener("click", function(e) {
  if (e.target && e.target.id === "add-route-segment") {
    addRouteSegment();
  }
});

// ========== Supabase ==========
function connectSnapshotStore() {
  state.snapshotStore = window.CloudDataClient.createSnapshotStore(window.localStorage, "dating-web:data:v1");
}

function loadCachedData() {
  if (!state.snapshotStore) return;
  var snapshot = state.snapshotStore.load();
  state.plans = snapshot.plans;
  state.records = snapshot.records;
  state.todos = snapshot.todos;
  state.photos = snapshot.photos;
}

function saveCachedData() {
  if (!state.snapshotStore) return;
  state.snapshotStore.save({
    plans: state.plans,
    records: state.records,
    todos: state.todos,
    photos: state.photos,
  });
}

function connectSupabase() {
  try {
    state.client = window.CloudDataClient.createCloudDataClient({
      url: supabaseConfig.url,
      key: supabaseConfig.key,
    });
    state.backendReady = true;
  } catch (err) {
    state.backendReady = false;
    setCloudStatus("offline");
  }
}
function setCloudStatus(status) {
  if (!cloudStatus) return;
  var map = {
    connected: "☁️ 云端已连接",
    offline: "⚠️ 云端暂不可用，正在显示本机保存的数据",
    loading: "⏳ 正在同步云端数据...",
  };
  cloudStatus.textContent = map[status] || "";
  clearTimeout(cloudStatusTimer);
  if (status === "connected") cloudStatusTimer = setTimeout(function() { setCloudStatus(""); }, 4000);
}

async function loadRemoteData() {
  if (!state.backendReady) return;
  setCloudStatus("loading");
  var results = await Promise.allSettled([fetchPlans(), fetchRecords(), fetchTodos(), fetchPhotos()]);
  renderAll();
  var failed = results.some(function(result) { return result.status === "rejected"; });
  if (failed) {
    state.backendReady = false;
    setCloudStatus("offline");
  } else {
    setCloudStatus("connected");
  }
}

// ========== Plans ==========
async function fetchPlans() {
  state.plans = await state.client.select(tables.plans);
}
async function savePlan(entry) {
  entry.created_at = new Date().toISOString();
  if (state.backendReady) {
    try {
      await state.client.insert(tables.plans, [entry]);
      await fetchPlans();
    } catch (_) {
      state.backendReady = false;
      state.plans.unshift(entry);
      setCloudStatus("offline");
    }
  } else {
    state.plans.unshift(entry);
  }
  renderAll();
}
async function deletePlan(index) {
  var plan = state.plans[index];
  if (!plan) return;
  if (state.backendReady && plan.id) {
    try {
      await state.client.remove(tables.plans, plan.id);
    } catch (_) {
      state.backendReady = false;
      setCloudStatus("offline");
    }
  }
  state.plans.splice(index, 1);
  renderAll();
}

// ========== Records ==========
async function fetchRecords() {
  state.records = await state.client.select(tables.records);
}
async function saveRecord(entry) {
  entry.created_at = new Date().toISOString();
  if (state.backendReady) {
    try {
      await state.client.insert(tables.records, [entry]);
      await fetchRecords();
    } catch (_) {
      state.backendReady = false;
      state.records.unshift(entry);
      setCloudStatus("offline");
    }
  } else {
    state.records.unshift(entry);
  }
  renderAll();
}

// ========== Todos ==========
async function fetchTodos() {
  state.todos = await state.client.select(tables.todos);
}
async function saveTodo(text) {
  var entry = { text: text, done: false, created_at: new Date().toISOString() };
  if (state.backendReady) {
    try {
      await state.client.insert(tables.todos, [entry]);
      await fetchTodos();
    } catch (_) {
      state.backendReady = false;
      state.todos.unshift(entry);
      setCloudStatus("offline");
    }
  } else {
    state.todos.unshift(entry);
  }
  renderAll();
}
async function toggleTodo(index) {
  var todo = state.todos[index];
  if (!todo) return;
  todo.done = !todo.done;
  if (state.backendReady && todo.id) {
    try {
      await state.client.update(tables.todos, todo.id, { done: todo.done });
    } catch (_) {
      state.backendReady = false;
      setCloudStatus("offline");
    }
  }
  renderAll();
}

// ========== Photos ==========
async function fetchPhotos() {
  state.photos = await state.client.select(tables.photos);
}

function fileToDataUrl(file) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload = function() { resolve(reader.result); };
    reader.onerror = function() { reject(reader.error); };
    reader.readAsDataURL(file);
  });
}

async function uploadPhotos(files) {
  if (!files || !files.length) return;
  var city = photoCityInput ? photoCityInput.value.trim() : "";
  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    var entry = { name: file.name, created_at: new Date().toISOString() };
    if (state.backendReady) {
      try {
        var resolvedCity = resolveCity(city);
        var folder = resolvedCity ? resolvedCity.name : "unplaced";
        var path = folder + "/" + Date.now() + "-" + file.name;
        await state.client.upload(storageBucket, path, file);
        entry.path = path;
        entry.url = state.client.getPublicUrl(storageBucket, path);
        await state.client.insert(tables.photos, [entry]);
      } catch (_) {
        state.backendReady = false;
        entry.url = await fileToDataUrl(file);
        setCloudStatus("offline");
      }
    } else {
      entry.url = await fileToDataUrl(file);
    }
    state.photos.unshift(entry);
  }
  if (photoCityInput) photoCityInput.value = "";
  renderAll();
}

// ========== Render All ==========
function renderAll() {
  renderPlans();
  renderRecords();
  renderTodos();
  renderPhotos();
  renderAnniversary();
  renderFootprintMap();
  saveCachedData();
}

// ========== Anniversary ==========
function renderAnniversary() {
  var daysEl = document.querySelector("#love-days");
  var milestoneList = document.querySelector("#milestone-list");
  var startLabel = document.querySelector("#love-start-date");
  if (!daysEl || !milestoneList) return;
  var start = new Date(loveStartDate).getTime();
  var now = Date.now();
  var days = Math.max(0, Math.floor((now - start) / (1000 * 60 * 60 * 24)));
  daysEl.textContent = String(days);
  if (startLabel) startLabel.textContent = "从 " + loveStartDate + " 开始";

  var html = "";
  milestoneDays.forEach(function(target) {
    var diff = target - days;
    html += '<article class="milestone-item' + (diff <= 0 ? ' is-done' : '') + '"><div><h3>' + target + ' 天</h3><p>' + (diff > 0 ? '还有 ' + diff + ' 天' : '已经一起走过') + '</p></div><span>' + (diff > 0 ? '倒计时' : '已达成') + '</span></article>';
  });
  milestoneList.innerHTML = html;
}

// ========== Render Plans ==========
function renderPlans() {
  var list = document.querySelector("#plan-list");
  if (!list) return;
  if (!state.plans.length) {
    list.innerHTML = '<p>还没有出游计划。</p><span>点击上方按钮添加第一个。</span>';
    return;
  }
  list.innerHTML = state.plans.map(function(p, i) {
    return '<article class="mini-plan"><span class="date-pill">' + escapeHtml(window.MapLabelLayout.formatDateRange(p.date)) +
      '</span><div><h3>' + escapeHtml(p.title || "") + '</h3><p>' + escapeHtml(p.description || "") +
      '</p></div><button class="delete-btn" data-delete-plan="' + i + '">×</button></article>';
  }).join("");
  list.querySelectorAll("[data-delete-plan]").forEach(function(btn) {
    btn.addEventListener("click", function() { deletePlan(parseInt(btn.dataset.deletePlan)); });
  });
}

// ========== Render Records ==========
function renderRecords() {
  var list = document.querySelector("#record-list");
  if (!list) return;
  if (!state.records.length) {
    list.innerHTML = '<p>还没有出游记录。</p><span>写下你们的旅途回忆吧。</span>';
    return;
  }
  list.innerHTML = state.records.map(function(r) {
    return '<article class="timeline-item"><time>' + escapeHtml(window.MapLabelLayout.formatDateRange(r.date)) + '</time><div><h3>' +
      escapeHtml(r.title || "") + '</h3><p>' + escapeHtml(r.description || "") + '</p></div></article>';
  }).join("");
}

// ========== Render Todos ==========
function renderTodos() {
  var list = document.querySelector("#todo-list");
  if (!list) return;
  var total = state.todos.length;
  var done = state.todos.filter(function(todo) { return todo.done; }).length;
  var totalCount = document.querySelector("#todo-total-count");
  var doneCount = document.querySelector("#todo-done-count");
  if (totalCount) totalCount.textContent = total;
  if (doneCount) doneCount.textContent = done;
  var max = todoPageSize;
  var pageCount = Math.max(1, Math.ceil(total / max));
  state.todoPage = Math.min(Math.max(1, state.todoPage), pageCount);
  var start = (state.todoPage - 1) * max;
  var todos = state.todos.slice(start, start + max);
  if (!todos.length) {
    list.innerHTML = '<div class="todo-empty"><p>还没有想做的事。</p><span>从上面的输入框开始添加。</span></div>';
    return;
  }
  var splitIndex = Math.ceil(todos.length / 2);
  var todoColumns = [todos.slice(0, splitIndex), todos.slice(splitIndex)];
  list.innerHTML = '<div class="todo-items-grid">' + todoColumns.map(function(column, columnIndex) {
    return '<div class="todo-column">' + column.map(function(t, columnItemIndex) {
      var i = columnIndex === 0 ? columnItemIndex : splitIndex + columnItemIndex;
      var action = t.done ? '标记为未完成' : '标记为已完成';
      return '<div class="todo-row' + (t.done ? ' done' : '') + '"><span>' + escapeHtml(t.text) +
        '</span><button type="button" aria-label="' + action + '：' + escapeHtml(t.text) + '" data-toggle-todo="' +
        (start + i) + '">' + (t.done ? '✓' : '') + '</button></div>';
    }).join("") + '</div>';
  }).join("") + '</div>';
  if (pageCount > 1) list.innerHTML += '<nav class="todo-pagination" aria-label="待办分页"><button type="button" data-todo-page="' + (state.todoPage - 1) + '"' + (state.todoPage === 1 ? ' disabled' : '') + '>上一页</button><span>' + state.todoPage + ' / ' + pageCount + '</span><button type="button" data-todo-page="' + (state.todoPage + 1) + '"' + (state.todoPage === pageCount ? ' disabled' : '') + '>下一页</button></nav>';
  list.querySelectorAll("[data-toggle-todo]").forEach(function(btn) {
    btn.addEventListener("click", function() { toggleTodo(parseInt(btn.dataset.toggleTodo)); });
  });
  list.querySelectorAll("[data-todo-page]").forEach(function(btn) { btn.addEventListener("click", function() { state.todoPage = parseInt(btn.dataset.todoPage); renderTodos(); }); });
}

// ========== Render Photos ==========
function renderPhotos() {
  var grid = document.querySelector("#gallery-grid");
  var upload = document.querySelector(".gallery-upload");
  if (!grid) return;
  if (!state.photos.length) {
    grid.innerHTML = "";
    if (upload) upload.style.display = "";
    return;
  }
  if (upload) upload.style.display = "none";
  grid.innerHTML = state.photos.map(function(p) {
    return '<figure><img src="' + escapeHtml(p.url || "") + '" alt="' + escapeHtml(p.name || "") +
      '" loading="lazy" /></figure>';
  }).join("");
}

// ========== Footprint Map ==========
function renderFootprintMap() {
  var mapEl = document.querySelector("#footprint-map");
  var overlay = document.querySelector("#map-overlay");
  var legend = document.querySelector("#map-legend");
  renderTransportIconGuide();
  if (!mapEl || !legend) return;

  var mappedPlans = state.plans.map(function(p) {
    var segs = normalizePlanSegments(p).map(function(s) {
      var from = resolveCity(s.from);
      var to = resolveCity(s.to);
      return { from: from ? from.name : s.from, to: to ? to.name : s.to, transport: s.transport,
        start: from && from.coordinates, end: to && to.coordinates };
    }).filter(function(s) { return s.start && s.end; });
    return { title: p.title, segments: segs };
  }).filter(function(p) { return p.segments.length; });

  var unknownCities = [];
  var visited = new Map();
  mappedPlans.forEach(function(p) {
    p.segments.forEach(function(s) {
      if (s.start) visited.set(s.from, { name: s.from, coordinates: s.start });
      if (s.end) visited.set(s.to, { name: s.to, coordinates: s.end });
    });
  });

  state.plans.forEach(function(p) {
    normalizePlanSegments(p).forEach(function(s) {
      if (s.from && !resolveCity(s.from) && unknownCities.indexOf(s.from) === -1) unknownCities.push(s.from);
      if (s.to && !resolveCity(s.to) && unknownCities.indexOf(s.to) === -1) unknownCities.push(s.to);
    });
  });

  var mapPhotos = state.photos.map(function(photo) {
    var city = resolveCity(getPhotoCity(photo));
    return city ? { city: city.name, coordinates: city.coordinates, url: photo.url, date: photo.created_at } : null;
  }).filter(Boolean);
  renderChinaMap(mapEl, overlay, mappedPlans, Array.from(visited.values()), mapPhotos);

  if (!state.plans.length) {
    legend.innerHTML = "<p>添加出游计划后，中国地图会显示你们的路线。</p>";
    return;
  }
  legend.innerHTML = '<div class="map-legend-count"><strong>' + visited.size +
    '</strong><span>个已标记城市</span></div>' +
    (mapPhotos.length ? '<p class="map-photo-count">已挂上 ' + mapPhotos.length + ' 张城市照片</p>' : (state.photos.length ? '<p class="map-note">照片上传时填写拍摄城市，即可挂到地图上。</p>' : '')) +
    '<div class="map-route-list">' +
    mappedPlans.map(function(p) {
      return '<article><span><b>' + p.segments.length + '</b>' + escapeHtml(p.title || "出游路线") +
        '</span><p>' + p.segments.map(function(s) {
          var visual = transportVisual(s.transport);
          return '<span class="legend-segment-icon" style="--transport-color:' + visual.color + '" title="' + visual.name + '">' + transportIcon(s.transport) + '</span>' +
            escapeHtml(s.from + " → " + s.to + " · " + s.transport);
        }).join("") + '</p></article>';
    }).join("") + '</div>' +
    (unknownCities.length ? '<p class="map-note">未定位：' + escapeHtml(unknownCities.join("、")) + '</p>' : "");
}

function normalizePlanSegments(plan) {
  var segs = plan && plan.segments;
  if (typeof segs === "string") { try { segs = JSON.parse(segs); } catch(e) { segs = []; } }
  if (Array.isArray(segs) && segs.length) {
    return segs.map(function(s) {
      return { from: String(s.from || "").trim(), to: String(s.to || "").trim(),
        transport: normalizeTransport(s.transport) };
    }).filter(function(s) { return s.from && s.to; });
  }
  var legacy = [plan.origin].concat(String(plan.transfers||"").split(/[，,、;；\\s]+/).filter(Boolean), [plan.destination])
    .filter(Boolean);
  var transport = normalizeTransport(plan.transport);
  return legacy.slice(0, -1).map(function(c, i) {
    return { from: c, to: legacy[i+1], transport: transport };
  });
}

// ========== China Map (AMap) ==========
function renderChinaMap(container, overlay, plans, visitedCities, mapPhotos) {
  if (!window.CHINA_CITIES_GEOJSON || !window.CHINA_CITIES_GEOJSON.features) {
    container.innerHTML = '<div class="map-fallback"><strong>市级地图数据没有加载</strong><span>请确认 china-cities-data.js 位于当前文件夹。</span></div>';
    return;
  }
  if (!mapGeometry) mapGeometry = buildMapGeometry();
  if (!mapGeometry) return;
  mapPriorityCities = new Set();
  plans.forEach(function(plan) {
    plan.segments.forEach(function(segment) {
      if (segment.from) mapPriorityCities.add(window.MapLabelLayout.canonicalCityName(segment.from));
      if (segment.to) mapPriorityCities.add(window.MapLabelLayout.canonicalCityName(segment.to));
    });
  });
  visitedCities.forEach(function(city) {
    if (city.name) mapPriorityCities.add(window.MapLabelLayout.canonicalCityName(city.name));
  });
  (mapPhotos || []).forEach(function(photo) {
    if (photo.city) mapPriorityCities.add(window.MapLabelLayout.canonicalCityName(photo.city));
  });
  container.innerHTML = '<svg class="china-svg" viewBox="0 0 1000 720" aria-label="可缩放中国地图"><defs><filter id="route-shadow"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity=".2"/></filter></defs><rect class="map-water" width="1000" height="720"/><g class="map-content">' + mapGeometry.cities + mapGeometry.provinces + mapGeometry.provinceLabels + mapGeometry.cityLabels + routeSvg(plans, visitedCities, mapPhotos || []) + '</g></svg><div class="map-controls" aria-label="地图缩放控件"><button type="button" data-map-action="zoom-in" aria-label="放大地图">+</button><button type="button" data-map-action="zoom-out" aria-label="缩小地图">−</button><button type="button" data-map-action="reset" aria-label="复位地图">↺</button></div>';
  chinaMap = container.querySelector(".china-svg");
  mapCityLabels = Array.from(chinaMap.querySelectorAll('.city-labels text'));
  bindMapInteractions(container);
  applyMapView();
  if (overlay) overlay.innerHTML = '';
}

function buildMapGeometry() {
  var cities = window.CHINA_CITIES_GEOJSON.features;
  var cityIndex = getAdministrativeCityIndex();
  var provinces = (window.CHINA_PROVINCES_GEOJSON && window.CHINA_PROVINCES_GEOJSON.features) || [];
  var minLon = 73, maxLon = 136, minLat = 17, maxLat = 55, padding = 38;
  function project(point) {
    return [padding + (point[0] - minLon) / (maxLon - minLon) * (1000 - padding * 2), 720 - padding - (point[1] - minLat) / (maxLat - minLat) * (720 - padding * 2)];
  }
  function pathFor(geometry) {
    if (!geometry) return '';
    if (geometry.type === 'MultiLineString') {
      return geometry.coordinates.map(function(line) { return line.map(function(p, i) { var q = project(p); return (i ? 'L' : 'M') + q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join(''); }).join('');
    }
    var polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
    return polygons.map(function(poly) { return poly.map(function(ring) { return ring.map(function(p, i) { var q = project(p); return (i ? 'L' : 'M') + q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join('') + 'Z'; }).join(''); }).join('');
  }
  function centerFor(feature) {
    var geometry = feature.geometry;
    if (geometry.type === 'MultiLineString') {
      var line = geometry.coordinates[0], lx = 0, ly = 0;
      line.forEach(function(point) { lx += point[0]; ly += point[1]; });
      return project([lx / line.length, ly / line.length]);
    }
    var polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
    var largestRing = null, largestArea = -1;
    polygons.forEach(function(polygon) { polygon.forEach(function(ring) {
      var area = 0;
      for (var i = 0; i < ring.length - 1; i++) area += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
      if (Math.abs(area) > largestArea) { largestArea = Math.abs(area); largestRing = ring; }
    }); });
    var cross = 0, x = 0, y = 0;
    for (var j = 0; j < largestRing.length - 1; j++) {
      var a = largestRing[j], b = largestRing[j + 1], factor = a[0] * b[1] - b[0] * a[1];
      cross += factor; x += (a[0] + b[0]) * factor; y += (a[1] + b[1]) * factor;
    }
    return project(cross ? [x / (3 * cross), y / (3 * cross)] : largestRing[0]);
  }
  function provinceLabel(feature) { var p = centerFor(feature); return '<text x="' + p[0].toFixed(1) + '" y="' + p[1].toFixed(1) + '">' + escapeHtml(feature.properties.name || '') + '</text>'; }
  function cityLabel(entry, index) {
    var p = project(entry.coordinates), name = entry.name;
    return '<text data-city="' + escapeHtml(name) + '" data-label-index="' + index + '" x="' + p[0].toFixed(1) + '" y="' + p[1].toFixed(1) + '">' + escapeHtml(name) + '</text>';
  }
  return {
    cityIndex: cityIndex,
    project: project,
    cities: '<g class="city-layer">' + cities.map(function(f) { return '<path d="' + pathFor(f.geometry) + '"/>'; }).join('') + '</g>',
    provinces: '<g class="province-layer">' + provinces.map(function(f) { return '<path d="' + pathFor(f.geometry) + '"/>'; }).join('') + '</g>',
    provinceLabels: '<g class="province-labels">' + provinces.map(provinceLabel).join('') + '</g>',
    cityLabels: '<g class="city-labels">' + cityIndex.entries.map(cityLabel).join('') + '</g>'
  };
}

function routeSvg(plans, visitedCities, mapPhotos) {
  var colors = ['#d95f78', '#528270', '#ca854a', '#587fa8'];
  var routes = plans.map(function(plan, planIndex) { return plan.segments.map(function(seg, segmentIndex) {
    var a = mapGeometry.project(seg.start), b = mapGeometry.project(seg.end), color = colors[planIndex % colors.length];
    var visual = transportVisual(seg.transport);
    var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2 - Math.min(58, Math.abs(a[0] - b[0]) * .13);
    var path = 'M' + a[0].toFixed(1) + ',' + a[1].toFixed(1) + ' Q' + mx.toFixed(1) + ',' + my.toFixed(1) + ' ' + b[0].toFixed(1) + ',' + b[1].toFixed(1);
    return '<g class="route-group" style="--route-color:' + color + ';--transport-color:' + visual.color + ';--route-delay:' + ((planIndex + segmentIndex) * 120) + 'ms"><path class="route-line" d="' + path + '"/><g class="route-badge" transform="translate(' + mx.toFixed(1) + ' ' + my.toFixed(1) + ')" filter="url(#route-shadow)"><circle r="15"/>' + routeTransportGlyph(seg.transport) + '</g></g>';
  }).join(''); }).join('');
  var cities = visitedCities.map(function(city) { var p = mapGeometry.project(city.coordinates); return '<g class="city-marker" transform="translate(' + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + ')"><circle r="7"/><circle class="city-core" r="2.6"/><text x="11" y="-10">' + escapeHtml(city.name) + '</text></g>'; }).join('');
  var photoPins = mapPhotos.map(function(photo, index) { var p = mapGeometry.project(photo.coordinates), shift = (index % 3) * 13; return '<g class="photo-pin" transform="translate(' + (p[0] - 25 + shift).toFixed(1) + ' ' + (p[1] - 72 - shift).toFixed(1) + ')" filter="url(#route-shadow)"><rect width="50" height="62" rx="5"/><image href="' + escapeHtml(photo.url || '') + '" x="5" y="5" width="40" height="39" preserveAspectRatio="xMidYMid slice"/><text x="25" y="56">' + escapeHtml(String(photo.date || '').slice(5, 10).replace('-', '.')) + '</text></g>'; }).join('');
  return '<g class="route-layer">' + routes + cities + photoPins + '</g>';
}

function getPhotoCity(photo) {
  if (!photo) return '';
  if (photo.city) return String(photo.city).trim();
  var path = String(photo.path || '');
  return path.indexOf('/') > 0 ? path.split('/')[0] : '';
}

function bindMapInteractions(container) {
  var svg = chinaMap;
  container.querySelectorAll('[data-map-action]').forEach(function(button) { button.addEventListener('click', function() {
    var action = button.dataset.mapAction;
    if (action === 'reset') mapView = { scale: 1, x: 0, y: 0 };
    if (action === 'zoom-in') mapView.scale = Math.min(12, mapView.scale * 1.3);
    if (action === 'zoom-out') mapView.scale = Math.max(1, mapView.scale / 1.3);
    scheduleMapView();
  }); });
  svg.addEventListener('wheel', function(event) { event.preventDefault(); mapView.scale = Math.max(1, Math.min(12, mapView.scale * (event.deltaY < 0 ? 1.14 : 1 / 1.14))); scheduleMapView(); }, { passive: false });
  svg.addEventListener('pointerdown', function(event) { mapDrag = { x: event.clientX, y: event.clientY, startX: mapView.x, startY: mapView.y }; svg.setPointerCapture(event.pointerId); });
  svg.addEventListener('pointermove', function(event) { if (!mapDrag) return; mapView.x = mapDrag.startX + event.clientX - mapDrag.x; mapView.y = mapDrag.startY + event.clientY - mapDrag.y; scheduleMapView(); });
  svg.addEventListener('pointerup', function() { mapDrag = null; });
  svg.addEventListener('pointercancel', function() { mapDrag = null; });
}

function scheduleMapView() {
  if (mapFrame) return;
  mapFrame = requestAnimationFrame(function() { mapFrame = 0; applyMapView(); });
}

function applyMapView() {
  if (!chinaMap) return;
  var clampedView = window.MapLabelLayout.clampMapTranslation(mapView);
  mapView.x = clampedView.x;
  mapView.y = clampedView.y;
  var content = chinaMap.querySelector('.map-content');
  if (content) content.setAttribute('transform', 'translate(' + mapView.x.toFixed(1) + ' ' + mapView.y.toFixed(1) + ') translate(500 360) scale(' + mapView.scale.toFixed(3) + ') translate(-500 -360)');
  chinaMap.classList.toggle('is-zoomed', mapView.scale > 1.35);
  chinaMap.classList.toggle('is-city-detail', mapView.scale >= 3);
  updateCityLabelLayout();
}

function updateCityLabelLayout() {
  if (!chinaMap || !window.MapLabelLayout) return;
  var width = chinaMap.clientWidth || 1000;
  var height = chinaMap.clientHeight || 720;
  var renderScale = Math.min(width / 1000, height / 720);
  var offsetX = (width - 1000 * renderScale) / 2;
  var offsetY = (height - 720 * renderScale) / 2;
  var candidates = mapCityLabels.map(function(label, index) {
    var name = label.dataset.city || '';
    return {
      id: label.dataset.labelIndex || String(index),
      name: name,
      x: Number(label.getAttribute('x')),
      y: Number(label.getAttribute('y')),
      priority: mapPriorityCities.has(window.MapLabelLayout.canonicalCityName(name)),
      index: Number(label.dataset.labelIndex || index)
    };
  });
  var visible = window.MapLabelLayout.layoutCityLabels(candidates, {
    scale: mapView.scale,
    x: mapView.x,
    y: mapView.y,
    width: width,
    height: height,
    renderScale: renderScale,
    offsetX: offsetX,
    offsetY: offsetY,
    compact: width < 640
  });
  mapCityLabels.forEach(function(label, index) {
    label.style.display = visible.has(label.dataset.labelIndex || String(index)) ? '' : 'none';
  });
  var group = chinaMap.querySelector('.city-labels');
  if (group) {
    group.style.setProperty('--city-label-font-size', (12 / (mapView.scale * renderScale)).toFixed(3) + 'px');
    group.style.setProperty('--city-label-stroke-width', (3 / (mapView.scale * renderScale)).toFixed(3) + 'px');
  }
}

function initChinaMap(container) {
  if (chinaMap) return;
  container.innerHTML = "";

  chinaMap = new AMap.Map(container, {
    center: [105, 35], zoom: 5, zooms: [4, 18],
    layers: [new AMap.TileLayer.Satellite(), new AMap.TileLayer.RoadNet({ opacity: 0.7 })],
    viewMode: "3D",
  });

  // ---- Province boundaries + labels ----
  if (window.CHINA_PROVINCES_GEOJSON && window.CHINA_PROVINCES_GEOJSON.features) {
    window.CHINA_PROVINCES_GEOJSON.features.forEach(function(f) {
      var coords = f.geometry.coordinates;
      if (f.geometry.type === "Polygon") coords = [coords];
      coords.forEach(function(poly) {
        poly.forEach(function(ring) {
          var p = new AMap.Polygon({ path: convertRing(ring), fillColor: "transparent", fillOpacity: 0,
            strokeColor: "rgba(255,255,255,0.75)", strokeWeight: 1.5, strokeOpacity: 0.75, zIndex: 10 });
          chinaMap.add(p); _mapPolygons.push(p);
        });
      });
      var pos = getFeatureCentroid(f);
      var t = new AMap.Text({ text: f.properties.name, position: pos, style: {
        "background":"transparent","border":"none","color":"rgba(255,255,255,0.95)","font-size":"18px",
        "font-weight":"900","text-shadow":"0 1px 4px rgba(0,0,0,0.7), 0 0 10px rgba(0,0,0,0.4)",
        "pointer-events":"none","white-space":"nowrap","text-align":"center" }, zIndex: 100 });
      chinaMap.add(t); _mapTexts.push({ text: t, level: "province" });
    });
  }

  // ---- City boundaries + labels ----
  if (window.CHINA_CITIES_GEOJSON && window.CHINA_CITIES_GEOJSON.features) {
    window.CHINA_CITIES_GEOJSON.features.forEach(function(f) {
      var coords = f.geometry.coordinates;
      if (f.geometry.type === "Polygon") coords = [coords];
      coords.forEach(function(poly) {
        poly.forEach(function(ring) {
          var p = new AMap.Polygon({ path: convertRing(ring), fillColor: "transparent", fillOpacity: 0,
            strokeColor: "rgba(255,255,255,0.45)", strokeWeight: 0.8, strokeOpacity: 0.45, zIndex: 9 });
          chinaMap.add(p); _mapPolygons.push(p);
        });
      });
      var pos = getFeatureCentroid(f);
      var t = new AMap.Text({ text: f.properties.name, position: pos, style: {
        "background":"transparent","border":"none","color":"rgba(255,255,255,0.88)","font-size":"13px",
        "font-weight":"700","text-shadow":"0 1px 3px rgba(0,0,0,0.7), 0 0 6px rgba(0,0,0,0.35)",
        "pointer-events":"none","white-space":"nowrap","text-align":"center" }, zIndex: 99 });
      chinaMap.add(t); _mapTexts.push({ text: t, level: "city" });
    });
  }

  // ---- County (lazy at zoom >= 10) ----
  var countyLoaded = false;
  function loadCounties() {
    if (countyLoaded || !window.CHINA_COUNTIES_GEOJSON || !window.CHINA_COUNTIES_GEOJSON.features) return;
    countyLoaded = true;
    window.CHINA_COUNTIES_GEOJSON.features.forEach(function(f) {
      var coords = f.geometry.coordinates;
      if (f.geometry.type === "Polygon") coords = [coords];
      coords.forEach(function(poly) {
        poly.forEach(function(ring) {
          var p = new AMap.Polygon({ path: convertRing(ring), fillColor: "transparent", fillOpacity: 0,
            strokeColor: "rgba(255,255,255,0.22)", strokeWeight: 0.35, strokeOpacity: 0.22, zIndex: 8 });
          chinaMap.add(p); _mapPolygons.push(p);
        });
      });
      var pos = getFeatureCentroid(f);
      var t = new AMap.Text({ text: f.properties.name, position: pos, style: {
        "background":"transparent","border":"none","color":"rgba(255,255,255,0.78)","font-size":"9px",
        "font-weight":"600","text-shadow":"0 1px 2px rgba(0,0,0,0.7), 0 0 4px rgba(0,0,0,0.35)",
        "pointer-events":"none","white-space":"nowrap","text-align":"center" }, zIndex: 98 });
      chinaMap.add(t); _mapTexts.push({ text: t, level: "county" });
    });
  }

  function updateLabelVisibility() {
    var z = chinaMap.getZoom();
    _mapTexts.forEach(function(item) {
      var v = false;
      if (item.level === "province") v = true;
      else if (item.level === "city") v = z >= 7;
      else if (item.level === "county") { v = z >= 10; if (v) loadCounties(); }
      try { v ? item.text.show() : item.text.hide(); } catch(e) {}
    });
  }
  chinaMap.on("zoomend", updateLabelVisibility);
  updateLabelVisibility();
}

function updateChinaMapRoutes(plans) {
  if (!chinaMap) return;
  _mapPolylines.forEach(function(p) { try { chinaMap.remove(p); } catch(e) {} }); _mapPolylines = [];
  _mapBadgeMarkers.forEach(function(m) { try { chinaMap.remove(m); } catch(e) {} }); _mapBadgeMarkers = [];

  var colors = ["#d95f78", "#78917c", "#b7784c", "#6a89a6"];
  plans.forEach(function(plan, pi) {
    var color = colors[pi % colors.length];
    plan.segments.forEach(function(seg) {
      if (!seg.start || !seg.end) return;
      var s = wgs84ToGcj02(seg.start[0], seg.start[1]);
      var e = wgs84ToGcj02(seg.end[0], seg.end[1]);
      var line = new AMap.Polyline({ path: [s, e], strokeColor: color, strokeWeight: 3.5,
        strokeOpacity: 0.88, lineCap: "round", lineJoin: "round", zIndex: 50, geodesic: true });
      chinaMap.add(line); _mapPolylines.push(line);

      var mid = [(s[0]+e[0])/2, (s[1]+e[1])/2];
      var visual = transportVisual(seg.transport);
      var badge = document.createElement("div");
      badge.innerHTML = transportIcon(seg.transport);
      badge.style.cssText = "width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid rgba(255,255,255,0.9);box-shadow:0 2px 8px rgba(0,0,0,0.3);color:#fff;";
      badge.style.background = visual.color;
      badge.setAttribute("aria-label", visual.name);
      badge.querySelector("svg") && badge.querySelector("svg").setAttribute("style", "width:14px;height:14px;fill:currentColor");
      var m = new AMap.Marker({ position: mid, content: badge, offset: new AMap.Pixel(-13, -13), zIndex: 60 });
      chinaMap.add(m); _mapBadgeMarkers.push(m);
    });
  });
}

function updateChinaMapMarkers(visitedCities) {
  if (!chinaMap) return;
  _mapCircleMarkers.forEach(function(m) { try { chinaMap.remove(m); } catch(e) {} }); _mapCircleMarkers = [];

  visitedCities.forEach(function(city) {
    var pos = wgs84ToGcj02(city.coordinates[0], city.coordinates[1]);
    var c = new AMap.CircleMarker({ center: pos, radius: 8, fillColor: "#fff",
      fillOpacity: 1, strokeColor: "#d95f78", strokeWeight: 3.5, zIndex: 70 });
    chinaMap.add(c); _mapCircleMarkers.push(c);

    var t = new AMap.Text({ text: city.name, position: [pos[0] + 0.05, pos[1]], style: {
      "background":"transparent","border":"none","color":"#fff","font-size":"15px","font-weight":"900",
      "text-shadow":"0 1px 4px rgba(0,0,0,0.7)","pointer-events":"none","white-space":"nowrap" }, zIndex: 71 });
    chinaMap.add(t); _mapTexts.push({ text: t, level: "marker" });
  });
}

// ========== Utilities ==========
function transportVisual(transport) {
  return transportVisuals[normalizeTransport(transport)] || transportVisuals.其他;
}

function transportIcon(transport) {
  var visual = transportVisual(transport);
  return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" data-transport-icon="' + visual.name + '">' + visual.icon + '</svg>';
}

function routeTransportGlyph(transport) {
  var visual = transportVisual(transport);
  return '<g class="route-transport-glyph" transform="translate(-8.5 -8.5) scale(.708333)" data-transport-icon="' + visual.name + '" aria-hidden="true">' + visual.icon + '</g>';
}

function renderTransportIconGuide() {
  var guide = document.querySelector("#transport-icon-guide");
  if (!guide) return;
  guide.innerHTML = '<span class="transport-icon-guide-title">交通图标</span>' + transportTypes.map(function(transport) {
    var visual = transportVisual(transport);
    return '<span class="transport-icon-guide-item" style="--transport-color:' + visual.color + '"><span class="transport-icon-guide-symbol">' + transportIcon(transport) + '</span><span>' + visual.name + '</span></span>';
  }).join("");
}
function normalizeTransport(t) {
  var n = String(t || "").trim();
  return transportTypes.indexOf(n) !== -1 ? n : "其他";
}
function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, function(c) {
    var e = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return e[c];
  });
}
