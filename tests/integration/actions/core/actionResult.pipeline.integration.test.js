/**
 * @file Integration tests for ActionResult in pipeline contexts
 * @description Tests ActionResult usage in real action pipeline stages and multi-step operations
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ActionResult } from '../../../../src/actions/core/actionResult.js';
import { PipelineResult } from '../../../../src/actions/pipeline/PipelineResult.js';
import { ActionTargetContext } from '../../../../src/models/actionTargetContext.js';
import '../../../common/actionResultMatchers.js';

describe('ActionResult - Pipeline Integration', () => {
  let mockActor;
  let mockTargetEntity;
  let mockDiscoveryContext;

  beforeEach(() => {
    mockActor = {
      id: 'actor-123',
      components: { 'core:actor': { name: 'Test Actor' } },
    };

    mockTargetEntity = {
      id: 'target-456',
      components: { 'core:actor': { name: 'Target Actor' } },
    };

    mockDiscoveryContext = {
      currentLocation: { id: 'location-789' },
      availableActions: [],
    };
  });

  afterEach(() => {
    // Cleanup any global state if needed
  });

  describe('Multi-Stage Pipeline Processing', () => {
    /**
     * Simulates a multi-stage pipeline where each stage returns an ActionResult
     * that feeds into the next stage
     */
    it('should chain ActionResults through multiple pipeline stages', () => {
      // Stage 1: Validation
      const validationStage = (input) => {
        if (!input.actor || !input.target) {
          return ActionResult.failure('Missing required entities');
        }
        return ActionResult.success({
          ...input,
          validated: true,
          timestamp: Date.now(),
        });
      };

      // Stage 2: Target Resolution
      const targetResolutionStage = (input) => {
        const targets = [
          new ActionTargetContext('entity', { entityId: input.target.id }),
        ];
        return ActionResult.success({
          ...input,
          resolvedTargets: targets,
        });
      };

      // Stage 3: Action Execution
      const executionStage = (input) => {
        if (input.resolvedTargets.length === 0) {
          return ActionResult.failure('No targets resolved');
        }
        return ActionResult.success({
          ...input,
          executed: true,
          result: 'Action completed successfully',
        });
      };

      // Execute pipeline
      const initialInput = {
        actor: mockActor,
        target: mockTargetEntity,
        actionId: 'test-action',
      };

      const result = ActionResult.success(initialInput)
        .flatMap(validationStage)
        .flatMap(targetResolutionStage)
        .flatMap(executionStage);

      expect(result).toBeSuccessfulActionResultWithAnyValue();
      expect(result.value.validated).toBe(true);
      expect(result.value.resolvedTargets).toHaveLength(1);
      expect(result.value.executed).toBe(true);
      expect(result.value.result).toBe('Action completed successfully');
    });

    it('should handle pipeline stage failures gracefully', () => {
      // Failing validation stage
      const failingValidationStage = () => {
        return ActionResult.failure([
          'Actor validation failed',
          'Target validation failed',
        ]);
      };

      // This stage should not execute due to failure
      const unreachableStage = jest.fn(() => {
        return ActionResult.success('Should not reach here');
      });

      const result = ActionResult.success({ test: 'data' })
        .flatMap(failingValidationStage)
        .flatMap(unreachableStage);

      expect(result).toBeFailedActionResult([
        'Actor validation failed',
        'Target validation failed',
      ]);
      expect(unreachableStage).not.toHaveBeenCalled();
    });

    it('should handle exceptions in pipeline stages', () => {
      const throwingStage = () => {
        throw new Error('Unexpected pipeline error');
      };

      const result = ActionResult.success({ test: 'data' })
        .flatMap(throwingStage);

      expect(result).toBeFailedActionResult(['Unexpected pipeline error']);
    });

    it('should handle non-ActionResult returns in pipeline', () => {
      const invalidStage = () => {
        return { success: true, value: 'not an ActionResult' };
      };

      const result = ActionResult.success({ test: 'data' })
        .flatMap(invalidStage);

      expect(result).toBeFailedActionResultWithAnyError();
      expect(result.errors[0].message).toContain('must return an ActionResult');
    });
  });

  describe('Parallel Operation Combination', () => {
    it('should combine results from parallel pipeline operations', () => {
      // Simulate parallel validation operations
      const validateActor = (context) => {
        if (!context.actor?.id) {
          return ActionResult.failure('Invalid actor');
        }
        return ActionResult.success({ actorValid: true });
      };

      const validateTarget = (context) => {
        if (!context.target?.id) {
          return ActionResult.failure('Invalid target');
        }
        return ActionResult.success({ targetValid: true });
      };

      const validateLocation = (context) => {
        if (!context.location?.id) {
          return ActionResult.failure('Invalid location');
        }
        return ActionResult.success({ locationValid: true });
      };

      const context = {
        actor: mockActor,
        target: mockTargetEntity,
        location: { id: 'loc-123' },
      };

      // Execute parallel validations
      const validationResults = [
        validateActor(context),
        validateTarget(context),
        validateLocation(context),
      ];

      const combinedResult = ActionResult.combine(validationResults);

      expect(combinedResult).toBeSuccessfulActionResultWithAnyValue();
      expect(combinedResult.value).toHaveLength(3);
      expect(combinedResult.value[0]).toEqual({ actorValid: true });
      expect(combinedResult.value[1]).toEqual({ targetValid: true });
      expect(combinedResult.value[2]).toEqual({ locationValid: true });
    });

    it('should accumulate errors from failed parallel operations', () => {
      const failingOperations = [
        () => ActionResult.failure('Operation 1 failed'),
        () => ActionResult.success('Success'),
        () => ActionResult.failure(['Operation 3 error 1', 'Operation 3 error 2']),
        () => ActionResult.failure('Operation 4 failed'),
      ];

      const results = failingOperations.map(op => op());
      const combinedResult = ActionResult.combine(results);

      expect(combinedResult).toBeFailedActionResultWithAnyError();
      expect(combinedResult.errors).toHaveLength(4);
      expect(combinedResult.errors[0].message).toBe('Operation 1 failed');
      expect(combinedResult.errors[1].message).toBe('Operation 3 error 1');
      expect(combinedResult.errors[2].message).toBe('Operation 3 error 2');
      expect(combinedResult.errors[3].message).toBe('Operation 4 failed');
    });

    it('should handle large-scale parallel operation combination', () => {
      // Simulate processing many entities in parallel
      const entityCount = 100;
      const entities = Array.from({ length: entityCount }, (_, i) => ({
        id: `entity-${i}`,
        value: i,
      }));

      const processEntity = (entity) => {
        if (entity.value % 10 === 0) {
          return ActionResult.failure(`Processing failed for entity ${entity.id}`);
        }
        return ActionResult.success({
          id: entity.id,
          processed: true,
          result: entity.value * 2,
        });
      };

      const results = entities.map(processEntity);
      const combinedResult = ActionResult.combine(results);

      // Should fail because some entities failed (multiples of 10)
      expect(combinedResult).toBeFailedActionResultWithAnyError();
      expect(combinedResult.errors).toHaveLength(10); // 0, 10, 20, ..., 90
    });
  });

  describe('Error Context and Propagation', () => {
    it('should preserve error context through pipeline stages', () => {
      const createError = (message, code, context) => {
        const error = new Error(message);
        error.code = code;
        error.context = context;
        return error;
      };

      const stage1 = () => {
        const error = createError(
          'Authentication failed',
          'AUTH_ERROR',
          { userId: 'user-123', timestamp: Date.now() }
        );
        return ActionResult.failure(error);
      };

      const stage2 = () => {
        // This shouldn't execute, but if it did, it would add more context
        return ActionResult.success('Should not reach here');
      };

      const result = ActionResult.success({ initial: 'data' })
        .flatMap(stage1)
        .flatMap(stage2);

      expect(result).toBeFailedActionResultWithAnyError();
      expect(result.errors[0].message).toBe('Authentication failed');
      expect(result.errors[0].code).toBe('AUTH_ERROR');
      expect(result.errors[0].context).toMatchObject({
        userId: 'user-123',
      });
    });

    it('should handle complex error objects with stack traces', () => {
      const complexErrorStage = () => {
        try {
          throw new Error('Original error');
        } catch (originalError) {
          const wrappedError = new Error('Pipeline stage failed');
          wrappedError.originalError = originalError;
          wrappedError.stageId = 'complex-stage';
          wrappedError.metadata = {
            retryCount: 3,
            lastRetryAt: new Date().toISOString(),
          };
          return ActionResult.failure(wrappedError);
        }
      };

      const result = ActionResult.success({})
        .flatMap(complexErrorStage);

      expect(result).toBeFailedActionResultWithAnyError();
      const error = result.errors[0];
      expect(error.message).toBe('Pipeline stage failed');
      expect(error.stageId).toBe('complex-stage');
      expect(error.metadata.retryCount).toBe(3);
      expect(error.originalError).toBeInstanceOf(Error);
      expect(error.stack).toBeDefined();
    });
  });

  describe('Transformation Chain Integration', () => {
    it('should handle complex data transformations through map chains', () => {
      const initialData = {
        entities: [
          { id: 'e1', value: 10 },
          { id: 'e2', value: 20 },
          { id: 'e3', value: 30 },
        ],
        metadata: { source: 'test' },
      };

      const result = ActionResult.success(initialData)
        .map(data => ({
          ...data,
          processed: true,
          processedAt: Date.now(),
        }))
        .map(data => ({
          ...data,
          entities: data.entities.map(e => ({
            ...e,
            doubled: e.value * 2,
          })),
        }))
        .map(data => ({
          ...data,
          summary: {
            count: data.entities.length,
            total: data.entities.reduce((sum, e) => sum + e.doubled, 0),
          },
        }));

      expect(result).toBeSuccessfulActionResultWithAnyValue();
      expect(result.value.processed).toBe(true);
      expect(result.value.entities).toHaveLength(3);
      expect(result.value.entities[0].doubled).toBe(20);
      expect(result.value.summary.count).toBe(3);
      expect(result.value.summary.total).toBe(120); // (20 + 40 + 60)
    });

    it('should handle transformation errors in map chains', () => {
      const result = ActionResult.success({ data: [1, 2, 3] })
        .map(obj => obj.data.map(x => x * 2))
        .map(arr => {
          // This will throw because we're trying to access undefined
          return arr.undefined.property;
        })
        .map(value => value + 1); // Should not execute

      expect(result).toBeFailedActionResultWithAnyError();
      expect(result.errors[0].message).toContain('Cannot read');
    });
  });

  describe('Real Pipeline Integration', () => {
    it('should integrate with PipelineResult conversion', () => {
      // Simulate converting ActionResult to PipelineResult format
      const convertToPipelineResult = (actionResult) => {
        if (actionResult.success) {
          return new PipelineResult({
            success: true,
            actions: actionResult.value.actions || [],
            data: actionResult.value,
          });
        } else {
          return new PipelineResult({
            success: false,
            errors: actionResult.errors.map(e => ({
              error: e,
              context: 'ActionResult conversion',
            })),
            continueProcessing: false,
          });
        }
      };

      const successResult = ActionResult.success({
        actions: [{ id: 'action1', type: 'test' }],
        metadata: { stage: 'validation' },
      });

      const pipelineResult = convertToPipelineResult(successResult);

      expect(pipelineResult.success).toBe(true);
      expect(pipelineResult.actions).toHaveLength(1);
      expect(pipelineResult.data.metadata.stage).toBe('validation');
    });

    it('should handle pipeline result error conversion', () => {
      const failureResult = ActionResult.failure([
        'Validation error',
        'Authorization error',
      ]);

      const convertToPipelineResult = (actionResult) => {
        return new PipelineResult({
          success: actionResult.success,
          errors: actionResult.errors.map(e => ({
            error: e,
            context: 'Pipeline conversion',
          })),
          continueProcessing: false,
        });
      };

      const pipelineResult = convertToPipelineResult(failureResult);

      expect(pipelineResult.success).toBe(false);
      expect(pipelineResult.errors).toHaveLength(2);
      expect(pipelineResult.continueProcessing).toBe(false);
    });
  });

  describe('Edge Cases and Stress Testing', () => {
    it('should handle deeply nested ActionResult chains', () => {
      let result = ActionResult.success(1);

      // Create a deep chain of 50 operations
      for (let i = 0; i < 50; i++) {
        result = result.map(x => x + 1);
      }

      expect(result).toBeSuccessfulActionResult(51);
    });

    it('should handle very large data objects in pipeline', () => {
      const largeData = {
        entities: Array.from({ length: 1000 }, (_, i) => ({
          id: `entity-${i}`,
          data: Array.from({ length: 100 }, (_, j) => `data-${i}-${j}`),
        })),
      };

      const result = ActionResult.success(largeData)
        .map(data => ({
          ...data,
          processed: true,
          count: data.entities.length,
        }))
        .map(data => ({
          ...data,
          sample: data.entities.slice(0, 10),
        }));

      expect(result).toBeSuccessfulActionResultWithAnyValue();
      expect(result.value.count).toBe(1000);
      expect(result.value.sample).toHaveLength(10);
    });

    it('should handle null and undefined values in pipeline', () => {
      const nullHandlingStage = (value) => {
        if (value === null || value === undefined) {
          return ActionResult.failure('Null value encountered');
        }
        return ActionResult.success({ processed: value });
      };

      const nullResult = ActionResult.success(null)
        .flatMap(nullHandlingStage);

      const undefinedResult = ActionResult.success(undefined)
        .flatMap(nullHandlingStage);

      expect(nullResult).toBeFailedActionResult(['Null value encountered']);
      expect(undefinedResult).toBeFailedActionResult(['Null value encountered']);
    });
  });
});