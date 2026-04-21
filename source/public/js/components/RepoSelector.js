/**
 * RepoSelector — fetches configured repos from API, displays in dropdown.
 * On selection change, dispatches 'repo-changed' event for AppState and other components.
 * Shows single repo name without dropdown indicator if only one configured.
 */
(function () {
  'use strict';

  var select = document.getElementById('repo-select');
  var container = document.getElementById('repo-selector');
  if (!select || !container) return;

  var STORAGE_KEY = 'ginator-selected-repo';

  /**
   * Fetch repos from API and populate dropdown.
   */
  function loadRepos() {
    fetch('/api/v1/repos', { credentials: 'same-origin' })
      .then(function (res) {
        if (!res.ok) return [];
        return res.json();
      })
      .then(function (data) {
        var repos = Array.isArray(data) ? data : data.repos || data.items || [];
        renderRepos(repos);
      })
      .catch(function () {
        select.innerHTML = '';
        var opt = document.createElement('option');
        opt.value = '';
        opt.disabled = true;
        opt.selected = true;
        opt.textContent = 'No repos available';
        select.appendChild(opt);
      });
  }

  /**
   * Render repos into the selector.
   * @param {Array} repos
   */
  function renderRepos(repos) {
    select.innerHTML = '';

    if (!repos.length) {
      var opt = document.createElement('option');
      opt.value = '';
      opt.disabled = true;
      opt.selected = true;
      opt.textContent = 'No repos configured';
      select.appendChild(opt);
      return;
    }

    // If only one repo, show as plain text (no dropdown indicator)
    if (repos.length === 1) {
      var repo = repos[0];
      container.innerHTML =
        '<span class="font-semibold text-sm px-2">' +
        escapeHtml(repo.name || repo.repoId) +
        '</span>';
      // Auto-select the single repo
      notifyRepoChange(repo.repoId);
      return;
    }

    var savedRepo = localStorage.getItem(STORAGE_KEY);
    var foundSaved = false;

    repos.forEach(function (repo) {
      var opt = document.createElement('option');
      opt.value = repo.repoId;
      opt.textContent = repo.name || repo.repoId;
      if (repo.repoId === savedRepo) {
        opt.selected = true;
        foundSaved = true;
      }
      select.appendChild(opt);
    });

    // If no saved selection, select first
    if (!foundSaved && repos.length > 0) {
      select.selectedIndex = 0;
    }

    // Notify initial selection
    notifyRepoChange(select.value);
  }

  /**
   * Dispatch repo-changed custom event.
   * @param {string} repoId
   */
  function notifyRepoChange(repoId) {
    if (!repoId) return;
    localStorage.setItem(STORAGE_KEY, repoId);
    window.dispatchEvent(
      new CustomEvent('repo-changed', {
        detail: { repoId: repoId }
      })
    );
  }

  /**
   * Escape HTML to prevent XSS.
   * @param {string} str
   * @returns {string}
   */
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // Listen for selection changes
  select.addEventListener('change', function () {
    notifyRepoChange(select.value);
  });

  // Load repos on init
  loadRepos();
})();
