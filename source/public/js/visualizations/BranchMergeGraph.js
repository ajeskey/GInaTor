/**
 * BranchMergeGraph — D3 network graph.
 * Branches as parallel lanes, merge/divergence edges.
 * Fetches from /api/v1/branches.
 */
(function () {
  'use strict';

  var d3 = window.d3;

  function BranchMergeGraph(containerId, appState) {
    window.VisualizationBase.call(this, containerId, appState);
    this._zoom = null;
  }

  BranchMergeGraph.prototype = Object.create(window.VisualizationBase.prototype);
  BranchMergeGraph.prototype.constructor = BranchMergeGraph;

  BranchMergeGraph.prototype.load = function (repoId, dateRange) {
    window.VisualizationBase.prototype.load.call(this, repoId, dateRange);
    this._render();
  };

  BranchMergeGraph.prototype.update = function (dateRange) {
    window.VisualizationBase.prototype.update.call(this, dateRange);
    this._render();
  };

  BranchMergeGraph.prototype.resize = function () { this._render(); };

  BranchMergeGraph.prototype._render = function () {
    var self = this;
    if (!this.repoId) return;

    this._fetch(this._apiUrl('/api/v1/branches')).then(function (data) {
      self.data = data;
      self._draw(data);
    }).catch(function (err) {
      console.error('BranchMergeGraph fetch error:', err);
    });
  };

  BranchMergeGraph.prototype._draw = function (data) {
    var dims = this._dims();
    var margin = { top: 40, right: 20, bottom: 40, left: 80 };
    var w = dims.width - margin.left - margin.right;
    var h = dims.height - margin.top - margin.bottom;
    var self = this;

    var svg = this._ensureSvg();
    svg.selectAll('*').remove();
    var tip = this._ensureTooltip();

    // Zoom support
    var zoomG = svg.append('g');
    this._zoom = d3.zoom().scaleExtent([0.3, 5]).on('zoom', function (event) {
      zoomG.attr('transform', event.transform);
    });
    svg.call(this._zoom);

    var g = zoomG.append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    var branches = data.branches || [];
    var commits = data.commits || [];
    var edges = data.edges || [];

    // Assign lanes to branches
    var branchNames = branches.map(function (b) { return b.name; });
    var laneScale = d3.scaleBand().domain(branchNames).range([0, h]).padding(0.3);
    var colorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(branchNames);

    // Time scale
    var dates = commits.map(function (c) { return new Date(c.date); });
    var xScale = d3.scaleTime()
      .domain(d3.extent(dates).map(function (d) { return d || new Date(); }))
      .range([0, w]);

    // X axis
    g.append('g').attr('transform', 'translate(0,' + h + ')')
      .call(d3.axisBottom(xScale).ticks(8))
      .selectAll('text').style('font-size', '10px');

    // Branch lane labels
    branchNames.forEach(function (name) {
      g.append('text')
        .attr('x', -10).attr('y', laneScale(name) + laneScale.bandwidth() / 2)
        .attr('text-anchor', 'end').attr('dominant-baseline', 'middle')
        .style('font-size', '11px').style('fill', colorScale(name))
        .text(name);

      // Lane line
      g.append('line')
        .attr('x1', 0).attr('x2', w)
        .attr('y1', laneScale(name) + laneScale.bandwidth() / 2)
        .attr('y2', laneScale(name) + laneScale.bandwidth() / 2)
        .attr('stroke', colorScale(name)).attr('stroke-width', 1.5).attr('stroke-dasharray', '4,4').attr('opacity', 0.3);
    });

    // Edges (merge/diverge lines)
    edges.forEach(function (edge) {
      var src = commits.find(function (c) { return c.hash === edge.source; });
      var tgt = commits.find(function (c) { return c.hash === edge.target; });
      if (!src || !tgt) return;
      g.append('line')
        .attr('x1', xScale(new Date(src.date)))
        .attr('y1', laneScale(src.branch) + laneScale.bandwidth() / 2)
        .attr('x2', xScale(new Date(tgt.date)))
        .attr('y2', laneScale(tgt.branch) + laneScale.bandwidth() / 2)
        .attr('stroke', '#999').attr('stroke-width', 1.5).attr('opacity', 0.6);
    });

    // Commit nodes
    g.selectAll('.bm-commit')
      .data(commits)
      .enter().append('circle')
      .attr('class', 'bm-commit')
      .attr('cx', function (d) { return xScale(new Date(d.date)); })
      .attr('cy', function (d) { return laneScale(d.branch) + laneScale.bandwidth() / 2; })
      .attr('r', 5)
      .attr('fill', function (d) { return colorScale(d.branch); })
      .attr('stroke', '#fff').attr('stroke-width', 1.5)
      .on('mouseover', function (event, d) {
        self._showTooltip(tip,
          '<b>' + d.hash.slice(0, 7) + '</b><br>' +
          d.author + '<br>' + d.message.slice(0, 60) + '<br>' + d.date,
          event);
      })
      .on('mouseout', function () { self._hideTooltip(tip); })
      .on('click', function (event, d) {
        window.dispatchEvent(new CustomEvent('viz:commit-selected', { detail: { hash: d.hash } }));
      });

    // Title
    svg.append('text').attr('x', dims.width / 2).attr('y', 20)
      .attr('text-anchor', 'middle').style('font-size', '14px').style('font-weight', 'bold')
      .text('Branch & Merge Graph');
  };

  window.BranchMergeGraph = BranchMergeGraph;
})();
