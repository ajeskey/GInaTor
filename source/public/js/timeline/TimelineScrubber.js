/**
 * TimelineScrubber — D3 stacked area chart with range sliders and scrub mode.
 * Renders additions (green), deletions (red), modifications (blue) as stacked areas.
 * Left/right slider handles for date range selection.
 * Scrub mode: click middle area to enter, drag position indicator through commits.
 * Dispatches date-range-changed and scrub-position-changed events.
 * Synchronizes with repository selector via repo-changed event.
 *
 * Requirements: 13.1–13.13
 */
(function () {
  'use strict';

  var container = document.getElementById('timeline-scrubber');
  if (!container) return;

  // Ensure D3 is available
  var d3 = window.d3;
  if (!d3) return;

  var margin = { top: 10, right: 20, bottom: 24, left: 20 };
  var height = 100;
  var width = container.clientWidth || 800;
  var chartWidth = width - margin.left - margin.right;
  var chartHeight = height - margin.top - margin.bottom;

  var svg = null;
  var xScale = null;
  var yScale = null;
  var buckets = [];
  var commits = [];
  var currentRepoId = null;
  var rangeFrom = null;
  var rangeTo = null;
  var fullFrom = null;
  var fullTo = null;
  var scrubMode = false;
  var scrubIndex = null;

  // DOM elements for date labels
  var leftDateLabel = null;
  var rightDateLabel = null;
  var selectAllBtn = null;

  /**
   * Initialize the SVG and controls.
   */
  function init() {
    container.innerHTML = '';
    width = container.clientWidth || 800;
    chartWidth = width - margin.left - margin.right;
    chartHeight = height - margin.top - margin.bottom;

    // Controls bar
    var controls = document.createElement('div');
    controls.className = 'flex items-center justify-between text-xs px-2 mb-1';

    leftDateLabel = document.createElement('span');
    leftDateLabel.className = 'text-xs font-mono';
    leftDateLabel.textContent = '--';

    rightDateLabel = document.createElement('span');
    rightDateLabel.className = 'text-xs font-mono';
    rightDateLabel.textContent = '--';

    selectAllBtn = document.createElement('button');
    selectAllBtn.className = 'btn btn-xs btn-ghost';
    selectAllBtn.textContent = 'Select All';
    selectAllBtn.addEventListener('click', resetRange);

    controls.appendChild(leftDateLabel);
    controls.appendChild(selectAllBtn);
    controls.appendChild(rightDateLabel);
    container.appendChild(controls);

    // SVG
    svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    // Scales
    xScale = d3.scaleTime().range([0, chartWidth]);
    yScale = d3.scaleLinear().range([chartHeight, 0]);

    // Clip path
    svg.append('defs')
      .append('clipPath')
      .attr('id', 'timeline-clip')
      .append('rect')
      .attr('width', chartWidth)
      .attr('height', chartHeight);

    // Chart group
    svg.append('g').attr('class', 'chart-area').attr('clip-path', 'url(#timeline-clip)');

    // X axis
    svg.append('g')
      .attr('class', 'x-axis')
      .attr('transform', 'translate(0,' + chartHeight + ')');

    // Left slider handle
    svg.append('rect')
      .attr('class', 'slider-left')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', 6)
      .attr('height', chartHeight)
      .attr('fill', 'rgba(100,100,100,0.6)')
      .attr('cursor', 'ew-resize')
      .call(d3.drag().on('drag', onDragLeft));

    // Right slider handle
    svg.append('rect')
      .attr('class', 'slider-right')
      .attr('x', chartWidth - 6)
      .attr('y', 0)
      .attr('width', 6)
      .attr('height', chartHeight)
      .attr('fill', 'rgba(100,100,100,0.6)')
      .attr('cursor', 'ew-resize')
      .call(d3.drag().on('drag', onDragRight));

    // Shaded regions outside selection
    svg.append('rect').attr('class', 'shade-left')
      .attr('y', 0).attr('height', chartHeight)
      .attr('fill', 'rgba(0,0,0,0.15)').attr('pointer-events', 'none');

    svg.append('rect').attr('class', 'shade-right')
      .attr('y', 0).attr('height', chartHeight)
      .attr('fill', 'rgba(0,0,0,0.15)').attr('pointer-events', 'none');

    // Scrub indicator
    svg.append('line')
      .attr('class', 'scrub-indicator')
      .attr('y1', 0)
      .attr('y2', chartHeight)
      .attr('stroke', '#f59e0b')
      .attr('stroke-width', 2)
      .attr('display', 'none');

    // Middle area click for scrub mode
    svg.append('rect')
      .attr('class', 'scrub-area')
      .attr('y', 0)
      .attr('height', chartHeight)
      .attr('fill', 'transparent')
      .attr('cursor', 'pointer')
      .on('click', onMiddleClick)
      .call(d3.drag().on('drag', onScrubDrag));
  }

  /**
   * Fetch timeline data from API.
   * @param {string} repoId
   */
  function fetchData(repoId) {
    if (!repoId) return;
    currentRepoId = repoId;

    fetch('/api/v1/timeline?repoId=' + encodeURIComponent(repoId), { credentials: 'same-origin' })
      .then(function (res) { return res.ok ? res.json() : { buckets: [], commits: [] }; })
      .then(function (data) {
        buckets = (data.buckets || data || []).map(function (b) {
          return {
            date: new Date(b.date || b.period),
            additions: b.additions || 0,
            deletions: b.deletions || 0,
            modifications: b.modifications || 0
          };
        });
        commits = data.commits || [];
        render();
      })
      .catch(function () {
        buckets = [];
        commits = [];
        render();
      });
  }

  /**
   * Render the stacked area chart and sliders.
   */
  function render() {
    if (!svg || !buckets.length) return;

    // Sort by date
    buckets.sort(function (a, b) { return a.date - b.date; });

    fullFrom = buckets[0].date;
    fullTo = buckets[buckets.length - 1].date;

    if (!rangeFrom) rangeFrom = fullFrom;
    if (!rangeTo) rangeTo = fullTo;

    xScale.domain([fullFrom, fullTo]);

    var maxY = d3.max(buckets, function (d) {
      return d.additions + d.deletions + d.modifications;
    }) || 1;
    yScale.domain([0, maxY]);

    // Stack data
    var stackKeys = ['additions', 'deletions', 'modifications'];
    var colors = { additions: '#22c55e', deletions: '#ef4444', modifications: '#3b82f6' };

    var stack = d3.stack().keys(stackKeys);
    var series = stack(buckets);

    var area = d3.area()
      .x(function (d) { return xScale(d.data.date); })
      .y0(function (d) { return yScale(d[0]); })
      .y1(function (d) { return yScale(d[1]); })
      .curve(d3.curveMonotoneX);

    var chartArea = svg.select('.chart-area');
    chartArea.selectAll('path').remove();

    series.forEach(function (s) {
      chartArea.append('path')
        .datum(s)
        .attr('d', area)
        .attr('fill', colors[s.key] || '#999')
        .attr('opacity', 0.7);
    });

    // X axis
    svg.select('.x-axis')
      .call(d3.axisBottom(xScale).ticks(6).tickFormat(d3.timeFormat('%b %Y')));

    updateSliders();
  }

  /**
   * Update slider positions and shaded regions.
   */
  function updateSliders() {
    if (!xScale || !rangeFrom || !rangeTo) return;

    var lx = xScale(rangeFrom);
    var rx = xScale(rangeTo);

    svg.select('.slider-left').attr('x', Math.max(0, lx - 3));
    svg.select('.slider-right').attr('x', Math.min(chartWidth - 6, rx - 3));

    svg.select('.shade-left').attr('x', 0).attr('width', Math.max(0, lx));
    svg.select('.shade-right').attr('x', rx).attr('width', Math.max(0, chartWidth - rx));

    // Scrub area between sliders
    svg.select('.scrub-area').attr('x', lx).attr('width', Math.max(0, rx - lx));

    // Update date labels
    if (leftDateLabel) leftDateLabel.textContent = formatDate(rangeFrom);
    if (rightDateLabel) rightDateLabel.textContent = formatDate(rangeTo);
  }

  /**
   * Format a date for display.
   * @param {Date} d
   * @returns {string}
   */
  function formatDate(d) {
    if (!d) return '--';
    try {
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return '--';
    }
  }

  /**
   * Handle left slider drag.
   */
  function onDragLeft(event) {
    var x = Math.max(0, Math.min(event.x, xScale(rangeTo) - 10));
    rangeFrom = xScale.invert(x);
    exitScrubMode();
    updateSliders();
    emitRangeChange();
  }

  /**
   * Handle right slider drag.
   */
  function onDragRight(event) {
    var x = Math.max(xScale(rangeFrom) + 10, Math.min(event.x, chartWidth));
    rangeTo = xScale.invert(x);
    exitScrubMode();
    updateSliders();
    emitRangeChange();
  }

  /**
   * Handle click in middle area — enter scrub mode.
   */
  function onMiddleClick(event) {
    scrubMode = true;
    updateScrubPosition(event.offsetX - margin.left);
  }

  /**
   * Handle drag in scrub mode.
   */
  function onScrubDrag(event) {
    if (!scrubMode) {
      scrubMode = true;
    }
    updateScrubPosition(event.x);
  }

  /**
   * Update scrub position indicator and emit event.
   * @param {number} x - pixel position
   */
  function updateScrubPosition(x) {
    if (!xScale || !commits.length) return;

    var lx = xScale(rangeFrom);
    var rx = xScale(rangeTo);
    x = Math.max(lx, Math.min(x, rx));

    svg.select('.scrub-indicator')
      .attr('x1', x)
      .attr('x2', x)
      .attr('display', 'block');

    // Find closest commit index
    var scrubDate = xScale.invert(x);
    var rangeCommits = commits.filter(function (c) {
      var cd = new Date(c.commitDate || c.date);
      return cd >= rangeFrom && cd <= rangeTo;
    });

    if (rangeCommits.length) {
      var closest = 0;
      var minDiff = Infinity;
      for (var i = 0; i < rangeCommits.length; i++) {
        var diff = Math.abs(new Date(rangeCommits[i].commitDate || rangeCommits[i].date) - scrubDate);
        if (diff < minDiff) {
          minDiff = diff;
          closest = i;
        }
      }
      scrubIndex = closest;
    } else {
      scrubIndex = null;
    }

    window.dispatchEvent(new CustomEvent('scrub-position-changed', {
      detail: { position: scrubIndex }
    }));

    if (window.AppState) {
      window.AppState.setScrubPosition(scrubIndex);
    }
  }

  /**
   * Exit scrub mode.
   */
  function exitScrubMode() {
    scrubMode = false;
    scrubIndex = null;
    if (svg) {
      svg.select('.scrub-indicator').attr('display', 'none');
    }
  }

  /**
   * Reset range to full extent.
   */
  function resetRange() {
    rangeFrom = fullFrom;
    rangeTo = fullTo;
    exitScrubMode();
    updateSliders();
    emitRangeChange();
  }

  /**
   * Emit date-range-changed event.
   */
  function emitRangeChange() {
    var detail = {
      from: rangeFrom ? rangeFrom.toISOString() : null,
      to: rangeTo ? rangeTo.toISOString() : null
    };
    window.dispatchEvent(new CustomEvent('date-range-changed', { detail: detail }));
  }

  // Listen for repo changes
  window.addEventListener('repo-changed', function (e) {
    var repoId = e.detail && e.detail.repoId;
    rangeFrom = null;
    rangeTo = null;
    exitScrubMode();
    fetchData(repoId);
  });

  // Handle resize
  window.addEventListener('resize', function () {
    init();
    if (currentRepoId) render();
  });

  // Initialize
  init();
})();
