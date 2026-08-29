(function(root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.RecordMoods = api;
})(typeof self !== "undefined" ? self : this, function() {
  function normalizeMood(value) {
    return String(value || "").trim();
  }

  function mergeMoodOptions(defaults, selected) {
    var result = [];
    (defaults || []).concat(selected || []).forEach(function(value) {
      value = normalizeMood(value);
      if (value && result.indexOf(value) === -1) result.push(value);
    });
    return result;
  }

  function addMood(existing, rawValue) {
    var value = normalizeMood(rawValue);
    var moods = mergeMoodOptions(existing, []);
    if (!value) return { moods: moods, value: "", added: false, error: "请输入心情" };
    var added = moods.indexOf(value) === -1;
    if (added) moods.push(value);
    return { moods: moods, value: value, added: added, error: "" };
  }

  return {
    normalizeMood: normalizeMood,
    mergeMoodOptions: mergeMoodOptions,
    addMood: addMood,
  };
});
