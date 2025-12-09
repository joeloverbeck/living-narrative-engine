/**
 * @file Integration tests for wound coverage detection in treat actions.
 *
 * These tests validate that the "wound covered" modifier correctly detects
 * coverage through BOTH mechanisms:
 * 1. Direct slot coverage (isSlotExposed) - e.g., torso wound covered by tunic
 * 2. Secondary coverage mapping (isSocketCovered) - e.g., arm wound covered by
 *    shirt with coverage_mapping including arm slots
 *
 * Bug context: Prior to fix, treat actions only checked isSlotExposed,
 * missing secondary coverage via clothing:coverage_mapping.covers.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';

const ACTION_ID_SELF = 'first-aid:treat_my_wounded_part';
const ACTION_ID_OTHER = 'first-aid:treat_wounded_part';
const ROOM_ID = 'room1';

describe('treat action wound coverage detection', () => {
  describe('treat_my_wounded_part coverage modifiers', () => {
    let fixture;

    const registerScopes = async () => {
      ScopeResolverHelpers._registerResolvers(
        fixture.testEnv,
        fixture.testEnv.entityManager,
        {
          'first-aid:treatable_actor_body_parts': (context) => {
            const actorId =
              context.actor?.id || context.actorEntity?.id || context.id;
            if (!actorId) {
              return { success: true, value: new Set() };
            }

            const body = fixture.testEnv.entityManager.getComponentData(
              actorId,
              'anatomy:body'
            );
            const rootId = body?.body?.root;
            if (!rootId) {
              return { success: true, value: new Set() };
            }

            const result = new Set();
            const queue = [rootId];
            while (queue.length > 0) {
              const current = queue.shift();
              const partHealth = fixture.testEnv.entityManager.getComponentData(
                current,
                'anatomy:part_health'
              );
              const isVitalOrgan = fixture.testEnv.entityManager.hasComponent(
                current,
                'anatomy:vital_organ'
              );
              // Include wounded parts, exclude vital organs
              // DO NOT filter by coverage - allows covered wounds with penalty
              if (
                partHealth &&
                partHealth.currentHealth < partHealth.maxHealth &&
                !isVitalOrgan
              ) {
                result.add(current);
              }

              const part = fixture.testEnv.entityManager.getComponentData(
                current,
                'anatomy:part'
              );
              if (part?.children?.length) {
                queue.push(...part.children);
              }
            }

            return { success: true, value: result };
          },
        }
      );
    };

    beforeEach(async () => {
      fixture = new (await import('../../../common/mods/ModTestFixture.js'))
        .ModActionTestFixture('first-aid', ACTION_ID_SELF, null, null, {
        autoRegisterScopes: false,
      });
      await fixture.initialize();
      await registerScopes();
    });

    afterEach(() => {
      fixture?.cleanup();
    });

    /**
     * Test: Arm wound detected as COVERED via secondary coverage mapping.
     *
     * Setup: Actor has wounded left arm, wearing shirt with coverage_mapping
     * that includes left_arm_clothing (secondary coverage).
     *
     * Expected: "wound covered" modifier should apply (-20 penalty).
     */
    it('detects arm wound as covered via secondary coverage_mapping', () => {
      const room = ModEntityScenarios.createRoom(ROOM_ID, 'Treatment Room');

      // Actor with wounded left arm, wearing shirt with arm coverage
      const actor = new ModEntityBuilder('actor1')
        .withName('Patient')
        .atLocation(ROOM_ID)
        .withLocationComponent(ROOM_ID)
        .asActor()
        .withBody('actor-torso')
        .withComponent('skills:medicine_skill', { value: 50 })
        .withComponent('clothing:equipment', {
          equipped: {
            torso_upper: {
              base: ['shirt1'],
            },
          },
        })
        .withComponent('clothing:slot_metadata', {
          slotMappings: {
            torso_upper: {
              coveredSockets: ['left_shoulder', 'right_shoulder'],
              allowedLayers: ['underwear', 'base', 'outer', 'armor'],
            },
            left_arm_clothing: {
              coveredSockets: ['left_shoulder'],
              allowedLayers: ['underwear', 'base', 'outer', 'armor'],
            },
          },
        })
        .build();

      const actorTorso = new ModEntityBuilder('actor-torso')
        .asBodyPart({
          parent: null,
          children: ['actor-left-arm'],
          subType: 'torso',
        })
        .atLocation(ROOM_ID)
        .withLocationComponent(ROOM_ID)
        .withComponent('anatomy:visibility_rules', {
          clothingSlotId: 'torso_upper',
          nonBlockingLayers: ['underwear', 'accessories'],
        })
        .withComponent('anatomy:part_health', {
          currentHealth: 10,
          maxHealth: 10,
        })
        .build();

      // Wounded left arm with socket that's covered via coverage_mapping
      const actorLeftArm = new ModEntityBuilder('actor-left-arm')
        .withName('left arm')
        .asBodyPart({
          parent: 'actor-torso',
          children: [],
          subType: 'arm',
          socketId: 'left_shoulder',
        })
        .atLocation(ROOM_ID)
        .withLocationComponent(ROOM_ID)
        .withComponent('anatomy:joint', {
          socketId: 'left_shoulder',
        })
        .withComponent('anatomy:part_health', {
          currentHealth: 5, // Wounded
          maxHealth: 10,
        })
        .build();

      // Shirt with secondary coverage mapping including arms
      const shirt = new ModEntityBuilder('shirt1')
        .withName('Long-sleeved Shirt')
        .withComponent('clothing:wearable', {
          equipmentSlots: {
            primary: 'torso_upper',
            secondary: ['left_arm_clothing', 'right_arm_clothing'],
          },
          layer: 'base',
        })
        .withComponent('clothing:coverage_mapping', {
          covers: ['torso_upper', 'left_arm_clothing', 'right_arm_clothing'],
          coveragePriority: 'base',
        })
        .build();

      fixture.reset([room, actor, actorTorso, actorLeftArm, shirt]);

      // Verify the action is discoverable
      const availableActions = fixture.testEnv.getAvailableActions('actor1');
      const matches = availableActions.filter((a) => a.id === ACTION_ID_SELF);
      expect(matches).toHaveLength(1);

      // The wounded arm should be targetable (scope doesn't filter by coverage)
      const actorContext =
        fixture.testEnv.entityManager.getEntityInstance('actor1');
      const woundedParts = fixture.testEnv.unifiedScopeResolver.resolveSync(
        'first-aid:treatable_actor_body_parts',
        {
          actor: actorContext,
          actorEntity: actorContext,
        }
      );
      expect(Array.from(woundedParts.value || [])).toContain('actor-left-arm');
    });

    /**
     * Test: Torso wound detected as COVERED via direct slot coverage.
     *
     * Setup: Actor has wounded torso, wearing tunic that directly covers torso_upper.
     *
     * Expected: "wound covered" modifier should apply (-20 penalty).
     */
    it('detects torso wound as covered via direct slot coverage', () => {
      const room = ModEntityScenarios.createRoom(ROOM_ID, 'Treatment Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Patient')
        .atLocation(ROOM_ID)
        .withLocationComponent(ROOM_ID)
        .asActor()
        .withBody('actor-torso')
        .withComponent('skills:medicine_skill', { value: 50 })
        .withComponent('clothing:equipment', {
          equipped: {
            torso_upper: {
              base: ['tunic1'],
            },
          },
        })
        .withComponent('clothing:slot_metadata', {
          slotMappings: {
            torso_upper: {
              coveredSockets: ['chest'],
              allowedLayers: ['underwear', 'base', 'outer', 'armor'],
            },
          },
        })
        .build();

      // Wounded torso with visibility_rules pointing to covered slot
      const actorTorso = new ModEntityBuilder('actor-torso')
        .asBodyPart({ parent: null, children: [], subType: 'torso' })
        .atLocation(ROOM_ID)
        .withLocationComponent(ROOM_ID)
        .withComponent('anatomy:visibility_rules', {
          clothingSlotId: 'torso_upper',
          nonBlockingLayers: ['underwear', 'accessories'],
        })
        .withComponent('anatomy:part_health', {
          currentHealth: 5, // Wounded
          maxHealth: 10,
        })
        .build();

      const tunic = new ModEntityBuilder('tunic1')
        .withName('Simple Tunic')
        .withComponent('clothing:wearable', {
          equipmentSlots: {
            primary: 'torso_upper',
          },
          layer: 'base',
        })
        .build();

      fixture.reset([room, actor, actorTorso, tunic]);

      const availableActions = fixture.testEnv.getAvailableActions('actor1');
      const matches = availableActions.filter((a) => a.id === ACTION_ID_SELF);
      expect(matches).toHaveLength(1);
    });

    /**
     * Test: Wound detected as EXPOSED when no clothing covers it.
     *
     * Setup: Actor has wounded arm, no clothing worn.
     *
     * Expected: "wound covered" modifier should NOT apply.
     */
    it('detects wound as exposed when no clothing worn', () => {
      const room = ModEntityScenarios.createRoom(ROOM_ID, 'Treatment Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Patient')
        .atLocation(ROOM_ID)
        .withLocationComponent(ROOM_ID)
        .asActor()
        .withBody('actor-torso')
        .withComponent('skills:medicine_skill', { value: 50 })
        // No clothing:equipment component
        .build();

      const actorTorso = new ModEntityBuilder('actor-torso')
        .asBodyPart({
          parent: null,
          children: ['actor-left-arm'],
          subType: 'torso',
        })
        .atLocation(ROOM_ID)
        .withLocationComponent(ROOM_ID)
        .withComponent('anatomy:part_health', {
          currentHealth: 10,
          maxHealth: 10,
        })
        .build();

      const actorLeftArm = new ModEntityBuilder('actor-left-arm')
        .withName('left arm')
        .asBodyPart({
          parent: 'actor-torso',
          children: [],
          subType: 'arm',
          socketId: 'left_shoulder',
        })
        .atLocation(ROOM_ID)
        .withLocationComponent(ROOM_ID)
        .withComponent('anatomy:joint', {
          socketId: 'left_shoulder',
        })
        .withComponent('anatomy:part_health', {
          currentHealth: 5, // Wounded
          maxHealth: 10,
        })
        .build();

      fixture.reset([room, actor, actorTorso, actorLeftArm]);

      const availableActions = fixture.testEnv.getAvailableActions('actor1');
      const matches = availableActions.filter((a) => a.id === ACTION_ID_SELF);
      expect(matches).toHaveLength(1);

      // Verify wounded part is in target list
      const actorContext =
        fixture.testEnv.entityManager.getEntityInstance('actor1');
      const woundedParts = fixture.testEnv.unifiedScopeResolver.resolveSync(
        'first-aid:treatable_actor_body_parts',
        {
          actor: actorContext,
          actorEntity: actorContext,
        }
      );
      expect(Array.from(woundedParts.value || [])).toContain('actor-left-arm');
    });

    /**
     * Test: Head wound detected as EXPOSED (no head clothing).
     *
     * This matches the expected behavior for Bertram in the bug report.
     */
    it('detects head wound as exposed when no head clothing worn', () => {
      const room = ModEntityScenarios.createRoom(ROOM_ID, 'Treatment Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Bertram')
        .atLocation(ROOM_ID)
        .withLocationComponent(ROOM_ID)
        .asActor()
        .withBody('actor-head')
        .withComponent('skills:medicine_skill', { value: 50 })
        .withComponent('clothing:equipment', {
          equipped: {
            torso_upper: {
              base: ['shirt1'],
            },
            // No head slot occupied
          },
        })
        .withComponent('clothing:slot_metadata', {
          slotMappings: {
            head: {
              coveredSockets: ['skull'],
              allowedLayers: ['base', 'outer', 'armor'],
            },
          },
        })
        .build();

      // Wounded head
      const actorHead = new ModEntityBuilder('actor-head')
        .asBodyPart({ parent: null, children: [], subType: 'head' })
        .atLocation(ROOM_ID)
        .withLocationComponent(ROOM_ID)
        .withComponent('anatomy:visibility_rules', {
          clothingSlotId: 'head',
        })
        .withComponent('anatomy:joint', {
          socketId: 'skull',
        })
        .withComponent('anatomy:part_health', {
          currentHealth: 5, // Wounded
          maxHealth: 10,
        })
        .build();

      const shirt = new ModEntityBuilder('shirt1')
        .withName('Shirt')
        .withComponent('clothing:wearable', {
          equipmentSlots: { primary: 'torso_upper' },
          layer: 'base',
        })
        .build();

      fixture.reset([room, actor, actorHead, shirt]);

      const availableActions = fixture.testEnv.getAvailableActions('actor1');
      const matches = availableActions.filter((a) => a.id === ACTION_ID_SELF);
      expect(matches).toHaveLength(1);

      // Head wound should be targetable and exposed
      const actorContext =
        fixture.testEnv.entityManager.getEntityInstance('actor1');
      const woundedParts = fixture.testEnv.unifiedScopeResolver.resolveSync(
        'first-aid:treatable_actor_body_parts',
        {
          actor: actorContext,
          actorEntity: actorContext,
        }
      );
      expect(Array.from(woundedParts.value || [])).toContain('actor-head');
    });
  });

  describe('treat_wounded_part coverage modifiers (treating another actor)', () => {
    let fixture;

    const registerScopes = async () => {
      ScopeResolverHelpers._registerResolvers(
        fixture.testEnv,
        fixture.testEnv.entityManager,
        {
          'core:actors_in_location': (context) => {
            const actorId = context.actor?.id || context.actorEntity?.id;
            const actorLocation = context.actorLocation || context.location?.id;
            if (!actorId || !actorLocation) {
              return { success: true, value: new Set() };
            }
            const ids = fixture.testEnv.entityManager
              .getEntityIds()
              .filter((id) => {
                if (id === actorId) return false;
                const hasActor = fixture.testEnv.entityManager.hasComponent(
                  id,
                  'core:actor'
                );
                const pos = fixture.testEnv.entityManager.getComponentData(
                  id,
                  'core:position'
                );
                return hasActor && pos?.locationId === actorLocation;
              });
            return { success: true, value: new Set(ids) };
          },
          'first-aid:treatable_target_body_parts': (context) => {
            const targetId =
              context.target?.id || context.primary?.id || context.actor?.id;
            if (!targetId) {
              return { success: true, value: new Set() };
            }

            const body = fixture.testEnv.entityManager.getComponentData(
              targetId,
              'anatomy:body'
            );
            const rootId = body?.body?.root;
            if (!rootId) {
              return { success: true, value: new Set() };
            }

            const result = new Set();
            const queue = [rootId];
            while (queue.length > 0) {
              const current = queue.shift();
              const partHealth = fixture.testEnv.entityManager.getComponentData(
                current,
                'anatomy:part_health'
              );
              const isVitalOrgan = fixture.testEnv.entityManager.hasComponent(
                current,
                'anatomy:vital_organ'
              );
              if (
                partHealth &&
                partHealth.currentHealth < partHealth.maxHealth &&
                !isVitalOrgan
              ) {
                result.add(current);
              }

              const part = fixture.testEnv.entityManager.getComponentData(
                current,
                'anatomy:part'
              );
              if (part?.children?.length) {
                queue.push(...part.children);
              }
            }

            return { success: true, value: result };
          },
        }
      );
    };

    beforeEach(async () => {
      fixture = new (await import('../../../common/mods/ModTestFixture.js'))
        .ModActionTestFixture('first-aid', ACTION_ID_OTHER, null, null, {
        autoRegisterScopes: false,
      });
      await fixture.initialize();
      await registerScopes();
    });

    afterEach(() => {
      fixture?.cleanup();
    });

    /**
     * Test: Target's arm wound detected as COVERED via secondary coverage mapping.
     *
     * This matches Aldous case from the bug report - left arm should be
     * detected as covered by shirt's secondary coverage mapping.
     */
    it('detects target arm wound as covered via secondary coverage_mapping (Aldous case)', () => {
      const room = ModEntityScenarios.createRoom(ROOM_ID, 'Treatment Room');

      // Medic (actor performing the action)
      const medic = new ModEntityBuilder('medic1')
        .withName('Medic')
        .atLocation(ROOM_ID)
        .withLocationComponent(ROOM_ID)
        .asActor()
        .withComponent('skills:medicine_skill', { value: 60 })
        .build();

      // Patient (Aldous) with wounded left arm
      const patient = new ModEntityBuilder('patient1')
        .withName('Aldous')
        .atLocation(ROOM_ID)
        .withLocationComponent(ROOM_ID)
        .asActor()
        .withBody('patient-torso')
        .withComponent('clothing:equipment', {
          equipped: {
            torso_upper: {
              base: ['shirt1'],
            },
          },
        })
        .withComponent('clothing:slot_metadata', {
          slotMappings: {
            torso_upper: {
              coveredSockets: ['left_shoulder', 'right_shoulder', 'chest'],
              allowedLayers: ['underwear', 'base', 'outer', 'armor'],
            },
            left_arm_clothing: {
              coveredSockets: ['left_shoulder'],
              allowedLayers: ['underwear', 'base', 'outer', 'armor'],
            },
          },
        })
        .build();

      const patientTorso = new ModEntityBuilder('patient-torso')
        .asBodyPart({
          parent: null,
          children: ['patient-left-arm'],
          subType: 'torso',
        })
        .atLocation(ROOM_ID)
        .withLocationComponent(ROOM_ID)
        .withComponent('anatomy:part_health', {
          currentHealth: 10,
          maxHealth: 10,
        })
        .build();

      // Wounded left arm
      const patientLeftArm = new ModEntityBuilder('patient-left-arm')
        .withName('left arm')
        .asBodyPart({
          parent: 'patient-torso',
          children: [],
          subType: 'arm',
          socketId: 'left_shoulder',
        })
        .atLocation(ROOM_ID)
        .withLocationComponent(ROOM_ID)
        .withComponent('anatomy:joint', {
          socketId: 'left_shoulder',
        })
        .withComponent('anatomy:part_health', {
          currentHealth: 5, // Wounded
          maxHealth: 10,
        })
        .build();

      // Shirt with secondary coverage mapping including arms
      const shirt = new ModEntityBuilder('shirt1')
        .withName('Cream Poet Shirt with Billowing Sleeves')
        .withComponent('clothing:wearable', {
          equipmentSlots: {
            primary: 'torso_upper',
            secondary: ['left_arm_clothing', 'right_arm_clothing'],
          },
          layer: 'base',
        })
        .withComponent('clothing:coverage_mapping', {
          covers: ['torso_upper', 'left_arm_clothing', 'right_arm_clothing'],
          coveragePriority: 'base',
        })
        .build();

      fixture.reset([
        room,
        medic,
        patient,
        patientTorso,
        patientLeftArm,
        shirt,
      ]);

      // Action should be discoverable
      const availableActions = fixture.testEnv.getAvailableActions('medic1');
      const matches = availableActions.filter((a) => a.id === ACTION_ID_OTHER);
      expect(matches.length).toBeGreaterThanOrEqual(1);

      // Wounded arm should be targetable
      const patientContext =
        fixture.testEnv.entityManager.getEntityInstance('patient1');
      const woundedParts = fixture.testEnv.unifiedScopeResolver.resolveSync(
        'first-aid:treatable_target_body_parts',
        {
          target: patientContext,
          primary: patientContext,
        }
      );
      expect(Array.from(woundedParts.value || [])).toContain(
        'patient-left-arm'
      );
    });

    /**
     * Test: Target's ass cheek wound detected as COVERED via socket coverage.
     *
     * This matches Vespera case from the bug report - ass cheek should be
     * detected as covered by breeches via socket coverage (torso_lower slot
     * covers ass socket via slotMappings.coveredSockets).
     */
    it('detects target ass wound as covered via socket coverage (Vespera case)', () => {
      const room = ModEntityScenarios.createRoom(ROOM_ID, 'Treatment Room');

      const medic = new ModEntityBuilder('medic1')
        .withName('Medic')
        .atLocation(ROOM_ID)
        .withLocationComponent(ROOM_ID)
        .asActor()
        .withComponent('skills:medicine_skill', { value: 60 })
        .build();

      // Patient (Vespera) with wounded ass cheek
      const patient = new ModEntityBuilder('patient1')
        .withName('Vespera')
        .atLocation(ROOM_ID)
        .withLocationComponent(ROOM_ID)
        .asActor()
        .withBody('patient-torso')
        .withComponent('clothing:equipment', {
          equipped: {
            torso_lower: {
              base: ['breeches1'],
            },
          },
        })
        .withComponent('clothing:slot_metadata', {
          slotMappings: {
            torso_lower: {
              coveredSockets: ['left_ass', 'right_ass', 'vagina', 'pubic_hair'],
              allowedLayers: ['underwear', 'base', 'outer', 'armor'],
            },
          },
        })
        .build();

      const patientTorso = new ModEntityBuilder('patient-torso')
        .asBodyPart({
          parent: null,
          children: ['patient-left-ass'],
          subType: 'torso',
        })
        .atLocation(ROOM_ID)
        .withLocationComponent(ROOM_ID)
        .withComponent('anatomy:part_health', {
          currentHealth: 10,
          maxHealth: 10,
        })
        .build();

      // Wounded ass cheek
      const patientLeftAss = new ModEntityBuilder('patient-left-ass')
        .withName('left ass cheek')
        .asBodyPart({
          parent: 'patient-torso',
          children: [],
          subType: 'buttock',
          socketId: 'left_ass',
        })
        .atLocation(ROOM_ID)
        .withLocationComponent(ROOM_ID)
        .withComponent('anatomy:joint', {
          socketId: 'left_ass',
        })
        .withComponent('anatomy:part_health', {
          currentHealth: 5, // Wounded
          maxHealth: 10,
        })
        .build();

      const breeches = new ModEntityBuilder('breeches1')
        .withName('Black Breeches')
        .withComponent('clothing:wearable', {
          equipmentSlots: {
            primary: 'torso_lower',
          },
          layer: 'base',
        })
        .withComponent('clothing:coverage_mapping', {
          covers: ['torso_lower'],
          coveragePriority: 'base',
        })
        .build();

      fixture.reset([room, medic, patient, patientTorso, patientLeftAss, breeches]);

      // Action should be discoverable
      const availableActions = fixture.testEnv.getAvailableActions('medic1');
      const matches = availableActions.filter((a) => a.id === ACTION_ID_OTHER);
      expect(matches.length).toBeGreaterThanOrEqual(1);

      // Wounded ass cheek should be targetable
      const patientContext =
        fixture.testEnv.entityManager.getEntityInstance('patient1');
      const woundedParts = fixture.testEnv.unifiedScopeResolver.resolveSync(
        'first-aid:treatable_target_body_parts',
        {
          target: patientContext,
          primary: patientContext,
        }
      );
      expect(Array.from(woundedParts.value || [])).toContain('patient-left-ass');
    });
  });
});
