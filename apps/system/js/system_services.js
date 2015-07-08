'use strict';
/* global LazyLoader */

(function(exports) {

  /**
   * SystemServices handles IPC between privileged applications and the system,
   * to access information handled or accessible to the system, such as
   * bookmarks.
   */
  function SystemServices() {
  }

  /**
   * Port that server will run on. 4242 = 'gaia' on a phone keypad.
   * @memberOf SystemServices
   */
  SystemServices.SERVER_PORT = 4242;

  /**
   * The maximum frequency with which requests will be serviced, in Hz.
   * @memberOf SystemServices
   */
  SystemServices.REQUEST_TIMEOUT = 500;

  /**
   * The directory to look for system services in.
   */
  SystemServices.SERVICE_PATH = 'services/';

  /**
   * The suffix for service objects
   */
  SystemServices.SERVICE_SUFFIX = 'Service';

  SystemServices.prototype.name = 'SystemServices';

  SystemServices.prototype.start = function ss_start() {
    this.requestTimeout = null;
    this.serviceHandlers = {};

    LazyLoader.load(['js/fxos-web-server.js']).then(() => {
      this.server = new HTTPServer(SystemServices.SERVER_PORT);
      this.server.addEventListener('request', this);
      this.server.start();
      console.log('System services server started');
    });
  };

  SystemServices.prototype.handleEvent = function ss_handleEvent(e) {
    switch (e.type) {
      case 'request':
        var request = e.request;
        var response = e.response;

        if (this.requestTimeout) {
          response.send(null, 429); // 429 = Too Many Requests (RFC 6585)
          break;
        }

        this.requestTimeout = setTimeout(() => { this.requestTimeout = null; },
                                         SystemServices.REQUEST_TIMEOUT);

        var serviceName = request.path.slice(1).toLowerCase();
        var servicePath = SystemServices.SERVICE_PATH + serviceName + '.js';
        LazyLoader.load(servicePath).then(
          () => {
            console.log('Handling ' + serviceName + ' request');
            this.serviceHandlers[serviceName](request, response);
          },
          (e) => {
            console.warn('Error loading system service: ' + servicePath, e);
            response.send(null, 404); // 404 = Not Found
          });
        break;
    }
  };

  SystemServices.prototype.registerHandler =
    function ss_registerHandler(name, callback) {
      console.log('Registering system service handler for ' + name);
      this.serviceHandlers[name] = callback;
    };

  exports.SystemServices = SystemServices;
}(window));
