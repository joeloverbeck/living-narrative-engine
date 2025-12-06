# HARMODREF-024: Migrate Action Pipeline Validation to Plugins

**Priority:** P2 - LOW
**Effort:** 2 weeks
**Status:** Not Started

## Report Reference

[reports/hardcoded-mod-references-analysis.md](../reports/hardcoded-mod-references-analysis.md) - "Action Pipeline Hardcoding"

## Problem Statement

Migrate action pipeline validation strategies to plugin architecture, enabling mods to register custom validation logic without modifying core engine.

## Affected Files

1. `src/actions/pipeline/stages/TargetComponentValidationStage.js`
2. `src/plugins/interfaces/IValidationStrategy.js`
3. Example validation plugins
4. Test files

## Implementation

Plugin interface enables mods to add custom validation:

```javascript
export class CustomValidationStrategy extends BaseValidationStrategyPlugin {
  canValidate(action, context) {
    return action.id === 'my_mod:my_action';
  }

  validate(action, context) {
    // Custom validation logic
    return {
      valid: true,
      reason: null,
    };
  }
}
```

## Acceptance Criteria

- [ ] ValidationStrategy interface defined
- [ ] Existing validation extracted to plugins
- [ ] Validation stage uses plugin manager
- [ ] Custom validators work
- [ ] Tests pass with >85% coverage
- [ ] Plugin guide updated

## Dependencies

HARMODREF-021 (plugin infrastructure)
