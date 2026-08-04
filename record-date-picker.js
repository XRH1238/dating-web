(function(root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.RecordDatePicker = api;
})(typeof self !== "undefined" ? self : this, function() {
  function asInteger(value) {
    if (value === "" || value === null || value === undefined) return null;
    if (!/^\d+$/.test(String(value))) return NaN;
    return Number(value);
  }

  function daysInMonth(year, month) {
    return new Date(Number(year), Number(month), 0).getDate();
  }

  function createParts(isoValue) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoValue || ""));
    if (!match) return { year: "", month: "", day: "" };
    return { year: String(Number(match[1])), month: String(Number(match[2])), day: String(Number(match[3])) };
  }

  function validateParts(parts) {
    parts = parts || {};
    var year = asInteger(parts.year), month = asInteger(parts.month), day = asInteger(parts.day);
    if (year === null || month === null || day === null) {
      if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return { valid: false, complete: false, message: "请填写数字日期" };
      if (year !== null && (year < 1 || year > 9999)) return { valid: false, complete: false, message: "年份应在 1 到 9999 之间" };
      if (month !== null && (month < 1 || month > 12)) return { valid: false, complete: false, message: "月份应在 1 到 12 之间" };
      return { valid: true, complete: false, message: "" };
    }
    if (year < 1 || year > 9999) return { valid: false, complete: true, message: "年份应在 1 到 9999 之间" };
    if (month < 1 || month > 12) return { valid: false, complete: true, message: "月份应在 1 到 12 之间" };
    if (day < 1 || day > daysInMonth(year, month)) return { valid: false, complete: true, message: "这个日期不存在，请重新填写" };
    return { valid: true, complete: true, message: "" };
  }

  function pad(value) { return String(value).padStart(2, "0"); }

  function toIsoDate(parts) {
    var validation = validateParts(parts);
    if (!validation.valid || !validation.complete) return "";
    return String(Number(parts.year)).padStart(4, "0") + "-" + pad(Number(parts.month)) + "-" + pad(Number(parts.day));
  }

  function formatChineseDate(isoValue, emptyLabel) {
    var parts = createParts(isoValue);
    return parts.year ? parts.year + "年" + parts.month + "月" + parts.day + "日" : (emptyLabel || "");
  }

  function shiftMonth(year, month, offset) {
    var date = new Date(Number(year), Number(month) - 1 + Number(offset), 1);
    return { year: date.getFullYear(), month: date.getMonth() + 1 };
  }

  function buildMonthGrid(year, month) {
    var cells = [];
    var leading = new Date(Number(year), Number(month) - 1, 1).getDay();
    for (var i = 0; i < leading; i++) cells.push(null);
    var total = daysInMonth(year, month);
    for (var day = 1; day <= total; day++) cells.push(day);
    while (cells.length % 7) cells.push(null);
    return cells;
  }

  return {
    daysInMonth: daysInMonth,
    createParts: createParts,
    validateParts: validateParts,
    toIsoDate: toIsoDate,
    formatChineseDate: formatChineseDate,
    shiftMonth: shiftMonth,
    buildMonthGrid: buildMonthGrid,
  };
});
