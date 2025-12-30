/**
 * @file Integration tests for attack-states:attacked_by component.
 * @description Validates component structure, manifest registration, and related condition/scope.
 */

import { describe, it, expect } from '@jest/globals';
import attackedByComponent from '../../../../data/mods/attack-states/components/attacked_by.component.json' assert { type: 'json' };
import entityNotAttackedByActor from '../../../../data/mods/attack-states/conditions/entity-not-attacked-by-actor.condition.json' assert { type: 'json' };
import attackStatesManifest from '../../../../data/mods/attack-states/mod-manifest.json' assert { type: 'json' };

describe('attack-states:attacked_by component', () => {
  describe('component schema', () => {
    it('has correct component ID', () => {
      expect(attackedByComponent.id).toBe('attack-states:attacked_by');
    });

    it('has a descriptive description', () => {
      expect(attackedByComponent.description).toBeDefined();
      expect(attackedByComponent.description.length).toBeGreaterThan(10);
    });

    it('defines attackers array in dataSchema', () => {
      const { dataSchema } = attackedByComponent;

      expect(dataSchema.type).toBe('object');
      expect(dataSchema.required).toContain('attackers');
      expect(dataSchema.properties.attackers.type).toBe('array');
      expect(dataSchema.properties.attackers.uniqueItems).toBe(true);
      expect(dataSchema.properties.attackers.default).toEqual([]);
    });

    it('enforces additional properties false', () => {
      expect(attackedByComponent.dataSchema.additionalProperties).toBe(false);
    });
  });

  describe('entity-not-attacked-by-actor condition', () => {
    it('has correct condition ID', () => {
      expect(entityNotAttackedByActor.id).toBe(
        'attack-states:entity-not-attacked-by-actor'
      );
    });

    it('uses OR logic to handle missing component case', () => {
      const { logic } = entityNotAttackedByActor;

      expect(logic.or).toBeDefined();
      expect(logic.or).toHaveLength(2);
    });

    it('first clause checks for missing component', () => {
      const firstClause = entityNotAttackedByActor.logic.or[0];

      expect(firstClause['!']).toBeDefined();
      expect(firstClause['!'].var).toBe(
        'entity.components.attack-states:attacked_by'
      );
    });

    it('second clause checks actor not in attackers array', () => {
      const secondClause = entityNotAttackedByActor.logic.or[1];

      expect(secondClause['!']).toBeDefined();
      expect(secondClause['!'].in).toBeDefined();
      expect(secondClause['!'].in[0].var).toBe('actor.id');
      expect(secondClause['!'].in[1].var).toBe(
        'entity.components.attack-states:attacked_by.attackers'
      );
    });
  });

  describe('mod manifest', () => {
    it('has correct mod ID and version', () => {
      expect(attackStatesManifest.id).toBe('attack-states');
      expect(attackStatesManifest.version).toBe('1.0.0');
    });

    it('registers component in content', () => {
      expect(attackStatesManifest.content.components).toContain(
        'attacked_by.component.json'
      );
    });

    it('registers condition in content', () => {
      expect(attackStatesManifest.content.conditions).toContain(
        'entity-not-attacked-by-actor.condition.json'
      );
    });

    it('registers scope in content', () => {
      expect(attackStatesManifest.content.scopes).toContain(
        'actors_in_location_not_attacked_by_actor.scope'
      );
    });

    it('has no dependencies', () => {
      expect(attackStatesManifest.dependencies).toEqual([]);
    });
  });
});
