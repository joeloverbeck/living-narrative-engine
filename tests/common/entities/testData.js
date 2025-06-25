import EntityDefinition from '../../../src/entities/entityDefinition.js';
import {
  ACTOR_COMPONENT_ID,
  POSITION_COMPONENT_ID,
  SHORT_TERM_MEMORY_COMPONENT_ID,
  NOTES_COMPONENT_ID,
  GOALS_COMPONENT_ID,
  NAME_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

/**
 * Provides a centralized repository of common data used across EntityManager tests.
 * This includes component IDs, definition IDs, pre-built mock definitions, and instance IDs.
 */
export const TestData = {
  ComponentIDs: {
    ACTOR_COMPONENT_ID,
    POSITION_COMPONENT_ID,
    SHORT_TERM_MEMORY_COMPONENT_ID,
    NOTES_COMPONENT_ID,
    GOALS_COMPONENT_ID,
    NAME_COMPONENT_ID,
  },
  DefinitionIDs: {
    BASIC: 'test-def:basic',
    ACTOR: 'test-def:actor',
    WITH_POS: 'test-def:with-pos',
  },
  /** Pre-built, reusable definitions */
  Definitions: {
    basic: new EntityDefinition('test-def:basic', {
      description: 'A basic definition for general testing',
      components: { 'core:name': { name: 'Basic' } },
    }),
    actor: new EntityDefinition('test-def:actor', {
      description: 'A definition containing the actor component',
      components: { [ACTOR_COMPONENT_ID]: {} },
    }),
    withPos: new EntityDefinition('test-def:with-pos', {
      description: 'A definition containing the position component',
      components: {
        [POSITION_COMPONENT_ID]: { locationId: 'zone:a' },
      },
    }),
  },
  InstanceIDs: {
    PRIMARY: 'test-instance-01',
    SECONDARY: 'test-instance-02',
    GHOST: 'non-existent-instance-id',
  },

  /**
   * Default payloads that {@link EntityManager} injects for core components.
   *
   * @type {Record<string, object>}
   */
  DefaultComponentData: {
    [SHORT_TERM_MEMORY_COMPONENT_ID]: { thoughts: [], maxEntries: 10 },
    [NOTES_COMPONENT_ID]: { notes: [] },
    [GOALS_COMPONENT_ID]: { goals: [] },
  },

  /**
   * Collections of intentionally invalid values for negative test cases.
   *
   * @property {Array<*>} componentDataNotObject - Values that are not objects
   *   when component data is expected.
   * @property {Array<Array<*>>} invalidIdPairs - Invalid definition/instance ID
   *   pairs used in tests.
   * @property {Array<*>} invalidIds - Generic invalid ID values.
   * @property {Array<*>} serializedEntityShapes - Invalid serialized entity
   *   structures passed to {@link EntityManager#reconstructEntity}.
   * @property {Array<*>} serializedInstanceIds - Invalid instanceId values used
   *   in reconstruction tests.
   */
  InvalidValues: {
    componentDataNotObject: [null, 42, 'string', [], true],
    invalidIdPairs: [
      [null, 'id'],
      ['def', null],
      ['', ''],
      [123, {}],
    ],
    invalidIds: [null, undefined, '', 123, {}, []],
    invalidDefinitionIds: [null, undefined, '', 123, {}, []],
    serializedEntityShapes: [null, 'invalid', 42, [], { foo: 'bar' }],
    serializedInstanceIds: [null, undefined, '', 42],
  },
};
