# DEABRADET-004: AlternativeIdGenerator Service

## Description

Create a service that generates stable, order-invariant IDs for alternatives using a hash of sorted clause refs. This ensures spec invariant 1 (order-invariance) is satisfied.

## Files to Create

- `src/expressionDiagnostics/services/AlternativeIdGenerator.js`
- `tests/unit/expressionDiagnostics/services/AlternativeIdGenerator.test.js`

## Files to Modify

- `src/dependencyInjection/tokens/tokens-diagnostics.js` - Add `IAlternativeIdGenerator` token
- `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` - Add registration

## Out of Scope

- StructuralImpossibilityAnalyzer (DEABRADET-005)
- Any detection logic
- Integration with detector
- Other services

## Implementation Details

### AlternativeIdGenerator.js

```javascript
/**
 * @file AlternativeIdGenerator - Generates stable, order-invariant IDs for alternatives
 * @see specs/dead-branch-detection.md
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { createHash } from 'crypto';

class AlternativeIdGenerator {
  #logger;

  constructor({ logger }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    this.#logger = logger;
  }

  /**
   * Generate a stable, order-invariant ID for an alternative.
   * @param {string[]} clauseRefs - Array of clause references
   * @returns {string} ID in format "alt_" + 12-char hex hash
   */
  generate(clauseRefs) {
    // Sort alphabetically for order-invariance
    const sorted = [...clauseRefs].sort();
    const canonical = sorted.join('|');

    // Use SHA-256 and take first 12 hex characters
    const hash = createHash('sha256')
      .update(canonical)
      .digest('hex')
      .slice(0, 12);

    const id = `alt_${hash}`;

    this.#logger.debug(`AlternativeIdGenerator: Generated ID ${id} for ${sorted.length} clauseRefs`);

    return id;
  }
}

export default AlternativeIdGenerator;
```

### DI Token

Add to `tokens-diagnostics.js`:
```javascript
// Dead Branch Detection (DEABRADET series)
IAlternativeIdGenerator: 'IAlternativeIdGenerator',
```

### DI Registration

Add to `expressionDiagnosticsRegistrations.js`:
```javascript
registrar.singletonFactory(
  diagnosticsTokens.IAlternativeIdGenerator,
  (c) => new AlternativeIdGenerator({
    logger: c.resolve(tokens.ILogger),
  })
);
```

## Acceptance Criteria

### Tests That Must Pass

1. **AlternativeIdGenerator.test.js**:
   - Constructor throws if `logger` is missing
   - Constructor throws if `logger` is invalid (missing methods)
   - `generate(['a', 'b', 'c'])` returns string starting with "alt_"
   - `generate(['a', 'b', 'c'])` returns 16-char string (alt_ + 12 hex)
   - **Spec test 3.7 (order invariance)**: `generate(['c', 'a', 'b'])` === `generate(['a', 'b', 'c'])`
   - **Spec test 3.7 (order invariance)**: `generate(['z', 'a'])` === `generate(['a', 'z'])`
   - `generate([])` handles empty array (returns consistent ID)
   - `generate(['single'])` handles single element
   - Calls logger.debug with generated ID
   - Same inputs always produce same output (deterministic)
   - Different inputs produce different outputs (low collision probability)

2. **DI Registration tests** (in expressionDiagnosticsRegistrations.test.js):
   - `IAlternativeIdGenerator` token resolves successfully
   - Resolved instance has `generate` method

### Invariants That Must Remain True

1. **Spec invariant 1**: Reordering clauseRefs MUST NOT change output ID
2. Output format is always `alt_` + exactly 12 hex characters (16 chars total)
3. Same input always produces same output (deterministic)
4. Service is stateless (no instance state beyond logger)
5. Existing tests in `tests/unit/expressionDiagnostics/` continue to pass
6. Existing tests in `tests/unit/dependencyInjection/` continue to pass
7. `npm run typecheck` passes
8. `npx eslint src/expressionDiagnostics/services/AlternativeIdGenerator.js` passes

## Dependencies

None - this service has no dependencies on other DEABRADET tickets.

## Estimated Diff Size

~60 lines of source code + ~120 lines of tests + ~10 lines DI = ~190 lines total
