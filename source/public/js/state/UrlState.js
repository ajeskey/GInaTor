/**
 * UrlState — encodes/decodes view state to/from URL query parameters.
 * Supports visualization type, date range, and repository ID.
 * Restores view state on page load from URL params.
 */
(function () {
  'use strict';

  var VALID_VIZ_TYPES = [
    'timebloom', 'heatmap', 'treemap', 'sunburst', 'branches',
    'pulse', 'impact', 'collaboration', 'filetypes', 'activity-matrix',
    'bubblemap', 'complexity', 'pr-flow', 'bus-factor', 'stale-files',
    'city-block', 'genome'
  ];

  /**
   * Encode view state into URL query parameters string.
   * @param {object} viewState
   * @param {string} [viewState.visualization] - visualization type
   * @param {string} [viewState.from] - ISO date string for range start
   * @param {string} [viewState.to] - ISO date string for range end
   * @param {string} [viewState.repoId] - repository ID
   * @returns {string} query string (without leading '?')
   */
  function encode(viewState) {
    if (!viewState) return '';
    var params = [];
    if (viewState.visualization && VALID_VIZ_TYPES.indexOf(viewState.visualization) !== -1) {
      params.push('viz=' + encodeURIComponent(viewState.visualization));
    }
    if (viewState.from) {
      params.push('from=' + encodeURIComponent(viewState.from));
    }
    if (viewState.to) {
      params.push('to=' + encodeURIComponent(viewState.to));
    }
    if (viewState.repoId) {
      params.push('repo=' + encodeURIComponent(viewState.repoId));
    }
    return params.join('&');
  }

  /**
   * Decode URL query parameters string into view state.
   * @param {string} queryString - query string (with or without leading '?')
   * @returns {object} viewState with visualization, from, to, repoId
   */
  function decode(queryString) {
    var result = {
      visualization: null,
      from: null,
      to: null,
      repoId: null
    };
    if (!queryString) return result;

    var qs = queryString.charAt(0) === '?' ? queryString.substring(1) : queryString;
    if (!qs) return result;

    var pairs = qs.split('&');
    for (var i = 0; i < pairs.length; i++) {
      var eqIdx = pairs[i].indexOf('=');
      if (eqIdx === -1) continue;
      var key = decodeURIComponent(pairs[i].substring(0, eqIdx));
      var value = decodeURIComponent(pairs[i].substring(eqIdx + 1));

      if (key === 'viz' && VALID_VIZ_TYPES.indexOf(value) !== -1) {
        result.visualization = value;
      } else if (key === 'from' && value) {
        result.from = value;
      } else if (key === 'to' && value) {
        result.to = value;
      } else if (key === 'repo' && value) {
        result.repoId = value;
      }
    }
    return result;
  }

  /**
   * Push current view state into the browser URL without reload.
   * @param {object} viewState
   */
  function pushState(viewState) {
    var qs = encode(viewState);
    var url = window.location.pathname + (qs ? '?' + qs : '');
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', url);
    }
  }

  /**
   * Read view state from the current browser URL.
   * @returns {object} viewState
   */
  function readFromUrl() {
    return decode(window.location.search);
  }

  /**
   * Restore view state from URL on page load.
   */
  function restoreOnLoad() {
    var viewState = readFromUrl();
    if (viewState.repoId && window.AppState) {
      window.AppState.setRepo(viewState.repoId);
    }
    if (viewState.visualization && window.AppState) {
      window.AppState.setVisualization(viewState.visualization);
    }
    if ((viewState.from || viewState.to) && window.AppState) {
      window.AppState.setDateRange(viewState.from, viewState.to);
    }
  }

  // Sync URL when state changes
  function updateUrl() {
    if (!window.AppState) return;
    var s = window.AppState.getState();
    pushState({
      visualization: s.activeVisualization,
      from: s.dateRange.from,
      to: s.dateRange.to,
      repoId: s.repoId
    });
  }

  window.addEventListener('state:repo-changed', updateUrl);
  window.addEventListener('state:date-range-changed', updateUrl);
  window.addEventListener('state:visualization-changed', updateUrl);

  // Restore state from URL on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', restoreOnLoad);
  } else {
    restoreOnLoad();
  }

  // Expose globally
  window.UrlState = {
    encode: encode,
    decode: decode,
    pushState: pushState,
    readFromUrl: readFromUrl,
    VALID_VIZ_TYPES: VALID_VIZ_TYPES
  };
})();
