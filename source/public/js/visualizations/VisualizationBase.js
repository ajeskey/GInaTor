/**
 * VisualizationBase — abstract base class for all GInaTor visualizations.
 * Provides common interface, AppState wiring, and utility methods.
 * All visualizations extend this class via prototypal inheritance.
 */
(function () {
  'use strict';

  /**
   * @constructor
   * @param {string} containerId - DOM element ID for the visualization container
   * @param {object} appState - Reference to window.AppState
   */
  function VisualizationBase(containerId, appState) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    this.appState = appState || window.AppState;
    this.data = null;
    this.repoId = null;
    this.dateRange = { from: null, to: null };
    this._unsubs = [];
    this._resizeHandler = null;
    this._init();
  }

  /**
   * Wire up AppState listeners and window resize.
   * @private
   */
  VisualizationBase.prototype._init = function () {
    var self = this;

    // Listen for date range changes
    var offDate = this.appState.on('state:date-range-changed', function (e) {
      var d = e.detail || {};
      self.dateRange = { from: d.from, to: d.to };
      self.update(self.dateRange);
    });
    this._unsubs.push(offDate);

    // Listen for scrub position changes
    var offScrub = this.appState.on('state:scrub-position-changed', function (e) {
      var pos = e.detail ? e.detail.position : null;
      self.scrubTo(pos);
    });
    this._unsubs.push(offScrub);

    // Handle window resize
    this._resizeHandler = function () { self.resize(); };
    window.addEventListener('resize', this._resizeHandler);
  };

  /**
   * Fetch JSON from an API endpoint with auth credentials.
   * @param {string} url
   * @returns {Promise<object>}
   */
  VisualizationBase.prototype._fetch = function (url) {
    return fetch(url, { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error('API error ' + r.status);
      return r.json();
    });
  };

  /**
   * Build a query string from the current repo and date range.
   * @param {string} base - base API path e.g. '/api/v1/heatmap'
   * @param {object} [extra] - additional query params
   * @returns {string}
   */
  VisualizationBase.prototype._apiUrl = function (base, extra) {
    var params = [];
    if (this.repoId) params.push('repoId=' + encodeURIComponent(this.repoId));
    if (this.dateRange.from) params.push('from=' + encodeURIComponent(this.dateRange.from));
    if (this.dateRange.to) params.push('to=' + encodeURIComponent(this.dateRange.to));
    if (extra) {
      Object.keys(extra).forEach(function (k) {
        if (extra[k] != null) params.push(k + '=' + encodeURIComponent(extra[k]));
      });
    }
    return base + (params.length ? '?' + params.join('&') : '');
  };

  /**
   * Get container dimensions.
   * @returns {{ width: number, height: number }}
   */
  VisualizationBase.prototype._dims = function () {
    if (!this.container) return { width: 800, height: 600 };
    return {
      width: this.container.clientWidth || 800,
      height: this.container.clientHeight || 600
    };
  };

  /**
   * Create or select the SVG element inside the container.
   * @returns {d3.Selection}
   */
  VisualizationBase.prototype._ensureSvg = function () {
    var d3 = window.d3;
    var dims = this._dims();
    var svg = d3.select(this.container).select('svg');
    if (svg.empty()) {
      svg = d3.select(this.container).append('svg');
    }
    svg.attr('width', dims.width).attr('height', dims.height);
    return svg;
  };

  /**
   * Create a tooltip div if not present.
   * @returns {d3.Selection}
   */
  VisualizationBase.prototype._ensureTooltip = function () {
    var d3 = window.d3;
    var tip = d3.select(this.container).select('.viz-tooltip');
    if (tip.empty()) {
      tip = d3.select(this.container).append('div')
        .attr('class', 'viz-tooltip')
        .style('position', 'absolute')
        .style('pointer-events', 'none')
        .style('background', 'rgba(0,0,0,0.8)')
        .style('color', '#fff')
        .style('padding', '6px 10px')
        .style('border-radius', '4px')
        .style('font-size', '12px')
        .style('display', 'none')
        .style('z-index', '1000');
    }
    return tip;
  };

  /** Show tooltip at mouse position */
  VisualizationBase.prototype._showTooltip = function (tip, html, event) {
    tip.html(html)
      .style('display', 'block')
      .style('left', (event.offsetX + 12) + 'px')
      .style('top', (event.offsetY - 10) + 'px');
  };

  /** Hide tooltip */
  VisualizationBase.prototype._hideTooltip = function (tip) {
    tip.style('display', 'none');
  };

  // --- Public interface (override in subclasses) ---

  /**
   * Fetch data from API and render the visualization.
   * @param {string} repoId
   * @param {{ from: string, to: string }} dateRange
   */
  VisualizationBase.prototype.load = function (repoId, dateRange) {
    this.repoId = repoId;
    this.dateRange = dateRange || { from: null, to: null };
  };

  /**
   * Re-render for a new date range.
   * @param {{ from: string, to: string }} dateRange
   */
  VisualizationBase.prototype.update = function (dateRange) {
    this.dateRange = dateRange || this.dateRange;
  };

  /**
   * Update visualization for a scrub position.
   * @param {number|null} commitIndex
   */
  VisualizationBase.prototype.scrubTo = function (commitIndex) {};

  /**
   * Highlight elements for cross-viz linking.
   * @param {object} selection - e.g. { author: '...' } or { file: '...' }
   */
  VisualizationBase.prototype.highlight = function (selection) {};

  /**
   * Remove cross-viz highlights.
   */
  VisualizationBase.prototype.clearHighlight = function () {};

  /**
   * Handle container resize.
   */
  VisualizationBase.prototype.resize = function () {};

  /**
   * Return the SVG element for export.
   * @returns {SVGElement|null}
   */
  VisualizationBase.prototype.exportSVG = function () {
    if (!this.container) return null;
    return this.container.querySelector('svg') || null;
  };

  /**
   * Cleanup: remove listeners, DOM elements, etc.
   */
  VisualizationBase.prototype.destroy = function () {
    this._unsubs.forEach(function (fn) { if (fn) fn(); });
    this._unsubs = [];
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
    }
    if (this.container) this.container.innerHTML = '';
  };

  window.VisualizationBase = VisualizationBase;
})();
