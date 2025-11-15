# MULTARRESSTAREF-009: Register Result Builder in DI Container

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 0.5 days
**Phase:** 2 - Result Assembly Extraction
**Reference:** See `reports/multi-target-resolution-stage-refactoring-analysis.md` for complete context

## Objective

Register `TargetResolutionResultBuilder` in the dependency injection container to make it available for injection into `MultiTargetResolutionStage`.

## Background

The result builder service needs to be registered in the DI container following the project's established dependency injection patterns.

## Technical Requirements

### Files to Modify

#### 1. Define DI Token
**File:** `src/dependencyInjection/tokens/tokens-pipeline.js`

**Change:**
```javascript
export const pipelineTokens = freeze({
  // ... existing tokens ...

  ITargetResolutionResultBuilder: 'ITargetResolutionResultBuilder',

  // ... existing tokens ...
});
```

#### 2. Register Service Factory
**File:** `src/dependencyInjection/registrations/pipelineServiceRegistrations.js`

**Change:**
```javascript
import TargetResolutionResultBuilder from '../../actions/pipeline/services/implementations/TargetResolutionResultBuilder.js';

// Inside registerPipelineServices
registrar.singletonFactory(tokens.ITargetResolutionResultBuilder, (c) => {
  return new TargetResolutionResultBuilder({
    entityManager: c.resolve(tokens.IEntityManager),
    logger: c.resolve(tokens.ILogger),
  });
});
```

#### 3. Update Stage Registration
**File:** `src/dependencyInjection/registrations/commandAndActionRegistrations.js`

**Change:** Add `ITargetResolutionResultBuilder` to `MultiTargetResolutionStage` dependencies (will be used in MULTARRESSTAREF-010)

## Acceptance Criteria

- [ ] Token defined in `tokens-pipeline.js` and exported through `tokens.js`
- [ ] Service registered with factory pattern
- [ ] Factory injects `IEntityManager` and `ILogger` dependencies
- [ ] Registration follows project DI patterns
- [ ] No circular dependencies introduced
- [ ] TypeScript checks pass (`npm run typecheck`)

## Dependencies

- **MULTARRESSTAREF-007** - Implementation must exist before registration
- **MULTARRESSTAREF-008** - Tests should pass before registration

## Testing Strategy

**Validation Test:**
```javascript
describe('DI Container - Result Builder', () => {
  it('should resolve ITargetResolutionResultBuilder', () => {
    const container = createContainer();
    const builder = container.resolve(tokens.ITargetResolutionResultBuilder);
    expect(builder).toBeDefined();
    expect(typeof builder.buildFinalResult).toBe('function');
  });

  it('should inject entityManager and logger dependencies', () => {
    const container = createContainer();
    const builder = container.resolve(tokens.ITargetResolutionResultBuilder);
    // Verify dependencies are injected
  });
});
```

## Validation Commands

```bash
npm run typecheck
npm run test:unit -- --testNamePattern="DI Container"
```

## Notes

- Follow existing DI registration patterns in the codebase
- Ensure entityManager and logger are properly injected
- Token name follows interface naming convention (`I` prefix)
- Factory pattern allows for dependency injection
- Will be consumed by `MultiTargetResolutionStage` in next phase
