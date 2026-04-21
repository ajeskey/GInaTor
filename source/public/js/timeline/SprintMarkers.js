/**
 * SprintMarkers — renders vertical marker lines on the timeline at sprint/release dates.
 * Shows tooltip on hover (label, date, description).
 * Click marker to set left slider to marker date.
 *
 * Requirements: 14.3, 14.4, 14.6, 14.7
 */
(function () {
  'use strict';

  var d3 = window.d3;
  var container = document.getElementById('timeline-scrubber');
  if (!container || !d3) return;

  var markers = [];
  var currentRepoId = null;
  var markerGroup = null;
  var tooltip = null;

  /**
   * Create the tooltip element.
   */
  function ensureTooltip() {
    if (tooltip) return;
    tooltip = document.createElement('div');
    tooltip.className = 'absolute hidden bg-base-200 border border-base-300 rounded shadow-lg p-2 text-xs z-50 pointer-events-none';
    tooltip.style.maxWidth = '200px';
    document.body.appendChild(tooltip);
  }

  /**
   * Fetch sprint markers from API.
   * @param {string} repoId
   */
  function fetchMarkers(repoId) {
    if (!repoId) return;
    currentRepoId = repoId;

    fetch('/api/v1/markers?repoId=' + encodeURIComponent(repoId), { credentials: 'same-origin' })
      .then(function (res) { return res.ok ? res.json() : []; })
      .then(function (data) {
        markers = (Array.isArray(data) ? data : data.markers || []).map(function (m) {
          return {
            id: m.markerId || m.id,
            label: m.label || '',
            date: new Date(m.date),
            description: m.description || ''
          };
        });
        renderMarkers();
      })
      .catch(function () {
        markers = [];
      });
  }

  /**
   * Render marker lines on the timeline SVG.
   */
  function renderMarkers() {
    var svgEl = container.querySelector('svg');
    if (!svgEl || !markers.length) return;

    var svgSel = d3.select(svgEl).select('g');
    if (!svgSel.node()) return;

    // Remove old markers
    svgSel.selectAll('.sprint-marker').remove();

    // Get the x scale from the timeline — we read the domain from the x-axis
    var xAxisEl = svgSel.select('.x-axis');
    if (!xAxisEl.node()) return;

    // Reconstruct xScale from SVG dimensions
    var clipRect = svgSel.select('#timeline-clip rect');
    var chartWidth = clipRect.node() ? +clipRect.attr('width') : 760;

    // Find the timeline's date domain from the chart area paths
    var paths = svgSel.select('.chart-area').selectAll('path');
    if (!paths.node()) return;

    // Use the axis ticks to infer domain
    var ticks = [];
    xAxisEl.selectAll('.tick').each(function () {
      var transform = d3.select(this).attr('transform');
      var match = transform && transform.match(/translate\(([^,]+)/);
      if (match) ticks.push(parseFloat(match[1]));
    });

    // Fallback: use AppState date range or marker dates
    var domain = getTimelineDomain();
    if (!domain) return;

    var xScale = d3.scaleTime().domain(domain).range([0, chartWidth]);
    var chartHeight = clipRect.node() ? +clipRect.attr('height') : 66;

    ensureTooltip();

    markers.forEach(function (marker) {
      var x = xScale(marker.date);
      if (x < 0 || x > chartWidth) return;

      var g = svgSel.append('g')
        .attr('class', 'sprint-marker')
        .attr('cursor', 'pointer')
        .on('click', function () {
          onMarkerClick(marker);
        })
        .on('mouseover', function (event) {
          showTooltip(event, marker);
        })
        .on('mouseout', hideTooltip);

      g.append('line')
        .attr('x1', x)
        .attr('x2', x)
        .attr('y1', 0)
        .attr('y2', chartHeight)
        .attr('stroke', '#a855f7')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4,2')
        .attr('opacity', 0.8);

      g.append('polygon')
        .attr('points', (x - 4) + ',0 ' + (x + 4) + ',0 ' + x + ',6')
        .attr('fill', '#a855f7');
    });
  }

  /**
   * Get the timeline domain from available data.
   * @returns {Array|null} [minDate, maxDate]
   */
  function getTimelineDomain() {
    if (window.AppState) {
      var s = window.AppState.getState();
      if (s.dateRange && s.dateRange.from && s.dateRange.to) {
        return [new Date(s.dateRange.from), new Date(s.dateRange.to)];
      }
    }
    if (markers.length >= 2) {
      var dates = markers.map(function (m) { return m.date; });
      return [d3.min(dates), d3.max(dates)];
    }
    return null;
  }

  /**
   * Show tooltip for a marker.
   * @param {Event} event
   * @param {object} marker
   */
  function showTooltip(event, marker) {
    if (!tooltip) return;
    var dateStr = marker.date.toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric'
    });
    tooltip.innerHTML =
      '<div class="font-semibold">' + escapeHtml(marker.label) + '</div>' +
      '<div class="opacity-70">' + dateStr + '</div>' +
      (marker.description ? '<div class="mt-1">' + escapeHtml(marker.description) + '</div>' : '');
    tooltip.style.left = (event.pageX + 10) + 'px';
    tooltip.style.top = (event.pageY - 10) + 'px';
    tooltip.classList.remove('hidden');
  }

  /**
   * Hide tooltip.
   */
  function hideTooltip() {
    if (tooltip) tooltip.classList.add('hidden');
  }

  /**
   * Handle marker click — set left slider to marker date.
   * @param {object} marker
   */
  function onMarkerClick(marker) {
    window.dispatchEvent(new CustomEvent('date-range-changed', {
      detail: {
        from: marker.date.toISOString(),
        to: window.AppState ? window.AppState.getState().dateRange.to : null
      }
    }));
  }

  /**
   * Escape HTML.
   * @param {string} str
   * @returns {string}
   */
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }

  // Listen for repo changes
  window.addEventListener('repo-changed', function (e) {
    var repoId = e.detail && e.detail.repoId;
    fetchMarkers(repoId);
  });

  // Re-render markers when timeline updates
  window.addEventListener('state:date-range-changed', function () {
    if (markers.length) renderMarkers();
  });
})();
