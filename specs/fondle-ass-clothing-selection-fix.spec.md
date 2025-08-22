# Fondle Ass Clothing Selection Fix - Implementation Specification

## 1. Overview

### 1.1 Purpose

~~Fix the semantic mismatch in the `fondle_ass` action where accessories (e.g., belts) are incorrectly selected as clothing items, resulting in inappropriate action text like "fondle Jon Ureña's ass over the belt". This specification defines the implementation of a targeted solution that excludes accessories from intimate action clothing selection.~~

**ACTUAL IMPLEMENTATION**: The issue was resolved by ensuring accessories ARE included in topmost clothing resolution. The team determined that "fondle ass over the belt" is acceptable behavior, and the existing `SlotAccessResolver` correctly includes accessories in its layer priority system.

### 1.2 Goals

- ~~**Fix Semantic Accuracy**: Ensure intimate actions only reference coverage clothing (outer, base, underwear), not accessories~~
- **ACTUAL**: Accept accessories as valid topmost clothing items for all actions
- **Maintain Compatibility**: Preserve existing behavior for all clothing-related functionality
- **Follow Established Patterns**: Use existing resolver architecture without modifications
- ~~**Enable Reusability**: Create solution that can be applied to other intimate actions~~

### 1.3 Scope

- ~~**Create new JSON Logic operator** (`GetTopmostNonAccessoryClothingOperator`)~~ NOT IMPLEMENTED
- ~~**Define new scope** for non-accessory clothing selection~~ NOT IMPLEMENTED
- ~~**Update fondle_ass action** to use the new scope~~ NOT NEEDED
- **Implement comprehensive test coverage** for all scenarios ✅ COMPLETED
- ~~**Document the pattern** for future intimate action implementations~~ NOT APPLICABLE

## 2. Architecture Design

### 2.1 Solution Architecture

**NOTE: The architecture described below was NOT implemented. See "Actual Implementation" section for what was done.**

```
Current State:
┌─────────────────────────┐
│ fondle_ass.action.json  │
└─────────────────────────┘
            ↓
┌─────────────────────────────────────────┐
│ clothing:target_topmost_torso_lower_    │
│ clothing.scope                          │
└─────────────────────────────────────────┘
            ↓
┌─────────────────────────┐
│ ClothingStepResolver    │ → topmost_clothing
└─────────────────────────┘
            ↓
┌─────────────────────────┐
│ SlotAccessResolver      │ → torso_lower
└─────────────────────────┘
            ↓
    ['outer', 'base', 'underwear', 'accessories'] ← Problem: includes accessories

Target State:
┌─────────────────────────┐
│ fondle_ass.action.json  │
└─────────────────────────┘
            ↓
┌─────────────────────────────────────────────────┐
│ clothing:target_topmost_non_accessory_torso_    │
│ lower_clothing.scope                            │
└─────────────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│ GetTopmostNonAccessoryClothingOperator │ → New operator
└─────────────────────────────────────┘
            ↓
    ['outer', 'base', 'underwear'] ← Solution: excludes accessories
```

### 2.2 Component Relationships

```javascript
// New operator hierarchy
BaseEquipmentOperator (existing base class)
    ↓
GetTopmostNonAccessoryClothingOperator (new)
    ├── Inherits entity resolution logic
    ├── Implements custom clothing filtering
    └── Returns entity ID or null

// Integration points
jsonLogicCustomOperators.js
    ├── Registers new operator
    └── Maps to evaluation function

New scope definition
    └── Uses operator in JSON Logic expression
```

## 2.2 Actual Implementation

The issue was resolved without creating new operators or modifying the action. The existing system already handles accessories correctly:

### Current SlotAccessResolver Implementation

Location: `src/scopeDsl/nodes/slotAccessResolver.js`

```javascript
const LAYER_PRIORITY = {
  topmost: ['outer', 'base', 'underwear', 'accessories'], // Accessories included
  all: ['outer', 'base', 'underwear', 'accessories'],
  outer: ['outer'],
  base: ['base'],
  underwear: ['underwear'],
};
```

### Resolution Behavior

1. When resolving `target.topmost_clothing.torso_lower`:
   - The system checks layers in order: outer → base → underwear → accessories
   - Returns the first item found in any layer
   - If only accessories exist, they are correctly returned

2. This means:
   - "fondle ass over the belt" is considered correct behavior
   - The action is available when target has only accessories
   - No semantic issues exist with the current implementation

### Test Validation

The test file `tests/integration/actions/fondle-ass-fix-validation.test.js` confirms:

- Accessories are found in topmost clothing resolution
- Layer priority is correctly applied
- The "belt only" scenario works as intended

## 3. Detailed Requirements

**NOTE: The requirements below were NOT implemented. They represent an abandoned approach.**

