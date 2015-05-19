'use strict';

const APP_LOAD_STAGGER = 100;
const PINCH_DISTANCE_THRESHOLD = 50;
const HIDDEN_ROLES = [
  'system', 'input', 'homescreen', 'theme', 'addon', 'langpack'
];

(function(exports) {

  function App() {
    // Element references
    this.shadow = document.getElementById('shadow');
    this.scrollable = document.getElementById('scrollable');
    this.icons = document.getElementById('apps');

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
    this.icons.addEventListener('drag-finish', this);
    this.icons.addEventListener('touchstart', this);
    this.icons.addEventListener('touchmove', this);
    navigator.mozApps.mgmt.addEventListener('install', this);
    navigator.mozApps.mgmt.addEventListener('uninstall', this);

    // Populate apps
    var request = navigator.mozApps.mgmt.getAll();
    request.onsuccess = (e) => {
      for (var app of request.result) {
        this.addApp(app);
      }
    };
    request.onerror = (e) => {
      console.error("Error calling getAll: " + request.error.name);
    };
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
      var container = document.createElement('div');
      container.classList.add('icon-container');
      this.icons.appendChild(container);

      var icon = document.createElement('gaia-app-icon');
      container.appendChild(icon);
      icon.entryPoint = entryPoint;
      icon.app = app;
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

      // Disable scrolling during dragging
      case 'drag-start':
        this.scrollable.classList.add('dragging');
        break;

      case 'drag-finish':
        this.scrollable.classList.remove('dragging');
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
        } else {
          this.pinchListening = false;
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
          newState = (distance > PINCH_DISTANCE_THRESHOLD);
        } else {
          newState = (distance < -PINCH_DISTANCE_THRESHOLD);
        }

        if (this.small !== newState) {
          this.small = newState;
          this.icons.classList.toggle('small', this.small);
          this.icons.synchronise();
          this.pinchListening = false;
        }
        break;

      // Add apps installed after startup
      case 'install':
        this.addApp(e.application);
        break;

      // Remove apps uninstalled after startup
      case 'uninstall':
        for (var child of this.icons.children) {
          if (child.firstElementChild.app.manifestURL ===
              e.application.manifestURL) {
            this.icons.removeChild(child);
            break;
          }
        }
        break;
      }
    }
  };

  exports.app = new App();

}(window));
