(function(root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.StorageObjectRef = api;
})(typeof window !== "undefined" ? window : globalThis, function() {
  var controlCharacters = /[\u0000-\u001f\u007f-\u009f]/;

  function originOf(value) {
    try {
      var url = new URL(value);
      if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) return null;
      return url.origin;
    } catch (_) {
      return null;
    }
  }

  function safeObjectPath(pathname) {
    var encodedSegments = pathname.split("/");
    if (encodedSegments.length < 2) return null;
    var decoded = [];
    for (var index = 0; index < encodedSegments.length; index++) {
      var segment;
      try { segment = decodeURIComponent(encodedSegments[index]); }
      catch (_) { return null; }
      if (!segment || segment === "." || segment === ".." || segment.includes("/") ||
          segment.includes("\\") || controlCharacters.test(segment)) return null;
      decoded.push(segment);
    }
    return decoded.join("/");
  }

  function parsePublicObjectUrl(value, options) {
    if (typeof value !== "string" || !options) return null;
    var parsed;
    try { parsed = new URL(value); }
    catch (_) { return null; }
    if ((parsed.protocol !== "https:" && parsed.protocol !== "http:") || parsed.username || parsed.password) return null;
    var origins = {
      primary: originOf(options.primaryUrl),
      secondary: originOf(options.secondaryUrl),
    };
    var backend = parsed.origin === origins.primary ? "primary" :
      (parsed.origin === origins.secondary ? "secondary" : null);
    if (!backend) return null;
    var prefix = "/storage/v1/object/public/" + encodeURIComponent(options.bucket) + "/";
    if (!parsed.pathname.startsWith(prefix)) return null;
    var path = safeObjectPath(parsed.pathname.slice(prefix.length));
    return path ? { backend: backend, path: path } : null;
  }

  function collectMediaTargets(media, options) {
    var result = { primary: [], secondary: [], unresolved: false };
    [media && media.url, media && media.motion_url].forEach(function(value) {
      if (!value) return;
      var ref = parsePublicObjectUrl(value, options);
      if (!ref) {
        result.unresolved = true;
        return;
      }
      if (result[ref.backend].indexOf(ref.path) === -1) result[ref.backend].push(ref.path);
    });
    return result;
  }

  return {
    parsePublicObjectUrl: parsePublicObjectUrl,
    collectMediaTargets: collectMediaTargets,
  };
});
