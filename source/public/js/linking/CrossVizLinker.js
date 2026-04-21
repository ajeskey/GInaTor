/**
 * CrossVizLinker — pub/sub system for cross-visualization linking.
 * Synchronizes selections across all active visualization components.
 * Click author in heatmap → highlight in collaboration network + filter pulse.
 * Click file in treemap → highlight in sunburst + bubble map.
 * Requirements: 34.1–34.7
 */
(function () {
  'use strict';

  var activeFilters = {
    author: null,
    file: null
  };

  var registeredVizzes = {};

  /**
   * Register a visualization instance for cross-viz linking.
   * @param {string} name - unique viz name (e.g. 'heatmap', 'collaboration')
   * @param {object} vizInstance - must implement highlight(sel) and clearHighlight()
   */
  function register(name, vizInstance) {
    registeredVizzes[name] = vizInstance;
  }

  /**
   * Unregister a visualization.
   * @param {string} name
   */
  function unregister(name) {
    delete registeredVizzes[name];
  }

  /**
   * Select an author — broadcast highlight to all registered vizzes.
   * @param {string} author
   * @param {string} [sourceViz] - name of the originating viz (won't re-highlight itself)
   */
  function selectAuthor(author, sourceViz) {
    activeFilters.author = author;
    activeFilters.file = null;
    _broadcast({ author: author }, sourceViz);
    _updateIndicator();
    window.dispatchEvent(new CustomEvent('crossviz:author-selected', { detail: { author: author } }));
  }

  /**
   * Select a file — broadcast highlight to all registered vizzes.
   * @param {string} filePath
   * @param {string} [sourceViz] - name of the originating viz
   */
  function selectFile(filePath, sourceViz) {
    activeFilters.file = filePath;
    activeFilters.author = null;
    _broadcast({ file: filePath }, sourceViz);
    _updateIndicator();
    window.dispatchEvent(new CustomEvent('crossviz:file-selected', { detail: { file: filePath } }));
  }

  /**
   * Clear all cross-viz filters and highlights.
   */
  function clearAll() {
    activeFilters.author = null;
    activeFilters.file = null;
    Object.keys(registeredVizzes).forEach(function (name) {
      var viz = registeredVizzes[name];
      if (viz && typeof viz.clearHighlight === 'function') {
        viz.clearHighlight();
      }
    });
    _updateIndicator();
    window.dispatchEvent(new CustomEvent('crossviz:cleared'));
  }

  /**
   * Get current active filters.
   * @returns {{ author: string|null, file: string|null }}
   */
  function getFilters() {
    return { author: activeFilters.author, file: activeFilters.file };
  }

  /**
   * Check if any cross-viz filter is active.
   * @returns {boolean}
   */
  function hasActiveFilter() {
    return activeFilters.author !== null || activeFilters.file !== null;
  }

  /**
   * Broadcast a selection to all registered vizzes.
   * @param {object} selection
   * @param {string} [sourceViz]
   * @private
   */
  function _broadcast(selection, sourceViz) {
    Object.keys(registeredVizzes).forEach(function (name) {
      if (name === sourceViz) return;
      var viz = registeredVizzes[name];
      if (viz && typeof viz.highlight === 'function') {
        viz.highlight(selection);
      }
    });
  }

  /**
   * Update the filter indicator UI element.
   * @private
   */
  function _updateIndicator() {
    var indicator = document.getElementById('crossviz-indicator');
    if (!indicator) return;

    if (hasActiveFilter()) {
      var label = activeFilters.author
        ? 'Author: ' + activeFilters.author
        : 'File: ' + activeFilters.file;
      indicator.innerHTML = '<span class="badge badge-info badge-sm mr-2">' + _escapeHtml(label) + '</span>' +
        '<button id="crossviz-clear-btn" class="btn btn-ghost btn-xs">Clear All Filters</button>';
      indicator.classList.remove('hidden');
      var clearBtn = document.getElementById('crossviz-clear-btn');
      if (clearBtn) {
        clearBtn.addEventListener('click', function () { clearAll(); });
      }
    } else {
      indicator.innerHTML = '';
      indicator.classList.add('hidden');
    }
  }

  /**
   * Escape HTML for safe insertion.
   * @param {string} str
   * @returns {string}
   * @private
   */
  function _escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // Expose globally
  window.CrossVizLinker = {
    register: register,
    unregister: unregister,
    selectAuthor: selectAuthor,
    selectFile: selectFile,
    clearAll: clearAll,
    getFilters: getFilters,
    hasActiveFilter: hasActiveFilter
  };
})();
