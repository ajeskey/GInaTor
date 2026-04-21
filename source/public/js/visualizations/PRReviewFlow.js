/**
 * PRReviewFlow — D3 Sankey diagram.
 * Authors → Reviewers → Merge targets.
 * Fetches from /api/v1/pr-flow.
 */
(function () {
  'use strict';

  var d3 = window.d3;

  function PRReviewFlow(containerId, appState) {
    window.VisualizationBase.call(this, containerId, appState);
  }

  PRReviewFlow.prototype = Object.create(window.VisualizationBase.prototype);
  PRReviewFlow.prototype.constructor = PRReviewFlow;

  PRReviewFlow.prototype.load = function (repoId, dateRange) {
    window.VisualizationBase.prototype.load.call(this, repoId, dateRange);
    this._render();
  };

  PRReviewFlow.prototype.update = function (dateRange) {
    window.VisualizationBase.prototype.update.call(this, dateRange);
    this._render();
  };

  PRReviewFlow.prototype.resize = function () { this._render(); };

  PRReviewFlow.prototype._render = function () {
    var self = this;
    if (!this.repoId) return;

    this._fetch(this._apiUrl('/api/v1/pr-flow')).then(function (data) {
      self.data = data;
      if (data.unsupported) {
        self._drawUnsupported();
      } else {
        self._draw(data);
      }
    }).catch(function (err) {
      console.error('PRReviewFlow fetch error:', err);
    });
  };

  PRReviewFlow.prototype._drawUnsupported = function () {
    var dims = this._dims();
    var svg = this._ensureSvg();
    svg.selectAll('*').remove();
    svg.append('text').attr('x', dims.width / 2).attr('y', dims.height / 2)
      .attr('text-anchor', 'middle').style('font-size', '16px').style('fill', '#999')
      .text('PR Review Flow is available for GitHub and GitLab repositories only.');
  };

  PRReviewFlow.prototype._draw = function (data) {
    var dims = this._dims();
    var margin = { top: 40, right: 30, bottom: 20, left: 30 };
    var w = dims.width - margin.left - margin.right;
    var h = dims.height - margin.top - margin.bottom;
    var self = this;

    var svg = this._ensureSvg();
    svg.selectAll('*').remove();
    var g = svg.append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
    var tip = this._ensureTooltip();

    var nodes = data.nodes || [];
    var links = data.links || [];

    // Simple Sankey-like layout (manual since d3-sankey may not be loaded)
    // Group nodes into columns: authors (0), reviewers (1), targets (2)
    var columns = [[], [], []];
    nodes.forEach(function (n) {
      var col = n.type === 'author' ? 0 : n.type === 'reviewer' ? 1 : 2;
      columns[col].push(n);
    });

    var colWidth = w / 3;
    var nodeMap = {};
    columns.forEach(function (col, ci) {
      var yStep = h / (col.length + 1);
      col.forEach(function (n, ni) {
        n._x = ci * colWidth + colWidth / 2;
        n._y = (ni + 1) * yStep;
        nodeMap[n.id] = n;
      });
    });

    var color = d3.scaleOrdinal(d3.schemeCategory10);
    var maxVal = d3.max(links, function (l) { return l.value; }) || 1;

    // Draw links as curved paths
    links.forEach(function (link) {
      var src = nodeMap[link.source];
      var tgt = nodeMap[link.target];
      if (!src || !tgt) return;
      var thickness = Math.max(2, (link.value / maxVal) * 20);

      g.append('path')
        .attr('d', 'M' + src._x + ',' + src._y +
          ' C' + (src._x + colWidth / 2) + ',' + src._y +
          ' ' + (tgt._x - colWidth / 2) + ',' + tgt._y +
          ' ' + tgt._x + ',' + tgt._y)
        .attr('fill', 'none')
        .attr('stroke', color(link.source))
        .attr('stroke-width', thickness)
        .attr('opacity', 0.3)
        .on('mouseover', function (event) {
          d3.select(this).attr('opacity', 0.7);
          self._showTooltip(tip,
            '<b>' + link.source + ' → ' + link.target + '</b><br>PRs: ' + link.value,
            event);
        })
        .on('mouseout', function () {
          d3.select(this).attr('opacity', 0.3);
          self._hideTooltip(tip);
        });
    });

    // Draw nodes
    nodes.forEach(function (n) {
      g.append('circle')
        .attr('cx', n._x).attr('cy', n._y).attr('r', 12)
        .attr('fill', color(n.id)).attr('stroke', '#fff').attr('stroke-width', 2)
        .on('mouseover', function (event) {
          self._showTooltip(tip, '<b>' + n.id + '</b><br>Type: ' + n.type, event);
        })
        .on('mouseout', function () { self._hideTooltip(tip); })
        .on('click', function () {
          window.dispatchEvent(new CustomEvent('viz:author-selected', { detail: { author: n.id } }));
        });

      g.append('text')
        .attr('x', n._x).attr('y', n._y + 20)
        .attr('text-anchor', 'middle').style('font-size', '10px')
        .text(n.id.length > 15 ? n.id.slice(0, 15) + '…' : n.id);
    });

    // Column headers
    ['Authors', 'Reviewers', 'Merge Targets'].forEach(function (label, i) {
      g.append('text')
        .attr('x', i * colWidth + colWidth / 2).attr('y', -10)
        .attr('text-anchor', 'middle').style('font-size', '12px').style('font-weight', 'bold')
        .text(label);
    });

    // Title
    svg.append('text').attr('x', dims.width / 2).attr('y', 20)
      .attr('text-anchor', 'middle').style('font-size', '14px').style('font-weight', 'bold')
      .text('PR Review Flow');
  };

  window.PRReviewFlow = PRReviewFlow;
})();
