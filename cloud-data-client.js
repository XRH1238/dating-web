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
    var allowAnonymousWrites = options.allowAnonymousWrites === true;
    var timeoutMs = options.timeoutMs || 10000;
    var request = options.fetchImpl || (typeof fetch === "function" ? fetch.bind(globalThis) : null);
    if (!request) throw new Error("浏览器不支持云端请求");

    function timeoutError() {
      return new Error("云端请求超时");
    }

    async function withTimeout(operation) {
      var controller = typeof AbortController === "function" ? new AbortController() : null;
      var timer;
      var timeout = new Promise(function(_resolve, reject) {
        timer = setTimeout(function() {
          if (controller) controller.abort();
          reject(timeoutError());
        }, timeoutMs);
      });
      try {
        return await Promise.race([
          Promise.resolve().then(function() { return operation(controller ? controller.signal : null); }),
          timeout,
        ]);
      } finally {
        clearTimeout(timer);
      }
    }

    function requestWithSignal(url, requestOptions, signal) {
      var nextOptions = Object.assign({}, requestOptions || {});
      if (signal) nextOptions.signal = signal;
      return request(url, nextOptions);
    }

    function normalizeUserToken(token) {
      if (typeof token !== "string") return null;
      var normalized = token.trim();
      if (!normalized || normalized === key || normalized === storageKey) return null;
      if (normalized.indexOf("sb_publishable_") === 0 || normalized.indexOf("sb_secret_") === 0) return null;
      if (hasLegacyPrivilegedRole(normalized)) return null;
      return normalized;
    }

    function hasLegacyPrivilegedRole(token) {
      var parts = token.split(".");
      if (parts.length !== 3 || !parts[1] || typeof atob !== "function") return false;
      try {
        var payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        while (payload.length % 4) payload += "=";
        var role = JSON.parse(atob(payload)).role;
        return role === "anon" || role === "service_role";
      } catch (_) {
        return false;
      }
    }

    async function tokenFromGetter(allowAnonymousFallback) {
      if (!getAccessToken) return null;
      try {
        return normalizeUserToken(await getAccessToken());
      } catch (error) {
        if (allowAnonymousFallback) return null;
        throw error;
      }
    }

    async function databaseHeaders(extra, requireUser) {
      var token = await tokenFromGetter(!requireUser);
      if (requireUser && !token && !allowAnonymousWrites) throw new Error("请先登录后再保存");
      return Object.assign({ apikey: key }, token ? { Authorization: "Bearer " + token } : {}, extra || {});
    }

    function storageHeaders(extra) {
      return Object.assign({ apikey: storageKey }, extra || {});
    }

    async function requiredUserToken() {
      var token = await tokenFromGetter(false);
      if (!token) throw new Error("请先登录后再保存");
      return token;
    }

    function encodedPath(path) {
      return path.split("/").map(encodeURIComponent).join("/");
    }

    function safePath(value) {
      if (typeof value !== "string" || !value.trim()) throw new Error("无效的文件路径");
      if (/[\u0000-\u001f\u007f-\u009f]/.test(value)) throw new Error("无效的文件路径");
      var segments = value.split("/");
      for (var index = 0; index < segments.length; index++) {
        if (!segments[index] || segments[index] === "." || segments[index] === "..") throw new Error("无效的文件路径");
      }
      return value;
    }

    function safePaths(paths) {
      if (!Array.isArray(paths)) throw new Error("无效的文件路径");
      return paths.map(safePath);
    }

    function signedUploadUrl(value, bucket, path) {
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
        signedUrl.username ||
        signedUrl.password ||
        signedUrl.origin !== storageUrl.origin ||
        signedUrl.pathname !== "/storage/v1/object/upload/sign/" + safeSegment(bucket) + "/" + encodedPath(path)
      ) {
        throw new Error("网关返回的上传地址无效");
      }
      var tokens = signedUrl.searchParams.getAll("token");
      if (tokens.length !== 1 || !tokens[0]) throw new Error("网关返回的上传地址无效");
      return signedUrl.href;
    }

    async function parse(response) {
      if (!response.ok) {
        var details = typeof response.text === "function" ? await response.text() : "";
        var error = new Error("云端请求失败（" + response.status + "）" + (details ? ": " + details : ""));
        error.status = response.status;
        throw error;
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
        return withTimeout(async function(signal) {
          var response = await requestWithSignal(baseUrl + "/rest/v1/" + safeSegment(table) + "?select=*&order=created_at.desc", {
            headers: await databaseHeaders(),
          }, signal);
          return parse(response);
        });
      },
      insert: async function(table, rows) {
        return withTimeout(async function(signal) {
          var response = await requestWithSignal(baseUrl + "/rest/v1/" + safeSegment(table), {
            method: "POST",
            headers: await databaseHeaders({ "Content-Type": "application/json", Prefer: "return=minimal" }, true),
            body: JSON.stringify(rows),
          }, signal);
          return parse(response);
        });
      },
      update: async function(table, id, values) {
        return withTimeout(async function(signal) {
          var response = await requestWithSignal(baseUrl + "/rest/v1/" + safeSegment(table) + "?id=eq." + encodeURIComponent(id), {
            method: "PATCH",
            headers: await databaseHeaders({ "Content-Type": "application/json", Prefer: "return=minimal" }, true),
            body: JSON.stringify(values),
          }, signal);
          return parse(response);
        });
      },
      remove: async function(table, id) {
        return withTimeout(async function(signal) {
          var response = await requestWithSignal(baseUrl + "/rest/v1/" + safeSegment(table) + "?id=eq." + encodeURIComponent(id), {
            method: "DELETE",
            headers: await databaseHeaders({ Prefer: "return=minimal" }, true),
          }, signal);
          return parse(response);
        });
      },
      upload: async function(bucket, path, file) {
        bucket = safeSegment(bucket);
        path = safePath(path);
        var encoded = encodedPath(path);
        return withTimeout(async function(signal) {
          if (storageGatewayUrl) {
            var token = await requiredUserToken();
            var signResponse = await requestWithSignal(storageGatewayUrl, {
              method: "POST",
              headers: { apikey: key, Authorization: "Bearer " + token, "Content-Type": "application/json" },
              body: JSON.stringify({ action: "sign-upload", backend: storageBackend, bucket: bucket, path: path }),
            }, signal);
            var signed = await parse(signResponse);
            var uploadUrl = signedUploadUrl(signed && signed.signedUrl, bucket, path);
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
            var uploadResponse = await requestWithSignal(uploadUrl, uploadOptions, signal);
            return parse(uploadResponse);
          } else {
            var response = await requestWithSignal(storageBaseUrl + "/storage/v1/object/" + bucket + "/" + encoded, {
              method: "POST",
              headers: storageHeaders({ "Content-Type": file.type || "application/octet-stream", "x-upsert": "false" }),
              body: file,
            }, signal);
            return parse(response);
          }
        });
      },
      removeObjects: async function(bucket, paths) {
        bucket = safeSegment(bucket);
        var prefixes = safePaths(paths);
        if (!prefixes.length) return [];
        return withTimeout(async function(signal) {
          if (storageGatewayUrl) {
            var token = await requiredUserToken();
            var gatewayResponse = await requestWithSignal(storageGatewayUrl, {
              method: "POST",
              headers: { apikey: key, Authorization: "Bearer " + token, "Content-Type": "application/json" },
              body: JSON.stringify({ action: "delete", backend: storageBackend, bucket: bucket, paths: prefixes }),
            }, signal);
            return parse(gatewayResponse);
          }
          var response = await requestWithSignal(storageBaseUrl + "/storage/v1/object/" + bucket, {
            method: "DELETE",
            headers: storageHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify({ prefixes: prefixes }),
          }, signal);
          return parse(response);
        });
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
