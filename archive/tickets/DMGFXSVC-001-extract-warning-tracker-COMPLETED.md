# DMGFXSVC-001: Extract WarningTracker Service

## Summary
Extract the warn-once caching logic from `DamageTypeEffectsService` into a standalone, injectable `WarningTracker` service.

## Motivation
The current warn-once mechanism uses internal `Set` caches (`#missingDefinitionWarnings`, `#missingOrderWarnings`) that:
- Cannot be cleared between tests without creating new service instances
- Affect test isolation (tests at lines 1727-1778 require workarounds)
- Are not reusable by other services

## Files to Touch

### Create
- `src/anatomy/services/warningTracker.js` - New service class
- `tests/unit/anatomy/services/warningTracker.test.js` - Unit tests

### Modify
- `src/dependencyInjection/tokens/tokens-core.js` - Add `WarningTracker` token
- `src/dependencyInjection/registrations/worldAndEntityRegistrations.js` - Register service

## Out of Scope
- **DO NOT** modify `damageTypeEffectsService.js` in this ticket (integration is DMGFXSVC-009)
- **DO NOT** modify existing `damageTypeEffectsService.test.js` tests
- **DO NOT** change any event payloads or component data
- **DO NOT** modify `StatusEffectRegistry` or `FALLBACK_EFFECT_DEFINITIONS`

## Implementation Details

### WarningTracker API
```javascript
class WarningTracker {
  #caches = new Map(); // category -> Set<key>
  #logger;

  constructor({ logger }) { ... }

  /**
   * Log a warning only once per category+key combination.
   * @param {string} category - Warning category (e.g., 'missingDefinition')
   * @param {string} key - Unique key within category
   * @param {string} message - Warning message
   */
  warnOnce(category, key, message) { ... }

  /**
   * Check if a warning has been issued.
   * @param {string} category
   * @param {string} key
   * @returns {boolean}
   */
  hasWarned(category, key) { ... }

  /**
   * Clear all warnings (for testing).
   */
  clear() { ... }

  /**
   * Clear warnings for a specific category (for testing).
   * @param {string} category
   */
  clearCategory(category) { ... }
}
```

### DI Token
Add to `tokens-core.js`:
```javascript
WarningTracker: 'WarningTracker',
```

### Registration
Add to world and entity registrations:
```javascript
registrar.singletonFactory(tokens.WarningTracker, (c) => {
  return new WarningTracker({
    logger: c.resolve(tokens.ILogger),
  });
});
```

## Acceptance Criteria

### Tests That Must Pass

#### New Tests (warningTracker.test.js)
1. `constructor - validates logger dependency`
2. `warnOnce - logs warning on first call`
3. `warnOnce - suppresses warning on subsequent calls with same category+key`
4. `warnOnce - logs warning for different keys in same category`
5. `warnOnce - logs warning for same key in different categories`
6. `hasWarned - returns false before warning issued`
7. `hasWarned - returns true after warning issued`
8. `clear - resets all warning caches`
9. `clear - allows same warning to be logged again`
10. `clearCategory - only clears specified category`
11. `clearCategory - preserves other categories`

#### Existing Tests
- All 68 existing `damageTypeEffectsService.test.js` tests must pass unchanged

### Invariants That Must Remain True
- **INV-7**: Warn-once caches accumulate but never shrink during service lifetime (unless explicitly cleared)
- New service is a singleton (one instance per container)
- Warning suppression behavior is identical to current implementation

## Verification Commands
```bash
# Run new tests
npm run test:unit -- tests/unit/anatomy/services/warningTracker.test.js

# Verify existing tests still pass
npm run test:unit -- tests/unit/anatomy/services/damageTypeEffectsService.test.js

# Verify DI registration compiles
npm run typecheck
```

## Size Estimate
- ~50 lines of implementation code
- ~100 lines of test code
- ~5 lines of DI registration

## Status
Completed

## Outcome
Added WarningTracker service, tests, and DI registration/token. No changes to DamageTypeEffectsService integration (still deferred to DMGFXSVC-009).
