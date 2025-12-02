/**
 * @file Integration tests for ESTABLISH_BIDIRECTIONAL_CLOSENESS operation
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('ESTABLISH_BIDIRECTIONAL_CLOSENESS Integration', () => {
  let fixture;

  afterEach(async () => {
    if (fixture) {
      await fixture.cleanup();
    }
  });

  const setupFixture = async () => {
    const dummyRule = {
      rule_id: 'core:test_establish_closeness',
      event_type: 'core:test_event',
      actions: [{ type: 'LOG', parameters: { message: 'test' } }],
    };
    const dummyCondition = {
      id: 'core:event-is-test-event',
      description: 'Test condition',
      logic: {
        if: [
          { '==': [{ var: 'event.eventName' }, 'core:test_event'] },
          true,
          false,
        ],
      },
    };

    return await ModTestFixture.forRule(
      'core',
      'core:test_establish_closeness',
      dummyRule,
      dummyCondition
    );
  };

  describe('relationship lifecycle', () => {
    it('should establish bidirectional components and clean existing relationships', async () => {
      fixture = await setupFixture();

      // Create three entities
      const actor = fixture.createEntity({
        id: 'actor-1',
        components: {
          'core:actor': { name: 'Actor' },
        },
      });

      const target = fixture.createEntity({
        id: 'target-1',
        components: {
          'core:actor': { name: 'Target' },
        },
      });

      const thirdParty = fixture.createEntity({
        id: 'third-party-1',
        components: {
          'core:actor': { name: 'ThirdParty' },
          // Simulating an existing relationship with actor
          'hugging:being_hugged': { hugging_entity_id: 'actor-1' },
        },
      });

      // Add the corresponding component to actor manually to simulate existing state
      await fixture.modifyComponent(actor, 'hugging:hugging', { embraced_entity_id: 'third-party-1' });

      // Verify initial state
      let actorData = fixture.getComponent(actor, 'hugging:hugging');
      let thirdPartyData = fixture.getComponent(thirdParty, 'hugging:being_hugged');
      expect(actorData).toEqual({ embraced_entity_id: 'third-party-1' });
      expect(thirdPartyData).toEqual({ hugging_entity_id: 'actor-1' });

      // Run ESTABLISH_BIDIRECTIONAL_CLOSENESS between Actor and Target
      await fixture.executeOperation('ESTABLISH_BIDIRECTIONAL_CLOSENESS', {
        event: {
          payload: {
            actorId: actor,
            targetId: target,
          },
        },
        parameters: {
          actor_component_type: 'hugging:hugging',
          target_component_type: 'hugging:being_hugged',
          actor_data: { embraced_entity_id: '{event.payload.targetId}' },
          target_data: { hugging_entity_id: '{event.payload.actorId}' },
          clean_existing: true,
          existing_component_types_to_clean: ['hugging:hugging', 'hugging:being_hugged']
        },
      });

      // Verify new state
      actorData = fixture.getComponent(actor, 'hugging:hugging');
      const targetData = fixture.getComponent(target, 'hugging:being_hugged');
      thirdPartyData = fixture.getComponent(thirdParty, 'hugging:being_hugged');

      // Actor should now hug Target
      expect(actorData).toEqual({ embraced_entity_id: 'target-1' });
      
      // Target should be hugged by Actor
      expect(targetData).toEqual({ hugging_entity_id: 'actor-1' });

      // Third Party should no longer be hugged
      expect(thirdPartyData).toBeNull();
    });
  });

  describe('template resolution', () => {
    it('should resolve template variables in component data', async () => {
      fixture = await setupFixture();

      const actor = fixture.createEntity({ id: 'actor-2', components: {} });
      const target = fixture.createEntity({ id: 'target-2', components: {} });

      await fixture.executeOperation('ESTABLISH_BIDIRECTIONAL_CLOSENESS', {
        event: {
          payload: { actorId: actor, targetId: target },
        },
        parameters: {
          actor_component_type: 'test:linked_to',
          target_component_type: 'test:linked_from',
          actor_data: { 
            target_ref: '{event.payload.targetId}',
            static_val: 'static'
          },
          target_data: { 
            actor_ref: '{event.payload.actorId}',
            nested: {
                back_ref: '{event.payload.actorId}'
            }
          },
        },
      });

      const actorComp = fixture.getComponent(actor, 'test:linked_to');
      const targetComp = fixture.getComponent(target, 'test:linked_from');

      expect(actorComp).toEqual({ 
        target_ref: 'target-2',
        static_val: 'static'
      });

      expect(targetComp).toEqual({
        actor_ref: 'actor-2',
        nested: {
            back_ref: 'actor-2'
        }
      });
    });
  });
});
