/**
 * @file Tests for JSON Logic custom operators validation in JsonLogicEvaluationService
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';

describe('JsonLogicEvaluationService - Custom Operators Validation', () => {
  let testBed;
  let logger;
  let gameDataRepository;
  let service;

  beforeEach(() => {
    testBed = createTestBed();
    logger = testBed.createMockLogger();
    gameDataRepository = testBed.createMock('IGameDataRepository', [
      'getConditionDefinition',
    ]);
    gameDataRepository.getConditionDefinition.mockReturnValue(null);

    service = new JsonLogicEvaluationService({
      logger,
      gameDataRepository,
    });
  });

  describe('Furniture/Positioning Custom Operators', () => {
    it('should allow canScootCloser operator', () => {
      // This would normally be registered via jsonLogicCustomOperators.js
      // For testing validation, we just need to verify it doesn't throw
      const rule = {
        canScootCloser: ['entity', 'target'],
      };

      const context = {
        entity: { id: 'test_entity' },
        target: { id: 'test_target' },
      };

      // Should not throw validation error
      const result = service.evaluate(rule, context);

      // Result might be false since operator isn't actually registered in this test,
      // but validation should pass
      expect(typeof result).toBe('boolean');
      expect(logger.error).not.toHaveBeenCalledWith(
        expect.stringContaining('Disallowed operation'),
        expect.anything()
      );
    });

    it('should allow isClosestLeftOccupant operator', () => {
      const rule = {
        isClosestLeftOccupant: ['entity', 'target', 'actor'],
      };

      const context = {
        entity: { id: 'test_entity' },
        target: { id: 'test_target' },
        actor: { id: 'test_actor' },
      };

      // Should not throw validation error
      const result = service.evaluate(rule, context);

      expect(typeof result).toBe('boolean');
      expect(logger.error).not.toHaveBeenCalledWith(
        expect.stringContaining('Disallowed operation'),
        expect.anything()
      );
    });

    it('should allow hasSittingSpaceToRight operator', () => {
      const rule = {
        hasSittingSpaceToRight: ['entity', 'target'],
      };

      const context = {
        entity: { id: 'test_entity' },
        target: { id: 'test_target' },
      };

      const result = service.evaluate(rule, context);

      expect(typeof result).toBe('boolean');
      expect(logger.error).not.toHaveBeenCalledWith(
        expect.stringContaining('Disallowed operation'),
        expect.anything()
      );
    });
  });

  describe('Validation Error Detection', () => {
    it('should reject unregistered custom operators', () => {
      const rule = {
        invalidCustomOperator: ['arg1', 'arg2'],
      };

      const context = {
        entity: { id: 'test' },
      };

      const result = service.evaluate(rule, context);

      // Should return false due to validation failure
      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('JSON Logic validation failed'),
        expect.objectContaining({
          message: expect.stringContaining(
            "Disallowed operation 'invalidCustomOperator'"
          ),
        })
      );
    });

    it('should allow nested custom operators in complex rules', () => {
      const rule = {
        and: [
          { canScootCloser: ['entity', 'target'] },
          { isClosestLeftOccupant: ['entity', 'target', 'actor'] },
        ],
      };

      const context = {
        entity: { id: 'test_entity' },
        target: { id: 'test_target' },
        actor: { id: 'test_actor' },
      };

      const result = service.evaluate(rule, context);

      expect(typeof result).toBe('boolean');
      expect(logger.error).not.toHaveBeenCalledWith(
        expect.stringContaining('Disallowed operation'),
        expect.anything()
      );
    });
  });

  describe('Combined Validation', () => {
    it('should validate rules with multiple furniture operators', () => {
      const rule = {
        or: [
          { hasSittingSpaceToRight: ['entity', 'furniture'] },
          {
            and: [
              { canScootCloser: ['entity', 'furniture'] },
              {
                isClosestLeftOccupant: ['entity', 'furniture', 'actor'],
              },
            ],
          },
        ],
      };

      const context = {
        entity: { id: 'entity1' },
        furniture: { id: 'couch1' },
        actor: { id: 'actor1' },
      };

      // Should validate without errors
      const result = service.evaluate(rule, context);

      expect(typeof result).toBe('boolean');
      expect(logger.error).not.toHaveBeenCalledWith(
        expect.stringContaining('validation'),
        expect.anything()
      );
    });
  });
});
