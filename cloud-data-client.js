(function(root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CloudDataClient = api;
})(typeof window !== "undefined" ? window : globalThis, function() {
  var emptySnapshot = function() {
    return { plans: [], records: [], todos: [], photos: [] };
  };

  function normalizeSnapshot(value) {
    var fallback = emptySnapshot();
    if (!value || typeof value !== "object") return fallback;
    Object.keys(fallback).forEach(function(key) {
      fallback[key] = Array.isArray(value[key]) ? value[key] : [];
    });
    return fallback;
  }

  function createSnapshotStore(storage, storageKey) {
    return {
      load: function() {
        try {
          var raw = storage && storage.getItem(storageKey);
          return raw ? normalizeSnapshot(JSON.parse(raw)) : emptySnapshot();
        } catch (_) {
          return emptySnapshot();
        }
      },
      save: function(snapshot) {
        try {
          if (!storage) return false;
          storage.setItem(storageKey, JSON.stringify(normalizeSnapshot(snapshot)));
          return true;
        } catch (_) {
          return false;
        }
      },
    };
  }

  function createCloudDataClient(options) {
    var baseUrl = String(options.url || "").replace(/\/$/, "");
    var key = options.key;
    var timeoutMs = options.timeoutMs || 10000;
    var request = options.fetchImpl || (typeof fetch === "function" ? fetch.bind(globalThis) : null);
    if (!request) throw new Error("浏览器不支持云端请求");

    async function timedRequest(url, requestOptions) {
      var controller = typeof AbortController === "function" ? new AbortController() : null;
      var timer = controller ? setTimeout(function() { controller.abort(); }, timeoutMs) : null;
      try {
        var nextOptions = Object.assign({}, requestOptions || {});
        if (controller) nextOptions.signal = controller.signal;
        return await request(url, nextOptions);
      } catch (error) {
        if (controller && controller.signal.aborted) throw new Error("云端请求超时");
        throw error;
      } finally {
        if (timer) clearTimeout(timer);
      }
    }

    function headers(extra) {
      return Object.assign({ apikey: key, Authorization: "Bearer " + key }, extra || {});
    }

    async function parse(response) {
      if (!response.ok) {
        var details = typeof response.text === "function" ? await response.text() : "";
        throw new Error("云端请求失败（" + response.status + "）" + (details ? ": " + details : ""));
      }
      if (response.status === 204) return null;
      if (typeof response.text === "function") {
        var body = await response.text();
        return body ? JSON.parse(body) : null;
      }
      return typeof response.json === "function" ? response.json() : null;
    }

    function safeSegment(value) {
      if (!/^[a-zA-Z0-9_-]+$/.test(value)) throw new Error("无效的数据表名称");
      return value;
    }

    return {
      select: async function(table) {
        var response = await timedRequest(baseUrl + "/rest/v1/" + safeSegment(table) + "?select=*&order=created_at.desc", {
          headers: headers(),
        });
        return parse(response);
      },
      insert: async function(table, rows) {
        var response = await timedRequest(baseUrl + "/rest/v1/" + safeSegment(table), {
          method: "POST",
          headers: headers({ "Content-Type": "application/json", Prefer: "return=minimal" }),
          body: JSON.stringify(rows),
        });
        return parse(response);
      },
      update: async function(table, id, values) {
        var response = await timedRequest(baseUrl + "/rest/v1/" + safeSegment(table) + "?id=eq." + encodeURIComponent(id), {
          method: "PATCH",
          headers: headers({ "Content-Type": "application/json", Prefer: "return=minimal" }),
          body: JSON.stringify(values),
        });
        return parse(response);
      },
      remove: async function(table, id) {
        var response = await timedRequest(baseUrl + "/rest/v1/" + safeSegment(table) + "?id=eq." + encodeURIComponent(id), {
          method: "DELETE",
          headers: headers({ Prefer: "return=minimal" }),
        });
        return parse(response);
      },
      upload: async function(bucket, path, file) {
        var encodedPath = path.split("/").map(encodeURIComponent).join("/");
        var response = await timedRequest(baseUrl + "/storage/v1/object/" + safeSegment(bucket) + "/" + encodedPath, {
          method: "POST",
          headers: headers({ "Content-Type": file.type || "application/octet-stream", "x-upsert": "false" }),
          body: file,
        });
        return parse(response);
      },
      getPublicUrl: function(bucket, path) {
        var encodedPath = path.split("/").map(encodeURIComponent).join("/");
        return baseUrl + "/storage/v1/object/public/" + safeSegment(bucket) + "/" + encodedPath;
      },
    };
  }

  return {
    createCloudDataClient: createCloudDataClient,
    createSnapshotStore: createSnapshotStore,
  };
});
