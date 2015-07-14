'use strict';

(function(exports) {
  const DATASTORE_NAME = 'bookmarks_store';

  const DB_NAME = 'home-bookmarks';
  const DB_STORE = 'bookmarks';
  const DB_VERSION = 1;

  const DB_REVISION_SETTING = 'bookmarksRevision';

  function Bookmarks() {}

  Bookmarks.prototype = {
    /**
     * The bookmarks datastore
     */
    datastore: null,

    /**
     * The last datastore revision that was synced
     */
    lastRevision: null,

    /**
     * Our local indexed db where we store our copy of bookmarks
     */
    db: null,

    init: function() {
      var revisionString = localStorage.getItem(DB_REVISION_SETTING);
      if (revisionString) {
        this.lastRevision = JSON.parse(revisionString);
      }

      return Promise.all([
        // Open up our bookmarks indexeddb
        new Promise((resolve, reject) => {
          var req = window.indexedDB.open(DB_NAME, DB_VERSION);
          req.onupgradeneeded = this.upgradeSchema;
          req.onsuccess = (e) => {
            this.db = e.target.result;
            resolve();
          };
          req.onerror = (e) => {
            console.error('Error opening homescreen bookmarks db', e);
            reject(e);
          };
        }),

        // Open up the shared bookmarks datastore
        new Promise((resolve, reject) => {
          if (!navigator.getDataStores) {
            reject('DataStore API is unavailable');
            return;
          }

          navigator.getDataStores(DATASTORE_NAME).then((stores) => {
            if (stores.length < 1) {
              reject(DATASTORE_NAME + ' inaccessible');
              return;
            }

            this.datastore = stores[0];
            this.datastore.addEventListener('change', this.onChange.bind(this));
            resolve();
          }, reject);
        })
      ]).then(this.synchronise.bind(this));
    },

    upgradeSchema: function(e) {
      var db = e.target.result;
      var fromVersion = e.oldVersion;
      if (fromVersion < 1) {
        var store = db.createObjectStore(DB_STORE, { keyPath: 'id' });
        store.createIndex('data', 'data', { unique: false });
      }
    },

    synchronise: function() {
      return new Promise((resolve, reject) => {
        var cursor = this.datastore.sync(this.lastRevision);

        var self = this;
        function cursorResolve(task) {
          var promises = [];
          switch (task.operation) {
            case 'update':
            case 'add':
              promises.push(self.set(task.data));
              break;

            case 'remove':
              promises.push(self.remove(task.id));
              break;

            case 'clear':
              promises.push(self.clear());
              break;

            case 'done':
              self.updateRevision();
              resolve();
              return;
          }

          promises.push(cursor.next());
          Promise.all(promises).then(
            (results) => {
              cursorResolve(results.pop());
            }, reject);
        }

        cursor.next().then(cursorResolve, reject);
      });
    },

    set: function(data) {
      return new Promise((resolve, reject) => {
        var txn = this.db.transaction([DB_STORE], 'readwrite');
        txn.oncomplete = resolve;
        txn.onerror = reject;
        txn.objectStore(DB_STORE).put({ id: data.id, data: data });
      });
    },

    remove: function(id) {
      return new Promise((resolve, reject) => {
        var txn = this.db.transaction([DB_STORE], 'readwrite');
        txn.oncomplete = resolve;
        txn.onerror = reject;
        txn.objectStore(DB_STORE).delete(id);
      });
    },

    clear: function() {
      return new Promise((resolve, reject) => {
        var txn = this.db.transaction([DB_STORE], 'readwrite');
        txn.oncomplete = resolve;
        txn.onerror = reject;
        txn.objectStore(DB_STORE).clear();
      });
    },

    updateRevision: function() {
      this.lastRevision = this.datastore.revisionId;
      localStorage.setItem(DB_REVISION_SETTING,
                           JSON.stringify(this.lastRevision));
    },

    onChange: function(e) {
      this.synchronise().then(() => {
        switch(e.operation) {
          case 'updated':
            document.dispatchEvent(new CustomEvent('bookmark-changed',
                                                   { detail: { id: e.id }}));
            break;

          case 'added':
            document.dispatchEvent(new CustomEvent('bookmark-added',
                                                   { detail: { id: e.id }}));
            break;

          case 'removed':
            document.dispatchEvent(new CustomEvent('bookmark-removed',
                                                   { detail: { id: e.id }}));
            break;

          case 'cleared':
            document.dispatchEvent(new CustomEvent('bookmarks-cleared'));
            break;
        }
      },
      (error) => {
        console.error('Failed to handle bookmarks change', error);
      });
    },

    get: function(id) {
      return new Promise((resolve, reject) => {
        var txn = this.db.transaction([DB_STORE], 'readonly');
        txn.onerror = reject;
        txn.objectStore(DB_STORE).get(id).onsuccess =
          (event) => {
            resolve(event.target.result);
          };
      });
    },

    getAll: function() {
      return new Promise((resolve, reject) => {
        var results = [];
        var txn = this.db.transaction([DB_STORE], 'readonly');
        txn.onerror = reject;
        txn.objectStore(DB_STORE).openCursor().onsuccess =
          (event) => {
            var cursor = event.target.result;
            if (cursor) {
              results.push(cursor.value);
              cursor.continue();
            }
          };
        txn.oncomplete = () => { resolve(results); };
      });
    }
  };

  exports.Bookmarks = Bookmarks;

}(window));
