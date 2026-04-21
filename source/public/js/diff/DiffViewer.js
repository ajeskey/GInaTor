/**
 * DiffViewer — side-by-side and unified diff viewer for file changes.
 * Constrains timeline to file's commit history; scrub through file commits.
 * Requirements: 33.1–33.8
 */
(function () {
  'use strict';

  var _isOpen = false;
  var _filePath = null;
  var _fileCommits = [];
  var _currentIndex = 0;
  var _mode = 'side-by-side'; // 'side-by-side' | 'unified'
  var _savedDateRange = null;
  var _container = null;

  /**
   * Open the diff viewer for a specific file.
   * @param {string} filePath - path of the file to view
   * @param {string} [repoId] - repository ID
   */
  function open(filePath, repoId) {
    if (_isOpen) close();

    _filePath = filePath;
    _isOpen = true;
    _currentIndex = 0;

    // Save current timeline range
    var appState = window.AppState ? window.AppState.getState() : {};
    _savedDateRange = appState.dateRange ? { from: appState.dateRange.from, to: appState.dateRange.to } : null;

    _buildUI();
    _fetchFileCommits(repoId || (appState.repoId || null));
  }

  /**
   * Close the diff viewer and restore timeline.
   */
  function close() {
    if (!_isOpen) return;
    _isOpen = false;

    // Remove diff UI
    if (_container && _container.parentNode) {
      _container.parentNode.removeChild(_container);
    }
    _container = null;

    // Show viz container again
    var vizContainer = document.getElementById('viz-container');
    if (vizContainer) vizContainer.classList.remove('hidden');

    // Restore timeline range
    if (_savedDateRange && window.AppState) {
      window.AppState.setDateRange(_savedDateRange.from, _savedDateRange.to);
    }
    _savedDateRange = null;
    _filePath = null;
    _fileCommits = [];

    window.dispatchEvent(new CustomEvent('diffviewer:closed'));
  }

  /**
   * Check if diff viewer is open.
   * @returns {boolean}
   */
  function isOpen() {
    return _isOpen;
  }

  /**
   * Set display mode.
   * @param {string} mode - 'side-by-side' or 'unified'
   */
  function setMode(mode) {
    _mode = mode === 'unified' ? 'unified' : 'side-by-side';
    _renderDiff();
  }

  /**
   * Build the diff viewer UI.
   * @private
   */
  function _buildUI() {
    var vizContainer = document.getElementById('viz-container');
    if (vizContainer) vizContainer.classList.add('hidden');

    _container = document.createElement('div');
    _container.id = 'diff-viewer';
    _container.className = 'w-full bg-base-100 rounded-lg shadow-sm';

    // Header bar
    var header = document.createElement('div');
    header.className = 'flex items-center justify-between p-3 border-b border-base-300';
    header.innerHTML =
      '<div class="flex items-center gap-2">' +
        '<span class="font-semibold text-sm">📄 ' + _escapeHtml(_filePath || '') + '</span>' +
        '<span id="diff-commit-info" class="text-xs text-base-content opacity-60"></span>' +
      '</div>' +
      '<div class="flex items-center gap-2">' +
        '<div class="btn-group">' +
          '<button id="diff-mode-sbs" class="btn btn-xs ' + (_mode === 'side-by-side' ? 'btn-active' : '') + '">Side-by-Side</button>' +
          '<button id="diff-mode-unified" class="btn btn-xs ' + (_mode === 'unified' ? 'btn-active' : '') + '">Unified</button>' +
        '</div>' +
        '<div class="flex items-center gap-1">' +
          '<button id="diff-prev" class="btn btn-ghost btn-xs" title="Previous commit">◀</button>' +
          '<span id="diff-position" class="text-xs">0/0</span>' +
          '<button id="diff-next" class="btn btn-ghost btn-xs" title="Next commit">▶</button>' +
        '</div>' +
        '<button id="diff-close" class="btn btn-ghost btn-xs btn-circle" title="Close">✕</button>' +
      '</div>';
    _container.appendChild(header);

    // Diff content area
    var content = document.createElement('div');
    content.id = 'diff-content';
    content.className = 'p-4 overflow-auto max-h-[600px] font-mono text-sm';
    _container.appendChild(content);

    var mainContent = vizContainer ? vizContainer.parentNode : document.querySelector('main');
    if (mainContent) {
      mainContent.insertBefore(_container, vizContainer ? vizContainer.nextSibling : null);
    }

    // Wire events
    var closeBtn = document.getElementById('diff-close');
    if (closeBtn) closeBtn.addEventListener('click', close);

    var prevBtn = document.getElementById('diff-prev');
    if (prevBtn) prevBtn.addEventListener('click', function () { _navigate(-1); });

    var nextBtn = document.getElementById('diff-next');
    if (nextBtn) nextBtn.addEventListener('click', function () { _navigate(1); });

    var sbsBtn = document.getElementById('diff-mode-sbs');
    if (sbsBtn) sbsBtn.addEventListener('click', function () { setMode('side-by-side'); _updateModeButtons(); });

    var unifiedBtn = document.getElementById('diff-mode-unified');
    if (unifiedBtn) unifiedBtn.addEventListener('click', function () { setMode('unified'); _updateModeButtons(); });
  }

  /**
   * Fetch commits that touched this file.
   * @param {string} repoId
   * @private
   */
  function _fetchFileCommits(repoId) {
    if (!repoId || !_filePath) {
      _fileCommits = [];
      _renderDiff();
      return;
    }

    var url = '/api/v1/commits?repoId=' + encodeURIComponent(repoId) + '&file=' + encodeURIComponent(_filePath);
    fetch(url, { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : { commits: [] }; })
      .then(function (data) {
        _fileCommits = (data.commits || data.items || []).sort(function (a, b) {
          return new Date(a.commitDate) - new Date(b.commitDate);
        });
        _currentIndex = _fileCommits.length > 0 ? _fileCommits.length - 1 : 0;

        // Constrain timeline to file's commit history
        if (_fileCommits.length > 0 && window.AppState) {
          var first = _fileCommits[0].commitDate;
          var last = _fileCommits[_fileCommits.length - 1].commitDate;
          window.AppState.setDateRange(first, last);
        }

        _renderDiff();
      })
      .catch(function () {
        _fileCommits = [];
        _renderDiff();
      });
  }

  /**
   * Navigate to previous/next commit.
   * @param {number} delta - -1 or +1
   * @private
   */
  function _navigate(delta) {
    var newIndex = _currentIndex + delta;
    if (newIndex < 0 || newIndex >= _fileCommits.length) return;
    _currentIndex = newIndex;
    _renderDiff();
  }

  /**
   * Render the diff content.
   * @private
   */
  function _renderDiff() {
    var content = document.getElementById('diff-content');
    var posEl = document.getElementById('diff-position');
    var infoEl = document.getElementById('diff-commit-info');

    if (posEl) {
      posEl.textContent = (_fileCommits.length > 0 ? (_currentIndex + 1) : 0) + '/' + _fileCommits.length;
    }

    if (_fileCommits.length === 0) {
      if (content) content.innerHTML = '<div class="text-center text-base-content opacity-50 py-8">No commits found for this file.</div>';
      if (infoEl) infoEl.textContent = '';
      return;
    }

    var commit = _fileCommits[_currentIndex];
    if (infoEl) {
      infoEl.textContent = commit.commitHash.substring(0, 7) + ' — ' + commit.authorName + ' — ' + (commit.commitDate || '').substring(0, 10);
    }

    // Find the file's changes in this commit
    var fileChange = null;
    if (commit.changedFiles) {
      for (var i = 0; i < commit.changedFiles.length; i++) {
        if (commit.changedFiles[i].path === _filePath) {
          fileChange = commit.changedFiles[i];
          break;
        }
      }
    }

    if (!content) return;

    if (!fileChange) {
      content.innerHTML = '<div class="text-center text-base-content opacity-50 py-8">No diff data available for this commit.</div>';
      return;
    }

    // Render a synthetic diff display
    var lines = _generateDiffLines(fileChange);
    if (_mode === 'unified') {
      content.innerHTML = _renderUnified(lines);
    } else {
      content.innerHTML = _renderSideBySide(lines);
    }
  }

  /**
   * Generate synthetic diff lines from file change data.
   * @param {object} fileChange
   * @returns {Array<{type: string, content: string}>}
   * @private
   */
  function _generateDiffLines(fileChange) {
    var lines = [];
    var additions = fileChange.additions || 0;
    var deletions = fileChange.deletions || 0;

    lines.push({ type: 'header', content: '--- a/' + fileChange.path });
    lines.push({ type: 'header', content: '+++ b/' + fileChange.path });
    lines.push({ type: 'info', content: '@@ -1,' + deletions + ' +1,' + additions + ' @@' });

    for (var d = 0; d < deletions; d++) {
      lines.push({ type: 'deletion', content: '- (line removed)' });
    }
    for (var a = 0; a < additions; a++) {
      lines.push({ type: 'addition', content: '+ (line added)' });
    }
    if (additions === 0 && deletions === 0) {
      lines.push({ type: 'unchanged', content: '  (no line-level changes recorded)' });
    }

    return lines;
  }

  /**
   * Render unified diff view.
   * @param {Array} lines
   * @returns {string}
   * @private
   */
  function _renderUnified(lines) {
    var html = '<div class="border border-base-300 rounded overflow-hidden">';
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var bg = '';
      if (line.type === 'addition') bg = 'background-color: rgba(34,197,94,0.15); color: #166534;';
      else if (line.type === 'deletion') bg = 'background-color: rgba(239,68,68,0.15); color: #991b1b;';
      else if (line.type === 'header') bg = 'font-weight: bold;';
      else if (line.type === 'info') bg = 'color: #6366f1;';
      html += '<div style="padding: 2px 8px; white-space: pre; ' + bg + '">' + _escapeHtml(line.content) + '</div>';
    }
    html += '</div>';
    return html;
  }

  /**
   * Render side-by-side diff view.
   * @param {Array} lines
   * @returns {string}
   * @private
   */
  function _renderSideBySide(lines) {
    var leftLines = [];
    var rightLines = [];

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.type === 'header' || line.type === 'info') {
        leftLines.push(line);
        rightLines.push(line);
      } else if (line.type === 'deletion') {
        leftLines.push(line);
        rightLines.push({ type: 'empty', content: '' });
      } else if (line.type === 'addition') {
        leftLines.push({ type: 'empty', content: '' });
        rightLines.push(line);
      } else {
        leftLines.push(line);
        rightLines.push(line);
      }
    }

    var html = '<div class="flex gap-2">';
    html += '<div class="flex-1 border border-base-300 rounded overflow-hidden">';
    for (var l = 0; l < leftLines.length; l++) {
      html += _renderDiffLine(leftLines[l]);
    }
    html += '</div>';
    html += '<div class="flex-1 border border-base-300 rounded overflow-hidden">';
    for (var r = 0; r < rightLines.length; r++) {
      html += _renderDiffLine(rightLines[r]);
    }
    html += '</div></div>';
    return html;
  }

  /**
   * Render a single diff line.
   * @param {object} line
   * @returns {string}
   * @private
   */
  function _renderDiffLine(line) {
    var bg = '';
    if (line.type === 'addition') bg = 'background-color: rgba(34,197,94,0.15); color: #166534;';
    else if (line.type === 'deletion') bg = 'background-color: rgba(239,68,68,0.15); color: #991b1b;';
    else if (line.type === 'header') bg = 'font-weight: bold;';
    else if (line.type === 'info') bg = 'color: #6366f1;';
    else if (line.type === 'empty') bg = 'background-color: rgba(0,0,0,0.03);';
    return '<div style="padding: 2px 8px; white-space: pre; min-height: 1.4em; ' + bg + '">' + _escapeHtml(line.content) + '</div>';
  }

  /**
   * Update mode toggle button states.
   * @private
   */
  function _updateModeButtons() {
    var sbsBtn = document.getElementById('diff-mode-sbs');
    var unifiedBtn = document.getElementById('diff-mode-unified');
    if (sbsBtn) {
      if (_mode === 'side-by-side') sbsBtn.classList.add('btn-active');
      else sbsBtn.classList.remove('btn-active');
    }
    if (unifiedBtn) {
      if (_mode === 'unified') unifiedBtn.classList.add('btn-active');
      else unifiedBtn.classList.remove('btn-active');
    }
  }

  /**
   * Escape HTML.
   * @param {string} str
   * @returns {string}
   * @private
   */
  function _escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // Expose globally
  window.DiffViewer = {
    open: open,
    close: close,
    isOpen: isOpen,
    setMode: setMode
  };
})();
