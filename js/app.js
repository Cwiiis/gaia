'use strict';

const INITIAL_LOAD_STAGGER = 100;
const PINCH_DISTANCE_THRESHOLD = 50;

(function(exports) {

  function App() {
    this.shadow = document.getElementById('shadow');
    this.scrollable = document.getElementById('scrollable');
    this.icons = document.getElementById('apps');

    // Display the top shadow when scrolling down
    var scrolled = false;
    this.scrollable.addEventListener('scroll', () => {
      if (scrolled !== this.scrollable.scrollTop > 0) {
        scrolled = !scrolled;
        this.shadow.classList.toggle('visible', scrolled);
      }
    });

    // Disable overflow when dragging to stop apzc hijacking the events.
    this.icons.addEventListener('drag-start', () => {
      this.scrollable.classList.add('dragging');
    });
    this.icons.addEventListener('drag-finish', () => {
      this.scrollable.classList.remove('dragging');
    });

    // Enable app-launching
    this.icons.addEventListener('activate', (e) => {
      e.detail.target.firstElementChild.launch();
    });

    // Enable pinch to change layout
    var small = false;
    var startDistance = 0;
    var startSmall = false;
    var pinchListening = false;
    this.icons.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        startSmall = small;
        startDistance =
          Math.sqrt(Math.pow(e.touches[0].clientX - e.touches[1].clientX, 2) +
                    Math.pow(e.touches[0].clientY - e.touches[1].clientY, 2));
        pinchListening = true;
      } else {
        pinchListening = false;
      }
    });
    this.icons.addEventListener('touchmove', (e) => {
      if (!pinchListening || e.touches.length !== 2) {
        return;
      }

      var distance =
        (Math.sqrt(Math.pow(e.touches[0].clientX - e.touches[1].clientX, 2) +
                   Math.pow(e.touches[0].clientY - e.touches[1].clientY, 2))) -
        startDistance;

      var newState;
      if (startSmall) {
        newState = (distance > PINCH_DISTANCE_THRESHOLD);
      } else {
        newState = (distance < -PINCH_DISTANCE_THRESHOLD);
      }

      if (small !== newState) {
        small = newState;
        this.icons.classList.toggle('small', small);
        this.icons.synchronise();
        pinchListening = false;
      }
    });

    // Populate apps
    var request = navigator.mozApps.mgmt.getAll();
    var nApps = 0;
    request.onsuccess = (e) => {
      console.log(request.result);
      for (var app of request.result) {
        var manifest = app.manifest;
        if (!manifest) {
          continue;
        }

        if (manifest.role && manifest.role !== 'search') {
          console.log('Skipping app with role \'' + manifest.role + '\'');
          continue;
        }

        window.setTimeout(function loadApp(app) {
          if (app.manifest.entry_points) {
            for (var entryPoint in app.manifest.entry_points) {
              this.addAppIcon(app, entryPoint);
            }
          } else {
            this.addAppIcon(app);
          }
        }.bind(this, app), INITIAL_LOAD_STAGGER * nApps++);
      }
    };
    request.onerror = (e) => {
      console.error("Error calling getAll: " + request.error.name);
    };
  }

  App.prototype = {
    addAppIcon: function(app, entryPoint) {
      var container = document.createElement('div');
      container.classList.add('icon-container');
      this.icons.appendChild(container);

      var icon = document.createElement('gaia-app-icon');
      container.appendChild(icon);
      icon.entryPoint = entryPoint;
      icon.app = app;
    }
  };

  exports.app = new App();

}(window));
