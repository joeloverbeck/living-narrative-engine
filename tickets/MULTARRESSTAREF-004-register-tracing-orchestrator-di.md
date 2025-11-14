# MULTARRESSTAREF-004: Register Tracing Orchestrator in DI Container

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 0.5 days
**Phase:** 1 - Tracing Extraction
**Reference:** See `reports/multi-target-resolution-stage-refactoring-analysis.md` for complete context

## Objective

Register `TargetResolutionTracingOrchestrator` in the dependency injection container to make it available for injection into `MultiTargetResolutionStage`.

## Background

The new tracing orchestrator service needs to be registered in the DI container following the project's established dependency injection patterns.

## Technical Requirements

### Files to Modify

#### 1. Define DI Token
**File:** `src/dependencyInjection/tokens/tokens-core.js`

**Change:**
```javascript
export const tokens = {
  // ... existing tokens ...

  // Target Resolution Pipeline Services
  ITargetResolutionTracingOrchestrator: 'ITargetResolutionTracingOrchestrator',

  // ... existing tokens ...
};
```

#### 2. Register Service Factory
**File:** `src/dependencyInjection/registrations/pipelineServiceRegistrations.js`

**Note:** If this file doesn't exist, it may be in a related registration file. Check:
- `src/dependencyInjection/registrations/actionRegistrations.js`
- `src/dependencyInjection/registrations/serviceRegistrations.js`
- Or create `pipelineServiceRegistrations.js` if appropriate

**Change:**
```javascript
import TargetResolutionTracingOrchestrator from '../../actions/pipeline/services/implementations/TargetResolutionTracingOrchestrator.js';
import { tokens } from '../tokens/tokens-core.js';

// In registration function:
container.register(
  tokens.ITargetResolutionTracingOrchestrator,
  ({ resolve }) => {
    return new TargetResolutionTracingOrchestrator({
      logger: resolve(tokens.ILogger),
    });
  }
);
```

#### 3. Update Stage Registration
**File:** `src/dependencyInjection/registrations/pipelineStageRegistrations.js` (or similar)

**Change:** Add `ITargetResolutionTracingOrchestrator` to `MultiTargetResolutionStage` dependencies (will be used in MULTARRESSTAREF-005)

## Acceptance Criteria

- [ ] Token defined in `tokens-core.js`
- [ ] Service registered with factory pattern
- [ ] Factory injects `ILogger` dependency
- [ ] Registration follows project DI patterns
- [ ] No circular dependencies introduced
- [ ] TypeScript checks pass (`npm run typecheck`)

## Dependencies

- **MULTARRESSTAREF-002** - Implementation must exist before registration
- **MULTARRESSTAREF-003** - Tests should pass before registration

## Testing Strategy

**Validation Test:**
```javascript
describe('DI Container - Tracing Orchestrator', () => {
  it('should resolve ITargetResolutionTracingOrchestrator', () => {
    const container = createContainer();
    const orchestrator = container.resolve(tokens.ITargetResolutionTracingOrchestrator);
    expect(orchestrator).toBeDefined();
    expect(typeof orchestrator.isActionAwareTrace).toBe('function');
  });

  it('should inject logger dependency', () => {
    const container = createContainer();
    const orchestrator = container.resolve(tokens.ITargetResolutionTracingOrchestrator);
    // Verify logger is injected (implementation-specific check)
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
- Ensure logger is properly injected
- Token name follows interface naming convention (`I` prefix)
- Factory pattern allows for dependency injection
- Will be consumed by `MultiTargetResolutionStage` in next phase
