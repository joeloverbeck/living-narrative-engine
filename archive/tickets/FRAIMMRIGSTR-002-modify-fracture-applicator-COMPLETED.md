# FRAIMMRIGSTR-002: Modify FractureApplicator to Check for Rigid Structure

## Summary
Add rigid structure check to `FractureApplicator.apply()` method so that only parts with the `anatomy:has_rigid_structure` component can be fractured.

## Background
The FractureApplicator currently applies fractures to any part that meets the damage threshold, regardless of whether the part structurally can fracture. This leads to biologically incorrect fractures on soft tissue.

## File List

### Files to Modify
- `src/anatomy/applicators/fractureApplicator.js`
- `tests/unit/anatomy/applicators/fractureApplicator.test.js`

### Reference Files (read-only)
- `data/mods/anatomy/components/has_rigid_structure.component.json` (from FRAIMMRIGSTR-001)

## Out of Scope
- **DO NOT** modify any entity definition files (FRAIMMRIGSTR-004, FRAIMMRIGSTR-005)
- **DO NOT** create or modify integration/E2E tests (FRAIMMRIGSTR-006, FRAIMMRIGSTR-007)
- **DO NOT** modify other applicators (dismembermentApplicator, etc.)
 - Unit test updates in `tests/unit/anatomy/applicators/fractureApplicator.test.js` ARE in scope to cover the rigid-structure check and new dependency validation.

## Implementation Details

### 1. Add Constant (near existing component/event constants)
```javascript
/**
 * Component ID indicating a body part has rigid structure that can fracture.
 * @type {string}
 */
const HAS_RIGID_STRUCTURE_COMPONENT_ID = 'anatomy:has_rigid_structure';
```

### 2. Add hasComponent to Dependency Validation (constructor dependency validation)
Update the `validateDependency` call for entityManager to include `hasComponent`:
```javascript
validateDependency(entityManager, 'IEntityManager', logger, {
  requiredMethods: ['addComponent', 'hasComponent'],
});
```

### 3. Add Method (after meetsThreshold)
```javascript
/**
 * Check if a part has rigid structure (bones, carapace, etc.) that can fracture.
 * @param {string} partId - The part entity ID to check
 * @returns {boolean} True if the part has the anatomy:has_rigid_structure component
 */
hasRigidStructure(partId) {
  try {
    return this.#entityManager.hasComponent(partId, HAS_RIGID_STRUCTURE_COMPONENT_ID);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    this.#logger.warn(
      `FractureApplicator: Error checking rigid structure for ${partId}: ${message}`
    );
    return false; // Safe default: cannot fracture if check fails
  }
}
```

### 4. Modify apply() Method (after enabled check)
Insert after the `if (!damageEntryConfig?.enabled)` block:
```javascript
// Check if part has rigid structure that can fracture
if (!this.hasRigidStructure(partId)) {
  this.#logger.debug(
    `FractureApplicator: Part ${partId} lacks rigid structure, skipping fracture.`
  );
  return { triggered: false, stunApplied: false };
}
```

### 5. Export New Constant (module exports)
Add to exports:
```javascript
export {
  FractureApplicator,
  FRACTURED_COMPONENT_ID,
  STUNNED_COMPONENT_ID,
  FRACTURED_EVENT,
  DEFAULT_THRESHOLD_FRACTION,
  DEFAULT_STUN_DURATION,
  HAS_RIGID_STRUCTURE_COMPONENT_ID, // NEW
};
```

## Acceptance Criteria

### Tests That Must Pass
```bash
npm run typecheck
npx eslint src/anatomy/applicators/fractureApplicator.js
npm run test:unit -- tests/unit/anatomy/applicators/fractureApplicator.test.js --runInBand
```
- TypeScript type checking passes
- ESLint passes with no errors
- Unit tests updated for the new rigid-structure guard pass

### Invariants That Must Remain True
- The applicator follows the existing code style and patterns
- All existing logic is preserved (enabled check, threshold check, stun logic)
- The new check occurs AFTER enabled check but BEFORE threshold check
- Error handling follows safe-default pattern (cannot fracture on error)

## Estimated Diff Size
~40 lines of additions, ~2 lines of modifications

## Dependencies
- FRAIMMRIGSTR-001 (needs the component schema to exist)

## Blocked By
- FRAIMMRIGSTR-001

## Blocks
- FRAIMMRIGSTR-003 (tests need updated code)

## Status
Completed

## Outcome
- Added rigid-structure guard plus component constant/export and entityManager dependency validation in `src/anatomy/applicators/fractureApplicator.js`.
- Updated unit tests in `tests/unit/anatomy/applicators/fractureApplicator.test.js` to cover rigid-structure checks and new dependency requirements; integration/E2E tests unchanged.
