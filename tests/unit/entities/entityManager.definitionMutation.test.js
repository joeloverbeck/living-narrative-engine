// tests/unit/entities/entityManager.definitionMutation.test.js

import { test, expect } from '@jest/globals';
import {
  describeEntityManagerSuite,
  TestBed,
} from '../../common/entities/index.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';

describeEntityManagerSuite(
  'EntityManager.createEntityInstance does not mutate definitions',
  (getBed) => {
    test('components property remains unchanged when null', () => {
      const tb = getBed();
      const definition = { id: 'test:nullComps', components: null };
      const regDef = new EntityDefinition(definition.id, {
        components: definition.components,
      });
      tb.setupDefinitions(regDef);

      const entity = tb.entityManager.createEntityInstance(definition.id);
      expect(entity).not.toBeNull();
      expect(definition.components).toBeNull();
    });

    test('components property remains unchanged when valid object', () => {
      const tb = getBed();
      const definition = {
        id: 'test:validComps',
        components: { 'core:name': { value: 'A' } },
      };
      const regDef = new EntityDefinition(definition.id, {
        components: definition.components,
      });
      tb.setupDefinitions(regDef);

      const entity = tb.entityManager.createEntityInstance(definition.id);
      expect(entity).not.toBeNull();
      expect(definition.components).toEqual({ 'core:name': { value: 'A' } });
    });
  }
);
