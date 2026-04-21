/**
 * FileTypeDistribution — D3 donut chart.
 * Segments by file extension, sized by change count.
 * Fetches from /api/v1/filetypes.
 */
(function () {
  'use strict';

  var d3 = window.d3;

  function FileTypeDistribution(containerId, appState) {
    window.VisualizationBase.call(this, containerId, appState);
  }

  FileTypeDistribution.prototype = Object.create(window.VisualizationBase.prototype);
  FileTypeDistribution.prototype.constructor = FileTypeDistribution;

  FileTypeDistribution.prototype.load = function (repoId, dateRange) {
    window.VisualizationBase.prototype.load.call(this, repoId, dateRange);
    this._render();
  };

  FileTypeDistribution.prototype.update = function (dateRange) {
    window.VisualizationBase.prototype.update.call(this, dateRange);
    this._render();
  };

  FileTypeDistribution.prototype.resize = function () {
    this._render();
  };

  FileTypeDistribution.prototype._render = function () {
    var self = this;
    if (!this.repoId) return;

    this._fetch(this._apiUrl('/api/v1/filetypes'))
      .then(function (data) {
        self.data = data;
        self._draw(data);
      })
      .catch(function (err) {
        console.error('FileTypeDistribution fetch error:', err);
      });
  };

  FileTypeDistribution.prototype._draw = function (data) {
    var dims = this._dims();
    var radius = Math.min(dims.width, dims.height) / 2 - 60;
    var innerRadius = radius * 0.5;
    var self = this;

    var types = data.types || [];

    var svg = this._ensureSvg();
    svg.selectAll('*').remove();
    var g = svg
      .append('g')
      .attr('transform', 'translate(' + dims.width / 2 + ',' + dims.height / 2 + ')');
    var tip = this._ensureTooltip();

    var color = d3.scaleOrdinal(d3.schemeCategory10);
    var pie = d3
      .pie()
      .value(function (d) {
        return d.count;
      })
      .sort(null);
    var arc = d3.arc().innerRadius(innerRadius).outerRadius(radius);
    var arcHover = d3
      .arc()
      .innerRadius(innerRadius)
      .outerRadius(radius + 8);

    var arcs = g
      .selectAll('.ftd-arc')
      .data(pie(types))
      .enter()
      .append('g')
      .attr('class', 'ftd-arc');

    arcs
      .append('path')
      .attr('d', arc)
      .attr('fill', function (d) {
        return color(d.data.extension);
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .on('mouseover', function (event, d) {
        d3.select(this).transition().duration(150).attr('d', arcHover);
        self._showTooltip(
          tip,
          '<b>' + d.data.extension + '</b><br>Changes: ' + d.data.count,
          event
        );
      })
      .on('mouseout', function (_event, _d) {
        d3.select(this).transition().duration(150).attr('d', arc);
        self._hideTooltip(tip);
      })
      .on('click', function (event, d) {
        window.dispatchEvent(
          new CustomEvent('viz:filetype-selected', { detail: { extension: d.data.extension } })
        );
      });

    // Labels on larger segments
    arcs
      .filter(function (d) {
        return d.endAngle - d.startAngle > 0.2;
      })
      .append('text')
      .attr('transform', function (d) {
        return 'translate(' + arc.centroid(d) + ')';
      })
      .attr('text-anchor', 'middle')
      .style('font-size', '11px')
      .style('fill', '#fff')
      .text(function (d) {
        return d.data.extension;
      });

    // Center label
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .style('font-size', '16px')
      .style('font-weight', 'bold')
      .text(
        d3.sum(types, function (d) {
          return d.count;
        }) + ' changes'
      );

    // Legend
    var legend = svg.append('g').attr('transform', 'translate(' + (dims.width - 120) + ', 30)');
    types.slice(0, 12).forEach(function (t, i) {
      legend
        .append('rect')
        .attr('x', 0)
        .attr('y', i * 18)
        .attr('width', 12)
        .attr('height', 12)
        .attr('fill', color(t.extension));
      legend
        .append('text')
        .attr('x', 16)
        .attr('y', i * 18 + 10)
        .style('font-size', '10px')
        .text(t.extension + ' (' + t.count + ')');
    });
  };

  window.FileTypeDistribution = FileTypeDistribution;
})();
