# POSTARVAL-005: Implement Multi-Target Support

## Overview
Extend the validation system to fully support multi-target actions with role-based validation (primary, secondary, tertiary targets). Ensure backward compatibility with legacy single-target actions.

## Prerequisites
- POSTARVAL-002: TargetComponentValidator base implementation
- POSTARVAL-003: Pipeline stage created
- POSTARVAL-004: Pipeline integration complete

## Objectives
1. Implement role-specific target validation
2. Support primary/secondary/tertiary target roles
3. Maintain backward compatibility with single-target actions
4. Handle partial target specifications
5. Optimize for common single-target case

## Implementation Steps

### 1. Extend TargetComponentValidator
- [ ] Add role-based validation logic
- [ ] Support named target roles
- [ ] Handle missing/optional targets
- [ ] Maintain performance for single-target case

```javascript
class TargetComponentValidator {
  /**
   * Enhanced validation for multi-target actions
   */
  validateTargetComponents(actionDef, targetEntities) {
    const forbiddenComponents = actionDef.forbidden_components;
    if (!forbiddenComponents) {
      return { valid: true };
    }

    // Legacy single-target support
    if (forbiddenComponents.target && targetEntities.target) {
      const result = this.validateEntityComponents(
        targetEntities.target,
        forbiddenComponents.target
      );
      if (!result.valid) {
        return {
          valid: false,
          reason: `Target has forbidden component: ${result.component}`,
          targetRole: 'target',
          targetId: targetEntities.target.id
        };
      }
    }

    // Multi-target role validation
    const targetRoles = ['primary', 'secondary', 'tertiary'];
    for (const role of targetRoles) {
      if (forbiddenComponents[role] && targetEntities[role]) {
        const result = this.validateEntityComponents(
          targetEntities[role],
          forbiddenComponents[role]
        );
        if (!result.valid) {
          return {
            valid: false,
            reason: `${role} target has forbidden component: ${result.component}`,
            targetRole: role,
            targetId: targetEntities[role].id
          };
        }
      }
    }

    return { valid: true };
  }
}
```

### 2. Update Pipeline Stage for Multi-Target
- [ ] Extract targets by role from actions
- [ ] Map target roles to entities
- [ ] Pass role-mapped targets to validator
- [ ] Handle actions with variable target counts

### 3. Handle Target Resolution Patterns
- [ ] Support actions with optional targets
- [ ] Handle null/undefined target slots
- [ ] Validate only provided targets
- [ ] Skip validation for missing optional targets

### 4. Add Role-Specific Error Messages
- [ ] Include target role in error messages
- [ ] Provide clear validation failure reasons
- [ ] Support debugging with detailed logs
- [ ] Format messages for different consumers

### 5. Optimize Common Cases
- [ ] Fast path for single-target actions
- [ ] Cache role detection per action type
- [ ] Skip role iteration when not needed
- [ ] Minimize object allocations

### 6. Create Multi-Target Test Actions
- [ ] Create test action with multiple targets
- [ ] Define role-specific forbidden components
- [ ] Test various target configurations
- [ ] Verify validation behavior

## Testing Requirements

### Unit Tests
```javascript
// tests/unit/actions/validation/multiTargetValidation.test.js
describe('Multi-Target Validation', () => {
  describe('role-based validation', () => {
    it('should validate primary target separately')
    it('should validate secondary target separately')
    it('should validate tertiary target separately')
    it('should handle actions with subset of targets')
    it('should skip validation for missing optional targets')
  });

  describe('backward compatibility', () => {
    it('should still support legacy single-target format')
    it('should handle mixed legacy and modern formats')
    it('should not break existing single-target actions')
  });

  describe('error reporting', () => {
    it('should include role in error message')
    it('should identify specific failing target')
    it('should provide actionable error information')
  });

  describe('performance', () => {
    it('should optimize single-target case')
    it('should handle 3 targets in under 15ms')
  });
});
```

### Integration Tests
```javascript
// tests/integration/actions/multiTargetActionDiscovery.test.js
describe('Multi-Target Action Discovery', () => {
  it('should discover multi-target actions correctly')
  it('should apply role-specific validation')
  it('should filter based on any target violation')
  it('should work with real multi-target action definitions')
});
```

### Test Scenarios
- Single target with forbidden component
- Primary target with forbidden component
- Secondary target with forbidden component
- Multiple targets with violations
- Optional targets not provided
- Mixed valid and invalid targets

## Success Criteria
- [ ] Multi-target validation works for all roles
- [ ] Each role validated independently
- [ ] Backward compatibility maintained
- [ ] Clear role-specific error messages
- [ ] Performance meets targets (<15ms for 3 targets)
- [ ] 95% test coverage
- [ ] No regression in single-target actions

## Files to Modify
- `src/actions/validation/TargetComponentValidator.js` - Enhanced validation logic
- `src/actions/pipeline/stages/TargetComponentValidationStage.js` - Multi-target handling

## Files to Create
- `tests/unit/actions/validation/multiTargetValidation.test.js` - Unit tests
- `tests/integration/actions/multiTargetActionDiscovery.test.js` - Integration tests
- `data/mods/test/actions/multi_target_test.action.json` - Test action definition

## Dependencies
- POSTARVAL-002: Base validator implementation
- POSTARVAL-003: Pipeline stage
- POSTARVAL-004: Pipeline integration

## Estimated Time
4-5 hours

## Notes
- Primary focus on maintaining simplicity for common single-target case
- Role names are fixed (primary/secondary/tertiary) per architecture
- Consider future extension for custom role names
- Document multi-target patterns for mod developers