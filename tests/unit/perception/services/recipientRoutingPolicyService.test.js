/**
 * @file Unit tests for RecipientRoutingPolicyService
 * @see src/perception/services/recipientRoutingPolicyService.js
 * @see specs/perception_event_logging_refactor.md - R1: Unified Routing Policy Service
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import RecipientRoutingPolicyService from '../../../../src/perception/services/recipientRoutingPolicyService.js';

describe('RecipientRoutingPolicyService', () => {
  let mockLogger;
  let mockDispatcher;
  let service;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockDispatcher = {
      dispatch: jest.fn().mockResolvedValue(true),
    };

    service = new RecipientRoutingPolicyService({
      logger: mockLogger,
      dispatcher: mockDispatcher,
    });
  });

  describe('constructor', () => {
    it('should create service with valid dependencies', () => {
      expect(service).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'RecipientRoutingPolicyService initialized'
      );
    });

    it('should throw when dispatcher is missing dispatch method', () => {
      expect(() => {
        new RecipientRoutingPolicyService({
          logger: mockLogger,
          dispatcher: {},
        });
      }).toThrow();
    });

    it('should throw when dispatcher is null', () => {
      expect(() => {
        new RecipientRoutingPolicyService({
          logger: mockLogger,
          dispatcher: null,
        });
      }).toThrow();
    });

    it('should work with minimal logger', () => {
      const minimalLogger = { debug: jest.fn() };
      const svc = new RecipientRoutingPolicyService({
        logger: minimalLogger,
        dispatcher: mockDispatcher,
      });
      expect(svc).toBeDefined();
    });
  });

  describe('validateRouting', () => {
    describe('valid cases', () => {
      it('should return valid when only recipientIds provided', () => {
        const result = service.validateRouting(
          ['actor1', 'actor2'],
          [],
          'TEST_OPERATION'
        );

        expect(result.valid).toBe(true);
        expect(result.error).toBeNull();
      });

      it('should return valid when only excludedActorIds provided', () => {
        const result = service.validateRouting(
          [],
          ['actor1', 'actor2'],
          'TEST_OPERATION'
        );

        expect(result.valid).toBe(true);
        expect(result.error).toBeNull();
      });

      it('should return valid when neither is provided', () => {
        const result = service.validateRouting([], [], 'TEST_OPERATION');

        expect(result.valid).toBe(true);
        expect(result.error).toBeNull();
      });

      it('should return valid when recipientIds is undefined', () => {
        const result = service.validateRouting(
          undefined,
          ['actor1'],
          'TEST_OPERATION'
        );

        expect(result.valid).toBe(true);
        expect(result.error).toBeNull();
      });

      it('should return valid when excludedActorIds is undefined', () => {
        const result = service.validateRouting(
          ['actor1'],
          undefined,
          'TEST_OPERATION'
        );

        expect(result.valid).toBe(true);
        expect(result.error).toBeNull();
      });

      it('should return valid when both are undefined', () => {
        const result = service.validateRouting(
          undefined,
          undefined,
          'TEST_OPERATION'
        );

        expect(result.valid).toBe(true);
        expect(result.error).toBeNull();
      });

      it('should return valid when both are null', () => {
        const result = service.validateRouting(null, null, 'TEST_OPERATION');

        expect(result.valid).toBe(true);
        expect(result.error).toBeNull();
      });
    });

    describe('invalid cases - mutual exclusivity violation', () => {
      it('should return invalid when both recipientIds and excludedActorIds have values', () => {
        const result = service.validateRouting(
          ['actor1'],
          ['actor2'],
          'TEST_OPERATION'
        );

        expect(result.valid).toBe(false);
        expect(result.error).toBe(
          'TEST_OPERATION: recipientIds and excludedActorIds are mutually exclusive'
        );
      });

      it('should include operation name in error message', () => {
        const result = service.validateRouting(
          ['a'],
          ['b'],
          'DISPATCH_PERCEPTIBLE_EVENT'
        );

        expect(result.error).toContain('DISPATCH_PERCEPTIBLE_EVENT');
      });

      it('should return invalid with multiple items in both arrays', () => {
        const result = service.validateRouting(
          ['actor1', 'actor2', 'actor3'],
          ['actor4', 'actor5'],
          'TEST_OPERATION'
        );

        expect(result.valid).toBe(false);
      });
    });
  });

  describe('handleValidationFailure', () => {
    it('should log the error message', () => {
      service.handleValidationFailure('Test error message', { key: 'value' });

      expect(mockLogger.error).toHaveBeenCalledWith('Test error message', {
        key: 'value',
      });
    });

    it('should dispatch error event via safeDispatchError', () => {
      service.handleValidationFailure('Test error', {});

      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: 'Test error',
        })
      );
    });

    it('should always return false', () => {
      const result = service.handleValidationFailure('Error', {});

      expect(result).toBe(false);
    });

    it('should handle empty details object', () => {
      const result = service.handleValidationFailure('Error message');

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('validateAndHandle', () => {
    it('should return true when validation passes', () => {
      const result = service.validateAndHandle(
        ['actor1'],
        [],
        'TEST_OPERATION'
      );

      expect(result).toBe(true);
      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should return false and dispatch error when validation fails', () => {
      const result = service.validateAndHandle(
        ['actor1'],
        ['actor2'],
        'TEST_OPERATION'
      );

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'TEST_OPERATION: recipientIds and excludedActorIds are mutually exclusive',
        expect.objectContaining({
          recipientIds: ['actor1'],
          excludedActorIds: ['actor2'],
        })
      );
      expect(mockDispatcher.dispatch).toHaveBeenCalled();
    });

    it('should include arrays in error details when validation fails', () => {
      service.validateAndHandle(['a', 'b'], ['c'], 'OP');

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          recipientIds: ['a', 'b'],
          excludedActorIds: ['c'],
        })
      );
    });
  });

  describe('integration with operation handlers', () => {
    it('should match DISPATCH_PERCEPTIBLE_EVENT behavior (abort on conflict)', () => {
      const result = service.validateAndHandle(
        ['recipient1'],
        ['excluded1'],
        'DISPATCH_PERCEPTIBLE_EVENT'
      );

      expect(result).toBe(false);
      expect(mockDispatcher.dispatch).toHaveBeenCalled();
    });

    it('should now match ADD_PERCEPTION_LOG_ENTRY behavior (unified - abort on conflict)', () => {
      const result = service.validateAndHandle(
        ['recipient1'],
        ['excluded1'],
        'ADD_PERCEPTION_LOG_ENTRY'
      );

      expect(result).toBe(false);
      expect(mockDispatcher.dispatch).toHaveBeenCalled();
    });
  });
});
