/* global sinon, assert, suite, setup, teardown, test, app */
'use strict';

suite('Homescreen app', function() {
  setup(function() {
    this.sinon = sinon.sandbox.create();
  });

  teardown(function() {
    this.sinon.restore();
  });

  test('saveSettings() should persist data', function() {
    app.small = true;
    app.saveSettings();
    app.small = false;
    app.restoreSettings();
    assert.equal(app.small, true);
  });
});
