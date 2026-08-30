(function(root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ImageCompression = api;
})(typeof window !== "undefined" ? window : globalThis, function() {
  "use strict";

  var DEFAULT_MAX_EDGE = 3200;
  var DEFAULT_QUALITY = 0.88;
  var DEFAULT_MIN_BYTES = 1024 * 1024;

  function targetDimensions(width, height, maxEdge) {
    var safeWidth = Math.max(1, Number(width) || 1);
    var safeHeight = Math.max(1, Number(height) || 1);
    var limit = Math.max(1, Number(maxEdge) || DEFAULT_MAX_EDGE);
    var scale = Math.min(1, limit / Math.max(safeWidth, safeHeight));
    return {
      width: Math.round(safeWidth * scale),
      height: Math.round(safeHeight * scale),
    };
  }

  function preferSmaller(original, compressed) {
    return compressed && Number(compressed.size) < Number(original.size) ? compressed : original;
  }

  function webpName(name) {
    var value = String(name || "photo");
    return (/\.[^.]+$/.test(value) ? value.replace(/\.[^.]+$/, "") : value) + ".webp";
  }

  function canCompress(file) {
    var type = String((file && file.type) || "").toLowerCase();
    var name = String((file && file.name) || "").toLowerCase();
    if (type === "image/gif" || type === "image/svg+xml" || /\.(gif|svg)$/.test(name)) return false;
    return type.indexOf("image/") === 0 || /\.(jpe?g|png|webp|avif|heic|heif)$/.test(name);
  }

  function canvasBlob(canvas, type, quality) {
    return new Promise(function(resolve) {
      canvas.toBlob(resolve, type, quality);
    });
  }

  async function compressFile(file, options) {
    options = options || {};
    var originalBytes = Number((file && file.size) || 0);
    var unchanged = { file: file, originalBytes: originalBytes, uploadBytes: originalBytes, savedBytes: 0, compressed: false, warning: "" };
    if (!canCompress(file)) return unchanged;
    if (typeof createImageBitmap !== "function" || typeof document === "undefined") {
      return Object.assign({}, unchanged, { warning: "当前浏览器无法压缩这张照片，已保留原文件。" });
    }
    var bitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      var maxEdge = Number(options.maxEdge) || DEFAULT_MAX_EDGE;
      var minBytes = Number(options.minBytes) || DEFAULT_MIN_BYTES;
      if (Math.max(bitmap.width, bitmap.height) <= maxEdge && originalBytes <= minBytes) return unchanged;
      var size = targetDimensions(bitmap.width, bitmap.height, maxEdge);
      var canvas = document.createElement("canvas");
      canvas.width = size.width;
      canvas.height = size.height;
      var context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas unavailable");
      context.drawImage(bitmap, 0, 0, size.width, size.height);
      var blob = await canvasBlob(canvas, "image/webp", Number(options.quality) || DEFAULT_QUALITY);
      if (!blob) throw new Error("Image export failed");
      var candidate = new File([blob], webpName(file.name), { type: "image/webp", lastModified: Date.now() });
      var selected = preferSmaller(file, candidate);
      var uploadBytes = Number(selected.size) || originalBytes;
      return {
        file: selected,
        originalBytes: originalBytes,
        uploadBytes: uploadBytes,
        savedBytes: Math.max(0, originalBytes - uploadBytes),
        compressed: selected === candidate,
        warning: "",
      };
    } catch (_) {
      return Object.assign({}, unchanged, { warning: "这张照片无法压缩，已保留原文件。" });
    } finally {
      if (bitmap && typeof bitmap.close === "function") bitmap.close();
    }
  }

  return {
    DEFAULT_MAX_EDGE: DEFAULT_MAX_EDGE,
    DEFAULT_QUALITY: DEFAULT_QUALITY,
    targetDimensions: targetDimensions,
    preferSmaller: preferSmaller,
    webpName: webpName,
    canCompress: canCompress,
    compressFile: compressFile,
  };
});
