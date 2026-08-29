(function(root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.TripPlanning = api;
})(typeof self !== "undefined" ? self : this, function() {
  function normalizeDirection(value) {
    return value === "return" ? "return" : "outbound";
  }

  function normalizePlanSegments(plan, normalizeTransport) {
    var transportOf = typeof normalizeTransport === "function" ? normalizeTransport : function(value) { return String(value || "其他"); };
    var segments = plan && plan.segments;
    if (typeof segments === "string") {
      try { segments = JSON.parse(segments); }
      catch (_) { segments = []; }
    }
    if (Array.isArray(segments) && segments.length) {
      return segments.map(function(segment) {
        return {
          from: String(segment.from || "").trim(),
          to: String(segment.to || "").trim(),
          transport: transportOf(segment.transport),
          direction: normalizeDirection(segment.direction),
        };
      }).filter(function(segment) { return segment.from && segment.to; });
    }
    var legacyCities = [plan && plan.origin]
      .concat(String((plan && plan.transfers) || "").split(/[，,、;；\s]+/).filter(Boolean), [plan && plan.destination])
      .filter(Boolean);
    var legacyTransport = transportOf(plan && plan.transport);
    return legacyCities.slice(0, -1).map(function(city, index) {
      return {
        from: city,
        to: legacyCities[index + 1],
        transport: legacyTransport,
        direction: "outbound",
      };
    });
  }

  function selectTopTrip(plans, todayIso, parseDateRange) {
    var candidates = (plans || []).map(function(plan) {
      return { plan: plan, range: parseDateRange(plan.date) };
    }).filter(function(item) { return item.range.valid; });
    var ongoing = candidates.filter(function(item) {
      return item.range.start <= todayIso && item.range.end >= todayIso;
    }).sort(function(a, b) { return a.range.start.localeCompare(b.range.start); });
    if (ongoing.length) return { status: "ongoing", plan: ongoing[0].plan, range: ongoing[0].range };
    var upcoming = candidates.filter(function(item) {
      return item.range.start > todayIso;
    }).sort(function(a, b) { return a.range.start.localeCompare(b.range.start); });
    if (upcoming.length) return { status: "upcoming", plan: upcoming[0].plan, range: upcoming[0].range };
    return { status: "empty", plan: null, range: null };
  }

  return {
    normalizeDirection: normalizeDirection,
    normalizePlanSegments: normalizePlanSegments,
    selectTopTrip: selectTopTrip,
  };
});