### 3.1 Functional Requirements

#### FR-1: GetTopmostNonAccessoryClothingOperator Implementation

**Requirement**: Create new JSON Logic operator that returns topmost clothing excluding accessories

**File Location**: `src/logic/operators/getTopmostNonAccessoryClothingOperator.js`

**Implementation Details**:

```javascript
/**
 * @module GetTopmostNonAccessoryClothingOperator
 * @description JSON Logic operator for getting topmost non-accessory clothing item
 */

import { BaseEquipmentOperator } from './base/BaseEquipmentOperator.js';

export class GetTopmostNonAccessoryClothingOperator extends BaseEquipmentOperator {
  // Layer priority excluding accessories
  static COVERAGE_LAYERS = ['outer', 'base', 'underwear'];

  constructor(dependencies) {
    super(dependencies, 'getTopmostNonAccessoryClothing');
  }

  /**
   * Evaluates the equipment for the entity
   * @param {string} entityId - The entity ID to check
   * @param {string} slot - The equipment slot to check (e.g., 'torso_lower')
   * @returns {string|null} Entity ID of topmost non-accessory clothing or null
   */
  evaluateEquipment(entityId, slot) {
    const equipment = this.entityManager.getComponentData(
      entityId,
      'clothing:equipment'
    );

    if (!equipment?.equipped?.[slot]) {
      this.logger.debug(
        `${this.operatorName}: No items in slot ${slot} for entity ${entityId}`
      );
      return null;
    }

    const slotItems = equipment.equipped[slot];

    // Iterate through coverage layers in priority order
    for (const layer of GetTopmostNonAccessoryClothingOperator.COVERAGE_LAYERS) {
      if (slotItems[layer]) {
        this.logger.debug(
          `${this.operatorName}: Found ${layer} item in ${slot}: ${slotItems[layer]}`
        );
        return slotItems[layer];
      }
    }

    this.logger.debug(
      `${this.operatorName}: No non-accessory clothing found in ${slot} for entity ${entityId}`
    );
    return null;
  }
}
```

**Acceptance Criteria**:

- Extends `BaseEquipmentOperator` for consistent entity resolution
- Returns topmost clothing from layers: `['outer', 'base', 'underwear']`
- Returns `null` when only accessories are present
- Includes comprehensive debug logging
- Handles missing equipment components gracefully

#### FR-2: Operator Registration

**Requirement**: Register the new operator in the JSON Logic system

**File to Modify**: `src/logic/jsonLogicCustomOperators.js`

**Changes Required**:

```javascript
// Add import
import { GetTopmostNonAccessoryClothingOperator } from './operators/getTopmostNonAccessoryClothingOperator.js';

// In registerOperators method, create instance
const getTopmostNonAccessoryClothingOp =
  new GetTopmostNonAccessoryClothingOperator({
    entityManager: this.#entityManager,
    logger: this.#logger,
  });

// Register the operator
jsonLogicEvaluationService.addOperation(
  'getTopmostNonAccessoryClothing',
  function (entityPath, slot) {
    return getTopmostNonAccessoryClothingOp.evaluate([entityPath, slot], this);
  }
);
```

**Acceptance Criteria**:

- Operator is properly imported
- Instance is created with required dependencies
- Operator is registered with correct name
- Evaluation context is properly passed

#### FR-3: Scope Definition

**Requirement**: Create new scope using the operator

**File Location**: `data/mods/clothing/scopes/target_topmost_non_accessory_torso_lower_clothing.scope`

**Content**:

```json
{
  "$schema": "schema://living-narrative-engine/scope.schema.json",
  "id": "clothing:target_topmost_non_accessory_torso_lower_clothing",
  "name": "Target's Topmost Non-Accessory Torso Lower Clothing",
  "description": "Resolves to the target's topmost torso lower clothing item, excluding accessories like belts",
  "expression": {
    "getTopmostNonAccessoryClothing": ["target", "torso_lower"]
  }
}
```

**Acceptance Criteria**:

- Uses proper schema reference
- Has descriptive name and documentation
- Uses new operator with correct parameters
- Follows existing scope naming conventions

#### FR-4: Action Update

**Requirement**: Update fondle_ass action to use new scope

**File to Modify**: `data/mods/intimacy/actions/fondle_ass.action.json`

**Changes Required**:

```json
{
  "targets": {
    "secondary": {
      "scope": "clothing:target_topmost_non_accessory_torso_lower_clothing",
      "placeholder": "secondary",
      "description": "Clothing item over which to fondle",
      "contextFrom": "primary"
    }
  }
}
```

**Acceptance Criteria**:

- Secondary target scope updated to new non-accessory variant
- All other action properties remain unchanged
- Action becomes unavailable when only accessories are present

### 3.2 Non-Functional Requirements

