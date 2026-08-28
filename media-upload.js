(function(root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MediaUpload = api;
})(typeof window !== "undefined" ? window : globalThis, function() {
  var DEFAULT_LIMIT = 20;

  function isSupported(file) {
    return !!file && /^(image|video)\//i.test(String(file.type || ""));
  }

  function selectFiles(files, existingCount, limit) {
    var all = Array.from(files || []);
    var accepted = all.filter(isSupported);
    var resolvedLimit = Number.isInteger(limit) && limit >= 0 ? limit : DEFAULT_LIMIT;
    var remaining = Math.max(0, resolvedLimit - Math.max(0, Number(existingCount) || 0));
    return {
      files: accepted.slice(0, remaining),
      rejectedCount: all.length - accepted.length,
      overflowCount: Math.max(0, accepted.length - remaining),
      limit: resolvedLimit,
    };
  }

  function isVideo(media) {
    var type = String((media && media.type) || "").toLowerCase();
    if (type.indexOf("video/") === 0) return true;
    var source = String((media && (media.url || media.name)) || "").split(/[?#]/)[0].toLowerCase();
    return source.indexOf("data:video/") === 0 || /\.(mp4|webm|ogv|ogg|mov|m4v)$/.test(source);
  }

  return { DEFAULT_LIMIT: DEFAULT_LIMIT, isSupported: isSupported, selectFiles: selectFiles, isVideo: isVideo };
});
