'use strict';

/**
 * The time to wait between successive app icon additions.
 */
const APP_LOAD_STAGGER = 0;//100;

/**
 * The distance a pinch gesture has to move before being considered for a
 * column-layout change.
 */
const PINCH_DISTANCE_THRESHOLD = 150;

/**
 * The minimum distance a pinch gesture has to move before being reflected
 * visually.
 */
const PINCH_FEEDBACK_THRESHOLD = 5;

/**
 * Bias to apply in the direction of a swipe when flinging the apps list.
 * 0 means no bias, and the nearest page will be snapped to. 0.5 would mean
 * it would always snap to the next page in the direction of the swipe, no
 * matter how small.
 */
const PAGE_SWIPE_BIAS = 0.45;

/**
 * Timeout after a scroll event to initiate scroll-snapping. This is mostly
 * to work around bug 1172541.
 */
const SCROLL_SNAP_TIMEOUT = 150;

/**
 * Time to leave for smooth scrolling to finish before un-forcing auto overflow.
 */
const SMOOTH_SCROLL_TIME = 500;

/**
 * Timeout before resizing the apps grid after apps change.
 */
const RESIZE_TIMEOUT = 500;

/**
 * The distance at the top and bottom of the icon container that when hovering
 * an icon in will cause scrolling.
 */
const AUTOSCROLL_DISTANCE = 45;

/**
 * The timeout before auto-scrolling a page when hovering at the edges
 * of the grid.
 */
const AUTOSCROLL_DELAY = 750;

/**
 * The height of the delete-app bar at the bottom of the container when
 * dragging a deletable app.
 */
const DELETE_DISTANCE = 60;

/**
 * App roles that will be skipped on the homescreen.
 */
const HIDDEN_ROLES = [
  'system', 'input', 'homescreen', 'theme', 'addon', 'langpack'
];

/**
 * Stored settings version, for use when changing/refactoring settings storage.
 */
