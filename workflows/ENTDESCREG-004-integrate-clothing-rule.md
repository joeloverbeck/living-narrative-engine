# ENTDESCREG-004: Integrate Clothing Rule

**Priority**: High  
**Dependencies**: ENTDESCREG-003 (Dependency Injection Setup)  
**Estimated Effort**: 0.5 days

## Overview

Integrate the `REGENERATE_DESCRIPTION` operation into the existing clothing removal rule to automatically update entity descriptions when clothing items are removed.

## Background

The existing `handle_remove_clothing.rule.json` successfully removes clothing items but doesn't update character descriptions. This integration adds the new operation to the rule's operation sequence, ensuring descriptions reflect current appearance after clothing changes.

## Acceptance Criteria

- [ ] Add `REGENERATE_DESCRIPTION` operation to clothing removal rule
- [ ] Operation executes after successful clothing unequipping
- [ ] Operation targets the actor (character removing clothing)
- [ ] Integration doesn't break existing rule functionality
- [ ] Rule validation passes with new operation included
- [ ] Operation sequence maintains logical order

## Technical Requirements

### Files to Update

#### `data/mods/clothing/rules/handle_remove_clothing.rule.json`

**Operation Integration Point**: After `UNEQUIP_CLOTHING` operation (around line 38)

**New Operation to Add**:

```json
{
  "type": "REGENERATE_DESCRIPTION",
  "parameters": {
    "entity_ref": "actor"
  }
}
```

**Complete Integration Context**:

```json
{
  "type": "UNEQUIP_CLOTHING",
  "parameters": {
    "entity_ref": "actor",
    "clothing_item_id": "{event.payload.targetId}",
    "cascade_unequip": false,
    "destination": "ground"
  }
},
{
  "type": "REGENERATE_DESCRIPTION",
  "parameters": {
    "entity_ref": "actor"
  }
},
{
  "type": "SET_VARIABLE",
  // ... existing SET_VARIABLE operation
}
```

## Integration Strategy

### Operation Sequence

1. `GET_NAME` (actor) ✅ - Existing
2. `GET_NAME` (target) ✅ - Existing
3. `QUERY_COMPONENT` (actor position) ✅ - Existing
4. `UNEQUIP_CLOTHING` ✅ - Existing
5. **`REGENERATE_DESCRIPTION`** ← **NEW ADDITION**
6. `SET_VARIABLE` (log message) ✅ - Existing
7. `MACRO: core:logSuccessAndEndTurn` ✅ - Existing

### Error Handling Strategy

- Non-critical operation: Rule continues if description regeneration fails
- Failed regeneration logs warning but doesn't interrupt action flow
- Existing clothing removal functionality remains unaffected

## Definition of Done

- [ ] `REGENERATE_DESCRIPTION` operation added to rule at correct position
- [ ] Operation targets "actor" entity reference correctly
- [ ] Rule JSON syntax is valid and loads without errors
- [ ] Existing rule operations remain unchanged and functional
- [ ] Rule validation passes with new operation schema
- [ ] Operation executes in correct sequence after clothing removal

## Validation Requirements

- [ ] Rule file loads successfully in rule processing system
- [ ] Schema validation passes for modified rule
- [ ] All existing operations continue to work correctly
- [ ] New operation executes without breaking rule flow
- [ ] JSON syntax is valid (no trailing commas, proper nesting)

## Testing Prerequisites

- [ ] `RegenerateDescriptionHandler` is registered and functional (ENTDESCREG-003)
- [ ] Operation schema is available (ENTDESCREG-001)
- [ ] Rule loading and validation systems are working

## Related Specification Sections

- **Section 3.4**: Phase 4 - Rule Integration
- **Section 2.1**: System Integration - Enhanced Clothing Removal Flow
- **Section 1.3**: Solution Overview - Integration approach
- **Section 5.1**: Functional Requirements - Seamless integration

## Rule Processing Flow

### Before Integration

```
clothing:remove_clothing → UNEQUIP_CLOTHING → SET_VARIABLE → END
                            ↑
                    Description stays stale
```

### After Integration

```
clothing:remove_clothing → UNEQUIP_CLOTHING → REGENERATE_DESCRIPTION → SET_VARIABLE → END
                                                      ↑
                                            Description updated automatically
```

## Risk Mitigation

- **Rule Processing Interruption**: Operation designed as non-critical
- **JSON Syntax Errors**: Careful validation of JSON formatting
- **Operation Order**: Strategic placement after successful clothing removal
- **Backward Compatibility**: No changes to existing operations

## Next Steps

After completion, the core implementation is complete. Proceed to testing phase:

- **ENTDESCREG-005** (Unit Tests)
- **ENTDESCREG-006** (Integration Tests)
- **ENTDESCREG-007** (E2E Tests)
