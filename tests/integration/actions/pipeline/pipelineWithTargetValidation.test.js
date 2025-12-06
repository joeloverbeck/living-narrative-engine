/**
 * @file Comprehensive integration tests for target validation in the action pipeline
 * @see src/actions/pipeline/stages/TargetComponentValidationStage.js
 * @see src/config/actionPipelineConfig.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
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
  const originalModule = jest.requireActual(
    '../../../../src/config/actionPipelineConfig.js'
  );

  const deepMerge = (target = {}, source = {}) => {
    const output = { ...target };

    for (const [key, value] of Object.entries(source)) {
      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        typeof output[key] === 'object' &&
        output[key] !== null &&
        !Array.isArray(output[key])
      ) {
        output[key] = deepMerge(output[key], value);
      } else {
        output[key] = value;
      }
    }

    return output;
  };

  const clone = (value) => JSON.parse(JSON.stringify(value));

  let overrideConfig = {};

  const computeConfig = () => {
    const baseConfig = clone(originalModule.getActionPipelineConfig());
    return deepMerge(baseConfig, overrideConfig);
  };

  const getActionPipelineConfig = jest.fn(() => computeConfig());

  const isTargetValidationEnabled = jest.fn(() => {
    const config = getActionPipelineConfig();
    return (
      Boolean(config.targetValidation?.enabled) &&
      config.targetValidation?.strictness !== 'off'
    );
  });

  const getValidationStrictness = jest.fn(() => {
    const config = getActionPipelineConfig();
    return config.targetValidation?.strictness ?? 'strict';
  });

  const isPerformanceModeEnabled = jest.fn(() => {
    const config = getActionPipelineConfig();
    return Boolean(config.performance?.enabled);
  });

  const shouldSkipValidation = jest.fn((action) => {
    if (!isTargetValidationEnabled()) {
      return true;
    }

    const config = getActionPipelineConfig();

    if (
      action?.type &&
      config.targetValidation?.skipForActionTypes?.includes(action.type)
    ) {
      return true;
    }

    const modId =
      typeof action?.id === 'string' ? action.id.split(':')[0] : null;
    if (modId && config.targetValidation?.skipForMods?.includes(modId)) {
      return true;
    }

    if (
      isPerformanceModeEnabled() &&
      config.performance?.skipNonCriticalStages
    ) {
      return true;
    }

    return false;
  });

  const targetValidationConfig = jest.fn(() => {
    const config = getActionPipelineConfig();
    return config.targetValidation;
  });

  const performanceConfig = jest.fn(() => {
    const config = getActionPipelineConfig();
    return config.performance;
  });

  const diagnosticsConfig = jest.fn(() => {
    const config = getActionPipelineConfig();
    return config.diagnostics;
  });

  const stagesConfig = jest.fn(() => {
    const config = getActionPipelineConfig();
    return config.stages;
  });

  const setMockConfig = (overrides = {}) => {
    overrideConfig = clone(overrides);
  };

  const resetMockConfig = () => {
    overrideConfig = {};
  };

  return {
    ...originalModule,
    getActionPipelineConfig,
    isTargetValidationEnabled,
    getValidationStrictness,
    isPerformanceModeEnabled,
    shouldSkipValidation,
    targetValidationConfig,
    performanceConfig,
    diagnosticsConfig,
    stagesConfig,
    __setMockConfig: setMockConfig,
    __resetMockConfig: resetMockConfig,
  };
});

// Helper function to create mocks
const createMock = (name, methods) => {
  const mock = {};
  methods.forEach((method) => {
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

    if (typeof actionPipelineConfig.__resetMockConfig === 'function') {
      actionPipelineConfig.__resetMockConfig();
    }

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockErrorContextBuilder = createMock('IActionErrorContextBuilder', [
      'buildErrorContext',
    ]);
    mockEntityManager = createMock('IEntityManager', [
      'getEntityInstance',
      'hasComponent',
      'getAllComponentTypesForEntity',
    ]);

    // Create real validator instances
    targetComponentValidator = new TargetComponentValidator({
      logger: mockLogger,
      entityManager: mockEntityManager,
    });

    targetRequiredComponentsValidator = new TargetRequiredComponentsValidator({
      logger: mockLogger,
    });

    // Create validation stage
    validationStage = new TargetComponentValidationStage({
      targetComponentValidator,
      targetRequiredComponentsValidator,
      logger: mockLogger,
      actionErrorContextBuilder: mockErrorContextBuilder,
    });

    // Create other required stages - don't set up default return values here
    // Let each test configure them as needed
    const componentFilteringStage = createMock('ComponentFilteringStage', [
      'execute',
    ]);
    componentFilteringStage.name = 'ComponentFilteringStage';

    const prerequisiteEvaluationStage = createMock(
      'PrerequisiteEvaluationStage',
      ['execute']
    );
    prerequisiteEvaluationStage.name = 'PrerequisiteEvaluationStage';

    const actionFormattingStage = createMock('ActionFormattingStage', [
      'execute',
    ]);
    actionFormattingStage.name = 'ActionFormattingStage';

    // Setup stages in correct order
    stages = [
      componentFilteringStage,
      prerequisiteEvaluationStage,
      validationStage, // Our target validation stage
      actionFormattingStage,
    ];

    // Create pipeline
    pipeline = new Pipeline(stages, mockLogger);

    // Setup basic context
    context = {
      actor: { id: 'test-actor', components: ['core:actor'] },
      candidateActions: [],
      trace: null,
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
      const testActions = [
        { id: 'action-1', name: 'Test Action 1', forbidden_components: null },
        { id: 'action-2', name: 'Test Action 2', forbidden_components: null },
      ];

      context.candidateActions = testActions;

      // Make sure the entities have no forbidden components
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([]);

      // Mock all stages to properly continue - must return PipelineResult instances
      stages[0].execute.mockImplementation(async (ctx) => {
        return PipelineResult.success({
          data: { candidateActions: testActions },
          continueProcessing: true,
        });
      });

      stages[1].execute.mockImplementation(async (ctx) => {
        return PipelineResult.success({
          data: { candidateActions: testActions },
          continueProcessing: true,
        });
      });

      // Our validation stage needs real execution
      // It's not a mock, it's the real instance, so we can't mock it
      // Instead ensure it has actions to process and they pass validation

      stages[3].execute.mockImplementation(async (ctx) => {
        return PipelineResult.success({
          data: { formattedActions: testActions },
          continueProcessing: true,
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
        continueProcessing: true,
      }));

      stages[1].execute.mockImplementation((ctx) => ({
        success: true,
        data: { candidateActions: ctx.candidateActions },
        continueProcessing: true,
      }));
    });

    it('should pass valid actions through pipeline', async () => {
      const validActions = [
        {
          id: 'action-1',
          forbidden_components: null,
          target_entity: { id: 'target-1' },
        },
        {
          id: 'action-2',
          forbidden_components: { target: [] },
          target_entity: { id: 'target-2' },
        },
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
          target_entity: { id: 'target-1' },
        },
        {
          id: 'action-2',
          forbidden_components: null,
          target_entity: { id: 'target-2' },
        },
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
          secondary: ['core:unconscious'],
        },
        target_entities: {
          primary: { id: 'primary-target' },
          secondary: { id: 'secondary-target' },
        },
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
      actionPipelineConfig.__setMockConfig({
        targetValidation: { enabled: false },
      });

      const testActions = [
        {
          id: 'action-1',
          forbidden_components: { target: ['core:immobilized'] },
          target_entity: { id: 'target-1' },
        },
      ];

      // Even with forbidden components, action should pass through
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:immobilized',
      ]);

      context.candidateActions = testActions;

      const result = await validationStage.execute(context);

      expect(result.success).toBe(true);
      expect(result.data.candidateActions).toHaveLength(1);
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('filtered out')
      );
    });

    it('should skip validation for specific action types when configured', async () => {
      actionPipelineConfig.__setMockConfig({
        targetValidation: { skipForActionTypes: ['debug'] },
      });

      const testActions = [
        {
          id: 'debug-action',
          type: 'debug',
          forbidden_components: { target: ['core:immobilized'] },
          target_entity: { id: 'target-1' },
        },
        {
          id: 'normal-action',
          forbidden_components: { target: ['core:immobilized'] },
          target_entity: { id: 'target-2' },
        },
      ];

      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:immobilized',
      ]);

      context.candidateActions = testActions;

      const result = await validationStage.execute(context);

      expect(result.success).toBe(true);
      // The debug-action should be included (skipped validation)
      // The normal-action should be filtered out (has forbidden component)
      expect(result.data.candidateActions).toHaveLength(1);
      expect(result.data.candidateActions[0].id).toBe('debug-action');
    });

    it('should respect strictness level configuration', async () => {
      actionPipelineConfig.__setMockConfig({
        targetValidation: { strictness: 'lenient', enabled: true },
      });

      const testAction = {
        id: 'action-1',
        forbidden_components: { target: ['core:non-critical-component'] },
        target_entity: { id: 'target-1' },
      };

      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:non-critical-component',
      ]);

      context.candidateActions = [testAction];

      const result = await validationStage.execute(context);

      // In lenient mode, non-critical failures might be allowed
      // This depends on the implementation details of the validator
      expect(result.success).toBe(true);
    });

    it('should log details when configured', async () => {
      actionPipelineConfig.__setMockConfig({
        targetValidation: {
          enabled: true,
          logDetails: true,
        },
      });

      const testAction = {
        id: 'action-1',
        forbidden_components: null,
        target_entity: { id: 'target-1' },
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
        target_entity: { id: `target-${i}` },
      }));

      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([]);

      context.candidateActions = largeActionSet;

      const startTime = performance.now();
      const result = await validationStage.execute(context);
      const duration = performance.now() - startTime;

      expect(result.success).toBe(true);
      // Should remain responsive even with validation overhead; allow extra time
      // for instrumentation and coverage hooks present in CI environments.
      expect(duration).toBeLessThan(200);
    });

    it('should log slow validations based on configuration threshold', async () => {
      actionPipelineConfig.__setMockConfig({
        targetValidation: {
          enabled: true,
          performanceThreshold: 0.001,
        },
      });

      const testAction = {
        id: 'action-1',
        forbidden_components: null,
        target_entity: { id: 'target-1' },
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
      actionPipelineConfig.__setMockConfig({
        performance: {
          enabled: true,
          skipNonCriticalStages: true,
        },
      });

      const testActions = Array.from({ length: 50 }, (_, i) => ({
        id: `action-${i}`,
        forbidden_components: { target: ['core:immobilized'] },
        target_entity: { id: `target-${i}` },
      }));

      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:immobilized',
      ]);

      context.candidateActions = testActions;

      const validateComponentsSpy = jest.spyOn(
        targetComponentValidator,
        'validateTargetComponents'
      );
      const validateRequirementsSpy = jest.spyOn(
        targetRequiredComponentsValidator,
        'validateTargetRequirements'
      );
      const result = await validationStage.execute(context);

      expect(result.success).toBe(true);
      expect(result.data.candidateActions).toHaveLength(50); // All pass through
      expect(validateComponentsSpy).not.toHaveBeenCalled();
      expect(validateRequirementsSpy).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle validation errors gracefully', async () => {
      const errorMessage = 'Validation service error';

      actionPipelineConfig.__setMockConfig({
        targetValidation: { enabled: true },
      });

      // Mock validator to throw error
      const validateSpy = jest
        .spyOn(targetComponentValidator, 'validateTargetComponents')
        .mockImplementation(() => {
          throw new Error(errorMessage);
        });

      mockErrorContextBuilder.buildErrorContext.mockReturnValue({
        error: errorMessage,
        context: 'target_component_validation',
      });

      context.candidateActions = [
        { id: 'action-1', target_entity: { id: 'target-1' } },
      ];

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
        forbidden_components: { target: ['core:test'] },
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
      actionPipelineConfig.__setMockConfig({ targetValidation: undefined });

      const testAction = {
        id: 'action-1',
        forbidden_components: null,
        target_entity: { id: 'target-1' },
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
      const mockTrace = {
        step: jest.fn(),
        success: jest.fn(),
        captureActionData: jest.fn().mockResolvedValue(undefined),
      };

      const testAction = {
        id: 'traced-action',
        forbidden_components: null,
        target_entity: { id: 'target-1' },
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
          validationPassed: true,
        })
      );
    });

    it('should handle trace failures gracefully', async () => {
      const mockTrace = {
        step: jest.fn(),
        success: jest.fn(),
        captureActionData: jest
          .fn()
          .mockRejectedValue(new Error('Trace error')),
      };

      const testAction = {
        id: 'action-1',
        forbidden_components: null,
        target_entity: { id: 'target-1' },
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
        target_entity: { id: 'legacy-target' },
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
          target_entity: { id: 'target-1' },
        },
        // Multi-target format
        {
          id: 'multi-1',
          forbidden_components: { primary: [], secondary: [] },
          target_entities: {
            primary: { id: 'primary-1' },
            secondary: { id: 'secondary-1' },
          },
        },
        // No forbidden components
        {
          id: 'simple-1',
          target_entity: { id: 'target-2' },
        },
        // Already resolved targets
        {
          id: 'resolved-1',
          forbidden_components: { target: [] },
          resolvedTargets: { target: { id: 'resolved-target' } },
        },
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

    if (typeof actionPipelineConfig.__resetMockConfig === 'function') {
      actionPipelineConfig.__resetMockConfig();
    }

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockErrorContextBuilder = createMock('IActionErrorContextBuilder', [
      'buildErrorContext',
    ]);
    mockEntityManager = createMock('IEntityManager', [
      'getEntityInstance',
      'hasComponent',
      'getAllComponentTypesForEntity',
    ]);

    targetComponentValidator = new TargetComponentValidator({
      logger: mockLogger,
      entityManager: mockEntityManager,
    });

    targetRequiredComponentsValidator = new TargetRequiredComponentsValidator({
      logger: mockLogger,
    });

    validationStage = new TargetComponentValidationStage({
      targetComponentValidator,
      targetRequiredComponentsValidator,
      logger: mockLogger,
      actionErrorContextBuilder: mockErrorContextBuilder,
    });

    context = {
      actor: { id: 'test-actor', components: ['core:actor'] },
      candidateActions: [],
      trace: null,
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should allow disabling target validation', async () => {
    actionPipelineConfig.__setMockConfig({
      targetValidation: { enabled: false },
    });

    const forbiddenAction = {
      id: 'action-1',
      forbidden_components: { target: ['core:immobilized'] },
      target_entity: { id: 'target-1' },
    };

    mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
      'core:immobilized',
    ]);

    // Spy on the validator method before executing
    const validateSpy = jest.spyOn(
      targetComponentValidator,
      'validateTargetComponents'
    );

    context.candidateActions = [forbiddenAction];

    const result = await validationStage.execute(context);

    expect(result.success).toBe(true);
    expect(result.data.candidateActions).toHaveLength(1); // Not filtered
    expect(validateSpy).not.toHaveBeenCalled();

    // Clean up the spy
    validateSpy.mockRestore();
  });

  it('should support different strictness levels', async () => {
    actionPipelineConfig.__setMockConfig({
      targetValidation: { strictness: 'strict', enabled: true },
    });

    const testAction = {
      id: 'action-1',
      forbidden_components: { target: ['core:test'] },
      target_entity: { id: 'target-1' },
    };

    mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
      'core:test',
    ]);

    context.candidateActions = [testAction];

    let result = await validationStage.execute(context);
    expect(result.data.candidateActions).toHaveLength(0); // Filtered in strict mode

    // Test off mode (same as disabled)
    actionPipelineConfig.__setMockConfig({
      targetValidation: { strictness: 'off', enabled: false },
    });

    validationStage = new TargetComponentValidationStage({
      targetComponentValidator,
      targetRequiredComponentsValidator,
      logger: mockLogger,
      actionErrorContextBuilder: mockErrorContextBuilder,
    });

    context.candidateActions = [testAction];

    result = await validationStage.execute(context);
    expect(result.data.candidateActions).toHaveLength(1); // Not filtered when off
  });

  it('should skip validation in performance mode', async () => {
    actionPipelineConfig.__setMockConfig({
      performance: { enabled: true, skipNonCriticalStages: true },
    });

    const testAction = {
      id: 'action-1',
      forbidden_components: { target: ['core:immobilized'] },
      target_entity: { id: 'target-1' },
    };

    mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
      'core:immobilized',
    ]);

    context.candidateActions = [testAction];

    const result = await validationStage.execute(context);

    expect(result.success).toBe(true);
    expect(result.data.candidateActions).toHaveLength(1); // Not filtered
  });

  it('should handle missing configuration gracefully', async () => {
    actionPipelineConfig.__setMockConfig({ targetValidation: {} });

    const testAction = {
      id: 'action-1',
      forbidden_components: null,
      target_entity: { id: 'target-1' },
    };

    mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([]);

    context.candidateActions = [testAction];

    const result = await validationStage.execute(context);

    expect(result.success).toBe(true);
    expect(result.data.candidateActions).toHaveLength(1);
  });
});
