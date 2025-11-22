# Integration Test Patterns

This document provides patterns and best practices for writing integration tests in the Living Narrative Engine.

## Testing Target Resolution Services

### Overview
The target resolution stage uses three specialized services. Each service should be tested independently in unit tests, with integration tests verifying their coordination.

### Testing Tracing Orchestrator

**Unit Test Patterns:**
```javascript
describe('TargetResolutionTracingOrchestrator', () => {
  let orchestrator;
  let mockLogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    orchestrator = new TargetResolutionTracingOrchestrator({ logger: mockLogger });
  });

  describe('Capability Detection', () => {
    it('should detect action-aware trace capabilities', () => {
      const actionAwareTrace = { captureActionData: jest.fn() };
      expect(orchestrator.isActionAwareTrace(actionAwareTrace)).toBe(true);
    });

    it('should detect non-action-aware traces', () => {
      const standardTrace = {};
      expect(orchestrator.isActionAwareTrace(standardTrace)).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing trace methods gracefully', () => {
      const trace = {};
      expect(() => {
        orchestrator.captureLegacyDetection(trace, 'action-id', {});
      }).not.toThrow();
    });
  });
});
```

**Integration Test Patterns:**
```javascript
describe('Tracing Integration', () => {
  it('should capture trace data during resolution', async () => {
    const trace = createActionAwareTrace();
    const stage = createStageWithServices({ trace });

    await stage.execute(context);

    expect(trace.captureActionData).toHaveBeenCalledWith(
      'legacy_action_detected',
      expect.objectContaining({ actionId: expect.any(String) })
    );
  });
});
```

### Testing Result Builder

**Unit Test Patterns:**
```javascript
describe('TargetResolutionResultBuilder', () => {
  let builder;
  let mockEntityManager;
  let mockLogger;

  beforeEach(() => {
    mockEntityManager = createMockEntityManager();
    mockLogger = createMockLogger();
    builder = new TargetResolutionResultBuilder({
      entityManager: mockEntityManager,
      logger: mockLogger
    });
  });

  describe('Backward Compatibility', () => {
    it('should include targetContexts for legacy actions', () => {
      const result = builder.buildLegacyResult(
        context,
        resolvedTargets,
        targetContexts,
        conversionResult,
        actionDef
      );

      expect(result.data.targetContexts).toBeDefined();
      expect(result.data.targetContexts).toEqual(targetContexts);
    });

    it('should format legacy results consistently', () => {
      const result = builder.buildLegacyResult(/* ... */);

      expect(result.data.candidateActions).toHaveLength(1);
      expect(result.data.candidateActions[0]).toMatchObject({
        ...actionDef,
        resolvedTargets: expect.any(Object)
      });
    });
  });

  describe('Multi-Target Results', () => {
    it('should build results with all resolved targets', () => {
      const resolutionResults = {
        primary: [{ id: 'entity1', displayName: 'Entity 1' }],
        secondary: [{ id: 'entity2', displayName: 'Entity 2' }]
      };

      const result = builder.buildMultiTargetResult(
        context,
        resolutionResults,
        actionDef
      );

      expect(result.data.candidateActions[0].resolvedTargets)
        .toEqual(resolutionResults);
    });
  });
});
```

### Testing Resolution Coordinator

**Unit Test Patterns:**
```javascript
describe('TargetResolutionCoordinator', () => {
  let coordinator;
  let mockServices;

  beforeEach(() => {
    mockServices = createMockCoordinatorServices();
    coordinator = new TargetResolutionCoordinator(mockServices);
  });

  describe('Dependency Order Resolution', () => {
    it('should resolve independent targets first', async () => {
      const action = {
        targets: [
          { placeholder: 'primary', scope: 'scope:primary' },
          { placeholder: 'dependent', scope: 'scope:dependent', contextFrom: 'primary' }
        ]
      };

      const result = await coordinator.resolveTargets(context, action, trace);

      // Verify primary resolved before dependent
      expect(result.primary).toBeDefined();
      expect(result.dependent).toBeDefined();
    });

    it('should handle circular dependencies gracefully', async () => {
      const action = {
        targets: [
          { placeholder: 'a', scope: 'scope:a', contextFrom: 'b' },
          { placeholder: 'b', scope: 'scope:b', contextFrom: 'a' }
        ]
      };

      await expect(coordinator.resolveTargets(context, action, trace))
        .rejects.toThrow('circular dependency');
    });
  });

  describe('contextFrom Handling', () => {
    it('should pass primary target as context for dependent', async () => {
      const action = {
        targets: [
          { placeholder: 'actor', scope: 'scope:actor' },
          { placeholder: 'nearby', scope: 'scope:nearby', contextFrom: 'actor' }
        ]
      };

      await coordinator.resolveTargets(context, action, trace);

      expect(mockServices.contextBuilder.buildScopeContextForSpecificPrimary)
        .toHaveBeenCalledWith(
          expect.any(Object),
          'actor',
          expect.objectContaining({ id: expect.any(String) })
        );
    });
  });
});
```

**Integration Test Patterns:**
```javascript
describe('Resolution Coordinator Integration', () => {
  it('should coordinate full multi-target resolution', async () => {
    const fixture = await ModTestFixture.forAction('test-mod', 'test-mod:multi_target_action');
    const scenario = fixture.createStandardActorTarget();

    await fixture.executeAction(scenario.actor.id, scenario.target.id);

    const actions = fixture.getAvailableActions();
    expect(actions[0].resolvedTargets).toMatchObject({
      actor: [{ id: scenario.actor.id }],
      target: [{ id: scenario.target.id }]
    });
  });
});
```

### Common Test Utilities

**Service Mocking:**
```javascript
// tests/common/mocks/targetResolutionMocks.js
export function createMockTracingOrchestrator() {
  return {
    isActionAwareTrace: jest.fn().mockReturnValue(true),
    captureLegacyDetection: jest.fn(),
    captureScopeEvaluation: jest.fn(),
    captureResolutionData: jest.fn(),
    captureError: jest.fn()
  };
}

export function createMockResultBuilder() {
  return {
    buildLegacyResult: jest.fn().mockReturnValue(PipelineResult.success({})),
    buildMultiTargetResult: jest.fn().mockReturnValue(PipelineResult.success({})),
    buildFinalResult: jest.fn().mockReturnValue(PipelineResult.success({}))
  };
}

export function createMockResolutionCoordinator() {
  return {
    resolveTargets: jest.fn().mockResolvedValue({
      primary: [],
      secondary: []
    })
  };
}
```
