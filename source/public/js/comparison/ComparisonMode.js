/**
 * ComparisonMode — side-by-side dual visualization rendering.
 * Allows comparing two date ranges or two repos for the same viz type.
 * Requirements: 35.1–35.9
 */
(function () {
  'use strict';

  var _active = false;
  var _leftConfig = { repoId: null, dateFrom: null, dateTo: null };
  var _rightConfig = { repoId: null, dateFrom: null, dateTo: null };
  var _leftViz = null;
  var _rightViz = null;
  var _vizFactory = null;
  var _savedState = null;

  /**
   * Initialize ComparisonMode.
   * Wires the compare toggle button in the header.
   */
  function init() {
    var toggleBtn = document.getElementById('compare-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', function () {
        if (_active) {
          deactivate();
        } else {
          activate();
        }
      });
    }
  }

  /**
   * Set the factory function used to create visualization instances.
   * @param {function} factory - function(containerId) that returns a viz instance
   */
  function setVizFactory(factory) {
    _vizFactory = factory;
  }

  /**
   * Activate comparison mode.
   */
  function activate() {
    if (_active) return;
    _active = true;

    // Save current state
    var appState = window.AppState ? window.AppState.getState() : {};
    _savedState = {
      repoId: appState.repoId,
      dateRange: appState.dateRange
        ? { from: appState.dateRange.from, to: appState.dateRange.to }
        : { from: null, to: null }
    };

    _leftConfig.repoId = _savedState.repoId;
    _leftConfig.dateFrom = _savedState.dateRange.from;
    _leftConfig.dateTo = _savedState.dateRange.to;
    _rightConfig.repoId = _savedState.repoId;
    _rightConfig.dateFrom = _savedState.dateRange.from;
    _rightConfig.dateTo = _savedState.dateRange.to;

    _buildComparisonUI();
    _updateToggleButton(true);
    window.dispatchEvent(new CustomEvent('comparison:activated'));
  }

  /**
   * Deactivate comparison mode, restoring single-viz layout.
   */
  function deactivate() {
    if (!_active) return;
    _active = false;

    // Destroy comparison vizzes
    if (_leftViz && typeof _leftViz.destroy === 'function') _leftViz.destroy();
    if (_rightViz && typeof _rightViz.destroy === 'function') _rightViz.destroy();
    _leftViz = null;
    _rightViz = null;

    // Remove comparison UI
    var compPanel = document.getElementById('comparison-panel');
    if (compPanel) compPanel.remove();

    // Restore viz container
    var vizContainer = document.getElementById('viz-container');
    if (vizContainer) vizContainer.classList.remove('hidden');

    // Restore left-side config as active view
    if (_savedState && window.AppState) {
      if (_leftConfig.repoId) window.AppState.setRepo(_leftConfig.repoId);
      window.AppState.setDateRange(_leftConfig.dateFrom, _leftConfig.dateTo);
    }

    _updateToggleButton(false);
    window.dispatchEvent(new CustomEvent('comparison:deactivated'));
  }

  /**
   * Check if comparison mode is active.
   * @returns {boolean}
   */
  function isActive() {
    return _active;
  }

  /**
   * Get left/right configs.
   * @returns {{ left: object, right: object }}
   */
  function getConfigs() {
    return {
      left: {
        repoId: _leftConfig.repoId,
        dateFrom: _leftConfig.dateFrom,
        dateTo: _leftConfig.dateTo
      },
      right: {
        repoId: _rightConfig.repoId,
        dateFrom: _rightConfig.dateFrom,
        dateTo: _rightConfig.dateTo
      }
    };
  }

  /**
   * Build the comparison UI with side-by-side containers and config controls.
   * @private
   */
  function _buildComparisonUI() {
    var vizContainer = document.getElementById('viz-container');
    if (vizContainer) vizContainer.classList.add('hidden');

    // Remove existing panel if any
    var existing = document.getElementById('comparison-panel');
    if (existing) existing.remove();

    var panel = document.createElement('div');
    panel.id = 'comparison-panel';
    panel.className = 'w-full';

    // Config controls row
    var configRow = document.createElement('div');
    configRow.className = 'flex gap-4 mb-4 p-2 bg-base-200 rounded-lg';
    configRow.innerHTML =
      '<div class="flex-1">' +
      '<label class="label label-text font-semibold">Left Side</label>' +
      '<div class="flex gap-2">' +
      '<input type="date" id="compare-left-from" class="input input-bordered input-sm" placeholder="From" value="' +
      (_leftConfig.dateFrom || '') +
      '">' +
      '<input type="date" id="compare-left-to" class="input input-bordered input-sm" placeholder="To" value="' +
      (_leftConfig.dateTo || '') +
      '">' +
      '</div>' +
      '</div>' +
      '<div class="flex-1">' +
      '<label class="label label-text font-semibold">Right Side</label>' +
      '<div class="flex gap-2">' +
      '<input type="date" id="compare-right-from" class="input input-bordered input-sm" placeholder="From" value="' +
      (_rightConfig.dateFrom || '') +
      '">' +
      '<input type="date" id="compare-right-to" class="input input-bordered input-sm" placeholder="To" value="' +
      (_rightConfig.dateTo || '') +
      '">' +
      '</div>' +
      '</div>' +
      '<div class="flex items-end">' +
      '<button id="compare-apply-btn" class="btn btn-primary btn-sm">Apply</button>' +
      '</div>';
    panel.appendChild(configRow);

    // Side-by-side viz containers
    var vizRow = document.createElement('div');
    vizRow.className = 'flex gap-4';

    var leftSide = document.createElement('div');
    leftSide.className = 'flex-1 flex flex-col';
    leftSide.innerHTML =
      '<div id="compare-left-label" class="text-center font-semibold text-sm mb-1 text-base-content">Left</div>';
    var leftContainer = document.createElement('div');
    leftContainer.id = 'compare-left-viz';
    leftContainer.className = 'bg-base-100 rounded-lg shadow-sm p-4 min-h-96';
    leftSide.appendChild(leftContainer);

    var rightSide = document.createElement('div');
    rightSide.className = 'flex-1 flex flex-col';
    rightSide.innerHTML =
      '<div id="compare-right-label" class="text-center font-semibold text-sm mb-1 text-base-content">Right</div>';
    var rightContainer = document.createElement('div');
    rightContainer.id = 'compare-right-viz';
    rightContainer.className = 'bg-base-100 rounded-lg shadow-sm p-4 min-h-96';
    rightSide.appendChild(rightContainer);

    vizRow.appendChild(leftSide);
    vizRow.appendChild(rightSide);
    panel.appendChild(vizRow);

    // Insert into main content area
    var mainContent = vizContainer ? vizContainer.parentNode : document.querySelector('main');
    if (mainContent) {
      mainContent.insertBefore(panel, vizContainer ? vizContainer.nextSibling : null);
    }

    // Wire apply button
    var applyBtn = document.getElementById('compare-apply-btn');
    if (applyBtn) {
      applyBtn.addEventListener('click', function () {
        _leftConfig.dateFrom = document.getElementById('compare-left-from').value || null;
        _leftConfig.dateTo = document.getElementById('compare-left-to').value || null;
        _rightConfig.dateFrom = document.getElementById('compare-right-from').value || null;
        _rightConfig.dateTo = document.getElementById('compare-right-to').value || null;
        _updateLabels();
        _loadVizzes();
      });
    }

    _updateLabels();
    _loadVizzes();
  }

  /**
   * Update the labels above each side.
   * @private
   */
  function _updateLabels() {
    var leftLabel = document.getElementById('compare-left-label');
    var rightLabel = document.getElementById('compare-right-label');
    if (leftLabel) {
      leftLabel.textContent = _formatLabel(_leftConfig);
    }
    if (rightLabel) {
      rightLabel.textContent = _formatLabel(_rightConfig);
    }
  }

  /**
   * Format a config into a label string.
   * @param {object} config
   * @returns {string}
   * @private
   */
  function _formatLabel(config) {
    var parts = [];
    if (config.repoId) parts.push(config.repoId);
    if (config.dateFrom) parts.push(config.dateFrom);
    if (config.dateTo) parts.push('to ' + config.dateTo);
    return parts.length ? parts.join(' ') : 'Not configured';
  }

  /**
   * Load visualizations into both containers.
   * @private
   */
  function _loadVizzes() {
    if (!_vizFactory) return;

    if (_leftViz && typeof _leftViz.destroy === 'function') _leftViz.destroy();
    if (_rightViz && typeof _rightViz.destroy === 'function') _rightViz.destroy();

    _leftViz = _vizFactory('compare-left-viz');
    _rightViz = _vizFactory('compare-right-viz');

    if (_leftViz && typeof _leftViz.load === 'function') {
      _leftViz.load(_leftConfig.repoId, { from: _leftConfig.dateFrom, to: _leftConfig.dateTo });
    }
    if (_rightViz && typeof _rightViz.load === 'function') {
      _rightViz.load(_rightConfig.repoId, { from: _rightConfig.dateFrom, to: _rightConfig.dateTo });
    }

    // Synchronized zoom/pan via custom events
    _syncInteractions();
  }

  /**
   * Synchronize zoom/pan between left and right vizzes.
   * @private
   */
  function _syncInteractions() {
    // Vizzes that support zoom/pan dispatch 'viz:zoom' and 'viz:pan' events
    // We relay them between the two containers
    var leftEl = document.getElementById('compare-left-viz');
    var rightEl = document.getElementById('compare-right-viz');
    if (!leftEl || !rightEl) return;

    leftEl.addEventListener('viz:zoom', function (e) {
      rightEl.dispatchEvent(new CustomEvent('viz:zoom', { detail: e.detail }));
    });
    rightEl.addEventListener('viz:zoom', function (e) {
      leftEl.dispatchEvent(new CustomEvent('viz:zoom', { detail: e.detail }));
    });
    leftEl.addEventListener('viz:pan', function (e) {
      rightEl.dispatchEvent(new CustomEvent('viz:pan', { detail: e.detail }));
    });
    rightEl.addEventListener('viz:pan', function (e) {
      leftEl.dispatchEvent(new CustomEvent('viz:pan', { detail: e.detail }));
    });
  }

  /**
   * Update the compare toggle button appearance.
   * @param {boolean} active
   * @private
   */
  function _updateToggleButton(active) {
    var btn = document.getElementById('compare-toggle');
    if (!btn) return;
    if (active) {
      btn.classList.add('btn-active', 'btn-primary');
    } else {
      btn.classList.remove('btn-active', 'btn-primary');
    }
  }

  // Expose globally
  window.ComparisonMode = {
    init: init,
    activate: activate,
    deactivate: deactivate,
    isActive: isActive,
    setVizFactory: setVizFactory,
    getConfigs: getConfigs
  };
})();
