/**
 * @file Comprehensive validation test for seduction actions other actors prerequisite
 * @description Validates that all seduction actions require other actors to be present at the same location
 */

import { describe, it, expect } from '@jest/globals';

const SEDUCTION_ACTIONS = [
  'brush_hair_back_coyly',
  'draw_attention_to_ass',
  'draw_attention_to_breasts',
  'cross_legs_alluringly',
  'stroke_penis_to_draw_attention',
  'squeeze_breasts_draw_attention',
  'stretch_sexily',
  'grab_crotch_draw_attention',
];

describe('Seduction Actions - Other Actors Prerequisite Validation', () => {
  describe('Prerequisite Structure Validation', () => {
    it.each(SEDUCTION_ACTIONS)(
      '%s should have hasOtherActorsAtLocation prerequisite',
      async (actionName) => {
        const actionModule = await import(
          `../../../../data/mods/seduction/actions/${actionName}.action.json`,
          { assert: { type: 'json' } }
        );

        const action = actionModule.default;

        expect(action.prerequisites).toBeDefined();
        expect(Array.isArray(action.prerequisites)).toBe(true);
        expect(action.prerequisites.length).toBeGreaterThan(0);

        // Find the hasOtherActorsAtLocation prerequisite
        const prerequisite = action.prerequisites.find((prereq) => {
          return prereq.logic && prereq.logic.hasOtherActorsAtLocation;
        });

        expect(prerequisite).toBeDefined();
        expect(prerequisite.logic.hasOtherActorsAtLocation).toEqual(['actor']);
        expect(prerequisite.failure_message).toBe(
          'There is nobody here to draw attention from.'
        );
      }
    );
  });

  describe('Prerequisite Consistency', () => {
    it('all seduction actions should have the same failure message', async () => {
      const failureMessages = new Set();

      for (const actionName of SEDUCTION_ACTIONS) {
        const actionModule = await import(
          `../../../../data/mods/seduction/actions/${actionName}.action.json`,
          { assert: { type: 'json' } }
        );

        const action = actionModule.default;
        const prerequisite = action.prerequisites.find((prereq) => {
          return prereq.logic && prereq.logic.hasOtherActorsAtLocation;
        });

        if (prerequisite) {
          failureMessages.add(prerequisite.failure_message);
        }
      }

      // All actions should have the same failure message
      expect(failureMessages.size).toBe(1);
      expect([...failureMessages][0]).toBe(
        'There is nobody here to draw attention from.'
      );
    });

    it('all seduction actions should check the actor entity', async () => {
      for (const actionName of SEDUCTION_ACTIONS) {
        const actionModule = await import(
          `../../../../data/mods/seduction/actions/${actionName}.action.json`,
          { assert: { type: 'json' } }
        );

        const action = actionModule.default;
        const prerequisite = action.prerequisites.find((prereq) => {
          return prereq.logic && prereq.logic.hasOtherActorsAtLocation;
        });

        expect(prerequisite).toBeDefined();
        expect(prerequisite.logic.hasOtherActorsAtLocation).toEqual(['actor']);
      }
    });
  });

  describe('Action Metadata Validation', () => {
    it.each(SEDUCTION_ACTIONS)(
      '%s should be a self-targeting action',
      async (actionName) => {
        const actionModule = await import(
          `../../../../data/mods/seduction/actions/${actionName}.action.json`,
          { assert: { type: 'json' } }
        );

        const action = actionModule.default;

        // All seduction actions should be self-targeting
        expect(action.targets).toBe('none');
      }
    );

    it.each(SEDUCTION_ACTIONS)(
      '%s should have seduction visual styling',
      async (actionName) => {
        const actionModule = await import(
          `../../../../data/mods/seduction/actions/${actionName}.action.json`,
          { assert: { type: 'json' } }
        );

        const action = actionModule.default;

        expect(action.visual).toBeDefined();
        expect(action.visual.backgroundColor).toBe('#f57f17');
        expect(action.visual.textColor).toBe('#000000');
        expect(action.visual.hoverBackgroundColor).toBe('#f9a825');
        expect(action.visual.hoverTextColor).toBe('#212121');
      }
    );
  });
});
