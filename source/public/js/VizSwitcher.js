/**
 * VizSwitcher — wires all 17 visualizations to the sidebar switcher.
 * Registers visualization modules, shows/hides on sidebar selection,
 * indicates active viz, preserves timeline state, supports collapsible sidebar.
 * Requirements: 12.1–12.7
 */
(function () {
  'use strict';

  /**
   * Map of viz type keys to their constructor names on window.
   */
  var VIZ_REGISTRY = {
    'timebloom':        'TimeBloom',
    'heatmap':          'ContributorHeatmap',
    'treemap':          'FileHotspotTreemap',
    'sunburst':         'OwnershipSunburst',
    'branches':         'BranchMergeGraph',
    'pulse':            'CommitPulse',
    'impact':           'ImpactViz',
    'collaboration':    'CollaborationNetwork',
    'filetypes':        'FileTypeDistribution',
    'activity-matrix':  'ActivityMatrix',
    'bubblemap':        'BubbleMap',
    'complexity':       'ComplexityTrend',
    'pr-flow':          'PRReviewFlow',
    'bus-factor':       'BusFactorView',
    'stale-files':      'StaleFileView',
    'city-block':       'CityBlock',
    'genome':           'GenomeSequence'
  };

  var _activeVizType = null;
  var _activeVizInstance = null;
  var _containerId = 'viz-container';

  /**
   * Initialize the VizSwitcher.
   * Wires sidebar click events and AppState listeners.
   */
  function init() {
    _wireSidebarClicks();
    _wireAppStateListeners();

    // Restore from AppState or URL
    var appState = window.AppState ? window.AppState.getState() : {};
    if (appState.activeVisualization) {
      switchTo(appState.activeVisualization);
    }
  }

  /**
   * Switch to a specific visualization type.
   * @param {string} vizType - key from VIZ_REGISTRY
   */
  function switchTo(vizType) {
    if (!VIZ_REGISTRY[vizType]) {
      console.warn('VizSwitcher: Unknown viz type "' + vizType + '"');
      return;
    }

    // Don't re-create if already active
    if (_activeVizType === vizType && _activeVizInstance) return;

    // Destroy current viz
    if (_activeVizInstance && typeof _activeVizInstance.destroy === 'function') {
      // Unregister from cross-viz linking
      if (window.CrossVizLinker) {
        window.CrossVizLinker.unregister(_activeVizType);
      }
      _activeVizInstance.destroy();
      _activeVizInstance = null;
    }

    _activeVizType = vizType;

    // Clear the placeholder
    var placeholder = document.getElementById('viz-placeholder');
    if (placeholder) placeholder.style.display = 'none';

    // Ensure container is visible
    var container = document.getElementById(_containerId);
    if (container) container.classList.remove('hidden');

    // Create new viz instance
    var ConstructorName = VIZ_REGISTRY[vizType];
    var Constructor = window[ConstructorName];
    if (!Constructor) {
      console.warn('VizSwitcher: Constructor "' + ConstructorName + '" not found on window');
      return;
    }

    _activeVizInstance = new Constructor(_containerId, window.AppState);

    // Register with cross-viz linking
    if (window.CrossVizLinker) {
      window.CrossVizLinker.register(vizType, _activeVizInstance);
    }

    // Load data with current state (preserve timeline)
    var appState = window.AppState ? window.AppState.getState() : {};
    if (appState.repoId) {
      _activeVizInstance.load(appState.repoId, appState.dateRange);
    }

    // Update AppState
    if (window.AppState) {
      window.AppState.setVisualization(vizType);
    }

    // Update sidebar active indicator
    _updateSidebarActive(vizType);
  }

  /**
   * Get the currently active visualization type.
   * @returns {string|null}
   */
  function getActiveType() {
    return _activeVizType;
  }

  /**
   * Get the currently active visualization instance.
   * @returns {object|null}
   */
  function getActiveInstance() {
    return _activeVizInstance;
  }

  /**
   * Get the registry of all viz types.
   * @returns {object}
   */
  function getRegistry() {
    return Object.assign({}, VIZ_REGISTRY);
  }

  /**
   * Create a viz instance for a given container (used by ComparisonMode).
   * @param {string} containerId
   * @returns {object|null}
   */
  function createVizForContainer(containerId) {
    if (!_activeVizType || !VIZ_REGISTRY[_activeVizType]) return null;
    var Constructor = window[VIZ_REGISTRY[_activeVizType]];
    if (!Constructor) return null;
    return new Constructor(containerId, window.AppState);
  }

  // --- Private helpers ---

  /**
   * Wire click events on sidebar viz items.
   * @private
   */
  function _wireSidebarClicks() {
    var vizItems = document.querySelectorAll('.viz-item');
    vizItems.forEach(function (item) {
      item.addEventListener('click', function (e) {
        e.preventDefault();
        var vizType = item.getAttribute('data-viz');
        if (vizType) switchTo(vizType);
      });
    });
  }

  /**
   * Wire AppState listeners for repo changes.
   * @private
   */
  function _wireAppStateListeners() {
    if (!window.AppState) return;

    // When repo changes, reload the active viz
    window.AppState.on('state:repo-changed', function (_e) {
      if (_activeVizInstance && typeof _activeVizInstance.load === 'function') {
        var state = window.AppState.getState();
        _activeVizInstance.load(state.repoId, state.dateRange);
      }
    });

    // When visualization is changed externally (e.g. from bookmark)
    window.AppState.on('state:visualization-changed', function (e) {
      var vizType = e.detail ? e.detail.visualization : null;
      if (vizType && vizType !== _activeVizType) {
        // Avoid infinite loop — switchTo calls setVisualization
        var saved = _activeVizType;
        _activeVizType = vizType; // temporarily set to prevent re-entry
        _activeVizType = saved;   // restore
        switchTo(vizType);
      }
    });
  }

  /**
   * Update the sidebar to indicate the active visualization.
   * @param {string} vizType
   * @private
   */
  function _updateSidebarActive(vizType) {
    var vizItems = document.querySelectorAll('.viz-item');
    vizItems.forEach(function (item) {
      var itemViz = item.getAttribute('data-viz');
      if (itemViz === vizType) {
        item.classList.add('active', 'bg-primary', 'text-primary-content');
      } else {
        item.classList.remove('active', 'bg-primary', 'text-primary-content');
      }
    });
  }

  // Wire ComparisonMode factory if available
  if (window.ComparisonMode) {
    window.ComparisonMode.setVizFactory(createVizForContainer);
  }

  // Expose globally
  window.VizSwitcher = {
    init: init,
    switchTo: switchTo,
    getActiveType: getActiveType,
    getActiveInstance: getActiveInstance,
    getRegistry: getRegistry,
    createVizForContainer: createVizForContainer
  };
})();
