# JSOLOGCUSOPEREF-005: Centralize Component ID Constants

**Priority**: 🟡 High
**Estimated Effort**: 30 minutes (corrected from 2 hours)
**Phase**: 2 - High-Priority Refactoring
**Status**: ✅ Completed

---

## Summary

Component IDs like `'core:position'` and `'core:actor'` are hardcoded in 3 operator files. These should use the existing constants from `src/constants/componentIds.js`.

---

## Corrected Assumptions

**Original ticket assumed** `src/constants/componentIds.js` needed to be created.

**Actual state**: The file already exists with 49 lines and contains all needed constants:
- `POSITION_COMPONENT_ID = 'core:position'`
- `ACTOR_COMPONENT_ID = 'core:actor'`
- `EXITS_COMPONENT_ID = 'movement:exits'`

---

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/constants/componentIds.js` | **No change needed** - already exists with all constants |
| `src/logic/operators/isActorLocationLitOperator.js` | Modify - add import, replace 1 hardcoded ID |
| `src/logic/operators/locationHasExitsOperator.js` | Modify - add import, replace 2 hardcoded IDs |
| `src/logic/operators/hasOtherActorsAtLocationOperator.js` | Modify - add import, replace 3 hardcoded IDs |

---

## Out of Scope

**DO NOT modify:**
- Component schema files in `data/schemas/`
- Mod data files in `data/mods/`
- Test data files
- Files that don't use hardcoded component IDs
- Any operator logic (only imports and string usage)
- `src/constants/componentIds.js` (already complete)

---

## Implementation Details

### Step 1: Update isActorLocationLitOperator.js

Add import and replace hardcoded string:

```javascript
import { POSITION_COMPONENT_ID } from '../../constants/componentIds.js';

// Line 146: 'core:position' → POSITION_COMPONENT_ID
```

### Step 2: Update locationHasExitsOperator.js

```javascript
import { POSITION_COMPONENT_ID, EXITS_COMPONENT_ID } from '../../constants/componentIds.js';

// Line 141: 'core:position' → POSITION_COMPONENT_ID
// Line 156: 'movement:exits' → EXITS_COMPONENT_ID
```

### Step 3: Update hasOtherActorsAtLocationOperator.js

```javascript
import { POSITION_COMPONENT_ID, ACTOR_COMPONENT_ID } from '../../constants/componentIds.js';

// Line 141: 'core:position' → POSITION_COMPONENT_ID
// Line 164: 'core:position' → POSITION_COMPONENT_ID
// Line 175: 'core:actor' → ACTOR_COMPONENT_ID
```

---

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- tests/unit/logic/operators/isActorLocationLitOperator.test.js
npm run test:unit -- tests/unit/logic/operators/locationHasExitsOperator.test.js
npm run test:unit -- tests/unit/logic/operators/hasOtherActorsAtLocationOperator.test.js
```

### Specific Test Assertions

1. **All operator tests pass**: No behavior changes
2. **Component resolution works**: Operators still find components correctly

### Invariants That Must Remain True

1. **No behavior changes**: Operators function identically before and after
2. **String values unchanged**: The actual component ID strings must be exactly the same
3. **Import paths valid**: All imports resolve correctly

---

## Verification Commands

```bash
# Search for remaining hardcoded IDs (should find none in these 3 operators)
grep -E "'core:position'|'core:actor'|'movement:exits'" src/logic/operators/isActorLocationLitOperator.js src/logic/operators/locationHasExitsOperator.js src/logic/operators/hasOtherActorsAtLocationOperator.js

# Run specific operator tests
npm run test:unit -- tests/unit/logic/operators/isActorLocationLitOperator.test.js tests/unit/logic/operators/locationHasExitsOperator.test.js tests/unit/logic/operators/hasOtherActorsAtLocationOperator.test.js

# Lint modified files
npx eslint src/logic/operators/isActorLocationLitOperator.js src/logic/operators/locationHasExitsOperator.js src/logic/operators/hasOtherActorsAtLocationOperator.js
```

---

## Notes

- Constants file `src/constants/componentIds.js` already exists and is well-maintained
- No new constants needed - all required IDs already defined
- Pure refactoring - no new tests required

---

## Outcome

**Completed**: 2025-12-16

### Originally Planned vs Actual

| Aspect | Originally Planned | Actual |
|--------|-------------------|--------|
| Create `componentIds.js` | Yes | **Not needed** - file already existed |
| Constants to define | 7+ new constants | **0** - all already defined |
| Files to modify | "Multiple operator files" | **3 specific operators** |
| Estimated effort | 2 hours | **~15 minutes** |

### Changes Made

1. **isActorLocationLitOperator.js**: Added import, replaced 1 hardcoded `'core:position'`
2. **locationHasExitsOperator.js**: Added import, replaced 2 hardcoded strings (`'core:position'`, `'movement:exits'`)
3. **hasOtherActorsAtLocationOperator.js**: Added import, replaced 3 hardcoded strings (2× `'core:position'`, 1× `'core:actor'`)

### Tests

- All 73 existing operator tests pass
- No new tests required (pure refactoring with no behavior change)

### Verification

```bash
# No hardcoded component IDs remain in these operators
grep -E "'core:position'|'core:actor'|'movement:exits'" src/logic/operators/isActorLocationLitOperator.js src/logic/operators/locationHasExitsOperator.js src/logic/operators/hasOtherActorsAtLocationOperator.js
# Returns empty (no matches)
```
