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

// City coordinates for route mapping (WGS-84)
const cityCoordinates = {
  北京: [116.4074, 39.9042], 天津: [117.2009, 39.0842], 上海: [121.4737, 31.2304],
  重庆: [106.5516, 29.563], 广州: [113.2644, 23.1291], 深圳: [114.0579, 22.5431],
  杭州: [120.1551, 30.2741], 南京: [118.7969, 32.0603], 苏州: [120.5853, 31.2989],
  成都: [104.0665, 30.5728], 西安: [108.9398, 34.3416], 武汉: [114.3054, 30.5931],
  长沙: [112.9388, 28.2282], 厦门: [118.0894, 24.4798], 青岛: [120.3826, 36.0671],
  大连: [121.6147, 38.914], 哈尔滨: [126.6424, 45.7567], 沈阳: [123.4315, 41.8057],
  长春: [125.3235, 43.8171], 济南: [117.1201, 36.6512], 郑州: [113.6254, 34.7466],
  合肥: [117.2272, 31.8206], 福州: [119.2965, 26.0745], 南昌: [115.8582, 28.6829],
  南宁: [108.3669, 22.817], 海口: [110.1983, 20.044], 三亚: [109.5119, 18.2528],
  昆明: [102.8329, 24.8801], 贵阳: [106.6302, 26.647], 兰州: [103.8343, 36.0611],
  西宁: [101.7782, 36.6171], 银川: [106.2309, 38.4872], 呼和浩特: [111.7492, 40.8426],
  乌鲁木齐: [87.6168, 43.8256], 拉萨: [91.1172, 29.6469], 香港: [114.1694, 22.3193],
  澳门: [113.5439, 22.1987], 台北: [121.5654, 25.033],
};
const transportTypes = ["高铁", "飞机", "自驾", "火车", "轮船", "其他"];
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
};

// DOM refs
const countdownEl = document.querySelector("[data-trip-date]");
const daysLeftEl = document.querySelector("#days-left");
const panel = document.querySelector("#quick-panel");
const form = document.querySelector("#quick-form");
const panelTitle = document.querySelector("#panel-title");
const panelLabel = document.querySelector("#panel-label");
const planFields = document.querySelector("#plan-fields");
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

async function init() {
  bindEvents();
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
    var entry = { title: fd.get("title").trim(), date: fd.get("date").trim(), description: fd.get("description").trim() };
    if (activeType === "plan") {
      entry.segments = getRouteSegments();
      await savePlan(entry);
    } else {
      await saveRecord(entry);
    }
    form.reset(); closePanel();
  });
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

document.addEventListener("click", function(e) {
  if (e.target && e.target.id === "add-route-segment") {
    addRouteSegment();
  }
});

// ========== Supabase ==========
function connectSupabase() {
  try {
    state.client = supabase.createClient(supabaseConfig.url, supabaseConfig.key);
    state.backendReady = true;
    setCloudStatus("connected");
  } catch (err) {
    state.backendReady = false;
    setCloudStatus("offline");
  }
}
function setCloudStatus(status) {
  if (!cloudStatus) return;
  var map = { connected: "☁️ 云端已连接", offline: "⚠️ 离线模式（数据仅保存在本地）", loading: "⏳ 同步中..." };
  cloudStatus.textContent = map[status] || "";
  clearTimeout(cloudStatusTimer);
  if (status === "connected") cloudStatusTimer = setTimeout(function() { setCloudStatus(""); }, 4000);
}

async function loadRemoteData() {
  if (!state.backendReady) return;
  setCloudStatus("loading");
  await Promise.allSettled([fetchPlans(), fetchRecords(), fetchTodos(), fetchPhotos()]);
  renderAll();
  setCloudStatus("connected");
}

