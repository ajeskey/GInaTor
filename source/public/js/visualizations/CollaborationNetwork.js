/**
 * CollaborationNetwork — D3 force-directed graph.
 * Nodes = authors (sized by commits), edges = shared files (thickness by count).
 * Fetches from /api/v1/collaboration.
 */
(function () {
  'use strict';

  var d3 = window.d3;

  function CollaborationNetwork(containerId, appState) {
    window.VisualizationBase.call(this, containerId, appState);
    this._simulation = null;
  }

  CollaborationNetwork.prototype = Object.create(window.VisualizationBase.prototype);
  CollaborationNetwork.prototype.constructor = CollaborationNetwork;

  CollaborationNetwork.prototype.load = function (repoId, dateRange) {
    window.VisualizationBase.prototype.load.call(this, repoId, dateRange);
    this._render();
  };

  CollaborationNetwork.prototype.update = function (dateRange) {
    window.VisualizationBase.prototype.update.call(this, dateRange);
    this._render();
  };

  CollaborationNetwork.prototype.resize = function () { this._render(); };

  CollaborationNetwork.prototype.highlight = function (sel) {
    if (!sel || !sel.author) return;
    d3.select(this.container).selectAll('.cn-node')
      .classed('opacity-30', function (d) { return d.id !== sel.author; });
  };

  CollaborationNetwork.prototype.clearHighlight = function () {
    d3.select(this.container).selectAll('.cn-node').classed('opacity-30', false);
  };

  CollaborationNetwork.prototype.destroy = function () {
    if (this._simulation) this._simulation.stop();
    window.VisualizationBase.prototype.destroy.call(this);
  };

  CollaborationNetwork.prototype._render = function () {
    var self = this;
    if (!this.repoId) return;

    this._fetch(this._apiUrl('/api/v1/collaboration')).then(function (data) {
      self.data = data;
      self._draw(data);
    }).catch(function (err) {
      console.error('CollaborationNetwork fetch error:', err);
    });
  };

  CollaborationNetwork.prototype._draw = function (data) {
    var dims = this._dims();
    var self = this;

    if (this._simulation) this._simulation.stop();

    var svg = this._ensureSvg();
    svg.selectAll('*').remove();
    var tip = this._ensureTooltip();

    var nodes = (data.nodes || []).map(function (n) { return Object.assign({}, n); });
    var links = (data.edges || []).map(function (e) { return Object.assign({}, e); });

    var maxCommits = d3.max(nodes, function (n) { return n.commits || 1; }) || 1;
    var maxWeight = d3.max(links, function (l) { return l.weight || 1; }) || 1;
    var rScale = d3.scaleSqrt().domain([0, maxCommits]).range([5, 30]);
    var colorScale = d3.scaleOrdinal(d3.schemeCategory10);

    this._simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(function (d) { return d.id; }).distance(100))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(dims.width / 2, dims.height / 2))
      .force('collision', d3.forceCollide().radius(function (d) { return rScale(d.commits || 1) + 5; }));

    // Links
    var linkSel = svg.append('g').selectAll('.cn-link')
      .data(links).enter().append('line')
      .attr('class', 'cn-link')
      .attr('stroke', '#999').attr('stroke-opacity', 0.5)
      .attr('stroke-width', function (d) { return Math.max(1, (d.weight / maxWeight) * 6); });

    // Nodes
    var nodeSel = svg.append('g').selectAll('.cn-node')
      .data(nodes).enter().append('circle')
      .attr('class', 'cn-node')
      .attr('r', function (d) { return rScale(d.commits || 1); })
      .attr('fill', function (d) { return colorScale(d.id); })
      .attr('stroke', '#fff').attr('stroke-width', 2)
      .on('mouseover', function (event, d) {
        self._showTooltip(tip, '<b>' + d.id + '</b><br>Commits: ' + (d.commits || 0), event);
      })
      .on('mouseout', function () { self._hideTooltip(tip); })
      .on('click', function (event, d) {
        window.dispatchEvent(new CustomEvent('viz:author-selected', { detail: { author: d.id } }));
      })
      .call(d3.drag()
        .on('start', function (event, d) {
          if (!event.active) self._simulation.alphaTarget(0.3).restart();
          d.fx = d.x; d.fy = d.y;
        })
        .on('drag', function (event, d) { d.fx = event.x; d.fy = event.y; })
        .on('end', function (event, d) {
          if (!event.active) self._simulation.alphaTarget(0);
          d.fx = null; d.fy = null;
        }));

    // Labels
    var labels = svg.append('g').selectAll('.cn-label')
      .data(nodes).enter().append('text')
      .attr('class', 'cn-label')
      .style('font-size', '10px').style('pointer-events', 'none')
      .attr('text-anchor', 'middle').attr('dy', '0.35em')
      .text(function (d) { return d.id.length > 12 ? d.id.slice(0, 12) + '…' : d.id; });

    this._simulation.on('tick', function () {
      linkSel
        .attr('x1', function (d) { return d.source.x; }).attr('y1', function (d) { return d.source.y; })
        .attr('x2', function (d) { return d.target.x; }).attr('y2', function (d) { return d.target.y; });
      nodeSel.attr('cx', function (d) { return d.x; }).attr('cy', function (d) { return d.y; });
      labels.attr('x', function (d) { return d.x; }).attr('y', function (d) { return d.y; });
    });

    // Title
    svg.append('text').attr('x', dims.width / 2).attr('y', 20)
      .attr('text-anchor', 'middle').style('font-size', '14px').style('font-weight', 'bold')
      .text('Author Collaboration Network');
  };

  window.CollaborationNetwork = CollaborationNetwork;
})();
