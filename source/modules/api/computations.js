'use strict';

/**
 * Pure computation functions for visualization API endpoints.
 * All functions accept commit arrays and return aggregated data.
 * No DynamoDB or I/O dependencies — fully testable in isolation.
 */

/**
 * Compute repository stats from commits.
 * @param {Array} commits - Array of commit records.
 * @returns {{ contributorCount: number, fileCount: number, firstCommitDate: string, lastCommitDate: string, commitCount: number }}
 */
function computeStats(commits) {
  if (!commits || commits.length === 0) {
    return { contributorCount: 0, fileCount: 0, firstCommitDate: null, lastCommitDate: null, commitCount: 0 };
  }
  const authors = new Set();
  const files = new Set();
  let firstDate = commits[0].commitDate;
  let lastDate = commits[0].commitDate;

  for (const c of commits) {
    authors.add(c.authorEmail);
    if (c.changedFiles) {
      for (const f of c.changedFiles) {
        files.add(f.path);
      }
    }
    if (c.commitDate < firstDate) firstDate = c.commitDate;
    if (c.commitDate > lastDate) lastDate = c.commitDate;
  }

  return {
    contributorCount: authors.size,
    fileCount: files.size,
    firstCommitDate: firstDate,
    lastCommitDate: lastDate,
    commitCount: commits.length
  };
}

/**
 * Compute contributor heatmap grid.
 * @param {Array} commits
 * @returns {{ grid: Array<{author: string, timePeriod: string, count: number}>, totalCommits: number }}
 */
function computeHeatmap(commits) {
  if (!commits || commits.length === 0) {
    return { grid: [], totalCommits: 0 };
  }
  const map = {};
  for (const c of commits) {
    const period = c.commitDate.slice(0, 10); // YYYY-MM-DD
    const key = `${c.authorEmail}\0${period}`;
    map[key] = (map[key] || 0) + 1;
  }
  const grid = Object.entries(map).map(([key, count]) => {
    const sepIdx = key.lastIndexOf('\0');
    const author = key.slice(0, sepIdx);
    const timePeriod = key.slice(sepIdx + 1);
    return { author, timePeriod, count };
  });
  return { grid, totalCommits: commits.length };
}

/**
 * Compute file change frequency from commits.
 * @param {Array} commits
 * @returns {{ files: Array<{path: string, frequency: number}> }}
 */
function computeFileChangeFrequency(commits) {
  if (!commits || commits.length === 0) {
    return { files: [] };
  }
  const freq = Object.create(null);
  for (const c of commits) {
    if (c.changedFiles) {
      // Count each file once per commit (not per entry)
      const seen = new Set();
      for (const f of c.changedFiles) {
        if (!seen.has(f.path)) {
          freq[f.path] = (freq[f.path] || 0) + 1;
          seen.add(f.path);
        }
      }
    }
  }
  const files = Object.entries(freq).map(([path, frequency]) => ({ path, frequency }));
  return { files };
}

/**
 * Compute primary contributor per file.
 * @param {Array} commits
 * @returns {{ files: Array<{path: string, primaryContributor: string, contributors: Array<{author: string, count: number}>}> }}
 */
function computePrimaryContributor(commits) {
  if (!commits || commits.length === 0) {
    return { files: [] };
  }
  // Map: filePath -> { authorEmail -> count }
  const fileAuthors = Object.create(null);
  for (const c of commits) {
    if (c.changedFiles) {
      for (const f of c.changedFiles) {
        if (!fileAuthors[f.path]) fileAuthors[f.path] = {};
        fileAuthors[f.path][c.authorEmail] = (fileAuthors[f.path][c.authorEmail] || 0) + 1;
      }
    }
  }
  const files = Object.entries(fileAuthors).map(([path, authors]) => {
    const contributors = Object.entries(authors)
      .map(([author, count]) => ({ author, count }))
      .sort((a, b) => b.count - a.count || a.author.localeCompare(b.author));
    return {
      path,
      primaryContributor: contributors[0].author,
      contributors
    };
  });
  return { files };
}

/**
 * Compute commit velocity time series.
 * @param {Array} commits
 * @param {string} [granularity='daily'] - 'daily', 'weekly', or 'monthly'
 * @returns {Array<{period: string, count: number}>}
 */
