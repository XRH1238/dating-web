(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.LivePhotoMedia = api;
}(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var IMAGE_EXTENSIONS = /\.(jpe?g|png|gif|webp|avif|heic|heif)$/i;
  var VIDEO_EXTENSIONS = /\.(mov|mp4|m4v|webm|ogv|ogg)$/i;

  function fileName(file) {
    return String(file && file.name || '');
  }

  function mimeType(file) {
    return String(file && file.type || '').toLowerCase();
  }

  function isImage(file) {
    return mimeType(file).indexOf('image/') === 0 || IMAGE_EXTENSIONS.test(fileName(file));
  }

  function isVideo(file) {
    return mimeType(file).indexOf('video/') === 0 || VIDEO_EXTENSIONS.test(fileName(file));
  }

  function stem(file) {
    return fileName(file).replace(/\.[^.]+$/, '').toLowerCase();
  }

  function isLivePhoto(media) {
    return !!(media && media.kind === 'live-photo' && media.photoFile && media.motionFile);
  }

  function selectMedia(files, existingCount, limit) {
    var all = Array.from(files || []);
    var supported = all.filter(function (file) {
      return isImage(file) || isVideo(file);
    });
    var videosByStem = new Map();
    supported.filter(isVideo).forEach(function (file) {
      var key = stem(file);
      if (!videosByStem.has(key)) videosByStem.set(key, []);
      videosByStem.get(key).push(file);
    });

    var usedVideos = new Set();
    var items = [];
    supported.filter(isImage).forEach(function (photoFile) {
      var motionFile = (videosByStem.get(stem(photoFile)) || []).find(function (file) {
        return !usedVideos.has(file);
      });
      if (motionFile) {
        usedVideos.add(motionFile);
        items.push({ kind: 'live-photo', photoFile: photoFile, motionFile: motionFile });
      } else {
        items.push({ kind: 'image', file: photoFile });
      }
    });
    supported.filter(isVideo).forEach(function (file) {
      if (!usedVideos.has(file)) items.push({ kind: 'video', file: file });
    });

    var resolvedLimit = Number.isInteger(limit) && limit >= 0 ? limit : 20;
    var currentCount = Math.max(0, Number(existingCount) || 0);
    var remaining = Math.max(0, resolvedLimit - currentCount);
    var selected = items.slice(0, remaining);

    return {
      items: selected,
      rejectedCount: all.length - supported.length,
      overflowCount: Math.max(0, items.length - remaining),
      pairedCount: selected.filter(isLivePhoto).length,
      unmatchedMotionCount: selected.filter(function (item) {
        return item.kind === 'video' && /\.mov$/i.test(fileName(item.file));
      }).length,
      limit: resolvedLimit,
    };
  }

  return {
    isImage: isImage,
    isVideo: isVideo,
    stem: stem,
    selectMedia: selectMedia,
    isLivePhoto: isLivePhoto,
  };
}));
