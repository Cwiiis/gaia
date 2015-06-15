# homescreen-ng

homescreen-ng is a prototype homescreen replacement for FirefoxOS, that leverages web components to help improve reusability and enforce code separation. Performance, UX and maintainability are its top priorities.

## Requirements

homescreen-ng requires a version of FirefoxOS >= 2.3, and that web components are enabled. This can be done by enabling the device preference `dom.webcomponents.enabled`.

## Installing and running

First, make sure submodules are updated by running:

```
git submodule init
git submodule update
```

homescreen-ng can now be installed with the WebIDE in Firefox. Open the directory as a project in WebIDE, and choose 'Install and Run' from the project menu or toolbar.

Alternatively, copy or link the checkout directory into a directory named 'outoftree_apps' in a gaia checkout and run `make install-gaia APP=homescreen-ng` from the top directory of said gaia checkout.

homescreen-ng can be made the default homescreen by entering the Settings app, choosing 'Homescreens' and switching to 'New Home Screen'.

## Usage

Apps are presented in a vertical, paged list which can be scrolled through by swiping. App column arrangement can be altered by using a two-finger pinch gesture.

Apps can be rearranged by long-pressing on an app icon, then without removing that finger, dragging it to where that icon should be. Dragging near the top or bottom edges of the screen will switch to the previous or next pages respectively.

Uninstalling an app can be achieved by long-pressing an app icon and dragging it over the uninstall tray that appears at the bottom of the screen. System apps cannot be uninstalled.
