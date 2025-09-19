# POSTARVAL-003: Create Validation Pipeline Stage

## Overview
Create a new pipeline stage that integrates target component validation into the action discovery process. This stage will use the TargetComponentValidator to filter actions based on target component constraints.

## Prerequisites
- POSTARVAL-001: Extended action schema definition
- POSTARVAL-002: TargetComponentValidator implementation

## Objectives
1. Create TargetComponentValidationStage class
2. Integrate with action discovery pipeline architecture
3. Process both single and multi-target actions
4. Add performance monitoring and logging
5. Handle validation failures gracefully

## Implementation Steps

### 1. Create Pipeline Stage Class
- [ ] Create `src/actions/pipeline/stages/TargetComponentValidationStage.js`
- [ ] Extend from base Stage class if applicable
- [ ] Implement stage interface with process method
- [ ] Add dependency injection for validator and logger

### 2. Implement Stage Structure
```javascript
/**
 * @file Pipeline stage for validating target entity components against forbidden constraints
 * @see src/actions/pipeline/stages/ComponentFilteringStage.js
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';

class TargetComponentValidationStage {
  #logger;
  #entityManager;
  #targetComponentValidator;
  #performanceMonitor;

  constructor({ logger, entityManager, targetComponentValidator, performanceMonitor }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'warn', 'error', 'debug']
    });
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['getEntity']
    });
    validateDependency(targetComponentValidator, 'ITargetComponentValidator', logger, {
      requiredMethods: ['validateTargetComponents']
    });

    this.#logger = logger;
    this.#entityManager = entityManager;
    this.#targetComponentValidator = targetComponentValidator;
    this.#performanceMonitor = performanceMonitor;
  }

  /**
   * Process action candidates through target component validation
   * @param {Array} actionCandidates - Actions to validate
   * @param {Object} context - Pipeline context
   * @returns {Array} Filtered action candidates
   */
  async process(actionCandidates, context) {
    const startTime = performance.now();

    try {
      const validatedActions = this.#validateActions(actionCandidates, context);

      const duration = performance.now() - startTime;
      this.#logPerformance(actionCandidates.length, validatedActions.length, duration);

      return validatedActions;
    } catch (error) {
      this.#logger.error('Target component validation failed', error);
      throw error;
    }
  }
}
```

### 3. Implement Validation Logic
- [ ] Iterate through action candidates
- [ ] Extract target entities from each action
- [ ] Apply target component validation
- [ ] Filter out actions that fail validation
- [ ] Preserve action metadata and context

### 4. Handle Different Action Formats
- [ ] Detect single vs multi-target actions
- [ ] Map targets to appropriate validation roles
- [ ] Handle actions without targets gracefully
- [ ] Support both resolved and unresolved targets

### 5. Add Performance Monitoring
- [ ] Track validation time per action
- [ ] Log slow validations (>5ms)
- [ ] Collect aggregate statistics
- [ ] Report to performance monitor if available
- [ ] Add debug logging for validation decisions

### 6. Implement Error Handling
- [ ] Catch and log validation errors
- [ ] Continue processing on individual action failures
- [ ] Provide detailed error context
- [ ] Dispatch error events if configured

## Testing Requirements

### Unit Tests
```javascript
// tests/unit/actions/pipeline/stages/TargetComponentValidationStage.test.js
describe('TargetComponentValidationStage', () => {
  describe('process', () => {
    it('should filter actions with forbidden target components')
    it('should pass actions without forbidden components')
    it('should handle actions without targets')
    it('should process multi-target actions correctly')
    it('should continue processing on validation errors')
    it('should log performance metrics')
  });

  describe('validation', () => {
    it('should validate single-target actions')
    it('should validate multi-target actions with roles')
    it('should handle mixed action formats')
    it('should preserve action metadata')
  });

  describe('error handling', () => {
    it('should handle validator exceptions gracefully')
    it('should log detailed error information')
    it('should not fail entire pipeline on single action error')
  });

  describe('performance', () => {
    it('should process 100 actions in under 50ms')
    it('should log slow validations')
  });
});
```

### Integration Tests
```javascript
// tests/integration/actions/pipeline/targetValidationStageIntegration.test.js
describe('TargetComponentValidationStage Integration', () => {
  it('should integrate with full pipeline')
  it('should work with real action definitions')
  it('should handle complex positioning scenarios')
});
```

## Success Criteria
- [ ] Stage correctly filters actions based on target components
- [ ] Works with both single and multi-target actions
- [ ] Performance meets <50ms for 100 actions
- [ ] Integrates cleanly with existing pipeline
- [ ] Comprehensive error handling and logging
- [ ] 95% test coverage
- [ ] Follows project stage implementation patterns

## Files to Create
- `src/actions/pipeline/stages/TargetComponentValidationStage.js` - Pipeline stage
- `tests/unit/actions/pipeline/stages/TargetComponentValidationStage.test.js` - Unit tests
- `tests/integration/actions/pipeline/targetValidationStageIntegration.test.js` - Integration tests

## Dependencies
- POSTARVAL-001: Schema definition
- POSTARVAL-002: TargetComponentValidator

## Estimated Time
4-5 hours

## Notes
- Follow patterns from ComponentFilteringStage for consistency
- Stage should be positioned after TargetResolutionStage in pipeline
- Performance is critical - this runs for every action discovery
- Consider caching validation results within a turn/frame