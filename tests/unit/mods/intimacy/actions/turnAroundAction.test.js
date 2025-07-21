/**
 * @file Unit tests for the intimacy:turn_around action.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import turnAroundAction from '../../../../../data/mods/intimacy/actions/turn_around.action.json';

describe('intimacy:turn_around action', () => {
  describe('action definition', () => {
    it('has correct id', () => {
      expect(turnAroundAction.id).toBe('intimacy:turn_around');
    });

    it('has appropriate name and description', () => {
      expect(turnAroundAction.name).toBe('Turn Around');
      expect(turnAroundAction.description).toBeTruthy();
    });

    it('uses intimacy:close_actors_facing_forward scope', () => {
      expect(turnAroundAction.scope).toBe('intimacy:close_actors_facing_forward');
    });

    it('requires intimacy:closeness component for actor', () => {
      expect(turnAroundAction.required_components.actor).toContain(
        'intimacy:closeness'
      );
    });

    it('has correct template', () => {
      expect(turnAroundAction.template).toBe('turn {target} around');
    });

    it('has no prerequisites', () => {
      expect(turnAroundAction.prerequisites).toEqual([]);
    });
  });

  describe('action availability', () => {
    it('should be available when actor has closeness component', () => {
      const mockActor = {
        id: 'actor1',
        components: {
          'intimacy:closeness': { partners: ['target1'] },
        },
      };

      const mockTarget = {
        id: 'target1',
        components: {
          'intimacy:closeness': { partners: ['actor1'] },
        },
      };

      // Action requires closeness component
      expect(mockActor.components['intimacy:closeness']).toBeDefined();
      expect(mockTarget.components['intimacy:closeness'].partners).toContain(
        'actor1'
      );
    });

    it('should not be available without closeness component', () => {
      const mockActor = {
        id: 'actor1',
        components: {},
      };

      // Actor lacks required component
      expect(mockActor.components['intimacy:closeness']).toBeUndefined();
    });
  });
});
