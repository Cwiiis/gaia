'use strict';

(function(exports) {

  function App() {
    this.icons = document.getElementById('apps');
    this.appearance = 'transparent';

    // Turn the statusbar opaque when scrolling down
    window.addEventListener('scroll', () => {
      var colour = (window.scrollY > 0) ? 'grey' : 'transparent';

      if (this.appearance === colour) {
        return;
      }

      this.appearance = colour;
      var meta = document.head.querySelector('meta[name="theme-color"]');
      meta.content = colour;
    });

    // Disable overflow when dragging to stop apzc hijacking the events.
    this.icons.addEventListener('drag-start', () => {
      document.body.classList.add('dragging');
    });
    this.icons.addEventListener('drag-finish', () => {
      document.body.classList.remove('dragging');
    });

    // Enable app-launching
    this.icons.addEventListener('activate', (e) => {
      e.detail.target.launch();
    });

    // Populate apps
    var request = navigator.mozApps.mgmt.getAll();
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

        if (app.manifest.entry_points) {
          for (var entryPoint in app.manifest.entry_points) {
            var icon = new GaiaAppIcon();
            this.icons.appendChild(icon);
            icon.entryPoint = entryPoint;
            icon.app = app;
          }
        } else {
          var icon = new GaiaAppIcon();
          this.icons.appendChild(icon);
          icon.app = app;
        }
      }
    };
    request.onerror = (e) => {
      console.error("Error calling getAll: " + request.error.name);
    };
  }

  App.prototype = {
  };

  exports.app = new App();

}(window));
