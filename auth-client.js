(function(root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AuthClient = api;
})(typeof window !== "undefined" ? window : null, function() {
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

  function projectUser(value) {
    if (!value || typeof value !== "object" || value.id == null || value.id === "") return null;
    var result = { id: value.id };
    if (typeof value.email === "string") result.email = value.email;
    if (typeof value.role === "string") result.role = value.role;
    return result;
  }

  function hasValidExpiry(value) {
    return !!(value && (
      (value.expires_at != null && isFinite(Number(value.expires_at)) && Number(value.expires_at) > 0) ||
      (value.expires_in != null && isFinite(Number(value.expires_in)) && Number(value.expires_in) > 0)
    ));
  }

  function hasValidPersistedExpiry(value) {
    return !!(value && value.expires_at != null && isFinite(Number(value.expires_at)) && Number(value.expires_at) > 0);
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
    if (value.expires_at != null && isFinite(Number(value.expires_at))) {
      session.expires_at = Math.floor(Number(value.expires_at));
    } else if (value.expires_in != null && isFinite(Number(value.expires_in))) {
      session.expires_at = now + Math.max(0, Math.floor(Number(value.expires_in)));
    } else if (previous && previous.expires_at != null) {
      session.expires_at = previous.expires_at;
    }
    if (source.user) {
      var user = projectUser(source.user);
      if (user) session.user = user;
    } else if (previous && previous.user) {
      var previousUser = projectUser(previous.user);
      if (previousUser) session.user = previousUser;
    }
    return session;
  }

  function normalizeBaseUrl(value) {
    try {
      if (/[?#]/.test(value)) return null;
      if (typeof URL === "function") {
        var parsed = new URL(value);
        if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || !parsed.hostname || parsed.username || parsed.password) return null;
        return parsed.origin + parsed.pathname.replace(/\/+$/, "");
      }
      var fallback = /^(https?):\/\/([^/?#\s@]+)(\/[^?#\s]*)?$/i.exec(value);
      if (!fallback) return null;
      return fallback[1].toLowerCase() + "://" + fallback[2] + (fallback[3] || "").replace(/\/+$/, "");
    } catch (_) {
      return null;
    }
  }

  function isNonEmptyString(value) {
    return typeof value === "string" && value.length > 0;
  }

  function hasValidPasswordResponse(value) {
    return !!(value && isNonEmptyString(value.access_token) && isNonEmptyString(value.refresh_token) && hasValidExpiry(value) && projectUser(value.user));
  }

  function hasValidRefreshResponse(value) {
    return !!(value && isNonEmptyString(value.access_token) && hasValidExpiry(value));
  }

  function createAuthClient(options) {
    options = options || {};
    var rawUrl = String(options.url || "").trim();
    var baseUrl = normalizeBaseUrl(rawUrl);
    if (!baseUrl) throw new Error("认证 URL 必须是无凭据、无 query/hash 的绝对 http/https URL");
    var key = options.key;
    if (key == null || String(key).trim() === "") throw new Error("认证 key 不能为空");
    var storage = options.storage === undefined ? defaultStorage() : options.storage;
    var storageKey = options.storageKey || DEFAULT_STORAGE_KEY;
    var request = options.fetchImpl || (typeof fetch === "function" ? fetch.bind(globalThis) : null);
    var timeoutMs = Number(options.timeoutMs);
    if (!isFinite(timeoutMs) || timeoutMs <= 0) timeoutMs = 10000;
    var now = function() { return clock(options.now); };
    var location = options.location || (typeof window !== "undefined" ? window.location : null);
    var history = options.history || (typeof window !== "undefined" ? window.history : null);
    var listeners = [];
    var session = null;
    var mutationGeneration = 0;
    var pendingRefresh = null;

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
        var parsed = JSON.parse(raw);
        var hasTokens = parsed && isNonEmptyString(parsed.access_token) && isNonEmptyString(parsed.refresh_token);
        if (!hasTokens || !hasValidPersistedExpiry(parsed)) {
          clearStorage();
          return null;
        }
        var loaded = cleanSession(parsed, null, now());
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

    function clearSession(event, forceNotify) {
      var hadSession = !!session;
      session = null;
      clearStorage();
      if (event && (hadSession || forceNotify)) notify(event, null);
    }

    function beginMutation() {
      mutationGeneration += 1;
      return mutationGeneration;
    }

    function staleMutationError() {
      return new Error("认证操作已过期");
    }

    function shouldRefresh(value) {
      return !!(value && value.expires_at != null && value.expires_at <= now() + 60);
    }

    function decodeFragmentPart(value) {
      try {
        return decodeURIComponent(String(value).replace(/\+/g, " "));
      } catch (_) {
        return null;
      }
    }

    async function readResponse(response) {
      if (!response || !response.ok) {
        var details = "";
        if (response && typeof response.text === "function") {
          try { details = await response.text(); } catch (_) {}
        }
        var status = response && response.status != null ? response.status : "网络";
        var error = new Error("认证请求失败（" + status + "）" + (details ? ": " + details : ""));
        if (response && isFinite(Number(response.status))) error.status = Number(response.status);
        throw error;
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
        return await readResponse(await timedRequest(baseUrl + path, requestConfig));
      } catch (error) {
        if (error && (/^认证请求失败/.test(error.message || "") || error.message === "认证请求超时")) throw error;
        throw new Error("认证网络请求失败：" + (error && error.message ? error.message : "未知错误"));
      }
    }

    async function timedRequest(url, requestOptions) {
      var controller = typeof AbortController === "function" ? new AbortController() : null;
      var timer = null;
      var config = Object.assign({}, requestOptions || {});
      if (controller) config.signal = controller.signal;
      try {
        if (controller) timer = setTimeout(function() { controller.abort(); }, timeoutMs);
        return await request(url, config);
      } catch (error) {
        if (controller && controller.signal.aborted) throw new Error("认证请求超时");
        throw error;
      } finally {
        if (timer) clearTimeout(timer);
      }
    }

    function refreshSession() {
      if (!session || !session.refresh_token) return Promise.resolve(publicSession(session));
      var oldSession = session;
      var refreshGeneration = mutationGeneration;
      if (pendingRefresh && pendingRefresh.session === oldSession && pendingRefresh.generation === refreshGeneration) {
        return pendingRefresh.promise;
      }
      var promise = (async function() {
        try {
          var response = await authRequest("/auth/v1/token?grant_type=refresh_token", {
            method: "POST",
            body: JSON.stringify({ refresh_token: oldSession.refresh_token }),
          });
          if (!hasValidRefreshResponse(response)) {
            throw new Error("认证刷新响应无效");
          }
          if (session !== oldSession || mutationGeneration !== refreshGeneration) return null;
          var refreshed = cleanSession(response, oldSession, now());
          if (!refreshed) throw new Error("认证刷新响应无效");
          return setSession(refreshed, "TOKEN_REFRESHED");
        } catch (error) {
          if (session !== oldSession || mutationGeneration !== refreshGeneration) return null;
          clearSession("SIGNED_OUT");
          throw error;
        }
      })();
      pendingRefresh = { session: oldSession, generation: refreshGeneration, promise: promise };
      promise.then(function() {
        if (pendingRefresh && pendingRefresh.promise === promise) pendingRefresh = null;
      }, function() {
        if (pendingRefresh && pendingRefresh.promise === promise) pendingRefresh = null;
      });
      return promise;
    }

    session = loadSession();

    async function getCurrentSession() {
      if (!session) return null;
      if (shouldRefresh(session) && session.refresh_token) return refreshSession();
      if (shouldRefresh(session) && !session.refresh_token) {
        clearSession("SIGNED_OUT");
        return null;
      }
      return publicSession(session);
    }

    function clearRecoveryFragment() {
      if (history && typeof history.replaceState === "function") {
        var cleanUrl = baseUrl + "/";
        if (location && location.href) cleanUrl = location.href.replace(/#.*/, "");
        history.replaceState("", "", cleanUrl);
      }
    }

    return {
      signInWithPassword: async function(email, password) {
        var generation = beginMutation();
        var response = await authRequest("/auth/v1/token?grant_type=password", {
          method: "POST",
          body: JSON.stringify({ email: email, password: password }),
        });
        if (generation !== mutationGeneration) throw staleMutationError();
        if (!hasValidPasswordResponse(response)) throw new Error("认证响应无效");
        var nextSession = cleanSession(response, null, now());
        if (!nextSession) throw new Error("认证响应无效");
        return setSession(nextSession, "SIGNED_IN");
      },

      signOut: async function() {
        var oldSession = session;
        beginMutation();
        clearSession("SIGNED_OUT", true);
        var error = null;
        try {
          if (oldSession && oldSession.access_token) {
            await authRequest("/auth/v1/logout?scope=local", {
              method: "POST",
              headers: { Authorization: "Bearer " + oldSession.access_token },
            });
          }
        } catch (requestError) {
          error = requestError;
        }
        if (error) throw error;
        return null;
      },

      getSession: getCurrentSession,

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
        var fragment = hash.slice(1);
        if (!/(?:^|&)type=recovery(?:&|$)/.test(fragment)) return null;
        var clearAttempted = false;
        function clearOnce() {
          if (clearAttempted) return;
          clearAttempted = true;
          clearRecoveryFragment();
        }
        try {
          var params = {};
          fragment.split("&").forEach(function(part) {
            if (!part) return;
            var pieces = part.split("=");
            var name = decodeFragmentPart(pieces.shift() || "");
            var value = decodeFragmentPart(pieces.join("=") || "");
            if (name != null && value != null) params[name] = value;
          });
          if (params.type !== "recovery" || !params.access_token || !params.refresh_token) return null;
          var recoveryPayload = {
            access_token: params.access_token,
            refresh_token: params.refresh_token,
            expires_in: params.expires_in,
            token_type: params.token_type,
          };
          if (!isNonEmptyString(recoveryPayload.access_token) || !isNonEmptyString(recoveryPayload.refresh_token) || !hasValidExpiry(recoveryPayload)) return null;
          var recovery = cleanSession(recoveryPayload, null, now());
          if (!recovery) return null;
          var generation = beginMutation();
          clearOnce();
          if (generation !== mutationGeneration) return null;
          setSession(recovery, "PASSWORD_RECOVERY");
          return publicSession(recovery);
        } finally {
          clearOnce();
        }
      },

      updatePassword: async function(newPassword) {
        var operationGeneration = mutationGeneration;
        var current = await getCurrentSession();
        if (!current || !current.access_token) throw new Error("请先登录");
        if (mutationGeneration !== operationGeneration) return null;
        var targetSession = session;
        if (!targetSession) return null;
        var targetGeneration = operationGeneration;
        var response = await authRequest("/auth/v1/user", {
          method: "PUT",
          headers: { Authorization: "Bearer " + current.access_token },
          body: JSON.stringify({ password: newPassword }),
        });
        if (session !== targetSession || mutationGeneration !== targetGeneration) return copyWithoutPassword(response);
        if (response && response.user) {
          var responseUser = projectUser(response.user);
          if (responseUser) {
            session.user = responseUser;
            saveSession(session);
          }
        } else if (response && response.id) {
          var updatedUser = projectUser(response);
          if (updatedUser) {
            session.user = updatedUser;
            saveSession(session);
          }
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
