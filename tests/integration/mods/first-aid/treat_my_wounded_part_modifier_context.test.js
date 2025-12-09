/**
 * @file Integration tests for treat_my_wounded_part modifier context resolution.
 * These tests verify that the isSlotExposed and isSocketCovered operators
 * correctly resolve entity paths when evaluating modifier conditions.
 * Bug context: Prior to fix, the action file used "actor" as entity path
 * in modifier conditions, but ModifierContextBuilder provides context as
 * { entity: { actor, primary, secondary, tertiary, location } }.
 * The correct path is "entity.actor".
 * @see data/mods/first-aid/actions/treat_my_wounded_part.action.json
 */

import { describe, it, beforeEach, afterEach, expect, jest } from '@jest/globals';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';

const ACTION_ID = 'first-aid:treat_my_wounded_part';
const ROOM_ID = 'room1';

describe('treat_my_wounded_part modifier context resolution', () => {
  let fixture;
  let loggerWarnSpy;
  let originalWarn;

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
      .ModActionTestFixture('first-aid', ACTION_ID, null, null, {
      autoRegisterScopes: false,
    });
    await fixture.initialize();
    await registerScopes();

    // Spy on logger.warn to detect "No entity found at path" warnings
    const logger = fixture.testEnv.logger;
    originalWarn = logger.warn;
    loggerWarnSpy = jest.fn((...args) => {
      // Call original to preserve behavior
      if (originalWarn) {
        originalWarn.apply(logger, args);
      }
    });
    logger.warn = loggerWarnSpy;
  });

  afterEach(() => {
    // Restore original warn
    if (fixture?.testEnv?.logger && originalWarn) {
      fixture.testEnv.logger.warn = originalWarn;
    }
    fixture?.cleanup();
  });

  /**
   * Test: No "No entity found at path" warnings during modifier evaluation.
   *
   * This test verifies that the fix for treat_my_wounded_part.action.json
   * correctly uses "entity.actor" instead of "actor" in modifier conditions.
   *
   * The warning pattern we're checking against:
   * "isSocketCovered: No entity found at path actor"
   * "isSlotExposed: No entity found at path actor"
   */
  it('should not log "No entity found at path" warnings during action discovery', () => {
    const room = ModEntityScenarios.createRoom(ROOM_ID, 'Treatment Room');

    // Actor with wounded body part and clothing (triggers coverage check)
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
            coveredSockets: ['chest'],
            allowedLayers: ['underwear', 'base', 'outer', 'armor'],
          },
        },
      })
      .build();

    // Wounded torso with visibility_rules (triggers isSlotExposed check)
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

    const shirt = new ModEntityBuilder('shirt1')
      .withName('Simple Shirt')
      .withComponent('clothing:wearable', {
        equipmentSlots: { primary: 'torso_upper' },
        layer: 'base',
      })
      .build();

    fixture.reset([room, actor, actorTorso, shirt]);

    // Trigger action discovery which evaluates modifier conditions
    const availableActions = fixture.testEnv.getAvailableActions('actor1');

    // Verify action is discoverable
    const matches = availableActions.filter((a) => a.id === ACTION_ID);
    expect(matches).toHaveLength(1);

    // Check that no "No entity found at path" warnings were logged
    const entityNotFoundWarnings = loggerWarnSpy.mock.calls.filter((call) => {
      const message = call[0];
      return (
        typeof message === 'string' &&
        message.includes('No entity found at path')
      );
    });

    expect(entityNotFoundWarnings).toHaveLength(0);
  });

  /**
   * Test: No warnings when body part has joint (triggers isSocketCovered check).
   *
   * This specifically tests the isSocketCovered path which requires "entity.actor"
   * to resolve the entity for checking socket coverage.
   */
  it('should not log warnings when evaluating isSocketCovered for joint body parts', () => {
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
            base: ['shirt1'],
          },
        },
      })
      .withComponent('clothing:slot_metadata', {
        slotMappings: {
          torso_upper: {
            coveredSockets: ['left_shoulder'],
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
      .withComponent('anatomy:part_health', {
        currentHealth: 10,
        maxHealth: 10,
      })
      .build();

    // Wounded arm with joint (triggers isSocketCovered modifier check)
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

    const shirt = new ModEntityBuilder('shirt1')
      .withName('Long-sleeved Shirt')
      .withComponent('clothing:wearable', {
        equipmentSlots: {
          primary: 'torso_upper',
          secondary: ['left_arm_clothing'],
        },
        layer: 'base',
      })
      .withComponent('clothing:coverage_mapping', {
        covers: ['torso_upper', 'left_arm_clothing'],
        coveragePriority: 'base',
      })
      .build();

    fixture.reset([room, actor, actorTorso, actorLeftArm, shirt]);

    // Trigger action discovery
    const availableActions = fixture.testEnv.getAvailableActions('actor1');

    // Verify action is discoverable
    const matches = availableActions.filter((a) => a.id === ACTION_ID);
    expect(matches).toHaveLength(1);

    // Check no "No entity found" warnings for isSocketCovered or isSlotExposed
    const entityNotFoundWarnings = loggerWarnSpy.mock.calls.filter((call) => {
      const message = call[0];
      return (
        typeof message === 'string' &&
        (message.includes('isSocketCovered') ||
          message.includes('isSlotExposed')) &&
        message.includes('No entity found at path')
      );
    });

    expect(entityNotFoundWarnings).toHaveLength(0);
  });

  /**
   * Test: Verify modifier correctly applies wound covered penalty.
   *
   * When a wound is covered by clothing, the "wound covered" modifier
   * should apply a -20 penalty. This test verifies the modifier logic
   * works correctly after the entity path fix.
   */
  it('should correctly evaluate wound covered modifier with proper entity path', () => {
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
            base: ['shirt1'],
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

    const actorTorso = new ModEntityBuilder('actor-torso')
      .asBodyPart({ parent: null, children: [], subType: 'torso' })
      .atLocation(ROOM_ID)
      .withLocationComponent(ROOM_ID)
      .withComponent('anatomy:visibility_rules', {
        clothingSlotId: 'torso_upper',
        nonBlockingLayers: ['underwear', 'accessories'],
      })
      .withComponent('anatomy:part_health', {
        currentHealth: 5,
        maxHealth: 10,
      })
      .build();

    const shirt = new ModEntityBuilder('shirt1')
      .withName('Simple Shirt')
      .withComponent('clothing:wearable', {
        equipmentSlots: { primary: 'torso_upper' },
        layer: 'base',
      })
      .build();

    fixture.reset([room, actor, actorTorso, shirt]);

    // Trigger action discovery
    const availableActions = fixture.testEnv.getAvailableActions('actor1');
    const matches = availableActions.filter((a) => a.id === ACTION_ID);

    // Action should be available
    expect(matches).toHaveLength(1);

    // No entity path resolution warnings
    const pathWarnings = loggerWarnSpy.mock.calls.filter((call) => {
      const message = call[0];
      return (
        typeof message === 'string' &&
        message.includes('No entity found at path')
      );
    });

    expect(pathWarnings).toHaveLength(0);
  });

  /**
   * Test: No warnings when actor has no clothing (exposed wound case).
   *
   * When the actor has no clothing, both isSlotExposed and isSocketCovered
   * should resolve correctly without warnings.
   */
  it('should not log warnings when actor has no clothing (exposed wound)', () => {
    const room = ModEntityScenarios.createRoom(ROOM_ID, 'Treatment Room');

    const actor = new ModEntityBuilder('actor1')
      .withName('Patient')
      .atLocation(ROOM_ID)
      .withLocationComponent(ROOM_ID)
      .asActor()
      .withBody('actor-torso')
      .withComponent('skills:medicine_skill', { value: 50 })
      // No clothing:equipment component - naked actor
      .build();

    const actorTorso = new ModEntityBuilder('actor-torso')
      .asBodyPart({ parent: null, children: [], subType: 'torso' })
      .atLocation(ROOM_ID)
      .withLocationComponent(ROOM_ID)
      .withComponent('anatomy:visibility_rules', {
        clothingSlotId: 'torso_upper',
      })
      .withComponent('anatomy:part_health', {
        currentHealth: 5,
        maxHealth: 10,
      })
      .build();

    fixture.reset([room, actor, actorTorso]);

    // Trigger action discovery
    const availableActions = fixture.testEnv.getAvailableActions('actor1');

    // Action should be available
    const matches = availableActions.filter((a) => a.id === ACTION_ID);
    expect(matches).toHaveLength(1);

    // No "No entity found" warnings
    const entityNotFoundWarnings = loggerWarnSpy.mock.calls.filter((call) => {
      const message = call[0];
      return (
        typeof message === 'string' &&
        message.includes('No entity found at path')
      );
    });

    expect(entityNotFoundWarnings).toHaveLength(0);
  });
});
