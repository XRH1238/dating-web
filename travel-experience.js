(function(root, factory) {
  var api = factory(typeof module === 'object' && module.exports ? require('./map-label-layout.js') : root.MapLabelLayout);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TravelExperience = api;
})(typeof window !== 'undefined' ? window : globalThis, function(layout) {
  function tripKey(city, date) {
    var name = layout.canonicalCityName(city);
    var range = layout.parseDateRange(date);
    return name && range.valid ? JSON.stringify([name, range.start, range.end]) : '';
  }

  function groupTrips(records, plans) {
    var groups = new Map();
    (records || []).forEach(function(record, index) {
      var key = tripKey(record.city, record.date) || 'record:' + (record.id || (record._sourceIndex == null ? index : record._sourceIndex));
      if (!groups.has(key)) groups.set(key, { key: key, city: record.city || '', date: record.date || '', records: [], plans: [], photos: [] });
      groups.get(key).records.push(record);
    });
    (plans || []).forEach(function(plan) {
      var segments = Array.isArray(plan.segments) ? plan.segments : [];
      var outbound = segments.filter(function(segment) { return segment.direction !== 'return'; });
      var city = plan.destination || (outbound.length ? outbound[outbound.length - 1].to : '');
      var key = tripKey(city, plan.date);
      if (key && groups.has(key)) groups.get(key).plans.push(plan);
    });
    return Array.from(groups.values()).map(function(group) {
      var seen = new Set();
      group.records.forEach(function(record) {
        (record.photos || []).forEach(function(photo) {
          var key = photo.url ? JSON.stringify([photo.url, photo.motion_url || '']) : photo;
          if (!seen.has(key)) { seen.add(key); group.photos.push(photo); }
        });
      });
      return group;
    });
  }

  function fitMapPoints(points) {
    var valid = (points || []).filter(function(point) { return point && Number.isFinite(point[0]) && Number.isFinite(point[1]); });
    if (!valid.length) return { scale: 1, x: 0, y: 0 };
    var xs = valid.map(function(point) { return point[0]; });
    var ys = valid.map(function(point) { return point[1]; });
    var left = Math.min.apply(null, xs), right = Math.max.apply(null, xs);
    var top = Math.min.apply(null, ys), bottom = Math.max.apply(null, ys);
    // Reserve space for city names, curved routes and photo pins.
    var scale = Math.max(1, Math.min(8, 760 / Math.max(95, right - left + 60), 480 / Math.max(90, bottom - top + 70)));
    var view = { scale: scale, x: (500 - (left + right) / 2) * scale, y: (360 - (top + bottom) / 2) * scale };
    return Object.assign(view, layout.clampMapTranslation(view));
  }

  function anniversaryMilestones(startIso, todayIso, targets) {
    var start = Date.parse(startIso + 'T00:00:00Z');
    var today = Date.parse(todayIso + 'T00:00:00Z');
    var days = Math.max(0, Math.floor((today - start) / 86400000));
    var milestones = (targets || []).map(function(target) {
      return { target: target, remaining: target - days, date: new Date(start + target * 86400000).toISOString().slice(0, 10) };
    });
    return { days: days, upcoming: milestones.filter(function(item) { return item.remaining >= 0; }).sort(function(a, b) { return a.target - b.target; }),
      past: milestones.filter(function(item) { return item.remaining < 0; }).sort(function(a, b) { return b.target - a.target; }) };
  }

  return { tripKey: tripKey, groupTrips: groupTrips, fitMapPoints: fitMapPoints, anniversaryMilestones: anniversaryMilestones };
});