function computeCommitVelocity(commits, granularity = 'daily') {
  if (!commits || commits.length === 0) return [];
  const buckets = {};
  for (const c of commits) {
    const d = new Date(c.commitDate);
    let period;
    if (granularity === 'monthly') {
      period = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    } else if (granularity === 'weekly') {
      // ISO week: get Monday of the week
      const day = d.getUTCDay();
      const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff));
      period = monday.toISOString().slice(0, 10);
    } else {
      period = d.toISOString().slice(0, 10);
    }
    buckets[period] = (buckets[period] || 0) + 1;
  }
  return Object.entries(buckets)
    .map(([period, count]) => ({ period, count }))
    .sort((a, b) => a.period.localeCompare(b.period));
}

/**
 * Detect spikes in a time series. Spike = value > mean + 2*stddev.
 * @param {Array<{period: string, count: number}>} timeSeries
 * @returns {Array<{period: string, count: number, isSpike: boolean}>}
 */
function detectSpikes(timeSeries) {
  if (!timeSeries || timeSeries.length === 0) return [];
  const counts = timeSeries.map(t => t.count);
  const mean = counts.reduce((s, v) => s + v, 0) / counts.length;
  const variance = counts.reduce((s, v) => s + (v - mean) ** 2, 0) / counts.length;
  const stddev = Math.sqrt(variance);
  const threshold = mean + 2 * stddev;
  return timeSeries.map(t => ({
    period: t.period,
    count: t.count,
    isSpike: t.count > threshold
  }));
}

/**
 * Compute author collaboration graph.
 * Edge between two authors iff they both modified at least one common file.
 * Edge weight = count of distinct shared files.
 * @param {Array} commits
 * @returns {{ nodes: Array<{author: string, commitCount: number}>, edges: Array<{source: string, target: string, sharedFiles: number}> }}
 */
function computeCollaborationGraph(commits) {
  if (!commits || commits.length === 0) {
    return { nodes: [], edges: [] };
  }
  // author -> commit count
  const authorCommits = {};
  // file -> set of authors
  const fileAuthors = Object.create(null);

  for (const c of commits) {
    authorCommits[c.authorEmail] = (authorCommits[c.authorEmail] || 0) + 1;
    if (c.changedFiles) {
      for (const f of c.changedFiles) {
        if (!fileAuthors[f.path]) fileAuthors[f.path] = new Set();
        fileAuthors[f.path].add(c.authorEmail);
      }
    }
  }

  const nodes = Object.entries(authorCommits)
    .map(([author, commitCount]) => ({ author, commitCount }));

  // Count shared files per author pair
  const edgeMap = {};
  for (const [, authors] of Object.entries(fileAuthors)) {
    const arr = Array.from(authors).sort();
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const key = `${arr[i]}\0${arr[j]}`;
        edgeMap[key] = (edgeMap[key] || 0) + 1;
      }
    }
  }

  const edges = Object.entries(edgeMap).map(([key, sharedFiles]) => {
    const sepIdx = key.indexOf('\0');
    const source = key.slice(0, sepIdx);
    const target = key.slice(sepIdx + 1);
    return { source, target, sharedFiles };
  });

  return { nodes, edges };
}

/**
 * Compute file type (extension) distribution.
 * @param {Array} commits
 * @returns {{ types: Array<{extension: string, count: number}> }}
 */
function computeFileTypeDistribution(commits) {
  if (!commits || commits.length === 0) {
    return { types: [] };
  }
  const extCounts = {};
  for (const c of commits) {
    if (c.changedFiles) {
      for (const f of c.changedFiles) {
        const dotIdx = f.path.lastIndexOf('.');
        const ext = dotIdx >= 0 ? f.path.slice(dotIdx) : '(no extension)';
        extCounts[ext] = (extCounts[ext] || 0) + 1;
      }
    }
  }
  const types = Object.entries(extCounts)
    .map(([extension, count]) => ({ extension, count }));
  return { types };
}

/**
 * Compute 7×24 activity matrix (day-of-week × hour).
 * @param {Array} commits
 * @returns {{ matrix: number[][], totalCommits: number }}
 */
function computeActivityMatrix(commits) {
  // 7 rows (0=Sunday..6=Saturday), 24 columns (0..23)
  const matrix = Array.from({ length: 7 }, () => Array(24).fill(0));
  if (!commits || commits.length === 0) {
    return { matrix, totalCommits: 0 };
  }
  for (const c of commits) {
    const d = new Date(c.commitDate);
    const day = d.getUTCDay();
    const hour = d.getUTCHours();
    matrix[day][hour]++;
  }
  return { matrix, totalCommits: commits.length };
}

/**
 * Compute bus factor per file (distinct contributor count).
 * @param {Array} commits
 * @returns {{ files: Array<{path: string, busFactor: number, contributors: string[]}> }}
 */