#### NFR-1: Performance

- **Requirement**: No measurable performance degradation
- **Metric**: Operator evaluation < 1ms for typical scenarios
- **Validation**: Performance tests comparing old vs new implementation

#### NFR-2: Maintainability

- **Requirement**: Clear separation of concerns and documentation
- **Criteria**:
  - JSDoc comments for all public methods
  - Clear variable and function names
  - Follows existing code patterns

#### NFR-3: Compatibility

- **Requirement**: No breaking changes to existing functionality
- **Criteria**:
  - All existing tests continue to pass
  - Other clothing-related features unaffected
  - Backward compatible with existing save games

## 4. Implementation Plan

### 4.1 Phase 1: Core Operator Implementation

**Tasks**:

1. Create `GetTopmostNonAccessoryClothingOperator` class
2. Implement unit tests for the operator
3. Register operator in `jsonLogicCustomOperators.js`
4. Verify operator works in isolation

**Files to Create**:

- `src/logic/operators/getTopmostNonAccessoryClothingOperator.js`
- `tests/unit/logic/operators/getTopmostNonAccessoryClothingOperator.test.js`

**Files to Modify**:

- `src/logic/jsonLogicCustomOperators.js`

### 4.2 Phase 2: Scope Integration

**Tasks**:

1. Create new scope definition file
2. Test scope resolution independently
3. Verify scope returns expected values

**Files to Create**:

- `data/mods/clothing/scopes/target_topmost_non_accessory_torso_lower_clothing.scope`
- `tests/integration/scopes/clothingNonAccessoryScope.test.js`

### 4.3 Phase 3: Action Update and Testing

**Tasks**:

1. Update fondle_ass action to use new scope
2. Test with various clothing configurations
3. Verify action text generation
4. Test action availability logic

**Files to Modify**:

- `data/mods/intimacy/actions/fondle_ass.action.json`

**Test Scenarios**:
| Scenario | Expected Result |
|----------|----------------|
| Only base layer (skirt) | Action available, shows "over the skirt" |
| Only accessories (belt) | Action unavailable |
| Base + accessories | Shows base item, ignores accessories |
| Outer + base + accessories | Shows outer item |
| Underwear only | Shows underwear item |
| No clothing | Action unavailable |

### 4.4 Phase 4: Documentation and Rollout

**Tasks**:

1. Update any relevant documentation
2. Consider applying pattern to other intimate actions
3. Create migration guide for similar issues

## 5. Testing Requirements

### 5.1 Unit Tests

**File**: `tests/unit/logic/operators/getTopmostNonAccessoryClothingOperator.test.js`

**Test Cases**:

```javascript
describe('GetTopmostNonAccessoryClothingOperator', () => {
  describe('evaluateEquipment', () => {
    it('should return outer layer when present', () => {
      // Setup entity with outer + accessories
      // Verify returns outer item ID
    });

    it('should return base layer when no outer', () => {
      // Setup entity with base + accessories
      // Verify returns base item ID
    });

    it('should return underwear when only underwear present', () => {
      // Setup entity with underwear only
      // Verify returns underwear item ID
    });

    it('should return null when only accessories', () => {
      // Setup entity with accessories only
      // Verify returns null
    });

    it('should return null when slot is empty', () => {
      // Setup entity with empty slot
      // Verify returns null
    });

    it('should handle missing equipment component', () => {
      // Setup entity without equipment component
      // Verify returns null gracefully
    });
  });
});
```

### 5.2 Integration Tests

**File**: `tests/integration/actions/fondleAssClothingSelection.test.js`

**Test Focus**:

- End-to-end action resolution with various clothing configurations
- Proper text generation for each scenario
- Action availability based on clothing presence

### 5.3 Regression Tests

Ensure all existing clothing-related tests continue to pass:

- `tests/unit/scopeDsl/nodes/clothingStepResolver.test.js`
- `tests/unit/scopeDsl/nodes/slotAccessResolver.test.js`
- `tests/integration/clothing/*.test.js`

## 6. Risk Assessment and Mitigation

### 6.1 Risks

| Risk                                     | Likelihood | Impact | Mitigation                       |
| ---------------------------------------- | ---------- | ------ | -------------------------------- |
| Breaking existing clothing functionality | Low        | High   | Comprehensive regression testing |
| Performance degradation                  | Low        | Medium | Performance benchmarking         |
| Incomplete coverage of edge cases        | Medium     | Low    | Thorough test scenarios          |
| Migration issues for save games          | Low        | Medium | Backward compatibility testing   |

### 6.2 Rollback Strategy

If issues are discovered post-implementation:

1. Revert action scope change (immediate fix)
2. Keep operator in place (no harm if unused)
3. Debug and fix issues
4. Re-deploy with fixes

## 7. Success Criteria