// ========== Plans ==========
async function fetchPlans() {
  var r = await state.client.from(tables.plans).select("*").order("created_at", { ascending: false });
  if (r.data) state.plans = r.data;
}
async function savePlan(entry) {
  entry.created_at = new Date().toISOString();
  if (state.backendReady) {
    await state.client.from(tables.plans).insert([entry]);
    await fetchPlans();
  } else {
    state.plans.unshift(entry);
  }
  renderAll();
}
async function deletePlan(index) {
  var plan = state.plans[index];
  if (!plan) return;
  if (state.backendReady && plan.id) {
    await state.client.from(tables.plans).delete().eq("id", plan.id);
  }
  state.plans.splice(index, 1);
  renderAll();
}

// ========== Records ==========
async function fetchRecords() {
  var r = await state.client.from(tables.records).select("*").order("created_at", { ascending: false });
  if (r.data) state.records = r.data;
}
async function saveRecord(entry) {
  entry.created_at = new Date().toISOString();
  if (state.backendReady) {
    await state.client.from(tables.records).insert([entry]);
    await fetchRecords();
  } else {
    state.records.unshift(entry);
  }
  renderAll();
}

// ========== Todos ==========
async function fetchTodos() {
  var r = await state.client.from(tables.todos).select("*").order("created_at", { ascending: false });
  if (r.data) state.todos = r.data;
}
async function saveTodo(text) {
  var entry = { text: text, done: false, created_at: new Date().toISOString() };
  if (state.backendReady) {
    await state.client.from(tables.todos).insert([entry]);
    await fetchTodos();
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
    await state.client.from(tables.todos).update({ done: todo.done }).eq("id", todo.id);
  }
  renderAll();
}

// ========== Photos ==========
async function fetchPhotos() {
  var r = await state.client.from(tables.photos).select("*").order("created_at", { ascending: false });
  if (r.data) state.photos = r.data;
}
async function uploadPhotos(files) {
  if (!files || !files.length) return;
  var city = photoCityInput ? photoCityInput.value.trim() : "";
  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    var entry = { name: file.name, created_at: new Date().toISOString() };
    if (state.backendReady) {
      var folder = city && cityCoordinates[city] ? city : "unplaced";
      var path = folder + "/" + Date.now() + "-" + file.name;
      await state.client.storage.from(storageBucket).upload(path, file);
      var url = state.client.storage.from(storageBucket).getPublicUrl(path).data.publicUrl;
      entry.path = path;
      entry.url = url;
      await state.client.from(tables.photos).insert([entry]);
    } else {
      entry.url = URL.createObjectURL(file);
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
    return '<article class="mini-plan"><span class="date-pill">' + escapeHtml(String(p.date || "").slice(-5)) +
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
    return '<article class="timeline-item"><time>' + escapeHtml(r.date || "") + '</time><div><h3>' +
      escapeHtml(r.title || "") + '</h3><p>' + escapeHtml(r.description || "") + '</p></div></article>';
  }).join("");
}

