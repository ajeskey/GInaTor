/**
 * BookmarkManager — save/load bookmarkable views.
 * Stores bookmarks via API; load restores full view state.
 * "Copy Link" copies current URL to clipboard.
 * Requirements: 36.1–36.8
 */
(function () {
  'use strict';

  var _bookmarks = [];
  var _panelVisible = false;

  /**
   * Initialize the BookmarkManager.
   * Creates the "Save Bookmark" and "My Bookmarks" controls.
   */
  function init() {
    _createControls();
    _loadBookmarks();
  }

  /**
   * Save the current view state as a bookmark.
   * @param {string} name - bookmark display name
   * @returns {Promise<object>} the created bookmark
   */
  function saveBookmark(name) {
    var state = window.AppState ? window.AppState.getState() : {};
    var body = {
      name: name,
      repositoryId: state.repoId || null,
      visualizationType: state.activeVisualization || null,
      dateFrom: state.dateRange ? state.dateRange.from : null,
      dateTo: state.dateRange ? state.dateRange.to : null
    };

    return fetch('/api/v1/bookmarks', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then(function (r) {
        if (!r.ok) throw new Error('Failed to save bookmark');
        return r.json();
      })
      .then(function (bookmark) {
        _bookmarks.push(bookmark);
        _renderPanel();
        return bookmark;
      });
  }

  /**
   * Load a bookmark — restore full view state.
   * @param {object} bookmark
   */
  function loadBookmark(bookmark) {
    if (!bookmark) return;
    if (window.AppState) {
      if (bookmark.repositoryId) window.AppState.setRepo(bookmark.repositoryId);
      if (bookmark.visualizationType) window.AppState.setVisualization(bookmark.visualizationType);
      window.AppState.setDateRange(bookmark.dateFrom || null, bookmark.dateTo || null);
    }

    // Also update URL state
    if (window.UrlState && typeof window.UrlState.encode === 'function') {
      window.UrlState.encode({
        vizType: bookmark.visualizationType,
        repoId: bookmark.repositoryId,
        from: bookmark.dateFrom,
        to: bookmark.dateTo
      });
    }
  }

  /**
   * Delete a bookmark.
   * @param {string} bookmarkId
   * @returns {Promise}
   */
  function deleteBookmark(bookmarkId) {
    return fetch('/api/v1/bookmarks/' + encodeURIComponent(bookmarkId), {
      method: 'DELETE',
      credentials: 'same-origin'
    }).then(function (r) {
      if (!r.ok) throw new Error('Failed to delete bookmark');
      _bookmarks = _bookmarks.filter(function (b) {
        return b.bookmarkId !== bookmarkId;
      });
      _renderPanel();
    });
  }

  /**
   * Copy the current shareable URL to clipboard.
   */
  function copyLink() {
    var url = window.location.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(url)
        .then(function () {
          _showToast('Link copied to clipboard');
        })
        .catch(function () {
          _fallbackCopy(url);
        });
    } else {
      _fallbackCopy(url);
    }
  }

  /**
   * Get all bookmarks.
   * @returns {Array}
   */
  function getBookmarks() {
    return _bookmarks.slice();
  }

  /**
   * Toggle the bookmarks panel visibility.
   */
  function togglePanel() {
    _panelVisible = !_panelVisible;
    var panel = document.getElementById('bookmarks-panel');
    if (panel) {
      if (_panelVisible) {
        panel.classList.remove('hidden');
        _loadBookmarks();
      } else {
        panel.classList.add('hidden');
      }
    }
  }

  // --- Private helpers ---

  /**
   * Create the bookmark controls in the UI.
   * @private
   */
  function _createControls() {
    // Add bookmark controls to the header area
    var headerRight = document.querySelector('.navbar .flex-none:last-child');
    if (!headerRight) return;

    // Insert before user menu
    var controlsDiv = document.createElement('div');
    controlsDiv.className = 'flex items-center gap-1';
    controlsDiv.innerHTML =
      '<button id="bookmark-save-btn" class="btn btn-ghost btn-sm" title="Save Bookmark">🔖</button>' +
      '<button id="bookmark-list-btn" class="btn btn-ghost btn-sm" title="My Bookmarks">📑</button>' +
      '<button id="bookmark-copy-btn" class="btn btn-ghost btn-sm" title="Copy Link">🔗</button>';

    headerRight.insertBefore(controlsDiv, headerRight.firstChild);

    // Create the bookmarks panel (hidden by default)
    var panel = document.createElement('div');
    panel.id = 'bookmarks-panel';
    panel.className =
      'hidden absolute right-4 top-16 z-50 bg-base-100 shadow-lg rounded-lg border border-base-300 w-80 max-h-96 overflow-y-auto';
    panel.innerHTML =
      '<div class="p-3 border-b border-base-300 flex items-center justify-between">' +
      '<span class="font-semibold text-sm">My Bookmarks</span>' +
      '<button id="bookmarks-panel-close" class="btn btn-ghost btn-xs btn-circle">✕</button>' +
      '</div>' +
      '<div id="bookmarks-list" class="p-2"></div>';
    document.body.appendChild(panel);

    // Wire events
    var saveBtn = document.getElementById('bookmark-save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        var name = prompt('Bookmark name:');
        if (name && name.trim()) {
          saveBookmark(name.trim()).catch(function (err) {
            console.error('Failed to save bookmark:', err);
          });
        }
      });
    }

    var listBtn = document.getElementById('bookmark-list-btn');
    if (listBtn) {
      listBtn.addEventListener('click', togglePanel);
    }

    var copyBtn = document.getElementById('bookmark-copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', copyLink);
    }

    var closeBtn = document.getElementById('bookmarks-panel-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        _panelVisible = false;
        panel.classList.add('hidden');
      });
    }
  }

  /**
   * Load bookmarks from API.
   * @private
   */
  function _loadBookmarks() {
    fetch('/api/v1/bookmarks', { credentials: 'same-origin' })
      .then(function (r) {
        return r.ok ? r.json() : { bookmarks: [] };
      })
      .then(function (data) {
        _bookmarks = data.bookmarks || [];
        _renderPanel();
      })
      .catch(function () {
        _bookmarks = [];
        _renderPanel();
      });
  }

  /**
   * Render the bookmarks list in the panel.
   * @private
   */
  function _renderPanel() {
    var list = document.getElementById('bookmarks-list');
    if (!list) return;

    if (_bookmarks.length === 0) {
      list.innerHTML =
        '<div class="text-center text-sm text-base-content opacity-50 py-4">No bookmarks saved.</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < _bookmarks.length; i++) {
      var bm = _bookmarks[i];
      html +=
        '<div class="flex items-center justify-between p-2 hover:bg-base-200 rounded cursor-pointer" data-bookmark-idx="' +
        i +
        '">' +
        '<div class="flex-1 min-w-0">' +
        '<div class="text-sm font-medium truncate">' +
        _escapeHtml(bm.name) +
        '</div>' +
        '<div class="text-xs text-base-content opacity-50">' +
        _escapeHtml(bm.visualizationType || '') +
        (bm.dateFrom ? ' | ' + bm.dateFrom.substring(0, 10) : '') +
        (bm.dateTo ? ' – ' + bm.dateTo.substring(0, 10) : '') +
        '</div>' +
        '</div>' +
        '<button class="btn btn-ghost btn-xs bookmark-delete-btn" data-bookmark-id="' +
        _escapeHtml(bm.bookmarkId) +
        '" title="Delete">🗑️</button>' +
        '</div>';
    }
    list.innerHTML = html;

    // Wire click-to-load
    var items = list.querySelectorAll('[data-bookmark-idx]');
    items.forEach(function (item) {
      item.addEventListener('click', function (e) {
        if (e.target.closest('.bookmark-delete-btn')) return;
        var idx = parseInt(item.getAttribute('data-bookmark-idx'), 10);
        if (_bookmarks[idx]) loadBookmark(_bookmarks[idx]);
      });
    });

    // Wire delete buttons
    var deleteBtns = list.querySelectorAll('.bookmark-delete-btn');
    deleteBtns.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = btn.getAttribute('data-bookmark-id');
        if (id) deleteBookmark(id);
      });
    });
  }

  /**
   * Fallback copy using a temporary textarea.
   * @param {string} text
   * @private
   */
  function _fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      _showToast('Link copied to clipboard');
    } catch {
      /* ignore */
    }
    document.body.removeChild(ta);
  }

  /**
   * Show a brief toast notification.
   * @param {string} message
   * @private
   */
  function _showToast(message) {
    var toast = document.createElement('div');
    toast.className = 'toast toast-end z-50';
    toast.innerHTML =
      '<div class="alert alert-success"><span>' + _escapeHtml(message) + '</span></div>';
    document.body.appendChild(toast);
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 2000);
  }

  /**
   * Escape HTML.
   * @param {string} str
   * @returns {string}
   * @private
   */
  function _escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }

  // Expose globally
  window.BookmarkManager = {
    init: init,
    saveBookmark: saveBookmark,
    loadBookmark: loadBookmark,
    deleteBookmark: deleteBookmark,
    copyLink: copyLink,
    getBookmarks: getBookmarks,
    togglePanel: togglePanel
  };
})();
