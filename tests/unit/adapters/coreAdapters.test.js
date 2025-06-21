import { describe, it, expect } from '@jest/globals';
import InMemoryEntityRepository from '../../../src/adapters/inMemoryEntityRepository.js';
import UuidGenerator from '../../../src/adapters/uuidGenerator.js';
import LodashCloner from '../../../src/adapters/lodashCloner.js';
import DefaultComponentPolicy from '../../../src/adapters/defaultComponentPolicy.js';
import {
  createMockLogger,
  createMockSchemaValidator,
} from '../../common/mockFactories';
import EntityDefinition from '../../../src/entities/entityDefinition.js';
import EntityInstanceData from '../../../src/entities/entityInstanceData.js';
import Entity from '../../../src/entities/entity.js';
import {
  ACTOR_COMPONENT_ID,
  GOALS_COMPONENT_ID,
  NOTES_COMPONENT_ID,
  SHORT_TERM_MEMORY_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

describe('InMemoryEntityRepository', () => {
  it('stores and retrieves entities', () => {
    const repo = new InMemoryEntityRepository();
    const e = { id: 'e1', name: 'entity' };
    repo.add(e);
    expect(repo.has('e1')).toBe(true);
    expect(repo.get('e1')).toBe(e);
    expect(Array.from(repo.entities())).toEqual([e]);
    expect(repo.remove('e1')).toBe(true);
    expect(repo.has('e1')).toBe(false);
    repo.add({ id: 'e2' });
    repo.clear();
    expect(repo.has('e2')).toBe(false);
  });

  it('handles invalid ids gracefully', () => {
    const repo = new InMemoryEntityRepository();
    expect(repo.get('')).toBeUndefined();
    expect(repo.has(null)).toBe(false);
    expect(repo.remove(undefined)).toBe(false);
  });
});

describe('UuidGenerator', () => {
  it('generates unique ids', () => {
    const id1 = UuidGenerator();
    const id2 = UuidGenerator();
    expect(typeof id1).toBe('string');
    expect(id1).not.toBe(id2);
  });
});

describe('LodashCloner', () => {
  it('deep clones objects', () => {
    const obj = { a: { b: 1 }, arr: [1, 2] };
    const clone = LodashCloner(obj);
    expect(clone).toEqual(obj);
    clone.a.b = 2;
    expect(obj.a.b).toBe(1);
  });
});

describe('DefaultComponentPolicy', () => {
  it('injects default components for actors', () => {
    const validator = createMockSchemaValidator();
    const logger = createMockLogger();
    const def = new EntityDefinition('actor', {
      components: { [ACTOR_COMPONENT_ID]: {} },
    });
    const data = new EntityInstanceData('e1', def);
    const entity = new Entity(data);

    const policy = new DefaultComponentPolicy();
    policy.apply(entity, { validator, logger });

    expect(entity.hasComponent(SHORT_TERM_MEMORY_COMPONENT_ID)).toBe(true);
    expect(entity.hasComponent(NOTES_COMPONENT_ID)).toBe(true);
    expect(entity.hasComponent(GOALS_COMPONENT_ID)).toBe(true);
    expect(validator.validate).toHaveBeenCalledWith(
      SHORT_TERM_MEMORY_COMPONENT_ID,
      expect.any(Object)
    );
    expect(validator.validate).toHaveBeenCalledWith(
      NOTES_COMPONENT_ID,
      expect.any(Object)
    );
    expect(validator.validate).toHaveBeenCalledWith(
      GOALS_COMPONENT_ID,
      expect.any(Object)
    );
  });

  it('does not override existing components', () => {
    const validator = createMockSchemaValidator();
    const logger = createMockLogger();
    const def = new EntityDefinition('actor', {
      components: {
        [ACTOR_COMPONENT_ID]: {},
        [GOALS_COMPONENT_ID]: { goals: [{ text: 'x' }] },
      },
    });
    const data = new EntityInstanceData('e2', def);
    const entity = new Entity(data);

    const policy = new DefaultComponentPolicy();
    policy.apply(entity, { validator, logger });

    expect(entity.getComponentData(GOALS_COMPONENT_ID)).toEqual({
      goals: [{ text: 'x' }],
    });
    expect(validator.validate).not.toHaveBeenCalledWith(
      GOALS_COMPONENT_ID,
      expect.anything()
    );
  });

  it('does nothing for non-actor entities', () => {
    const validator = createMockSchemaValidator();
    const logger = createMockLogger();
    const def = new EntityDefinition('basic', { components: {} });
    const data = new EntityInstanceData('e3', def);
    const entity = new Entity(data);

    const policy = new DefaultComponentPolicy();
    policy.apply(entity, { validator, logger });

    expect(entity.hasComponent(SHORT_TERM_MEMORY_COMPONENT_ID)).toBe(false);
    expect(entity.hasComponent(NOTES_COMPONENT_ID)).toBe(false);
    expect(entity.hasComponent(GOALS_COMPONENT_ID)).toBe(false);
  });
});
