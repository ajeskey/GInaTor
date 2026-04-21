/**
 * ContributorHeatmap — D3 grid heatmap.
 * Rows = authors, columns = days/weeks, color intensity = commit count.
 * Fetches from /api/v1/heatmap.
 */
(function () {
  'use strict';

  var d3 = window.d3;

  function ContributorHeatmap(containerId, appState) {
    window.VisualizationBase.call(this, containerId, appState);
    this.granularity = 'weekly'; // 'daily' | 'weekly'
  }

  ContributorHeatmap.prototype = Object.create(window.VisualizationBase.prototype);
  ContributorHeatmap.prototype.constructor = ContributorHeatmap;

  ContributorHeatmap.prototype.load = function (repoId, dateRange) {
    window.VisualizationBase.prototype.load.call(this, repoId, dateRange);
    this._render();
  };

  ContributorHeatmap.prototype.update = function (dateRange) {
    window.VisualizationBase.prototype.update.call(this, dateRange);
    this._render();
  };

  ContributorHeatmap.prototype.resize = function () {
    this._render();
  };

  ContributorHeatmap.prototype.setGranularity = function (g) {
    this.granularity = g;
    this._render();
  };

  ContributorHeatmap.prototype.highlight = function (sel) {
    if (!sel || !sel.author) return;
    d3.select(this.container)
      .selectAll('.hm-row')
      .classed('opacity-30', function (d) {
        return d.key !== sel.author;
      });
  };

  ContributorHeatmap.prototype.clearHighlight = function () {
    d3.select(this.container).selectAll('.hm-row').classed('opacity-30', false);
  };

  ContributorHeatmap.prototype._render = function () {
    var self = this;
    if (!this.repoId) return;
    var url = this._apiUrl('/api/v1/heatmap', { granularity: this.granularity });

    this._fetch(url)
      .then(function (data) {
        self.data = data;
        self._draw(data);
      })
      .catch(function (err) {
        console.error('ContributorHeatmap fetch error:', err);
      });
  };

  ContributorHeatmap.prototype._draw = function (data) {
    var self = this;
    var dims = this._dims();
    var margin = { top: 40, right: 20, bottom: 60, left: 120 };
    var w = dims.width - margin.left - margin.right;
    var h = dims.height - margin.top - margin.bottom;

    var authors = data.authors || [];
    var periods = data.periods || [];
    var grid = data.grid || [];

    var svg = this._ensureSvg();
    svg.selectAll('*').remove();
    var g = svg.append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    var tip = this._ensureTooltip();

    var maxVal =
      d3.max(grid, function (r) {
        return d3.max(r);
      }) || 1;
    var color = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, maxVal]);

    var _cellW = Math.max(2, w / (periods.length || 1));
    var _cellH = Math.max(2, h / (authors.length || 1));

    var xScale = d3.scaleBand().domain(periods).range([0, w]).padding(0.05);
    var yScale = d3.scaleBand().domain(authors).range([0, h]).padding(0.05);

    // X axis
    g.append('g')
      .attr('transform', 'translate(0,' + h + ')')
      .call(
        d3.axisBottom(xScale).tickValues(
          periods.filter(function (_, i) {
            return i % Math.max(1, Math.floor(periods.length / 10)) === 0;
          })
        )
      )
      .selectAll('text')
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'end')
      .style('font-size', '10px');

    // Y axis
    g.append('g').call(d3.axisLeft(yScale)).selectAll('text').style('font-size', '10px');

    // Cells
    authors.forEach(function (author, ri) {
      var row = g.append('g').attr('class', 'hm-row').datum({ key: author });
      periods.forEach(function (period, ci) {
        var val = (grid[ri] && grid[ri][ci]) || 0;
        row
          .append('rect')
          .attr('x', xScale(period))
          .attr('y', yScale(author))
          .attr('width', xScale.bandwidth())
          .attr('height', yScale.bandwidth())
          .attr('fill', val > 0 ? color(val) : '#f0f0f0')
          .attr('rx', 2)
          .on('mouseover', function (event) {
            self._showTooltip(
              tip,
              '<b>' + author + '</b><br>' + period + '<br>Commits: ' + val,
              event
            );
          })
          .on('mouseout', function () {
            self._hideTooltip(tip);
          })
          .on('click', function () {
            window.dispatchEvent(
              new CustomEvent('viz:author-selected', { detail: { author: author } })
            );
          });
      });
    });

    // Title
    svg
      .append('text')
      .attr('x', dims.width / 2)
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('font-weight', 'bold')
      .text('Contributor Heatmap');
  };

  ContributorHeatmap.prototype.scrubTo = function (_idx) {
    // Heatmap is aggregate — no per-commit scrub
  };

  window.ContributorHeatmap = ContributorHeatmap;
})();
