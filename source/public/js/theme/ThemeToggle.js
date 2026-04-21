/**
 * ThemeToggle — toggles dark/light DaisyUI theme.
 * Persists preference to DynamoDB via API; restores on login.
 * Defaults to light theme for new users.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'ginator-theme';
  var LIGHT = 'light';
  var DARK = 'dark';

  var checkbox = document.getElementById('theme-checkbox');
  var html = document.documentElement;

  /**
   * Apply theme to the document.
   * @param {string} theme - 'light' or 'dark'
   */
  function applyTheme(theme) {
    html.setAttribute('data-theme', theme);
    if (checkbox) {
      checkbox.checked = theme === DARK;
    }
  }

  /**
   * Persist theme preference to server.
   * @param {string} theme
   */
  function persistTheme(theme) {
    localStorage.setItem(STORAGE_KEY, theme);
    // Save to DynamoDB via API (fire-and-forget)
    fetch('/api/v1/user/theme', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: theme }),
      credentials: 'same-origin'
    }).catch(function () {
      // Silently fail — localStorage is the fallback
    });
  }

  /**
   * Load saved theme preference.
   * Priority: localStorage > server default > light.
   */
  function loadTheme() {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved === LIGHT || saved === DARK) {
      applyTheme(saved);
      return;
    }
    // Try to fetch from server
    fetch('/api/v1/user/theme', { credentials: 'same-origin' })
      .then(function (res) {
        if (res.ok) return res.json();
        return null;
      })
      .then(function (data) {
        if (data && (data.theme === LIGHT || data.theme === DARK)) {
          applyTheme(data.theme);
          localStorage.setItem(STORAGE_KEY, data.theme);
        } else {
          applyTheme(LIGHT);
        }
      })
      .catch(function () {
        applyTheme(LIGHT);
      });
  }

  // Wire up toggle
  if (checkbox) {
    checkbox.addEventListener('change', function () {
      var newTheme = checkbox.checked ? DARK : LIGHT;
      applyTheme(newTheme);
      persistTheme(newTheme);
    });
  }

  // Initialize on load
  loadTheme();
})();
