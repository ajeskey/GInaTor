/**
 * BubbleMap — D3 bubble pack layout.
 * Sized by selectable metric, colored by selectable dimension.
 * Fetches from /api/v1/bubblemap.
 */
(function () {
  'use strict';

  var d3 = window.d3;

  function BubbleMap(containerId, appState) {
    window.VisualizationBase.call(this, containerId, appState);
    this.metric = 'frequency'; // 'frequency' | 'lines' | 'contributors'
    this.colorBy = 'contributor'; // 'contributor' | 'filetype' | 'churn'
    this._breadcrumbs = [];
  }

  BubbleMap.prototype = Object.create(window.VisualizationBase.prototype);
  BubbleMap.prototype.constructor = BubbleMap;

  BubbleMap.prototype.load = function (repoId, dateRange) {
    window.VisualizationBase.prototype.load.call(this, repoId, dateRange);
    this._breadcrumbs = [];
    this._render();
  };

  BubbleMap.prototype.update = function (dateRange) {
    window.VisualizationBase.prototype.update.call(this, dateRange);
    this._render();
  };

  BubbleMap.prototype.resize = function () { this._render(); };

  BubbleMap.prototype.setMetric = function (m) { this.metric = m; this._render(); };
  BubbleMap.prototype.setColorBy = function (c) { this.colorBy = c; this._render(); };

  BubbleMap.prototype.highlight = function (sel) {
    if (!sel || !sel.file) return;
    d3.select(this.container).selectAll('.bm-bubble')
      .classed('opacity-30', function (d) { return d.data.path !== sel.file; });
  };

  BubbleMap.prototype.clearHighlight = function () {
    d3.select(this.container).selectAll('.bm-bubble').classed('opacity-30', false);
  };

  BubbleMap.prototype._render = function () {
    var self = this;
    if (!this.repoId) return;
    var url = this._apiUrl('/api/v1/bubblemap', { metric: this.metric, colorBy: this.colorBy });

    this._fetch(url).then(function (data) {
      self.data = data;
      self._draw(data);
    }).catch(function (err) {
      console.error('BubbleMap fetch error:', err);
    });
  };

  BubbleMap.prototype._draw = function (data) {
    var dims = this._dims();
    var self = this;

    var svg = this._ensureSvg();
    svg.selectAll('*').remove();
    var tip = this._ensureTooltip();

    var root = d3.hierarchy(data.tree || { name: 'root', children: [] })
      .sum(function (d) { return d.value || 0; })
      .sort(function (a, b) { return b.value - a.value; });

    var pack = d3.pack().size([dims.width - 20, dims.height - 40]).padding(3);
    pack(root);

    var colorScale = d3.scaleOrdinal(d3.schemeCategory10);

    var nodes = svg.selectAll('.bm-bubble')
      .data(root.descendants().filter(function (d) { return !d.children; }))
      .enter().append('g')
      .attr('class', 'bm-bubble')
      .attr('transform', function (d) { return 'translate(' + d.x + ',' + (d.y + 20) + ')'; });

    nodes.append('circle')
      .attr('r', function (d) { return d.r; })
      .attr('fill', function (d) { return colorScale(d.data.colorKey || d.data.name); })
      .attr('opacity', 0.75)
      .attr('stroke', '#fff').attr('stroke-width', 1)
      .on('mouseover', function (event, d) {
        self._showTooltip(tip,
          '<b>' + (d.data.path || d.data.name) + '</b><br>' +
          'Value: ' + d.value + '<br>' +
          (d.data.primaryContributor ? 'Owner: ' + d.data.primaryContributor : ''),
          event);
      })
      .on('mouseout', function () { self._hideTooltip(tip); })
      .on('click', function (event, d) {
        window.dispatchEvent(new CustomEvent('viz:file-selected', { detail: { file: d.data.path || d.data.name } }));
      });

    nodes.filter(function (d) { return d.r > 20; })
      .append('text')
      .attr('text-anchor', 'middle').attr('dy', '0.35em')
      .style('font-size', '9px').style('pointer-events', 'none')
      .text(function (d) { return (d.data.name || '').slice(0, Math.floor(d.r / 4)); });

    // Title
    svg.append('text').attr('x', dims.width / 2).attr('y', 16)
      .attr('text-anchor', 'middle').style('font-size', '14px').style('font-weight', 'bold')
      .text('Bubble Map');

    // Legend
    var legend = svg.append('g').attr('transform', 'translate(10,' + (dims.height - 80) + ')');
    var keys = [];
    root.leaves().forEach(function (d) {
      var k = d.data.colorKey || d.data.name;
      if (keys.indexOf(k) === -1 && keys.length < 8) keys.push(k);
    });
    keys.forEach(function (k, i) {
      legend.append('rect').attr('x', 0).attr('y', i * 16).attr('width', 10).attr('height', 10).attr('fill', colorScale(k));
      legend.append('text').attr('x', 14).attr('y', i * 16 + 9).style('font-size', '9px').text(k);
    });
  };

  window.BubbleMap = BubbleMap;
})();
