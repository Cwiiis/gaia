'use strict';
/* global GaiaGrid */

(function(exports) {

  const COLLAPSE_RATIO = 0.75;

  /**
   * Maximum number of icons that can be put in a group. 12 as it's the
   * lowest common multiple of 3 and 4 (the only valid column sizes).
   */
  const MAX_GROUP_SIZE = 12;

  /**
   * Represents a grouping of items in the home-screen. This item is just
   * used to render the group container, grouping information is determined
   * by item placing between a Group and a GroupEnd item.
   */
  function Group(detail) {
    this.detail = detail || {};
    this.detail.type = 'group';
    this.detail.index = 0;
    this.detail.collapsed = !!this.detail.collapsed;
  }

  Group.prototype = {

    __proto__: GaiaGrid.GridItem.prototype,

    get topHeight() {
      return this.topSpanElement ?
        this.topSpanElement.clientHeight + this.topSpanElement.offsetTop : 0;
    },

    get pixelHeight() {
      if (!this.detail.collapsed) {
        // We only return the size of the top part of the group, as we rely on
        // GridView's normal icon rendering to render our contents when
        // expanded.
        return this.topHeight;
      }

      // When collapsed, we render ourselves and the items themselves are
      // skipped, so we return our full size (minus the bottom span, which
      // will be spaced by the GroupEnd item).
      return this.topHeight + this.middleHeight;
    },

    /**
     * Returns the number of items in  the group. Relies on the item  index
     * being correct.
     */
    get size() {
      var size;
      for (var i = this.detail.index + 1, size = 0;
           i < this.grid.items.length &&
           this.grid.items[i].detail.type !== 'groupend'; i++) {
        var item = this.grid.items[i];
        if (item.detail.type !== 'placeholder') {
          size++;
        }
      }
      return size;
    },

    /**
     * Returns the maximum number of items this group can hold.
     */
    get maxSize() {
      return MAX_GROUP_SIZE;
    },

    gridWidth: 4,

    middleHeight: 1,

    firstRenderAfterToggle: true,

    render: function(coordinates, forceRender) {
      // Generate the content if we need to
      var createdElements = false;
      if (!this.element) {
        createdElements = true;
        var group = this.element = document.createElement('div');
        group.className = 'group';

        var span = document.createElement('span');
        group.appendChild(span);
        span.className = 'top';
        span.appendChild(document.createTextNode('• • • •')); // XXX Need asset
        this.topSpanElement = span;

        span = document.createElement('span');
        group.appendChild(span);
        span.className = 'middle';
        span.style.height = '1px';
        this.middleSpanElement = span;

        span = document.createElement('span');
        group.appendChild(span);
        span.className = 'bottom';
        span.appendChild(document.createTextNode('^')); // XXX Need asset
        this.bottomSpanElement = span;

        this.grid.element.appendChild(group);
        this.element.style.opacity = 0;
      }

      if (!forceRender) {
        this.y = coordinates[1];
        if (this.noTransform) {
          return;
        }
      }

      var index = this.detail.index;
      var y = coordinates[1];
      this.element.style.transform = 'translate(0px, ' + y + 'px)';

      if (createdElements) {
        // Force a reflow on the group so the initial fade animation plays.
        this.element.clientTop;
        this.element.style.opacity = 1;
      }

      // Set size of our middle span element.
      var nApps = this.size;

      // No need to worry about grid-width of items here, you can't have
      // nested groups or dividers within groups.
      var height = Math.ceil(nApps / this.grid.layout.cols);

      // If we're collapsed, we'll render all the icons on one row
      if (this.detail.collapsed) {
        height = COLLAPSE_RATIO;
        console.log(nApps + ' apps in collapsed group');
      }

      // Calculate the height of 1.4rem, which is the text-height for an icon
      // caption.
      var iconHeight =
        parseInt(getComputedStyle(document.documentElement).fontSize) * 1.4;

      // Now calculate the height of the middle span
      this.middleHeight =
        ((height || 1) * this.grid.layout.gridItemHeight) - iconHeight;
      this.middleSpanElement.style.height = this.middleHeight + 'px';

      // If there are no apps in the group, there's nothing left to do
      if (nApps === 0) {
        return;
      }

      // If collapsed, we need to style and position the icons in the group
      // into one row. If not collapsed, we need to remove the 'collapsed'
      // style class.
      y += this.topHeight;
      var width =
        ((this.grid.layout.gridItemWidth * this.grid.layout.cols)
         - (this.grid.layout.gridItemWidth * COLLAPSE_RATIO)) / (nApps - 0.5);
      var x = width / 4;
      var endItem = this.grid.items[index + nApps];
      for (var i = index + 1; i <= index + nApps; i++) {
        var item = this.grid.items[i];
        if (this.detail.collapsed) {
          item.scale = COLLAPSE_RATIO;

          // Render the item to force element creation if necessary (this
          // happens if the home-screen is loaded with a collapsed group)
          var itemElementCreated = false;
          if (!item.element) {
            item.render([x, y], true);
            itemElementCreated = true;
          }

          if (this.firstRenderAfterToggle && item.element) {
            console.log('Collapsing item', item);
            item.element.classList.add('collapsed');

            if (i < index + nApps) {
              // Rearrange the item to make sure it overlaps correctly with the
              // other items in the group.
              var parent = item.element.parentNode;
              parent.removeChild(item.element);
              parent.insertBefore(item.element, endItem.element);

              if (!itemElementCreated) {
                // Reinserting the node will coalesce with the transform
                // setting below, so force a relayout.
                // See Bug 625289.
                item.element.clientTop;
              }
            }
          }

          if (!itemElementCreated) {
            item.render([x, y], true);
          }
          x += width;
        } else {
          if (this.firstRenderAfterToggle) {
            item.scale = 1;
            if (item.element) {
              item.element.classList.remove('collapsed');
            }
          }
        }
      }
      this.firstRenderAfterToggle = false;
    },

    setActive: function(active) {
      GaiaGrid.GridItem.prototype.setActive.call(this, active);

      // Mark our child items as active/inactive with us so they pick up the
      // right style when dragged.
      var nApps = this.size;
      var index = this.detail.index;
      for (var i = index + 1; i <= index + nApps; i++) {
        var item = this.grid.items[i];
        if (active) {
          item.element.classList.add('active');
        } else {
          item.element.classList.remove('active');
        }
      }
    },

    collapse: function() {
      if (!this.detail.collapsed) {
        console.log('Collapse group');
        this.detail.collapsed = true;
        this.element.classList.add('collapsed');

        this.grid.element.classList.add('collapsing');
        exports.requestAnimationFrame(function() {
          this.firstRenderAfterToggle = true;
          this.grid.render();
          this.grid.element.classList.remove('collapsing');
        }.bind(this));

        var dragging = this.grid.dragdrop && this.grid.dragdrop.inDragAction;
        if (!dragging) {
          window.dispatchEvent(new CustomEvent('gaiagrid-saveitems'));
        }
      }
    },

    expand: function() {
      if (this.detail.collapsed) {
        console.log('Uncollapse group');
        this.detail.collapsed = false;
        this.element.classList.remove('collapsed');

        this.grid.element.classList.add('expanding');
        exports.requestAnimationFrame(function() {
          this.firstRenderAfterToggle = true;
          this.grid.render();
          this.grid.element.classList.remove('expanding');
        }.bind(this));

        var dragging = this.grid.dragdrop && this.grid.dragdrop.inDragAction;
        if (!dragging) {
          window.dispatchEvent(new CustomEvent('gaiagrid-saveitems'));
        }
      }
    },

    toggle: function() {
      if (this.detail.collapsed) {
        this.expand();
      } else {
        this.collapse();
      }
    },

    launch: function() {
      console.log('Launch this group');
      if (this.detail.collapsed) {
        this.expand();
      }
    },

    remove: function() {
      if (this.element) {
        this.element.parentNode.removeChild(this.element);
      }
    },

    isDraggable: function() {
      return this.detail.collapsed;
    }
  };

  /**
   * An invisible item used to add space to the bottom of a group, and to
   * provide a drop-target for adding new items to a full group.
   */
  function GroupEnd() {
    this.detail = {
      type: 'groupend',
      index: 0
    };
  }

  GroupEnd.prototype = {

    __proto__: GaiaGrid.GridItem.prototype,

    get pixelHeight() {
      if (!this.group.element) {
        return 0;
      }

      // Bottom span is 2.0rem (1.5rem border + 1rem margin)
      var bottomHeight =
        parseInt(getComputedStyle(document.documentElement).fontSize) * 2.5;

      return bottomHeight;
    },

    gridWidth: 4,

    scale: 1,

    /**
     * Renders the icon to the grid component.
     * @param {Object} coordinates Grid coordinates to render to.
     */
    render: function(coordinates) {
      // Find our associated group if we haven't set it already
      if (!this.group)  {
        for (var i = this.detail.index; i >= 0; i--) {
          var item = this.grid.items[i];
          if (item.detail.type === 'group') {
            this.group = item;
            break;
          }
        }
      }

      // Generate an element if we need to
      if (!this.element) {
        var groupEnd = document.createElement('div');
        groupEnd.className = 'group-end';
        this.element = groupEnd;
        this.grid.element.appendChild(groupEnd);
      }

      this.x = coordinates[0];
      this.y = coordinates[1];

      // Offset by the pixel-height to make this easier to press
      this.transform(this.x, this.y - this.pixelHeight,
                     this.grid.layout.percent);
    },

    launch: function() {
      this.group.toggle();
    },

    remove: function() {
      if (this.element) {
        this.element.parentNode.removeChild(this.element);
      }
    },

    isDraggable: function() {
      return false;
    }
  };

  /**
   * An item used to create a new group
   */
  function NewGroup() {
    this.detail = {
      type: 'newgroup',
      name: 'Tap to create a new group',
      index: 0
    };
  }

  NewGroup.prototype = {

    __proto__: GaiaGrid.GridItem.prototype,

    gridWidth: 4,

    persistToDB: false,

    get pixelHeight() {
      return this.grid.layout.gridItemHeight;
    },

    get name() {
      return this.detail.name;
    },

    get icon() {
      return this.defaultIcon;  // XXX Need asset
    },

    isDraggable: function() {
      return false;
    },

    render: function(coordinates, forceRender) {
      GaiaGrid.GridItem.prototype.render.call(this, coordinates, forceRender);
      this.element.classList.add('new-group');
    },

    launch: function() {
      // Insert a new group and group-end 2 positions before us (before the
      // last divider)
      var group = new GaiaGrid.Group();
      var groupEnd = new GaiaGrid.GroupEnd();
      this.grid.items.splice(this.detail.index - 1, 0, groupEnd);
      this.grid.items.splice(this.detail.index - 1, 0, group);
      this.grid.render();
    },

    remove: function() {
      if (this.element) {
        this.element.parentNode.removeChild(this.element);
      }
    }
  };

  exports.GaiaGrid.Group = Group;
  exports.GaiaGrid.GroupEnd = GroupEnd;
  exports.GaiaGrid.NewGroup = NewGroup;

}(window));
