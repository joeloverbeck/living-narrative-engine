import { describe, it, expect, jest } from '@jest/globals';
import DefaultComponentPolicy from '../../../src/adapters/DefaultComponentPolicy.js';
import {
  ACTOR_COMPONENT_ID,
  SHORT_TERM_MEMORY_COMPONENT_ID,
  NOTES_COMPONENT_ID,
  GOALS_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

describe('DefaultComponentPolicy - actor gate', () => {
  it('returns immediately when the entity lacks the actor component', () => {
    const entity = {
      id: 'npc-1',
      definitionId: 'villager',
      hasComponent: jest.fn().mockReturnValue(false),
      addComponent: jest.fn(),
    };

    const validator = { validate: jest.fn() };
    const logger = { debug: jest.fn(), error: jest.fn() };

    const policy = new DefaultComponentPolicy();
    const result = policy.apply(entity, { validator, logger });

    expect(result).toBeUndefined();
    expect(entity.hasComponent).toHaveBeenCalledTimes(1);
    expect(entity.hasComponent).toHaveBeenCalledWith(ACTOR_COMPONENT_ID);
    expect(validator.validate).not.toHaveBeenCalled();
    expect(logger.debug).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
    expect(entity.addComponent).not.toHaveBeenCalled();
  });

  it('skips injecting components that already exist on the entity', () => {
    const hasComponent = jest.fn((componentId) => {
      if (componentId === ACTOR_COMPONENT_ID) return true;
      return componentId === SHORT_TERM_MEMORY_COMPONENT_ID;
    });

    const entity = {
      id: 'hero-17',
      definitionId: 'hero',
      hasComponent,
      addComponent: jest.fn(),
    };

    const validator = {
      validate: jest.fn().mockReturnValue({ isValid: true }),
    };
    const logger = { debug: jest.fn(), error: jest.fn() };

    const policy = new DefaultComponentPolicy();
    policy.apply(entity, { validator, logger });

    expect(hasComponent).toHaveBeenCalledWith(ACTOR_COMPONENT_ID);
    expect(hasComponent).toHaveBeenCalledWith(SHORT_TERM_MEMORY_COMPONENT_ID);
    expect(logger.debug).toHaveBeenCalledTimes(2);
    expect(logger.debug.mock.calls.map((call) => call[0])).toEqual([
      expect.stringContaining('Notes'),
      expect.stringContaining('Goals'),
    ]);
    expect(validator.validate).toHaveBeenCalledTimes(2);
    expect(validator.validate).not.toHaveBeenCalledWith(
      SHORT_TERM_MEMORY_COMPONENT_ID,
      expect.any(Object)
    );
    expect(entity.addComponent).toHaveBeenCalledTimes(2);
    const addedIds = entity.addComponent.mock.calls.map(
      ([componentId]) => componentId
    );
    expect(addedIds).toEqual([NOTES_COMPONENT_ID, GOALS_COMPONENT_ID]);
    expect(logger.error).not.toHaveBeenCalled();
  });
});
