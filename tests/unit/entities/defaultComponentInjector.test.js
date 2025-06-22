import { describe, it, expect, jest } from '@jest/globals';
import { injectDefaultComponents } from '../../../src/entities/utils/defaultComponentInjector.js';
import {
  ACTOR_COMPONENT_ID,
  SHORT_TERM_MEMORY_COMPONENT_ID,
  NOTES_COMPONENT_ID,
  GOALS_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import { createMockLogger } from '../../common/mockFactories.js';

/**
 * Creates a minimal mock Entity used for injection tests.
 *
 * @param {object} [options] - Configuration options.
 * @param {boolean} [options.hasActor] - Whether the mock has the actor component.
 * @param {Record<string, object>} [options.existing] - Pre-existing components.
 * @returns {object} Mock entity implementing `hasComponent` and `addComponent`.
 */
function createMockEntity({ hasActor = true, existing = {} } = {}) {
  const components = new Map(Object.entries(existing));
  return {
    id: 'e1',
    definitionId: 'def1',
    hasComponent: jest.fn((id) => {
      if (id === ACTOR_COMPONENT_ID) return hasActor;
      return components.has(id);
    }),
    addComponent: jest.fn((id, data) => {
      components.set(id, data);
    }),
    getComponentData: (id) => components.get(id),
  };
}

describe('injectDefaultComponents', () => {
  const defaults = {
    [SHORT_TERM_MEMORY_COMPONENT_ID]: { thoughts: [], maxEntries: 10 },
    [NOTES_COMPONENT_ID]: { notes: [] },
    [GOALS_COMPONENT_ID]: { goals: [] },
  };

  it('injects STM, notes, and goals for actor entities', () => {
    const entity = createMockEntity();
    const logger = createMockLogger();
    const validate = jest.fn((id, data) => data);

    injectDefaultComponents(entity, logger, validate);

    expect(validate).toHaveBeenCalledTimes(3);
    expect(entity.addComponent).toHaveBeenCalledWith(
      SHORT_TERM_MEMORY_COMPONENT_ID,
      defaults[SHORT_TERM_MEMORY_COMPONENT_ID]
    );
    expect(entity.addComponent).toHaveBeenCalledWith(
      NOTES_COMPONENT_ID,
      defaults[NOTES_COMPONENT_ID]
    );
    expect(entity.addComponent).toHaveBeenCalledWith(
      GOALS_COMPONENT_ID,
      defaults[GOALS_COMPONENT_ID]
    );
  });

  it('does nothing for non-actor entities', () => {
    const entity = createMockEntity({ hasActor: false });
    const logger = createMockLogger();
    const validate = jest.fn();

    injectDefaultComponents(entity, logger, validate);

    expect(entity.addComponent).not.toHaveBeenCalled();
    expect(validate).not.toHaveBeenCalled();
  });

  it('skips components that already exist', () => {
    const existing = { [NOTES_COMPONENT_ID]: { notes: ['hi'] } };
    const entity = createMockEntity({ existing });
    const logger = createMockLogger();
    const validate = jest.fn((id, data) => data);

    injectDefaultComponents(entity, logger, validate);

    expect(entity.addComponent).toHaveBeenCalledTimes(2);
    expect(entity.addComponent).not.toHaveBeenCalledWith(
      NOTES_COMPONENT_ID,
      expect.anything()
    );
    expect(validate).toHaveBeenCalledTimes(2);
  });

  it('logs an error when validation fails but continues', () => {
    const entity = createMockEntity();
    const logger = createMockLogger();
    const error = new Error('boom');
    const validate = jest
      .fn()
      .mockImplementationOnce(() => {
        throw error;
      })
      .mockImplementation((id, data) => data);

    injectDefaultComponents(entity, logger, validate);

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(SHORT_TERM_MEMORY_COMPONENT_ID)
    );
    expect(entity.addComponent).toHaveBeenCalledTimes(2);
  });
});
