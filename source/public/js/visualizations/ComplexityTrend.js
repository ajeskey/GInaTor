/**
 * ComplexityTrend — D3 line chart.
 * Time vs complexity metric (file size or cyclomatic complexity).
 * Fetches from /api/v1/complexity.
 */
(function () {
  'use strict';

  var d3 = window.d3;

  function ComplexityTrend(containerId, appState) {
    window.VisualizationBase.call(this, containerId, appState);
    this.selectedFile = null;
    this.threshold = null;
  }

  ComplexityTrend.prototype = Object.create(window.VisualizationBase.prototype);
  ComplexityTrend.prototype.constructor = ComplexityTrend;

  ComplexityTrend.prototype.load = function (repoId, dateRange) {
    window.VisualizationBase.prototype.load.call(this, repoId, dateRange);
    this._render();
  };

  ComplexityTrend.prototype.update = function (dateRange) {
    window.VisualizationBase.prototype.update.call(this, dateRange);
    this._render();
  };

  ComplexityTrend.prototype.resize = function () { this._render(); };

  ComplexityTrend.prototype.setFile = function (filePath) {
    this.selectedFile = filePath;
    this._render();
  };

  ComplexityTrend.prototype.setThreshold = function (val) {
    this.threshold = val;
    this._render();
  };

  ComplexityTrend.prototype._render = function () {
    var self = this;
    if (!this.repoId) return;
    var extra = {};
    if (this.selectedFile) extra.file = this.selectedFile;

    this._fetch(this._apiUrl('/api/v1/complexity', extra)).then(function (data) {
      self.data = data;
      self._draw(data);
    }).catch(function (err) {
      console.error('ComplexityTrend fetch error:', err);
    });
  };

  ComplexityTrend.prototype._draw = function (data) {
    var dims = this._dims();
    var margin = { top: 40, right: 30, bottom: 50, left: 60 };
    var w = dims.width - margin.left - margin.right;
    var h = dims.height - margin.top - margin.bottom;
    var self = this;

    var series = (data.series || []).map(function (d) {
      return { date: new Date(d.date), value: d.value, file: d.file };
    });

    var svg = this._ensureSvg();
    svg.selectAll('*').remove();
    var g = svg.append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
    var tip = this._ensureTooltip();

    var x = d3.scaleTime()
      .domain(d3.extent(series, function (d) { return d.date; }) || [new Date(), new Date()])
      .range([0, w]);

    var y = d3.scaleLinear()
      .domain([0, d3.max(series, function (d) { return d.value; }) || 1])
      .nice().range([h, 0]);

    g.append('g').attr('transform', 'translate(0,' + h + ')').call(d3.axisBottom(x).ticks(8))
      .selectAll('text').style('font-size', '10px');
    g.append('g').call(d3.axisLeft(y).ticks(6)).selectAll('text').style('font-size', '10px');

    // Threshold line
    if (this.threshold != null) {
      g.append('line')
        .attr('x1', 0).attr('x2', w)
        .attr('y1', y(this.threshold)).attr('y2', y(this.threshold))
        .attr('stroke', '#ef4444').attr('stroke-dasharray', '6,3').attr('stroke-width', 1.5);
      g.append('text').attr('x', w).attr('y', y(this.threshold) - 5)
        .attr('text-anchor', 'end').style('font-size', '10px').style('fill', '#ef4444')
        .text('Threshold: ' + this.threshold);
    }

    // Line
    var line = d3.line()
      .x(function (d) { return x(d.date); })
      .y(function (d) { return y(d.value); })
      .curve(d3.curveMonotoneX);

    g.append('path').datum(series)
      .attr('fill', 'none').attr('stroke', '#8b5cf6').attr('stroke-width', 2)
      .attr('d', line);

    // Points
    g.selectAll('.ct-dot')
      .data(series).enter().append('circle')
      .attr('class', 'ct-dot')
      .attr('cx', function (d) { return x(d.date); })
      .attr('cy', function (d) { return y(d.value); })
      .attr('r', 3).attr('fill', '#8b5cf6')
      .on('mouseover', function (event, d) {
        self._showTooltip(tip,
          '<b>' + d.date.toLocaleDateString() + '</b><br>' +
          'Complexity: ' + d.value +
          (d.file ? '<br>' + d.file : ''),
          event);
      })
      .on('mouseout', function () { self._hideTooltip(tip); })
      .on('click', function (event, d) {
        window.dispatchEvent(new CustomEvent('viz:open-diff', { detail: { file: d.file, date: d.date.toISOString() } }));
      });

    // Title
    svg.append('text').attr('x', dims.width / 2).attr('y', 20)
      .attr('text-anchor', 'middle').style('font-size', '14px').style('font-weight', 'bold')
      .text('Code Complexity Trend' + (this.selectedFile ? ' — ' + this.selectedFile : ''));

    // Y label
    g.append('text').attr('transform', 'rotate(-90)').attr('y', -45).attr('x', -h / 2)
      .attr('text-anchor', 'middle').style('font-size', '11px').text('Complexity');
  };

  window.ComplexityTrend = ComplexityTrend;
})();
