# OPEHANNAMCOU-009: Create static analysis test for hardcoded constants

## Status

Completed

## Summary

Create a new integration test that performs static analysis on handler files to detect **new** inline constant declarations for component/event IDs. The codebase currently contains legacy inline constants in several handlers, so this test will allowlist the existing violations and fail only on new ones. This prevents regressions while preserving current handler behavior until migrations are complete.

## Files to Touch

- `tests/integration/validation/hardcodedConstantsStaticAnalysis.test.js` (NEW FILE)

## Out of Scope

- DO NOT modify any handler source files
- DO NOT modify constants files
- DO NOT modify ESLint configuration (that's a separate concern)
- Avoid touching existing tests unless required to share helpers (not expected)

## Changes

Create new test that performs static analysis on handler files:

### Test Structure

```javascript
import { describe, it, expect } from '@jest/globals';
import { glob } from 'glob';
import fs from 'fs';
import path from 'path';

const LEGACY_INLINE_CONSTANTS = new Set([
  // Entries are `${relativePath}:${lineNumber}:${constantName}`
  // Populated from current handler inline constants; test should only fail on new entries.
]);

describe('Hardcoded Constants Static Analysis', () => {
  const handlersDir = 'src/logic/operationHandlers';

  it('no handler declares inline component ID constants beyond legacy allowlist', async () => {
    const handlerFiles = await glob(`${handlersDir}/**/*Handler.js`);

    const violations = [];
    for (const filePath of handlerFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');

      // Pattern for inline constant declarations
      // Matches: const SOMETHING_COMPONENT_ID = '...'
      // But NOT import statements
      const inlineComponentIdPattern = /const\s+(\w+_COMPONENT_ID)\s*=\s*['"`]/;
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (
          trimmed.startsWith('import') ||
          trimmed.startsWith('//') ||
          trimmed.startsWith('/*') ||
          trimmed.startsWith('*')
        ) {
          return;
        }
        const match = trimmed.match(inlineComponentIdPattern);
        if (match) {
          const entry = `${filePath}:${index + 1}:${match[1]}`;
          if (!LEGACY_INLINE_CONSTANTS.has(entry)) {
            violations.push({ filePath, lineNumber: index + 1, line });
          }
        }
      });
    }

    if (violations.length > 0) {
      const message = violations
        .map(
          ({ filePath, lineNumber, line }) =>
            `${filePath}:${lineNumber} ${line.trim()}`
        )
        .join('\n');
      throw new Error(
        [
          'New inline component ID constants detected.',
          message,
          'Import component IDs from src/constants/componentIds.js instead.',
        ].join('\n')
      );
    }
  });

  it('no handler declares inline event ID constants beyond legacy allowlist', async () => {
    const handlerFiles = await glob(`${handlersDir}/**/*Handler.js`);

    const violations = [];
    for (const filePath of handlerFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');

      // Pattern for inline event constant declarations
      // Matches: const SOMETHING_EVENT = '...' or const SOMETHING_EVENT_ID = '...'
      const inlineEventIdPattern = /const\s+(\w+_EVENT(?:_ID)?)\s*=\s*['"`]/;
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (
          trimmed.startsWith('import') ||
          trimmed.startsWith('//') ||
          trimmed.startsWith('/*') ||
          trimmed.startsWith('*')
        ) {
          return;
        }
        const match = trimmed.match(inlineEventIdPattern);
        if (match) {
          const entry = `${filePath}:${index + 1}:${match[1]}`;
          if (!LEGACY_INLINE_CONSTANTS.has(entry)) {
            violations.push({ filePath, lineNumber: index + 1, line });
          }
        }
      });
    }

    if (violations.length > 0) {
      const message = violations
        .map(
          ({ filePath, lineNumber, line }) =>
            `${filePath}:${lineNumber} ${line.trim()}`
        )
        .join('\n');
      throw new Error(
        [
          'New inline event ID constants detected.',
          message,
          'Import event IDs from src/constants/eventIds.js instead.',
        ].join('\n')
      );
    }
  });

  it('provides helpful error message identifying file and line', () => {
    // Covered by failure message in the component/event tests.
  });
});
```

## Acceptance Criteria

### Tests That Must Pass

- `NODE_ENV=test npx jest tests/integration/validation/hardcodedConstantsStaticAnalysis.test.js --no-coverage` passes
- `npx eslint tests/integration/validation/hardcodedConstantsStaticAnalysis.test.js` passes

### Invariants

- Test is read-only (no file modifications)
- Test catches the exact pattern that caused the original bug (`const X_COMPONENT_ID = '...'`)
- Test ignores import statements (doesn't false-positive on `import { X_COMPONENT_ID }`)
- Test scans ALL handler files, not just specific ones
- Test provides actionable error messages
- Test only fails on new inline constants beyond the legacy allowlist

## Dependencies

- OPEHANNAMCOU-003 and OPEHANNAMCOU-004 remain required to remove legacy allowlist entries.

## Implementation Order

Phase 4: Validation Tests (compatible with current handlers via legacy allowlist)

## Notes

This test acts as a "lint rule in test form" - it will fail the test suite if anyone adds a hardcoded constant to a handler. This is complementary to the ESLint rule `no-hardcoded-mod-references` but catches the specific pattern that caused the ITEMSPLIT-007 bug. Existing inline constants are allowlisted until migrations are complete.

## Outcome

- Added a new static analysis test with a legacy allowlist to prevent new inline component/event constants.
- Updated scope/assumptions to acknowledge existing handler inline constants and avoid blocking current behavior.

Consider also checking for patterns like:
- `'modId:componentId'` string literals that aren't from constants
- Magic strings that look like component/event IDs