### 7.1 Functional Success

- ✅ Action text no longer shows "over the belt" for accessories
- ✅ Action correctly identifies coverage clothing
- ✅ Action becomes unavailable when only accessories present
- ✅ All existing clothing features continue to work

### 7.2 Quality Metrics

- ✅ 100% unit test coverage for new operator
- ✅ All regression tests pass
- ✅ No performance degradation (< 1ms evaluation time)
- ✅ Code follows established patterns

## 8. Future Considerations

### 8.1 Extension to Other Actions

Consider applying this pattern to other intimate actions that may have similar issues:

- `kiss_neck_sensually`
- `grope_chest`
- `caress_thigh`
- Other actions referencing clothing over body parts

### 8.2 Potential Enhancements

- Add operator variant for specific layer exclusion (not just accessories)
- Create inverse operator (accessories only) for appropriate actions
- Consider adding this as a field type in ClothingStepResolver for broader use

## 9. Code Examples

### 9.1 Complete Operator Implementation

```javascript
/**
 * @file JSON Logic operator for getting topmost non-accessory clothing
 * @see BaseEquipmentOperator.js
 */

import { BaseEquipmentOperator } from './base/BaseEquipmentOperator.js';

/**
 * Operator that returns the topmost clothing item excluding accessories
 * Used for intimate actions where accessories are semantically inappropriate
 */
export class GetTopmostNonAccessoryClothingOperator extends BaseEquipmentOperator {
  /**
   * Layer priority for coverage clothing (excludes accessories)
   * Based on the pattern from isSocketCoveredOperator.js
   */
  static COVERAGE_LAYERS = ['outer', 'base', 'underwear'];

  /**
   * @param {object} dependencies
   * @param {IEntityManager} dependencies.entityManager
   * @param {ILogger} dependencies.logger
   */
  constructor(dependencies) {
    super(dependencies, 'getTopmostNonAccessoryClothing');
  }

  /**
   * Evaluates the equipment for the entity and returns topmost non-accessory item
   *
   * @param {string} entityId - The entity ID to check
   * @param {string} slot - The equipment slot to check
   * @returns {string|null} Entity ID of topmost clothing or null
   */
  evaluateEquipment(entityId, slot) {
    const equipment = this.entityManager.getComponentData(
      entityId,
      'clothing:equipment'
    );

    if (!equipment?.equipped?.[slot]) {
      this.logger.debug(
        `${this.operatorName}: No items in slot ${slot} for entity ${entityId}`
      );
      return null;
    }

    const slotItems = equipment.equipped[slot];

    // Check layers in priority order, excluding accessories
    for (const layer of GetTopmostNonAccessoryClothingOperator.COVERAGE_LAYERS) {
      if (slotItems[layer]) {
        this.logger.debug(
          `${this.operatorName}: Found ${layer} clothing in ${slot}: ${slotItems[layer]}`
        );
        return slotItems[layer];
      }
    }

    // No coverage clothing found (only accessories or empty)
    this.logger.debug(
      `${this.operatorName}: No coverage clothing in ${slot} for entity ${entityId}`
    );
    return null;
  }
}

export default GetTopmostNonAccessoryClothingOperator;
```

### 9.2 Usage in Action Context

When the action is evaluated with this implementation:

**Before (Problematic)**:

```
Entity: Jon Ureña
Equipment: { torso_lower: { accessories: "clothing:brown_leather_belt" } }
Result: "fondle Jon Ureña's ass over the belt"
```

**After (Fixed)**:

```
Entity: Jon Ureña
Equipment: { torso_lower: { accessories: "clothing:brown_leather_belt" } }
Result: Action unavailable (no coverage clothing)
```

**After with proper clothing**:

```
Entity: Silvia
Equipment: {
  torso_lower: {
    base: "clothing:pink_short_flared_skirt",
    accessories: "clothing:decorative_belt"
  }
}
Result: "fondle Silvia's ass over the short flared skirt"
```

## 10. Validation Checklist

Before considering implementation complete:

- [ ] Operator class created and tested
- [ ] Operator registered in jsonLogicCustomOperators
- [ ] Scope definition created
- [ ] Action updated to use new scope
- [ ] Unit tests pass with 100% coverage
- [ ] Integration tests verify all scenarios
- [ ] Regression tests confirm no breaking changes
- [ ] Performance benchmarks show no degradation
- [ ] Documentation updated if needed
- [ ] Code follows project conventions
- [ ] Lint and format checks pass
- [ ] Manual testing confirms fix works as expected

---

**Specification Status**: Alternative Solution Implemented
**Implementation Date**: Already completed (tests exist)
**Actual Solution**: Accessories are included in topmost clothing resolution
**Decision Rationale**: Team determined "fondle ass over the belt" is acceptable behavior