const SETTINGS_VERSION = 0;

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
    this.scrollSnap = { shouldSnap: false,
                        position: 0,
                        downwards: true,
                        touching: false,
                        timeout: null };

    // Pinch-to-zoom
    this.small = false;
    this.wasSmall = false;
    this.pinchListening = false;

    // Drag-and-drop
    this.draggingRemovable = false;
    this.autoScrollTimeout = null;

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

    // Restore settings
    this.restoreSettings();

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
            this.metadata.remove(data.id).then(
              () => {},
              (e) => {
                console.error('Error removing unknown app metadata entry', e);
              });
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
    saveSettings: function() {
      localStorage.setItem('settings', JSON.stringify({
        version: SETTINGS_VERSION,
        small: this.small
      }));
    },

    restoreSettings: function() {
      var settingsString = localStorage.getItem('settings');
      if (!settingsString) {
        return;
      }

      var settings = JSON.parse(settingsString);
      if (settings.version !== SETTINGS_VERSION) {
        return;
      }

      this.small = settings.small;
      this.icons.classList.toggle('small', this.small);
    },

    addApp: function(app, callback) {
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

      window.setTimeout(function loadApp(app, callback) {
        var manifest = app.manifest || app.updateManifest;
        if (manifest.entry_points) {
          for (var entryPoint in manifest.entry_points) {
            this.addAppIcon(app, entryPoint);
          }
        } else {
          this.addAppIcon(app);
        }

        if (callback) {
          callback();
        }
      }.bind(this, app, callback), targetDelay);
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
      if (entryPoint) {
        icon.entryPoint = entryPoint;
      }
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
      this.handleEvent({ type: 'scroll' });
    },

    snapScrollPosition: function(bias) {
      var children = this.icons.children;
      if (children.length < 1) {
        return;
      }

      var iconHeight = Math.round(children[0].getBoundingClientRect().height);
      var scrollHeight = this.scrollable.clientHeight;
      var pageHeight = Math.floor(scrollHeight / iconHeight) * iconHeight;
      var gridHeight = (Math.ceil((iconHeight *
        Math.ceil(children.length / (this.small ? 4 : 3))) / pageHeight) *
        pageHeight) + (scrollHeight - pageHeight);

      // Make sure the grid is a multiple of the page size. Done in a timeout
      // in case the grid shrinks
      setTimeout(() => {
        this.icons.style.height = gridHeight + 'px';
      }, RESIZE_TIMEOUT);

      var currentScroll = this.scrollable.scrollTop;
      var destination = Math.min(gridHeight - scrollHeight,
        Math.round(currentScroll / pageHeight + bias) * pageHeight);
      if (Math.abs(destination - currentScroll) > 1) {
        this.scrollable.style.overflow = 'auto';
        this.scrollable.scrollTo(
          { left: 0, top: destination, behavior: 'smooth' });
        setTimeout(() => {
          this.scrollable.style.overflow = '';
        }, SMOOTH_SCROLL_TIME);
      }
    },

    handleEvent: function(e) {
      switch (e.type) {
      // Display the top shadow when scrolling down
      case 'scroll':
        var position = this.scrollable.scrollTop;
        var scrolled = position > 0;
        if (this.scrolled !== scrolled) {
          this.scrolled = scrolled;
          this.shadow.classList.toggle('visible', scrolled);
        }

        if (this.scrollSnap.position !== position) {
          this.scrollSnap.downwards = position > this.scrollSnap.position;
          this.scrollSnap.position = position;
        }

        if (this.scrollSnap.timeout) {
          clearTimeout(this.scrollSnap.timeout);
          this.scrollSnap.timeout = null;
        }

        if (this.scrollSnap.shouldSnap) {
          this.scrollSnap.shouldSnap = false;
          this.snapScrollPosition(this.scrollSnap.downwards ?
            PAGE_SWIPE_BIAS : -PAGE_SWIPE_BIAS);
        } else if (!this.scrollSnap.touching) {
          this.scrollSnap.timeout = setTimeout(() => {
            this.scrollSnap.timeout = null;
            this.snapScrollPosition(0);
          }, SCROLL_SNAP_TIMEOUT);
        }
        break;

      // App launching
      case 'activate':
        e.detail.target.firstElementChild.launch();
        break;

      // Disable scrolling during dragging, and display app-uninstall bar
      case 'drag-start':
        document.body.classList.add('dragging');
        this.draggingRemovable =
          e.detail.target.firstElementChild.app.removable;
        if (this.draggingRemovable) {
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

        if (this.draggingRemovable &&
            e.detail.clientY > window.innerHeight - DELETE_DISTANCE) {
          inDelete = true;
        } else if (e.detail.clientY >
                   window.innerHeight - DELETE_DISTANCE - AUTOSCROLL_DISTANCE) {
          inAutoscroll = true;
          if (this.autoScrollTimeout === null) {
            this.autoScrollTimeout = setTimeout(() => {
              this.autoScrollTimeout = null;
              this.snapScrollPosition(1);
            }, AUTOSCROLL_DELAY);
          }
        } else if (e.detail.clientY < AUTOSCROLL_DISTANCE) {
          inAutoscroll = true;
          if (this.autoScrollTimeout === null) {
            this.autoScrollTimeout = setTimeout(() => {
              this.autoScrollTimeout = null;
              this.snapScrollPosition(-1);
            }, AUTOSCROLL_DELAY);
          }
        }

        if (!inAutoscroll && this.autoScrollTimeout !== null) {
          clearTimeout(this.autoScrollTimeout);
          this.autoScrollTimeout = null;
        }

        this.uninstall.classList.toggle('active', inDelete);
        break;

      // Pinch-to-zoom
      case 'touchstart':
        this.scrollSnap.touching = true;
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

        if (!this.scrolled && distance > 0) {
          this.scrolled = true;
          this.shadow.classList.add('visible');
        }

        if (this.small !== newState) {
          this.small = newState;
          this.icons.style.height = '';
          this.icons.classList.toggle('small', this.small);
          this.icons.synchronise();
          this.stopPinch();
          this.saveSettings();
        } else if (Math.abs(distance) > PINCH_FEEDBACK_THRESHOLD) {
          this.scrollable.style.transform = 'scale(' +
            ((window.innerWidth + distance / 4) / window.innerWidth) + ')';
        }
        break;

      case 'touchend':
      case 'touchcancel':
        if (!e.touches || e.touches.length === 0) {
          this.scrollSnap.touching = false;
          this.scrollSnap.shouldSnap = true;
          this.handleEvent({ type: 'scroll' });
        }

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
        this.addApp(e.application, this.storeAppOrder);
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
        this.handleEvent({ type: 'scroll' });
        break;
      }
    }
  };

  exports.app = new App();

}(window));
