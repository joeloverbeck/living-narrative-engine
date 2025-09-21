/**
 * @file Unit tests for TargetComponentValidationStage
 * @see src/actions/pipeline/stages/TargetComponentValidationStage.js
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TargetComponentValidationStage } from '../../../../../src/actions/pipeline/stages/TargetComponentValidationStage.js';
import { PipelineResult } from '../../../../../src/actions/pipeline/PipelineResult.js';
import { createTestBed } from '../../../../common/testBed.js';

describe('TargetComponentValidationStage', () => {
  let stage;
  let mockValidator;
  let mockLogger;
  let mockErrorContextBuilder;
  let context;
  let testBed;

  beforeEach(() => {
    // Create test bed instance
    testBed = createTestBed();

    // Create mocks with proper method signatures
    mockValidator = testBed.createMock('ITargetComponentValidator', ['validateTargetComponents']);
    mockLogger = testBed.createMockLogger();
    mockErrorContextBuilder = testBed.createMock('IActionErrorContextBuilder', ['buildErrorContext']);

    // Create stage instance
    stage = new TargetComponentValidationStage({
      targetComponentValidator: mockValidator,
      logger: mockLogger,
      actionErrorContextBuilder: mockErrorContextBuilder
    });

    // Setup basic context
    context = {
      actor: { id: 'test-actor' },
      candidateActions: [],
      trace: null
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
          logger: mockLogger,
          actionErrorContextBuilder: mockErrorContextBuilder
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
    });

    it('should filter actions with forbidden target components', async () => {
      const actionWithForbidden = {
        id: 'action-1',
        forbidden_components: { target: ['forbidden-component'] },
        target_entity: { id: 'target-1' }
      };

      const actionWithoutForbidden = {
        id: 'action-2',
        forbidden_components: { target: [] },
        target_entity: { id: 'target-2' }
      };

      context.candidateActions = [actionWithForbidden, actionWithoutForbidden];

      // Setup mock validator responses
      mockValidator.validateTargetComponents
        .mockReturnValueOnce({
          valid: false,
          reason: 'Target has forbidden component'
        })
        .mockReturnValueOnce({
          valid: true
        });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.data.candidateActions).toHaveLength(1);
      expect(result.data.candidateActions[0].id).toBe('action-2');
      expect(mockValidator.validateTargetComponents).toHaveBeenCalledTimes(2);
    });

    it('should pass actions without forbidden components', async () => {
      const action = {
        id: 'action-1',
        forbidden_components: null,
        target_entity: { id: 'target-1' }
      };

      context.candidateActions = [action];

      mockValidator.validateTargetComponents.mockReturnValue({
        valid: true
      });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.data.candidateActions).toHaveLength(1);
      expect(result.data.candidateActions[0]).toBe(action);
    });

    it('should handle actions without targets gracefully', async () => {
      const actionWithoutTarget = {
        id: 'action-1',
        forbidden_components: { target: ['some-component'] }
        // No target_entity field
      };

      context.candidateActions = [actionWithoutTarget];

      mockValidator.validateTargetComponents.mockReturnValue({
        valid: true
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
          secondary: ['forbidden-2']
        },
        target_entities: {
          primary: { id: 'primary-target' },
          secondary: { id: 'secondary-target' }
        }
      };

      context.candidateActions = [multiTargetAction];

      mockValidator.validateTargetComponents.mockReturnValue({
        valid: true
      });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(mockValidator.validateTargetComponents).toHaveBeenCalledWith(
        multiTargetAction,
        expect.objectContaining({
          primary: { id: 'primary-target' },
          secondary: { id: 'secondary-target' }
        })
      );
    });

    it('should return PipelineResult object, not raw array', async () => {
      context.candidateActions = [{ id: 'action-1' }];

      mockValidator.validateTargetComponents.mockReturnValue({
        valid: true
      });

      const result = await stage.executeInternal(context);

      expect(result).toBeInstanceOf(PipelineResult);
      expect(result.success).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.continueProcessing).toBeDefined();
    });
  });

  describe('action-aware tracing', () => {
    let mockTrace;

    beforeEach(() => {
      mockTrace = {
        step: jest.fn(),
        success: jest.fn(),
        captureActionData: jest.fn().mockResolvedValue(undefined)
      };
      context.trace = mockTrace;
    });

    it('should capture action data when trace supports it', async () => {
      const action = {
        id: 'traced-action',
        forbidden_components: { target: ['component-1'] }
      };

      context.candidateActions = [action];

      mockValidator.validateTargetComponents.mockReturnValue({
        valid: true
      });

      await stage.executeInternal(context);

      expect(mockTrace.captureActionData).toHaveBeenCalledWith(
        'target_component_validation',
        'traced-action',
        expect.objectContaining({
          stage: 'target_component_validation',
          validationPassed: true
        })
      );
    });

    it('should capture performance data for each action', async () => {
      const action = {
        id: 'perf-action',
        forbidden_components: {}
      };

      context.candidateActions = [action];

      mockValidator.validateTargetComponents.mockReturnValue({
        valid: true
      });

      await stage.executeInternal(context);

      expect(mockTrace.captureActionData).toHaveBeenCalledWith(
        'stage_performance',
        'perf-action',
        expect.objectContaining({
          stage: 'target_component_validation',
          stageName: 'TargetComponentValidation'
        })
      );
    });

    it('should create and manage trace spans', async () => {
      mockTrace.startSpan = jest.fn().mockReturnValue({
        setAttribute: jest.fn(),
        setStatus: jest.fn(),
        setError: jest.fn()
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
        stage: 'target_component_validation'
      });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(false);
      expect(mockErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith(
        expect.objectContaining({
          error,
          phase: 'discovery'
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
        error: error.message
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
        error: 'Internal error'
      });

      // Should not throw
      const result = await stage.executeInternal(context);

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
    });
  });

  describe('performance', () => {
    it('should log slow validations', async () => {
      // Create many actions to simulate slow validation
      const actions = Array(100).fill(null).map((_, i) => ({
        id: `action-${i}`,
        forbidden_components: { target: [`comp-${i}`] }
      }));

      context.candidateActions = actions;

      mockValidator.validateTargetComponents.mockReturnValue({
        valid: true
      });

      // Mock performance.now to simulate slow validation
      const originalNow = performance.now.bind(performance);
      let callCount = 0;
      jest.spyOn(performance, 'now').mockImplementation(() => {
        return originalNow() + (callCount++ * 0.1);
      });

      await stage.executeInternal(context);

      // Check if slow validation was logged
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('took')
      );

      performance.now.mockRestore();
    });

    it('should process 100 actions efficiently', async () => {
      const actions = Array(100).fill(null).map((_, i) => ({
        id: `action-${i}`,
        forbidden_components: {}
      }));

      context.candidateActions = actions;

      mockValidator.validateTargetComponents.mockReturnValue({
        valid: true
      });

      const startTime = performance.now();
      const result = await stage.executeInternal(context);
      const duration = performance.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.data.candidateActions).toHaveLength(100);
      expect(duration).toBeLessThan(50); // Should complete in under 50ms
    });
  });

  describe('legacy format support', () => {
    it('should handle legacy single-target format', async () => {
      const legacyAction = {
        id: 'legacy-action',
        forbidden_components: {
          target: ['forbidden-comp'] // Legacy format
        },
        target_entity: { id: 'target-1' } // Legacy field name
      };

      context.candidateActions = [legacyAction];

      mockValidator.validateTargetComponents.mockReturnValue({
        valid: true
      });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(mockValidator.validateTargetComponents).toHaveBeenCalledWith(
        legacyAction,
        { target: { id: 'target-1' } }
      );
    });

    it('should handle mixed action formats', async () => {
      const legacyAction = {
        id: 'legacy',
        forbidden_components: { target: ['comp-1'] },
        target_entity: { id: 'target-1' }
      };

      const modernAction = {
        id: 'modern',
        forbidden_components: { primary: ['comp-2'] },
        target_entities: { primary: { id: 'target-2' } }
      };

      context.candidateActions = [legacyAction, modernAction];

      mockValidator.validateTargetComponents.mockReturnValue({
        valid: true
      });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.data.candidateActions).toHaveLength(2);
      expect(mockValidator.validateTargetComponents).toHaveBeenCalledTimes(2);
    });
  });

  describe('resolved targets', () => {
    it('should use resolved targets if available', async () => {
      const actionWithResolvedTargets = {
        id: 'resolved-action',
        forbidden_components: { primary: ['comp-1'] },
        resolvedTargets: {
          primary: { id: 'resolved-primary' }
        }
      };

      context.candidateActions = [actionWithResolvedTargets];

      mockValidator.validateTargetComponents.mockReturnValue({
        valid: true
      });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(mockValidator.validateTargetComponents).toHaveBeenCalledWith(
        actionWithResolvedTargets,
        { primary: { id: 'resolved-primary' } }
      );
    });

    it('should prefer resolved targets over raw target fields', async () => {
      const action = {
        id: 'action',
        forbidden_components: { target: ['comp'] },
        target_entity: { id: 'raw-target' },
        resolvedTargets: { target: { id: 'resolved-target' } }
      };

      context.candidateActions = [action];

      mockValidator.validateTargetComponents.mockReturnValue({
        valid: true
      });

      await stage.executeInternal(context);

      expect(mockValidator.validateTargetComponents).toHaveBeenCalledWith(
        action,
        { target: { id: 'resolved-target' } }
      );
    });
  });
});