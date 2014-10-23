'use strict';

var assert = require('assert');
var Home = require(
  '../../../../apps/verticalhome/test/marionette/lib/home2');
var Search = require(
  '../../../../apps/search/test/marionette/lib/search');
var Server = require('../../../../shared/test/integration/server');
var System = require('./lib/system');
var Rocketbar = require('./lib/rocketbar');
var Actions = require('marionette-client').Actions;

marionette('Browser - Test rocketbar collapsing behaviour',
  function() {

  var client = marionette.client({
    prefs: {
      'dom.w3c_touch_events.enabled': 1
    },
    settings: {
      'ftu.manifestURL': null,
      'lockscreen.enabled': false
    }
  });

  var home, rocketbar, search, server, system, actions;

  suiteSetup(function(done) {
    Server.create(__dirname + '/fixtures/', function(err, _server) {
      server = _server;
      done();
    });
  });

  suiteTeardown(function() {
    server.stop();
  });

  setup(function() {
    home = new Home(client);
    rocketbar = new Rocketbar(client);
    search = new Search(client);
    system = new System(client);
    actions = new Actions(client);

    system.waitForStartup();
    search.removeGeolocationPermission();
  });

  test('doesn\'t collapse on non-scrollable page', function() {
    var url = server.url('non-scrollable.html');

    // Open the URL in a sheet.
    rocketbar.homescreenFocus();
    rocketbar.enterText(url + '\uE006');

    // Get the size of the rocketbar
    var heightBefore =
      client.findElement(rocketbar.selectors.rocketbar).size().height;
    assert.ok(heightBefore > 0);

    // Switch to the app, try to scroll and re-measure the rocketbar
    rocketbar.switchToBrowserFrame(url)

    var body = client.helper.waitForElement('body');
    actions.flick(body, 0, 100, 0, 0, 300).perform();

    client.switchToFrame();
    var heightAfter =
      client.findElement(rocketbar.selectors.rocketbar).size().height;
    assert.equal(heightBefore, heightAfter);
  });

  test('collapses on scrollable page', function() {
    var url = server.url('scrollable.html');

    // Open the URL in a sheet.
    rocketbar.homescreenFocus();
    rocketbar.enterText(url + '\uE006');

    // Get the size of the rocketbar
    var rocketbarElement = client.findElement(rocketbar.selectors.rocketbar);
    var heightBefore = rocketbarElement.size().height;
    assert.ok(heightBefore > 0);

    // Switch to the app, try to scroll and re-measure the rocketbar
    rocketbar.switchToBrowserFrame(url)

    var body = client.helper.waitForElement('body');
    actions.flick(body, 0, 100, 0, 0, 300).perform();

    client.switchToFrame();
    var heightAfter =
      client.findElement(rocketbar.selectors.rocketbar).size().height;
    assert.ok(heightBefore > heightAfter);
  });
});