function computeBusFactor(commits) {
  if (!commits || commits.length === 0) {
    return { files: [] };
  }
  const fileContributors = Object.create(null);
  for (const c of commits) {
    if (c.changedFiles) {
      for (const f of c.changedFiles) {
        if (!fileContributors[f.path]) fileContributors[f.path] = new Set();
        fileContributors[f.path].add(c.authorEmail);
      }
    }
  }
  const files = Object.entries(fileContributors).map(([path, contribs]) => ({
    path,
    busFactor: contribs.size,
    contributors: Array.from(contribs).sort()
  }));
  return { files };
}

/**
 * Compute stale files (not modified within threshold months).
 * @param {Array} commits
 * @param {number} [thresholdMonths=6]
 * @param {Date} [referenceDate=new Date()]
 * @returns {{ files: Array<{path: string, lastModified: string, lastAuthor: string, monthsSince: number}> }}
 */
function computeStaleFiles(commits, thresholdMonths = 6, referenceDate = new Date()) {
  if (!commits || commits.length === 0) {
    return { files: [] };
  }
  const ref = new Date(referenceDate);
  // file -> { lastModified, lastAuthor }
  const fileInfo = Object.create(null);
  for (const c of commits) {
    if (c.changedFiles) {
      for (const f of c.changedFiles) {
        if (!fileInfo[f.path] || c.commitDate > fileInfo[f.path].lastModified) {
          fileInfo[f.path] = { lastModified: c.commitDate, lastAuthor: c.authorEmail };
        }
      }
    }
  }

  const files = [];
  for (const [path, info] of Object.entries(fileInfo)) {
    const lastDate = new Date(info.lastModified);
    const monthsSince = (ref.getFullYear() - lastDate.getFullYear()) * 12 +
      (ref.getMonth() - lastDate.getMonth());
    if (monthsSince > thresholdMonths) {
      files.push({
        path,
        lastModified: info.lastModified,
        lastAuthor: info.lastAuthor,
        monthsSince
      });
    }
  }
  return { files };
}

/**
 * Aggregate commits into time buckets with additions/deletions/modifications sums.
 * @param {Array} commits
 * @returns {{ buckets: Array<{period: string, additions: number, deletions: number, modifications: number}> }}
 */
function computeTimelineAggregation(commits) {
  if (!commits || commits.length === 0) {
    return { buckets: [] };
  }
  const bucketMap = {};
  for (const c of commits) {
    const period = c.commitDate.slice(0, 10); // daily buckets
    if (!bucketMap[period]) {
      bucketMap[period] = { additions: 0, deletions: 0, modifications: 0 };
    }
    if (c.changedFiles) {
      for (const f of c.changedFiles) {
        if (f.changeType === 'added') {
          bucketMap[period].additions += (f.additions || 0) + (f.deletions || 0);
        } else if (f.changeType === 'deleted') {
          bucketMap[period].deletions += (f.additions || 0) + (f.deletions || 0);
        } else {
          bucketMap[period].modifications += (f.additions || 0) + (f.deletions || 0);
        }
      }
    }
  }
  const buckets = Object.entries(bucketMap)
    .map(([period, data]) => ({ period, ...data }))
    .sort((a, b) => a.period.localeCompare(b.period));
  return { buckets };
}

/**
 * Compute building dimensions for City Block visualization.
 * Height = total line count (additions) for the file.
 * Footprint = change frequency (number of commits touching the file).
 * @param {Array} commits
 * @returns {{ buildings: Array<{path: string, height: number, footprint: number}> }}
 */
function computeBuildingDimensions(commits) {
  if (!commits || commits.length === 0) {
    return { buildings: [] };
  }
  const fileData = Object.create(null);
  for (const c of commits) {
    if (c.changedFiles) {
      const seen = new Set();
      for (const f of c.changedFiles) {
        if (!fileData[f.path]) fileData[f.path] = { height: 0, footprint: 0 };
        fileData[f.path].height += (f.additions || 0);
        if (!seen.has(f.path)) {
          fileData[f.path].footprint += 1;
          seen.add(f.path);
        }
      }
    }
  }
  const buildings = Object.entries(fileData)
    .map(([path, data]) => ({ path, height: data.height, footprint: data.footprint }));
  return { buildings };
}

module.exports = {
  computeStats,
  computeHeatmap,
  computeFileChangeFrequency,
  computePrimaryContributor,
  computeCommitVelocity,
  detectSpikes,
  computeCollaborationGraph,
  computeFileTypeDistribution,
  computeActivityMatrix,
  computeBusFactor,
  computeStaleFiles,
  computeTimelineAggregation,
  computeBuildingDimensions
};
