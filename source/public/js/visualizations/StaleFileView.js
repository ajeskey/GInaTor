/**
 * StaleFileView — D3 table + overlay.
 * Stale files sorted by last modification date ascending.
 * Fetches from /api/v1/stale-files.
 */
(function () {
  'use strict';

  function StaleFileView(containerId, appState) {
    window.VisualizationBase.call(this, containerId, appState);
    this.thresholdMonths = 6;
    this.overlayMode = false;
  }

  StaleFileView.prototype = Object.create(window.VisualizationBase.prototype);
  StaleFileView.prototype.constructor = StaleFileView;

  StaleFileView.prototype.load = function (repoId, dateRange) {
    window.VisualizationBase.prototype.load.call(this, repoId, dateRange);
    this._render();
  };

  StaleFileView.prototype.update = function (dateRange) {
    window.VisualizationBase.prototype.update.call(this, dateRange);
    this._render();
  };

  StaleFileView.prototype.resize = function () {
    this._render();
  };

  StaleFileView.prototype.setThreshold = function (months) {
    this.thresholdMonths = months;
    this._render();
  };

  StaleFileView.prototype.setOverlayMode = function (on) {
    this.overlayMode = !!on;
    this._render();
  };

  StaleFileView.prototype._render = function () {
    var self = this;
    if (!this.repoId) return;
    var url = this._apiUrl('/api/v1/stale-files', { threshold: this.thresholdMonths });

    this._fetch(url)
      .then(function (data) {
        self.data = data;
        self._draw(data);
      })
      .catch(function (err) {
        console.error('StaleFileView fetch error:', err);
      });
  };

  StaleFileView.prototype._draw = function (data) {
    var dims = this._dims();
    var files = (data.files || []).slice().sort(function (a, b) {
      return new Date(a.lastModified) - new Date(b.lastModified);
    });

    this.container.innerHTML = '';
    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'overflow-y:auto;max-height:' + dims.height + 'px;padding:10px;';

    // Title + threshold selector
    var header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;gap:12px;margin-bottom:10px;';

    var title = document.createElement('h3');
    title.textContent = 'Stale Files';
    title.style.cssText = 'font-size:16px;font-weight:bold;';
    header.appendChild(title);

    var label = document.createElement('label');
    label.textContent = 'Threshold: ';
    label.style.fontSize = '13px';
    var select = document.createElement('select');
    select.style.cssText =
      'padding:2px 6px;border:1px solid #d1d5db;border-radius:4px;font-size:13px;';
    [3, 6, 9, 12, 18, 24].forEach(
      function (m) {
        var opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m + ' months';
        if (m === this.thresholdMonths) opt.selected = true;
        select.appendChild(opt);
      }.bind(this)
    );
    var self = this;
    select.addEventListener('change', function () {
      self.setThreshold(parseInt(this.value, 10));
    });
    label.appendChild(select);
    header.appendChild(label);
    wrapper.appendChild(header);

    // Table
    var table = document.createElement('table');
    table.style.cssText = 'width:100%;border-collapse:collapse;font-size:13px;';

    var thead = document.createElement('thead');
    var headerRow = document.createElement('tr');
    ['File', 'Last Modified', 'Last Author', 'Months Stale'].forEach(function (col) {
      var th = document.createElement('th');
      th.textContent = col;
      th.style.cssText =
        'text-align:left;padding:8px 12px;border-bottom:2px solid #e5e7eb;font-weight:600;';
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    var tbody = document.createElement('tbody');
    var now = new Date();
    files.forEach(function (file) {
      var tr = document.createElement('tr');
      tr.style.cursor = 'pointer';

      var lastMod = new Date(file.lastModified);
      var monthsStale = Math.floor((now - lastMod) / (1000 * 60 * 60 * 24 * 30.44));
      var severity = monthsStale > 12 ? '#fef2f2' : monthsStale > 6 ? '#fffbeb' : '';

      if (severity) tr.style.backgroundColor = severity;

      var tdFile = document.createElement('td');
      tdFile.textContent = file.path;
      tdFile.style.cssText = 'padding:6px 12px;border-bottom:1px solid #f3f4f6;';
      tr.appendChild(tdFile);

      var tdDate = document.createElement('td');
      tdDate.textContent = lastMod.toLocaleDateString();
      tdDate.style.cssText = 'padding:6px 12px;border-bottom:1px solid #f3f4f6;';
      tr.appendChild(tdDate);

      var tdAuthor = document.createElement('td');
      tdAuthor.textContent = file.lastAuthor || '';
      tdAuthor.style.cssText = 'padding:6px 12px;border-bottom:1px solid #f3f4f6;';
      tr.appendChild(tdAuthor);

      var tdMonths = document.createElement('td');
      tdMonths.textContent = monthsStale;
      tdMonths.style.cssText = 'padding:6px 12px;border-bottom:1px solid #f3f4f6;font-weight:bold;';
      if (monthsStale > 12) tdMonths.style.color = '#dc2626';
      else if (monthsStale > 6) tdMonths.style.color = '#d97706';
      tr.appendChild(tdMonths);

      tr.addEventListener('click', function () {
        window.dispatchEvent(new CustomEvent('viz:open-diff', { detail: { file: file.path } }));
      });

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrapper.appendChild(table);
    this.container.appendChild(wrapper);
  };

  StaleFileView.prototype.exportSVG = function () {
    return null;
  };

  window.StaleFileView = StaleFileView;
})();
