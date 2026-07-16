(function(root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MapLabelLayout = api;
})(typeof window !== 'undefined' ? window : globalThis, function() {
  function canonicalCityName(name) {
    return String(name || '').trim().replace(/(?:特别行政区|自治州|地区|自治|盟|市)$/u, '');
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
    canonicalCityName: canonicalCityName,
    clampMapTranslation: clampMapTranslation,
    layoutCityLabels: layoutCityLabels
  };
});
