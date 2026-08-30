(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MediaViewer = api;
}(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  var LIVE_PHOTOS_KIT_URL = 'https://cdn.apple-livephotoskit.com/lpk/1/livephotoskit.js';
  var kitPromise = null;

  function normalizeIndex(index, count) {
    if (!count) return 0;
    return ((Number(index) || 0) % count + count) % count;
  }

  function createState(items, index) {
    var mediaItems = Array.isArray(items) ? items.slice() : [];
    return {
      items: mediaItems,
      index: normalizeIndex(index, mediaItems.length),
      scale: 1,
      appleFailed: false,
    };
  }

  function move(state, delta) {
    if (!state.items.length) return state;
    return Object.assign({}, state, {
      index: normalizeIndex(state.index + (Number(delta) || 0), state.items.length),
      scale: 1,
      appleFailed: false,
    });
  }

  function clampScale(value) {
    return Math.min(5, Math.max(1, Number(value) || 1));
  }

  function canPlayLive(media) {
    var kind = media && (media.kind || media.media_kind);
    return !!(media && kind === 'live-photo' && media.url && media.motion_url);
  }

  function markAppleFailed(state) {
    return Object.assign({}, state, { appleFailed: true });
  }

  function loadLivePhotosKit(documentRef) {
    var doc = documentRef || (root && root.document);
    var win = doc && doc.defaultView || root;
    if (win && win.LivePhotosKit) return Promise.resolve(win.LivePhotosKit);
    if (!doc || !doc.createElement) return Promise.reject(new Error('LivePhotosKit 需要浏览器环境'));
    if (kitPromise) return kitPromise;

    kitPromise = new Promise(function (resolve, reject) {
      var existing = doc.querySelector && doc.querySelector('script[data-live-photos-kit]');
      var script = existing || doc.createElement('script');
      function finish() {
        if (win && win.LivePhotosKit) resolve(win.LivePhotosKit);
        else reject(new Error('Apple LivePhotosKit 未能初始化'));
      }
      script.addEventListener('load', finish, { once: true });
      script.addEventListener('error', function () {
        reject(new Error('Apple LivePhotosKit 加载失败'));
      }, { once: true });
      if (!existing) {
        script.src = LIVE_PHOTOS_KIT_URL;
        script.async = true;
        script.dataset.livePhotosKit = 'true';
        (doc.head || doc.documentElement).appendChild(script);
      }
    }).catch(function (error) {
      kitPromise = null;
      throw error;
    });
    return kitPromise;
  }

  return {
    LIVE_PHOTOS_KIT_URL: LIVE_PHOTOS_KIT_URL,
    createState: createState,
    move: move,
    clampScale: clampScale,
    canPlayLive: canPlayLive,
    markAppleFailed: markAppleFailed,
    loadLivePhotosKit: loadLivePhotosKit,
  };
}));
