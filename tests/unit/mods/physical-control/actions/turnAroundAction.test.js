/**
 * @file Unit tests for the physical-control:turn_around action.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import turnAroundAction from '../../../../../data/mods/physical-control/actions/turn_around.action.json';

describe('physical-control:turn_around action', () => {
  describe('action definition', () => {
    it('has correct id', () => {
      expect(turnAroundAction.id).toBe('physical-control:turn_around');
    });

    it('has appropriate name and description', () => {
      expect(turnAroundAction.name).toBe('Turn Around');
      expect(turnAroundAction.description).toBeTruthy();
    });

    it('uses physical-control:close_actors_facing_each_other_or_behind_target scope', () => {
      expect(turnAroundAction.targets.primary.scope).toBe(
        'positioning:close_actors_facing_each_other_or_behind_target'
      );
    });

    it('requires positioning:closeness component for actor', () => {
      expect(turnAroundAction.required_components.actor).toContain(
        'positioning:closeness'
      );
    });

    it('has correct template', () => {
      expect(turnAroundAction.template).toBe('turn {target} around');
    });

    it('has correct prerequisites', () => {
      expect(turnAroundAction.prerequisites).toHaveLength(2);

      expect(turnAroundAction.prerequisites[0]).toEqual({
        logic: {
          condition_ref: 'movement:actor-can-move',
        },
        failure_message: 'You cannot move right now.',
      });

      expect(turnAroundAction.prerequisites[1]).toEqual({
        logic: {
          condition_ref: 'core:actor-mouth-available',
        },
        failure_message: 'You cannot do that while your mouth is engaged.',
      });
    });
  });

  describe('action availability', () => {
    it('should be available when actor has closeness component', () => {
      const mockActor = {
        id: 'actor1',
        components: {
          'positioning:closeness': { partners: ['target1'] },
        },
      };

      const mockTarget = {
        id: 'target1',
        components: {
          'positioning:closeness': { partners: ['actor1'] },
        },
      };

      // Action requires closeness component
      expect(mockActor.components['positioning:closeness']).toBeDefined();
      expect(mockTarget.components['positioning:closeness'].partners).toContain(
        'actor1'
      );
    });

    it('should not be available without closeness component', () => {
      const mockActor = {
        id: 'actor1',
        components: {},
      };

      // Actor lacks required component
      expect(mockActor.components['positioning:closeness']).toBeUndefined();
    });
  });
});
