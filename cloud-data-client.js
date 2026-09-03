(function(root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CloudDataClient = api;
})(typeof window !== "undefined" ? window : globalThis, function() {
  var emptySnapshot = function() {
    return { plans: [], records: [], todos: [], photos: [], capsules: [] };
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
    var storageBaseUrl = String(options.storageUrl || options.url || "").replace(/\/$/, "");
    var storageKey = options.storageKey || key;
    var getAccessToken = typeof options.getAccessToken === "function" ? options.getAccessToken : null;
    var storageGatewayUrl = options.storageGatewayUrl ? String(options.storageGatewayUrl).replace(/\/$/, "") : "";
    var storageBackend = options.storageBackend || "secondary";
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

    async function databaseHeaders(extra, requireUser) {
      var token = getAccessToken ? await getAccessToken() : null;
      if (requireUser && getAccessToken && !token) throw new Error("请先登录后再保存");
      return Object.assign({ apikey: key }, token ? { Authorization: "Bearer " + token } : {}, extra || {});
    }

    function storageHeaders(extra) {
      return Object.assign({ apikey: storageKey }, extra || {});
    }

    async function requiredUserToken() {
      var token = getAccessToken ? await getAccessToken() : null;
      if (!token) throw new Error("请先登录后再保存");
      return token;
    }

    function signedUploadUrl(value) {
      var signedUrl;
      var storageUrl;
      try {
        signedUrl = new URL(value);
        storageUrl = new URL(storageBaseUrl);
      } catch (_) {
        throw new Error("网关返回的上传地址无效");
      }
      if (
        (signedUrl.protocol !== "https:" && signedUrl.protocol !== "http:") ||
        signedUrl.origin !== storageUrl.origin ||
        signedUrl.pathname.indexOf("/storage/v1/object/upload/sign/") !== 0
      ) {
        throw new Error("网关返回的上传地址无效");
      }
      return signedUrl.href;
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
          headers: await databaseHeaders(),
        });
        return parse(response);
      },
      insert: async function(table, rows) {
        var response = await timedRequest(baseUrl + "/rest/v1/" + safeSegment(table), {
          method: "POST",
          headers: await databaseHeaders({ "Content-Type": "application/json", Prefer: "return=minimal" }, true),
          body: JSON.stringify(rows),
        });
        return parse(response);
      },
      update: async function(table, id, values) {
        var response = await timedRequest(baseUrl + "/rest/v1/" + safeSegment(table) + "?id=eq." + encodeURIComponent(id), {
          method: "PATCH",
          headers: await databaseHeaders({ "Content-Type": "application/json", Prefer: "return=minimal" }, true),
          body: JSON.stringify(values),
        });
        return parse(response);
      },
      remove: async function(table, id) {
        var response = await timedRequest(baseUrl + "/rest/v1/" + safeSegment(table) + "?id=eq." + encodeURIComponent(id), {
          method: "DELETE",
          headers: await databaseHeaders({ Prefer: "return=minimal" }, true),
        });
        return parse(response);
      },
      upload: async function(bucket, path, file) {
        var encodedPath = path.split("/").map(encodeURIComponent).join("/");
        if (storageGatewayUrl) {
          var token = await requiredUserToken();
          var signResponse = await timedRequest(storageGatewayUrl, {
            method: "POST",
            headers: { apikey: key, Authorization: "Bearer " + token, "Content-Type": "application/json" },
            body: JSON.stringify({ action: "sign-upload", backend: storageBackend, bucket: safeSegment(bucket), path: path }),
          });
          var signed = await parse(signResponse);
          var uploadUrl = signedUploadUrl(signed && signed.signedUrl);
          var isBlob = typeof Blob !== "undefined" && file instanceof Blob;
          var uploadOptions = { method: "PUT", headers: { "x-upsert": "false" } };
          if (isBlob && typeof FormData !== "undefined") {
            var form = new FormData();
            form.append("cacheControl", "3600");
            form.append("", file);
            uploadOptions.body = form;
          } else {
            uploadOptions.headers["Content-Type"] = file.type || "application/octet-stream";
            uploadOptions.body = file;
          }
          var uploadResponse = await timedRequest(uploadUrl, uploadOptions);
          return parse(uploadResponse);
        }
        var response = await timedRequest(storageBaseUrl + "/storage/v1/object/" + safeSegment(bucket) + "/" + encodedPath, {
          method: "POST",
          headers: storageHeaders({ "Content-Type": file.type || "application/octet-stream", "x-upsert": "false" }),
          body: file,
        });
        return parse(response);
      },
      removeObjects: async function(bucket, paths) {
        var prefixes = Array.from(paths || []).filter(Boolean);
        if (!prefixes.length) return [];
        if (storageGatewayUrl) {
          var token = await requiredUserToken();
          var gatewayResponse = await timedRequest(storageGatewayUrl, {
            method: "POST",
            headers: { apikey: key, Authorization: "Bearer " + token, "Content-Type": "application/json" },
            body: JSON.stringify({ action: "delete", backend: storageBackend, bucket: safeSegment(bucket), paths: prefixes }),
          });
          return parse(gatewayResponse);
        }
        var response = await timedRequest(storageBaseUrl + "/storage/v1/object/" + safeSegment(bucket), {
          method: "DELETE",
          headers: storageHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ prefixes: prefixes }),
        });
        return parse(response);
      },
      getPublicUrl: function(bucket, path) {
        var encodedPath = path.split("/").map(encodeURIComponent).join("/");
        return storageBaseUrl + "/storage/v1/object/public/" + safeSegment(bucket) + "/" + encodedPath;
      },
    };
  }

  return {
    createCloudDataClient: createCloudDataClient,
    createSnapshotStore: createSnapshotStore,
  };
});
