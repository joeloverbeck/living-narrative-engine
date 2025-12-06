/**
 * @file Unit tests for TargetComponentValidationStage
 * @see src/actions/pipeline/stages/TargetComponentValidationStage.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { TargetComponentValidationStage } from '../../../../../src/actions/pipeline/stages/TargetComponentValidationStage.js';
import { PipelineResult } from '../../../../../src/actions/pipeline/PipelineResult.js';
import { createTestBed } from '../../../../common/testBed.js';

describe('TargetComponentValidationStage', () => {
  let stage;
  let mockValidator;
  let mockRequiredValidator;
  let mockLogger;
  let mockErrorContextBuilder;
  let mockConfigProvider;
  let mockConfigSnapshot;
  let mockReporter;
  let context;
  let testBed;

  beforeEach(() => {
    // Create test bed instance
    testBed = createTestBed();

    // Create mocks with proper method signatures
    mockValidator = testBed.createMock('ITargetComponentValidator', [
      'validateTargetComponents',
    ]);
    mockRequiredValidator = testBed.createMock(
      'ITargetRequiredComponentsValidator',
      ['validateTargetRequirements']
    );
    mockLogger = testBed.createMockLogger();
    mockErrorContextBuilder = testBed.createMock('IActionErrorContextBuilder', [
      'buildErrorContext',
    ]);

    mockConfigSnapshot = {
      validationEnabled: true,
      skipValidation: false,
      strictness: 'strict',
      logDetails: false,
      performanceThreshold: 5,
      shouldSkipAction: jest.fn(() => false),
    };
    mockConfigProvider = {
      getSnapshot: jest.fn(() => mockConfigSnapshot),
    };
    mockReporter = {
      reportStageSkipped: jest.fn(),
      reportStageStart: jest.fn(),
      reportStageCompletion: jest.fn(),
      reportValidationAnalysis: jest.fn().mockResolvedValue(undefined),
      reportPerformanceData: jest.fn().mockResolvedValue(undefined),
    };

    // Create stage instance
    stage = new TargetComponentValidationStage({
      targetComponentValidator: mockValidator,
      targetRequiredComponentsValidator: mockRequiredValidator,
      logger: mockLogger,
      actionErrorContextBuilder: mockErrorContextBuilder,
      configProvider: mockConfigProvider,
      validationReporter: mockReporter,
    });

    // Setup basic context
    context = {
      actor: { id: 'test-actor' },
      candidateActions: [],
      trace: null,
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with valid dependencies', () => {
      expect(stage).toBeDefined();
      expect(stage.name).toBe('TargetComponentValidation');
    });

    it('should validate required dependencies', () => {
      expect(() => {
        new TargetComponentValidationStage({
          targetComponentValidator: null,
          targetRequiredComponentsValidator: mockRequiredValidator,
          logger: mockLogger,
          actionErrorContextBuilder: mockErrorContextBuilder,
        });
      }).toThrow();

      expect(() => {
        new TargetComponentValidationStage({
          targetComponentValidator: mockValidator,
          targetRequiredComponentsValidator: null,
          logger: mockLogger,
          actionErrorContextBuilder: mockErrorContextBuilder,
        });
      }).toThrow();
    });
  });

  describe('executeInternal', () => {
    it('should return success with empty array when no candidate actions', async () => {
      const result = await stage.executeInternal(context);

      expect(result).toBeInstanceOf(PipelineResult);
      expect(result.success).toBe(true);
      expect(result.data.candidateActions).toEqual([]);
      expect(result.continueProcessing).toBe(false);
      expect(mockReporter.reportStageStart).toHaveBeenCalled();
      expect(mockReporter.reportStageCompletion).toHaveBeenCalled();
    });

    it('should filter actions with forbidden target components', async () => {
      const actionWithForbidden = {
        id: 'action-1',
        forbidden_components: { target: ['forbidden-component'] },
        target_entity: { id: 'target-1' },
      };

      const actionWithoutForbidden = {
        id: 'action-2',
        forbidden_components: { target: [] },
        target_entity: { id: 'target-2' },
      };

      context.candidateActions = [actionWithForbidden, actionWithoutForbidden];

      // Setup mock validator responses
      mockValidator.validateTargetComponents
        .mockReturnValueOnce({
          valid: false,
          reason: 'Target has forbidden component',
        })
        .mockReturnValueOnce({
          valid: true,
        });

      // Required validator passes for both
      mockRequiredValidator.validateTargetRequirements.mockReturnValue({
        valid: true,
      });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.data.candidateActions).toHaveLength(1);
      expect(result.data.candidateActions[0].id).toBe('action-2');
      expect(mockValidator.validateTargetComponents).toHaveBeenCalledTimes(2);
      expect(mockConfigSnapshot.shouldSkipAction).toHaveBeenCalledTimes(2);
    });

    it('should pass actions without forbidden components', async () => {
      const action = {
        id: 'action-1',
        forbidden_components: null,
        target_entity: { id: 'target-1' },
      };

      context.candidateActions = [action];

      mockValidator.validateTargetComponents.mockReturnValue({
        valid: true,
      });
      mockRequiredValidator.validateTargetRequirements.mockReturnValue({
        valid: true,
      });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.data.candidateActions).toHaveLength(1);
      expect(result.data.candidateActions[0]).toBe(action);
      expect(mockReporter.reportValidationAnalysis).toHaveBeenCalled();
      expect(mockReporter.reportPerformanceData).toHaveBeenCalled();
    });

    it('should handle actions without targets gracefully', async () => {
      const actionWithoutTarget = {
        id: 'action-1',
        forbidden_components: { target: ['some-component'] },
        // No target_entity field
      };

      context.candidateActions = [actionWithoutTarget];

      mockValidator.validateTargetComponents.mockReturnValue({
        valid: true,
      });
      mockRequiredValidator.validateTargetRequirements.mockReturnValue({
        valid: true,
      });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.data.candidateActions).toHaveLength(1);
    });

    it('should process multi-target actions correctly', async () => {
      const multiTargetAction = {
        id: 'multi-action',
        forbidden_components: {
          primary: ['forbidden-1'],
          secondary: ['forbidden-2'],
        },
        target_entities: {
          primary: { id: 'primary-target' },
          secondary: { id: 'secondary-target' },
        },
      };

      context.candidateActions = [multiTargetAction];

      mockValidator.validateTargetComponents.mockReturnValue({
        valid: true,
      });
      mockRequiredValidator.validateTargetRequirements.mockReturnValue({
        valid: true,
      });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(mockValidator.validateTargetComponents).toHaveBeenCalledWith(
        multiTargetAction,
        expect.objectContaining({
          primary: { id: 'primary-target' },
          secondary: { id: 'secondary-target' },
        })
      );
    });

    it('should return PipelineResult object, not raw array', async () => {
      context.candidateActions = [{ id: 'action-1' }];

      mockValidator.validateTargetComponents.mockReturnValue({
        valid: true,
      });
      mockRequiredValidator.validateTargetRequirements.mockReturnValue({
        valid: true,
      });

      const result = await stage.executeInternal(context);

      expect(result).toBeInstanceOf(PipelineResult);
      expect(result.success).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.continueProcessing).toBeDefined();
    });

    it('should filter actions when targets missing required components', async () => {
      const actionWithRequiredComponents = {
        id: 'action-1',
        required_components: {
          primary: ['positioning:sitting_on', 'positioning:closeness'],
        },
        target_entities: {
          primary: {
            id: 'target-1',
            components: { 'positioning:closeness': {} },
          },
        },
      };

      const actionWithAllRequired = {
        id: 'action-2',
        required_components: {
          primary: ['positioning:closeness'],
        },
        target_entities: {
          primary: {
            id: 'target-2',
            components: { 'positioning:closeness': {} },
          },
        },
      };

      context.candidateActions = [
        actionWithRequiredComponents,
        actionWithAllRequired,
      ];

      // Forbidden validator passes both
      mockValidator.validateTargetComponents.mockReturnValue({
        valid: true,
      });

      // Required validator - first fails, second passes
      mockRequiredValidator.validateTargetRequirements
        .mockReturnValueOnce({
          valid: false,
          reason:
            'Target (primary) must have component: positioning:sitting_on',
        })
        .mockReturnValueOnce({
          valid: true,
        });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.data.candidateActions).toHaveLength(1);
      expect(result.data.candidateActions[0].id).toBe('action-2');
      expect(
        mockRequiredValidator.validateTargetRequirements
      ).toHaveBeenCalledTimes(2);
    });

    it('should remove multi-target actions with no resolved candidates for a required target', async () => {
      const actionDef = {
        id: 'clothing:remove_clothing',
        targets: {
          primary: { placeholder: 'target' },
        },
        resolvedTargets: { primary: [] },
      };

      context.actionsWithTargets = [
        {
          actionDef,
          resolvedTargets: { primary: [] },
          targetDefinitions: actionDef.targets,
          isMultiTarget: true,
          targetContexts: [],
        },
      ];

      mockValidator.validateTargetComponents.mockReturnValue({ valid: true });
      mockRequiredValidator.validateTargetRequirements.mockReturnValue({
        valid: true,
      });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.data.actionsWithTargets).toHaveLength(0);
      expect(result.continueProcessing).toBe(false);
    });

    it('should remove actions when dependent targets lose all candidates', async () => {
      const actionDef = {
        id: 'sex-penile-manual:rub_penis_over_clothes',
        targets: {
          primary: { placeholder: 'primary' },
          secondary: { placeholder: 'secondary', contextFrom: 'primary' },
        },
        resolvedTargets: {
          primary: [{ id: 'actor:partner' }],
          secondary: [],
        },
      };

      context.actionsWithTargets = [
        {
          actionDef,
          resolvedTargets: { ...actionDef.resolvedTargets },
          targetDefinitions: actionDef.targets,
          isMultiTarget: true,
          targetContexts: [],
        },
      ];

      mockValidator.validateTargetComponents.mockReturnValue({ valid: true });
      mockRequiredValidator.validateTargetRequirements.mockReturnValue({
        valid: true,
      });

      const result = await stage.executeInternal(context);

      expect(result.data.actionsWithTargets).toHaveLength(0);
      expect(result.continueProcessing).toBe(false);
    });

    it('should pass actions when targets have all required components', async () => {
      const action = {
        id: 'action-1',
        required_components: {
          primary: ['positioning:sitting_on', 'positioning:closeness'],
        },
        target_entities: {
          primary: {
            id: 'target-1',
            components: {
              'positioning:sitting_on': {},
              'positioning:closeness': {},
            },
          },
        },
      };

      context.candidateActions = [action];

      mockValidator.validateTargetComponents.mockReturnValue({
        valid: true,
      });
      mockRequiredValidator.validateTargetRequirements.mockReturnValue({
        valid: true,
      });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.data.candidateActions).toHaveLength(1);
      expect(result.data.candidateActions[0]).toBe(action);
      expect(
        mockRequiredValidator.validateTargetRequirements
      ).toHaveBeenCalledWith(
        action,
        expect.objectContaining({
          primary: expect.objectContaining({
            id: 'target-1',
          }),
        })
      );
    });

    it('should filter actions when forbidden validation passes but required validation fails', async () => {
      const action = {
        id: 'action-1',
        forbidden_components: {
          primary: ['some-forbidden-component'],
        },
        required_components: {
          primary: ['required-component'],
        },
        target_entities: {
          primary: {
            id: 'target-1',
            components: {
              'other-component': {},
              // Missing required-component
            },
          },
        },
      };

      context.candidateActions = [action];

      // Forbidden passes (target doesn't have forbidden component)
      mockValidator.validateTargetComponents.mockReturnValue({
        valid: true,
      });

      // Required fails (target missing required component)
      mockRequiredValidator.validateTargetRequirements.mockReturnValue({
        valid: false,
        reason: 'Target (primary) must have component: required-component',
      });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.data.candidateActions).toHaveLength(0);
      expect(result.continueProcessing).toBe(false);
    });

    it('should include actor entity when validating required components', async () => {
      const action = {
        id: 'actor-required-action',
        required_components: {
          actor: ['positioning:closeness'],
        },
      };

      context.actor = {
        id: 'player-1',
        components: { 'positioning:closeness': {} },
      };
      context.candidateActions = [action];

      mockValidator.validateTargetComponents.mockReturnValue({
        valid: true,
      });
      mockRequiredValidator.validateTargetRequirements.mockReturnValue({
        valid: true,
      });

      await stage.executeInternal(context);

      expect(
        mockRequiredValidator.validateTargetRequirements
      ).toHaveBeenCalledWith(
        action,
        expect.objectContaining({
          actor: context.actor,
        })
      );
    });

    it('prunes forbidden target candidates without removing the action', async () => {
      const actionDef = {
        id: 'action-with-forbidden-targets',
        forbidden_components: { primary: ['positioning:being_restrained'] },
        targetDefinitions: { primary: { placeholder: 'target' } },
        resolvedTargets: {
          primary: [{ id: 'allowed' }, { id: 'restrained' }],
        },
      };

      context.actionsWithTargets = [
        {
          actionDef,
          resolvedTargets: { ...actionDef.resolvedTargets },
          targetDefinitions: actionDef.targetDefinitions,
          targetContexts: [
            { type: 'entity', entityId: 'allowed', placeholder: 'target' },
            { type: 'entity', entityId: 'restrained', placeholder: 'target' },
          ],
          isMultiTarget: true,
        },
      ];

      mockValidator.validateTargetComponents.mockReturnValue({
        valid: true,
        filteredTargets: { primary: [{ id: 'allowed' }] },
        removedTargets: [
          {
            role: 'primary',
            targetId: 'restrained',
            component: 'positioning:being_restrained',
          },
        ],
      });

      mockRequiredValidator.validateTargetRequirements.mockReturnValue({
        valid: true,
      });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.data.actionsWithTargets).toHaveLength(1);
      expect(result.data.actionsWithTargets[0].resolvedTargets.primary).toEqual(
        [{ id: 'allowed' }]
      );
      expect(
        result.data.actionsWithTargets[0].targetContexts.map(
          (ctx) => ctx.entityId
        )
      ).toEqual(['allowed']);
    });

    it('should not overwrite resolved targets for other actions when filtering required components', async () => {
      const makeCandidate = (id, components = {}) => ({
        id,
        entity: {
          id,
          components,
          hasComponent: (componentId) => Boolean(components[componentId]),
        },
      });

      const readableItemCandidates = [
        makeCandidate('letter', {
          'items:item': {},
          'items:readable': {},
        }),
        makeCandidate('photo-1', {
          'items:item': {},
        }),
        makeCandidate('photo-2', {
          'items:item': {},
        }),
        makeCandidate('desk', {
          'items:item': {},
        }),
      ];

      const clothingCandidates = [
        makeCandidate('tshirt'),
        makeCandidate('jeans'),
        makeCandidate('boots'),
        makeCandidate('belt'),
      ];

      const readItemAction = {
        id: 'items:read_item',
        required_components: { primary: ['items:item', 'items:readable'] },
        resolvedTargets: {
          primary: readableItemCandidates,
        },
        targetDefinitions: {
          primary: { placeholder: 'item' },
        },
      };

      const sharedClothingTargets = {
        primary: clothingCandidates,
      };

      const removeClothingAction = {
        id: 'clothing:remove_clothing',
        required_components: { actor: ['clothing:equipment'] },
        resolvedTargets: sharedClothingTargets,
        targetDefinitions: {
          primary: { placeholder: 'target' },
        },
      };

      const actor = {
        id: 'actor-1',
        components: {
          'clothing:equipment': {},
        },
        hasComponent: (componentId) => componentId === 'clothing:equipment',
      };

      const actionsWithTargets = [
        {
          actionDef: readItemAction,
          resolvedTargets: readItemAction.resolvedTargets,
          targetDefinitions: readItemAction.targetDefinitions,
        },
        {
          actionDef: removeClothingAction,
          resolvedTargets: sharedClothingTargets,
          targetDefinitions: removeClothingAction.targetDefinitions,
        },
      ];

      mockValidator.validateTargetComponents.mockReturnValue({ valid: true });
      mockRequiredValidator.validateTargetRequirements.mockReturnValue({
        valid: true,
      });

      const result = await stage.executeInternal({
        actor,
        actionsWithTargets,
        resolvedTargets: sharedClothingTargets,
        trace: null,
      });

      expect(result.success).toBe(true);

      const prunedAction = result.data.actionsWithTargets[0];
      expect(
        prunedAction.resolvedTargets.primary.map((target) => target.id)
      ).toEqual(['letter']);

      expect(
        readItemAction.resolvedTargets.primary.map((target) => target.id)
      ).toEqual(['letter', 'photo-1', 'photo-2', 'desk']);

      const expectedClothingIds = ['tshirt', 'jeans', 'boots', 'belt'];

      expect(
        removeClothingAction.resolvedTargets.primary.map((target) => target.id)
      ).toEqual(expectedClothingIds);
      expect(
        actionsWithTargets[1].resolvedTargets.primary.map((target) => target.id)
      ).toEqual(expectedClothingIds);
    });
  });

  describe('action-aware tracing', () => {
    let mockTrace;

    beforeEach(() => {
      mockTrace = {
        step: jest.fn(),
        success: jest.fn(),
        captureActionData: jest.fn().mockResolvedValue(undefined),
      };
      context.trace = mockTrace;

      // Default mock for required validator
      mockRequiredValidator.validateTargetRequirements.mockReturnValue({
        valid: true,
      });
    });

    it('should delegate action data capture to the reporter when trace supports it', async () => {
      const action = {
        id: 'traced-action',
        forbidden_components: { target: ['component-1'] },
      };

      context.candidateActions = [action];

      mockValidator.validateTargetComponents.mockReturnValue({
        valid: true,
      });

      await stage.executeInternal(context);

      expect(mockReporter.reportValidationAnalysis).toHaveBeenCalledWith(
        expect.objectContaining({
          trace: mockTrace,
          actionDef: action,
          validation: expect.objectContaining({ valid: true }),
        })
      );
      expect(mockTrace.captureActionData).not.toHaveBeenCalled();
    });

    it('should delegate performance capture to the reporter for each action', async () => {
      const action = {
        id: 'perf-action',
        forbidden_components: {},
      };

      context.candidateActions = [action];

      mockValidator.validateTargetComponents.mockReturnValue({
        valid: true,
      });

      await stage.executeInternal(context);

      expect(mockReporter.reportPerformanceData).toHaveBeenCalledWith(
        expect.objectContaining({
          trace: mockTrace,
          actionDef: action,
          totalCandidates: 1,
        })
      );
      expect(mockTrace.captureActionData).not.toHaveBeenCalled();
    });

    it('should create and manage trace spans', async () => {
      mockTrace.startSpan = jest.fn().mockReturnValue({
        setAttribute: jest.fn(),
        setStatus: jest.fn(),
        setError: jest.fn(),
      });
      mockTrace.endSpan = jest.fn();

      await stage.execute(context);

      expect(mockTrace.startSpan).toHaveBeenCalled();
      expect(mockTrace.endSpan).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should use ActionErrorContextBuilder for errors', async () => {
      const error = new Error('Validation failed');
      context.candidateActions = [{ id: 'action-1' }];

      mockValidator.validateTargetComponents.mockImplementation(() => {
        throw error;
      });

      mockErrorContextBuilder.buildErrorContext.mockReturnValue({
        error: error.message,
        stage: 'target_component_validation',
      });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(false);
      expect(mockErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith(
        expect.objectContaining({
          error,
          phase: 'discovery',
        })
      );
    });

    it('should return PipelineResult with failure status on error', async () => {
      const error = new Error('Test error');
      context.candidateActions = [{ id: 'action-1' }];

      mockValidator.validateTargetComponents.mockImplementation(() => {
        throw error;
      });

      mockErrorContextBuilder.buildErrorContext.mockReturnValue({
        error: error.message,
      });

      const result = await stage.executeInternal(context);

      expect(result).toBeInstanceOf(PipelineResult);
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors).toHaveLength(1);
    });

    it('should not throw exceptions', async () => {
      context.candidateActions = [{ id: 'action-1' }];

      mockValidator.validateTargetComponents.mockImplementation(() => {
        throw new Error('Internal error');
      });

      mockErrorContextBuilder.buildErrorContext.mockReturnValue({
        error: 'Internal error',
      });

      // Should not throw
      const result = await stage.executeInternal(context);

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
    });
  });

  describe('performance', () => {
    beforeEach(() => {
      // Default mock for required validator
      mockRequiredValidator.validateTargetRequirements.mockReturnValue({
        valid: true,
      });
    });

    it('should log slow validations', async () => {
      // Create many actions to simulate slow validation
      const actions = Array(100)
        .fill(null)
        .map((_, i) => ({
          id: `action-${i}`,
          forbidden_components: { target: [`comp-${i}`] },
        }));

      context.candidateActions = actions;

      mockValidator.validateTargetComponents.mockReturnValue({
        valid: true,
      });

      // Mock performance.now to simulate slow validation
      const originalNow = performance.now.bind(performance);
      let callCount = 0;
      jest.spyOn(performance, 'now').mockImplementation(() => {
        return originalNow() + callCount++ * 0.1;
      });

      await stage.executeInternal(context);

      // Check if slow validation was logged
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('took')
      );

      performance.now.mockRestore();
    });

    it('should process 100 actions efficiently', async () => {
      const actions = Array(100)
        .fill(null)
        .map((_, i) => ({
          id: `action-${i}`,
          forbidden_components: {},
        }));

      context.candidateActions = actions;

      mockValidator.validateTargetComponents.mockReturnValue({
        valid: true,
      });

      const startTime = performance.now();
      const result = await stage.executeInternal(context);
      const duration = performance.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.data.candidateActions).toHaveLength(100);
      // Allow a slightly higher threshold to avoid flakiness on slower CI machines
      expect(duration).toBeLessThan(100);
    });
  });

  describe('legacy format support', () => {
    beforeEach(() => {
      // Default mock for required validator
      mockRequiredValidator.validateTargetRequirements.mockReturnValue({
        valid: true,
      });
    });

    it('should handle legacy single-target format', async () => {
      const legacyAction = {
        id: 'legacy-action',
        forbidden_components: {
          target: ['forbidden-comp'], // Legacy format
        },
        target_entity: { id: 'target-1' }, // Legacy field name
      };

      context.candidateActions = [legacyAction];

      mockValidator.validateTargetComponents.mockReturnValue({
        valid: true,
      });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(mockValidator.validateTargetComponents).toHaveBeenCalledWith(
        legacyAction,
        expect.objectContaining({
          target: { id: 'target-1' },
        })
      );
    });

    it('should handle mixed action formats', async () => {
      const legacyAction = {
        id: 'legacy',
        forbidden_components: { target: ['comp-1'] },
        target_entity: { id: 'target-1' },
      };

      const modernAction = {
        id: 'modern',
        forbidden_components: { primary: ['comp-2'] },
        target_entities: { primary: { id: 'target-2' } },
      };

      context.candidateActions = [legacyAction, modernAction];

      mockValidator.validateTargetComponents.mockReturnValue({
        valid: true,
      });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.data.candidateActions).toHaveLength(2);
      expect(mockValidator.validateTargetComponents).toHaveBeenCalledTimes(2);
    });
  });

  describe('resolved targets', () => {
    beforeEach(() => {
      // Default mock for required validator
      mockRequiredValidator.validateTargetRequirements.mockReturnValue({
        valid: true,
      });
    });

    it('should use resolved targets if available', async () => {
      const actionWithResolvedTargets = {
        id: 'resolved-action',
        forbidden_components: { primary: ['comp-1'] },
        resolvedTargets: {
          primary: { id: 'resolved-primary' },
        },
      };

      context.candidateActions = [actionWithResolvedTargets];

      mockValidator.validateTargetComponents.mockReturnValue({
        valid: true,
      });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(mockValidator.validateTargetComponents).toHaveBeenCalledWith(
        actionWithResolvedTargets,
        expect.objectContaining({
          primary: { id: 'resolved-primary' },
        })
      );
    });

    it('should prefer resolved targets over raw target fields', async () => {
      const action = {
        id: 'action',
        forbidden_components: { target: ['comp'] },
        target_entity: { id: 'raw-target' },
        resolvedTargets: { target: { id: 'resolved-target' } },
      };

      context.candidateActions = [action];

      mockValidator.validateTargetComponents.mockReturnValue({
        valid: true,
      });

      await stage.executeInternal(context);

      expect(mockValidator.validateTargetComponents).toHaveBeenCalledWith(
        action,
        expect.objectContaining({
          target: { id: 'resolved-target' },
        })
      );
    });
  });
});
