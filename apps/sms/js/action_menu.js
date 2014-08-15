'use strict';

/*
 Generic action menu. Options should have the following structure:


  new OptionMenu(options);

  options {

    items: An array of menu options to render
    eg.
    [
      {
        name: 'Lorem ipsum',
        l10nId: 'lorem',
        l10nArgs: 'ipsum',
        method: function optionMethod(param1, param2) {
          // Method and params if needed
        },
        params: ['param1', '123123123']
      },
      ....
      ,


      Last option has a different UI compared with the previous one.
      This is because it's recommended to use as a 'Cancel' option
      {
        name: 'Cancel',
        l10nId: 'Cancel'
        method: function optionMethod(param) {
          // Method and param if needed
        },
        params: ['Optional params'],

        // Optional boolean flag to tell the
        // menu option handlers that this option
        // will not execute the "complete" callback.
        // Defaults to "false"

        incomplete: false [true]
      }
    ],

    // Optional header text or node
    header: ...,

    // additional classes on the dialog, as an array of strings
    classes: ...

    // Optional section text or node
    section: ...

    // Optional data-type: confirm or action
    type: 'confirm'

    // Optional callback to be invoked when a
    // button in the menu is pressed. Can be
    // overridden by an "incomplete: true" set
    // on the menu item in the items array.
    complete: function() {...}
  }
*/


var OptionMenu = function(options) {
  if (!options || !options.items || options.items.length === 0) {
    return;
  }
  // Create a private, weakly held entry for
  // this instances DOM object references
  // More info:
  // https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/WeakMap
  var handlers = new WeakMap();
  // Retrieve items to be rendered
  var items = options.items;
  // Create the structure
  this.menu = document.createElement('gaia-overflow-menu');

  var classList = this.menu.classList;

  if (options.classes) {
    classList.add.apply(classList, options.classes);
  }

  // We append title if needed
  if (options.header) {
    // TODO
  }

  if (options.section) {
    // TODO
  }

  // For each option, we append the option and listener
  items.forEach(function renderOption(item) {
    var option = document.createElement('gaia-overflow-menu-option');
    if (item.l10nId) {
      navigator.mozL10n.localize(option, item.l10nId, item.l10nArgs);
    } else if (item.name && item.name.length) {
      option.textContent = item.name || '';
    } else {
      // no l10n or name, just empty item, don't add to the menu
      return;
    }
    this.menu.appendChild(option);

    // Add a mapping from the option object
    // directly to its options item.
    item.incomplete = item.incomplete || false;

    handlers.set(option, item);
  }.bind(this));

  this.menu.addEventListener('click', function(event) {
    var action = handlers.get(event.target);
    var method;

    // TODO: Custom cancel?
    // Delegate operation to target method. This allows
    // for a custom "Cancel" to be provided by calling program.
    //
    // Further operations should only be processed if
    // an actual option was pressed.
    if (typeof action !== 'undefined') {
      method = action.method || function() {};

      method.apply(null, action.params || []);

      // Hide action menu when click is received
      this.hide();

      if (typeof options.complete === 'function' && !action.incomplete) {
        options.complete();
      }
    }
  }.bind(this));

  // Destroy on hide
  this.menu.addEventListener('transitionend', function() {
    if (this.menu.classList.contains('hidden')) {
      document.body.removeChild(this.menu);
    }
  }.bind(this));
};

// We prototype functions to show/hide the UI of action-menu
OptionMenu.prototype.show = function() {
  // We translate and append the element to body
  navigator.mozL10n.translate(this.menu);
  document.body.appendChild(this.menu);
  this.menu.show();
  // Focus menu to blur anything triggered keyboard
  this.menu.focus();
};

OptionMenu.prototype.hide = function() {
  this.menu.hide();
};
