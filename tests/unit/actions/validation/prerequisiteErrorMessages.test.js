import { describe, it, expect, beforeEach } from '@jest/globals';
import { PrerequisiteEvaluationError } from '../../../../src/actions/validation/errors/prerequisiteEvaluationError.js';
import {
  PrerequisiteDebugger,
  DebugLevel,
} from '../../../../src/actions/validation/prerequisiteDebugger.js';

describe('Prerequisite Error Messages', () => {
  describe('PrerequisiteEvaluationError', () => {
    it('should format error with all context', () => {
      const error = new PrerequisiteEvaluationError({
        actionId: 'test:action',
        prerequisiteIndex: 2,
        prerequisiteLogic: { hasPartOfType: ['actor', 'hand'] },
        expectedResult: true,
        actualResult: false,
        entityState: {
          actorId: 'actor-1',
          bodyParts: ['head', 'torso'],
        },
        hint: 'Actor does not have any body parts of type "hand"',
      });

      const message = error.message;

      expect(message).toContain("Action 'test:action' not discovered");
      expect(message).toContain('Prerequisite #3 failed');
      expect(message).toContain('hasPartOfType');
      expect(message).toContain('Expected: true');
      expect(message).toContain('Actual: false');
      expect(message).toContain('actorId: "actor-1"');
      expect(message).toContain('bodyParts:');
      expect(message).toContain(
        '💡 Hint: Actor does not have any body parts of type "hand"'
      );
    });

    it('should serialize to JSON for structured logging', () => {
      const error = new PrerequisiteEvaluationError({
        actionId: 'test:action',
        prerequisiteIndex: 0,
        prerequisiteLogic: {
          component_present: ['actor', 'positioning:sitting'],
        },
        expectedResult: true,
        actualResult: false,
        entityState: { actorId: 'actor-1', hasComponent: false },
        hint: 'Entity missing component',
      });

      const json = error.toJSON();

      expect(json.error).toBe('PrerequisiteEvaluationError');
      expect(json.actionId).toBe('test:action');
      expect(json.prerequisiteIndex).toBe(0);
      expect(json.hint).toBe('Entity missing component');
    });
  });

  describe('PrerequisiteDebugger', () => {
    let logger;
    let entityManager;
    let prereqDebugger;

    beforeEach(() => {
      logger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };

      entityManager = {
        getEntityIds: jest.fn(() => []),
        getComponentData: jest.fn(() => null),
        hasComponent: jest.fn(() => false),
      };

      prereqDebugger = new PrerequisiteDebugger({
        logger,
        debugLevel: DebugLevel.DEBUG,
        entityManager,
      });
    });

    it('should generate helpful hints for hasPartOfType failures', () => {
      const result = prereqDebugger.evaluate({
        actionId: 'test:action',
        prerequisiteIndex: 0,
        prerequisiteLogic: { hasPartOfType: ['actor', 'breast'] },
        evaluator: () => {
          throw new Error('Part not found');
        },
        context: { actor: { id: 'actor-1' } },
      });

      expect(result.success).toBe(false);
      expect(result.error.hint).toContain(
        'does not have any body parts of type "breast"'
      );
    });

    it('should extract entity state for debugging', () => {
      entityManager.getComponentData.mockReturnValue({
        body: {
          parts: {
            'hand-left': 'hand-left-id',
            'hand-right': 'hand-right-id',
          },
        },
      });

      const result = prereqDebugger.evaluate({
        actionId: 'test:action',
        prerequisiteIndex: 0,
        prerequisiteLogic: { hasPartOfType: ['actor', 'hand'] },
        evaluator: () => true,
        context: { actor: { id: 'actor-1' } },
      });

      expect(result.success).toBe(true);
      expect(logger.debug).toHaveBeenCalledWith(
        'Prerequisite evaluated',
        expect.objectContaining({
          result: true,
        })
      );
    });

    it('should log errors when debug level is ERROR or higher', () => {
      const errorPrereqDebugger = new PrerequisiteDebugger({
        logger,
        debugLevel: DebugLevel.ERROR,
        entityManager,
      });

      errorPrereqDebugger.evaluate({
        actionId: 'test:action',
        prerequisiteIndex: 0,
        prerequisiteLogic: { hasPartOfType: ['actor', 'hand'] },
        evaluator: () => {
          throw new Error('Test error');
        },
        context: { actor: { id: 'actor-1' } },
      });

      expect(logger.error).toHaveBeenCalledWith(
        'Prerequisite evaluation failed',
        expect.objectContaining({
          error: 'PrerequisiteEvaluationError',
          actionId: 'test:action',
        })
      );
    });

    it('should not log when debug level is NONE', () => {
      const silentPrereqDebugger = new PrerequisiteDebugger({
        logger,
        debugLevel: DebugLevel.NONE,
        entityManager,
      });

      silentPrereqDebugger.evaluate({
        actionId: 'test:action',
        prerequisiteIndex: 0,
        prerequisiteLogic: { hasPartOfType: ['actor', 'hand'] },
        evaluator: () => {
          throw new Error('Test error');
        },
        context: { actor: { id: 'actor-1' } },
      });

      expect(logger.error).not.toHaveBeenCalled();
      expect(logger.debug).not.toHaveBeenCalled();
    });

    it('should generate hint for hasOtherActorsAtLocation failures', () => {
      entityManager.getEntityIds.mockReturnValue(['actor-1']);
      entityManager.getComponentData.mockReturnValue({ locationId: 'room1' });

      const result = prereqDebugger.evaluate({
        actionId: 'test:action',
        prerequisiteIndex: 0,
        prerequisiteLogic: { hasOtherActorsAtLocation: ['actor'] },
        evaluator: () => {
          throw new Error('No other actors');
        },
        context: { actor: { id: 'actor-1' } },
      });

      expect(result.success).toBe(false);
      expect(result.error.hint).toContain('Only the actor is at this location');
    });

    it('should generate hint for hasClothingInSlot failures', () => {
      entityManager.getComponentData.mockReturnValue(null);

      const result = prereqDebugger.evaluate({
        actionId: 'test:action',
        prerequisiteIndex: 0,
        prerequisiteLogic: { hasClothingInSlot: ['actor', 'chest'] },
        evaluator: () => {
          throw new Error('No clothing');
        },
        context: { actor: { id: 'actor-1' } },
      });

      expect(result.success).toBe(false);
      expect(result.error.hint).toContain('No clothing in slot "chest"');
    });

    it('should generate hint for component_present failures', () => {
      entityManager.hasComponent.mockReturnValue(false);

      const result = prereqDebugger.evaluate({
        actionId: 'test:action',
        prerequisiteIndex: 0,
        prerequisiteLogic: {
          component_present: ['actor', 'positioning:sitting'],
        },
        evaluator: () => {
          throw new Error('Component not present');
        },
        context: { actor: { id: 'actor-1' } },
      });

      expect(result.success).toBe(false);
      expect(result.error.hint).toContain(
        'Entity missing component "positioning:sitting"'
      );
    });
  });
});
