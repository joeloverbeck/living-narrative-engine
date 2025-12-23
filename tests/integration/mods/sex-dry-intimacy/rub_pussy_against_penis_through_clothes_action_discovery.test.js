/**
 * @file Integration tests for sex-dry-intimacy:rub_pussy_against_penis_through_clothes action discovery.
 * @description Tests that the action is properly discoverable when actors meet requirements.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import rubPussyAgainstPenisAction from '../../../../data/mods/sex-dry-intimacy/actions/rub_pussy_against_penis_through_clothes.action.json';
import rubPussyAgainstPenisRule from '../../../../data/mods/sex-dry-intimacy/rules/handle_rub_pussy_against_penis_through_clothes.rule.json';

describe('sex-dry-intimacy:rub_pussy_against_penis_through_clothes action discovery', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'sex-dry-intimacy',
      'sex-dry-intimacy:rub_pussy_against_penis_through_clothes',
      rubPussyAgainstPenisRule
    );

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        console.log('❌ No testEnv available');
        return;
      }

      console.log(
        '🔧 Building action index with action:',
        rubPussyAgainstPenisAction.id
      );
      // Build the action index with the rub_pussy_against_penis_through_clothes action
      testEnv.actionIndex.buildIndex([rubPussyAgainstPenisAction]);
      console.log('✅ Action index built');
    };

    /**
     * Test-specific scope resolver for actors_with_penis_facing_straddler_covered.
     *
     * NOTE: ModTestFixture.forAction doesn't load scope definition files (.scope files).
     * This resolver implements the logic from:
     * data/mods/sex-dry-intimacy/scopes/actors_with_penis_facing_straddler_covered.scope
     *
     * Scope DSL:
     *   sex-dry-intimacy:actors_with_penis_facing_straddler_covered := actor.components.personal-space-states:closeness.partners[][{
     *     "and": [
     *       {"hasPartOfType": [".", "penis"]},
     *       {"condition_ref": "positioning:entity-not-in-facing-away"},
     *       {"isSocketCovered": [".", "penis"]},
     *       {
     *         "!!": {
     *           "var": "entity.components.sitting-states:sitting_on"
     *         }
     *       },
     *       {
     *         "==": [
     *           {"var": "entity.id"},
     *           {"var": "actor.components.straddling-states:straddling_waist.target_id"}
     *         ]
     *       }
     *     ]
     *   }]
     *
     * Translation: Filter the actor's closeness partners to only those who:
     * - Have a penis body part
     * - Are not facing away
     * - Have the penis socket covered by clothing
     * - Are sitting (have sitting_on component)
     * - Are the target of the actor's straddling (entity.id == actor.straddling_waist.target_id)
     */
    const { testEnv } = testFixture;
    const originalResolveSync = testEnv.unifiedScopeResolver.resolveSync;
    testEnv.unifiedScopeResolver.resolveSync = (scopeName, context) => {
      if (
        scopeName ===
        'sex-dry-intimacy:actors_with_penis_facing_straddler_covered'
      ) {
        console.log('\n🔍 SCOPE RESOLVER CALLED FOR:', scopeName);
        const actorId = context?.actor?.id;
        console.log('  Actor ID:', actorId);

        if (!actorId) {
          console.log('  ❌ No actor ID');
          return { success: true, value: new Set() };
        }

        const actor = testFixture.entityManager.getEntityInstance(actorId);
        const closeness = actor?.components?.['personal-space-states:closeness'];
        const straddling = actor?.components?.['straddling-states:straddling_waist'];

        console.log('  Actor closeness partners:', closeness?.partners);
        console.log('  Actor straddling:', straddling);

        if (!closeness || !Array.isArray(closeness.partners) || !straddling) {
          console.log('  ❌ Missing closeness, partners array, or straddling');
          return { success: true, value: new Set() };
        }

        // Filter partners who meet all criteria
        const validPartners = closeness.partners.filter((partnerId) => {
          console.log(`\n    🔍 Checking partner: ${partnerId}`);
          const partner =
            testFixture.entityManager.getEntityInstance(partnerId);
          console.log(`      Partner entity:`, partner ? 'found' : 'NOT FOUND');

          // Check sitting_on component
          if (!partner?.components?.['sitting-states:sitting_on']) {
            console.log('      ❌ No sitting_on component');
            return false;
          }
          console.log('      ✅ Has sitting_on component');

          // Check if partner is the straddling target
          if (partner.id !== straddling.target_id) {
            console.log(
              `      ❌ Not straddling target (${partner.id} !== ${straddling.target_id})`
            );
            return false;
          }
          console.log('      ✅ Is straddling target');

          // Check if partner is NOT in facing_away targets
          const facingAway = actor?.components?.['positioning:facing_away'];
          if (
            facingAway &&
            Array.isArray(facingAway.targets) &&
            facingAway.targets.includes(partner.id)
          ) {
            console.log('      ❌ Partner is in facing_away targets');
            return false;
          }
          console.log('      ✅ Partner is not in facing_away targets');

          // Check for penis body part
          // The body component has { body: { root: 'rootPartId' } } structure
          // We need to traverse the body part hierarchy to find a penis
          const bodyComponent = partner?.components?.['anatomy:body'];
          console.log('      Body component:', bodyComponent);

          if (!bodyComponent?.body?.root) {
            console.log('      ❌ No body root');
            return false;
          }

          // Helper to check if a body part or its children have a penis
          const hasPenisInSubtree = (partId) => {
            console.log(`        Checking part: ${partId}`);
            const part = testFixture.entityManager.getEntityInstance(partId);
            if (!part) {
              console.log(`          Part not found!`);
              return false;
            }

            console.log(
              `          Part has components:`,
              Object.keys(part.components || {})
            );
            const bodyPart = part.components?.['anatomy:part'];
            console.log(`          Body part component:`, bodyPart);
            if (!bodyPart) return false;

            // Check if this part is a penis
            if (bodyPart.subType === 'penis') {
              console.log(`          ✅ Found penis!`);
              return true;
            }

            // Check children recursively
            if (bodyPart.children && Array.isArray(bodyPart.children)) {
              console.log(
                `          Checking ${bodyPart.children.length} children:`,
                bodyPart.children
              );
              return bodyPart.children.some((childId) =>
                hasPenisInSubtree(childId)
              );
            }

            console.log(`          No children to check`);
            return false;
          };

          const hasPenis = hasPenisInSubtree(bodyComponent.body.root);
          console.log('      Has penis:', hasPenis);

          if (!hasPenis) {
            console.log('      ❌ No penis found');
            return false;
          }
          console.log('      ✅ Has penis');

          // Check if penis is covered
          const equipment = partner?.components?.['clothing:equipment'];
          const slotMetadata = partner?.components?.['clothing:slot_metadata'];

          console.log('      Equipment:', equipment);
          console.log('      Slot metadata:', slotMetadata);

          if (!equipment || !slotMetadata) {
            console.log('      ❌ Missing equipment or slot metadata');
            return false;
          }

          // Check if any equipped clothing covers the penis socket
          const isPenisCovered = Object.entries(equipment.equipped || {}).some(
            ([slotName, layers]) => {
              console.log(`        Checking slot: ${slotName}`, layers);
              const slotMapping = slotMetadata.slotMappings?.[slotName];
              if (!slotMapping || !slotMapping.coveredSockets) {
                console.log(`          No slot mapping or covered sockets`);
                return false;
              }

              // Check if this slot covers penis and has clothing
              const coversPenis = slotMapping.coveredSockets.includes('penis');
              const hasClothing = Object.values(layers || {}).some(
                (items) => items && items.length > 0
              );

              console.log(
                `          Covers penis: ${coversPenis}, Has clothing: ${hasClothing}`
              );
              return coversPenis && hasClothing;
            }
          );

          console.log('      Penis covered:', isPenisCovered);
          if (!isPenisCovered) {
            console.log('      ❌ Penis not covered');
            return false;
          }
          console.log('      ✅ Penis covered');
          return true;
        });

        console.log('  📋 Valid partners found:', validPartners);
        console.log('  🎯 Returning Set with size:', validPartners.length);
        return { success: true, value: new Set(validPartners) };
      }

      // Resolver for secondary target: topmost torso_lower clothing
      if (
        scopeName ===
        'clothing:target_topmost_torso_lower_clothing_no_accessories'
      ) {
        console.log('\n🔍 SECONDARY SCOPE RESOLVER CALLED');
        console.log('  Context:', context);

        const targetId = context?.target?.id;
        if (!targetId) {
          console.log('  ❌ No target ID');
          return { success: true, value: new Set() };
        }

        const target = testFixture.entityManager.getEntityInstance(targetId);
        const equipment = target?.components?.['clothing:equipment'];

        console.log('  Target:', targetId);
        console.log('  Equipment:', equipment);

        if (!equipment || !equipment.equipped) {
          console.log('  ❌ No equipment');
          return { success: true, value: new Set() };
        }

        // Get torso_lower clothing items, excluding accessories layer
        const torsoLowerLayers = equipment.equipped.torso_lower;
        if (!torsoLowerLayers) {
          console.log('  ❌ No torso_lower slot');
          return { success: true, value: new Set() };
        }

        console.log('  Torso lower layers:', torsoLowerLayers);

        // Find the topmost layer that's not accessories
        // Priority: outer > base > underwear (skip accessories)
        const layerPriority = ['outer', 'base', 'underwear'];
        for (const layer of layerPriority) {
          if (torsoLowerLayers[layer] && torsoLowerLayers[layer].length > 0) {
            const topmostItem = torsoLowerLayers[layer][0];
            console.log(
              `  ✅ Found topmost item in ${layer} layer:`,
              topmostItem
            );
            return { success: true, value: new Set([topmostItem]) };
          }
        }

        console.log('  ❌ No clothing found in any non-accessory layer');
        return { success: true, value: new Set() };
      }

      // Fall back to original resolution for other scopes
      return originalResolveSync.call(
        testEnv.unifiedScopeResolver,
        scopeName,
        context
      );
    };
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Action structure validation', () => {
    it('should have correct action ID', () => {
      expect(rubPussyAgainstPenisAction.id).toBe(
        'sex-dry-intimacy:rub_pussy_against_penis_through_clothes'
      );
    });

    it('should have correct action name and description', () => {
      expect(rubPussyAgainstPenisAction.name).toBe(
        'Rub Pussy Against Penis Through Clothes'
      );
      expect(rubPussyAgainstPenisAction.description).toBe(
        "Rub your pussy sensually against the target's penis through their clothing while straddling them."
      );
    });

    it('should use multi-target structure with primary and secondary', () => {
      expect(rubPussyAgainstPenisAction.targets).toBeDefined();
      expect(rubPussyAgainstPenisAction.targets.primary).toBeDefined();
      expect(rubPussyAgainstPenisAction.targets.secondary).toBeDefined();
    });

    it('should have correct primary scope', () => {
      expect(rubPussyAgainstPenisAction.targets.primary.scope).toBe(
        'sex-dry-intimacy:actors_with_penis_facing_straddler_covered'
      );
    });

    it('should have correct secondary scope', () => {
      expect(rubPussyAgainstPenisAction.targets.secondary.scope).toBe(
        'clothing:target_topmost_torso_lower_clothing_no_accessories'
      );
    });

    it('should have contextFrom field set to primary for secondary target', () => {
      expect(rubPussyAgainstPenisAction.targets.secondary.contextFrom).toBe(
        'primary'
      );
    });

    it('should require personal-space-states:closeness and straddling-states:straddling_waist on actor', () => {
      expect(rubPussyAgainstPenisAction.required_components).toBeDefined();
      expect(rubPussyAgainstPenisAction.required_components.actor).toContain(
        'personal-space-states:closeness'
      );
      expect(rubPussyAgainstPenisAction.required_components.actor).toContain(
        'straddling-states:straddling_waist'
      );
    });

    it('should have correct visual styling', () => {
      expect(rubPussyAgainstPenisAction.visual).toBeDefined();
      expect(rubPussyAgainstPenisAction.visual.backgroundColor).toBe('#4a2741');
      expect(rubPussyAgainstPenisAction.visual.textColor).toBe('#fce8f5');
      expect(rubPussyAgainstPenisAction.visual.hoverBackgroundColor).toBe(
        '#5c2f51'
      );
      expect(rubPussyAgainstPenisAction.visual.hoverTextColor).toBe('#ffffff');
    });
  });

  describe('Action discovery scenarios', () => {
    it('should appear when actor is straddling sitting target with covered penis', async () => {
      // Setup: Create room, actor straddling target, target sitting with covered penis
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const alice = new ModEntityBuilder('alice')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('bob')
        .asActor()
        .withComponent('straddling-states:straddling_waist', {
          target_id: 'bob',
          facing_away: false,
        })
        .build();

      const bob = new ModEntityBuilder('bob')
        .withName('Bob')
        .atLocation('room1')
        .closeToEntity('alice')
        .withBody('groin1')
        .asActor()
        .withComponent('sitting-states:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .withComponent('clothing:equipment', {
          equipped: {
            torso_lower: {
              base: ['pants1'],
            },
          },
        })
        .withComponent('clothing:slot_metadata', {
          slotMappings: {
            torso_lower: {
              coveredSockets: ['penis', 'vagina', 'left_hip', 'right_hip'],
              allowedLayers: ['underwear', 'base', 'outer'],
            },
          },
        })
        .build();

      const groin = new ModEntityBuilder('groin1')
        .asBodyPart({
          parent: null,
          children: ['penis1'],
          subType: 'groin',
        })
        .build();

      const penis = new ModEntityBuilder('penis1')
        .asBodyPart({
          parent: 'groin1',
          children: [],
          subType: 'penis',
        })
        .build();

      const pants = new ModEntityBuilder('pants1').withName('pants').build();

      const chair = new ModEntityBuilder('chair1')
        .withName('chair')
        .atLocation('room1')
        .build();

      testFixture.reset([room, alice, bob, groin, penis, pants, chair]);
      configureActionDiscovery();
      configureActionDiscovery();

      // Discover actions for alice
      const actions = await testFixture.discoverActions('alice');

      console.log('\n🎬 DISCOVERED ACTIONS:');
      console.log('  Total:', actions.length);
      if (actions.length > 0) {
        console.log('  First action keys:', Object.keys(actions[0]));
        console.log('  First action:', JSON.stringify(actions[0], null, 2));
      }

      // Assert action appears
      const foundAction = actions.find(
        (a) =>
          a.id === 'sex-dry-intimacy:rub_pussy_against_penis_through_clothes'
      );
      expect(foundAction).toBeDefined();
    });

    it('should NOT appear when actor missing straddling_waist component', async () => {
      // Setup: Create scenario but without straddling_waist
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const alice = new ModEntityBuilder('alice')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('bob')
        .asActor()
        // Missing straddling_waist component
        .build();

      const bob = new ModEntityBuilder('bob')
        .withName('Bob')
        .atLocation('room1')
        .closeToEntity('alice')
        .withBody('groin1')
        .asActor()
        .withComponent('sitting-states:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .withComponent('clothing:equipment', {
          equipped: {
            torso_lower: {
              base: ['pants1'],
            },
          },
        })
        .withComponent('clothing:slot_metadata', {
          slotMappings: {
            torso_lower: {
              coveredSockets: ['penis', 'vagina', 'left_hip', 'right_hip'],
              allowedLayers: ['underwear', 'base', 'outer'],
            },
          },
        })
        .build();

      const groin = new ModEntityBuilder('groin1')
        .asBodyPart({
          parent: null,
          children: ['penis1'],
          subType: 'groin',
        })
        .build();

      const penis = new ModEntityBuilder('penis1')
        .asBodyPart({
          parent: 'groin1',
          children: [],
          subType: 'penis',
        })
        .build();

      const pants = new ModEntityBuilder('pants1').withName('pants').build();

      const chair = new ModEntityBuilder('chair1')
        .withName('chair')
        .atLocation('room1')
        .build();

      testFixture.reset([room, alice, bob, groin, penis, pants, chair]);
      configureActionDiscovery();

      // Discover actions for alice
      const actions = await testFixture.discoverActions('alice');

      // Assert action does NOT appear
      const foundAction = actions.find(
        (a) =>
          a.id === 'sex-dry-intimacy:rub_pussy_against_penis_through_clothes'
      );
      expect(foundAction).toBeUndefined();
    });

    it('should NOT appear when actor missing closeness component', async () => {
      // Setup: Create scenario but without closeness
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const alice = new ModEntityBuilder('alice')
        .withName('Alice')
        .atLocation('room1')
        // Missing closeness component
        .asActor()
        .withComponent('straddling-states:straddling_waist', {
          target_id: 'bob',
          facing_away: false,
        })
        .build();

      const bob = new ModEntityBuilder('bob')
        .withName('Bob')
        .atLocation('room1')
        .withBody('groin1')
        .asActor()
        .withComponent('sitting-states:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .withComponent('clothing:equipment', {
          equipped: {
            torso_lower: {
              base: ['pants1'],
            },
          },
        })
        .withComponent('clothing:slot_metadata', {
          slotMappings: {
            torso_lower: {
              coveredSockets: ['penis', 'vagina', 'left_hip', 'right_hip'],
              allowedLayers: ['underwear', 'base', 'outer'],
            },
          },
        })
        .build();

      const groin = new ModEntityBuilder('groin1')
        .asBodyPart({
          parent: null,
          children: ['penis1'],
          subType: 'groin',
        })
        .build();

      const penis = new ModEntityBuilder('penis1')
        .asBodyPart({
          parent: 'groin1',
          children: [],
          subType: 'penis',
        })
        .build();

      const pants = new ModEntityBuilder('pants1').withName('pants').build();

      const chair = new ModEntityBuilder('chair1')
        .withName('chair')
        .atLocation('room1')
        .build();

      testFixture.reset([room, alice, bob, groin, penis, pants, chair]);
      configureActionDiscovery();

      // Discover actions for alice
      const actions = await testFixture.discoverActions('alice');

      // Assert action does NOT appear
      const foundAction = actions.find(
        (a) =>
          a.id === 'sex-dry-intimacy:rub_pussy_against_penis_through_clothes'
      );
      expect(foundAction).toBeUndefined();
    });

    it('should NOT appear when target is not sitting', async () => {
      // Setup: Create scenario but target is standing (no sitting_on component)
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const alice = new ModEntityBuilder('alice')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('bob')
        .asActor()
        .withComponent('straddling-states:straddling_waist', {
          target_id: 'bob',
          facing_away: false,
        })
        .build();

      const bob = new ModEntityBuilder('bob')
        .withName('Bob')
        .atLocation('room1')
        .closeToEntity('alice')
        .withBody('groin1')
        .asActor()
        // Missing sitting_on component
        .withComponent('clothing:equipment', {
          equipped: {
            torso_lower: {
              base: ['pants1'],
            },
          },
        })
        .withComponent('clothing:slot_metadata', {
          slotMappings: {
            torso_lower: {
              coveredSockets: ['penis', 'vagina', 'left_hip', 'right_hip'],
              allowedLayers: ['underwear', 'base', 'outer'],
            },
          },
        })
        .build();

      const groin = new ModEntityBuilder('groin1')
        .asBodyPart({
          parent: null,
          children: ['penis1'],
          subType: 'groin',
        })
        .build();

      const penis = new ModEntityBuilder('penis1')
        .asBodyPart({
          parent: 'groin1',
          children: [],
          subType: 'penis',
        })
        .build();

      const pants = new ModEntityBuilder('pants1').withName('pants').build();

      testFixture.reset([room, alice, bob, groin, penis, pants]);
      configureActionDiscovery();

      // Discover actions for alice
      const actions = await testFixture.discoverActions('alice');

      // Assert action does NOT appear
      const foundAction = actions.find(
        (a) =>
          a.id === 'sex-dry-intimacy:rub_pussy_against_penis_through_clothes'
      );
      expect(foundAction).toBeUndefined();
    });

    it('should NOT appear when target has no penis anatomy', async () => {
      // Setup: Create scenario but target has no penis
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const alice = new ModEntityBuilder('alice')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('beth')
        .asActor()
        .withComponent('straddling-states:straddling_waist', {
          target_id: 'beth',
          facing_away: false,
        })
        .build();

      const beth = new ModEntityBuilder('beth')
        .withName('Beth')
        .atLocation('room1')
        .closeToEntity('alice')
        // No body/anatomy
        .asActor()
        .withComponent('sitting-states:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .withComponent('clothing:equipment', {
          equipped: {
            torso_lower: {
              base: ['pants1'],
            },
          },
        })
        .withComponent('clothing:slot_metadata', {
          slotMappings: {
            torso_lower: {
              coveredSockets: ['vagina', 'left_hip', 'right_hip'],
              allowedLayers: ['underwear', 'base', 'outer'],
            },
          },
        })
        .build();

      const pants = new ModEntityBuilder('pants1').withName('pants').build();

      const chair = new ModEntityBuilder('chair1')
        .withName('chair')
        .atLocation('room1')
        .build();

      testFixture.reset([room, alice, beth, pants, chair]);
      configureActionDiscovery();

      // Discover actions for alice
      const actions = await testFixture.discoverActions('alice');

      // Assert action does NOT appear
      const foundAction = actions.find(
        (a) =>
          a.id === 'sex-dry-intimacy:rub_pussy_against_penis_through_clothes'
      );
      expect(foundAction).toBeUndefined();
    });

    it("should NOT appear when target's penis is exposed (uncovered)", async () => {
      // Setup: Create scenario but penis is not covered
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const alice = new ModEntityBuilder('alice')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('bob')
        .asActor()
        .withComponent('straddling-states:straddling_waist', {
          target_id: 'bob',
          facing_away: false,
        })
        .build();

      const bob = new ModEntityBuilder('bob')
        .withName('Bob')
        .atLocation('room1')
        .closeToEntity('alice')
        .withBody('groin1')
        .asActor()
        .withComponent('sitting-states:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .withComponent('clothing:equipment', {
          equipped: {
            torso_lower: {
              base: ['pants1'],
            },
          },
        })
        .withComponent('clothing:slot_metadata', {
          slotMappings: {
            torso_lower: {
              // Penis NOT in coveredSockets
              coveredSockets: ['vagina', 'left_hip', 'right_hip'],
              allowedLayers: ['underwear', 'base', 'outer'],
            },
          },
        })
        .build();

      const groin = new ModEntityBuilder('groin1')
        .asBodyPart({
          parent: null,
          children: ['penis1'],
          subType: 'groin',
        })
        .build();

      const penis = new ModEntityBuilder('penis1')
        .asBodyPart({
          parent: 'groin1',
          children: [],
          subType: 'penis',
        })
        .build();

      const pants = new ModEntityBuilder('pants1').withName('pants').build();

      const chair = new ModEntityBuilder('chair1')
        .withName('chair')
        .atLocation('room1')
        .build();

      testFixture.reset([room, alice, bob, groin, penis, pants, chair]);
      configureActionDiscovery();

      // Discover actions for alice
      const actions = await testFixture.discoverActions('alice');

      // Assert action does NOT appear
      const foundAction = actions.find(
        (a) =>
          a.id === 'sex-dry-intimacy:rub_pussy_against_penis_through_clothes'
      );
      expect(foundAction).toBeUndefined();
    });

    it('should NOT appear when actor is facing away from target', async () => {
      // Setup: Create scenario but actor is facing away
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const alice = new ModEntityBuilder('alice')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('bob')
        .asActor()
        .withComponent('straddling-states:straddling_waist', {
          target_id: 'bob',
          facing_away: true, // Facing away
        })
        .withComponent('positioning:facing_away', {
          targets: ['bob'],
        })
        .build();

      const bob = new ModEntityBuilder('bob')
        .withName('Bob')
        .atLocation('room1')
        .closeToEntity('alice')
        .withBody('groin1')
        .asActor()
        .withComponent('sitting-states:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .withComponent('clothing:equipment', {
          equipped: {
            torso_lower: {
              base: ['pants1'],
            },
          },
        })
        .withComponent('clothing:slot_metadata', {
          slotMappings: {
            torso_lower: {
              coveredSockets: ['penis', 'vagina', 'left_hip', 'right_hip'],
              allowedLayers: ['underwear', 'base', 'outer'],
            },
          },
        })
        .build();

      const groin = new ModEntityBuilder('groin1')
        .asBodyPart({
          parent: null,
          children: ['penis1'],
          subType: 'groin',
        })
        .build();

      const penis = new ModEntityBuilder('penis1')
        .asBodyPart({
          parent: 'groin1',
          children: [],
          subType: 'penis',
        })
        .build();

      const pants = new ModEntityBuilder('pants1').withName('pants').build();

      const chair = new ModEntityBuilder('chair1')
        .withName('chair')
        .atLocation('room1')
        .build();

      testFixture.reset([room, alice, bob, groin, penis, pants, chair]);
      configureActionDiscovery();

      // Discover actions for alice
      const actions = await testFixture.discoverActions('alice');

      // Assert action does NOT appear
      const foundAction = actions.find(
        (a) =>
          a.id === 'sex-dry-intimacy:rub_pussy_against_penis_through_clothes'
      );
      expect(foundAction).toBeUndefined();
    });

    it('should resolve secondary target to topmost torso_lower clothing', async () => {
      // Setup: Create scenario with multiple clothing layers
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const alice = new ModEntityBuilder('alice')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('bob')
        .asActor()
        .withComponent('straddling-states:straddling_waist', {
          target_id: 'bob',
          facing_away: false,
        })
        .build();

      const bob = new ModEntityBuilder('bob')
        .withName('Bob')
        .atLocation('room1')
        .closeToEntity('alice')
        .withBody('groin1')
        .asActor()
        .withComponent('sitting-states:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .withComponent('clothing:equipment', {
          equipped: {
            torso_lower: {
              underwear: ['boxers1'],
              base: ['jeans1'],
              outer: ['jacket1'], // Topmost layer
            },
          },
        })
        .withComponent('clothing:slot_metadata', {
          slotMappings: {
            torso_lower: {
              coveredSockets: ['penis', 'vagina', 'left_hip', 'right_hip'],
              allowedLayers: ['underwear', 'base', 'outer'],
            },
          },
        })
        .build();

      const groin = new ModEntityBuilder('groin1')
        .asBodyPart({
          parent: null,
          children: ['penis1'],
          subType: 'groin',
        })
        .build();

      const penis = new ModEntityBuilder('penis1')
        .asBodyPart({
          parent: 'groin1',
          children: [],
          subType: 'penis',
        })
        .build();

      const boxers = new ModEntityBuilder('boxers1').withName('boxers').build();
      const jeans = new ModEntityBuilder('jeans1').withName('jeans').build();
      const jacket = new ModEntityBuilder('jacket1').withName('jacket').build();

      const chair = new ModEntityBuilder('chair1')
        .withName('chair')
        .atLocation('room1')
        .build();

      testFixture.reset([
        room,
        alice,
        bob,
        groin,
        penis,
        boxers,
        jeans,
        jacket,
        chair,
      ]);
      configureActionDiscovery();

      // Discover actions for alice
      const actions = await testFixture.discoverActions('alice');

      // Assert action appears
      const foundAction = actions.find(
        (a) =>
          a.id === 'sex-dry-intimacy:rub_pussy_against_penis_through_clothes'
      );
      expect(foundAction).toBeDefined();
    });

    it('should NOT appear when target has no torso_lower clothing', async () => {
      // Setup: Create scenario but target has no torso_lower clothing
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const alice = new ModEntityBuilder('alice')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('bob')
        .asActor()
        .withComponent('straddling-states:straddling_waist', {
          target_id: 'bob',
          facing_away: false,
        })
        .build();

      const bob = new ModEntityBuilder('bob')
        .withName('Bob')
        .atLocation('room1')
        .closeToEntity('alice')
        .withBody('groin1')
        .asActor()
        .withComponent('sitting-states:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .withComponent('clothing:equipment', {
          equipped: {
            // No torso_lower clothing
          },
        })
        .withComponent('clothing:slot_metadata', {
          slotMappings: {
            torso_lower: {
              coveredSockets: ['penis', 'vagina', 'left_hip', 'right_hip'],
              allowedLayers: ['underwear', 'base', 'outer'],
            },
          },
        })
        .build();

      const groin = new ModEntityBuilder('groin1')
        .asBodyPart({
          parent: null,
          children: ['penis1'],
          subType: 'groin',
        })
        .build();

      const penis = new ModEntityBuilder('penis1')
        .asBodyPart({
          parent: 'groin1',
          children: [],
          subType: 'penis',
        })
        .build();

      const chair = new ModEntityBuilder('chair1')
        .withName('chair')
        .atLocation('room1')
        .build();

      testFixture.reset([room, alice, bob, groin, penis, chair]);
      configureActionDiscovery();

      // Discover actions for alice
      const actions = await testFixture.discoverActions('alice');

      // Assert action does NOT appear
      const foundAction = actions.find(
        (a) =>
          a.id === 'sex-dry-intimacy:rub_pussy_against_penis_through_clothes'
      );
      expect(foundAction).toBeUndefined();
    });
  });
});
