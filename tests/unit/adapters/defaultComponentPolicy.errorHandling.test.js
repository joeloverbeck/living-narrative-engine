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
} from '../../../src/constants/componentIds.js';

describe('DefaultComponentPolicy error handling', () => {
  it('logs and skips component when validation fails', () => {
    const validator = createMockSchemaValidator();
    validator.validate = jest
      .fn()
      .mockReturnValueOnce({ isValid: false, errors: [{ msg: 'bad' }] })
      .mockReturnValue({ isValid: true });
    const logger = createMockLogger();
    const def = new EntityDefinition('actor', {
      components: { [ACTOR_COMPONENT_ID]: {} },
    });
    const data = new EntityInstanceData('e1', def);
    const entity = new Entity(data);

    const policy = new DefaultComponentPolicy();
    policy.apply(entity, { validator, logger });

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'Default STM component injection for entity e1 Errors:'
      )
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        `Failed to inject default component ${SHORT_TERM_MEMORY_COMPONENT_ID} for entity e1`
      )
    );
    expect(entity.hasComponent(SHORT_TERM_MEMORY_COMPONENT_ID)).toBe(false);
    expect(entity.hasComponent(NOTES_COMPONENT_ID)).toBe(true);
  });

  it('logs error when validator throws', () => {
    const validator = createMockSchemaValidator();
    validator.validate = jest.fn(() => {
      throw new Error('boom');
    });
    const logger = createMockLogger();
    const def = new EntityDefinition('actor', {
      components: { [ACTOR_COMPONENT_ID]: {} },
    });
    const data = new EntityInstanceData('e2', def);
    const entity = new Entity(data);

    const policy = new DefaultComponentPolicy();
    policy.apply(entity, { validator, logger });

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        `Failed to inject default component ${SHORT_TERM_MEMORY_COMPONENT_ID} for entity e2: boom`
      )
    );
    expect(entity.hasComponent(SHORT_TERM_MEMORY_COMPONENT_ID)).toBe(false);
  });
});
