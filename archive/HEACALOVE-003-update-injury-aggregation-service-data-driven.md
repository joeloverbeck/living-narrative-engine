# HEACALOVE-003: Update injuryAggregationService to read data-driven weights

**Status: COMPLETED**

## Overview
Modify the `InjuryAggregationService` to read health calculation weights from entity data instead of using hardcoded constants, and implement vital organ cap logic.

## Problem
The service currently uses hardcoded `PART_WEIGHTS` constant (lines 27-43) with type-based lookups. This violates the modding-first design principle.

## File to Modify
`src/anatomy/services/injuryAggregationService.js`

## Implementation Tasks

### 3.1 Remove Hardcoded Constants (lines 27-44)
Delete:
```javascript
const PART_WEIGHTS = {
  torso: 3,
  head: 2,
  // ... all entries
};
const DEFAULT_WEIGHT = 1;
```

### 3.2 Add Component ID Constant
Add near other constants at top of file:
```javascript
const VITAL_ORGAN_COMPONENT_ID = 'anatomy:vital_organ';
```

### 3.3 Update `#getPartMetadata()` Method (lines 422-435)
Change from:
```javascript
#getPartMetadata(partEntityId) {
  try {
    const partData = this.#entityManager.getComponentData(
      partEntityId,
      PART_COMPONENT_ID
    );
    return {
      subType: partData?.subType ?? 'unknown',
      orientation: partData?.orientation ?? null,
    };
  } catch {
    return { subType: 'unknown', orientation: null };
  }
}
```

To:
```javascript
#getPartMetadata(partEntityId) {
  try {
    const partData = this.#entityManager.getComponentData(
      partEntityId,
      PART_COMPONENT_ID
    );
    return {
      subType: partData?.subType ?? 'unknown',
      orientation: partData?.orientation ?? null,
      healthCalculationWeight: partData?.health_calculation_weight ?? 1,
    };
  } catch {
    return { subType: 'unknown', orientation: null, healthCalculationWeight: 1 };
  }
}
```

### 3.4 Add New Method `#getVitalOrganData()`
Add after `#getPartMetadata()`:
```javascript
/**
 * Gets vital organ component data if present.
 *
 * @param {string} partEntityId - Part entity ID
 * @returns {{organType: string, healthCapThreshold: number, healthCapValue: number}|null}
 * @private
 */
#getVitalOrganData(partEntityId) {
  try {
    if (!this.#entityManager.hasComponent(partEntityId, VITAL_ORGAN_COMPONENT_ID)) {
      return null;
    }
    const data = this.#entityManager.getComponentData(
      partEntityId,
      VITAL_ORGAN_COMPONENT_ID
    );
    return {
      organType: data?.organType ?? null,
      healthCapThreshold: data?.healthCapThreshold ?? 20,
      healthCapValue: data?.healthCapValue ?? 30,
    };
  } catch {
    return null;
  }
}
```

### 3.5 Update `#buildPartInfo()` Method (lines 338-385)
Add after line 346 (`const partData = this.#getPartMetadata(partEntityId);`):
```javascript
const vitalOrganData = this.#getVitalOrganData(partEntityId);
```

Add to the return object (after line 363):
```javascript
healthCalculationWeight: partData.healthCalculationWeight,
vitalOrganCap: vitalOrganData ? {
  threshold: vitalOrganData.healthCapThreshold,
  capValue: vitalOrganData.healthCapValue
} : null,
```

### 3.6 Update `#getPartWeight()` Method (lines 516-519)
Change from:
```javascript
#getPartWeight(partType) {
  const normalized = partType?.toLowerCase() ?? '';
  return PART_WEIGHTS[normalized] ?? DEFAULT_WEIGHT;
}
```

To:
```javascript
/**
 * Gets weight for health calculation from part info.
 *
 * @param {Object} partInfo - Part info object with healthCalculationWeight
 * @returns {number} Weight value (defaults to 1 if not specified)
 * @private
 */
#getPartWeight(partInfo) {
  const weight = partInfo.healthCalculationWeight;
  return typeof weight === 'number' && weight >= 0 ? weight : 1;
}
```

