(function(root, factory) {
  var api = factory(root || {});
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AvatarCropper = api;
})(typeof window !== "undefined" ? window : null, function(root) {
  function fitScale(imageWidth, imageHeight, frameSize) {
    return Math.max(Number(frameSize) / Number(imageWidth), Number(frameSize) / Number(imageHeight));
  }

  function clampZoom(value) {
    return Math.max(1, Math.min(3, Number(value) || 1));
  }

  function clampOffset(state) {
    var halfOverflowX = Math.max(0, (state.imageWidth * state.scale - state.frameSize) / 2);
    var halfOverflowY = Math.max(0, (state.imageHeight * state.scale - state.frameSize) / 2);
    return {
      x: Math.max(-halfOverflowX, Math.min(halfOverflowX, state.x)),
      y: Math.max(-halfOverflowY, Math.min(halfOverflowY, state.y)),
    };
  }

  function cropSourceRect(state) {
    return {
      sx: (state.imageWidth * state.scale - state.frameSize) / (2 * state.scale) - state.x / state.scale,
      sy: (state.imageHeight * state.scale - state.frameSize) / (2 * state.scale) - state.y / state.scale,
      size: state.frameSize / state.scale,
    };
  }

  function createAvatarCropper(options) {
    options = options || {};
    var canvas = options.canvas;
    var zoomInput = options.zoomInput;
    if (!canvas || !zoomInput || typeof canvas.getContext !== "function") throw new Error("头像裁剪器配置不完整");
    var context = canvas.getContext("2d");
    var frameSize = Number(canvas.width) || 280;
    var image = null;
    var objectUrl = "";
    var pointers = new Map();
    var pinch = null;
    var state = { x: 0, y: 0, imageWidth: 0, imageHeight: 0, scale: 1, baseScale: 1, frameSize: frameSize };

    function releaseImage() {
      if (image && typeof image.close === "function") image.close();
      image = null;
      if (objectUrl && root.URL && typeof root.URL.revokeObjectURL === "function") root.URL.revokeObjectURL(objectUrl);
      objectUrl = "";
    }

    function applyOffset(x, y) {
      var next = clampOffset(Object.assign({}, state, { x: x, y: y }));
      state.x = next.x;
      state.y = next.y;
    }

    function render() {
      context.clearRect(0, 0, canvas.width, canvas.height);
      if (!image) return;
      context.save();
      context.translate(frameSize / 2 + state.x, frameSize / 2 + state.y);
      context.scale(state.scale, state.scale);
      context.drawImage(image, -state.imageWidth / 2, -state.imageHeight / 2);
      context.restore();
    }

    function setZoom(multiplier) {
      var bounded = clampZoom(multiplier);
      state.scale = state.baseScale * bounded;
      applyOffset(state.x, state.y);
      zoomInput.value = String(bounded);
      render();
    }

    function decodeWithImage(file) {
      return new Promise(function(resolve, reject) {
        if (!root.URL || typeof root.URL.createObjectURL !== "function" || typeof root.Image !== "function") {
          reject(new Error("当前浏览器无法读取头像"));
          return;
        }
        objectUrl = root.URL.createObjectURL(file);
        var next = new root.Image();
        next.onload = function() { resolve(next); };
        next.onerror = function() { reject(new Error("无法读取这张图片")); };
        next.src = objectUrl;
      });
    }

    async function loadFile(file) {
      if (!file || !/^image\//.test(file.type || "")) throw new Error("请选择图片文件");
      if (file.size > 12 * 1024 * 1024) throw new Error("头像图片不能超过 12 MB");
      reset();
      try {
        image = typeof root.createImageBitmap === "function" ? await root.createImageBitmap(file) : await decodeWithImage(file);
      } catch (error) {
        releaseImage();
        throw error;
      }
      state.imageWidth = image.width;
      state.imageHeight = image.height;
      if (!state.imageWidth || !state.imageHeight) {
        releaseImage();
        throw new Error("这张图片尺寸无效");
      }
      state.baseScale = fitScale(image.width, image.height, frameSize);
      state.scale = state.baseScale;
      zoomInput.value = "1";
      render();
    }

    function pointerPoint(event) {
      var rect = canvas.getBoundingClientRect();
      var ratio = frameSize / Math.max(1, rect.width);
      return { x: event.clientX * ratio, y: event.clientY * ratio };
    }

    function distance(a, b) {
      return Math.hypot(a.x - b.x, a.y - b.y);
    }

    function onPointerDown(event) {
      if (!image) return;
      event.preventDefault();
      pointers.set(event.pointerId, pointerPoint(event));
      if (typeof canvas.setPointerCapture === "function") canvas.setPointerCapture(event.pointerId);
      if (pointers.size === 2) {
        var pair = Array.from(pointers.values());
        pinch = { distance: distance(pair[0], pair[1]), zoom: Number(zoomInput.value) || 1 };
      }
    }

    function onPointerMove(event) {
      var previous = pointers.get(event.pointerId);
      if (!previous) return;
      event.preventDefault();
      var next = pointerPoint(event);
      pointers.set(event.pointerId, next);
      if (pointers.size === 1) {
        applyOffset(state.x + next.x - previous.x, state.y + next.y - previous.y);
        render();
      } else if (pointers.size === 2 && pinch) {
        var pair = Array.from(pointers.values());
        setZoom(pinch.zoom * distance(pair[0], pair[1]) / Math.max(1, pinch.distance));
      }
    }

    function onPointerUp(event) {
      pointers.delete(event.pointerId);
      if (typeof canvas.hasPointerCapture === "function" && canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      pinch = null;
    }

    function onZoomInput() {
      if (image) setZoom(zoomInput.value);
    }

    function toBlob() {
      if (!image) return Promise.reject(new Error("请先选择头像"));
      var source = cropSourceRect(state);
      var doc = options.document || root.document;
      if (!doc || typeof doc.createElement !== "function") return Promise.reject(new Error("当前浏览器无法生成头像"));
      var output = doc.createElement("canvas");
      output.width = output.height = 512;
      output.getContext("2d").drawImage(image, source.sx, source.sy, source.size, source.size, 0, 0, 512, 512);
      return new Promise(function(resolve, reject) {
        output.toBlob(function(blob) {
          if (blob) resolve(blob);
          else reject(new Error("头像生成失败"));
        }, "image/jpeg", 0.88);
      });
    }

    function reset() {
      pointers.clear();
      pinch = null;
      releaseImage();
      state.x = 0;
      state.y = 0;
      state.imageWidth = 0;
      state.imageHeight = 0;
      state.scale = 1;
      state.baseScale = 1;
      zoomInput.value = "1";
      render();
    }

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    zoomInput.addEventListener("input", onZoomInput);

    return {
      loadFile: loadFile,
      setZoom: setZoom,
      hasImage: function() { return Boolean(image); },
      reset: reset,
      toBlob: toBlob,
      destroy: function() {
        reset();
        canvas.removeEventListener("pointerdown", onPointerDown);
        canvas.removeEventListener("pointermove", onPointerMove);
        canvas.removeEventListener("pointerup", onPointerUp);
        canvas.removeEventListener("pointercancel", onPointerUp);
        zoomInput.removeEventListener("input", onZoomInput);
      },
    };
  }

  return {
    fitScale: fitScale,
    clampZoom: clampZoom,
    clampOffset: clampOffset,
    cropSourceRect: cropSourceRect,
    createAvatarCropper: createAvatarCropper,
  };
});
