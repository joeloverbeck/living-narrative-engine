import { describe, it, expect, beforeEach } from '@jest/globals';
import { MultiTargetResolutionStage } from '../../../../../src/actions/pipeline/stages/MultiTargetResolutionStage.js';
import TargetResolutionTracingOrchestrator from '../../../../../src/actions/pipeline/services/implementations/TargetResolutionTracingOrchestrator.js';
import TargetResolutionResultBuilder from '../../../../../src/actions/pipeline/services/implementations/TargetResolutionResultBuilder.js';

const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createActionAwareTrace = () => ({
  captureActionData: jest.fn(),
  captureLegacyDetection: jest.fn(),
  captureLegacyConversion: jest.fn(),
  step: jest.fn(),
  info: jest.fn(),
});

describe('MultiTargetResolutionStage edge cases', () => {
  let stage;
  let mockDeps;
  let trace;

  beforeEach(() => {
    const logger = createMockLogger();
    const entityManager = {
      getEntityInstance: jest.fn((id) => (id ? { id } : null)),
    };

    mockDeps = {
      legacyTargetCompatibilityLayer: {
        isLegacyAction: jest.fn(),
        convertLegacyFormat: jest.fn(),
        getMigrationSuggestion: jest.fn(),
      },
      targetDisplayNameResolver: {
        getEntityDisplayName: jest.fn(),
      },
      unifiedScopeResolver: {
        resolve: jest.fn(),
      },
      entityManager,
      targetResolver: {
        resolveTargets: jest.fn(),
      },
      logger,
      tracingOrchestrator: new TargetResolutionTracingOrchestrator({ logger }),
      targetResolutionResultBuilder: new TargetResolutionResultBuilder({
        entityManager,
        logger,
      }),
      targetResolutionCoordinator: {
        coordinateResolution: jest.fn(),
      },
    };

    stage = new MultiTargetResolutionStage(mockDeps);
    trace = createActionAwareTrace();
  });

  describe('null actionContext', () => {
    it('should handle null actionContext gracefully', async () => {
      const actionDef = {
        id: 'test:legacy-null-context',
        targets: 'test:scope',
      };

      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        true
      );
      mockDeps.legacyTargetCompatibilityLayer.convertLegacyFormat.mockReturnValue(
        {
          targetDefinitions: {
            primary: { scope: 'test:scope', placeholder: 'target' },
          },
        }
      );
      mockDeps.targetResolver.resolveTargets.mockResolvedValue({
        success: true,
        value: [],
      });

      const result = await stage.executeInternal({
        candidateActions: [actionDef],
        actor: { id: 'actor-1' },
        actionContext: null,
        trace,
        data: {},
      });

      expect(result.success).toBe(true);
      expect(mockDeps.targetResolver.resolveTargets).toHaveBeenCalledWith(
        'test:scope',
        { id: 'actor-1' },
        null,
        trace,
        'test:legacy-null-context'
      );
      expect(mockDeps.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('[DIAGNOSTIC] Legacy resolution'),
        expect.objectContaining({
          hasActionContext: false,
          actionContextKeys: [],
        })
      );
    });
  });

  describe('displayName fallback', () => {
    it('should use fallback resolver for empty string displayName', async () => {
      const actionDef = {
        id: 'test:legacy-empty-display',
        targets: 'test:scope',
      };

      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        true
      );
      mockDeps.legacyTargetCompatibilityLayer.convertLegacyFormat.mockReturnValue(
        {
          targetDefinitions: {
            primary: { scope: 'test:scope', placeholder: 'target' },
          },
        }
      );
      mockDeps.targetResolver.resolveTargets.mockResolvedValue({
        success: true,
        value: [{ entityId: 'entity-1', displayName: '' }],
      });
      mockDeps.targetDisplayNameResolver.getEntityDisplayName.mockReturnValue(
        'Resolved Name'
      );

      const result = await stage.executeInternal({
        candidateActions: [actionDef],
        actor: { id: 'actor-1' },
        actionContext: {},
        trace,
        data: {},
      });

      expect(result.success).toBe(true);
      expect(
        mockDeps.targetDisplayNameResolver.getEntityDisplayName
      ).toHaveBeenCalledWith('entity-1');
      expect(result.data.targetContexts[0].displayName).toBe('Resolved Name');
    });

    it('should use fallback resolver for non-string displayName', async () => {
      const actionDef = {
        id: 'test:legacy-nonstring-display',
        targets: 'test:scope',
      };

      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        true
      );
      mockDeps.legacyTargetCompatibilityLayer.convertLegacyFormat.mockReturnValue(
        {
          targetDefinitions: {
            primary: { scope: 'test:scope', placeholder: 'target' },
          },
        }
      );
      mockDeps.targetResolver.resolveTargets.mockResolvedValue({
        success: true,
        value: [{ entityId: 'entity-2', displayName: 123 }],
      });
      mockDeps.targetDisplayNameResolver.getEntityDisplayName.mockReturnValue(
        'Resolved Name'
      );

      const result = await stage.executeInternal({
        candidateActions: [actionDef],
        actor: { id: 'actor-1' },
        actionContext: {},
        trace,
        data: {},
      });

      expect(result.success).toBe(true);
      expect(
        mockDeps.targetDisplayNameResolver.getEntityDisplayName
      ).toHaveBeenCalledWith('entity-2');
      expect(result.data.targetContexts[0].displayName).toBe('Resolved Name');
    });
  });

  describe('error propagation', () => {
    it('should record error when legacy resolver returns invalid envelope', async () => {
      const actionDef = {
        id: 'test:legacy-invalid-envelope',
        targets: 'test:scope',
      };

      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        true
      );
      mockDeps.legacyTargetCompatibilityLayer.convertLegacyFormat.mockReturnValue(
        {
          targetDefinitions: {
            primary: { scope: 'test:scope', placeholder: 'target' },
          },
        }
      );
      mockDeps.targetResolver.resolveTargets.mockResolvedValue({
        value: [],
      });

      const result = await stage.executeInternal({
        candidateActions: [actionDef],
        actor: { id: 'actor-1' },
        actionContext: {},
        trace,
        data: {},
      });

      expect(result.success).toBe(true);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].error).toContain(
        'TargetResolver must return { success: boolean } envelope'
      );
    });

    it('should record error when coordinator returns invalid envelope', async () => {
      const actionDef = {
        id: 'test:multi-invalid-envelope',
        targets: {
          primary: { scope: 'test:scope', placeholder: 'target' },
        },
      };

      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        false
      );
      mockDeps.targetResolutionCoordinator.coordinateResolution.mockResolvedValue(
        {
          data: { actionsWithTargets: [] },
        }
      );

      const result = await stage.executeInternal({
        candidateActions: [actionDef],
        actor: { id: 'actor-1' },
        actionContext: {},
        trace,
        data: {},
      });

      expect(result.success).toBe(true);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].error).toContain(
        'Coordinator must return { success: boolean } envelope'
      );
    });

    it('should capture null error without crashing', async () => {
      const actionDef = {
        id: 'test:multi-null-error',
        targets: {
          primary: { scope: 'test:scope', placeholder: 'target' },
        },
      };

      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        false
      );
      mockDeps.targetResolutionCoordinator.coordinateResolution.mockRejectedValue(
        null
      );

      const result = await stage.executeInternal({
        candidateActions: [actionDef],
        actor: { id: 'actor-1' },
        actionContext: {},
        trace,
        data: {},
      });

      expect(result.success).toBe(true);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(trace.captureActionData).toHaveBeenCalled();
    });

    it('should capture string error without crashing', async () => {
      const actionDef = {
        id: 'test:multi-string-error',
        targets: {
          primary: { scope: 'test:scope', placeholder: 'target' },
        },
      };

      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        false
      );
      mockDeps.targetResolutionCoordinator.coordinateResolution.mockRejectedValue(
        'Connection failed'
      );

      const result = await stage.executeInternal({
        candidateActions: [actionDef],
        actor: { id: 'actor-1' },
        actionContext: {},
        trace,
        data: {},
      });

      expect(result.success).toBe(true);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(trace.captureActionData).toHaveBeenCalled();
    });
  });
});
