/**
 * AppState — central state manager for GInaTor.
 * Manages: selected repo, date range, active visualization, theme, scrub position.
 * Implements pub/sub event system for state changes via window custom events.
 */
(function () {
  'use strict';

  var state = {
    repoId: null,
    dateRange: { from: null, to: null },
    activeVisualization: 'timebloom',
    theme: 'light',
    scrubPosition: null
  };

  /**
   * Emit a custom event on window.
   * @param {string} eventName
   * @param {*} detail
   */
  function emit(eventName, detail) {
    window.dispatchEvent(new CustomEvent(eventName, { detail: detail }));
  }

  /**
   * Set the selected repository.
   * @param {string} repoId
   */
  function setRepo(repoId) {
    if (state.repoId === repoId) return;
    state.repoId = repoId;
    state.dateRange = { from: null, to: null };
    state.scrubPosition = null;
    emit('state:repo-changed', { repoId: repoId });
  }

  /**
   * Set the selected date range.
   * @param {string|null} from - ISO date string
   * @param {string|null} to - ISO date string
   */
  function setDateRange(from, to) {
    state.dateRange = { from: from || null, to: to || null };
    emit('state:date-range-changed', { from: state.dateRange.from, to: state.dateRange.to });
  }

  /**
   * Set the active visualization type.
   * @param {string} vizType
   */
  function setVisualization(vizType) {
    if (state.activeVisualization === vizType) return;
    state.activeVisualization = vizType;
    emit('state:visualization-changed', { visualization: vizType });
  }

  /**
   * Set the theme.
   * @param {string} theme - 'light' or 'dark'
   */
  function setTheme(theme) {
    if (state.theme === theme) return;
    state.theme = theme;
    emit('state:theme-changed', { theme: theme });
  }

  /**
   * Set the scrub position (commit index within selected range).
   * @param {number|null} position
   */
  function setScrubPosition(position) {
    state.scrubPosition = position;
    emit('state:scrub-position-changed', { position: position });
  }

  /**
   * Get a snapshot of the current state.
   * @returns {object}
   */
  function getState() {
    return {
      repoId: state.repoId,
      dateRange: { from: state.dateRange.from, to: state.dateRange.to },
      activeVisualization: state.activeVisualization,
      theme: state.theme,
      scrubPosition: state.scrubPosition
    };
  }

  /**
   * Subscribe to a state event.
   * @param {string} eventName
   * @param {function} handler
   * @returns {function} unsubscribe function
   */
  function on(eventName, handler) {
    window.addEventListener(eventName, handler);
    return function () {
      window.removeEventListener(eventName, handler);
    };
  }

  // Bridge existing component events into AppState
  window.addEventListener('repo-changed', function (e) {
    if (e.detail && e.detail.repoId) {
      setRepo(e.detail.repoId);
    }
  });

  window.addEventListener('date-range-changed', function (e) {
    if (e.detail) {
      setDateRange(e.detail.from, e.detail.to);
    }
  });

  // Expose globally
  window.AppState = {
    getState: getState,
    setRepo: setRepo,
    setDateRange: setDateRange,
    setVisualization: setVisualization,
    setTheme: setTheme,
    setScrubPosition: setScrubPosition,
    on: on
  };
})();
