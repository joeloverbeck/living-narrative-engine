# POSTARVAL-004: Integrate Validation into Pipeline

## Overview
Register the TargetComponentValidationStage in the action discovery pipeline and configure its position in the processing sequence. Handle dependency injection and pipeline configuration.

## Prerequisites
- POSTARVAL-001: Schema definition complete
- POSTARVAL-002: TargetComponentValidator implemented
- POSTARVAL-003: TargetComponentValidationStage created

## Objectives
1. Register TargetComponentValidationStage in the pipeline
2. Configure correct stage ordering after TargetResolutionStage
3. Set up dependency injection container registration
4. Handle validation failure modes gracefully
5. Add configuration options for enabling/disabling validation

## Implementation Steps

### 1. Analyze Current Pipeline Structure
- [ ] Review `src/actions/pipeline/Pipeline.js`
- [ ] Identify current stage registration pattern
- [ ] Determine optimal position for validation stage
- [ ] Review existing stage dependencies

### 2. Register Stage in Dependency Container
- [ ] Update dependency injection configuration
- [ ] Register TargetComponentValidator as a service
- [ ] Register TargetComponentValidationStage
- [ ] Configure singleton vs transient lifetime

```javascript
// In dependency configuration file
container.register('ITargetComponentValidator', TargetComponentValidator, {
  dependencies: ['ILogger', 'IEntityManager'],
  lifetime: 'singleton'
});

container.register('ITargetComponentValidationStage', TargetComponentValidationStage, {
  dependencies: ['ILogger', 'IEntityManager', 'ITargetComponentValidator', 'IPerformanceMonitor'],
  lifetime: 'singleton'
});
```

### 3. Add Stage to Pipeline
- [ ] Modify Pipeline.js to include new stage
- [ ] Position after TargetResolutionStage
- [ ] Position before ActionFormattingStage
- [ ] Maintain stage execution order

```javascript
// In Pipeline.js or pipeline configuration
class Pipeline {
  constructor({ stages }) {
    this.#stages = [
      stages.scopeResolutionStage,
      stages.componentFilteringStage,
      stages.conditionEvaluationStage,
      stages.targetResolutionStage,
      stages.targetComponentValidationStage, // New stage
      stages.actionFormattingStage,
      stages.costCalculationStage
    ];
  }
}
```

### 4. Add Configuration Options
- [ ] Create configuration flag for target validation
- [ ] Allow validation to be disabled for debugging
- [ ] Add validation strictness levels
- [ ] Support performance mode flags

```javascript
const pipelineConfig = {
  enableTargetValidation: true, // Feature flag
  validationStrictness: 'strict', // strict, lenient, off
  performanceMode: false, // Skip validation in performance mode
  logValidationDetails: false // Detailed logging
};
```

### 5. Handle Pipeline Integration
- [ ] Ensure stage receives correct context
- [ ] Pass through action metadata properly
- [ ] Preserve pipeline state between stages
- [ ] Handle stage skipping if disabled

### 6. Implement Failure Handling
- [ ] Define validation failure behavior
- [ ] Option to fail fast vs continue
- [ ] Log validation statistics
- [ ] Emit validation events for monitoring

## Testing Requirements

### Integration Tests
```javascript
// tests/integration/actions/pipeline/pipelineWithTargetValidation.test.js
describe('Pipeline with Target Validation', () => {
  it('should include target validation stage in correct position')
  it('should pass valid actions through pipeline')
  it('should filter invalid actions at validation stage')
  it('should handle stage disabled configuration')
  it('should maintain pipeline performance with validation')
  it('should pass context correctly between stages')
});
```

### Configuration Tests
```javascript
describe('Pipeline Configuration', () => {
  it('should allow disabling target validation')
  it('should support different strictness levels')
  it('should skip validation in performance mode')
  it('should handle missing configuration gracefully')
});
```

### Regression Tests
- [ ] Verify existing pipeline functionality unchanged
- [ ] Test all existing action discoveries still work
- [ ] Ensure no performance degradation
- [ ] Validate stage ordering is correct

## Success Criteria
- [ ] Stage is registered and executes in pipeline
- [ ] Stage runs after target resolution
- [ ] Validation can be configured/disabled
- [ ] No regression in existing functionality
- [ ] Performance impact <5% on action discovery
- [ ] All integration tests pass
- [ ] Pipeline maintains data integrity

## Files to Modify
- `src/actions/pipeline/Pipeline.js` - Add stage to pipeline
- `src/dependencyInjection/gameServices.js` (or equivalent) - Register services
- `src/config/actionConfig.js` (or create if needed) - Configuration options

## Files to Create
- `tests/integration/actions/pipeline/pipelineWithTargetValidation.test.js` - Integration tests

## Dependencies
- POSTARVAL-001: Schema definition
- POSTARVAL-002: Validator implementation
- POSTARVAL-003: Stage implementation

## Estimated Time
3-4 hours

## Notes
- Carefully test stage ordering to avoid breaking existing pipeline
- Consider feature flag for gradual rollout
- Monitor performance impact in production-like scenarios
- Document configuration options for mod developers