# POSTARVAL-006: Update Positioning Actions

## Overview
Update positioning actions to use the new target validation system, starting with `kneel_before` and extending to related positioning actions that could benefit from target state validation.

## Prerequisites
- POSTARVAL-001 through POSTARVAL-005: Core validation system implemented
- POSTARVAL-008: Unit tests available for verification

## Objectives
1. Update `kneel_before` action with target forbidden components
2. Analyze and update related positioning actions
3. Document validation patterns for positioning mod
4. Ensure all positioning state conflicts are prevented
5. Create examples for mod developers

## Implementation Steps

### 1. Update kneel_before Action
- [ ] Modify `data/mods/positioning/actions/kneel_before.action.json`
- [ ] Add target forbidden components configuration
- [ ] Test with positioning scenarios

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "positioning:kneel_before",
  "name": "Kneel Before",
  "description": "Kneel in front of someone",
  "targets": {
    "primary": {
      "scope": "positioning:actors_in_location_facing",
      "required": true
    }
  },
  "forbidden_components": {
    "actor": [
      "positioning:kneeling_before",
      "positioning:sitting_on",
      "positioning:bending_over",
      "positioning:lying_down"
    ],
    "primary": [
      "positioning:kneeling_before",
      "positioning:bending_over",
      "positioning:lying_down"
    ]
  },
  "operation": "positioning:establish_kneeling"
}
```

### 2. Analyze Related Positioning Actions
- [ ] Review all actions in `data/mods/positioning/actions/`
- [ ] Identify actions that modify positioning state
- [ ] Determine which need target validation
- [ ] Document validation requirements

**Actions to Review:**
- `turn_around_to_face` - Target shouldn't be facing away
- `get_close` - Target positioning compatibility
- `place_yourself_behind` - Target must be standing/accessible
- `sit_on` - Target must be furniture or appropriate
- `stand_up` - No target validation needed
- `bend_over` - May need target validation for "bend over something"

### 3. Update turn_around_to_face Action
- [ ] Add validation for target facing state
- [ ] Prevent turning to face someone facing away

```json
{
  "id": "positioning:turn_around_to_face",
  "forbidden_components": {
    "actor": ["positioning:immobilized"],
    "primary": ["positioning:facing_away", "positioning:unconscious"]
  }
}
```

### 4. Update get_close Action
- [ ] Add validation for target accessibility
- [ ] Prevent getting close to inaccessible targets

```json
{
  "id": "positioning:get_close",
  "forbidden_components": {
    "actor": ["positioning:immobilized"],
    "primary": ["positioning:inaccessible", "positioning:enclosed"]
  }
}
```

### 5. Create Validation Pattern Documentation
- [ ] Document common positioning validation patterns
- [ ] Create guide for mod developers
- [ ] Include examples and anti-patterns
- [ ] Add to mod documentation

```markdown
# Positioning Action Validation Patterns

## Common Forbidden Components

### For Actors
- `positioning:kneeling_before` - Already kneeling
- `positioning:sitting_on` - Already sitting
- `positioning:lying_down` - On the ground
- `positioning:immobilized` - Cannot move

### For Targets
- `positioning:kneeling_before` - Target is kneeling (can't interact normally)
- `positioning:facing_away` - Target facing away (can't face them)
- `positioning:unconscious` - Target unconscious (can't interact)
- `positioning:inaccessible` - Target unreachable

## Best Practices
1. Always validate both actor and target states
2. Prevent circular positioning (A kneeling to B while B kneels to A)
3. Consider physical impossibilities
4. Document validation reasons in action descriptions
```

### 6. Test Updated Actions
- [ ] Create test scenarios for each updated action
- [ ] Verify validation prevents illogical states
- [ ] Test with AI-controlled characters
- [ ] Ensure backward compatibility

## Testing Requirements

### Integration Tests
```javascript
// tests/integration/mods/positioning/updatedActionsValidation.test.js
describe('Updated Positioning Actions', () => {
  describe('kneel_before with target validation', () => {
    it('should prevent kneeling before kneeling target')
    it('should prevent kneeling before lying target')
    it('should allow kneeling before standing target')
  });

  describe('turn_around_to_face validation', () => {
    it('should prevent turning to face away target')
    it('should prevent turning to unconscious target')
  });

  describe('get_close validation', () => {
    it('should prevent getting close to inaccessible target')
    it('should allow getting close to accessible target')
  });
});
```

### Scenario Tests
- Test circular kneeling prevention
- Test multiple actors and positioning states
- Test state transitions and validation
- Test with LLM decision making

## Success Criteria
- [ ] kneel_before prevents invalid target states
- [ ] Related positioning actions updated appropriately
- [ ] No regression in existing positioning functionality
- [ ] Clear documentation for mod developers
- [ ] All test scenarios pass
- [ ] LLM-controlled characters respect validation

## Files to Modify
- `data/mods/positioning/actions/kneel_before.action.json` - Primary update
- `data/mods/positioning/actions/turn_around_to_face.action.json` - Target validation
- `data/mods/positioning/actions/get_close.action.json` - Accessibility validation
- `data/mods/positioning/actions/place_yourself_behind.action.json` - Position validation

## Files to Create
- `data/mods/positioning/documentation/validation-patterns.md` - Documentation
- `tests/integration/mods/positioning/updatedActionsValidation.test.js` - Tests

## Dependencies
- POSTARVAL-001 through POSTARVAL-005: Core system complete
- POSTARVAL-008: Test infrastructure ready

## Estimated Time
3-4 hours

## Notes
- Focus on preventing physically impossible states
- Consider social/narrative implications of positioning
- Ensure validation doesn't overly restrict gameplay
- Keep validation rules intuitive and documentable