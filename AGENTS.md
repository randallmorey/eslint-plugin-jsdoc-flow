# AGENTS.md

`eslint-plugin-jsdoc-flow` is an ESLint plugin (flat config, ESM-only, ESLint
9.15+ or 10, Node 20.19+) whose autofixable rules flow the text of `/** */`
comments: sentence spacing, line wrapping, tag and list alignment, and line
prefixes. Its fixes may change only whitespace and line prefixes, never any
other character.

## Layout

- `lib/flow.js`: the text engine (tokenizing, filling, alignment). Most
  behavior lives here.
- `lib/rules/block.js`: shared rule plumbing (`findingRule` and friends).
  Each file in `lib/rules/` is one rule, usually a thin wrapper.
- `lib/settings.js`: the shared `settings['jsdoc-flow']` schema and
  validation.
- `lib/index.js`: the plugin, its rules, and the `recommended` config.
- `lib/index.d.ts`: **generated** by `npm run types` (`scripts/types.js`).
  Don't edit it by hand; a test fails when it's stale.
- `tests/*.test.js`: `node:test` suites; `tests/cases/` holds shared
  `RuleTester` cases, and `tests/helpers.js` holds helpers such as `block()`.
- `tests/corpus/`: vendored real files, fixed by every rule and checked
  against `snapshot.json`. Don't edit or lint them.

## Commands

```sh
npm test               # all tests (strict mode via tests/setup.js)
npm run lint           # eslint, prettier, tsc, type tests, and package checks
npm run lint:fix       # eslint --fix and prettier --write
npm run types          # regenerate lib/index.d.ts
npm run test:coverage  # tests with coverage thresholds (measured on Node 22)
npm run test:corpus    # corpus check only
npm run corpus:update  # accept intended formatting changes to the corpus
npm run test:fuzz      # property tests; FUZZ_RUNS and FUZZ_SEED reproduce one
```

Run one file or filter by name:

```sh
node --import ./tests/setup.js --test --test-reporter=./tests/reporter.js tests/reflow.test.js
node --import ./tests/setup.js --test --test-reporter=./tests/reporter.js --test-name-pattern='tag-align' tests/
```

### Pipe test output to a file

The suite prints one line per test, which wastes context. Always redirect
test (and lint) output to a file, then inspect only what you need:

```sh
npm test > "${TMPDIR:-/tmp}/test.log" 2>&1; echo "exit $?"
tail -n 12 "${TMPDIR:-/tmp}/test.log"          # summary (pass/fail counts)
grep -n -A 20 '^✗' "${TMPDIR:-/tmp}/test.log"  # failures and their errors
```

Failures are repeated with their errors after the per-test lines, so the end
of the log is usually all you need.

## Conventions

- The plugin lints its own `lib/` comments, so write JSDoc and comments the
  way the rules want: two spaces after sentences and colons, and wrapped at
  80 columns. `npm run lint:fix` settles them.
- Every function in `lib/` needs JSDoc. Prose comments explain why, not what.
- Formatting is Prettier (single quotes, two-space indent, LF line endings).
- Adding or changing a rule usually touches its file in `lib/rules/`,
  `lib/index.js`, cases in `tests/cases/` and their test file, and the rule
  table in `README.md`. Then run `npm run types`, plus
  `npm run corpus:update` if the formatting output changes.
- Before finishing, `npm run lint` and `npm test` must both pass.
- Keep `README.md` short: introduce the plugin and get people running, no
  implementation detail.
- Use Oxford commas in all prose, including docs, commits, and PRs.

## Git and releases

- Branch off `main` with a prefix (`feat/`, `fix/`, `test/`, `release/`) and
  merge by PR.
- Commit messages use Conventional Commit prefixes: `feat:`, `fix:`, `perf:`,
  `test:`, `ci:`, `release:`.
- A release is a PR that only bumps `version` in `package.json` and
  `package-lock.json` (`release: vX.Y.Z`). On merge, `publish.yml` tags, makes
  the GitHub release, and publishes to npm. Keep the process this simple.
