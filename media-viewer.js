(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MediaViewer = api;
}(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  var LIVE_PHOTOS_KIT_URL = 'https://cdn.apple-livephotoskit.com/lpk/1/livephotoskit.js';
  var kitPromise = null;
  var viewerState = createState([], 0);
  var elements = null;
  var returnFocus = null;
  var applePlayer = null;
  var fallbackVideo = null;
  var holdTimer = null;
  var holdPlaying = false;

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

  function currentMedia() {
    return viewerState.items[viewerState.index] || null;
  }

  function setStatus(message) {
    if (elements && elements.status) elements.status.textContent = message || '';
  }

  function stopPlayback() {
    if (holdTimer) root.clearTimeout(holdTimer);
    holdTimer = null;
    if (applePlayer) {
      try {
        if (typeof applePlayer.stop === 'function') applePlayer.stop();
        else if (typeof applePlayer.pause === 'function') applePlayer.pause();
      } catch (_) {}
    }
    if (fallbackVideo) fallbackVideo.pause();
    applePlayer = null;
    fallbackVideo = null;
  }

  function applyScale() {
    if (!elements) return;
    var media = elements.stage.querySelector('.media-viewer-media');
    if (media) media.style.setProperty('--media-scale', String(viewerState.scale));
    elements.reset.textContent = Math.round(viewerState.scale * 100) + '%';
  }

  function renderCurrent() {
    if (!elements) return;
    stopPlayback();
    var media = currentMedia();
    elements.stage.innerHTML = '';
    if (!media) return;
    var image = elements.document.createElement('img');
    image.className = 'media-viewer-media';
    image.src = media.url;
    image.alt = media.name || '高清照片';
    image.decoding = 'async';
    elements.stage.appendChild(image);
    elements.live.hidden = !canPlayLive(media);
    elements.prev.hidden = viewerState.items.length < 2;
    elements.next.hidden = viewerState.items.length < 2;
    setStatus((viewerState.index + 1) + ' / ' + viewerState.items.length +
      (canPlayLive(media) ? ' · 长按照片或点击 LIVE 播放实况' : ''));
    applyScale();
  }

  function playFallbackVideo(media) {
    if (!elements || !canPlayLive(media)) return Promise.resolve();
    elements.stage.innerHTML = '';
    var video = elements.document.createElement('video');
    video.className = 'media-viewer-media';
    video.src = media.motion_url;
    video.poster = media.url;
    video.playsInline = true;
    video.controls = true;
    video.preload = 'metadata';
    elements.stage.appendChild(video);
    fallbackVideo = video;
    setStatus('正在使用浏览器播放器播放实况照片');
    var playResult = video.play();
    return playResult && typeof playResult.catch === 'function' ? playResult.catch(function () {}) : Promise.resolve();
  }

  function playLive() {
    var media = currentMedia();
    if (!canPlayLive(media) || !elements) return Promise.resolve();
    if (viewerState.appleFailed) return playFallbackVideo(media);
    setStatus('正在载入实况照片…');
    return loadLivePhotosKit(elements.document).then(function (kit) {
      elements.stage.innerHTML = '';
      var host = elements.document.createElement('div');
      host.className = 'media-viewer-media media-viewer-live-stage';
      host.dataset.livePhoto = 'true';
      elements.stage.appendChild(host);
      try {
        applePlayer = new kit.Player(host);
      } catch (_) {
        applePlayer = kit.Player(host);
      }
      applePlayer.photoSrc = media.url;
      applePlayer.videoSrc = media.motion_url;
      if (kit.PlaybackStyle && kit.PlaybackStyle.FULL) applePlayer.playbackStyle = kit.PlaybackStyle.FULL;
      if (typeof applePlayer.addEventListener === 'function') {
        applePlayer.addEventListener('error', function () {
          viewerState = markAppleFailed(viewerState);
          playFallbackVideo(media);
        }, { once: true });
        applePlayer.addEventListener('ended', function () {
          setStatus('实况播放完毕 · 可再次长按或点击 LIVE');
        });
      }
      setStatus('正在使用 Apple 实况播放器');
      var playResult = applePlayer.play();
      if (playResult && typeof playResult.catch === 'function') {
        return playResult.catch(function () {
          viewerState = markAppleFailed(viewerState);
          return playFallbackVideo(media);
        });
      }
      return playResult;
    }).catch(function () {
      viewerState = markAppleFailed(viewerState);
      return playFallbackVideo(media);
    });
  }

  function changeMedia(delta) {
    viewerState = move(viewerState, delta);
    renderCurrent();
  }

  function zoomBy(delta) {
    viewerState = Object.assign({}, viewerState, { scale: clampScale(viewerState.scale + delta) });
    applyScale();
  }

  function close() {
    if (!elements) return;
    stopPlayback();
    if (elements.dialog.open && typeof elements.dialog.close === 'function') elements.dialog.close();
    else elements.dialog.removeAttribute('open');
    if (returnFocus && typeof returnFocus.focus === 'function') returnFocus.focus();
    returnFocus = null;
  }

  function bindElements() {
    if (!elements || elements.bound) return;
    elements.bound = true;
    elements.close.addEventListener('click', close);
    elements.prev.addEventListener('click', function () { changeMedia(-1); });
    elements.next.addEventListener('click', function () { changeMedia(1); });
    elements.live.addEventListener('click', playLive);
    elements.zoomIn.addEventListener('click', function () { zoomBy(0.5); });
    elements.zoomOut.addEventListener('click', function () { zoomBy(-0.5); });
    elements.reset.addEventListener('click', function () {
      viewerState = Object.assign({}, viewerState, { scale: 1 });
      applyScale();
    });
    elements.dialog.addEventListener('cancel', function (event) { event.preventDefault(); close(); });
    elements.dialog.addEventListener('click', function (event) { if (event.target === elements.dialog) close(); });
    elements.stage.addEventListener('pointerdown', function (event) {
      if (!canPlayLive(currentMedia()) || event.button > 0) return;
      holdPlaying = false;
      holdTimer = root.setTimeout(function () {
        holdTimer = null;
        holdPlaying = true;
        playLive();
      }, 350);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (type) {
      elements.stage.addEventListener(type, function () {
        if (holdTimer) root.clearTimeout(holdTimer);
        holdTimer = null;
        if (holdPlaying) {
          holdPlaying = false;
          stopPlayback();
          renderCurrent();
        }
      });
    });
    elements.document.addEventListener('keydown', function (event) {
      if (!elements.dialog.open) return;
      if (event.key === 'Escape') close();
      else if (event.key === 'ArrowLeft') changeMedia(-1);
      else if (event.key === 'ArrowRight') changeMedia(1);
      else if (event.key === '+' || event.key === '=') zoomBy(0.5);
      else if (event.key === '-') zoomBy(-0.5);
      else return;
      event.preventDefault();
    });
  }

  function ensureElements() {
    if (elements) return elements;
    var doc = root && root.document;
    if (!doc) return null;
    var dialog = doc.querySelector('#media-viewer');
    if (!dialog) return null;
    elements = {
      document: doc,
      dialog: dialog,
      stage: doc.querySelector('#media-viewer-stage'),
      status: doc.querySelector('#media-viewer-status'),
      close: doc.querySelector('#media-viewer-close'),
      prev: doc.querySelector('#media-viewer-prev'),
      next: doc.querySelector('#media-viewer-next'),
      live: doc.querySelector('#media-viewer-live'),
      zoomIn: doc.querySelector('#media-viewer-zoom-in'),
      zoomOut: doc.querySelector('#media-viewer-zoom-out'),
      reset: doc.querySelector('#media-viewer-reset'),
      bound: false,
    };
    bindElements();
    return elements;
  }

  function open(items, index, trigger) {
    if (!ensureElements()) return;
    viewerState = createState(items, index);
    if (!viewerState.items.length) return;
    returnFocus = trigger || root.document.activeElement;
    renderCurrent();
    if (typeof elements.dialog.showModal === 'function') elements.dialog.showModal();
    else elements.dialog.setAttribute('open', '');
    elements.close.focus();
  }

  return {
    LIVE_PHOTOS_KIT_URL: LIVE_PHOTOS_KIT_URL,
    createState: createState,
    move: move,
    clampScale: clampScale,
    canPlayLive: canPlayLive,
    markAppleFailed: markAppleFailed,
    loadLivePhotosKit: loadLivePhotosKit,
    open: open,
    close: close,
    playLive: playLive,
    playFallbackVideo: playFallbackVideo,
  };
}));
