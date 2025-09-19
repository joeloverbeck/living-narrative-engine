# POSTARVAL-002: Create Target Component Validator

## Overview
Implement the core validation logic for checking forbidden components on target entities. This validator will be used by the pipeline stage to enforce target component constraints.

## Prerequisites
- POSTARVAL-001: Extended action schema definition must be complete

## Objectives
1. Create TargetComponentValidator class with validation methods
2. Implement single-target and multi-target validation logic
3. Handle legacy and modern action formats
4. Provide clear validation failure messages
5. Optimize for performance with O(1) component lookups

## Implementation Steps

### 1. Create TargetComponentValidator Class
- [ ] Create `src/actions/validation/TargetComponentValidator.js`
- [ ] Implement constructor with dependency injection
- [ ] Add logger and entityManager dependencies
- [ ] Follow project validation patterns

### 2. Implement Core Validation Method
```javascript
class TargetComponentValidator {
  #logger;
  #entityManager;

  constructor({ logger, entityManager }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'warn', 'error', 'debug']
    });
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['getEntity', 'hasComponent']
    });
    this.#logger = logger;
    this.#entityManager = entityManager;
  }

  /**
   * Validates target entities against forbidden component constraints
   * @param {Object} actionDef - Action definition with forbidden_components
   * @param {Object} targetEntities - Object with target entities by role
   * @returns {Object} { valid: boolean, reason?: string }
   */
  validateTargetComponents(actionDef, targetEntities) {
    // Implementation here
  }

  /**
   * Validates a single entity against forbidden components
   * @param {Object} entity - Entity to validate
   * @param {Array} forbiddenComponents - List of forbidden component IDs
   * @returns {Object} { valid: boolean, component?: string }
   */
  validateEntityComponents(entity, forbiddenComponents) {
    // Implementation here
  }
}
```

### 3. Implement Legacy Single-Target Support
- [ ] Detect legacy format with `forbidden_components.target`
- [ ] Map single target from `targetEntities.target`
- [ ] Apply validation and return results
- [ ] Provide backward-compatible error messages

### 4. Implement Multi-Target Support
- [ ] Iterate through target roles (primary/secondary/tertiary)
- [ ] Match roles to forbidden_components configuration
- [ ] Validate each target independently
- [ ] Aggregate validation results

### 5. Add Performance Optimizations
- [ ] Use Set for O(1) forbidden component lookups
- [ ] Cache component existence checks within validation cycle
- [ ] Short-circuit validation on first failure
- [ ] Add performance metrics logging in debug mode

### 6. Implement Error Messaging
- [ ] Create descriptive validation failure messages
- [ ] Include action ID, target entity ID, and forbidden component
- [ ] Format messages for both logging and user display
- [ ] Support localization patterns if applicable

## Testing Requirements

### Unit Tests
```javascript
// tests/unit/actions/validation/TargetComponentValidator.test.js
describe('TargetComponentValidator', () => {
  describe('validateTargetComponents', () => {
    it('should allow action when target lacks forbidden components')
    it('should reject action when target has forbidden component')
    it('should handle legacy single-target format')
    it('should handle multi-target validation correctly')
    it('should short-circuit on first validation failure')
    it('should handle missing forbidden_components gracefully')
    it('should handle null/undefined target entities')
  });

  describe('validateEntityComponents', () => {
    it('should return valid when entity has no forbidden components')
    it('should return invalid with specific component when found')
    it('should handle empty forbidden components list')
    it('should handle entity without components property')
    it('should validate multiple forbidden components')
  });

  describe('performance', () => {
    it('should validate 100 targets in under 10ms')
    it('should use O(1) lookups for component checking')
  });
});
```

### Edge Cases to Test
- Empty forbidden_components configuration
- Null/undefined entities
- Malformed component data
- Mixed legacy and modern formats
- Very large forbidden component lists

## Success Criteria
- [ ] Validator correctly identifies forbidden components on targets
- [ ] Legacy single-target format works without changes to actions
- [ ] Multi-target validation works for all roles
- [ ] Performance meets <5ms per target validation
- [ ] Clear error messages for validation failures
- [ ] 100% unit test coverage
- [ ] Follows project coding standards and patterns

## Files to Create
- `src/actions/validation/TargetComponentValidator.js` - Main validator class
- `tests/unit/actions/validation/TargetComponentValidator.test.js` - Unit tests

## Dependencies
- POSTARVAL-001: Schema must support target forbidden components

## Estimated Time
3-4 hours

## Notes
- Follow existing validation patterns from ComponentFilteringStage
- Ensure compatibility with both legacy and modern action formats
- Performance is critical as this runs in the action discovery hot path
- Consider future extensions like required components or value constraints