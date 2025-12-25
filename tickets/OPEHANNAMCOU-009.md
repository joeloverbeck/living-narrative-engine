# OPEHANNAMCOU-009: Create static analysis test for hardcoded constants

## Summary

Create a new test that performs static analysis on handler files to detect inline constant declarations. This prevents developers from accidentally introducing hardcoded component/event IDs in handlers.

## Files to Touch

- `tests/integration/validation/hardcodedConstantsStaticAnalysis.test.js` (NEW FILE)

## Out of Scope

- DO NOT modify any handler source files
- DO NOT modify constants files
- DO NOT modify existing tests
- DO NOT modify ESLint configuration (that's a separate concern)

## Changes

Create new test that performs static analysis on handler files:

### Test Structure

```javascript
import { describe, it, expect } from '@jest/globals';
import { glob } from 'glob';
import fs from 'fs';
import path from 'path';

describe('Hardcoded Constants Static Analysis', () => {
  const handlersDir = 'src/logic/operationHandlers';

  it('no handler declares inline component ID constants', async () => {
    const handlerFiles = await glob(`${handlersDir}/**/*Handler.js`);

    for (const filePath of handlerFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');

      // Pattern for inline constant declarations
      // Matches: const SOMETHING_COMPONENT_ID = '...'
      // But NOT import statements
      const inlineComponentIdPattern = /const\s+\w+_COMPONENT_ID\s*=\s*['"`]/g;
      const matches = content.match(inlineComponentIdPattern);

      if (matches) {
        // Verify these aren't from destructured imports
        // Check if the line is an import statement
        const lines = content.split('\n');
        const problematicLines = lines.filter(
          (line) =>
            inlineComponentIdPattern.test(line) && !line.trim().startsWith('import')
        );

        expect(problematicLines).toHaveLength(0);
      }
    }
  });

  it('no handler declares inline event ID constants', async () => {
    const handlerFiles = await glob(`${handlersDir}/**/*Handler.js`);

    for (const filePath of handlerFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');

      // Pattern for inline event constant declarations
      // Matches: const SOMETHING_EVENT = '...' or const SOMETHING_EVENT_ID = '...'
      const inlineEventIdPattern = /const\s+\w+_EVENT(?:_ID)?\s*=\s*['"`]/g;

      const lines = content.split('\n');
      const problematicLines = lines.filter(
        (line) => inlineEventIdPattern.test(line) && !line.trim().startsWith('import')
      );

      expect(problematicLines).toHaveLength(0);
    }
  });

  it('provides helpful error message identifying file and line', () => {
    // When a violation is found, error message should include:
    // - File path
    // - Line number
    // - The problematic constant declaration
    // - Suggestion to import from constants file
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

## Dependencies

- OPEHANNAMCOU-003 (handler should be updated before this test would pass)
- OPEHANNAMCOU-004 (handler should be updated before this test would pass)

## Implementation Order

Phase 4: Validation Tests (should run after Phase 2 handlers are updated)

## Notes

This test acts as a "lint rule in test form" - it will fail the test suite if anyone adds a hardcoded constant to a handler. This is complementary to the ESLint rule `no-hardcoded-mod-references` but catches the specific pattern that caused the ITEMSPLIT-007 bug.

Consider also checking for patterns like:
- `'modId:componentId'` string literals that aren't from constants
- Magic strings that look like component/event IDs
