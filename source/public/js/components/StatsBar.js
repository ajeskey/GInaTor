/**
 * StatsBar — displays contributor count, file count, first/last commit dates, commit count.
 * Updates on repo change and date range change.
 * Formats dates and numbers for readability.
 */
(function () {
  'use strict';

  var elContributors = document.getElementById('stat-contributors');
  var elFiles = document.getElementById('stat-files');
  var elFirstDate = document.getElementById('stat-first-date');
  var elLastDate = document.getElementById('stat-last-date');
  var elCommits = document.getElementById('stat-commits');

  var currentRepoId = null;
  var currentDateRange = null;

  /**
   * Format a number with locale-aware separators.
   * @param {number} n
   * @returns {string}
   */
  function formatNumber(n) {
    if (n == null || isNaN(n)) return '--';
    return Number(n).toLocaleString();
  }

  /**
   * Format an ISO date string to a readable short date.
   * @param {string} dateStr
   * @returns {string}
   */
  function formatDate(dateStr) {
    if (!dateStr) return '--';
    try {
      var d = new Date(dateStr);
      if (isNaN(d.getTime())) return '--';
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return '--';
    }
  }

  /**
   * Update the stats bar with data from the API.
   * @param {object} stats
   */
  function renderStats(stats) {
    if (!stats) {
      clearStats();
      return;
    }
    if (elContributors) elContributors.textContent = formatNumber(stats.contributorCount);
    if (elFiles) elFiles.textContent = formatNumber(stats.fileCount);
    if (elFirstDate) elFirstDate.textContent = formatDate(stats.firstCommitDate);
    if (elLastDate) elLastDate.textContent = formatDate(stats.lastCommitDate);
    if (elCommits) elCommits.textContent = formatNumber(stats.commitCount);
  }

  /**
   * Clear all stats to placeholder.
   */
  function clearStats() {
    if (elContributors) elContributors.textContent = '--';
    if (elFiles) elFiles.textContent = '--';
    if (elFirstDate) elFirstDate.textContent = '--';
    if (elLastDate) elLastDate.textContent = '--';
    if (elCommits) elCommits.textContent = '--';
  }

  /**
   * Fetch stats from the API.
   * @param {string} repoId
   * @param {object} [dateRange] - { from, to }
   */
  function fetchStats(repoId, dateRange) {
    if (!repoId) {
      clearStats();
      return;
    }

    var url = '/api/v1/stats?repoId=' + encodeURIComponent(repoId);
    if (dateRange && dateRange.from) {
      url += '&from=' + encodeURIComponent(dateRange.from);
    }
    if (dateRange && dateRange.to) {
      url += '&to=' + encodeURIComponent(dateRange.to);
    }

    fetch(url, { credentials: 'same-origin' })
      .then(function (res) {
        if (!res.ok) return null;
        return res.json();
      })
      .then(function (data) {
        renderStats(data);
      })
      .catch(function () {
        clearStats();
      });
  }

  // Listen for repo changes
  window.addEventListener('repo-changed', function (e) {
    currentRepoId = e.detail && e.detail.repoId;
    currentDateRange = null;
    fetchStats(currentRepoId);
  });

  // Listen for date range changes
  window.addEventListener('date-range-changed', function (e) {
    currentDateRange = e.detail || null;
    fetchStats(currentRepoId, currentDateRange);
  });
})();
