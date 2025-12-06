/**
 * @file Unit tests for mouth engagement prerequisites in positioning actions
 * @description Tests that positioning actions correctly include mouth availability prerequisites
 */

import { describe, it, expect } from '@jest/globals';
import kneelBeforeAction from '../../../../data/mods/deference/actions/kneel_before.action.json';
import placeYourselfBehindAction from '../../../../data/mods/positioning/actions/place_yourself_behind.action.json';
import turnYourBackAction from '../../../../data/mods/positioning/actions/turn_your_back.action.json';
import stepBackAction from '../../../../data/mods/positioning/actions/step_back.action.json';

describe('Positioning Actions - Mouth Engagement Prerequisites', () => {
  const positioningActions = [
    {
      name: 'kneel_before',
      action: kneelBeforeAction,
      expectedId: 'deference:kneel_before',
    },
    {
      name: 'place_yourself_behind',
      action: placeYourselfBehindAction,
      expectedId: 'positioning:place_yourself_behind',
    },
    {
      name: 'turn_your_back',
      action: turnYourBackAction,
      expectedId: 'positioning:turn_your_back',
    },
    {
      name: 'step_back',
      action: stepBackAction,
      expectedId: 'positioning:step_back',
    },
  ];

  describe('Mouth Availability Prerequisites', () => {
    positioningActions.forEach(({ name, action }) => {
      describe(`${name} action`, () => {
        it('should have mouth availability prerequisite', () => {
          expect(action.prerequisites).toBeDefined();
          expect(Array.isArray(action.prerequisites)).toBe(true);
          expect(action.prerequisites.length).toBeGreaterThan(0);

          // Find the mouth availability prerequisite
          const mouthPrerequisite = action.prerequisites.find(
            (prereq) =>
              prereq.logic &&
              prereq.logic.condition_ref === 'core:actor-mouth-available'
          );

          expect(mouthPrerequisite).toBeDefined();
        });

        it('should have appropriate failure message for mouth engagement', () => {
          const mouthPrerequisite = action.prerequisites.find(
            (prereq) =>
              prereq.logic &&
              prereq.logic.condition_ref === 'core:actor-mouth-available'
          );

          expect(mouthPrerequisite.failure_message).toBe(
            'You cannot do that while your mouth is engaged.'
          );
        });

        it('should maintain valid action schema structure', () => {
          expect(action).toHaveProperty('$schema');
          expect(action).toHaveProperty('id');
          expect(action).toHaveProperty('name');
          expect(action).toHaveProperty('description');
          expect(action).toHaveProperty('prerequisites');
          expect(Array.isArray(action.prerequisites)).toBe(true);
        });

        it('should have well-formed prerequisite structure', () => {
          action.prerequisites.forEach((prereq) => {
            expect(prereq).toHaveProperty('logic');
            expect(prereq.logic).toHaveProperty('condition_ref');
            expect(prereq).toHaveProperty('failure_message');
            expect(typeof prereq.failure_message).toBe('string');
            expect(prereq.failure_message.length).toBeGreaterThan(0);
          });
        });
      });
    });
  });

  describe('Action Definition Validation', () => {
    positioningActions.forEach(({ name, action, expectedId }) => {
      it(`${name} action should have correct ID`, () => {
        expect(action.id).toBe(expectedId);
      });

      it(`${name} action should have valid schema reference`, () => {
        expect(action.$schema).toBe(
          'schema://living-narrative-engine/action.schema.json'
        );
      });
    });
  });

  describe('Prerequisite Logic Structure', () => {
    positioningActions.forEach(({ name, action }) => {
      it(`${name} action prerequisites should use condition_ref format`, () => {
        const mouthPrerequisite = action.prerequisites.find(
          (prereq) =>
            prereq.logic &&
            prereq.logic.condition_ref === 'core:actor-mouth-available'
        );

        expect(mouthPrerequisite.logic).toEqual({
          condition_ref: 'core:actor-mouth-available',
        });
      });
    });
  });

  describe('JSON Structure Integrity', () => {
    positioningActions.forEach(({ name, action }) => {
      it(`${name} action should be valid JSON`, () => {
        expect(() => JSON.stringify(action)).not.toThrow();
        expect(() => JSON.parse(JSON.stringify(action))).not.toThrow();
      });

      it(`${name} action should have consistent prerequisite array structure`, () => {
        expect(Array.isArray(action.prerequisites)).toBe(true);
        action.prerequisites.forEach((prereq) => {
          expect(prereq).toBeInstanceOf(Object);
          expect(prereq).toHaveProperty('logic');
          expect(prereq).toHaveProperty('failure_message');
        });
      });
    });
  });
});
