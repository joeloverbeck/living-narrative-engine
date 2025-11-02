/**
 * @file Tests for event validation service
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { TestBedClass } from '../../common/entities/testBed.js';
import { createMockLogger } from '../../common/mockFactories/index.js';
import EventValidationService from '../../../src/validation/eventValidationService.js';

describe('EventValidationService', () => {
  let testBed;
  let service;
  let mockSchemaValidator;
  let logger;

  beforeEach(() => {
    testBed = new TestBedClass();
    logger = createMockLogger();

    // Create mock schema validator
    mockSchemaValidator = {
      validate: jest.fn(),
    };

    service = new EventValidationService({
      logger,
      schemaValidator: mockSchemaValidator,
    });
  });

  afterEach(() => {
    testBed.cleanup();
    jest.clearAllMocks();
  });

  describe('validateEvent', () => {
    it('should return schema validation errors when schema validation fails', async () => {
      const event = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'test:action',
        targetId: 'target_456',
        originalInput: 'test action',
      };

      mockSchemaValidator.validate.mockReturnValue({
        isValid: false,
        errors: ['Schema validation error 1', 'Schema validation error 2'],
      });

      const result = await service.validateEvent(event);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual([
        'Schema validation error 1',
        'Schema validation error 2',
      ]);
      expect(result.source).toBe('schema');
      expect(mockSchemaValidator.validate).toHaveBeenCalledWith(
        'core:attempt_action',
        event
      );
    });

    it('should default to empty errors when schema validation provides none', async () => {
      const event = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'test:action',
        targetId: 'target_456',
        originalInput: 'test action',
      };

      mockSchemaValidator.validate.mockReturnValue({
        isValid: false,
      });

      const result = await service.validateEvent(event);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual([]);
      expect(result.source).toBe('schema');
    });

    it('should perform business rule validation when schema validation passes', async () => {
      const event = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'test:action',
        targets: {
          item: 'knife_123',
          target: 'goblin_456',
        },
        targetId: 'knife_123',
        originalInput: 'test action',
      };

      mockSchemaValidator.validate.mockReturnValue({
        isValid: true,
      });

      const result = await service.validateEvent(event);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.source).toBe('complete');
      expect(result.details.hasMultipleTargets).toBe(true);
      expect(result.details.targetCount).toBe(2);
    });

    it('should report business rule failures when detected', async () => {
      const event = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'test:action',
        targets: {},
        targetId: 'target_456',
        originalInput: 'test action',
      };

      mockSchemaValidator.validate.mockReturnValue({
        isValid: true,
      });

      const result = await service.validateEvent(event);

      expect(result.isValid).toBe(false);
      expect(result.source).toBe('business_rules');
      expect(result.errors).toContain('targets object cannot be empty');
    });

    it('should combine warnings from schema and business validation', async () => {
      const event = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'test:action',
        targets: {
          item: 'knife_123',
          target: 'goblin_456',
        },
        targetId: 'different_id', // Will cause warning
        originalInput: 'test action',
      };

      mockSchemaValidator.validate.mockReturnValue({
        isValid: true,
        errors: [],
        warnings: ['Schema warning 1'],
      });

      const result = await service.validateEvent(event);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Schema warning 1');
      expect(result.warnings).toContain(
        'targetId "different_id" does not match any target in targets object'
      );
    });

    it('should use custom schema ID when provided', async () => {
      const event = {
        eventName: 'custom:event',
        data: 'test',
      };

      mockSchemaValidator.validate.mockReturnValue({
        isValid: true,
        errors: [],
      });

      await service.validateEvent(event, 'custom:schema');

      expect(mockSchemaValidator.validate).toHaveBeenCalledWith(
        'custom:schema',
        event
      );
    });

    it('should handle validation service errors gracefully', async () => {
      const event = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'test:action',
        targetId: 'target_456',
        originalInput: 'test action',
      };

      mockSchemaValidator.validate.mockImplementation(() => {
        throw new Error('Schema validator crashed');
      });

      const result = await service.validateEvent(event);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Validation service error: Schema validator crashed'
      );
      expect(result.source).toBe('service');
    });
  });

  describe('validateEvents', () => {
    it('should validate multiple events in batch', async () => {
      const events = [
        {
          eventName: 'core:attempt_action',
          actorId: 'actor_123',
          actionId: 'test:action',
          targetId: 'target_456',
          originalInput: 'test action 1',
        },
        {
          eventName: 'core:attempt_action',
          actorId: 'actor_456',
          actionId: 'test:action',
          targets: {
            item: 'item_789',
          },
          targetId: 'item_789',
          originalInput: 'test action 2',
        },
      ];

      mockSchemaValidator.validate.mockReturnValue({
        isValid: true,
        errors: [],
      });

      const results = await service.validateEvents(events);

      expect(results).toHaveLength(2);
      expect(results[0].index).toBe(0);
      expect(results[0].isValid).toBe(true);
      expect(results[0].event).toBe(events[0]);
      expect(results[1].index).toBe(1);
      expect(results[1].isValid).toBe(true);
      expect(results[1].event).toBe(events[1]);
    });

    it('should handle individual event failures in batch validation', async () => {
      const events = [
        {
          eventName: 'core:attempt_action',
          actorId: 'actor_123',
          actionId: 'test:action',
          targetId: 'target_456',
          originalInput: 'test action 1',
        },
        {}, // Invalid event
      ];

      mockSchemaValidator.validate
        .mockReturnValueOnce({
          isValid: true,
          errors: [],
        })
        .mockReturnValueOnce({
          isValid: false,
          errors: ['Invalid event structure'],
        });

      const results = await service.validateEvents(events);

      expect(results).toHaveLength(2);
      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(false);
      expect(results[1].errors).toContain('Invalid event structure');
    });

    it('should capture thrown errors during batch validation', async () => {
      const events = [
        {
          eventName: 'core:attempt_action',
          actorId: 'actor_123',
          actionId: 'test:action',
          targetId: 'target_456',
          originalInput: 'test action 1',
        },
        {
          eventName: 'core:attempt_action',
          actorId: 'actor_789',
          actionId: 'test:action',
          targetId: 'target_987',
          originalInput: 'test action 2',
        },
      ];

      mockSchemaValidator.validate.mockReturnValue({
        isValid: true,
        errors: [],
      });

      const originalValidateEvent = service.validateEvent.bind(service);
      const validateEventSpy = jest
        .spyOn(service, 'validateEvent')
        .mockImplementationOnce((event, schemaId) =>
          originalValidateEvent(event, schemaId)
        )
        .mockImplementationOnce(() =>
          Promise.reject(new Error('Batch failure'))
        );

      const results = await service.validateEvents(events);

      expect(results).toHaveLength(2);
      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(false);
      expect(results[1].errors).toEqual(['Validation error: Batch failure']);
      expect(results[1].source).toBe('batch_error');
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to validate event at index 1',
        expect.any(Error)
      );

      validateEventSpy.mockRestore();
    });
  });

  describe('Performance Metrics', () => {
    it('should get performance metrics', () => {
      const metrics = service.getPerformanceMetrics();

      expect(metrics).toHaveProperty('multiTarget');
      expect(metrics.multiTarget).toHaveProperty('validationCount');
      expect(metrics.multiTarget).toHaveProperty('totalTime');
      expect(metrics.multiTarget).toHaveProperty('errorCount');
    });

    it('should reset performance metrics', async () => {
      const event = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'test:action',
        targetId: 'target_456',
        originalInput: 'test action',
      };

      mockSchemaValidator.validate.mockReturnValue({
        isValid: true,
        errors: [],
      });

      // Perform some validations
      await service.validateEvent(event);
      await service.validateEvent(event);

      let metrics = service.getPerformanceMetrics();
      expect(metrics.multiTarget.validationCount).toBe(2);

      // Reset metrics
      service.resetPerformanceMetrics();

      metrics = service.getPerformanceMetrics();
      expect(metrics.multiTarget.validationCount).toBe(0);
      expect(metrics.multiTarget.totalTime).toBe(0);
    });
  });
});