// ========== Render Todos ==========
function renderTodos() {
  var list = document.querySelector("#todo-list");
  if (!list) return;
  var total = state.todos.length;
  var max = todoPageSize;
  var pageCount = Math.max(1, Math.ceil(total / max));
  state.todoPage = Math.min(Math.max(1, state.todoPage), pageCount);
  var start = (state.todoPage - 1) * max;
  var todos = state.todos.slice(start, start + max);
  if (!todos.length) {
    list.innerHTML = '<p>还没有想做的事。</p><span>从上面的输入框开始添加。</span>';
    return;
  }
  list.innerHTML = todos.map(function(t, i) {
    return '<div class="todo-row' + (t.done ? ' done' : '') + '"><span>' + escapeHtml(t.text) +
      '</span><button data-toggle-todo="' + (start + i) + '">' + (t.done ? '↩' : '✓') + '</button></div>';
  }).join("");
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
  if (!mapEl || !overlay || !legend) return;

  var mappedPlans = state.plans.map(function(p) {
    var segs = normalizePlanSegments(p).map(function(s) {
      return { from: s.from, to: s.to, transport: s.transport,
        start: cityCoordinates[s.from], end: cityCoordinates[s.to] };
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
      if (s.from && !cityCoordinates[s.from] && unknownCities.indexOf(s.from) === -1) unknownCities.push(s.from);
      if (s.to && !cityCoordinates[s.to] && unknownCities.indexOf(s.to) === -1) unknownCities.push(s.to);
    });
  });

  var mapPhotos = state.photos.map(function(photo) {
    var city = getPhotoCity(photo);
    return city && cityCoordinates[city] ? { city: city, url: photo.url, date: photo.created_at } : null;
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
          return '<span class="legend-segment-icon">' + transportIcon(s.transport) + '</span>' +
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
  container.innerHTML = '<svg class="china-svg" viewBox="0 0 1000 720" aria-label="可缩放中国地图"><defs><filter id="route-shadow"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity=".2"/></filter></defs><rect class="map-water" width="1000" height="720"/><g class="map-content">' + mapGeometry.cities + mapGeometry.provinces + mapGeometry.provinceLabels + mapGeometry.cityLabels + routeSvg(plans, visitedCities, mapPhotos || []) + '</g></svg><div class="map-controls" aria-label="地图缩放控件"><button type="button" data-map-action="zoom-in" aria-label="放大地图">+</button><button type="button" data-map-action="zoom-out" aria-label="缩小地图">−</button><button type="button" data-map-action="reset" aria-label="复位地图">↺</button></div>';
  chinaMap = container.querySelector(".china-svg");
  bindMapInteractions(container);
  applyMapView();
  if (overlay) overlay.innerHTML = '';
}

function buildMapGeometry() {
  var cities = window.CHINA_CITIES_GEOJSON.features;
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
    var polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    var ring = polygons[0][0], x = 0, y = 0, count = 0;
    for (var i = 0; i < ring.length; i += Math.max(1, Math.floor(ring.length / 24))) { x += ring[i][0]; y += ring[i][1]; count++; }
    return project([x / count, y / count]);
  }
  function provinceLabel(feature) { var p = centerFor(feature); return '<text x="' + p[0].toFixed(1) + '" y="' + p[1].toFixed(1) + '">' + escapeHtml(feature.properties.name || '') + '</text>'; }
  function cityLabel(name) { var p = project(cityCoordinates[name]); return '<text x="' + p[0].toFixed(1) + '" y="' + p[1].toFixed(1) + '">' + escapeHtml(name) + '</text>'; }
  return {
    project: project,
    cities: '<g class="city-layer">' + cities.map(function(f) { return '<path d="' + pathFor(f.geometry) + '"/>'; }).join('') + '</g>',
    provinces: '<g class="province-layer">' + provinces.map(function(f) { return '<path d="' + pathFor(f.geometry) + '"/>'; }).join('') + '</g>',
    provinceLabels: '<g class="province-labels">' + provinces.map(provinceLabel).join('') + '</g>',
    cityLabels: '<g class="city-labels">' + Object.keys(cityCoordinates).map(cityLabel).join('') + '</g>'
  };
}

function routeSvg(plans, visitedCities, mapPhotos) {
  var colors = ['#d95f78', '#528270', '#ca854a', '#587fa8'];
  var routes = plans.map(function(plan, planIndex) { return plan.segments.map(function(seg, segmentIndex) {
    var a = mapGeometry.project(seg.start), b = mapGeometry.project(seg.end), color = colors[planIndex % colors.length];
    var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2 - Math.min(58, Math.abs(a[0] - b[0]) * .13);
    var path = 'M' + a[0].toFixed(1) + ',' + a[1].toFixed(1) + ' Q' + mx.toFixed(1) + ',' + my.toFixed(1) + ' ' + b[0].toFixed(1) + ',' + b[1].toFixed(1);
    return '<g class="route-group" style="--route-color:' + color + ';--route-delay:' + ((planIndex + segmentIndex) * 120) + 'ms"><path class="route-line" d="' + path + '"/><g class="route-badge" transform="translate(' + mx.toFixed(1) + ' ' + my.toFixed(1) + ')" filter="url(#route-shadow)"><circle r="15"/>' + transportIcon(seg.transport) + '</g></g>';
  }).join(''); }).join('');
  var cities = visitedCities.map(function(city) { var p = mapGeometry.project(city.coordinates); return '<g class="city-marker" transform="translate(' + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + ')"><circle r="7"/><circle class="city-core" r="2.6"/><text x="11" y="-10">' + escapeHtml(city.name) + '</text></g>'; }).join('');
  var photoPins = mapPhotos.map(function(photo, index) { var p = mapGeometry.project(cityCoordinates[photo.city]), shift = (index % 3) * 13; return '<g class="photo-pin" transform="translate(' + (p[0] - 25 + shift).toFixed(1) + ' ' + (p[1] - 72 - shift).toFixed(1) + ')" filter="url(#route-shadow)"><rect width="50" height="62" rx="5"/><image href="' + escapeHtml(photo.url || '') + '" x="5" y="5" width="40" height="39" preserveAspectRatio="xMidYMid slice"/><text x="25" y="56">' + escapeHtml(String(photo.date || '').slice(5, 10).replace('-', '.')) + '</text></g>'; }).join('');
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
    if (action === 'zoom-in') mapView.scale = Math.min(5, mapView.scale * 1.35);
    if (action === 'zoom-out') mapView.scale = Math.max(1, mapView.scale / 1.35);
    applyMapView();
  }); });
  svg.addEventListener('wheel', function(event) { event.preventDefault(); mapView.scale = Math.max(1, Math.min(5, mapView.scale * (event.deltaY < 0 ? 1.16 : 1 / 1.16))); applyMapView(); }, { passive: false });
  svg.addEventListener('pointerdown', function(event) { mapDrag = { x: event.clientX, y: event.clientY, startX: mapView.x, startY: mapView.y }; svg.setPointerCapture(event.pointerId); });
  svg.addEventListener('pointermove', function(event) { if (!mapDrag) return; mapView.x = mapDrag.startX + event.clientX - mapDrag.x; mapView.y = mapDrag.startY + event.clientY - mapDrag.y; applyMapView(); });
  svg.addEventListener('pointerup', function() { mapDrag = null; });
  svg.addEventListener('pointercancel', function() { mapDrag = null; });
}

