import { describe, it, expect, jest } from '@jest/globals';
import DefaultComponentPolicy from '../../../src/adapters/DefaultComponentPolicy.js';
import {
  createMockLogger,
  createMockSchemaValidator,
} from '../../common/mockFactories.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';
import EntityInstanceData from '../../../src/entities/entityInstanceData.js';
import Entity from '../../../src/entities/entity.js';
import {
  ACTOR_COMPONENT_ID,
  SHORT_TERM_MEMORY_COMPONENT_ID,
  NOTES_COMPONENT_ID,
  GOALS_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

describe('DefaultComponentPolicy additional branches', () => {
  it('injects components when validator returns undefined', () => {
    const validator = createMockSchemaValidator(undefined);
    const logger = createMockLogger();
    const def = new EntityDefinition('actor', {
      components: { [ACTOR_COMPONENT_ID]: {} },
    });
    const data = new EntityInstanceData('eU', def, {}, logger);
    const entity = new Entity(data);

    const policy = new DefaultComponentPolicy();
    policy.apply(entity, { validator, logger });

    expect(entity.hasComponent(SHORT_TERM_MEMORY_COMPONENT_ID)).toBe(true);
    expect(entity.hasComponent(NOTES_COMPONENT_ID)).toBe(true);
    expect(entity.hasComponent(GOALS_COMPONENT_ID)).toBe(true);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('handles boolean validation results', () => {
    const validator = createMockSchemaValidator(true, {
      validate: jest
        .fn()
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false)
        .mockReturnValue(true),
    });
    const logger = createMockLogger();
    const def = new EntityDefinition('actor', {
      components: { [ACTOR_COMPONENT_ID]: {} },
    });
    const data = new EntityInstanceData('eB', def, {}, logger);
    const entity = new Entity(data);

    const policy = new DefaultComponentPolicy();
    policy.apply(entity, { validator, logger });

    expect(entity.hasComponent(SHORT_TERM_MEMORY_COMPONENT_ID)).toBe(true);
    expect(entity.hasComponent(NOTES_COMPONENT_ID)).toBe(false);
    expect(entity.hasComponent(GOALS_COMPONENT_ID)).toBe(true);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        `Failed to inject default component ${NOTES_COMPONENT_ID} for entity eB`
      )
    );
  });
});
