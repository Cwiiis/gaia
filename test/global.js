'use strict';

var dom = document.createElement('div');
dom.innerHTML = `
    <div id="shadow"></div>
    <div id="scrollable">
      <gaia-container id="apps" drag-and-drop></gaia-container>
    </div>
    <div id="uninstall"></div>
  `;
document.body.appendChild(dom);

// Mock
navigator.mozApps = {};
navigator.mozApps.mgmt = {
  addEventListener: () => {},
  getAll: () => {},
  uninstall: () => {}
};
