# Error Handling Convention: Boundary-Only Normalization

## Overview

This document establishes the error normalization convention for the Living Narrative Engine codebase. The convention ensures consistent, testable error handling while eliminating unreachable code branches.

## The Problem

Prior to this convention, error normalization was duplicated across multiple layers:

- Private methods normalized errors before throwing
- Public methods normalized errors at catch boundaries
- This created unreachable code branches (the inner normalization guaranteed Error instances, making outer false branches unreachable)

### Evidence

Line 637's false branch in `gameEngine.js` was provably unreachable and was removed:

```javascript
// Before: Redundant normalization in private method
#doWork() {
  try {
    // ...
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err)); // Redundant!
  }
}

// Public method also normalizes
async execute() {
  try {
    await this.#doWork();
  } catch (err) {
    const normalized = err instanceof Error ? err : new Error(String(err)); // False branch unreachable!
    throw normalized;
  }
}
```

## The Convention

**Normalize at catch boundaries, not at throw sites.**

| Layer | Responsibility | Example |
|-------|----------------|---------|
| Private methods | Throw raw (whatever they catch) | `throw error;` |
| Public methods | Normalize at catch boundary | `const normalized = normalizeError(error);` |
| External calls | Always normalize before processing | `normalizeError(externalResult)` |

### Benefits

- Reduces unreachable branches
- Simplifies testing (fewer paths to cover)
- Clear documentation of responsibility
- Single source of truth for normalization logic

## Implementation Guide

### Using normalizeError()

```javascript
import { normalizeError, safeAugmentError } from '../utils/errorNormalization.js';

// At catch boundary (public method)
try {
  await this.#privateOperation();
} catch (error) {
  const normalized = normalizeError(error, 'operation context');
  throw normalized;
}
```

### Documenting Private Methods

When a private method DOES normalize (rare cases):

```javascript
/**
 * Performs X operation.
 * @throws {Error} Always throws Error instance (normalized internally)
 */
#specialPrivateMethod() {
  // Normalization here is exceptional and documented
}
```

### Error Augmentation

Use `safeAugmentError()` for property attachment:

```javascript
const error = normalizeError(caughtError);
if (!safeAugmentError(error, 'cause', originalError)) {
  safeAugmentError(error, 'fallbackProp', originalError);
}
```

## Examples

### Before (Redundant)

```javascript
// Private method normalizes
#doWork() {
  try {
    // ...
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err)); // Redundant!
  }
}

// Public method also normalizes
async execute() {
  try {
    await this.#doWork();
  } catch (err) {
    const normalized = err instanceof Error ? err : new Error(String(err)); // Unreachable false branch!
    throw normalized;
  }
}
```

### After (Convention Applied)

```javascript
// Private method throws raw
#doWork() {
  try {
    // ...
  } catch (err) {
    throw err; // Raw, no normalization
  }
}

// Public method normalizes at boundary
async execute() {
  try {
    await this.#doWork();
  } catch (err) {
    const normalized = normalizeError(err); // Single normalization point
    throw normalized;
  }
}
```

## Migration Guide

1. Identify all `err instanceof Error ? err : new Error(...)` patterns
2. Replace with `normalizeError(err)` at catch boundaries
3. Remove normalization from private methods (throw raw)
4. Update JSDoc if private methods DO normalize (document it)
5. Run tests to verify behavior unchanged

## Invariants

1. **All thrown errors MUST be Error instances**
   - Normalize at catch boundary only, not at throw site
   - Inner methods can trust callers to normalize

2. **Error augmentation MUST NOT throw**
   - Use defensive try-catch around property assignment
   - Fall back to alternative property names on failure

3. **Private methods that throw normalized errors MUST document it**
   - JSDoc: `@throws {Error} Always throws Error instance (normalized internally)`
   - Callers can skip redundant normalization

4. **Cleanup errors MUST be preserved**
   - Never swallow errors during cleanup
   - Use `cleanupErrors: Error[]` array for accumulation
   - Primary error gets all context attached

## Related Files

- `src/utils/errorNormalization.js` - The normalization utility
- `tests/unit/utils/errorNormalization.test.js` - Unit tests
- `tests/unit/utils/errorNormalization.property.test.js` - Property tests
- `specs/gameEngine-error-handling-robustness.md` - Original specification (archived)
