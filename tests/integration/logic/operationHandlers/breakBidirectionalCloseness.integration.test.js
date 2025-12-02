/**
 * @file Integration tests for BREAK_BIDIRECTIONAL_CLOSENESS operation
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('BREAK_BIDIRECTIONAL_CLOSENESS Integration', () => {
  let fixture;

  afterEach(async () => {
    if (fixture) {
      await fixture.cleanup();
    }
  });

  const setupFixture = async () => {
    const dummyRule = {
      rule_id: 'core:test_break_closeness',
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
      'core:test_break_closeness',
      dummyRule,
      dummyCondition
    );
  };

  describe('relationship breaking', () => {
    it('should remove bidirectional components from both entities', async () => {
      fixture = await setupFixture();

      // Create two entities with a relationship
      const actor = fixture.createEntity({
        id: 'actor-1',
        components: {
          'core:actor': { name: 'Actor' },
          'hugging:hugging': { embraced_entity_id: 'target-1' },
        },
      });

      const target = fixture.createEntity({
        id: 'target-1',
        components: {
          'core:actor': { name: 'Target' },
          'hugging:being_hugged': { hugging_entity_id: 'actor-1' },
        },
      });

      // Verify initial state
      expect(fixture.getComponent(actor, 'hugging:hugging')).toBeTruthy();
      expect(fixture.getComponent(target, 'hugging:being_hugged')).toBeTruthy();

      // Run BREAK_BIDIRECTIONAL_CLOSENESS
      await fixture.executeOperation('BREAK_BIDIRECTIONAL_CLOSENESS', {
        event: {
          payload: {
            actorId: actor,
            targetId: target,
          },
        },
        parameters: {
          actor_component_type: 'hugging:hugging',
          target_component_type: 'hugging:being_hugged',
        },
      });

      // Verify components are removed
      expect(fixture.getComponent(actor, 'hugging:hugging')).toBeNull();
      expect(fixture.getComponent(target, 'hugging:being_hugged')).toBeNull();
    });

    it('should remove additional components if specified', async () => {
      fixture = await setupFixture();

      const actor = fixture.createEntity({
        id: 'actor-2',
        components: {
          'relation:primary': { with: 'target-2' },
          'relation:extra': { status: 'active' },
        },
      });

      const target = fixture.createEntity({
        id: 'target-2',
        components: {
          'relation:secondary': { with: 'actor-2' },
          'relation:extra': { status: 'active' },
        },
      });

      await fixture.executeOperation('BREAK_BIDIRECTIONAL_CLOSENESS', {
        event: {
          payload: { actorId: actor, targetId: target },
        },
        parameters: {
          actor_component_type: 'relation:primary',
          target_component_type: 'relation:secondary',
          additional_component_types_to_remove: ['relation:extra'],
        },
      });

      expect(fixture.getComponent(actor, 'relation:primary')).toBeNull();
      expect(fixture.getComponent(target, 'relation:secondary')).toBeNull();
      expect(fixture.getComponent(actor, 'relation:extra')).toBeNull();
      expect(fixture.getComponent(target, 'relation:extra')).toBeNull();
    });
    
    it('should handle missing components gracefully', async () => {
      fixture = await setupFixture();
      
      const actor = fixture.createEntity({ 
        id: 'actor-3', 
        components: { 'core:actor': { name: 'Actor 3' } } 
      });
      const target = fixture.createEntity({ id: 'target-3', components: {} });

      // Should not throw error
       await fixture.executeOperation('BREAK_BIDIRECTIONAL_CLOSENESS', {
        event: {
          payload: { actorId: actor, targetId: target },
        },
        parameters: {
          actor_component_type: 'relation:missing',
          target_component_type: 'relation:missing_too',
        },
      });
      
      // Still valid entities
      expect(fixture.getComponent(actor, 'core:actor')).toBeTruthy();
    });
  });
});
