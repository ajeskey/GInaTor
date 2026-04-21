/**
 * ActivityMatrix — D3 matrix heatmap.
 * 7 rows (days) × 24 columns (hours), color intensity = commit count.
 * Fetches from /api/v1/activity-matrix.
 */
(function () {
  'use strict';

  var d3 = window.d3;

  function ActivityMatrix(containerId, appState) {
    window.VisualizationBase.call(this, containerId, appState);
  }

  ActivityMatrix.prototype = Object.create(window.VisualizationBase.prototype);
  ActivityMatrix.prototype.constructor = ActivityMatrix;

  ActivityMatrix.prototype.load = function (repoId, dateRange) {
    window.VisualizationBase.prototype.load.call(this, repoId, dateRange);
    this._render();
  };

  ActivityMatrix.prototype.update = function (dateRange) {
    window.VisualizationBase.prototype.update.call(this, dateRange);
    this._render();
  };

  ActivityMatrix.prototype.resize = function () { this._render(); };

  ActivityMatrix.prototype._render = function () {
    var self = this;
    if (!this.repoId) return;

    this._fetch(this._apiUrl('/api/v1/activity-matrix')).then(function (data) {
      self.data = data;
      self._draw(data);
    }).catch(function (err) {
      console.error('ActivityMatrix fetch error:', err);
    });
  };

  ActivityMatrix.prototype._draw = function (data) {
    var dims = this._dims();
    var margin = { top: 50, right: 20, bottom: 30, left: 80 };
    var w = dims.width - margin.left - margin.right;
    var h = dims.height - margin.top - margin.bottom;
    var self = this;

    var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var hours = [];
    for (var i = 0; i < 24; i++) hours.push(i);

    var grid = data.grid || []; // 7×24 array

    var svg = this._ensureSvg();
    svg.selectAll('*').remove();
    var g = svg.append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
    var tip = this._ensureTooltip();

    var maxVal = 0;
    grid.forEach(function (row) {
      row.forEach(function (v) { if (v > maxVal) maxVal = v; });
    });
    maxVal = maxVal || 1;

    var color = d3.scaleSequential(d3.interpolateYlGnBu).domain([0, maxVal]);
    var _cellW = w / 24;
    var _cellH = h / 7;

    var xScale = d3.scaleBand().domain(hours).range([0, w]).padding(0.05);
    var yScale = d3.scaleBand().domain(days).range([0, h]).padding(0.05);

    // X axis (hours)
    g.append('g').attr('transform', 'translate(0,' + h + ')')
      .call(d3.axisBottom(xScale).tickFormat(function (d) { return d + ':00'; }))
      .selectAll('text').style('font-size', '9px').attr('transform', 'rotate(-45)').style('text-anchor', 'end');

    // Y axis (days)
    g.append('g').call(d3.axisLeft(yScale)).selectAll('text').style('font-size', '11px');

    // Cells
    days.forEach(function (day, di) {
      hours.forEach(function (hour, hi) {
        var val = (grid[di] && grid[di][hi]) || 0;
        g.append('rect')
          .attr('x', xScale(hour))
          .attr('y', yScale(day))
          .attr('width', xScale.bandwidth())
          .attr('height', yScale.bandwidth())
          .attr('fill', val > 0 ? color(val) : '#f5f5f5')
          .attr('rx', 3)
          .on('mouseover', function (event) {
            self._showTooltip(tip, '<b>' + day + ' ' + hour + ':00</b><br>Commits: ' + val, event);
          })
          .on('mouseout', function () { self._hideTooltip(tip); })
          .on('click', function () {
            window.dispatchEvent(new CustomEvent('viz:timeslot-selected', { detail: { day: di, hour: hour } }));
          });
      });
    });

    // Title
    svg.append('text').attr('x', dims.width / 2).attr('y', 25)
      .attr('text-anchor', 'middle').style('font-size', '14px').style('font-weight', 'bold')
      .text('Activity Matrix');
  };

  window.ActivityMatrix = ActivityMatrix;
})();
