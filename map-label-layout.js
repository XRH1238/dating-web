(function(root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MapLabelLayout = api;
})(typeof window !== 'undefined' ? window : globalThis, function() {
  function canonicalCityName(name) {
    return String(name || '').trim().replace(/(?:特别行政区|自治州|地区|自治|盟|市)$/u, '');
  }

  function normalizeDate(value) {
    var match = String(value || '').trim().match(/^(\d{4})[-./](\d{2})[-./](\d{2})$/);
    if (!match) return '';
    var normalized = match[1] + '-' + match[2] + '-' + match[3];
    var date = new Date(normalized + 'T00:00:00Z');
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === normalized
      ? normalized : '';
  }

  function parseDateRange(value) {
    var original = String(value || '').trim();
    var parts = original.split('/');
    if (parts.length === 1) {
      var single = normalizeDate(parts[0]);
      if (single) return { start: single, end: single, valid: true };
    }
    if (parts.length === 2) {
      var start = normalizeDate(parts[0]);
      var end = normalizeDate(parts[1]);
      if (start && end && end >= start) return { start: start, end: end, valid: true };
    }
    return { start: '', end: '', valid: false, original: original };
  }

  function serializeDateRange(startValue, endValue) {
    var start = normalizeDate(startValue);
    var end = normalizeDate(endValue);
    if (!start || !end) throw new Error('请选择有效的开始日期和结束日期');
    if (end < start) throw new Error('结束日期不能早于开始日期');
    return start + '/' + end;
  }

  function formatDateRange(value) {
    var range = parseDateRange(value);
    if (!range.valid) return range.original;
    var start = range.start.replace(/-/g, '.');
    var end = range.end.replace(/-/g, '.');
    return range.start === range.end ? start : start + ' — ' + end;
  }

  var municipalityCodes = new Set(['110000', '120000', '310000', '500000']);
  var excludedPrefectureCodes = new Set(['629700', '629800', '629900']);
  var regionCodes = new Set(['232700', '542500', '652900', '653100', '653200', '654200', '654300']);
  var leagueCodes = new Set(['152200', '152500', '152900']);

  function administrativeCode(feature) {
    return String(feature && feature.properties && feature.properties.gb || '').slice(-6);
  }

  function officialAdministrativeName(name, code) {
    var raw = String(name || '').trim();
    if (!raw) return '';
    if (municipalityCodes.has(code)) return raw.endsWith('市') ? raw : raw + '市';
    if (regionCodes.has(code)) return raw.replace(/地$/u, '') + (raw.endsWith('地区') ? '' : '地区');
    if (leagueCodes.has(code)) return raw.endsWith('盟') ? raw : raw + '盟';
    if (raw.includes('自治')) return raw.endsWith('自治州') ? raw : raw + '州';
    return raw.endsWith('市') ? raw : raw + '市';
  }

  function featureCenter(feature) {
    var geometry = feature && feature.geometry;
    if (!geometry || !geometry.coordinates) return null;
    if (geometry.type === 'MultiLineString') {
      var line = geometry.coordinates[0] || [];
      if (!line.length) return null;
      var lineSum = line.reduce(function(sum, point) {
        return [sum[0] + point[0], sum[1] + point[1]];
      }, [0, 0]);
      return [lineSum[0] / line.length, lineSum[1] / line.length];
    }
    var polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
    var largestRing = null;
    var largestArea = -1;
    polygons.forEach(function(polygon) {
      (polygon || []).forEach(function(ring) {
        var area = 0;
        for (var i = 0; i < ring.length - 1; i++) {
          area += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
        }
        if (Math.abs(area) > largestArea) {
          largestArea = Math.abs(area);
          largestRing = ring;
        }
      });
    });
    if (!largestRing || !largestRing.length) return null;
    var cross = 0;
    var x = 0;
    var y = 0;
    for (var j = 0; j < largestRing.length - 1; j++) {
      var a = largestRing[j];
      var b = largestRing[j + 1];
      var factor = a[0] * b[1] - b[0] * a[1];
      cross += factor;
      x += (a[0] + b[0]) * factor;
      y += (a[1] + b[1]) * factor;
    }
    return cross ? [x / (3 * cross), y / (3 * cross)] : largestRing[0].slice(0, 2);
  }

  function buildAdministrativeCityIndex(features) {
    var entries = [];
    var aliases = new Map();
    var prefectureCount = 0;
    (features || []).forEach(function(feature) {
      var code = administrativeCode(feature);
      var isMunicipality = municipalityCodes.has(code);
      var isPrefecture = code.endsWith('00') && code.slice(2, 4) !== '00' &&
        !excludedPrefectureCodes.has(code);
      if (!isMunicipality && !isPrefecture) return;
      var rawName = String(feature.properties && feature.properties.name || '').trim();
      var name = officialAdministrativeName(rawName, code);
      var coordinates = featureCenter(feature);
      if (!name || !coordinates) return;
      var entry = { code: code, name: name, coordinates: coordinates, feature: feature };
      entries.push(entry);
      if (isPrefecture) prefectureCount++;
      [rawName, name, canonicalCityName(name)].forEach(function(alias) {
        alias = String(alias || '').trim();
        if (alias && !aliases.has(alias)) aliases.set(alias, entry);
      });
    });
    return { entries: entries, aliases: aliases, prefectureCount: prefectureCount };
  }

  function resolveAdministrativeCity(index, name) {
    var key = String(name || '').trim();
    if (!key || !index || !index.aliases) return null;
    return index.aliases.get(key) || null;
  }

  function intersects(a, b) {
    return a.left < b.right && a.right > b.left &&
      a.top < b.bottom && a.bottom > b.top;
  }

  function clampMapTranslation(view) {
    var scale = Math.max(1, Number(view && view.scale) || 1);
    var maxX = 500 * (scale - 1);
    var maxY = 360 * (scale - 1);
    var x = Number(view && view.x) || 0;
    var y = Number(view && view.y) || 0;
    return {
      x: maxX ? Math.max(-maxX, Math.min(maxX, x)) : 0,
      y: maxY ? Math.max(-maxY, Math.min(maxY, y)) : 0
    };
  }

  function layoutCityLabels(labels, view) {
    var visible = new Set();
    if (!view || view.scale < 3) return visible;

    var fontSize = 12;
    var gap = view.scale < 6 ? 8 : view.scale < 9 ? 5 : 3;
    if (view.compact) gap += 6;
    var renderScale = Number(view.renderScale) || 1;
    var offsetX = Number(view.offsetX) || 0;
    var offsetY = Number(view.offsetY) || 0;
    var occupied = [];
    var ordered = labels.slice().sort(function(a, b) {
      return Number(b.priority) - Number(a.priority) || a.index - b.index;
    });

    ordered.forEach(function(label) {
      var screenX = offsetX + (view.x + 500 + (label.x - 500) * view.scale) * renderScale;
      var screenY = offsetY + (view.y + 360 + (label.y - 360) * view.scale) * renderScale;
      var width = Math.max(fontSize * 2, String(label.name).length * fontSize);
      var height = fontSize * 1.35;
      var rect = {
        left: screenX - width / 2 - gap,
        right: screenX + width / 2 + gap,
        top: screenY - height / 2 - gap,
        bottom: screenY + height / 2 + gap
      };

      if (rect.right < 0 || rect.left > view.width || rect.bottom < 0 || rect.top > view.height) return;
      if (occupied.some(function(item) { return intersects(rect, item); })) return;
      occupied.push(rect);
      visible.add(label.id || label.name);
    });

    return visible;
  }

  return {
    buildAdministrativeCityIndex: buildAdministrativeCityIndex,
    canonicalCityName: canonicalCityName,
    clampMapTranslation: clampMapTranslation,
    formatDateRange: formatDateRange,
    layoutCityLabels: layoutCityLabels,
    parseDateRange: parseDateRange,
    resolveAdministrativeCity: resolveAdministrativeCity,
    serializeDateRange: serializeDateRange
  };
});
