/**
 * CommitPulse — D3 line chart.
 * Commits over time with daily/weekly/monthly granularity toggle.
 * Highlights spikes (>2σ). Fetches from /api/v1/pulse.
 */
(function () {
  'use strict';

  var d3 = window.d3;

  function CommitPulse(containerId, appState) {
    window.VisualizationBase.call(this, containerId, appState);
    this.granularity = 'daily'; // 'daily' | 'weekly' | 'monthly'
  }

  CommitPulse.prototype = Object.create(window.VisualizationBase.prototype);
  CommitPulse.prototype.constructor = CommitPulse;

  CommitPulse.prototype.load = function (repoId, dateRange) {
    window.VisualizationBase.prototype.load.call(this, repoId, dateRange);
    this._render();
  };

  CommitPulse.prototype.update = function (dateRange) {
    window.VisualizationBase.prototype.update.call(this, dateRange);
    this._render();
  };

  CommitPulse.prototype.resize = function () {
    this._render();
  };

  CommitPulse.prototype.setGranularity = function (g) {
    this.granularity = g;
    this._render();
  };

  CommitPulse.prototype._render = function () {
    var self = this;
    if (!this.repoId) return;
    var url = this._apiUrl('/api/v1/pulse', { granularity: this.granularity });

    this._fetch(url)
      .then(function (data) {
        self.data = data;
        self._draw(data);
      })
      .catch(function (err) {
        console.error('CommitPulse fetch error:', err);
      });
  };

  CommitPulse.prototype._draw = function (data) {
    var dims = this._dims();
    var margin = { top: 40, right: 30, bottom: 50, left: 50 };
    var w = dims.width - margin.left - margin.right;
    var h = dims.height - margin.top - margin.bottom;
    var self = this;

    var points = (data.series || []).map(function (d) {
      return { date: new Date(d.date), count: d.count, spike: !!d.spike };
    });

    var svg = this._ensureSvg();
    svg.selectAll('*').remove();
    var g = svg.append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
    var tip = this._ensureTooltip();

    var x = d3
      .scaleTime()
      .domain(
        d3.extent(points, function (d) {
          return d.date;
        }) || [new Date(), new Date()]
      )
      .range([0, w]);

    var y = d3
      .scaleLinear()
      .domain([
        0,
        d3.max(points, function (d) {
          return d.count;
        }) || 1
      ])
      .nice()
      .range([h, 0]);

    // Axes
    g.append('g')
      .attr('transform', 'translate(0,' + h + ')')
      .call(d3.axisBottom(x).ticks(8))
      .selectAll('text')
      .style('font-size', '10px');
    g.append('g').call(d3.axisLeft(y).ticks(6)).selectAll('text').style('font-size', '10px');

    // Line
    var line = d3
      .line()
      .x(function (d) {
        return x(d.date);
      })
      .y(function (d) {
        return y(d.count);
      })
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(points)
      .attr('fill', 'none')
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', 2)
      .attr('d', line);

    // Area fill
    var area = d3
      .area()
      .x(function (d) {
        return x(d.date);
      })
      .y0(h)
      .y1(function (d) {
        return y(d.count);
      })
      .curve(d3.curveMonotoneX);

    g.append('path').datum(points).attr('fill', '#3b82f6').attr('opacity', 0.1).attr('d', area);

    // Data points
    g.selectAll('.cp-dot')
      .data(points)
      .enter()
      .append('circle')
      .attr('class', 'cp-dot')
      .attr('cx', function (d) {
        return x(d.date);
      })
      .attr('cy', function (d) {
        return y(d.count);
      })
      .attr('r', function (d) {
        return d.spike ? 6 : 3;
      })
      .attr('fill', function (d) {
        return d.spike ? '#ef4444' : '#3b82f6';
      })
      .attr('stroke', function (d) {
        return d.spike ? '#dc2626' : 'none';
      })
      .attr('stroke-width', function (d) {
        return d.spike ? 2 : 0;
      })
      .on('mouseover', function (event, d) {
        self._showTooltip(
          tip,
          '<b>' +
            d.date.toLocaleDateString() +
            '</b><br>Commits: ' +
            d.count +
            (d.spike ? '<br><span style="color:#ef4444">⚡ Spike</span>' : ''),
          event
        );
      })
      .on('mouseout', function () {
        self._hideTooltip(tip);
      })
      .on('click', function (event, d) {
        var iso = d.date.toISOString().slice(0, 10);
        window.AppState.setDateRange(iso, iso);
      });

    // Title
    svg
      .append('text')
      .attr('x', dims.width / 2)
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('font-weight', 'bold')
      .text('Commit Pulse');

    // Y label
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -40)
      .attr('x', -h / 2)
      .attr('text-anchor', 'middle')
      .style('font-size', '11px')
      .text('Commits');
  };

  window.CommitPulse = CommitPulse;
})();
