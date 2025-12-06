/* eslint-disable jest/no-conditional-expect */
import { describe, it, expect, beforeAll } from '@jest/globals';
import { registerDomainMatchers } from '../../../common/mods/domainMatchers.js';

describe('Domain Matchers - Unit Tests', () => {
  beforeAll(() => {
    registerDomainMatchers();
  });

  describe('toHaveActionSuccess / toHaveActionFailure', () => {
    it('should pass when action succeeded', () => {
      const events = [
        {
          eventType: 'core:display_successful_action_result',
          payload: { message: 'Alice sits down on Chair.' },
        },
      ];
      expect(events).toHaveActionSuccess('Alice sits down on Chair.');
    });

    it('should fail when action did not succeed', () => {
      const events = [{ eventType: 'core:some_other_event', payload: {} }];
      expect(() =>
        expect(events).toHaveActionSuccess('Alice sits down on Chair.')
      ).toThrow();
    });

    it('should pass when action failed', () => {
      const events = [{ eventType: 'core:some_other_event', payload: {} }];
      expect(events).toHaveActionFailure();
    });

    it('should show actual events in error message', () => {
      const events = [
        { eventType: 'core:action_initiated', payload: {} },
        { eventType: 'core:turn_ended', payload: {} },
      ];

      try {
        expect(events).toHaveActionSuccess('Expected message');
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err.message).toContain('core:action_initiated');
        expect(err.message).toContain('core:turn_ended');
      }
    });

    it('should show error event in message when present', () => {
      const events = [
        { eventType: 'core:action_initiated', payload: {} },
        {
          eventType: 'core:system_error_occurred',
          payload: { error: 'Something went wrong' },
        },
      ];

      try {
        expect(events).toHaveActionSuccess('Expected message');
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err.message).toContain('Something went wrong');
      }
    });

    it('should fail when success message does not match', () => {
      const events = [
        {
          eventType: 'core:display_successful_action_result',
          payload: { message: 'Alice stands up.' },
        },
      ];

      try {
        expect(events).toHaveActionSuccess('Alice sits down.');
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err.message).toContain('Expected message');
        expect(err.message).toContain('Received message');
      }
    });

    it('should throw when events is not an array (toHaveActionSuccess)', () => {
      expect(() => expect(null).toHaveActionSuccess('message')).toThrow(
        'toHaveActionSuccess: received must be an events array'
      );
    });

    it('should throw when events is not an array (toHaveActionFailure)', () => {
      expect(() => expect(null).toHaveActionFailure()).toThrow(
        'toHaveActionFailure: received must be an events array'
      );
    });
  });

  describe('toHaveComponent', () => {
    it('should pass when entity has component', () => {
      const entity = {
        id: 'actor1',
        components: {
          'core:actor': {},
          'core:position': { locationId: 'room1' },
        },
      };

      expect(entity).toHaveComponent('core:actor');
      expect(entity).toHaveComponent('core:position');
    });

    it('should fail when entity lacks component', () => {
      const entity = {
        id: 'actor1',
        components: {
          'core:actor': {},
        },
      };

      expect(() => expect(entity).toHaveComponent('core:position')).toThrow();
    });

    it('should show actual components in error message', () => {
      const entity = {
        id: 'actor1',
        components: {
          'core:actor': {},
          'core:standing': {},
        },
      };

      try {
        expect(entity).toHaveComponent('core:sitting');
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err.message).toContain('core:actor');
        expect(err.message).toContain('core:standing');
      }
    });

    it('should show "none" when entity has no components', () => {
      const entity = {
        id: 'actor1',
        components: {},
      };

      try {
        expect(entity).toHaveComponent('core:sitting');
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err.message).toContain('none');
      }
    });

    it('should throw when entity is invalid', () => {
      expect(() => expect(null).toHaveComponent('core:actor')).toThrow(
        'toHaveComponent: received must be an entity object'
      );
    });

    it('should throw when entity has no components property', () => {
      const entity = { id: 'actor1' };
      expect(() => expect(entity).toHaveComponent('core:actor')).toThrow(
        'toHaveComponent: received object must have a components property'
      );
    });
  });

  describe('toNotHaveComponent', () => {
    it('should pass when entity does not have component', () => {
      const entity = {
        id: 'actor1',
        components: {
          'core:actor': {},
        },
      };

      expect(entity).toNotHaveComponent('core:sitting');
    });

    it('should fail when entity has component', () => {
      const entity = {
        id: 'actor1',
        components: {
          'core:actor': {},
          'core:sitting': {},
        },
      };

      expect(() => expect(entity).toNotHaveComponent('core:sitting')).toThrow();
    });

    it('should show actual components in error message', () => {
      const entity = {
        id: 'actor1',
        components: {
          'core:actor': {},
          'core:sitting': {},
          'core:position': {},
        },
      };

      try {
        expect(entity).toNotHaveComponent('core:sitting');
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err.message).toContain('core:actor');
        expect(err.message).toContain('core:sitting');
        expect(err.message).toContain('core:position');
      }
    });

    it('should throw when entity is invalid', () => {
      expect(() => expect(null).toNotHaveComponent('core:actor')).toThrow(
        'toNotHaveComponent: received must be an entity object'
      );
    });

    it('should throw when entity has no components property', () => {
      const entity = { id: 'actor1' };
      expect(() => expect(entity).toNotHaveComponent('core:actor')).toThrow(
        'toNotHaveComponent: received object must have a components property'
      );
    });
  });

  describe('toBeAt', () => {
    it('should pass when entity is at specified location', () => {
      const entity = {
        id: 'actor1',
        components: {
          'core:position': { locationId: 'bedroom' },
        },
      };

      expect(entity).toBeAt('bedroom');
    });

    it('should fail when entity is at different location', () => {
      const entity = {
        id: 'actor1',
        components: {
          'core:position': { locationId: 'kitchen' },
        },
      };

      expect(() => expect(entity).toBeAt('bedroom')).toThrow();
    });

    it('should fail when entity has no position component', () => {
      const entity = {
        id: 'actor1',
        components: {
          'core:actor': {},
        },
      };

      try {
        expect(entity).toBeAt('bedroom');
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err.message).toContain('no position component');
      }
    });

    it('should show actual location in error message', () => {
      const entity = {
        id: 'actor1',
        components: {
          'core:position': { locationId: 'kitchen' },
        },
      };

      try {
        expect(entity).toBeAt('bedroom');
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err.message).toContain('kitchen');
      }
    });

    it('should throw when entity is invalid', () => {
      expect(() => expect(null).toBeAt('bedroom')).toThrow(
        'toBeAt: received must be an entity object'
      );
    });

    it('should throw when entity has no components property', () => {
      const entity = { id: 'actor1' };
      expect(() => expect(entity).toBeAt('bedroom')).toThrow(
        'toBeAt: received object must have a components property'
      );
    });
  });

  describe('toDispatchEvent', () => {
    it('should pass when event was dispatched', () => {
      const events = [
        { eventType: 'core:component_added', payload: {} },
        { eventType: 'core:perceptible_event', payload: {} },
      ];

      expect(events).toDispatchEvent('core:component_added');
      expect(events).toDispatchEvent('core:perceptible_event');
    });

    it('should fail when event was not dispatched', () => {
      const events = [{ eventType: 'core:component_added', payload: {} }];

      expect(() =>
        expect(events).toDispatchEvent('core:component_removed')
      ).toThrow();
    });

    it('should show actual events in error message', () => {
      const events = [
        { eventType: 'core:component_added', payload: {} },
        { eventType: 'core:turn_ended', payload: {} },
      ];

      try {
        expect(events).toDispatchEvent('core:component_removed');
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err.message).toContain('core:component_added');
        expect(err.message).toContain('core:turn_ended');
      }
    });

    it('should show "none" when no events dispatched', () => {
      const events = [];

      try {
        expect(events).toDispatchEvent('core:component_added');
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err.message).toContain('none');
      }
    });

    it('should throw when events is not an array', () => {
      expect(() =>
        expect(null).toDispatchEvent('core:component_added')
      ).toThrow('toDispatchEvent: received must be an events array');
    });
  });

  describe('toHaveComponentData', () => {
    it('should pass when component has matching data', () => {
      const entity = {
        id: 'actor1',
        components: {
          'core:position': { locationId: 'bedroom', facing: 'north' },
        },
      };

      expect(entity).toHaveComponentData('core:position', {
        locationId: 'bedroom',
      });

      expect(entity).toHaveComponentData('core:position', {
        locationId: 'bedroom',
        facing: 'north',
      });
    });

    it('should fail when component data does not match', () => {
      const entity = {
        id: 'actor1',
        components: {
          'core:position': { locationId: 'kitchen', facing: 'south' },
        },
      };

      expect(() =>
        expect(entity).toHaveComponentData('core:position', {
          locationId: 'bedroom',
        })
      ).toThrow();
    });

    it('should show data differences in error message', () => {
      const entity = {
        id: 'actor1',
        components: {
          'core:position': { locationId: 'kitchen', facing: 'south' },
        },
      };

      try {
        expect(entity).toHaveComponentData('core:position', {
          locationId: 'bedroom',
          facing: 'north',
        });
        throw new Error('Should have thrown');
      } catch (err) {
        // Verify error message contains all essential information
        expect(err.message).toContain('Data differences');
        expect(err.message).toContain('locationId:');
        expect(err.message).toContain('facing:');

        // Verify expected values appear in message
        expect(err.message).toContain('bedroom');
        expect(err.message).toContain('north');

        // Verify received values appear in message
        expect(err.message).toContain('kitchen');
        expect(err.message).toContain('south');

        // Verify the words "Expected" and "Received" appear to show structure
        expect(err.message).toContain('Expected');
        expect(err.message).toContain('Received');
      }
    });

    it('should fail when component does not exist', () => {
      const entity = {
        id: 'actor1',
        components: {
          'core:actor': {},
        },
      };

      try {
        expect(entity).toHaveComponentData('core:position', {
          locationId: 'bedroom',
        });
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err.message).toContain('component not found');
      }
    });

    it('should check nested object values correctly', () => {
      const entity = {
        id: 'actor1',
        components: {
          'positioning:sitting_on': {
            furniture_id: 'chair1',
            spot_index: 0,
          },
        },
      };

      expect(entity).toHaveComponentData('positioning:sitting_on', {
        furniture_id: 'chair1',
        spot_index: 0,
      });
    });

    it('should fail when nested values do not match', () => {
      const entity = {
        id: 'actor1',
        components: {
          'positioning:sitting_on': {
            furniture_id: 'chair1',
            spot_index: 0,
          },
        },
      };

      expect(() =>
        expect(entity).toHaveComponentData('positioning:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 1,
        })
      ).toThrow();
    });

    it('should throw when entity is invalid', () => {
      expect(() =>
        expect(null).toHaveComponentData('core:position', {
          locationId: 'bedroom',
        })
      ).toThrow('toHaveComponentData: received must be an entity object');
    });

    it('should throw when entity has no components property', () => {
      const entity = { id: 'actor1' };
      expect(() =>
        expect(entity).toHaveComponentData('core:position', {
          locationId: 'bedroom',
        })
      ).toThrow(
        'toHaveComponentData: received object must have a components property'
      );
    });
  });

  describe('Negative assertions with .not', () => {
    it('should support .not.toHaveComponent', () => {
      const entity = {
        id: 'actor1',
        components: {
          'core:actor': {},
        },
      };

      expect(entity).not.toHaveComponent('core:sitting');
    });

    it('should support .not.toBeAt', () => {
      const entity = {
        id: 'actor1',
        components: {
          'core:position': { locationId: 'bedroom' },
        },
      };

      expect(entity).not.toBeAt('kitchen');
    });

    it('should support .not.toDispatchEvent', () => {
      const events = [{ eventType: 'core:component_added', payload: {} }];

      expect(events).not.toDispatchEvent('core:component_removed');
    });

    it('should support .not.toHaveComponentData', () => {
      const entity = {
        id: 'actor1',
        components: {
          'core:position': { locationId: 'bedroom', facing: 'north' },
        },
      };

      expect(entity).not.toHaveComponentData('core:position', {
        locationId: 'kitchen',
      });
    });
  });
});
