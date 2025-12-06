# DISBODPARSPA-020: Update EntityGraphBuilder to Store `definitionId` in `anatomy:part`

**STATUS: COMPLETED**

## Summary

Modify the `EntityGraphBuilder` to populate the `definitionId` field in the `anatomy:part` component when building entity anatomy graphs. This enables tracing body part instances back to their original entity definitions for spawning purposes.

---

## Outcome

### What Was Actually Changed vs Originally Planned

**Originally Planned:**

- Add logic to store `definitionId` in `anatomy:part` component when body parts are created

**Actually Implemented:**

- Modified `src/anatomy/entityGraphBuilder.js`:
  - `createRootEntity()`: Added block (lines 174-194) to update `anatomy:part` with `definitionId` after root entity creation
  - `createAndAttachPart()`: Extended existing orientation update logic to always include `definitionId`, even when no orientation is provided

**Key Implementation Detail:**
The ticket pseudocode suggested using `componentMutationService`, but the actual code uses `entityManager.addComponent()` which was already the pattern used elsewhere in the file. This maintains consistency with the existing codebase.

### Tests Modified/Added

| Test File                                       | Change                                                                         | Rationale                                                    |
| ----------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| `tests/unit/anatomy/entityGraphBuilder.test.js` | Renamed "propagates orientation from socket to child anatomy:part"             | Now tests both `definitionId` AND orientation                |
| `tests/unit/anatomy/entityGraphBuilder.test.js` | Added "stores definitionId in anatomy:part even without orientation"           | Verifies `definitionId` is stored when no orientation exists |
| `tests/unit/anatomy/entityGraphBuilder.test.js` | Added "does not update anatomy:part when component is missing"                 | Edge case coverage                                           |
| `tests/unit/anatomy/entityGraphBuilder.test.js` | Added "stores definitionId in anatomy:part for root entity"                    | Covers `createRootEntity()` path                             |
| `tests/unit/anatomy/entityGraphBuilder.test.js` | Added "stores actualRootDefinitionId in anatomy:part when torso override used" | Verifies correct ID when recipe override is applied          |

### Test Results

- All 27 unit tests pass
- All 17 integration tests pass
- ESLint: No new errors (only pre-existing warnings)

### Acceptance Criteria Status

- [x] All existing unit tests for `EntityGraphBuilder` continue to pass
- [x] All existing integration tests continue to pass
- [x] `npm run test:unit` passes
- [x] `npm run test:integration` passes
- [x] Backward compatible (definitionId is optional in schema)
- [x] No runtime errors
- [x] Correct definition IDs stored
- [x] Component data integrity maintained
- [x] Event flow unchanged

---

## Files to Touch

| File                                | Change Type | Description                                               |
| ----------------------------------- | ----------- | --------------------------------------------------------- |
| `src/anatomy/entityGraphBuilder.js` | Modify      | Add logic to store definitionId in anatomy:part component |

---

## Out of Scope

The following are **explicitly NOT part of this ticket**:

- `data/mods/anatomy/components/part.component.json` - Schema changes are in DISBODPARSPA-001
- `src/anatomy/services/dismemberedBodyPartSpawner.js` - Spawner service is DISBODPARSPA-021
- `src/entities/entity.js` - No changes to base Entity class
- Entity definition files - No need to add definitionId to static definitions

**Note**: Tests originally scoped to DISBODPARSPA-031 are now included in this ticket per implementation request.

---

## Implementation Details

### Current Behavior

The `EntityGraphBuilder` creates body part entities from entity definitions but does NOT persist the `definitionId` in the `anatomy:part` component data. The definition ID is only available at runtime via `entity.definitionId` getter.

### Required Change

When the EntityGraphBuilder creates a body part entity from an entity definition, it should store the definition ID in the `anatomy:part` component:

**Pseudocode:**

```javascript
// When creating a body part entity
const bodyPartEntity = this.#entityFactory.createFromDefinition(definitionId, ...);

// After entity creation, update the anatomy:part component with definitionId
const anatomyPartComponent = bodyPartEntity.getComponentData('anatomy:part');
if (anatomyPartComponent) {
  this.#componentMutationService.updateComponent(
    bodyPartEntity.id,
    'anatomy:part',
    { ...anatomyPartComponent, definitionId: definitionId }
  );
}
```

### Key Integration Points

1. **Where body parts are created**: Find the method that instantiates body part entities from definitions
2. **Component update**: Use the appropriate service to update component data
3. **Definition ID source**: Use the entity definition ID that was passed to the factory

### Expected Behavior After Change

For a body part created from `anatomy:human_foot`:

```json
{
  "anatomy:part": {
    "subType": "foot",
    "hit_probability_weight": 3,
    "definitionId": "anatomy:human_foot"
  }
}
```

---

## Acceptance Criteria

### Tests That Must Pass

1. ✅ All existing unit tests for `EntityGraphBuilder` continue to pass
2. ✅ All existing integration tests continue to pass
3. ✅ `npm run test:unit` passes
4. ✅ `npm run test:integration` passes

### Validation Commands

```bash
# Run all tests
npm run test:unit
npm run test:integration

# Run specific EntityGraphBuilder tests
npm run test:unit -- --testPathPattern="entityGraphBuilder"

# Type check
npm run typecheck
```

### Invariants That Must Remain True

1. **Backward Compatibility**: Existing entity graphs must continue to work (definitionId is optional)
2. **No Runtime Errors**: Adding definitionId must not cause errors for existing code
3. **Correct Definition IDs**: Each body part's definitionId must match the definition it was created from
4. **Component Data Integrity**: No other component data should be modified
5. **Event Flow**: Normal entity creation events should still fire

### Manual Verification

After implementation, verify:

1. Create a new character with anatomy
2. Inspect a body part entity's `anatomy:part` component
3. Confirm `definitionId` field is present and correct

---

## Dependencies

- DISBODPARSPA-001 (Schema must include `definitionId` field first)

## Blocks

- DISBODPARSPA-021 (Spawner service reads definitionId from anatomy:part)
- DISBODPARSPA-031 (Unit tests for this functionality) - **NOW COMPLETED AS PART OF THIS TICKET**
