/**
 * @file Comprehensive integration tests for target validation in the action pipeline
 * @see src/actions/pipeline/stages/TargetComponentValidationStage.js
 * @see src/config/actionPipelineConfig.js
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TargetComponentValidationStage } from '../../../../src/actions/pipeline/stages/TargetComponentValidationStage.js';
import { TargetComponentValidator } from '../../../../src/actions/validation/TargetComponentValidator.js';
import TargetRequiredComponentsValidator from '../../../../src/actions/validation/TargetRequiredComponentsValidator.js';
import { Pipeline } from '../../../../src/actions/pipeline/Pipeline.js';
import { PipelineResult } from '../../../../src/actions/pipeline/PipelineResult.js';
import { ComponentFilteringStage } from '../../../../src/actions/pipeline/stages/ComponentFilteringStage.js';
import { PrerequisiteEvaluationStage } from '../../../../src/actions/pipeline/stages/PrerequisiteEvaluationStage.js';
import { ActionFormattingStage } from '../../../../src/actions/pipeline/stages/ActionFormattingStage.js';
import * as actionPipelineConfig from '../../../../src/config/actionPipelineConfig.js';

// Mock the configuration module
jest.mock('../../../../src/config/actionPipelineConfig.js', () => {
  const originalModule = jest.requireActual('../../../../src/config/actionPipelineConfig.js');
  return {
    ...originalModule,
    isTargetValidationEnabled: jest.fn(() => true),
    shouldSkipValidation: jest.fn(() => false),
    targetValidationConfig: jest.fn(() => ({
      enabled: true,
      strictness: 'strict',
      logDetails: false,
      performanceThreshold: 5,
      skipForActionTypes: [],
      skipForMods: []
    })),
    getValidationStrictness: jest.fn(() => 'strict'),
    isPerformanceModeEnabled: jest.fn(() => false)
  };
});

// Helper function to create mocks
const createMock = (name, methods) => {
  const mock = {};
  methods.forEach(method => {
    mock[method] = jest.fn();
  });
  return mock;
};

describe('Pipeline with Target Validation - Comprehensive Tests', () => {
  let pipeline;
  let targetComponentValidator;
  let targetRequiredComponentsValidator;
  let validationStage;
  let mockLogger;
  let mockErrorContextBuilder;
  let mockEntityManager;
  let stages;
  let context;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    mockErrorContextBuilder = createMock('IActionErrorContextBuilder', ['buildErrorContext']);
    mockEntityManager = createMock('IEntityManager', [
      'getEntityInstance',
      'hasComponent',
      'getAllComponentTypesForEntity'
    ]);

    // Create real validator instances
    targetComponentValidator = new TargetComponentValidator({
      logger: mockLogger,
      entityManager: mockEntityManager
    });

    targetRequiredComponentsValidator = new TargetRequiredComponentsValidator({
      logger: mockLogger
    });

    // Create validation stage
    validationStage = new TargetComponentValidationStage({
      targetComponentValidator,
      targetRequiredComponentsValidator,
      logger: mockLogger,
      actionErrorContextBuilder: mockErrorContextBuilder
    });

    // Create other required stages - don't set up default return values here
    // Let each test configure them as needed
    const componentFilteringStage = createMock('ComponentFilteringStage', ['execute']);
    componentFilteringStage.name = 'ComponentFilteringStage';

    const prerequisiteEvaluationStage = createMock('PrerequisiteEvaluationStage', ['execute']);
    prerequisiteEvaluationStage.name = 'PrerequisiteEvaluationStage';

    const actionFormattingStage = createMock('ActionFormattingStage', ['execute']);
    actionFormattingStage.name = 'ActionFormattingStage';

    // Setup stages in correct order
    stages = [
      componentFilteringStage,
      prerequisiteEvaluationStage,
      validationStage, // Our target validation stage
      actionFormattingStage
    ];

    // Create pipeline
    pipeline = new Pipeline(stages, mockLogger);

    // Setup basic context
    context = {
      actor: { id: 'test-actor', components: ['core:actor'] },
      candidateActions: [],
      trace: null
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks(); // Restore any spies to clean up completely
  });

  describe('Stage Position and Integration', () => {
    it('should include target validation stage in correct position', async () => {
      // Verify stage is at correct index (after prerequisite, before formatting)
      expect(stages[2]).toBe(validationStage);
      expect(stages[2] instanceof TargetComponentValidationStage).toBe(true);
    });

    it('should pass context correctly between stages', async () => {
      // Enable validation to ensure stage runs
      actionPipelineConfig.isTargetValidationEnabled.mockReturnValue(true);

      const testActions = [
        { id: 'action-1', name: 'Test Action 1', forbidden_components: null },
        { id: 'action-2', name: 'Test Action 2', forbidden_components: null }
      ];

      context.candidateActions = testActions;

      // Make sure the entities have no forbidden components
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([]);

      // Mock all stages to properly continue - must return PipelineResult instances
      stages[0].execute.mockImplementation(async (ctx) => {
        return PipelineResult.success({
          data: { candidateActions: testActions },
          continueProcessing: true
        });
      });

      stages[1].execute.mockImplementation(async (ctx) => {
        return PipelineResult.success({
          data: { candidateActions: testActions },
          continueProcessing: true
        });
      });

      // Our validation stage needs real execution
      // It's not a mock, it's the real instance, so we can't mock it
      // Instead ensure it has actions to process and they pass validation

      stages[3].execute.mockImplementation(async (ctx) => {
        return PipelineResult.success({
          data: { formattedActions: testActions },
          continueProcessing: true
        });
      });

      // Execute pipeline
      const result = await pipeline.execute(context);

      // Verify context was passed through stages
      expect(stages[0].execute).toHaveBeenCalledWith(context);
      expect(stages[1].execute).toHaveBeenCalled();
      // Note: stages[2] is the real validation stage, not a mock
      // The validation stage will return continueProcessing: true because we have 2 actions
      expect(stages[3].execute).toHaveBeenCalled();
    });
  });

  describe('Action Validation Behavior', () => {
    beforeEach(() => {
      // Setup stages to pass actions through
      stages[0].execute.mockImplementation((ctx) => ({
        success: true,
        data: { candidateActions: ctx.candidateActions },
        continueProcessing: true
      }));

      stages[1].execute.mockImplementation((ctx) => ({
        success: true,
        data: { candidateActions: ctx.candidateActions },
        continueProcessing: true
      }));
    });

    it('should pass valid actions through pipeline', async () => {
      const validActions = [
        {
          id: 'action-1',
          forbidden_components: null,
          target_entity: { id: 'target-1' }
        },
        {
          id: 'action-2',
          forbidden_components: { target: [] },
          target_entity: { id: 'target-2' }
        }
      ];

      // Mock entity manager to return no forbidden components
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([]);

      context.candidateActions = validActions;

      const result = await validationStage.execute(context);

      expect(result.success).toBe(true);
      expect(result.data.candidateActions).toHaveLength(2);
      expect(result.continueProcessing).toBe(true);
    });

    it('should filter invalid actions at validation stage', async () => {
      const actionsWithForbidden = [
        {
          id: 'action-1',
          forbidden_components: { target: ['core:immobilized'] },
          target_entity: { id: 'target-1' }
        },
        {
          id: 'action-2',
          forbidden_components: null,
          target_entity: { id: 'target-2' }
        }
      ];

      // Mock entity manager to return forbidden component for first target
      mockEntityManager.getAllComponentTypesForEntity
        .mockReturnValueOnce(['core:immobilized']) // target-1 has forbidden
        .mockReturnValueOnce([]); // target-2 has none

      context.candidateActions = actionsWithForbidden;

      const result = await validationStage.execute(context);

      expect(result.success).toBe(true);
      expect(result.data.candidateActions).toHaveLength(1);
      expect(result.data.candidateActions[0].id).toBe('action-2');
    });

    it('should handle multi-target actions correctly', async () => {
      const multiTargetAction = {
        id: 'multi-action',
        forbidden_components: {
          primary: ['core:immobilized'],
          secondary: ['core:unconscious']
        },
        target_entities: {
          primary: { id: 'primary-target' },
          secondary: { id: 'secondary-target' }
        }
      };

      // Mock entity manager responses
      mockEntityManager.getAllComponentTypesForEntity
        .mockReturnValueOnce([]) // primary has no forbidden
        .mockReturnValueOnce([]); // secondary has no forbidden

      context.candidateActions = [multiTargetAction];

      const result = await validationStage.execute(context);

      expect(result.success).toBe(true);
      expect(result.data.candidateActions).toHaveLength(1);
    });
  });

  describe('Configuration Support', () => {
    it('should handle stage disabled configuration', async () => {
      // Mock configuration to disable validation
      actionPipelineConfig.isTargetValidationEnabled.mockReturnValue(false);

      const testActions = [
        {
          id: 'action-1',
          forbidden_components: { target: ['core:immobilized'] },
          target_entity: { id: 'target-1' }
        }
      ];

      // Even with forbidden components, action should pass through
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue(['core:immobilized']);

      context.candidateActions = testActions;

      const result = await validationStage.execute(context);

      expect(result.success).toBe(true);
      expect(result.data.candidateActions).toHaveLength(1);
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('filtered out')
      );
    });

    it('should skip validation for specific action types when configured', async () => {
      // Enable validation so the stage runs
      actionPipelineConfig.isTargetValidationEnabled.mockReturnValue(true);

      // Mock shouldSkipValidation to return true for specific action
      // When skipping validation, the action is INCLUDED, not filtered out
      actionPipelineConfig.shouldSkipValidation
        .mockReturnValueOnce(true) // Skip validation for first action (will be included)
        .mockReturnValueOnce(false); // Don't skip validation for second (will be validated and filtered)

      const testActions = [
        {
          id: 'debug-action',
          type: 'debug',
          forbidden_components: { target: ['core:immobilized'] },
          target_entity: { id: 'target-1' }
        },
        {
          id: 'normal-action',
          forbidden_components: { target: ['core:immobilized'] },
          target_entity: { id: 'target-2' }
        }
      ];

      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue(['core:immobilized']);

      context.candidateActions = testActions;

      const result = await validationStage.execute(context);

      expect(result.success).toBe(true);
      // The debug-action should be included (skipped validation)
      // The normal-action should be filtered out (has forbidden component)
      expect(result.data.candidateActions).toHaveLength(1);
      expect(result.data.candidateActions[0].id).toBe('debug-action');
    });

    it('should respect strictness level configuration', async () => {
      // Set strictness to lenient
      actionPipelineConfig.getValidationStrictness.mockReturnValue('lenient');

      const testAction = {
        id: 'action-1',
        forbidden_components: { target: ['core:non-critical-component'] },
        target_entity: { id: 'target-1' }
      };

      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue(['core:non-critical-component']);

      context.candidateActions = [testAction];

      const result = await validationStage.execute(context);

      // In lenient mode, non-critical failures might be allowed
      // This depends on the implementation details of the validator
      expect(result.success).toBe(true);
    });

    it('should log details when configured', async () => {
      // Enable validation AND detailed logging
      actionPipelineConfig.isTargetValidationEnabled.mockReturnValue(true); // Ensure validation is enabled
      actionPipelineConfig.targetValidationConfig.mockReturnValue({
        enabled: true,
        strictness: 'strict',
        logDetails: true,
        performanceThreshold: 5,
        skipForActionTypes: [],
        skipForMods: []
      });

      const testAction = {
        id: 'action-1',
        forbidden_components: null,
        target_entity: { id: 'target-1' }
      };

      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([]);

      context.candidateActions = [testAction];

      const result = await validationStage.execute(context);

      expect(result.success).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Validated')
      );
    });
  });

  describe('Performance Monitoring', () => {
    it('should maintain pipeline performance with validation', async () => {
      const largeActionSet = Array.from({ length: 100 }, (_, i) => ({
        id: `action-${i}`,
        forbidden_components: i % 2 === 0 ? { target: ['core:test'] } : null,
        target_entity: { id: `target-${i}` }
      }));

      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([]);

      context.candidateActions = largeActionSet;

      const startTime = performance.now();
      const result = await validationStage.execute(context);
      const duration = performance.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(100); // Should complete within 100ms
    });

    it('should log slow validations based on configuration threshold', async () => {
      // Enable validation first
      actionPipelineConfig.isTargetValidationEnabled.mockReturnValue(true);
      // Set a very low threshold to trigger logging
      actionPipelineConfig.targetValidationConfig.mockReturnValue({
        enabled: true,
        strictness: 'strict',
        logDetails: false,
        performanceThreshold: 0.001, // Very low threshold
        skipForActionTypes: [],
        skipForMods: []
      });

      const testAction = {
        id: 'action-1',
        forbidden_components: null,
        target_entity: { id: 'target-1' }
      };

      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([]);

      context.candidateActions = [testAction];

      const result = await validationStage.execute(context);

      expect(result.success).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('validation took')
      );
    });

    it('should skip validation in performance mode when configured', async () => {
      // Enable performance mode
      actionPipelineConfig.isPerformanceModeEnabled.mockReturnValue(true);
      actionPipelineConfig.shouldSkipValidation.mockReturnValue(true);

      const testActions = Array.from({ length: 50 }, (_, i) => ({
        id: `action-${i}`,
        forbidden_components: { target: ['core:immobilized'] },
        target_entity: { id: `target-${i}` }
      }));

      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue(['core:immobilized']);

      context.candidateActions = testActions;

      const startTime = performance.now();
      const result = await validationStage.execute(context);
      const duration = performance.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.data.candidateActions).toHaveLength(50); // All pass through
      expect(duration).toBeLessThan(10); // Very fast due to skipping
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle validation errors gracefully', async () => {
      const errorMessage = 'Validation service error';

      // Enable validation first so the validator is actually called
      actionPipelineConfig.isTargetValidationEnabled.mockReturnValue(true);
      // Also ensure we're not skipping validation for this action
      actionPipelineConfig.shouldSkipValidation.mockReturnValue(false);

      // Mock validator to throw error
      const validateSpy = jest.spyOn(targetComponentValidator, 'validateTargetComponents')
        .mockImplementation(() => {
          throw new Error(errorMessage);
        });

      mockErrorContextBuilder.buildErrorContext.mockReturnValue({
        error: errorMessage,
        context: 'target_component_validation'
      });

      context.candidateActions = [{ id: 'action-1', target_entity: { id: 'target-1' } }];

      const result = await validationStage.execute(context);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error during target component validation'),
        expect.any(Error)
      );

      // Restore the spy
      validateSpy.mockRestore();
    });

    it('should handle missing target entities', async () => {
      const actionWithoutTarget = {
        id: 'action-1',
        forbidden_components: { target: ['core:test'] }
        // No target_entity or target_entities
      };

      context.candidateActions = [actionWithoutTarget];

      const result = await validationStage.execute(context);

      expect(result.success).toBe(true);
      // Should handle gracefully without crashing
    });

    it('should handle empty candidate actions', async () => {
      context.candidateActions = [];

      const result = await validationStage.execute(context);

      expect(result.success).toBe(true);
      expect(result.data.candidateActions).toHaveLength(0);
      expect(result.continueProcessing).toBe(false);
    });

    it('should handle missing configuration gracefully', async () => {
      // Mock configuration to return undefined
      actionPipelineConfig.targetValidationConfig.mockReturnValue(undefined);
      actionPipelineConfig.isTargetValidationEnabled.mockReturnValue(true);

      const testAction = {
        id: 'action-1',
        forbidden_components: null,
        target_entity: { id: 'target-1' }
      };

      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([]);

      context.candidateActions = [testAction];

      // Should not crash even with undefined config
      const result = await validationStage.execute(context);

      expect(result.success).toBe(true);
    });
  });

  describe('Tracing Support', () => {
    it('should capture action-aware trace data', async () => {
      // Enable validation
      actionPipelineConfig.isTargetValidationEnabled.mockReturnValue(true);
      // Ensure we're not skipping validation for this action
      actionPipelineConfig.shouldSkipValidation.mockReturnValue(false);

      const mockTrace = {
        step: jest.fn(),
        success: jest.fn(),
        captureActionData: jest.fn().mockResolvedValue(undefined)
      };

      const testAction = {
        id: 'traced-action',
        forbidden_components: null,
        target_entity: { id: 'target-1' }
      };

      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([]);

      context.candidateActions = [testAction];
      context.trace = mockTrace;

      const result = await validationStage.execute(context);

      expect(result.success).toBe(true);
      expect(mockTrace.step).toHaveBeenCalled();
      expect(mockTrace.success).toHaveBeenCalled();
      expect(mockTrace.captureActionData).toHaveBeenCalledWith(
        'target_component_validation',
        'traced-action',
        expect.objectContaining({
          stage: 'target_component_validation',
          validationPassed: true
        })
      );
    });

    it('should handle trace failures gracefully', async () => {
      // Enable validation so trace capture is attempted
      actionPipelineConfig.isTargetValidationEnabled.mockReturnValue(true);
      // Ensure we're not skipping validation for this action
      actionPipelineConfig.shouldSkipValidation.mockReturnValue(false);

      const mockTrace = {
        step: jest.fn(),
        success: jest.fn(),
        captureActionData: jest.fn().mockRejectedValue(new Error('Trace error'))
      };

      const testAction = {
        id: 'action-1',
        forbidden_components: null,
        target_entity: { id: 'target-1' }
      };

      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([]);

      context.candidateActions = [testAction];
      context.trace = mockTrace;

      const result = await validationStage.execute(context);

      // Should succeed despite trace error
      expect(result.success).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to capture validation analysis')
      );
    });
  });

  describe('Regression Tests', () => {
    it('should maintain existing pipeline functionality unchanged', async () => {
      // Test that existing behavior is preserved
      const existingAction = {
        id: 'legacy-action',
        forbidden_components: { target: ['core:test'] },
        target_entity: { id: 'legacy-target' }
      };

      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([]);

      context.candidateActions = [existingAction];

      const result = await validationStage.execute(context);

      expect(result.success).toBe(true);
      expect(result.data.candidateActions).toHaveLength(1);
      expect(result.data.candidateActions[0]).toBe(existingAction);
    });

    it('should ensure all existing action discoveries still work', async () => {
      // Test various action formats
      const variousActions = [
        // Legacy single-target format
        {
          id: 'legacy-1',
          forbidden_components: { target: [] },
          target_entity: { id: 'target-1' }
        },
        // Multi-target format
        {
          id: 'multi-1',
          forbidden_components: { primary: [], secondary: [] },
          target_entities: {
            primary: { id: 'primary-1' },
            secondary: { id: 'secondary-1' }
          }
        },
        // No forbidden components
        {
          id: 'simple-1',
          target_entity: { id: 'target-2' }
        },
        // Already resolved targets
        {
          id: 'resolved-1',
          forbidden_components: { target: [] },
          resolvedTargets: { target: { id: 'resolved-target' } }
        }
      ];

      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([]);

      context.candidateActions = variousActions;

      const result = await validationStage.execute(context);

      expect(result.success).toBe(true);
      expect(result.data.candidateActions).toHaveLength(4);
    });
  });
});

describe('Pipeline Configuration Tests', () => {
  let validationStage;
  let mockLogger;
  let mockErrorContextBuilder;
  let targetComponentValidator;
  let targetRequiredComponentsValidator;
  let mockEntityManager;
  let context;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    mockErrorContextBuilder = createMock('IActionErrorContextBuilder', ['buildErrorContext']);
    mockEntityManager = createMock('IEntityManager', [
      'getEntityInstance',
      'hasComponent',
      'getAllComponentTypesForEntity'
    ]);

    targetComponentValidator = new TargetComponentValidator({
      logger: mockLogger,
      entityManager: mockEntityManager
    });

    targetRequiredComponentsValidator = new TargetRequiredComponentsValidator({
      logger: mockLogger
    });

    validationStage = new TargetComponentValidationStage({
      targetComponentValidator,
      targetRequiredComponentsValidator,
      logger: mockLogger,
      actionErrorContextBuilder: mockErrorContextBuilder
    });

    context = {
      actor: { id: 'test-actor', components: ['core:actor'] },
      candidateActions: [],
      trace: null
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should allow disabling target validation', async () => {
    actionPipelineConfig.isTargetValidationEnabled.mockReturnValue(false);

    const forbiddenAction = {
      id: 'action-1',
      forbidden_components: { target: ['core:immobilized'] },
      target_entity: { id: 'target-1' }
    };

    mockEntityManager.getAllComponentTypesForEntity.mockReturnValue(['core:immobilized']);

    // Spy on the validator method before executing
    const validateSpy = jest.spyOn(targetComponentValidator, 'validateTargetComponents');

    context.candidateActions = [forbiddenAction];

    const result = await validationStage.execute(context);

    expect(result.success).toBe(true);
    expect(result.data.candidateActions).toHaveLength(1); // Not filtered
    expect(validateSpy).not.toHaveBeenCalled();

    // Clean up the spy
    validateSpy.mockRestore();
  });

  it('should support different strictness levels', async () => {
    // Enable validation for strict mode test
    actionPipelineConfig.isTargetValidationEnabled.mockReturnValue(true);
    // Ensure we're not skipping validation for this action
    actionPipelineConfig.shouldSkipValidation.mockReturnValue(false);
    // Test strict mode
    actionPipelineConfig.getValidationStrictness.mockReturnValue('strict');

    const testAction = {
      id: 'action-1',
      forbidden_components: { target: ['core:test'] },
      target_entity: { id: 'target-1' }
    };

    mockEntityManager.getAllComponentTypesForEntity.mockReturnValue(['core:test']);

    context.candidateActions = [testAction];

    let result = await validationStage.execute(context);
    expect(result.data.candidateActions).toHaveLength(0); // Filtered in strict mode

    // Test off mode (same as disabled)
    actionPipelineConfig.getValidationStrictness.mockReturnValue('off');
    actionPipelineConfig.isTargetValidationEnabled.mockReturnValue(false);

    // Reset candidateActions since they were filtered in previous execution
    context.candidateActions = [testAction];

    result = await validationStage.execute(context);
    expect(result.data.candidateActions).toHaveLength(1); // Not filtered when off
  });

  it('should skip validation in performance mode', async () => {
    actionPipelineConfig.isPerformanceModeEnabled.mockReturnValue(true);
    actionPipelineConfig.shouldSkipValidation.mockReturnValue(true);

    const testAction = {
      id: 'action-1',
      forbidden_components: { target: ['core:immobilized'] },
      target_entity: { id: 'target-1' }
    };

    mockEntityManager.getAllComponentTypesForEntity.mockReturnValue(['core:immobilized']);

    context.candidateActions = [testAction];

    const result = await validationStage.execute(context);

    expect(result.success).toBe(true);
    expect(result.data.candidateActions).toHaveLength(1); // Not filtered
  });

  it('should handle missing configuration gracefully', async () => {
    // Reset mocks to default behavior
    actionPipelineConfig.targetValidationConfig.mockReturnValue({});
    actionPipelineConfig.isTargetValidationEnabled.mockReturnValue(true);
    actionPipelineConfig.getValidationStrictness.mockReturnValue('strict');

    const testAction = {
      id: 'action-1',
      forbidden_components: null,
      target_entity: { id: 'target-1' }
    };

    mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([]);

    context.candidateActions = [testAction];

    const result = await validationStage.execute(context);

    expect(result.success).toBe(true);
    expect(result.data.candidateActions).toHaveLength(1);
  });
});