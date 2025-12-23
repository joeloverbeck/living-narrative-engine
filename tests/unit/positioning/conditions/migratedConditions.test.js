/**
 * @file Unit tests for migrated facing-states conditions
 * @description Tests the logic of conditions in the facing-states mod
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import jsonLogic from 'json-logic-js';
import { promises as fs } from 'fs';
import path from 'path';

describe('Migrated Facing States Conditions', () => {
  const loadCondition = async (conditionName) => {
    const filePath = path.join(
      process.cwd(),
      'data/mods/facing-states/conditions',
      `${conditionName}.condition.json`
    );
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  };

  describe('entity-in-facing-away', () => {
    it('should return true when entity is in actors facing_away_from array', async () => {
      const condition = await loadCondition('entity-in-facing-away');

      const data = {
        actor: {
          id: 'actor1',
          components: {
            'facing-states:facing_away': {
              facing_away_from: ['entity1', 'entity2'],
            },
          },
        },
        entity: {
          id: 'entity1',
        },
      };

      const result = jsonLogic.apply(condition.logic, data);
      expect(result).toBe(true);
    });

    it('should return false when entity is not in actors facing_away_from array', async () => {
      const condition = await loadCondition('entity-in-facing-away');

      const data = {
        actor: {
          id: 'actor1',
          components: {
            'facing-states:facing_away': {
              facing_away_from: ['entity2', 'entity3'],
            },
          },
        },
        entity: {
          id: 'entity1',
        },
      };

      const result = jsonLogic.apply(condition.logic, data);
      expect(result).toBe(false);
    });

    it('should handle empty facing_away_from array', async () => {
      const condition = await loadCondition('entity-in-facing-away');

      const data = {
        actor: {
          id: 'actor1',
          components: {
            'facing-states:facing_away': {
              facing_away_from: [],
            },
          },
        },
        entity: {
          id: 'entity1',
        },
      };

      const result = jsonLogic.apply(condition.logic, data);
      expect(result).toBe(false);
    });
  });

  describe('entity-not-in-facing-away', () => {
    it('should return true when actor is not in entitys facing_away_from array', async () => {
      const condition = await loadCondition('entity-not-in-facing-away');

      const data = {
        actor: {
          id: 'actor1',
        },
        entity: {
          id: 'entity1',
          components: {
            'facing-states:facing_away': {
              facing_away_from: ['actor2', 'actor3'],
            },
          },
        },
      };

      const result = jsonLogic.apply(condition.logic, data);
      expect(result).toBe(true);
    });

    it('should return false when actor is in entitys facing_away_from array', async () => {
      const condition = await loadCondition('entity-not-in-facing-away');

      const data = {
        actor: {
          id: 'actor1',
        },
        entity: {
          id: 'entity1',
          components: {
            'facing-states:facing_away': {
              facing_away_from: ['actor1', 'actor2'],
            },
          },
        },
      };

      const result = jsonLogic.apply(condition.logic, data);
      expect(result).toBe(false);
    });
  });

  describe('actor-in-entity-facing-away', () => {
    it('should return true when actor is in entitys facing_away_from array', async () => {
      const condition = await loadCondition('actor-in-entity-facing-away');

      const data = {
        actor: {
          id: 'actor1',
        },
        entity: {
          id: 'entity1',
          components: {
            'facing-states:facing_away': {
              facing_away_from: ['actor1', 'actor2'],
            },
          },
        },
      };

      const result = jsonLogic.apply(condition.logic, data);
      expect(result).toBe(true);
    });

    it('should return false when actor is not in entitys facing_away_from array', async () => {
      const condition = await loadCondition('actor-in-entity-facing-away');

      const data = {
        actor: {
          id: 'actor1',
        },
        entity: {
          id: 'entity1',
          components: {
            'facing-states:facing_away': {
              facing_away_from: ['actor2', 'actor3'],
            },
          },
        },
      };

      const result = jsonLogic.apply(condition.logic, data);
      expect(result).toBe(false);
    });
  });

  describe('both-actors-facing-each-other', () => {
    it('should return true when neither actor is facing away from the other', async () => {
      const condition = await loadCondition('both-actors-facing-each-other');

      const data = {
        actor: {
          id: 'actor1',
          components: {
            'facing-states:facing_away': {
              facing_away_from: ['actor3'],
            },
          },
        },
        entity: {
          id: 'actor2',
          components: {
            'facing-states:facing_away': {
              facing_away_from: ['actor4'],
            },
          },
        },
      };

      const result = jsonLogic.apply(condition.logic, data);
      expect(result).toBe(true);
    });

    it('should return false when actor is facing away from entity', async () => {
      const condition = await loadCondition('both-actors-facing-each-other');

      const data = {
        actor: {
          id: 'actor1',
          components: {
            'facing-states:facing_away': {
              facing_away_from: ['actor2'],
            },
          },
        },
        entity: {
          id: 'actor2',
          components: {
            'facing-states:facing_away': {
              facing_away_from: [],
            },
          },
        },
      };

      const result = jsonLogic.apply(condition.logic, data);
      expect(result).toBe(false);
    });

    it('should return false when entity is facing away from actor', async () => {
      const condition = await loadCondition('both-actors-facing-each-other');

      const data = {
        actor: {
          id: 'actor1',
          components: {
            'facing-states:facing_away': {
              facing_away_from: [],
            },
          },
        },
        entity: {
          id: 'actor2',
          components: {
            'facing-states:facing_away': {
              facing_away_from: ['actor1'],
            },
          },
        },
      };

      const result = jsonLogic.apply(condition.logic, data);
      expect(result).toBe(false);
    });

    it('should return false when both are facing away from each other', async () => {
      const condition = await loadCondition('both-actors-facing-each-other');

      const data = {
        actor: {
          id: 'actor1',
          components: {
            'facing-states:facing_away': {
              facing_away_from: ['actor2'],
            },
          },
        },
        entity: {
          id: 'actor2',
          components: {
            'facing-states:facing_away': {
              facing_away_from: ['actor1'],
            },
          },
        },
      };

      const result = jsonLogic.apply(condition.logic, data);
      expect(result).toBe(false);
    });
  });

  describe('actor-is-behind-entity', () => {
    it('should return true when actor is in entitys facing_away_from array', async () => {
      const condition = await loadCondition('actor-is-behind-entity');

      const data = {
        actor: {
          id: 'actor1',
        },
        entity: {
          id: 'entity1',
          components: {
            'facing-states:facing_away': {
              facing_away_from: ['actor1'],
            },
          },
        },
      };

      const result = jsonLogic.apply(condition.logic, data);
      expect(result).toBe(true);
    });

    it('should return false when actor is not in entitys facing_away_from array', async () => {
      const condition = await loadCondition('actor-is-behind-entity');

      const data = {
        actor: {
          id: 'actor1',
        },
        entity: {
          id: 'entity1',
          components: {
            'facing-states:facing_away': {
              facing_away_from: ['actor2'],
            },
          },
        },
      };

      const result = jsonLogic.apply(condition.logic, data);
      expect(result).toBe(false);
    });
  });

  describe('ID namespace validation', () => {
    it('should have facing-states namespace for all migrated conditions', async () => {
      const conditions = [
        'entity-in-facing-away',
        'entity-not-in-facing-away',
        'actor-in-entity-facing-away',
        'both-actors-facing-each-other',
        'actor-is-behind-entity',
      ];

      for (const conditionName of conditions) {
        const condition = await loadCondition(conditionName);
        expect(condition.id).toBe(`facing-states:${conditionName}`);
      }
    });
  });
});
