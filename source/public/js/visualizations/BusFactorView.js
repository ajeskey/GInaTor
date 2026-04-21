/**
 * BusFactorView — D3 table + overlay.
 * Files sorted by bus factor ascending; warning color for bus factor = 1.
 * Fetches from /api/v1/bus-factor.
 */
(function () {
  'use strict';

  var _d3 = window.d3;

  function BusFactorView(containerId, appState) {
    window.VisualizationBase.call(this, containerId, appState);
    this.overlayMode = false;
  }

  BusFactorView.prototype = Object.create(window.VisualizationBase.prototype);
  BusFactorView.prototype.constructor = BusFactorView;

  BusFactorView.prototype.load = function (repoId, dateRange) {
    window.VisualizationBase.prototype.load.call(this, repoId, dateRange);
    this._render();
  };

  BusFactorView.prototype.update = function (dateRange) {
    window.VisualizationBase.prototype.update.call(this, dateRange);
    this._render();
  };

  BusFactorView.prototype.resize = function () {
    this._render();
  };

  BusFactorView.prototype.setOverlayMode = function (on) {
    this.overlayMode = !!on;
    this._render();
  };

  BusFactorView.prototype._render = function () {
    var self = this;
    if (!this.repoId) return;

    this._fetch(this._apiUrl('/api/v1/bus-factor'))
      .then(function (data) {
        self.data = data;
        self._draw(data);
      })
      .catch(function (err) {
        console.error('BusFactorView fetch error:', err);
      });
  };

  BusFactorView.prototype._draw = function (data) {
    var dims = this._dims();
    var _self = this;
    var files = (data.files || []).slice().sort(function (a, b) {
      return a.busFactor - b.busFactor;
    });

    // Clear container and build table
    this.container.innerHTML = '';
    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'overflow-y:auto;max-height:' + dims.height + 'px;padding:10px;';

    var title = document.createElement('h3');
    title.textContent = 'Bus Factor Analysis';
    title.style.cssText = 'font-size:16px;font-weight:bold;margin-bottom:10px;';
    wrapper.appendChild(title);

    var table = document.createElement('table');
    table.style.cssText = 'width:100%;border-collapse:collapse;font-size:13px;';

    // Header
    var thead = document.createElement('thead');
    var headerRow = document.createElement('tr');
    ['File', 'Bus Factor', 'Contributors'].forEach(function (col) {
      var th = document.createElement('th');
      th.textContent = col;
      th.style.cssText =
        'text-align:left;padding:8px 12px;border-bottom:2px solid #e5e7eb;font-weight:600;';
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body
    var tbody = document.createElement('tbody');
    files.forEach(function (file) {
      var tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      var isWarning = file.busFactor === 1;

      if (isWarning) {
        tr.style.backgroundColor = '#fef2f2';
      }

      // File path
      var tdFile = document.createElement('td');
      tdFile.textContent = file.path;
      tdFile.style.cssText = 'padding:6px 12px;border-bottom:1px solid #f3f4f6;';
      tr.appendChild(tdFile);

      // Bus factor
      var tdBf = document.createElement('td');
      tdBf.textContent = file.busFactor;
      tdBf.style.cssText = 'padding:6px 12px;border-bottom:1px solid #f3f4f6;font-weight:bold;';
      if (isWarning) tdBf.style.color = '#dc2626';
      tr.appendChild(tdBf);

      // Contributors
      var tdContrib = document.createElement('td');
      tdContrib.textContent = (file.contributors || []).join(', ');
      tdContrib.style.cssText = 'padding:6px 12px;border-bottom:1px solid #f3f4f6;';
      tr.appendChild(tdContrib);

      tr.addEventListener('mouseover', function () {
        tr.style.backgroundColor = isWarning ? '#fee2e2' : '#f0f9ff';
      });
      tr.addEventListener('mouseout', function () {
        tr.style.backgroundColor = isWarning ? '#fef2f2' : '';
      });
      tr.addEventListener('click', function () {
        window.dispatchEvent(new CustomEvent('viz:file-selected', { detail: { file: file.path } }));
      });

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrapper.appendChild(table);
    this.container.appendChild(wrapper);
  };

  BusFactorView.prototype.exportSVG = function () {
    // Table-based — no SVG to export; return null
    return null;
  };

  window.BusFactorView = BusFactorView;
})();
