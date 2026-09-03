(function(root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AuthClient = api;
})(typeof window !== "undefined" ? window : globalThis, function() {
  var DEFAULT_STORAGE_KEY = "dating-web:auth:v1";

  function defaultStorage() {
    try {
      return typeof localStorage !== "undefined" ? localStorage : null;
    } catch (_) {
      return null;
    }
  }

  function clock(now) {
    var value = typeof now === "function" ? Number(now()) : Number(now);
    if (isFinite(value)) return Math.floor(value > 100000000000 ? value / 1000 : value);
    return Math.floor(Date.now() / 1000);
  }

  function copyWithoutPassword(value) {
    if (Array.isArray(value)) return value.map(copyWithoutPassword);
    if (!value || typeof value !== "object") return value;
    var result = {};
    Object.keys(value).forEach(function(key) {
      if (key.toLowerCase() === "password") return;
      result[key] = copyWithoutPassword(value[key]);
    });
    return result;
  }

  function cleanSession(value, previous, now) {
    if (!value || typeof value !== "object") return null;
    var source = Object.assign({}, previous || {}, value);
    if (!source.access_token || typeof source.access_token !== "string") return null;
    var session = {
      access_token: source.access_token,
      refresh_token: source.refresh_token || (previous && previous.refresh_token) || null,
    };
    if (source.token_type) session.token_type = source.token_type;
    if (source.expires_at != null && isFinite(Number(source.expires_at))) {
      session.expires_at = Math.floor(Number(source.expires_at));
    } else if (source.expires_in != null && isFinite(Number(source.expires_in))) {
      session.expires_at = now + Math.max(0, Math.floor(Number(source.expires_in)));
    } else if (previous && previous.expires_at != null) {
      session.expires_at = previous.expires_at;
    }
    if (source.expires_in != null && isFinite(Number(source.expires_in))) {
      session.expires_in = Math.floor(Number(source.expires_in));
    }
    if (source.user) session.user = copyWithoutPassword(source.user);
    else if (previous && previous.user) session.user = copyWithoutPassword(previous.user);
    return session;
  }

  function createAuthClient(options) {
    options = options || {};
    var baseUrl = String(options.url || "").replace(/\/$/, "");
    var key = options.key;
    var storage = options.storage === undefined ? defaultStorage() : options.storage;
    var storageKey = options.storageKey || DEFAULT_STORAGE_KEY;
    var request = options.fetchImpl || (typeof fetch === "function" ? fetch.bind(globalThis) : null);
    var now = function() { return clock(options.now); };
    var location = options.location || (typeof window !== "undefined" ? window.location : null);
    var history = options.history || (typeof window !== "undefined" ? window.history : null);
    var listeners = [];
    var session = null;

    if (!request) throw new Error("浏览器不支持认证请求");

    function clearStorage() {
      try {
        if (storage && typeof storage.removeItem === "function") storage.removeItem(storageKey);
      } catch (_) {}
    }

    function loadSession() {
      try {
        if (!storage || typeof storage.getItem !== "function") return null;
        var raw = storage.getItem(storageKey);
        if (!raw) return null;
        var loaded = cleanSession(JSON.parse(raw), null, now());
        if (!loaded) clearStorage();
        return loaded;
      } catch (_) {
        clearStorage();
        return null;
      }
    }

    function saveSession(value) {
      try {
        if (storage && typeof storage.setItem === "function") {
          storage.setItem(storageKey, JSON.stringify(value));
        }
      } catch (_) {}
    }

    function publicSession(value) {
      return value ? copyWithoutPassword(value) : null;
    }

    function notify(event, value) {
      var safe = publicSession(value);
      listeners.slice().forEach(function(listener) {
        try { listener(event, safe); } catch (_) {}
      });
    }

    function setSession(value, event) {
      session = value ? cleanSession(value, session, now()) : null;
      if (session) saveSession(session);
      else clearStorage();
      if (event) notify(event, session);
      return publicSession(session);
    }

    function clearSession(event) {
      var hadSession = !!session;
      session = null;
      clearStorage();
      if (event && hadSession) notify(event, null);
    }

    function shouldRefresh(value) {
      return !!(value && value.expires_at != null && value.expires_at <= now() + 60);
    }

    async function readResponse(response) {
      if (!response || !response.ok) {
        var details = "";
        if (response && typeof response.text === "function") {
          try { details = await response.text(); } catch (_) {}
        }
        var status = response && response.status != null ? response.status : "网络";
        throw new Error("认证请求失败（" + status + "）" + (details ? ": " + details : ""));
      }
      if (response.status === 204) return null;
      if (typeof response.text === "function") {
        var body = await response.text();
        if (!body) return null;
        try { return JSON.parse(body); } catch (_) { return body; }
      }
      return typeof response.json === "function" ? response.json() : null;
    }

    async function authRequest(path, requestOptions) {
      if (!key) throw new Error("缺少认证配置");
      var requestConfig = Object.assign({}, requestOptions || {});
      requestConfig.headers = Object.assign({ apikey: key, "Content-Type": "application/json" }, requestConfig.headers || {});
      try {
        return await readResponse(await request(baseUrl + path, requestConfig));
      } catch (error) {
        if (error && /^认证请求失败/.test(error.message || "")) throw error;
        throw new Error("认证网络请求失败：" + (error && error.message ? error.message : "未知错误"));
      }
    }

    async function refreshSession() {
      if (!session || !session.refresh_token) return publicSession(session);
      var oldSession = session;
      try {
        var response = await authRequest("/auth/v1/token?grant_type=refresh_token", {
          method: "POST",
          body: JSON.stringify({ refresh_token: oldSession.refresh_token }),
        });
        var refreshed = cleanSession(response, oldSession, now());
        if (!refreshed) throw new Error("认证刷新响应无效");
        return setSession(refreshed, "TOKEN_REFRESHED");
      } catch (error) {
        clearSession("SIGNED_OUT");
        throw error;
      }
    }

    session = loadSession();

    return {
      signInWithPassword: async function(email, password) {
        var response = await authRequest("/auth/v1/token?grant_type=password", {
          method: "POST",
          body: JSON.stringify({ email: email, password: password }),
        });
        var nextSession = cleanSession(response, null, now());
        if (!nextSession) throw new Error("认证响应无效");
        return setSession(nextSession, "SIGNED_IN");
      },

      signOut: async function() {
        var oldSession = session;
        var error = null;
        try {
          if (oldSession && oldSession.access_token) {
            await authRequest("/auth/v1/logout", {
              method: "POST",
              headers: { Authorization: "Bearer " + oldSession.access_token },
            });
          }
        } catch (requestError) {
          error = requestError;
        } finally {
          clearSession("SIGNED_OUT");
        }
        if (error) throw error;
        return null;
      },

      getSession: async function() {
        if (!session) return null;
        if (shouldRefresh(session) && session.refresh_token) {
          return refreshSession();
        }
        if (shouldRefresh(session) && !session.refresh_token) {
          clearSession("SIGNED_OUT");
          return null;
        }
        return publicSession(session);
      },

      getAccessToken: async function() {
        if (!session) return null;
        if (shouldRefresh(session) && session.refresh_token) {
          var refreshed = await refreshSession();
          return refreshed ? refreshed.access_token : null;
        }
        if (shouldRefresh(session) && !session.refresh_token) {
          clearSession("SIGNED_OUT");
          return null;
        }
        return session.access_token;
      },

      resetPasswordForEmail: async function(email, redirectTo) {
        var target = redirectTo;
        if (target == null && location && location.href) target = location.href;
        var query = target == null ? "" : "?redirect_to=" + encodeURIComponent(String(target));
        return authRequest("/auth/v1/recover" + query, {
          method: "POST",
          body: JSON.stringify({ email: email }),
        });
      },

      consumeRecoveryRedirect: async function() {
        var hash = location && typeof location.hash === "string" ? location.hash : "";
        if (!hash || hash.charAt(0) !== "#") return null;
        var params = {};
        hash.slice(1).split("&").forEach(function(part) {
          if (!part) return;
          var pieces = part.split("=");
          var name = decodeURIComponent(pieces.shift() || "");
          var value = decodeURIComponent(pieces.join("=") || "");
          params[name] = value;
        });
        if (params.type !== "recovery" || !params.access_token || !params.refresh_token) return null;
        var recovery = cleanSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
          expires_in: params.expires_in,
          token_type: params.token_type,
        }, null, now());
        if (!recovery) return null;
        setSession(recovery, "PASSWORD_RECOVERY");
        if (history && typeof history.replaceState === "function") {
          var cleanUrl = baseUrl + "/";
          if (location && location.href) cleanUrl = location.href.replace(/#.*/, "");
          history.replaceState("", "", cleanUrl);
        }
        return publicSession(recovery);
      },

      updatePassword: async function(newPassword) {
        var current = await this.getSession();
        if (!current || !current.access_token) throw new Error("请先登录");
        var response = await authRequest("/auth/v1/user", {
          method: "PUT",
          headers: { Authorization: "Bearer " + current.access_token },
          body: JSON.stringify({ password: newPassword }),
        });
        if (response && response.user) {
          session.user = copyWithoutPassword(response.user);
          saveSession(session);
        }
        notify("USER_UPDATED", session);
        return copyWithoutPassword(response);
      },

      onAuthStateChange: function(listener) {
        if (typeof listener !== "function") return function() {};
        listeners.push(listener);
        return function() {
          var index = listeners.indexOf(listener);
          if (index >= 0) listeners.splice(index, 1);
        };
      },
    };
  }

  return { createAuthClient: createAuthClient };
});
