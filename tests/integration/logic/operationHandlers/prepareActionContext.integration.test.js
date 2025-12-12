/**
 * @file Integration tests for PREPARE_ACTION_CONTEXT operation
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('PREPARE_ACTION_CONTEXT Integration', () => {
  let fixture;

  afterEach(async () => {
    if (fixture) {
      await fixture.cleanup();
    }
  });

  describe('context preparation', () => {
    it('should set all required context variables', async () => {
      const dummyRule = {
        rule_id: 'core:test_prepare_context',
        event_type: 'core:test_event',
        actions: [{ type: 'LOG', parameters: { message: 'test' } }],
      };
      const dummyCondition = {
        id: 'core:event-is-action-test-prepare-context',
        description: 'Test condition',
        logic: {
          if: [
            { '==': [{ var: 'event.eventName' }, 'core:test_event'] },
            true,
            false,
          ],
        },
      };

      fixture = await ModTestFixture.forRule(
        'core',
        'core:test_prepare_context',
        dummyRule,
        dummyCondition
      );

      // Create test entities
      const actor = fixture.createEntity({
        id: 'test-actor',
        components: {
          'core:actor': { name: 'Alice' },
          'core:position': { locationId: 'test-location' },
        },
      });

      const target = fixture.createEntity({
        id: 'test-target',
        components: {
          'core:actor': { name: 'Bob' },
        },
      });

      // Execute operation directly
      const context = await fixture.executeOperation('PREPARE_ACTION_CONTEXT', {
        event: {
          payload: {
            actorId: actor,
            targetId: target,
          },
        },
        parameters: {},
      });

      // Verify context variables
      expect(context.actorName).toBe('Alice');
      expect(context.targetName).toBe('Bob');
      expect(context.locationId).toBe('test-location');
      expect(context.targetId).toBe(target);
      expect(context.perceptionType).toBe('physical.target_action');
    });
  });

  describe('equivalence to expanded pattern', () => {
    it('should produce same result as manual context setup', async () => {
      const dummyRule = {
        rule_id: 'affection:handle_brush_hand',
        event_type: 'affection:test_event',
        actions: [{ type: 'LOG', parameters: { message: 'test' } }],
      };
      const dummyCondition = {
        id: 'affection:event-is-action-brush-hand',
        description: 'Test condition',
        logic: {
          if: [
            { '==': [{ var: 'event.eventName' }, 'affection:test_event'] },
            true,
            false,
          ],
        },
      };

      fixture = await ModTestFixture.forRule(
        'affection',
        'affection:handle_brush_hand',
        dummyRule,
        dummyCondition
      );

      // Create entities
      const actor = fixture.createEntity({
        id: 'actor-1',
        components: {
          'core:actor': { name: 'Charlie' },
          'core:position': { locationId: 'room-1' },
        },
      });

      const target = fixture.createEntity({
        id: 'target-1',
        components: {
          'core:actor': { name: 'Dana' },
        },
      });

      // Execute with PREPARE_ACTION_CONTEXT
      const newContext = await fixture.executeOperation(
        'PREPARE_ACTION_CONTEXT',
        {
          event: {
            payload: { actorId: actor, targetId: target },
          },
          parameters: {},
        }
      );

      // Execute manual pattern (simulating old approach)
      const manualContext = {};
      manualContext.actorName = 'Charlie'; // Would come from GET_NAME
      manualContext.targetName = 'Dana'; // Would come from GET_NAME
      manualContext.locationId = 'room-1'; // Would come from QUERY_COMPONENT + SET_VARIABLE
      manualContext.targetId = target; // Would come from SET_VARIABLE
      manualContext.perceptionType = 'physical.target_action'; // Would come from SET_VARIABLE

      // Verify equivalence
      expect(newContext.actorName).toBe(manualContext.actorName);
      expect(newContext.targetName).toBe(manualContext.targetName);
      expect(newContext.locationId).toBe(manualContext.locationId);
      expect(newContext.targetId).toBe(manualContext.targetId);
      expect(newContext.perceptionType).toBe(manualContext.perceptionType);
    });
  });

  describe('item name resolution', () => {
    it('should resolve item names for item entities', async () => {
      const dummyRule = {
        rule_id: 'items:handle_give_item',
        event_type: 'items:test_event',
        actions: [{ type: 'LOG', parameters: { message: 'test' } }],
      };
      const dummyCondition = {
        id: 'items:event-is-action-give-item',
        description: 'Test condition',
        logic: {
          if: [
            { '==': [{ var: 'event.eventName' }, 'items:test_event'] },
            true,
            false,
          ],
        },
      };

      fixture = await ModTestFixture.forRule(
        'items',
        'items:handle_give_item',
        dummyRule,
        dummyCondition
      );

      // Create actor and item target
      const actor = fixture.createEntity({
        id: 'giver',
        components: {
          'core:actor': { name: 'Eve' },
          'core:position': { locationId: 'market' },
        },
      });

      const item = fixture.createEntity({
        id: 'sword-1',
        components: {
          'core:item': { name: 'Iron Sword' },
        },
      });

      const context = await fixture.executeOperation('PREPARE_ACTION_CONTEXT', {
        event: {
          payload: { actorId: actor, targetId: item },
        },
        parameters: {},
      });

      expect(context.actorName).toBe('Eve');
      expect(context.targetName).toBe('Iron Sword');
    });
  });

  describe('secondary entity support', () => {
    it('should resolve secondary entity when include_secondary is true', async () => {
      const dummyRule = {
        rule_id: 'items:handle_give_item',
        event_type: 'items:test_event',
        actions: [{ type: 'LOG', parameters: { message: 'test' } }],
      };
      const dummyCondition = {
        id: 'items:event-is-action-give-item',
        description: 'Test condition',
        logic: {
          if: [
            { '==': [{ var: 'event.eventName' }, 'items:test_event'] },
            true,
            false,
          ],
        },
      };

      fixture = await ModTestFixture.forRule(
        'items',
        'items:handle_give_item',
        dummyRule,
        dummyCondition
      );

      const actor = fixture.createEntity({
        id: 'giver',
        components: {
          'core:actor': { name: 'Frank' },
          'core:position': { locationId: 'loc-1' },
        },
      });

      const target = fixture.createEntity({
        id: 'receiver',
        components: {
          'core:actor': { name: 'Grace' },
        },
      });

      const item = fixture.createEntity({
        id: 'item-1',
        components: {
          'core:item': { name: 'Gold Ring' },
        },
      });

      const context = await fixture.executeOperation('PREPARE_ACTION_CONTEXT', {
        event: {
          payload: {
            actorId: actor,
            targetId: target,
            secondaryId: item,
          },
        },
        parameters: {
          include_secondary: true,
          secondary_name_variable: 'itemName',
        },
      });

      expect(context.actorName).toBe('Frank');
      expect(context.targetName).toBe('Grace');
      expect(context.itemName).toBe('Gold Ring');
    });
  });

  describe('edge cases', () => {
    it('should handle missing position component gracefully', async () => {
      const dummyRule = {
        rule_id: 'core:test_prepare_context',
        event_type: 'core:test_event',
        actions: [{ type: 'LOG', parameters: { message: 'test' } }],
      };
      const dummyCondition = {
        id: 'core:event-is-action-test-prepare-context',
        description: 'Test condition',
        logic: {
          if: [
            { '==': [{ var: 'event.eventName' }, 'core:test_event'] },
            true,
            false,
          ],
        },
      };

      fixture = await ModTestFixture.forRule(
        'core',
        'core:test_prepare_context',
        dummyRule,
        dummyCondition
      );

      const actor = fixture.createEntity({
        id: 'actor-no-position',
        components: {
          'core:actor': { name: 'Henry' },
          // No position component
        },
      });

      const target = fixture.createEntity({
        id: 'target-1',
        components: {
          'core:actor': { name: 'Ivy' },
        },
      });

      const context = await fixture.executeOperation('PREPARE_ACTION_CONTEXT', {
        event: {
          payload: { actorId: actor, targetId: target },
        },
        parameters: {},
      });

      expect(context.locationId).toBeNull();
      expect(context.actorName).toBe('Henry');
    });

    it('should fallback to entity ID for unnamed entities', async () => {
      const dummyRule = {
        rule_id: 'core:test_prepare_context',
        event_type: 'core:test_event',
        actions: [{ type: 'LOG', parameters: { message: 'test' } }],
      };
      const dummyCondition = {
        id: 'core:event-is-action-test-prepare-context',
        description: 'Test condition',
        logic: {
          if: [
            { '==': [{ var: 'event.eventName' }, 'core:test_event'] },
            true,
            false,
          ],
        },
      };
      fixture = await ModTestFixture.forRule(
        'core',
        'core:test_prepare_context',
        dummyRule,
        dummyCondition
      );

      const actor = fixture.createEntity({
        id: 'unnamed-entity-123',
        components: {
          'core:position': { locationId: 'loc-1' },
          // No name component
        },
      });

      const target = fixture.createEntity({
        id: 'another-unnamed-456',
        components: {},
      });

      const context = await fixture.executeOperation('PREPARE_ACTION_CONTEXT', {
        event: {
          payload: { actorId: actor, targetId: target },
        },
        parameters: {},
      });

      expect(context.actorName).toBe('unnamed-entity-123');
      expect(context.targetName).toBe('another-unnamed-456');
    });
  });
});
