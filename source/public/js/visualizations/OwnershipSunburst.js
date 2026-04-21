/**
 * OwnershipSunburst — D3 sunburst chart.
 * Concentric rings by directory depth, colored by primary contributor.
 * Fetches from /api/v1/sunburst.
 */
(function () {
  'use strict';

  var d3 = window.d3;

  function OwnershipSunburst(containerId, appState) {
    window.VisualizationBase.call(this, containerId, appState);
  }

  OwnershipSunburst.prototype = Object.create(window.VisualizationBase.prototype);
  OwnershipSunburst.prototype.constructor = OwnershipSunburst;

  OwnershipSunburst.prototype.load = function (repoId, dateRange) {
    window.VisualizationBase.prototype.load.call(this, repoId, dateRange);
    this._render();
  };

  OwnershipSunburst.prototype.update = function (dateRange) {
    window.VisualizationBase.prototype.update.call(this, dateRange);
    this._render();
  };

  OwnershipSunburst.prototype.resize = function () { this._render(); };

  OwnershipSunburst.prototype.highlight = function (sel) {
    if (!sel || !sel.author) return;
    d3.select(this.container).selectAll('.sb-arc')
      .classed('opacity-30', function (d) { return d.data.primaryContributor !== sel.author; });
  };

  OwnershipSunburst.prototype.clearHighlight = function () {
    d3.select(this.container).selectAll('.sb-arc').classed('opacity-30', false);
  };

  OwnershipSunburst.prototype._render = function () {
    var self = this;
    if (!this.repoId) return;

    this._fetch(this._apiUrl('/api/v1/sunburst')).then(function (data) {
      self.data = data;
      self._draw(data);
    }).catch(function (err) {
      console.error('OwnershipSunburst fetch error:', err);
    });
  };

  OwnershipSunburst.prototype._draw = function (data) {
    var dims = this._dims();
    var radius = Math.min(dims.width, dims.height) / 2 - 20;
    var self = this;

    var svg = this._ensureSvg();
    svg.selectAll('*').remove();
    var g = svg.append('g').attr('transform', 'translate(' + dims.width / 2 + ',' + dims.height / 2 + ')');
    var tip = this._ensureTooltip();

    var root = d3.hierarchy(data.tree || { name: 'root', children: [] })
      .sum(function (d) { return d.size || 1; })
      .sort(function (a, b) { return b.value - a.value; });

    var partition = d3.partition().size([2 * Math.PI, radius]);
    partition(root);

    // Collect unique contributors for color mapping
    var contributors = [];
    root.each(function (d) {
      if (d.data.primaryContributor && contributors.indexOf(d.data.primaryContributor) === -1) {
        contributors.push(d.data.primaryContributor);
      }
    });
    var colorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(contributors);

    var arc = d3.arc()
      .startAngle(function (d) { return d.x0; })
      .endAngle(function (d) { return d.x1; })
      .innerRadius(function (d) { return d.y0; })
      .outerRadius(function (d) { return d.y1; });

    g.selectAll('.sb-arc')
      .data(root.descendants().filter(function (d) { return d.depth > 0; }))
      .enter().append('path')
      .attr('class', 'sb-arc')
      .attr('d', arc)
      .attr('fill', function (d) {
        return d.data.primaryContributor ? colorScale(d.data.primaryContributor) : '#ccc';
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 0.5)
      .on('mouseover', function (event, d) {
        var pct = d.data.ownershipPct ? (d.data.ownershipPct * 100).toFixed(1) + '%' : '';
        self._showTooltip(tip,
          '<b>' + (d.data.name || '') + '</b><br>' +
          'Owner: ' + (d.data.primaryContributor || 'N/A') + '<br>' +
          (pct ? 'Ownership: ' + pct : ''),
          event);
      })
      .on('mouseout', function () { self._hideTooltip(tip); })
      .on('click', function (event, d) {
        // Zoom into clicked segment
        var transition = g.transition().duration(500);
        g.selectAll('.sb-arc').transition(transition)
          .attrTween('d', function (node) {
            var xi = d3.interpolate(node.x0, Math.max(0, Math.min(2 * Math.PI, (node.x0 - d.x0) / (d.x1 - d.x0) * 2 * Math.PI)));
            return function () { return arc(node); };
          });
      });

    // Legend
    var legend = svg.append('g').attr('transform', 'translate(10, 20)');
    contributors.slice(0, 10).forEach(function (c, i) {
      legend.append('rect').attr('x', 0).attr('y', i * 18).attr('width', 12).attr('height', 12).attr('fill', colorScale(c));
      legend.append('text').attr('x', 16).attr('y', i * 18 + 10).style('font-size', '11px').text(c);
    });
  };

  window.OwnershipSunburst = OwnershipSunburst;
})();
