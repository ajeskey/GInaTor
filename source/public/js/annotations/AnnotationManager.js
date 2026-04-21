/**
 * AnnotationManager — CRUD for annotations on the timeline.
 * Annotations target a commit or date range, with label and description.
 * Displays flag/pin markers on timeline; tooltip on hover.
 * Stacks/offsets overlapping annotations.
 *
 * Requirements: 15.1–15.8
 */
(function () {
  'use strict';

  var d3 = window.d3;
  var container = document.getElementById('timeline-scrubber');
  if (!container || !d3) return;

  var annotations = [];
  var currentRepoId = null;
  var tooltip = null;
  var MARKER_SIZE = 10;
  var STACK_OFFSET = 14;

  /**
   * Create the tooltip element.
   */
  function ensureTooltip() {
    if (tooltip) return;
    tooltip = document.createElement('div');
    tooltip.className =
      'absolute hidden bg-base-200 border border-base-300 rounded shadow-lg p-2 text-xs z-50 pointer-events-none';
    tooltip.style.maxWidth = '220px';
    document.body.appendChild(tooltip);
  }

  /**
   * Fetch annotations from API.
   * @param {string} repoId
   */
  function fetchAnnotations(repoId) {
    if (!repoId) return;
    currentRepoId = repoId;

    fetch('/api/v1/annotations?repoId=' + encodeURIComponent(repoId), {
      credentials: 'same-origin'
    })
      .then(function (res) {
        return res.ok ? res.json() : [];
      })
      .then(function (data) {
        annotations = (Array.isArray(data) ? data : data.annotations || []).map(
          normalizeAnnotation
        );
        renderAnnotations();
      })
      .catch(function () {
        annotations = [];
      });
  }

  /**
   * Normalize an annotation record.
   * @param {object} a
   * @returns {object}
   */
  function normalizeAnnotation(a) {
    return {
      id: a.annotationId || a.id,
      targetType: a.targetType || 'commit',
      targetCommitHash: a.targetCommitHash || null,
      targetDateFrom: a.targetDateFrom ? new Date(a.targetDateFrom) : null,
      targetDateTo: a.targetDateTo ? new Date(a.targetDateTo) : null,
      label: a.label || '',
      description: a.description || '',
      authorUserId: a.authorUserId || null,
      createdAt: a.createdAt || null,
      // For commit-targeted annotations, use a date for positioning
      date: a.targetDateFrom
        ? new Date(a.targetDateFrom)
        : a.commitDate
          ? new Date(a.commitDate)
          : a.createdAt
            ? new Date(a.createdAt)
            : new Date()
    };
  }

  /**
   * Create a new annotation via API.
   * @param {object} annotationData
   * @returns {Promise}
   */
  function createAnnotation(annotationData) {
    return fetch('/api/v1/annotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ repoId: currentRepoId }, annotationData)),
      credentials: 'same-origin'
    })
      .then(function (res) {
        return res.json();
      })
      .then(function (created) {
        annotations.push(normalizeAnnotation(created));
        renderAnnotations();
        return created;
      });
  }

  /**
   * Update an annotation via API.
   * @param {string} annotationId
   * @param {object} updates
   * @returns {Promise}
   */
  function updateAnnotation(annotationId, updates) {
    return fetch('/api/v1/annotations/' + encodeURIComponent(annotationId), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ repoId: currentRepoId }, updates)),
      credentials: 'same-origin'
    })
      .then(function (res) {
        return res.json();
      })
      .then(function (updated) {
        for (var i = 0; i < annotations.length; i++) {
          if (annotations[i].id === annotationId) {
            annotations[i] = normalizeAnnotation(updated);
            break;
          }
        }
        renderAnnotations();
        return updated;
      });
  }

  /**
   * Delete an annotation via API.
   * @param {string} annotationId
   * @returns {Promise}
   */
  function deleteAnnotation(annotationId) {
    return fetch('/api/v1/annotations/' + encodeURIComponent(annotationId), {
      method: 'DELETE',
      credentials: 'same-origin'
    }).then(function () {
      annotations = annotations.filter(function (a) {
        return a.id !== annotationId;
      });
      renderAnnotations();
    });
  }

  /**
   * Compute stack offsets for overlapping annotations.
   * Annotations within a pixel threshold get stacked vertically.
   * @param {Array} items - annotations with x positions
   * @returns {Array} items with yOffset
   */
  function computeStackOffsets(items) {
    var THRESHOLD = MARKER_SIZE + 2;
    items.sort(function (a, b) {
      return a.x - b.x;
    });

    for (var i = 0; i < items.length; i++) {
      items[i].yOffset = 0;
      for (var j = 0; j < i; j++) {
        if (Math.abs(items[i].x - items[j].x) < THRESHOLD) {
          items[i].yOffset = items[j].yOffset + STACK_OFFSET;
        }
      }
    }
    return items;
  }

  /**
   * Render annotation markers on the timeline SVG.
   */
  function renderAnnotations() {
    var svgEl = container.querySelector('svg');
    if (!svgEl || !annotations.length) {
      // Clear existing
      if (svgEl) {
        d3.select(svgEl).select('g').selectAll('.annotation-marker').remove();
      }
      return;
    }

    var svgSel = d3.select(svgEl).select('g');
    if (!svgSel.node()) return;

    svgSel.selectAll('.annotation-marker').remove();

    var clipRect = svgSel.select('#timeline-clip rect');
    var chartWidth = clipRect.node() ? +clipRect.attr('width') : 760;
    var chartHeight = clipRect.node() ? +clipRect.attr('height') : 66;

    var domain = getTimelineDomain();
    if (!domain) return;

    var xScale = d3.scaleTime().domain(domain).range([0, chartWidth]);

    ensureTooltip();

    // Compute positions
    var items = annotations
      .map(function (ann) {
        var x;
        if (ann.targetType === 'dateRange' && ann.targetDateFrom && ann.targetDateTo) {
          x = xScale(new Date((ann.targetDateFrom.getTime() + ann.targetDateTo.getTime()) / 2));
        } else {
          x = xScale(ann.date);
        }
        return { annotation: ann, x: x };
      })
      .filter(function (item) {
        return item.x >= 0 && item.x <= chartWidth;
      });

    computeStackOffsets(items);

    items.forEach(function (item) {
      var ann = item.annotation;
      var x = item.x;
      var baseY = chartHeight - 2 - item.yOffset;

      var g = svgSel
        .append('g')
        .attr('class', 'annotation-marker')
        .attr('cursor', 'pointer')
        .on('mouseover', function (event) {
          showTooltip(event, ann);
        })
        .on('mouseout', hideTooltip);

      // Date range annotations: draw a bracket
      if (ann.targetType === 'dateRange' && ann.targetDateFrom && ann.targetDateTo) {
        var x1 = xScale(ann.targetDateFrom);
        var x2 = xScale(ann.targetDateTo);
        g.append('line')
          .attr('x1', x1)
          .attr('x2', x2)
          .attr('y1', baseY)
          .attr('y2', baseY)
          .attr('stroke', '#f59e0b')
          .attr('stroke-width', 2)
          .attr('opacity', 0.7);
      }

      // Flag/pin icon
      g.append('polygon')
        .attr('points', flagPoints(x, baseY))
        .attr('fill', '#f59e0b')
        .attr('stroke', '#b45309')
        .attr('stroke-width', 0.5);

      // Stem
      g.append('line')
        .attr('x1', x)
        .attr('x2', x)
        .attr('y1', baseY)
        .attr('y2', baseY + MARKER_SIZE)
        .attr('stroke', '#b45309')
        .attr('stroke-width', 1);
    });
  }

  /**
   * Generate flag polygon points.
   * @param {number} x
   * @param {number} y - base y
   * @returns {string}
   */
  function flagPoints(x, y) {
    return [
      x + ',' + (y - MARKER_SIZE),
      x + MARKER_SIZE * 0.7 + ',' + (y - MARKER_SIZE * 0.65),
      x + ',' + (y - MARKER_SIZE * 0.3)
    ].join(' ');
  }

  /**
   * Get the timeline domain.
   * @returns {Array|null}
   */
  function getTimelineDomain() {
    if (window.AppState) {
      var s = window.AppState.getState();
      if (s.dateRange && s.dateRange.from && s.dateRange.to) {
        return [new Date(s.dateRange.from), new Date(s.dateRange.to)];
      }
    }
    if (annotations.length >= 2) {
      var dates = annotations.map(function (a) {
        return a.date;
      });
      return [d3.min(dates), d3.max(dates)];
    }
    return null;
  }

  /**
   * Show tooltip for an annotation.
   * @param {Event} event
   * @param {object} ann
   */
  function showTooltip(event, ann) {
    if (!tooltip) return;
    var html = '<div class="font-semibold">' + escapeHtml(ann.label) + '</div>';
    if (ann.description) {
      html += '<div class="mt-1">' + escapeHtml(ann.description) + '</div>';
    }
    if (ann.createdAt) {
      html +=
        '<div class="opacity-60 mt-1 text-[10px]">Created: ' +
        new Date(ann.createdAt).toLocaleDateString() +
        '</div>';
    }
    tooltip.innerHTML = html;
    tooltip.style.left = event.pageX + 10 + 'px';
    tooltip.style.top = event.pageY - 10 + 'px';
    tooltip.classList.remove('hidden');
  }

  /**
   * Hide tooltip.
   */
  function hideTooltip() {
    if (tooltip) tooltip.classList.add('hidden');
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
    fetchAnnotations(repoId);
  });

  // Re-render when timeline updates
  window.addEventListener('state:date-range-changed', function () {
    if (annotations.length) renderAnnotations();
  });

  // Expose globally for CRUD operations
  window.AnnotationManager = {
    create: createAnnotation,
    update: updateAnnotation,
    remove: deleteAnnotation,
    getAnnotations: function () {
      return annotations.slice();
    }
  };
})();
