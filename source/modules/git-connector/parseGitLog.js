'use strict';

/**
 * Delimiter used to separate fields in git log output.
 * Chosen to be unlikely to appear in commit messages.
 */
const FIELD_DELIMITER = '<<GIT_FIELD>>';
const RECORD_DELIMITER = '<<GIT_RECORD>>';

/**
 * Git log format string that captures all needed fields.
 * Fields: hash, author name, author email, ISO date, subject+body
 */
const GIT_LOG_FORMAT = [
  '%H', // commit hash
  '%an', // author name
  '%ae', // author email
  '%aI', // author date ISO 8601
  '%B' // full commit message (subject + body)
].join(FIELD_DELIMITER);

/**
 * Parse raw git log output into normalized CommitRecord[].
 * @param {string} rawLog - Raw output from `git log` command.
 * @param {string} repositoryId - The repository identifier to attach to each record.
 * @param {Array<{ hash: string, files: Array<{ path: string, changeType: string, additions: number, deletions: number }> }>} [fileChanges] - Pre-parsed file changes per commit.
 * @returns {Array<import('./index').CommitRecord>}
 */
function parseGitLog(rawLog, repositoryId, fileChanges) {
  if (!rawLog || !rawLog.trim()) {
    return [];
  }

  const records = rawLog.split(RECORD_DELIMITER).filter((r) => r.trim());
  const fileChangeMap = new Map();

  if (fileChanges) {
    for (const fc of fileChanges) {
      fileChangeMap.set(fc.hash, fc.files);
    }
  }

  return records
    .map((record) => {
      const fields = record.split(FIELD_DELIMITER);
      if (fields.length < 5) {
        return null;
      }

      const commitHash = fields[0].trim();
      const authorName = fields[1].trim();
      const authorEmail = fields[2].trim();
      const commitDate = fields[3].trim();
      const message = fields[4].trim();

      const changedFiles = fileChangeMap.get(commitHash) || [];

      return {
        repositoryId,
        commitHash,
        authorName,
        authorEmail,
        commitDate,
        message,
        changedFiles
      };
    })
    .filter(Boolean);
}

/**
 * Parse the output of `git diff --numstat` for a single commit.
 * @param {string} numstatOutput - Raw output from `git diff --numstat`.
 * @param {string} statusOutput - Raw output from `git diff --name-status`.
 * @returns {Array<{ path: string, changeType: 'added' | 'modified' | 'deleted', additions: number, deletions: number }>}
 */
function parseNumstat(numstatOutput, statusOutput) {
  const files = [];
  const statusMap = new Map();

  if (statusOutput) {
    const statusLines = statusOutput.split('\n').filter((l) => l.trim());
    for (const line of statusLines) {
      const parts = line.split('\t');
      if (parts.length >= 2) {
        const status = parts[0].trim();
        const filePath = parts[parts.length - 1].trim();
        statusMap.set(filePath, normalizeChangeType(status));
      }
    }
  }

  if (numstatOutput) {
    const lines = numstatOutput.split('\n').filter((l) => l.trim());
    for (const line of lines) {
      const parts = line.split('\t');
      if (parts.length >= 3) {
        const additions = parts[0] === '-' ? 0 : parseInt(parts[0], 10) || 0;
        const deletions = parts[1] === '-' ? 0 : parseInt(parts[1], 10) || 0;
        const filePath = parts[2].trim();
        const changeType = statusMap.get(filePath) || 'modified';

        files.push({ path: filePath, changeType, additions, deletions });
      }
    }
  }

  return files;
}

/**
 * Normalize git status letter to change type string.
 * @param {string} status - Git status letter (A, M, D, R, C, etc.)
 * @returns {'added' | 'modified' | 'deleted'}
 */
function normalizeChangeType(status) {
  const first = status.charAt(0).toUpperCase();
  switch (first) {
    case 'A':
      return 'added';
    case 'D':
      return 'deleted';
    case 'M':
      return 'modified';
    case 'R':
      return 'modified'; // rename treated as modified
    case 'C':
      return 'added'; // copy treated as added
    default:
      return 'modified';
  }
}

module.exports = {
  parseGitLog,
  parseNumstat,
  normalizeChangeType,
  GIT_LOG_FORMAT,
  FIELD_DELIMITER,
  RECORD_DELIMITER
};
