/**
 * ImpactViz — D3 radial burst.
 * Central circle sized by total lines changed, tendrils to affected files.
 * Fetches from /api/v1/impact.
 */
(function () {
  'use strict';

  var _d3 = window.d3;

  function ImpactViz(containerId, appState) {
    window.VisualizationBase.call(this, containerId, appState);
    this._currentCommitIdx = 0;
  }

  ImpactViz.prototype = Object.create(window.VisualizationBase.prototype);
  ImpactViz.prototype.constructor = ImpactViz;

  ImpactViz.prototype.load = function (repoId, dateRange) {
    window.VisualizationBase.prototype.load.call(this, repoId, dateRange);
    this._render();
  };

  ImpactViz.prototype.update = function (dateRange) {
    window.VisualizationBase.prototype.update.call(this, dateRange);
    this._render();
  };

  ImpactViz.prototype.resize = function () { this._render(); };

  ImpactViz.prototype.scrubTo = function (idx) {
    if (idx == null || !this.data) return;
    this._currentCommitIdx = idx;
    var commits = this.data.commits || [];
    if (commits[idx]) this._drawCommit(commits[idx]);
  };

  ImpactViz.prototype._render = function () {
    var self = this;
    if (!this.repoId) return;

    this._fetch(this._apiUrl('/api/v1/impact')).then(function (data) {
      self.data = data;
      var commits = data.commits || [];
      if (commits.length > 0) self._drawCommit(commits[0]);
      else self._drawEmpty();
    }).catch(function (err) {
      console.error('ImpactViz fetch error:', err);
    });
  };

  ImpactViz.prototype._drawEmpty = function () {
    var svg = this._ensureSvg();
    svg.selectAll('*').remove();
    svg.append('text').attr('x', this._dims().width / 2).attr('y', this._dims().height / 2)
      .attr('text-anchor', 'middle').style('font-size', '14px').style('fill', '#999')
      .text('No commit data available');
  };

  ImpactViz.prototype._drawCommit = function (commit) {
    var dims = this._dims();
    var cx = dims.width / 2;
    var cy = dims.height / 2;
    var maxRadius = Math.min(cx, cy) - 40;
    var self = this;

    var svg = this._ensureSvg();
    svg.selectAll('*').remove();
    var g = svg.append('g');
    var tip = this._ensureTooltip();

    var files = commit.files || [];
    var totalLines = (commit.additions || 0) + (commit.deletions || 0);
    var centerR = Math.max(15, Math.min(50, Math.sqrt(totalLines) * 2));

    var changeColor = { added: '#22c55e', modified: '#3b82f6', deleted: '#ef4444' };

    // Central commit circle
    g.append('circle')
      .attr('cx', cx).attr('cy', cy).attr('r', centerR)
      .attr('fill', '#6366f1').attr('opacity', 0.8)
      .on('mouseover', function (event) {
        self._showTooltip(tip,
          '<b>' + commit.hash.slice(0, 7) + '</b><br>' +
          commit.author + '<br>' + commit.message.slice(0, 80) + '<br>' +
          '+' + (commit.additions || 0) + ' -' + (commit.deletions || 0),
          event);
      })
      .on('mouseout', function () { self._hideTooltip(tip); });

    // Tendrils to files
    var angleStep = files.length > 0 ? (2 * Math.PI) / files.length : 0;
    files.forEach(function (file, i) {
      var angle = i * angleStep - Math.PI / 2;
      var fileChanges = (file.additions || 0) + (file.deletions || 0);
      var tendrilLen = Math.max(30, Math.min(maxRadius, Math.sqrt(fileChanges) * 10));
      var ex = cx + Math.cos(angle) * tendrilLen;
      var ey = cy + Math.sin(angle) * tendrilLen;
      var color = changeColor[file.changeType] || '#999';

      // Tendril line
      g.append('line')
        .attr('x1', cx).attr('y1', cy).attr('x2', ex).attr('y2', ey)
        .attr('stroke', color).attr('stroke-width', Math.max(1, Math.log2(fileChanges + 1)))
        .attr('opacity', 0.7);

      // File node
      g.append('circle')
        .attr('cx', ex).attr('cy', ey)
        .attr('r', Math.max(3, Math.min(12, Math.sqrt(fileChanges))))
        .attr('fill', color).attr('opacity', 0.8)
        .on('mouseover', function (event) {
          self._showTooltip(tip,
            '<b>' + file.path + '</b><br>' +
            file.changeType + '<br>+' + (file.additions || 0) + ' -' + (file.deletions || 0),
            event);
        })
        .on('mouseout', function () { self._hideTooltip(tip); });
    });

    // Title
    svg.append('text').attr('x', dims.width / 2).attr('y', 20)
      .attr('text-anchor', 'middle').style('font-size', '14px').style('font-weight', 'bold')
      .text('Impact Visualization — ' + commit.hash.slice(0, 7));
  };

  window.ImpactViz = ImpactViz;
})();
