/**
 * GenomeSequence — D3 linear genome browser.
 * Horizontal time axis, files as colored tracks stacked vertically.
 * Change types by color (green/red/blue); band height by magnitude.
 * Fetches from /api/v1/commits (uses commit data directly).
 */
(function () {
  'use strict';

  var d3 = window.d3;

  function GenomeSequence(containerId, appState) {
    window.VisualizationBase.call(this, containerId, appState);
    this._zoom = null;
  }

  GenomeSequence.prototype = Object.create(window.VisualizationBase.prototype);
  GenomeSequence.prototype.constructor = GenomeSequence;

  GenomeSequence.prototype.load = function (repoId, dateRange) {
    window.VisualizationBase.prototype.load.call(this, repoId, dateRange);
    this._render();
  };

  GenomeSequence.prototype.update = function (dateRange) {
    window.VisualizationBase.prototype.update.call(this, dateRange);
    this._render();
  };

  GenomeSequence.prototype.resize = function () { this._render(); };

  GenomeSequence.prototype.scrubTo = function (idx) {
    if (idx == null || !this.data) return;
    var commits = this.data.commits || [];
    // Highlight the scrub position commit
    d3.select(this.container).selectAll('.gs-band')
      .attr('opacity', function (d) { return d.commitIdx === idx ? 1 : 0.5; });
  };

  GenomeSequence.prototype._render = function () {
    var self = this;
    if (!this.repoId) return;

    this._fetch(this._apiUrl('/api/v1/commits', { limit: 500 })).then(function (data) {
      self.data = data;
      self._draw(data);
    }).catch(function (err) {
      console.error('GenomeSequence fetch error:', err);
    });
  };

  GenomeSequence.prototype._draw = function (data) {
    var dims = this._dims();
    var margin = { top: 40, right: 20, bottom: 40, left: 150 };
    var w = dims.width - margin.left - margin.right;
    var h = dims.height - margin.top - margin.bottom;
    var self = this;

    var commits = data.commits || data.items || [];

    // Collect unique file paths
    var fileSet = {};
    commits.forEach(function (c) {
      (c.changedFiles || []).forEach(function (f) { fileSet[f.path] = true; });
    });
    var filePaths = Object.keys(fileSet).sort().slice(0, 50); // Limit tracks

    var svg = this._ensureSvg();
    svg.selectAll('*').remove();
    var tip = this._ensureTooltip();

    // Zoom
    var zoomG = svg.append('g');
    this._zoom = d3.zoom().scaleExtent([0.5, 20]).on('zoom', function (event) {
      zoomG.attr('transform', event.transform);
    });
    svg.call(this._zoom);

    var g = zoomG.append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    var dates = commits.map(function (c) { return new Date(c.commitDate || c.date); });
    var x = d3.scaleTime()
      .domain(d3.extent(dates) || [new Date(), new Date()])
      .range([0, w]);

    var y = d3.scaleBand().domain(filePaths).range([0, h]).padding(0.1);

    var changeColor = { added: '#22c55e', modified: '#3b82f6', deleted: '#ef4444' };

    // X axis
    g.append('g').attr('transform', 'translate(0,' + h + ')')
      .call(d3.axisBottom(x).ticks(10))
      .selectAll('text').style('font-size', '9px');

    // Y axis (file names)
    g.append('g').call(d3.axisLeft(y))
      .selectAll('text').style('font-size', '8px')
      .text(function (d) { return d.length > 25 ? '…' + d.slice(-24) : d; });

    // Bands for each file change
    var bandData = [];
    commits.forEach(function (c, ci) {
      var cDate = new Date(c.commitDate || c.date);
      (c.changedFiles || []).forEach(function (f) {
        if (filePaths.indexOf(f.path) === -1) return;
        bandData.push({
          file: f.path,
          date: cDate,
          changeType: f.changeType,
          additions: f.additions || 0,
          deletions: f.deletions || 0,
          commitIdx: ci,
          hash: c.commitHash || c.hash,
          author: c.authorName || c.author,
          message: c.message
        });
      });
    });

    g.selectAll('.gs-band')
      .data(bandData)
      .enter().append('rect')
      .attr('class', 'gs-band')
      .attr('x', function (d) { return x(d.date) - 2; })
      .attr('y', function (d) { return y(d.file); })
      .attr('width', 4)
      .attr('height', y.bandwidth())
      .attr('fill', function (d) { return changeColor[d.changeType] || '#999'; })
      .attr('opacity', 0.8)
      .on('mouseover', function (event, d) {
        self._showTooltip(tip,
          '<b>' + d.file + '</b><br>' +
          d.changeType + ' | ' + d.author + '<br>' +
          d.hash.slice(0, 7) + ' — ' + d.message.slice(0, 60) + '<br>' +
          '+' + d.additions + ' -' + d.deletions,
          event);
      })
      .on('mouseout', function () { self._hideTooltip(tip); })
      .on('click', function (event, d) {
        window.dispatchEvent(new CustomEvent('viz:commit-selected', { detail: { hash: d.hash } }));
      });

    // Title
    svg.append('text').attr('x', dims.width / 2).attr('y', 20)
      .attr('text-anchor', 'middle').style('font-size', '14px').style('font-weight', 'bold')
      .text('Genome Sequence');

    // Legend
    var legend = svg.append('g').attr('transform', 'translate(' + (dims.width - 160) + ', 30)');
    [['Added', '#22c55e'], ['Modified', '#3b82f6'], ['Deleted', '#ef4444']].forEach(function (item, i) {
      legend.append('rect').attr('x', 0).attr('y', i * 18).attr('width', 12).attr('height', 12).attr('fill', item[1]);
      legend.append('text').attr('x', 16).attr('y', i * 18 + 10).style('font-size', '11px').text(item[0]);
    });
  };

  window.GenomeSequence = GenomeSequence;
})();
