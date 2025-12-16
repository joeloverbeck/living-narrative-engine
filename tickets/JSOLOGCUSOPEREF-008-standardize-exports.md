# JSOLOGCUSOPEREF-008: Standardize Export Patterns

**Priority**: 🟢 Medium
**Estimated Effort**: 1 hour
**Phase**: 3 - Medium-Priority Improvements

---

## Summary

The `JsonLogicCustomOperators` module uses both named and default exports, causing inconsistent import patterns across test files. Standardizing to named exports only will improve consistency and bundler optimization.

---

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/logic/jsonLogicCustomOperators.js` | Modify - remove default export |
| `tests/unit/logic/jsonLogicCustomOperators.test.js` | Modify - use named import |
| Any other files importing with default import | Modify - use named import |

---

## Out of Scope

**DO NOT modify:**
- Any operator files
- DI registration files (they typically use the class reference directly)
- Files that already use named imports correctly

---

## Implementation Details

### Step 1: Find All Import Usages

```bash
grep -r "import JsonLogicCustomOperators from" src/ tests/
grep -r "import { JsonLogicCustomOperators }" src/ tests/
```

### Step 2: Update Source File

```javascript
// src/logic/jsonLogicCustomOperators.js

// Keep only named export
export class JsonLogicCustomOperators extends BaseService {
  // ... implementation
}

// REMOVE this line:
// export default JsonLogicCustomOperators;
```

### Step 3: Update Import Statements

```javascript
// Before (default import)
import JsonLogicCustomOperators from '../../../src/logic/jsonLogicCustomOperators.js';

// After (named import)
import { JsonLogicCustomOperators } from '../../../src/logic/jsonLogicCustomOperators.js';
```

---

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- tests/unit/logic/jsonLogicCustomOperators.test.js
npm run test:unit -- tests/unit/logic/
npm run test:integration -- tests/integration/logic/
```

### Specific Test Assertions

1. **All imports resolve**: No "module has no default export" errors
2. **All tests pass**: No behavior changes

### Invariants That Must Remain True

1. **No behavior changes**: Class functions identically
2. **All imports work**: Every file that imports the class can do so
3. **Build works**: `npm run build` succeeds
4. **TypeCheck passes**: `npm run typecheck` has no new errors

---

## Verification Commands

```bash
# Find remaining default imports (should be 0)
grep -r "import JsonLogicCustomOperators from" src/ tests/

# Build to verify bundling works
npm run build

# Type check
npm run typecheck

# Run tests
npm run test:ci
```

---

## Notes

- This is a simple search-and-replace refactoring
- Named exports enable tree-shaking in bundlers
- Consistent import patterns improve code readability
- Consider doing this for other files with dual exports in a future cleanup