function applyMapView() {
  if (!chinaMap) return;
  var content = chinaMap.querySelector('.map-content');
  if (content) content.setAttribute('transform', 'translate(' + mapView.x.toFixed(1) + ' ' + mapView.y.toFixed(1) + ') translate(500 360) scale(' + mapView.scale.toFixed(3) + ') translate(-500 -360)');
  chinaMap.classList.toggle('is-zoomed', mapView.scale > 1.35);
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
      var badge = document.createElement("div");
      badge.innerHTML = transportIcon(seg.transport);
      badge.style.cssText = "width:26px;height:26px;background:rgba(217,95,120,0.92);border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid rgba(255,255,255,0.9);box-shadow:0 2px 8px rgba(0,0,0,0.3);";
      badge.querySelector("svg") && badge.querySelector("svg").setAttribute("style", "width:14px;height:14px;fill:#fff");
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
function transportIcon(transport) {
  var n = normalizeTransport(transport);
  var icons = {
    高铁: '<svg viewBox="0 0 24 24"><path d="M7 3h10c1.7 0 3 1.3 3 3v8.2c0 1.4-1.1 2.6-2.5 2.8l1.8 2H17l-1.6-1.8H8.6L7 19H4.7l1.8-2C5.1 16.8 4 15.6 4 14.2V6c0-1.7 1.3-3 3-3Zm0 2c-.6 0-1 .4-1 1v3h12V6c0-.6-.4-1-1-1H7Zm-.8 6v3.1c0 .5.4.9.9.9h9.8c.5 0 .9-.4.9-.9V11H6.2Zm2.3 1.2h2.2v1.7H8.5v-1.7Zm4.8 0h2.2v1.7h-2.2v-1.7Z"/></svg>',
    飞机: '<svg viewBox="0 0 24 24"><path d="M21.5 12.4c.3.2.5.5.5.9s-.2.7-.5.9l-6.4 3.5-.7 3.4c-.1.5-.5.9-1 .9h-1.2l-.9-2.6-2.8 1.5-.5 1.2H6.5l.2-3.1-3.3-1.8v-1.5l4.2.4 3.5-1.9-7.9-4.3V8.4h2.1l8.1 2.5 5.4-3c1.3-.7 2.8.6 2.1 1.9l-1.1 2 1.7.6Z"/></svg>',
    自驾: '<svg viewBox="0 0 24 24"><path d="M6.6 6h10.8l2.1 5.2c.9.4 1.5 1.2 1.5 2.3V18h-2v2h-2.2v-2H7.2v2H5v-2H3v-4.5c0-1 .6-1.9 1.5-2.3L6.6 6Zm1.4 2-1.2 3h10.4L16 8H8Zm-2.1 5c-.5 0-.9.4-.9.9s.4.9.9.9 1-.4 1-.9-.5-.9-1-.9Zm12.2 0c-.5 0-1 .4-1 .9s.5.9 1 .9.9-.4.9-.9-.4-.9-.9-.9Z"/></svg>',
    火车: '<svg viewBox="0 0 24 24"><path d="M7 3h10c1.7 0 3 1.3 3 3v8c0 1.5-1.1 2.8-2.5 3l2 3H17l-1.4-2H8.4L7 20H4.5l2-3C5.1 16.8 4 15.5 4 14V6c0-1.7 1.3-3 3-3Zm0 2c-.6 0-1 .4-1 1v2h12V6c0-.6-.4-1-1-1H7Zm-1 5v4c0 .6.4 1 1 1h10c.6 0 1-.4 1-1v-4H6Zm2 1.4h2.5v2H8v-2Zm5.5 0H16v2h-2.5v-2Z"/></svg>',
    轮船: '<svg viewBox="0 0 24 24"><path d="M5 10.5 7 5h4V2h2v3h4l2 5.5 2 .8-2.7 5.4c-.6 1.1-1.6 1.8-2.9 1.8-.9 0-1.7-.3-2.4-.9-.7.6-1.5.9-2.4.9s-1.7-.3-2.4-.9c-.7.6-1.5.9-2.4.9-1.2 0-2.3-.7-2.9-1.8L.9 11.3 5 10.5Zm3.4-3.5-1.1 3h9.4l-1.1-3H8.4Zm-4.3 5.8 1.4 2.8c.3.6.8.9 1.5.9s1.2-.3 1.7-.8l.8-.8.8.8c.5.5 1 .8 1.7.8s1.2-.3 1.7-.8l.8-.8.8.8c.5.5 1 .8 1.7.8s1.2-.3 1.5-.9l1.4-2.8-2.6-1H6.7l-2.6 1Z"/></svg>',
    其他: '<svg viewBox="0 0 24 24"><path d="M6.5 4.5a3.5 3.5 0 0 1 7 0c0 2.5-3.5 6.6-3.5 6.6S6.5 7 6.5 4.5Zm2 0a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0ZM15 13c1.7 0 3 1.3 3 3 0 2.1-3 5.5-3 5.5S12 18.1 12 16c0-1.7 1.3-3 3-3Zm0 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2ZM4 14.5c0-1.9 1.6-3.5 3.5-3.5H9v2H7.5a1.5 1.5 0 0 0 0 3H10v2H7.5A3.5 3.5 0 0 1 4 14.5Z"/></svg>',
  };
  return icons[n] || "行";
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
