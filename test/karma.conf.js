// Karma configuration
'use strict';

module.exports = function(config) {
  config.set({
    frameworks: ['mocha', 'sinon-chai'],
    client: {
      captureConsole: true,
      mocha: {'ui': 'tdd'}
    },

    basePath: '../',
    files: [
      'test/global.js',

      'js/metadata.js',
      'js/bookmarks.js',
      'js/app.js',

      'test/app_test.js'
    ],

    browsers: ['FirefoxLatest'],
    customLaunchers: {
      FirefoxLatest: {
        base: 'FirefoxNightly',
        prefs: {'dom.webcomponents.enabled': true}
      }
    }
  })
};
