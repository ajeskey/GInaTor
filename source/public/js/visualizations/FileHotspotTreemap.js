/**
 * FileHotspotTreemap — D3 treemap.
 * Rectangles sized by change frequency, cool-to-hot color gradient.
 * Fetches from /api/v1/treemap.
 */
(function () {
  'use strict';

  var d3 = window.d3;

  function FileHotspotTreemap(containerId, appState) {
    window.VisualizationBase.call(this, containerId, appState);
    this._breadcrumbs = [];
  }

  FileHotspotTreemap.prototype = Object.create(window.VisualizationBase.prototype);
  FileHotspotTreemap.prototype.constructor = FileHotspotTreemap;

  FileHotspotTreemap.prototype.load = function (repoId, dateRange) {
    window.VisualizationBase.prototype.load.call(this, repoId, dateRange);
    this._breadcrumbs = [];
    this._render();
  };

  FileHotspotTreemap.prototype.update = function (dateRange) {
    window.VisualizationBase.prototype.update.call(this, dateRange);
    this._render();
  };

  FileHotspotTreemap.prototype.resize = function () {
    this._render();
  };

  FileHotspotTreemap.prototype.highlight = function (sel) {
    if (!sel || !sel.file) return;
    d3.select(this.container)
      .selectAll('.tm-cell')
      .classed('opacity-30', function (d) {
        return d.data.path !== sel.file;
      });
  };

  FileHotspotTreemap.prototype.clearHighlight = function () {
    d3.select(this.container).selectAll('.tm-cell').classed('opacity-30', false);
  };

  FileHotspotTreemap.prototype._render = function () {
    var self = this;
    if (!this.repoId) return;

    this._fetch(this._apiUrl('/api/v1/treemap'))
      .then(function (data) {
        self.data = data;
        self._draw(data);
      })
      .catch(function (err) {
        console.error('FileHotspotTreemap fetch error:', err);
      });
  };

  FileHotspotTreemap.prototype._draw = function (data) {
    var dims = this._dims();
    var margin = { top: 30, right: 5, bottom: 5, left: 5 };
    var w = dims.width - margin.left - margin.right;
    var h = dims.height - margin.top - margin.bottom;
    var self = this;

    var svg = this._ensureSvg();
    svg.selectAll('*').remove();
    var g = svg.append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
    var tip = this._ensureTooltip();

    var hierarchy = d3
      .hierarchy(data.tree || { name: 'root', children: [] })
      .sum(function (d) {
        return d.frequency || 0;
      })
      .sort(function (a, b) {
        return b.value - a.value;
      });

    d3.treemap().size([w, h]).padding(2).round(true)(hierarchy);

    var maxFreq =
      d3.max(hierarchy.leaves(), function (d) {
        return d.value;
      }) || 1;
    var color = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, maxFreq]);

    var cells = g
      .selectAll('.tm-cell')
      .data(hierarchy.leaves())
      .enter()
      .append('g')
      .attr('class', 'tm-cell')
      .attr('transform', function (d) {
        return 'translate(' + d.x0 + ',' + d.y0 + ')';
      });

    cells
      .append('rect')
      .attr('width', function (d) {
        return Math.max(0, d.x1 - d.x0);
      })
      .attr('height', function (d) {
        return Math.max(0, d.y1 - d.y0);
      })
      .attr('fill', function (d) {
        return color(d.value);
      })
      .attr('stroke', '#fff')
      .attr('rx', 2)
      .on('mouseover', function (event, d) {
        self._showTooltip(
          tip,
          '<b>' + (d.data.path || d.data.name) + '</b><br>Changes: ' + d.value,
          event
        );
      })
      .on('mouseout', function () {
        self._hideTooltip(tip);
      })
      .on('click', function (event, d) {
        window.dispatchEvent(
          new CustomEvent('viz:file-selected', { detail: { file: d.data.path || d.data.name } })
        );
      });

    cells
      .append('text')
      .attr('x', 4)
      .attr('y', 14)
      .style('font-size', '10px')
      .style('fill', '#333')
      .text(function (d) {
        var name = d.data.name || '';
        var cellW = d.x1 - d.x0;
        return cellW > 40 ? name.slice(0, Math.floor(cellW / 6)) : '';
      });

    // Title
    svg
      .append('text')
      .attr('x', dims.width / 2)
      .attr('y', 18)
      .attr('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('font-weight', 'bold')
      .text('File Hotspot Treemap');
  };

  window.FileHotspotTreemap = FileHotspotTreemap;
})();
