'use strict';

const APP_LOAD_STAGGER = 0;//100;
const PINCH_DISTANCE_THRESHOLD = 150;
const PINCH_FEEDBACK_THRESHOLD = 5;
const AUTOSCROLL_DISTANCE = 45;
const DELETE_DISTANCE = 60;
const HIDDEN_ROLES = [
  'system', 'input', 'homescreen', 'theme', 'addon', 'langpack'
];

(function(exports) {

  function App() {
    // Element references
    this.shadow = document.getElementById('shadow');
    this.scrollable = document.getElementById('scrollable');
    this.icons = document.getElementById('apps');
    this.uninstall = document.getElementById('uninstall');

    // App-loading
    this.lastAppLoad = Date.now();

    // Scroll behaviour
    this.scrolled = false;

    // Pinch-to-zoom
    this.small = false;
    this.wasSmall = false;
    this.pinchListening = false;

    // Signal handlers
    this.scrollable.addEventListener('scroll', this);
    this.icons.addEventListener('activate', this);
    this.icons.addEventListener('drag-start', this);
    this.icons.addEventListener('drag-move', this);
    this.icons.addEventListener('drag-end', this);
    this.icons.addEventListener('drag-rearrange', this);
    this.icons.addEventListener('drag-finish', this);
    this.icons.addEventListener('touchstart', this);
    this.icons.addEventListener('touchmove', this);
    this.icons.addEventListener('touchend', this);
    this.icons.addEventListener('touchcancel', this);
    navigator.mozApps.mgmt.addEventListener('install', this);
    navigator.mozApps.mgmt.addEventListener('uninstall', this);

    // Populate apps
    var populateApps = () => {
      var request = navigator.mozApps.mgmt.getAll();
      request.onsuccess = (e) => {
        for (var app of request.result) {
          this.addApp(app);
        }

        setTimeout(() => {
          for (var data of this.startupMetadata) {
            console.log('Removing unknown app metadata entry', data.id);
            this.metadata.remove(data.id);
          }
          this.startupMetadata = [];
          this.storeAppOrder();
        }, Math.max(0, (this.lastAppLoad - Date.now()) + APP_LOAD_STAGGER));
      };
      request.onerror = (e) => {
        console.error("Error calling getAll: " + request.error.name);
      };
    };

    this.startupMetadata = [];
    this.metadata = new HomeMetadata();
    this.metadata.init().then(() => {
      this.metadata.get().then((results) => {
        this.startupMetadata = results;
        populateApps();
      },
      (e) => {
        console.error('Failed to retrieve metadata entries', e);
        populateApps();
      });
    },
    (e) => {
      console.error('Failed to initialise metadata db', e);
      populateApps();
    });
  }

  App.prototype = {
    addApp: function(app) {
      var manifest = app.manifest || app.updateManifest;
      if (!manifest) {
        console.log('Skipping app with no manifest', app);
        return;
      }

      if (manifest.role && HIDDEN_ROLES.indexOf(manifest.role) !== -1) {
        console.log('Skipping app with role \'' + manifest.role + '\'', app);
        return;
      }

      var currentTime = Date.now();
      var targetDelay =
        Math.max(0, APP_LOAD_STAGGER - (currentTime - this.lastAppLoad));
      this.lastAppLoad = currentTime + targetDelay;

      window.setTimeout(function loadApp(app) {
        var manifest = app.manifest || app.updateManifest;
        if (manifest.entry_points) {
          for (var entryPoint in manifest.entry_points) {
            this.addAppIcon(app, entryPoint);
          }
        } else {
          this.addAppIcon(app);
        }
      }.bind(this, app), targetDelay);
    },

    addAppIcon: function(app, entryPoint) {
      var id = app.manifestURL + '/' + (entryPoint ? entryPoint : '');
      var entry = this.startupMetadata.findIndex((element) => {
        return element.id === id;
      });
      var container = document.createElement('div');
      container.classList.add('icon-container');

      // Try to insert the app in the right order
      if (entry !== -1) {
        var order = this.startupMetadata[entry].order || 0;
        container.order = order;
        var children = this.icons.children;
        for (var i = 0, iLen = children.length; i < iLen; i++) {
          var child = children[i];
          if (!child.order || child.order < order) {
            continue;
          }
          this.icons.insertBefore(container, child);
          break;
        }
      }

      if (!container.parentNode) {
        this.icons.appendChild(container);
      }

      var icon = document.createElement('gaia-app-icon');
      container.appendChild(icon);
      icon.entryPoint = entryPoint;
      icon.app = app;

      // Load the cached icon
      if (entry !== -1) {
        icon.icon = this.startupMetadata[entry].icon;
        this.startupMetadata.splice(entry, 1);
      }

      // Save the refreshed app icon
      icon.addEventListener('icon-loaded', function(icon, id) {
        icon.icon.then((blob) => {
          this.metadata.set([{ id: id, icon: blob }]).then(
            () => {},
            (e) => {
              console.error('Error saving app icon', e);
            });
        });
      }.bind(this, icon, id));

      // Refresh app data (sets app title and refreshes app icon)
      icon.refresh();
    },

    storeAppOrder: function() {
      var storedOrders = [];
      var children = this.icons.children;
      for (var i = 0, iLen = children.length; i < iLen; i++) {
        var appIcon = children[i].firstElementChild;
        var id = appIcon.app.manifestURL + '/' + appIcon.entryPoint;
        storedOrders.push({ id: id, order: i });
      }
      this.metadata.set(storedOrders).then(
        () => {},
        (e) => {
          console.error('Error storing app order', e);
        });
    },

    stopPinch: function() {
      if (!this.pinchListening) {
        return;
      }

      this.scrollable.addEventListener('transitionend', this);
      this.pinchListening = false;
      this.scrollable.style.transition = '';
      this.scrollable.style.transform = '';
    },

    handleEvent: function(e) {
      switch (e.type) {
      // Display the top shadow when scrolling down
      case 'scroll':
        if (this.scrolled !== this.scrollable.scrollTop > 0) {
          this.scrolled = !this.scrolled;
          this.shadow.classList.toggle('visible', this.scrolled);
        }
        break;

      // App launching
      case 'activate':
        e.detail.target.firstElementChild.launch();
        break;

      // Disable scrolling during dragging, and display app-uninstall bar
      case 'drag-start':
        document.body.classList.add('dragging');
        if (e.detail.target.firstElementChild.app.removable) {
          this.uninstall.classList.add('dragging');
        }
        break;

      case 'drag-finish':
        document.body.classList.remove('dragging');
        this.uninstall.classList.remove('dragging');
        break;

      // Handle app uninstallation
      case 'drag-end':
        if (e.detail.clientY <= window.innerHeight - DELETE_DISTANCE) {
          return;
        }

        var app = e.detail.target.firstElementChild.app;
        if (!app.removable) {
          return;
        }

        e.preventDefault();
        navigator.mozApps.mgmt.uninstall(app);
        break;

      // Save the app grid after rearrangement
      case 'drag-rearrange':
        this.storeAppOrder();
        break;

      // Handle app-uninstall bar highlight and auto-scroll
      case 'drag-move':
        var inDelete = false;
        var inAutoscroll = false;

        if (e.detail.clientY > window.innerHeight - DELETE_DISTANCE) {
          inDelete = true;
        } else if (e.detail.clientY >
                   window.innerHeight - AUTOSCROLL_DISTANCE) {
          inAutoscroll = true;
        }

        this.uninstall.classList.toggle('active', inDelete);
        break;

      // Pinch-to-zoom
      case 'touchstart':
        if (e.touches.length === 2) {
          this.wasSmall = this.small;
          this.startDistance =
            Math.sqrt(Math.pow(e.touches[0].clientX -
                               e.touches[1].clientX, 2) +
                      Math.pow(e.touches[0].clientY -
                               e.touches[1].clientY, 2));
          this.pinchListening = true;
          document.body.classList.add('zooming');
          this.scrollable.style.transition = 'unset';
        } else {
          this.stopPinch();
        }
        break;

      case 'touchmove':
        if (!this.pinchListening || e.touches.length !== 2) {
          return;
        }

        var distance =
          (Math.sqrt(Math.pow(e.touches[0].clientX -
                              e.touches[1].clientX, 2) +
                     Math.pow(e.touches[0].clientY -
                              e.touches[1].clientY, 2))) -
          this.startDistance;

        var newState;
        if (this.wasSmall) {
          newState = (distance < PINCH_DISTANCE_THRESHOLD);
        } else {
          newState = (distance < -PINCH_DISTANCE_THRESHOLD);
        }

        if (this.small !== newState) {
          this.small = newState;
          this.icons.classList.toggle('small', this.small);
          this.icons.synchronise();
          this.stopPinch();
        } else if (Math.abs(distance) > PINCH_FEEDBACK_THRESHOLD) {
          this.scrollable.style.transform = 'scale(' +
            ((window.innerWidth + distance / 4) / window.innerWidth) + ')';
        }
        break;

      case 'touchend':
      case 'touchcancel':
        this.stopPinch();
        break;

      case 'transitionend':
        if (e.target === this.scrollable) {
          this.scrollable.removeEventListener('transitionend', this);
          document.body.classList.remove('zooming');
        }
        break;

      // Add apps installed after startup
      case 'install':
        this.addApp(e.application);
        this.storeAppOrder();
        break;

      // Remove apps uninstalled after startup
      case 'uninstall':
        for (var child of this.icons.children) {
          if (child.firstElementChild.app.manifestURL ===
              e.application.manifestURL) {
            this.icons.removeChild(child);
            this.storeAppOrder();
            break;
          }
        }
        break;
      }
    }
  };

  exports.app = new App();

}(window));
