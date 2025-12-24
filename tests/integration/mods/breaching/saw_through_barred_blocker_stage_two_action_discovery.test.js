/**
 * @file Integration tests for breaching:saw_through_barred_blocker_stage_two action discovery
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';
import '../../../common/mods/domainMatchers.js';
import sawThroughBarredBlockerStageTwoAction from '../../../../data/mods/breaching/actions/saw_through_barred_blocker_stage_two.action.json';

const ACTION_ID = 'breaching:saw_through_barred_blocker_stage_two';

describe('breaching:saw_through_barred_blocker_stage_two Action Discovery', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction(
      'breaching',
      'saw_through_barred_blocker_stage_two',
      { rule_id: 'breaching:handle_saw_through_barred_blocker_stage_two', actions: [] }, // Dummy rule
      { id: 'breaching:event-is-action-saw-through-barred-blocker-stage-two' }, // Dummy condition
      { skipValidation: true }
    );

    // Manually register the blockers scope resolver to ensure it works in test env
    // bypassing potential DSL resolution issues with location references
    const customResolver = function(context) {
      const em = this.entityManager || fixture.testEnv.entityManager;
      const actor = context.actor || context.actorEntity;

      if (!actor) return { success: true, value: new Set() };

      const position = em.getComponentData(actor.id, 'core:position');
      if (!position?.locationId) return { success: true, value: new Set() };

      const exits = em.getComponentData(position.locationId, 'locations:exits');
      const exitsList = Array.isArray(exits) ? exits : exits?.exits || [];

      if (!Array.isArray(exitsList)) return { success: true, value: new Set() };

      const blockers = new Set();
      exitsList.forEach((exit) => {
        if (!exit.blocker) return;

        const blockerId = exit.blocker;
        const isBarred = em.hasComponent(blockerId, 'blockers:is_barred');
        const hasResistance = em.hasComponent(
          blockerId,
          'blockers:structural_resistance'
        );
        const progress = em.getComponentData(
          blockerId,
          'core:progress_tracker'
        );
        const progressValue = progress ? progress.value : null;

        if (isBarred && hasResistance && progressValue === 1) {
          blockers.add(blockerId);
        }
      });

      return { success: true, value: blockers };
    };

    ScopeResolverHelpers._registerResolvers(
      fixture.testEnv,
      fixture.testEnv.entityManager,
      { 'blockers:sawable_barred_blockers_stage_two': customResolver }
    );
  });

  afterEach(() => {
    fixture.cleanup();
  });

  describe('Action structure', () => {
    it('has the expected template with chance placeholder', () => {
      expect(sawThroughBarredBlockerStageTwoAction.template).toBe(
        'hack through {barredBlocker} with {sawingTool} ({chance}% chance)'
      );
    });

    it('uses opposed contest with craft skill and structural resistance', () => {
      expect(sawThroughBarredBlockerStageTwoAction.chanceBased.enabled).toBe(true);
      expect(sawThroughBarredBlockerStageTwoAction.chanceBased.contestType).toBe(
        'opposed'
      );
      expect(
        sawThroughBarredBlockerStageTwoAction.chanceBased.actorSkill.component
      ).toBe('skills:craft_skill');
      expect(
        sawThroughBarredBlockerStageTwoAction.chanceBased.targetSkill.component
      ).toBe('blockers:structural_resistance');
      expect(
        sawThroughBarredBlockerStageTwoAction.chanceBased.targetSkill.targetRole
      ).toBe('primary');
    });

    it('includes the corroded modifier in chance metadata', () => {
      const corrodedModifier =
        sawThroughBarredBlockerStageTwoAction.chanceBased.modifiers.find(
          (modifier) => modifier.tag === 'corroded'
        );

      expect(corrodedModifier).toBeDefined();
      expect(corrodedModifier.value).toBe(10);
      expect(corrodedModifier.type).toBe('flat');
      expect(corrodedModifier.condition.condition_ref).toBe(
        'blockers:target-is-corroded'
      );
    });

    it('requires barred blockers with structural resistance', () => {
      expect(
        sawThroughBarredBlockerStageTwoAction.required_components.primary
      ).toEqual(
        expect.arrayContaining([
          'blockers:is_barred',
          'blockers:structural_resistance',
        ])
      );
    });
  });

  it('should discover action when actor has craft_skill, sawing tool in inventory, and barred blocker is nearby', async () => {
    // Create location
    const locationId = fixture.createEntity({
      id: 'test-location',
      name: 'Corridor',
      components: [{ componentId: 'core:location', data: {} }],
    });

    // Create target location
    const targetLocationId = fixture.createEntity({
      id: 'test-target-location',
      name: 'Cell',
      components: [{ componentId: 'core:location', data: {} }],
    });

    // Create barred blocker
    const blockerId = fixture.createEntity({
      id: 'test-blocker',
      name: 'Iron Bars',
      components: [
        { componentId: 'blockers:is_barred', data: {} },
        { componentId: 'blockers:structural_resistance', data: { value: 50 } },
        { componentId: 'core:progress_tracker', data: { value: 1 } },
      ],
    });

    // Add exit with blocker
    await fixture.modifyComponent(locationId, 'locations:exits', [
      {
        direction: 'north',
        target: targetLocationId,
        blocker: blockerId,
      },
    ]);

    // Create actor with craft skill
    const actorId = fixture.createEntity({
      id: 'test-actor',
      name: 'Breacher',
      components: [
        { componentId: 'core:actor', data: {} },
        { componentId: 'core:position', data: { locationId } },
        { componentId: 'skills:craft_skill', data: { value: 60 } },
        { componentId: 'items:inventory', data: { items: [] } }, // Will be populated by createEntity
      ],
    });

    // Create hacksaw (wielded)
    const hacksawId = fixture.createEntity({
      id: 'test-hacksaw',
      name: 'Rusty Hacksaw',
      components: [
        { componentId: 'items-core:item', data: {} },
        { componentId: 'breaching:allows_abrasive_sawing', data: {} },
        { componentId: 'items:owned_by', data: { entityId: actorId } }
      ],
    });

    // Add hacksaw to inventory
    await fixture.modifyComponent(actorId, 'items:inventory', { items: [hacksawId] });

    const actions = await fixture.discoverActions(actorId);
    expect(actions).toContainAction(ACTION_ID);
  });

  it('should discover action for corroded blocker', async () => {
    // Create location
    const locationId = fixture.createEntity({
      id: 'test-location-corroded',
      name: 'Corridor',
      components: [{ componentId: 'core:location', data: {} }],
    });

    const targetLocationId = fixture.createEntity({
      id: 'test-target-location-corroded',
      name: 'Cell',
      components: [{ componentId: 'core:location', data: {} }],
    });

    // Create corroded barred blocker
    const blockerId = fixture.createEntity({
      id: 'test-blocker-corroded',
      name: 'Corroded Bars',
      components: [
        { componentId: 'blockers:is_barred', data: {} },
        { componentId: 'blockers:structural_resistance', data: { value: 50 } },
        { componentId: 'blockers:corroded', data: {} },
        { componentId: 'core:progress_tracker', data: { value: 1 } },
      ],
    });

    // Add exit
    await fixture.modifyComponent(locationId, 'locations:exits', [
      { direction: 'north', target: targetLocationId, blocker: blockerId },
    ]);

    // Create actor
    const actorId = fixture.createEntity({
      id: 'test-actor-corroded',
      name: 'Breacher',
      components: [
        { componentId: 'core:actor', data: {} },
        { componentId: 'core:position', data: { locationId } },
        { componentId: 'skills:craft_skill', data: { value: 60 } },
        { componentId: 'items:inventory', data: { items: [] } },
      ],
    });

    // Create hacksaw
    const hacksawId = fixture.createEntity({
      id: 'test-hacksaw-corroded',
      name: 'Hacksaw',
      components: [
        { componentId: 'items-core:item', data: {} },
        { componentId: 'breaching:allows_abrasive_sawing', data: {} },
        { componentId: 'items:owned_by', data: { entityId: actorId } }
      ],
    });

    await fixture.modifyComponent(actorId, 'items:inventory', { items: [hacksawId] });

    const actions = await fixture.discoverActions(actorId);
    expect(actions).toContainAction(ACTION_ID);
  });

  it('should NOT discover if no sawing tool', async () => {
    // Location setup
    const locationId = fixture.createEntity({
      id: 'test-location-no-tool',
      components: [{ componentId: 'core:location', data: {} }],
    });
    const targetId = fixture.createEntity({ components: [{ componentId: 'core:location', data: {} }] });
    const blockerId = fixture.createEntity({
      components: [
        { componentId: 'blockers:is_barred', data: {} },
        { componentId: 'blockers:structural_resistance', data: { value: 50 } },
        { componentId: 'core:progress_tracker', data: { value: 1 } },
      ],
    });
    await fixture.modifyComponent(locationId, 'locations:exits', [
      { direction: 'north', target: targetId, blocker: blockerId },
    ]);

    // Actor setup (no tool)
    const actorId = fixture.createEntity({
      id: 'test-actor-no-tool',
      components: [
        { componentId: 'core:actor', data: {} },
        { componentId: 'core:position', data: { locationId } },
        { componentId: 'skills:craft_skill', data: { value: 60 } },
        { componentId: 'items:inventory', data: { items: [] } },
      ],
    });

    const actions = await fixture.discoverActions(actorId);
    expect(actions).not.toContainAction(ACTION_ID);
  });

  it('should NOT discover if only non-sawing tools are in inventory', async () => {
    const locationId = fixture.createEntity({
      id: 'test-location-non-sawing',
      components: [{ componentId: 'core:location', data: {} }],
    });
    const targetId = fixture.createEntity({
      components: [{ componentId: 'core:location', data: {} }],
    });
    const blockerId = fixture.createEntity({
      components: [
        { componentId: 'blockers:is_barred', data: {} },
        { componentId: 'blockers:structural_resistance', data: { value: 50 } },
        { componentId: 'core:progress_tracker', data: { value: 1 } },
      ],
    });
    await fixture.modifyComponent(locationId, 'locations:exits', [
      { direction: 'north', target: targetId, blocker: blockerId },
    ]);

    const actorId = fixture.createEntity({
      id: 'test-actor-non-sawing',
      components: [
        { componentId: 'core:actor', data: {} },
        { componentId: 'core:position', data: { locationId } },
        { componentId: 'skills:craft_skill', data: { value: 60 } },
        { componentId: 'items:inventory', data: { items: [] } },
      ],
    });

    const swordId = fixture.createEntity({
      components: [
        { componentId: 'items-core:item', data: {} },
        { componentId: 'items:owned_by', data: { entityId: actorId } },
      ],
    });

    await fixture.modifyComponent(actorId, 'items:inventory', {
      items: [swordId],
    });

    const actions = await fixture.discoverActions(actorId);
    expect(actions).not.toContainAction(ACTION_ID);
  });

  it('should NOT discover if blocker is not barred', async () => {
    // Location setup
    const locationId = fixture.createEntity({
      id: 'test-location-not-barred',
      components: [{ componentId: 'core:location', data: {} }],
    });
    const targetId = fixture.createEntity({ components: [{ componentId: 'core:location', data: {} }] });

    // Blocker without is_barred
    const blockerId = fixture.createEntity({
      components: [
        { componentId: 'blockers:structural_resistance', data: { value: 50 } },
        { componentId: 'core:progress_tracker', data: { value: 1 } },
      ],
    });
    await fixture.modifyComponent(locationId, 'locations:exits', [
      { direction: 'north', target: targetId, blocker: blockerId },
    ]);

    // Actor setup
    const actorId = fixture.createEntity({
      id: 'test-actor-not-barred',
      components: [
        { componentId: 'core:actor', data: {} },
        { componentId: 'core:position', data: { locationId } },
        { componentId: 'skills:craft_skill', data: { value: 60 } },
        { componentId: 'items:inventory', data: { items: [] } },
      ],
    });

    // Tool
    const hacksawId = fixture.createEntity({
      components: [
        { componentId: 'items-core:item', data: {} },
        { componentId: 'breaching:allows_abrasive_sawing', data: {} },
        { componentId: 'items:owned_by', data: { entityId: actorId } }
      ],
    });
    await fixture.modifyComponent(actorId, 'items:inventory', { items: [hacksawId] });

    const actions = await fixture.discoverActions(actorId);
    expect(actions).not.toContainAction(ACTION_ID);
  });

  it('should NOT discover if blocker lacks structural_resistance', async () => {
    // Location setup
    const locationId = fixture.createEntity({
      id: 'test-location-no-res',
      components: [{ componentId: 'core:location', data: {} }],
    });
    const targetId = fixture.createEntity({ components: [{ componentId: 'core:location', data: {} }] });

    // Blocker without structural_resistance
    const blockerId = fixture.createEntity({
      components: [
        { componentId: 'blockers:is_barred', data: {} },
        { componentId: 'core:progress_tracker', data: { value: 1 } },
      ],
    });
    await fixture.modifyComponent(locationId, 'locations:exits', [
      { direction: 'north', target: targetId, blocker: blockerId },
    ]);

    // Actor setup
    const actorId = fixture.createEntity({
      id: 'test-actor-no-res',
      components: [
        { componentId: 'core:actor', data: {} },
        { componentId: 'core:position', data: { locationId } },
        { componentId: 'skills:craft_skill', data: { value: 60 } },
        { componentId: 'items:inventory', data: { items: [] } },
      ],
    });

    // Tool
    const hacksawId = fixture.createEntity({
      components: [
        { componentId: 'items-core:item', data: {} },
        { componentId: 'breaching:allows_abrasive_sawing', data: {} },
        { componentId: 'items:owned_by', data: { entityId: actorId } }
      ],
    });
    await fixture.modifyComponent(actorId, 'items:inventory', { items: [hacksawId] });

    const actions = await fixture.discoverActions(actorId);
    expect(actions).not.toContainAction(ACTION_ID);
  });

  it('should NOT discover if blocker has no progress tracker', async () => {
    // Location setup
    const locationId = fixture.createEntity({
      id: 'test-location-no-progress',
      components: [{ componentId: 'core:location', data: {} }],
    });
    const targetId = fixture.createEntity({ components: [{ componentId: 'core:location', data: {} }] });

    // Blocker without progress tracker
    const blockerId = fixture.createEntity({
      components: [
        { componentId: 'blockers:is_barred', data: {} },
        { componentId: 'blockers:structural_resistance', data: { value: 50 } },
      ],
    });
    await fixture.modifyComponent(locationId, 'locations:exits', [
      { direction: 'north', target: targetId, blocker: blockerId },
    ]);

    // Actor setup
    const actorId = fixture.createEntity({
      id: 'test-actor-no-progress',
      components: [
        { componentId: 'core:actor', data: {} },
        { componentId: 'core:position', data: { locationId } },
        { componentId: 'skills:craft_skill', data: { value: 60 } },
        { componentId: 'items:inventory', data: { items: [] } },
      ],
    });

    // Tool
    const hacksawId = fixture.createEntity({
      components: [
        { componentId: 'items-core:item', data: {} },
        { componentId: 'breaching:allows_abrasive_sawing', data: {} },
        { componentId: 'items:owned_by', data: { entityId: actorId } }
      ],
    });
    await fixture.modifyComponent(actorId, 'items:inventory', { items: [hacksawId] });

    const actions = await fixture.discoverActions(actorId);
    expect(actions).not.toContainAction(ACTION_ID);
  });

  it('should NOT discover if blocker has progress == 0', async () => {
    // Location setup
    const locationId = fixture.createEntity({
      id: 'test-location-zero-progress',
      components: [{ componentId: 'core:location', data: {} }],
    });
    const targetId = fixture.createEntity({ components: [{ componentId: 'core:location', data: {} }] });

    // Blocker with progress == 0
    const blockerId = fixture.createEntity({
      components: [
        { componentId: 'blockers:is_barred', data: {} },
        { componentId: 'blockers:structural_resistance', data: { value: 50 } },
        { componentId: 'core:progress_tracker', data: { value: 0 } },
      ],
    });
    await fixture.modifyComponent(locationId, 'locations:exits', [
      { direction: 'north', target: targetId, blocker: blockerId },
    ]);

    // Actor setup
    const actorId = fixture.createEntity({
      id: 'test-actor-zero-progress',
      components: [
        { componentId: 'core:actor', data: {} },
        { componentId: 'core:position', data: { locationId } },
        { componentId: 'skills:craft_skill', data: { value: 60 } },
        { componentId: 'items:inventory', data: { items: [] } },
      ],
    });

    // Tool
    const hacksawId = fixture.createEntity({
      components: [
        { componentId: 'items-core:item', data: {} },
        { componentId: 'breaching:allows_abrasive_sawing', data: {} },
        { componentId: 'items:owned_by', data: { entityId: actorId } }
      ],
    });
    await fixture.modifyComponent(actorId, 'items:inventory', { items: [hacksawId] });

    const actions = await fixture.discoverActions(actorId);
    expect(actions).not.toContainAction(ACTION_ID);
  });

  it('should NOT discover if blocker has progress > 1', async () => {
    // Location setup
    const locationId = fixture.createEntity({
      id: 'test-location-complete-progress',
      components: [{ componentId: 'core:location', data: {} }],
    });
    const targetId = fixture.createEntity({ components: [{ componentId: 'core:location', data: {} }] });

    // Blocker with progress > 1
    const blockerId = fixture.createEntity({
      components: [
        { componentId: 'blockers:is_barred', data: {} },
        { componentId: 'blockers:structural_resistance', data: { value: 50 } },
        { componentId: 'core:progress_tracker', data: { value: 2 } },
      ],
    });
    await fixture.modifyComponent(locationId, 'locations:exits', [
      { direction: 'north', target: targetId, blocker: blockerId },
    ]);

    // Actor setup
    const actorId = fixture.createEntity({
      id: 'test-actor-complete-progress',
      components: [
        { componentId: 'core:actor', data: {} },
        { componentId: 'core:position', data: { locationId } },
        { componentId: 'skills:craft_skill', data: { value: 60 } },
        { componentId: 'items:inventory', data: { items: [] } },
      ],
    });

    // Tool
    const hacksawId = fixture.createEntity({
      components: [
        { componentId: 'items-core:item', data: {} },
        { componentId: 'breaching:allows_abrasive_sawing', data: {} },
        { componentId: 'items:owned_by', data: { entityId: actorId } }
      ],
    });
    await fixture.modifyComponent(actorId, 'items:inventory', { items: [hacksawId] });

    const actions = await fixture.discoverActions(actorId);
    expect(actions).not.toContainAction(ACTION_ID);
  });

  it('should discover if blocker has progress == 1', async () => {
    // Location setup
    const locationId = fixture.createEntity({
      id: 'test-location-stage-two',
      components: [{ componentId: 'core:location', data: {} }],
    });
    const targetId = fixture.createEntity({ components: [{ componentId: 'core:location', data: {} }] });

    // Blocker with progress == 1
    const blockerId = fixture.createEntity({
      components: [
        { componentId: 'blockers:is_barred', data: {} },
        { componentId: 'blockers:structural_resistance', data: { value: 50 } },
        { componentId: 'core:progress_tracker', data: { value: 1 } },
      ],
    });
    await fixture.modifyComponent(locationId, 'locations:exits', [
      { direction: 'north', target: targetId, blocker: blockerId },
    ]);

    // Actor setup
    const actorId = fixture.createEntity({
      id: 'test-actor-stage-two',
      components: [
        { componentId: 'core:actor', data: {} },
        { componentId: 'core:position', data: { locationId } },
        { componentId: 'skills:craft_skill', data: { value: 60 } },
        { componentId: 'items:inventory', data: { items: [] } },
      ],
    });

    // Tool
    const hacksawId = fixture.createEntity({
      components: [
        { componentId: 'items-core:item', data: {} },
        { componentId: 'breaching:allows_abrasive_sawing', data: {} },
        { componentId: 'items:owned_by', data: { entityId: actorId } }
      ],
    });
    await fixture.modifyComponent(actorId, 'items:inventory', { items: [hacksawId] });

    const actions = await fixture.discoverActions(actorId);
    expect(actions).toContainAction(ACTION_ID);
  });
});