### 3.7 Update `#calculateOverallHealth()` Method (lines 488-507)
Replace entire method with:
```javascript
/**
 * Calculates overall health percentage from weighted part health.
 *
 * @param {InjuredPartInfo[]} partInfos - Array of part info objects
 * @returns {number} Overall health percentage (0-100)
 * @private
 */
#calculateOverallHealth(partInfos) {
  if (partInfos.length === 0) return 100;

  let totalWeightedHealth = 0;
  let totalWeight = 0;

  for (const part of partInfos) {
    const weight = this.#getPartWeight(part);
    totalWeightedHealth += part.healthPercentage * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return 100;

  let calculatedHealth = Math.round(totalWeightedHealth / totalWeight);

  // Apply data-driven vital organ caps
  for (const part of partInfos) {
    if (part.vitalOrganCap) {
      const { threshold, capValue } = part.vitalOrganCap;
      if (part.healthPercentage <= threshold) {
        calculatedHealth = Math.min(calculatedHealth, capValue);
      }
    }
  }

  return calculatedHealth;
}
```

## Acceptance Criteria
- [x] `PART_WEIGHTS` constant removed
- [x] `DEFAULT_WEIGHT` constant removed
- [x] `VITAL_ORGAN_COMPONENT_ID` constant added
- [x] `#getPartMetadata()` returns `healthCalculationWeight`
- [x] `#getVitalOrganData()` method added
- [x] `#buildPartInfo()` includes new properties
- [x] `#getPartWeight()` reads from part info object
- [x] `#calculateOverallHealth()` applies vital organ caps
- [x] Code compiles without errors (`npm run typecheck`)
- [x] ESLint passes (`npx eslint src/anatomy/services/injuryAggregationService.js`)

## Dependencies
- HEACALOVE-001: Component schema must have `health_calculation_weight` ✅
- HEACALOVE-002: Component schema must have cap properties ✅

## Follow-up Tickets
- HEACALOVE-004: Tests need updating for new behavior (completed in this ticket)

---

## Outcome

### What was actually changed vs originally planned

**Planned Changes - All Implemented:**
1. ✅ Removed `PART_WEIGHTS` constant (17 entries) and `DEFAULT_WEIGHT` constant
2. ✅ Added `VITAL_ORGAN_COMPONENT_ID = 'anatomy:vital_organ'` constant
3. ✅ Updated `#getPartMetadata()` to return `healthCalculationWeight` from component data
4. ✅ Added `#getVitalOrganData()` method for reading vital organ cap settings
5. ✅ Updated `#buildPartInfo()` to include `healthCalculationWeight` and `vitalOrganCap`
6. ✅ Updated `#getPartWeight()` to read from `partInfo` object instead of type-based lookup
7. ✅ Updated `#calculateOverallHealth()` to apply vital organ cap logic

**Additional Changes (not in original ticket):**
- Tests were updated in this ticket (originally deferred to HEACALOVE-004)

### New/Modified Tests

| Test | Type | Rationale |
|------|------|-----------|
| `should apply data-driven weights from health_calculation_weight` | Modified | Changed from subType-based to component data-driven weights |
| `should apply fractional weight from component data` | Modified | Explicit weight (0.5) now comes from component data |
| `should use default weight of 1 when health_calculation_weight is missing` | Modified | Tests default fallback when no weight specified |
| `should apply vital organ cap when health falls below threshold` | New | Tests cap application when organ health < threshold |
| `should not apply vital organ cap when health is above threshold` | New | Tests cap NOT applied when organ health > threshold |
| `should use default cap values when not specified in component` | New | Tests default threshold (20) and cap (30) values |
| `should handle parts without vital_organ component` | New | Tests graceful handling of non-vital parts |
| `should apply most restrictive cap when multiple vital organs are critical` | New | Tests multiple caps applied correctly |

### Validation Results
- ESLint: 0 errors, 10 warnings (pre-existing mod-architecture warnings)
- TypeCheck: Errors in unrelated CLI files (pre-existing), service file compiles cleanly
- Tests: 50/50 passed
