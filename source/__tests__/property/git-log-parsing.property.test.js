'use strict';

const fc = require('fast-check');
const {
  parseGitLog,
  parseNumstat,
  normalizeChangeType,
  FIELD_DELIMITER,
  RECORD_DELIMITER
} = require('../../modules/git-connector/parseGitLog');

/**
 * Property 8: Git Log Parsing Completeness
 * **Validates: Requirements 5.5**
 *
 * For any raw git log entry containing a commit hash, author name, author email,
 * date, message, and changed file list, the parsing function SHALL produce a
 * CommitRecord where all fields are populated, the commit hash matches the input
 * hash, the author fields match, the date is a valid ISO 8601 string, and the
 * changed files list has the correct count with valid change types (added, modified, deleted).
 */
describe('Property 8: Git Log Parsing Completeness', () => {
  // Generator for a 40-char hex commit hash
  const commitHashArb = fc.hexaString({ minLength: 40, maxLength: 40 });

  // Generator for non-empty author names (no delimiters or newlines)
  const authorNameArb = fc.stringOf(
    fc.char().filter(c => c !== '\n' && c !== '\r' && !FIELD_DELIMITER.includes(c) && !RECORD_DELIMITER.includes(c)),
    { minLength: 1, maxLength: 50 }
  ).filter(s => s.trim().length > 0);

  // Generator for email addresses
  const authorEmailArb = fc.tuple(
    fc.stringOf(fc.char().filter(c => /[a-z0-9]/.test(c)), { minLength: 1, maxLength: 15 }),
    fc.stringOf(fc.char().filter(c => /[a-z0-9]/.test(c)), { minLength: 1, maxLength: 10 }),
    fc.constantFrom('com', 'org', 'net', 'io')
  ).map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

  // Generator for ISO 8601 dates
  const isoDateArb = fc.date({
    min: new Date('2000-01-01T00:00:00Z'),
    max: new Date('2030-12-31T23:59:59Z')
  }).map(d => d.toISOString());

  // Generator for commit messages (no delimiters)
  const messageArb = fc.stringOf(
    fc.char().filter(c => !FIELD_DELIMITER.includes(c) && !RECORD_DELIMITER.includes(c)),
    { minLength: 1, maxLength: 100 }
  ).filter(s => s.trim().length > 0);

  // Generator for repository IDs
  const repoIdArb = fc.stringOf(
    fc.char().filter(c => /[a-z0-9\-]/.test(c)),
    { minLength: 1, maxLength: 20 }
  ).filter(s => s.trim().length > 0);

  // Generator for file paths
  const filePathArb = fc.tuple(
    fc.constantFrom('src', 'lib', 'test', 'docs', 'config'),
    fc.stringOf(fc.char().filter(c => /[a-z0-9]/.test(c)), { minLength: 1, maxLength: 15 }),
    fc.constantFrom('.js', '.ts', '.py', '.md', '.json')
  ).map(([dir, name, ext]) => `${dir}/${name}${ext}`);

  // Generator for git status letters
  const gitStatusArb = fc.constantFrom('A', 'M', 'D', 'R100', 'C');

  // Generator for file change entries (for numstat/status parsing)
  const fileChangeArb = fc.record({
    path: filePathArb,
    status: gitStatusArb,
    additions: fc.nat({ max: 1000 }),
    deletions: fc.nat({ max: 1000 })
  });

  const fileChangesArb = fc.array(fileChangeArb, { minLength: 0, maxLength: 10 });

  /**
   * Build a raw git log string from structured input fields.
   */
  function buildRawLog(hash, name, email, date, message) {
    return RECORD_DELIMITER + [hash, name, email, date, message].join(FIELD_DELIMITER);
  }

  it('parseGitLog produces a CommitRecord with all fields populated and matching input', () => {
    fc.assert(
      fc.property(
        commitHashArb,
        authorNameArb,
        authorEmailArb,
        isoDateArb,
        messageArb,
        repoIdArb,
        (hash, name, email, date, message, repoId) => {
          const rawLog = buildRawLog(hash, name, email, date, message);
          const result = parseGitLog(rawLog, repoId);

          // Exactly one record produced
          expect(result).toHaveLength(1);

          const record = result[0];

          // All fields are populated (non-null, non-undefined, non-empty)
          expect(record.repositoryId).toBeTruthy();
          expect(record.commitHash).toBeTruthy();
          expect(record.authorName).toBeTruthy();
          expect(record.authorEmail).toBeTruthy();
          expect(record.commitDate).toBeTruthy();
          expect(record.message).toBeTruthy();
          expect(record.changedFiles).toBeDefined();

          // Fields match input
          expect(record.repositoryId).toBe(repoId);
          expect(record.commitHash).toBe(hash);
          expect(record.authorName).toBe(name.trim());
          expect(record.authorEmail).toBe(email.trim());
          expect(record.commitDate).toBe(date.trim());
          expect(record.message).toBe(message.trim());
        }
      ),
      { numRuns: 200 }
    );
  });

  it('parseGitLog date field is a valid ISO 8601 string', () => {
    fc.assert(
      fc.property(
        commitHashArb,
        authorNameArb,
        authorEmailArb,
        isoDateArb,
        messageArb,
        repoIdArb,
        (hash, name, email, date, message, repoId) => {
          const rawLog = buildRawLog(hash, name, email, date, message);
          const result = parseGitLog(rawLog, repoId);
          const record = result[0];

          // The date should parse to a valid Date object
          const parsed = new Date(record.commitDate);
          expect(parsed.toString()).not.toBe('Invalid Date');
          expect(isNaN(parsed.getTime())).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('parseGitLog attaches file changes with correct count and valid change types', () => {
    fc.assert(
      fc.property(
        commitHashArb,
        authorNameArb,
        authorEmailArb,
        isoDateArb,
        messageArb,
        repoIdArb,
        fileChangesArb,
        (hash, name, email, date, message, repoId, fileChanges) => {
          // Build numstat and status outputs from generated file changes
          const numstatLines = fileChanges.map(
            fc => `${fc.additions}\t${fc.deletions}\t${fc.path}`
          );
          const statusLines = fileChanges.map(
            fc => `${fc.status}\t${fc.path}`
          );

          const parsedFiles = parseNumstat(
            numstatLines.join('\n'),
            statusLines.join('\n')
          );

          // Build the file changes structure expected by parseGitLog
          const fileChangesParam = [{
            hash,
            files: parsedFiles
          }];

          const rawLog = buildRawLog(hash, name, email, date, message);
          const result = parseGitLog(rawLog, repoId, fileChangesParam);
          const record = result[0];

          // Changed files count matches
          expect(record.changedFiles).toHaveLength(parsedFiles.length);

          // All change types are valid
          const validChangeTypes = ['added', 'modified', 'deleted'];
          for (const file of record.changedFiles) {
            expect(validChangeTypes).toContain(file.changeType);
            expect(file.path).toBeTruthy();
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('normalizeChangeType always returns a valid change type', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 5 }),
        (status) => {
          const result = normalizeChangeType(status);
          expect(['added', 'modified', 'deleted']).toContain(result);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('parseGitLog handles multiple records and preserves all fields', () => {
    const commitArb = fc.tuple(
      commitHashArb,
      authorNameArb,
      authorEmailArb,
      isoDateArb,
      messageArb
    );

    fc.assert(
      fc.property(
        fc.array(commitArb, { minLength: 1, maxLength: 10 }),
        repoIdArb,
        (commits, repoId) => {
          const rawLog = commits
            .map(([hash, name, email, date, msg]) =>
              buildRawLog(hash, name, email, date, msg)
            )
            .join('');

          const result = parseGitLog(rawLog, repoId);

          // All records parsed
          expect(result).toHaveLength(commits.length);

          // Each record matches its input
          for (let i = 0; i < commits.length; i++) {
            const [hash, name, email, date, msg] = commits[i];
            expect(result[i].commitHash).toBe(hash);
            expect(result[i].authorName).toBe(name.trim());
            expect(result[i].authorEmail).toBe(email.trim());
            expect(result[i].commitDate).toBe(date.trim());
            expect(result[i].message).toBe(msg.trim());
            expect(result[i].repositoryId).toBe(repoId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
