import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import { MultiTargetResolutionStage } from '../../../../src/actions/pipeline/stages/MultiTargetResolutionStage.js';
import TargetResolutionTracingOrchestrator from '../../../../src/actions/pipeline/services/implementations/TargetResolutionTracingOrchestrator.js';
import ActionAwareStructuredTrace from '../../../../src/actions/tracing/actionAwareStructuredTrace.js';
import ActionTraceFilter from '../../../../src/actions/tracing/actionTraceFilter.js';
import TargetResolutionResultBuilder from '../../../../src/actions/pipeline/services/implementations/TargetResolutionResultBuilder.js';

describe('Multi-Target Resolution Tracing Integration', () => {
  let testBed;
  let stage;
  let trace;
  let mockDependencyResolver;
  let mockLegacyLayer;
  let mockContextBuilder;
  let mockNameResolver;
  let mockUnifiedScopeResolver;
  let mockEntityManager;
  let mockTargetResolver;
  let mockTargetContextBuilder;
  let tracingOrchestrator;
  let targetResolutionResultBuilder;

  beforeEach(() => {
    testBed = createTestBed();

    // Create mocks for all dependencies
    mockDependencyResolver = {
      getResolutionOrder: jest.fn().mockReturnValue(['primary', 'secondary']),
    };

    mockLegacyLayer = {
      isLegacyAction: jest.fn().mockReturnValue(false),
      convertLegacyFormat: jest.fn(),
      getMigrationSuggestion: jest.fn(),
    };

    mockContextBuilder = {
      buildScopeContext: jest.fn().mockReturnValue({
        actor: { id: 'test-actor' },
        location: { id: 'test-location' },
      }),
      buildScopeContextForSpecificPrimary: jest.fn().mockReturnValue({
        actor: { id: 'test-actor' },
        location: { id: 'test-location' },
      }),
    };

    mockNameResolver = {
      getEntityDisplayName: jest
        .fn()
        .mockImplementation((id) => `Name of ${id}`),
    };

    mockUnifiedScopeResolver = {
      resolve: jest.fn(),
    };

    mockEntityManager = {
      getEntityInstance: jest.fn().mockImplementation((id) => ({
        id,
        name: `Entity ${id}`,
      })),
    };

    mockTargetResolver = {
      resolveTargets: jest.fn(),
    };

    mockTargetContextBuilder = {
      buildContext: jest.fn(),
    };

    tracingOrchestrator = new TargetResolutionTracingOrchestrator({
      logger: testBed.mockLogger,
    });

    targetResolutionResultBuilder = new TargetResolutionResultBuilder({
      entityManager: mockEntityManager,
      logger: testBed.mockLogger,
    });

    // Create the stage with mocks
    stage = new MultiTargetResolutionStage({
      targetDependencyResolver: mockDependencyResolver,
      legacyTargetCompatibilityLayer: mockLegacyLayer,
      scopeContextBuilder: mockContextBuilder,
      targetDisplayNameResolver: mockNameResolver,
      unifiedScopeResolver: mockUnifiedScopeResolver,
      entityManager: mockEntityManager,
      targetResolver: mockTargetResolver,
      targetContextBuilder: mockTargetContextBuilder,
      logger: testBed.mockLogger,
      tracingOrchestrator,
      targetResolutionResultBuilder,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Multi-target action tracing', () => {
    it('should capture multi-target resolution data when trace supports it', async () => {
      // Create an ActionAwareStructuredTrace
      const actionTraceFilter = new ActionTraceFilter({
        enabled: true,
        actionIds: ['test:multi_action'],
        verbosity: 'detailed',
      });

      trace = new ActionAwareStructuredTrace({
        actionTraceFilter,
        actorId: 'test-actor',
        context: { test: true },
        logger: testBed.mockLogger,
      });

      // Mock scope resolver to return some entities
      mockUnifiedScopeResolver.resolve.mockResolvedValue({
        success: true,
        value: new Set(['entity1', 'entity2', 'entity3']),
        metadata: { cacheHit: false },
      });

      // Create multi-target action
      const actionDef = {
        id: 'test:multi_action',
        targets: {
          primary: {
            scope: 'actor.followers[]',
            placeholder: 'follower',
          },
          secondary: {
            scope: 'location.items[]',
            placeholder: 'item',
          },
        },
      };

      const context = {
        candidateActions: [actionDef],
        actor: { id: 'test-actor' },
        actionContext: { location: 'test-location' },
        trace,
        data: {},
      };

      // Execute the stage
      const result = await stage.executeInternal(context);

      // Verify the result
      expect(result.success).toBe(true);
      expect(result.data.actionsWithTargets).toHaveLength(1);

      // Get the captured multi-target data
      const multiTargetSummary =
        trace.getMultiTargetSummary('test:multi_action');

      expect(multiTargetSummary).toBeDefined();
      expect(multiTargetSummary.isMultiTarget).toBe(true);
      expect(multiTargetSummary.targetKeys).toEqual(['primary', 'secondary']);
      expect(multiTargetSummary.totalTargets).toBe(6); // 3 entities x 2 targets
      expect(multiTargetSummary.resolutionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should capture scope evaluation details for each target', async () => {
      const actionTraceFilter = new ActionTraceFilter({
        enabled: true,
        actionIds: ['test:action_with_scopes'],
        verbosity: 'detailed',
      });

      trace = new ActionAwareStructuredTrace({
        actionTraceFilter,
        actorId: 'test-actor',
        context: {},
        logger: testBed.mockLogger,
      });

      // Mock different results for different scopes
      mockUnifiedScopeResolver.resolve
        .mockResolvedValueOnce({
          success: true,
          value: new Set(['follower1', 'follower2']),
          metadata: { cacheHit: true },
        })
        .mockResolvedValueOnce({
          success: true,
          value: new Set(['item1', 'item2', 'item3']),
          metadata: { cacheHit: false },
        });

      const actionDef = {
        id: 'test:action_with_scopes',
        targets: {
          primary: {
            scope: 'actor.followers[]',
            placeholder: 'follower',
          },
          secondary: {
            scope: 'location.items[]',
            placeholder: 'item',
          },
        },
      };

      const context = {
        candidateActions: [actionDef],
        actor: { id: 'test-actor' },
        actionContext: { location: 'test-location' },
        trace,
        data: {},
      };

      // Spy on captureScopeEvaluation
      const captureScopeSpy = jest.spyOn(trace, 'captureScopeEvaluation');

      // Execute the stage
      await stage.executeInternal(context);

      // Verify scope evaluations were captured
      expect(captureScopeSpy).toHaveBeenCalledTimes(2);

      expect(captureScopeSpy).toHaveBeenCalledWith(
        'test:action_with_scopes',
        'primary',
        expect.objectContaining({
          scope: 'actor.followers[]',
          context: 'actor',
          resultCount: 2,
        })
      );

      expect(captureScopeSpy).toHaveBeenCalledWith(
        'test:action_with_scopes',
        'secondary',
        expect.objectContaining({
          scope: 'location.items[]',
          context: 'actor',
          resultCount: 3,
        })
      );

      const summary = trace.getMultiTargetSummary('test:action_with_scopes');
      expect(summary.scopeEvaluations).toHaveLength(1); // Only first one gets added to summary
    });

    it('should handle contextFrom dependencies in multi-target tracing', async () => {
      const actionTraceFilter = new ActionTraceFilter({
        enabled: true,
        actionIds: ['test:dependent_action'],
        verbosity: 'detailed',
      });

      trace = new ActionAwareStructuredTrace({
        actionTraceFilter,
        actorId: 'test-actor',
        context: {},
        logger: testBed.mockLogger,
      });

      // Mock resolution order with dependencies
      mockDependencyResolver.getResolutionOrder.mockReturnValue([
        'primary',
        'dependent',
      ]);

      // Mock scope resolver results
      mockUnifiedScopeResolver.resolve
        .mockResolvedValueOnce({
          success: true,
          value: new Set(['target1', 'target2']),
          metadata: { cacheHit: false },
        })
        .mockResolvedValueOnce({
          success: true,
          value: new Set(['dep1']),
          metadata: { cacheHit: false },
        })
        .mockResolvedValueOnce({
          success: true,
          value: new Set(['dep2', 'dep3']),
          metadata: { cacheHit: false },
        });

      const actionDef = {
        id: 'test:dependent_action',
        targets: {
          primary: {
            scope: 'actor.targets[]',
            placeholder: 'target',
          },
          dependent: {
            scope: 'target.dependencies[]',
            placeholder: 'dependency',
            contextFrom: 'primary',
          },
        },
      };

      const context = {
        candidateActions: [actionDef],
        actor: { id: 'test-actor' },
        actionContext: {},
        trace,
        data: {},
      };

      // Execute the stage
      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);

      const summary = trace.getMultiTargetSummary('test:dependent_action');
      expect(summary).toBeDefined();
      expect(summary.targetKeys).toContain('primary');
      expect(summary.targetKeys).toContain('dependent');
    });

    it('should handle legacy actions with multi-target tracing', async () => {
      const actionTraceFilter = new ActionTraceFilter({
        enabled: true,
        actionIds: ['test:legacy_action'],
        verbosity: 'detailed',
      });

      trace = new ActionAwareStructuredTrace({
        actionTraceFilter,
        actorId: 'test-actor',
        context: {},
        logger: testBed.mockLogger,
      });

      // Mark action as legacy
      mockLegacyLayer.isLegacyAction.mockReturnValue(true);
      mockLegacyLayer.convertLegacyFormat.mockReturnValue({
        targetDefinitions: {
          primary: { scope: 'actor', placeholder: 'target' },
        },
      });
      mockLegacyLayer.getMigrationSuggestion.mockReturnValue(
        'Migrate to modern format'
      );

      // Mock target resolver for legacy
      mockTargetResolver.resolveTargets.mockResolvedValue({
        success: true,
        value: [{ entityId: 'legacy1', displayName: 'Legacy Target 1' }],
      });

      const actionDef = {
        id: 'test:legacy_action',
        targets: 'self', // Legacy format
      };

      const context = {
        candidateActions: [actionDef],
        actor: { id: 'test-actor' },
        actionContext: {},
        trace,
        data: {},
      };

      // Spy on legacy capture methods
      const captureLegacyDetectionSpy = jest.spyOn(
        trace,
        'captureLegacyDetection'
      );
      const captureLegacyConversionSpy = jest.spyOn(
        trace,
        'captureLegacyConversion'
      );

      // Execute the stage
      await stage.executeInternal(context);

      // Verify legacy tracing was captured
      expect(captureLegacyDetectionSpy).toHaveBeenCalledWith(
        'test:legacy_action',
        expect.objectContaining({
          hasStringTargets: true,
          requiresConversion: true,
        })
      );

      expect(captureLegacyConversionSpy).toHaveBeenCalledWith(
        'test:legacy_action',
        expect.objectContaining({
          isLegacy: true,
          success: true,
        })
      );
    });

    it('should not break when trace does not support multi-target methods', async () => {
      // Create a basic trace without multi-target support
      const basicTrace = {
        step: jest.fn(),
        info: jest.fn(),
        success: jest.fn(),
        failure: jest.fn(),
        // No multi-target methods
      };

      mockDependencyResolver.getResolutionOrder.mockReturnValue(['primary']);

      mockUnifiedScopeResolver.resolve.mockResolvedValue({
        success: true,
        value: new Set(['entity1']),
        metadata: { cacheHit: false },
      });

      const actionDef = {
        id: 'test:action',
        targets: {
          primary: {
            scope: 'actor',
            placeholder: 'target',
          },
        },
      };

      const context = {
        candidateActions: [actionDef],
        actor: { id: 'test-actor' },
        actionContext: {},
        trace: basicTrace,
        data: {},
      };

      // Should execute without errors
      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.data.actionsWithTargets).toHaveLength(1);
    });

    it('should capture performance metrics for large target sets', async () => {
      const actionTraceFilter = new ActionTraceFilter({
        enabled: true,
        actionIds: ['test:large_target_action'],
        verbosity: 'detailed',
      });

      trace = new ActionAwareStructuredTrace({
        actionTraceFilter,
        actorId: 'test-actor',
        context: {},
        logger: testBed.mockLogger,
      });

      // Create a large set of entities
      const largeEntitySet = new Set();
      for (let i = 0; i < 150; i++) {
        largeEntitySet.add(`entity${i}`);
      }

      mockDependencyResolver.getResolutionOrder.mockReturnValue(['primary']);

      mockUnifiedScopeResolver.resolve.mockResolvedValue({
        success: true,
        value: largeEntitySet,
        metadata: { cacheHit: false },
      });

      const actionDef = {
        id: 'test:large_target_action',
        targets: {
          primary: {
            scope: 'location.all_entities[]',
            placeholder: 'entity',
          },
        },
      };

      const context = {
        candidateActions: [actionDef],
        actor: { id: 'test-actor' },
        actionContext: {},
        trace,
        data: {},
      };

      const startTime = Date.now();
      const result = await stage.executeInternal(context);
      const executionTime = Date.now() - startTime;

      expect(result.success).toBe(true);

      const summary = trace.getMultiTargetSummary('test:large_target_action');
      expect(summary).toBeDefined();
      expect(summary.totalTargets).toBe(150);
      expect(summary.resolutionTimeMs).toBeGreaterThanOrEqual(0);

      // In real execution with actual async operations, time would be > 0
      // In test environment, Date.now() might not advance between calls
    });
  });
});
