(function(root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TravelCorridor = api;
})(typeof window !== 'undefined' ? window : globalThis, function(root) {
  'use strict';
  function array(value) {
    if (Array.isArray(value)) return value;
    try { var result = JSON.parse(value); return Array.isArray(result) ? result : []; } catch (_) { return []; }
  }
  function entries(photos, records, selection) {
    var seen = new Set();
    var result = array(photos).filter(function(photo) {
      if (!photo || !photo.url || seen.has(photo.url)) return false;
      if (photo.kind === 'video' || photo.media_kind === 'video' || /\.(mp4|mov|webm)(?:[?#]|$)/i.test(photo.url)) return false;
      seen.add(photo.url);
      return true;
    }).map(function(media) {
      var index = array(records).findIndex(function(record) {
        return array(record.photos).some(function(photo) {
          return photo && (photo.url === media.url || (media.path && photo.path === media.path));
        });
      });
      return { media: media, record: index < 0 ? null : records[index], recordIndex: index,
        width: Number(media.width) || 0, height: Number(media.height) || 0 };
    });
    var curated = array(selection).map(function(choice,order) {
      var entry = result.find(function(item) { return item.media.id === choice.id; });
      if (!entry) return null;
      entry.curationOrder = order; entry.caption = choice.caption;
      if (!entry.record && choice.recordId) {
        var index = array(records).findIndex(function(record) { return record.id === choice.recordId; });
        if (index >= 0) { entry.record = records[index]; entry.recordIndex = index; }
      }
      return entry;
    }).filter(Boolean);
    return curated.length ? curated : result;
  }
  // Balance proportions and locations. Original bytes and URLs stay in the existing data source.
  function select(items, count) {
    var remaining = items.filter(function(item) { return !item.failed; }).slice();
    if (remaining.some(function(item) { return Number.isFinite(item.curationOrder); })) {
      return remaining.sort(function(a,b) { return a.curationOrder-b.curationOrder; }).slice(0,count || 14);
    }
    var chosen = [], cities = {};
    while (remaining.length && chosen.length < (count || 14)) {
      var portrait = chosen.length % 3 === 1;
      remaining.sort(function(a, b) { return score(b) - score(a); });
      var next = remaining.shift();
      chosen.push(next);
      var city = next.media.city || (next.record && next.record.city) || '';
      cities[city] = (cities[city] || 0) + 1;
    }
    function score(item) {
      var city = item.media.city || (item.record && item.record.city) || '';
      return ((item.width < item.height) === portrait ? 5 : 0) - (cities[city] || 0) * 3 +
        (item.record ? 1 : 0) + Math.min(1, item.width * item.height / 1500000);
    }
    return chosen;
  }
  function project(index, progress, width, height, count) {
    var depth = 1.08 + index * 0.49 - progress * Math.max(0, (count - 2) * 0.49);
    var scale = 1 / Math.max(0.28, depth);
    var side = index % 2 ? 1 : -1;
    var vertical = [-0.09, 0.12, 0.19, -0.18, -0.22, 0.05][index % 6];
    return { x: side * width * (width < 700 ? 0.36 : 0.39) * scale,
      y: height * vertical * scale, scale: scale,
      opacity: Math.max(0, Math.min(1, (depth - 0.38) / 0.3)), depth: depth };
  }
  function create(element, options) {
    if (!element) return null;
    var doc = element.ownerDocument;
    var stage = element.querySelector('.corridor-viewport');
    var wall = element.querySelector('.corridor-wall');
    var intro = element.querySelector('.corridor-intro');
    var status = element.querySelector('#corridor-status');
    var controls = element.querySelector('.corridor-controls');
    var toggle = element.querySelector('[data-corridor-mode]');
    var progressBar = element.querySelector('.corridor-progress-fill');
    var countLabel = element.querySelector('#corridor-count');
    var dialog = doc.querySelector('#corridor-memory');
    var reduced = root.matchMedia('(prefers-reduced-motion: reduce)');
    var media = root.matchMedia('(max-width: 700px)');
    var flat = false, authenticated = false, signature = '', version = 0, items = [], cards = [];
    var mm = null, tween = null, pointerCleanup = null, opener = null, selected = null;
    var imageTimers = [];
    var camera = {progress: 0};
    function headerHeight() { return doc.querySelector('.site-header').getBoundingClientRect().height; }

    function setText(selector, text) { dialog.querySelector(selector).textContent = text || ''; }
    function closeMemory() {
      if (dialog.open) dialog.close();
      dialog.querySelector('img').removeAttribute('src');
      selected = null;
    }
    dialog.querySelector('[data-memory-close]').addEventListener('click', closeMemory);
    dialog.addEventListener('close', function() { dialog.querySelector('img').removeAttribute('src'); });
    dialog.addEventListener('click', function(event) { if (event.target === dialog) closeMemory(); });
    dialog.querySelector('[data-memory-hd]').addEventListener('click', function() {
      if (!selected || !authenticated) return;
      var entry = selected;
      closeMemory();
      options.openMedia(entry.media, opener);
    });
    dialog.querySelector('[data-memory-record]').addEventListener('click', function() { closeMemory(); });

    async function openMemory(index, button) {
      if (!authenticated || !items[index]) return;
      var generation = version;
      if (options.prepareMedia) await options.prepareMedia();
      if (!authenticated || generation !== version || !button.isConnected) return;
      selected = items[index]; opener = button;
      var record = selected.record;
      var title = record ? record.title : selected.media.city || '旅途中的一刻';
      setText('#corridor-memory-title', title);
      setText('#corridor-memory-date', record ? String(record.date || '').replace('/', ' — ') : selected.media.city || '相册');
      setText('#corridor-memory-body', record ? record.description : '这张照片，留在了我们的相册里。');
      var preview = selected.media.poster_url || selected.media.cover_url || selected.media.url;
      var image = dialog.querySelector('img'); image.src = options.resolveUrl ? options.resolveUrl(preview) : selected.previewUrl; image.alt = title;
      var link = dialog.querySelector('[data-memory-record]');
      link.hidden = !record;
      if (record) link.href = '#memory-record-' + selected.recordIndex;
      dialog.showModal();
    }
    function cleanup() {
      if (mm) mm.revert();
      mm = null; tween = null;
      if (pointerCleanup) pointerCleanup();
      pointerCleanup = null;
      wall.style.transform = '';
      cards.forEach(function(card) { card.removeAttribute('style'); card.inert = false; });
      intro.style.opacity = '';
    }
    function paint() {
      var width = stage.clientWidth, height = stage.clientHeight;
      cards.forEach(function(card, index) {
        var p = project(index, camera.progress, width, height, cards.length);
        card.style.transform = 'translate(-50%, -50%) translate3d(' + p.x + 'px,' + p.y + 'px,0) scale(' + p.scale + ')';
        card.style.opacity = p.opacity;
        card.style.zIndex = String(cards.length - index);
        card.inert = p.opacity < 0.05;
        card.style.visibility = p.opacity < 0.01 ? 'hidden' : 'visible';
      });
      intro.style.opacity = String(Math.max(0, 1 - camera.progress * 8));
      progressBar.style.transform = 'scaleX(' + camera.progress + ')';
      countLabel.textContent = String(Math.min(items.length, Math.floor(camera.progress * Math.max(1, items.length - 1)) + 1)).padStart(2,'0') + ' / ' + String(items.length).padStart(2,'0');
    }
    function setup() {
      cleanup();
      var staticMode = flat || reduced.matches || !root.gsap || !root.ScrollTrigger || items.length < 3;
      element.classList.toggle('is-flat', staticMode);
      toggle.textContent = reduced.matches ? '已减少动态' : staticMode ? '空间浏览' : '平面浏览';
      toggle.setAttribute('aria-label',reduced.matches ? '已按系统偏好减少动态效果' : '切换至' + toggle.textContent);
      toggle.disabled = reduced.matches || !root.gsap || !root.ScrollTrigger || items.length < 3;
      controls.hidden = !items.length;
      if (!items.length || staticMode) { countLabel.textContent = items.length + ' 张回忆'; return; }
      root.gsap.registerPlugin(root.ScrollTrigger);
      mm = root.gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', function() {
        element.style.setProperty('--corridor-distance', (media.matches ? 110 : 175) * Math.max(4, items.length) + 'px');
        camera.progress = 0;
        tween = root.gsap.fromTo(camera, {progress:0}, {progress:1, ease:'none', onUpdate:paint,
          scrollTrigger:{trigger:element, start:function() { return 'top ' + headerHeight() + 'px'; }, end:'bottom bottom', scrub:0.45,
            invalidateOnRefresh:true, onRefresh:paint,
            onUpdate:function(st) { element.dataset.scrollProgress = String(st.progress); }}});
        paint();
        if (root.matchMedia('(hover: hover) and (pointer: fine)').matches) {
          var xTo = root.gsap.quickTo(wall,'x',{duration:0.7,ease:'power2.out'});
          var yTo = root.gsap.quickTo(wall,'y',{duration:0.7,ease:'power2.out'});
          function move(event) {
            var rect = stage.getBoundingClientRect();
            xTo((event.clientX / rect.width - 0.5) * -16);
            yTo(((event.clientY - rect.top) / rect.height - 0.5) * -10);
          }
          function reset() { xTo(0); yTo(0); }
          stage.addEventListener('pointermove',move);
          stage.addEventListener('pointerleave',reset);
          pointerCleanup = function() { stage.removeEventListener('pointermove',move); stage.removeEventListener('pointerleave',reset); xTo.tween.kill(); yTo.tween.kill(); };
        }
        return function() { element.style.removeProperty('--corridor-distance'); };
      });
      root.ScrollTrigger.refresh();
    }
    toggle.addEventListener('click', function() {
      var top = element.getBoundingClientRect().top + root.scrollY - headerHeight();
      flat = !flat; setup(); root.scrollTo({top:Math.max(0,top),behavior:'instant'});
    });
    element.querySelectorAll('[data-corridor-step]').forEach(function(button) {
      button.addEventListener('click',function() {
        if (!tween || !tween.scrollTrigger) return;
        var st = tween.scrollTrigger;
        var progress = Math.min(1,Math.max(0,camera.progress + Number(button.dataset.corridorStep) / Math.max(1,items.length-2)));
        root.scrollTo({top:st.start + progress*(st.end-st.start),behavior:'smooth'});
      });
    });
    function preferenceChanged() { setup(); }
    reduced.addEventListener('change',preferenceChanged);
    media.addEventListener('change',preferenceChanged);

    function draw(nextItems) {
      imageTimers.forEach(function(timer) { root.clearTimeout(timer); });
      imageTimers = [];
      items = nextItems;
      wall.replaceChildren();
      var generation = version;
      cards = items.map(function(entry,index) {
        var card = doc.createElement('figure'); card.className = 'corridor-photo';
        var button = doc.createElement('button'); button.type = 'button';
        var label = entry.caption || (entry.record ? entry.record.title : entry.media.city || '旅途中的一刻');
        button.setAttribute('aria-label','查看回忆：' + label + '，第 ' + (index+1) + ' 张');
        var img = doc.createElement('img'); img.alt = label;
        img.decoding = 'async'; img.width = entry.width || 1200; img.height = entry.height || 900;
        var settled = false;
        var timer = root.setTimeout(failed,30000);
        imageTimers.push(timer);
        function current() { return !settled && authenticated && generation === version && card.isConnected; }
        function failed() {
          if (!current()) return;
          settled = true; root.clearTimeout(timer); entry.failed = true;
          img.removeAttribute('src'); card.hidden = true; button.disabled = true;
          if (items.every(function(item) { return item.failed; })) {
            draw([]);
            status.hidden = false; status.textContent = '照片暂时未能加载，请到相册重试。';
          }
        }
        img.addEventListener('error',failed);
        img.addEventListener('load',function() {
          if (!current()) return;
          settled = true; root.clearTimeout(timer);
          entry.width = img.naturalWidth; entry.height = img.naturalHeight;
          img.width = entry.width; img.height = entry.height;
          status.hidden = true; status.textContent = '';
        });
        var caption = doc.createElement('figcaption');
        caption.textContent = label;
        button.append(img); card.append(button,caption); wall.append(card);
        img.src = entry.previewUrl;
        button.addEventListener('click',function() { openMemory(index,button); });
        button.addEventListener('focus',function() {
          if (!tween || !tween.scrollTrigger) return;
          var targetProgress = Math.min(1,Math.max(0,(index * 0.49 - 0.5) / Math.max(1,(items.length-2)*0.49)));
          var st = tween.scrollTrigger;
          root.scrollTo({top:st.start + targetProgress*(st.end-st.start),behavior:'instant'});
          camera.progress = targetProgress; paint();
        });
        return card;
      });
      element.classList.toggle('has-photos',!!items.length);
      status.hidden = !!items.length;
      setup();
    }
    async function update(data) {
      authenticated = !!data.authenticated;
      if (!authenticated) {
        version++; signature = ''; closeMemory(); draw([]);
        status.hidden = false; status.textContent = '登录后，走进我们的照片长廊。';
        return;
      }
      var candidates = entries(data.photos,data.records,options.selection);
      candidates.forEach(function(entry) {
        var url = entry.media.poster_url || entry.media.cover_url || entry.media.url;
        entry.previewUrl = options.resolveUrl ? options.resolveUrl(url) : url;
        if (!entry.record && options.recordForPhoto) {
          var match = options.recordForPhoto(entry.media);
          if (match) { entry.record = match.record; entry.recordIndex = match.recordIndex; }
        }
      });
      var nextSignature = JSON.stringify(candidates.map(function(entry) { return [entry.media.url,entry.previewUrl,entry.media.city,entry.record]; }));
      if (signature === nextSignature) {
        if (!candidates.length) status.textContent = data.status === 'loading' ? '正在展开相册…' : data.status === 'error' ? '相册暂未连接，稍后刷新再看看。' : '相册还没有照片，去留下一段新的回忆吧。';
        return;
      }
      signature = nextSignature;
      closeMemory();
      version++;
      if (!candidates.length) {
        draw([]);
        status.textContent = data.status === 'loading' ? '正在展开相册…' : data.status === 'error' ? '相册暂未连接，稍后刷新再看看。' : '相册还没有照片，去留下一段新的回忆吧。';
        return;
      }
      // Insert each image immediately: a slow original must not hold the exhibition closed.
      var sample = candidates.filter(function(_,i) { return i % Math.max(1,Math.ceil(candidates.length/36)) === 0; }).slice(0,36);
      draw(select(sample.filter(function(entry) { return !!entry.previewUrl; }),14));
      status.hidden = false;
      status.textContent = items.length || data.status === 'loading' ? '正在展开相册…' : '照片暂时未能加载，请到相册重试。';
    }
    return {update:update};
  }
  return {entries:entries,select:select,project:project,create:create};
});
