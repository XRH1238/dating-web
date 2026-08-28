(function(root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.RecordRecovery = api;
})(typeof window !== "undefined" ? window : globalThis, function() {
  function createDraftStore(storage, storageKey) {
    return {
      load: function() {
        try {
          var raw = storage && storage.getItem(storageKey);
          if (!raw) return null;
          var value = JSON.parse(raw);
          return value && typeof value === "object" && !Array.isArray(value) ? value : null;
        } catch (_) {
          return null;
        }
      },
      save: function(draft) {
        try {
          if (!storage) return false;
          storage.setItem(storageKey, JSON.stringify(draft));
          return true;
        } catch (_) {
          return false;
        }
      },
      clear: function() {
        try {
          if (storage) storage.removeItem(storageKey);
        } catch (_) {}
      },
    };
  }

  function createPendingRecord(record, localId) {
    return Object.assign({}, record || {}, {
      local_id: localId,
      pending_sync: true,
    });
  }

  function mergeRemoteRecords(remoteRecords, localRecords) {
    var pending = (localRecords || []).filter(function(record) { return record && record.pending_sync; });
    return pending.concat(Array.isArray(remoteRecords) ? remoteRecords : []);
  }

  function toCloudRecord(record) {
    var next = Object.assign({}, record || {});
    delete next.local_id;
    delete next.pending_sync;
    return next;
  }

  return {
    createDraftStore: createDraftStore,
    createPendingRecord: createPendingRecord,
    mergeRemoteRecords: mergeRemoteRecords,
    toCloudRecord: toCloudRecord,
  };
});
