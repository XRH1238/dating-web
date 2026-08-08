(function(root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.StoryData = api;
})(typeof window !== "undefined" ? window : globalThis, function() {
  function asArray(value) {
    if (Array.isArray(value)) return value;
    if (typeof value === "string") {
      try { var parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch (_) { return []; }
    }
    return [];
  }

  function normalizeRecord(record) {
    var next = Object.assign({}, record || {});
    next.title = String(next.title || "");
    next.date = String(next.date || "");
    next.city = String(next.city || next.title || "");
    next.moods = asArray(next.moods);
    next.photos = asArray(next.photos);
    return next;
  }

  function startTime(record) {
    var date = String((record && record.date) || "").split("/")[0].replace(/\./g, "-");
    var time = Date.parse(date);
    return Number.isFinite(time) ? time : 0;
  }

  function sortRecords(records) {
    return (records || []).map(normalizeRecord).sort(function(a, b) { return startTime(b) - startTime(a); });
  }

  function summarizeRecords(records) {
    var normalized = (records || []).map(normalizeRecord);
    var cities = new Set(normalized.map(function(item) { return item.city.trim(); }).filter(Boolean));
    return {
      trips: normalized.length,
      cities: cities.size,
      photos: normalized.reduce(function(total, item) { return total + item.photos.length; }, 0),
    };
  }

  function getCapsuleState(capsule, nowValue) {
    var now = nowValue instanceof Date ? nowValue : new Date(nowValue || Date.now());
    var created = new Date((capsule && capsule.created_at) || now);
    var editableUntil = new Date(created.getTime() + 24 * 60 * 60 * 1000);
    var unlock = new Date(String((capsule && capsule.unlock_date) || "") + "T00:00:00");
    var unlocked = Number.isFinite(unlock.getTime()) && now >= unlock;
    var remainingDays = unlocked || !Number.isFinite(unlock.getTime()) ? 0 : Math.max(1, Math.ceil((unlock - now) / 86400000));
    return { editable: now < editableUntil, unlocked: unlocked, editableUntil: editableUntil, remainingDays: remainingDays };
  }

  function toPublicCapsule(capsule, now) {
    var state = getCapsuleState(capsule, now);
    var safe = {
      id: capsule && capsule.id,
      title: String((capsule && capsule.title) || "未命名胶囊"),
      created_at: capsule && capsule.created_at,
      updated_at: capsule && capsule.updated_at,
      unlock_date: capsule && capsule.unlock_date,
      editable: state.editable,
      unlocked: state.unlocked,
      remainingDays: state.remainingDays,
    };
    if (state.unlocked) {
      safe.body = String((capsule && capsule.body) || "");
      safe.photos = asArray(capsule && capsule.photos);
    }
    return safe;
  }

  return { normalizeRecord: normalizeRecord, sortRecords: sortRecords, summarizeRecords: summarizeRecords,
    getCapsuleState: getCapsuleState, toPublicCapsule: toPublicCapsule };
});
