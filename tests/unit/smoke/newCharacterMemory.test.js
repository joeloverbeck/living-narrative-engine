// tests/smoke/NewCharacterMemory.test.js
// -----------------------------------------------------------------------------
// Smoke Test – Short-Term Memory Initialization
// -----------------------------------------------------------------------------
// Verifies that EntityManager injects a default `core:short_term_memory`
// component (thoughts = [], maxEntries = 10) whenever it instantiates an
// entity definition that contains `core:actor` but is missing
// `core:short_term_memory`.
// -----------------------------------------------------------------------------

import EntityDefinition from '../../../src/entities/entityDefinition.js';
import {
  ACTOR_COMPONENT_ID,
  SHORT_TERM_MEMORY_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import { expect, test } from '@jest/globals';
import {
  describeEntityManagerSuite,
  EntityManagerTestBed,
} from '../../common/entities/index.js';

/**
 * Uses {@link EntityManagerTestBed} to verify that the EntityManager injects the
 * `core:short_term_memory` component when missing from an actor definition.
 */
describeEntityManagerSuite(
  'Smoke › New Character › Short-Term Memory bootstrap',
  (getBed) => {
    test('EntityManager injects default short-term memory', () => {
      const bed = getBed();
      const definition = new EntityDefinition('test:alice', {
        components: { [ACTOR_COMPONENT_ID]: {} },
      });
      bed.setupDefinitions(definition);

      const character = bed.entityManager.createEntityInstance(definition.id);

      expect(character).toBeDefined();
      expect(character.hasComponent(SHORT_TERM_MEMORY_COMPONENT_ID)).toBe(true);

      const stm = character.getComponentData(SHORT_TERM_MEMORY_COMPONENT_ID);
      expect(stm).toEqual({ thoughts: [], maxEntries: 10 });
    });
  }
);
