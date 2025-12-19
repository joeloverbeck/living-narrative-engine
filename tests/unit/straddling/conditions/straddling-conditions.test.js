/**
 * @file Unit tests for straddling waist action conditions
 * @description Tests the JSON logic of conditions used to identify straddling actions
 */

import { describe, it, expect } from '@jest/globals';
import jsonLogic from 'json-logic-js';
import { promises as fs } from 'fs';
import path from 'path';

describe('Straddling Waist System - Condition Tests', () => {
  const loadCondition = async (conditionName) => {
    const filePath = path.join(
      process.cwd(),
      'data/mods/straddling/conditions',
      `${conditionName}.condition.json`
    );
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  };

  describe('event-is-action-straddle-waist-facing', () => {
    it('should return true when actionId matches straddle_waist_facing', async () => {
      const condition = await loadCondition(
        'event-is-action-straddle-waist-facing'
      );

      const data = {
        event: {
          type: 'core:attempt_action',
          payload: {
            actionId: 'straddling:straddle_waist_facing',
            actorId: 'actor_1',
            targetId: 'actor_2',
          },
        },
      };

      const result = jsonLogic.apply(condition.logic, data);
      expect(result).toBe(true);
    });

    it('should return false when actionId does not match', async () => {
      const condition = await loadCondition(
        'event-is-action-straddle-waist-facing'
      );

      const data = {
        event: {
          type: 'core:attempt_action',
          payload: {
            actionId: 'straddling:straddle_waist_facing_away',
            actorId: 'actor_1',
            targetId: 'actor_2',
          },
        },
      };

      const result = jsonLogic.apply(condition.logic, data);
      expect(result).toBe(false);
    });

    it('should return false when actionId is missing', async () => {
      const condition = await loadCondition(
        'event-is-action-straddle-waist-facing'
      );

      const data = {
        event: {
          type: 'core:attempt_action',
          payload: {
            actorId: 'actor_1',
            targetId: 'actor_2',
          },
        },
      };

      const result = jsonLogic.apply(condition.logic, data);
      expect(result).toBe(false);
    });

    it('should return false for other action IDs', async () => {
      const condition = await loadCondition(
        'event-is-action-straddle-waist-facing'
      );

      const data = {
        event: {
          type: 'core:attempt_action',
          payload: {
            actionId: 'deference:kneel_before',
            actorId: 'actor_1',
            targetId: 'actor_2',
          },
        },
      };

      const result = jsonLogic.apply(condition.logic, data);
      expect(result).toBe(false);
    });
  });

  describe('event-is-action-straddle-waist-facing-away', () => {
    it('should return true when actionId matches straddle_waist_facing_away', async () => {
      const condition = await loadCondition(
        'event-is-action-straddle-waist-facing-away'
      );

      const data = {
        event: {
          type: 'core:attempt_action',
          payload: {
            actionId: 'straddling:straddle_waist_facing_away',
            actorId: 'actor_1',
            targetId: 'actor_2',
          },
        },
      };

      const result = jsonLogic.apply(condition.logic, data);
      expect(result).toBe(true);
    });

    it('should return false when actionId does not match', async () => {
      const condition = await loadCondition(
        'event-is-action-straddle-waist-facing-away'
      );

      const data = {
        event: {
          type: 'core:attempt_action',
          payload: {
            actionId: 'straddling:straddle_waist_facing',
            actorId: 'actor_1',
            targetId: 'actor_2',
          },
        },
      };

      const result = jsonLogic.apply(condition.logic, data);
      expect(result).toBe(false);
    });

    it('should return false when actionId is missing', async () => {
      const condition = await loadCondition(
        'event-is-action-straddle-waist-facing-away'
      );

      const data = {
        event: {
          type: 'core:attempt_action',
          payload: {
            actorId: 'actor_1',
            targetId: 'actor_2',
          },
        },
      };

      const result = jsonLogic.apply(condition.logic, data);
      expect(result).toBe(false);
    });
  });

  describe('event-is-action-dismount-from-straddling', () => {
    it('should return true when actionId matches dismount_from_straddling', async () => {
      const condition = await loadCondition(
        'event-is-action-dismount-from-straddling'
      );

      const data = {
        event: {
          type: 'core:attempt_action',
          payload: {
            actionId: 'straddling:dismount_from_straddling',
            actorId: 'actor_1',
            targetId: 'actor_2',
          },
        },
      };

      const result = jsonLogic.apply(condition.logic, data);
      expect(result).toBe(true);
    });

    it('should return false when actionId does not match', async () => {
      const condition = await loadCondition(
        'event-is-action-dismount-from-straddling'
      );

      const data = {
        event: {
          type: 'core:attempt_action',
          payload: {
            actionId: 'straddling:straddle_waist_facing',
            actorId: 'actor_1',
            targetId: 'actor_2',
          },
        },
      };

      const result = jsonLogic.apply(condition.logic, data);
      expect(result).toBe(false);
    });

    it('should return false when actionId is missing', async () => {
      const condition = await loadCondition(
        'event-is-action-dismount-from-straddling'
      );

      const data = {
        event: {
          type: 'core:attempt_action',
          payload: {
            actorId: 'actor_1',
            targetId: 'actor_2',
          },
        },
      };

      const result = jsonLogic.apply(condition.logic, data);
      expect(result).toBe(false);
    });
  });

  describe('Condition isolation', () => {
    it('should not have cross-condition false positives', async () => {
      const conditionNames = [
        'event-is-action-straddle-waist-facing',
        'event-is-action-straddle-waist-facing-away',
        'event-is-action-dismount-from-straddling',
      ];

      const conditions = await Promise.all(
        conditionNames.map((name) => loadCondition(name))
      );

      const events = [
        {
          type: 'core:attempt_action',
          payload: { actionId: 'straddling:straddle_waist_facing' },
        },
        {
          type: 'core:attempt_action',
          payload: { actionId: 'straddling:straddle_waist_facing_away' },
        },
        {
          type: 'core:attempt_action',
          payload: { actionId: 'straddling:dismount_from_straddling' },
        },
      ];

      // Each event should match exactly one condition
      events.forEach((event, eventIndex) => {
        conditions.forEach((condition, conditionIndex) => {
          const result = jsonLogic.apply(condition.logic, { event });
          if (eventIndex === conditionIndex) {
            expect(result).toBe(true);
          } else {
            expect(result).toBe(false);
          }
        });
      });
    });
  });

  describe('ID namespace validation', () => {
    it('should have straddling namespace for all straddling conditions', async () => {
      const conditions = [
        'event-is-action-straddle-waist-facing',
        'event-is-action-straddle-waist-facing-away',
        'event-is-action-dismount-from-straddling',
      ];

      for (const conditionName of conditions) {
        const condition = await loadCondition(conditionName);
        expect(condition.id).toBe(`straddling:${conditionName}`);
      }
    });
  });
});
