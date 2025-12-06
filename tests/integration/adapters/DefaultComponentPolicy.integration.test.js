import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import DefaultComponentPolicy from '../../../src/adapters/DefaultComponentPolicy.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';
import EntityInstanceData from '../../../src/entities/entityInstanceData.js';
import Entity from '../../../src/entities/entity.js';
import {
  ACTOR_COMPONENT_ID,
  SHORT_TERM_MEMORY_COMPONENT_ID,
  NOTES_COMPONENT_ID,
  GOALS_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

/**
 * Creates an entity instance for testing with optional overrides.
 *
 * @param {object} [options] - Entity configuration.
 * @param {Record<string, object>} [options.definitionComponents] - Components defined at the definition level.
 * @param {Record<string, object>} [options.initialOverrides] - Instance overrides.
 * @param {string} [options.definitionId] - Definition identifier.
 * @param {string} [options.instanceId] - Instance identifier.
 * @returns {Entity} The constructed entity.
 */
function createEntity({
  definitionComponents = {},
  initialOverrides = {},
  definitionId = 'test:character_definition',
  instanceId = 'test:character_instance',
} = {}) {
  const definition = new EntityDefinition(definitionId, {
    components: definitionComponents,
  });
  const instanceData = new EntityInstanceData(
    instanceId,
    definition,
    initialOverrides
  );
  return new Entity(instanceData);
}

/**
 * Builds a lightweight logger capturing debug and error output for assertions.
 *
 * @returns {{ logger: { debug: Function, error: Function, info: Function, warn: Function }, logs: { debug: string[], error: string[] } }}
 */
function createCapturingLogger() {
  const logs = { debug: [], error: [] };
  return {
    logger: {
      debug: (message, ...args) => {
        logs.debug.push([message, ...args].join(' '));
      },
      error: (message, ...args) => {
        logs.error.push([message, ...args].join(' '));
      },
      info: () => {},
      warn: () => {},
    },
    logs,
  };
}

describe('DefaultComponentPolicy integration', () => {
  let policy;

  beforeEach(() => {
    policy = new DefaultComponentPolicy();
  });

  it('injects default memory and goal components while preserving existing data', () => {
    const { logger, logs } = createCapturingLogger();
    const validator = { validate: jest.fn(() => undefined) };
    const existingNotes = { notes: ['remember the mission'] };

    const entity = createEntity({
      definitionComponents: {
        [ACTOR_COMPONENT_ID]: { role: 'agent' },
      },
      initialOverrides: {
        [NOTES_COMPONENT_ID]: existingNotes,
      },
    });

    policy.apply(entity, { validator, logger });

    expect(validator.validate).toHaveBeenCalledTimes(2);
    expect(validator.validate).toHaveBeenCalledWith(
      SHORT_TERM_MEMORY_COMPONENT_ID,
      expect.objectContaining({ thoughts: [] })
    );
    expect(validator.validate).toHaveBeenCalledWith(
      GOALS_COMPONENT_ID,
      expect.objectContaining({ goals: [] })
    );

    const shortTermMemory = entity.getComponentData(
      SHORT_TERM_MEMORY_COMPONENT_ID
    );
    expect(shortTermMemory).toEqual({ thoughts: [], maxEntries: 4 });

    // Mutating the retrieved component must not affect stored data (ensures cloning).
    shortTermMemory.thoughts.push('intrusive thought');
    expect(
      entity.getComponentData(SHORT_TERM_MEMORY_COMPONENT_ID).thoughts
    ).toEqual([]);

    expect(entity.getComponentData(GOALS_COMPONENT_ID)).toEqual({ goals: [] });
    expect(entity.getComponentData(NOTES_COMPONENT_ID)).toEqual(existingNotes);

    expect(logs.debug).toHaveLength(2);
    expect(logs.error).toHaveLength(0);
  });

  it('does nothing when the entity lacks the actor component', () => {
    const { logger, logs } = createCapturingLogger();
    const validator = { validate: jest.fn() };
    const entity = createEntity({ definitionComponents: {} });

    policy.apply(entity, { validator, logger });

    expect(validator.validate).not.toHaveBeenCalled();
    expect(logs.debug).toHaveLength(0);
    expect(logs.error).toHaveLength(0);
  });

  it('logs validation failures and skips injecting invalid components', () => {
    const { logger, logs } = createCapturingLogger();
    const validator = {
      validate: jest.fn((componentId) => {
        if (componentId === SHORT_TERM_MEMORY_COMPONENT_ID) {
          return { isValid: false, errors: { reason: 'invalid structure' } };
        }
        if (componentId === NOTES_COMPONENT_ID) {
          return true;
        }
        if (componentId === GOALS_COMPONENT_ID) {
          return { isValid: true };
        }
        return true;
      }),
    };

    const entity = createEntity({
      definitionComponents: {
        [ACTOR_COMPONENT_ID]: { role: 'agent' },
      },
    });

    policy.apply(entity, { validator, logger });

    expect(validator.validate).toHaveBeenCalledTimes(3);
    expect(entity.hasComponent(SHORT_TERM_MEMORY_COMPONENT_ID)).toBe(false);
    expect(entity.getComponentData(NOTES_COMPONENT_ID)).toEqual({ notes: [] });
    expect(entity.getComponentData(GOALS_COMPONENT_ID)).toEqual({ goals: [] });

    expect(logs.error).toHaveLength(2);
    expect(logs.error[0]).toContain(
      'Default STM component injection for entity'
    );
    expect(logs.error[0]).toContain('"reason": "invalid structure"');
    expect(logs.error[1]).toContain('Failed to inject default component');
  });
});
