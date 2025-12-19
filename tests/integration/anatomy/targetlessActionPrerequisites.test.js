import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../common/mods/ModEntityBuilder.js';

describe('Targetless Actions - Prerequisite Evaluation', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction(
      'seduction',
      'seduction:squeeze_breasts_draw_attention'
    );
    fixture.suppressHints();
  });

  afterEach(() => {
    fixture.cleanup();
  });

  describe('Actor-based Prerequisites', () => {
    it('should discover action when actor has required anatomy (targets: "none")', () => {
      // Arrange - Create actor with breast anatomy using separate entities
      const actorId = 'actor-with-breasts';
      const torsoId = `${actorId}_torso`;
      const leftBreastId = `${actorId}_left_breast`;
      const rightBreastId = `${actorId}_right_breast`;

      const room = ModEntityScenarios.createRoom('test-room', 'Test Room');

      const actor = new ModEntityBuilder(actorId)
        .withName('Test Actor')
        .asActor()
        .atLocation('test-room')
        .withLocationComponent('test-room')
        .withBody(torsoId) // anatomy:body references root part
        .build();

      // Body parts are separate entities with anatomy:part component
      const torso = new ModEntityBuilder(torsoId)
        .asBodyPart({
          parent: null, // Root part
          children: [leftBreastId, rightBreastId],
          subType: 'torso',
        })
        .build();

      const leftBreast = new ModEntityBuilder(leftBreastId)
        .asBodyPart({
          parent: torsoId,
          children: [],
          subType: 'breast', // hasPartOfType checks subType
        })
        .build();

      const rightBreast = new ModEntityBuilder(rightBreastId)
        .asBodyPart({
          parent: torsoId,
          children: [],
          subType: 'breast',
        })
        .build();

      // Create another actor at same location (required for hasOtherActorsAtLocation)
      const otherActor = new ModEntityBuilder('other-actor')
        .withName('Other Person')
        .asActor()
        .atLocation('test-room')
        .withLocationComponent('test-room')
        .build();

      fixture.reset([room, actor, torso, leftBreast, rightBreast, otherActor]);

      // Act
      const actions = fixture.discoverActions(actorId);

      // Assert
      expect(actions).toContainEqual(
        expect.objectContaining({
          id: 'seduction:squeeze_breasts_draw_attention',
        })
      );
    });

    it('should NOT discover action when actor lacks required anatomy', () => {
      // Arrange - Actor with torso but no breasts
      const actorId = 'actor-no-breasts';
      const torsoId = `${actorId}_torso`;

      const room = ModEntityScenarios.createRoom('test-room', 'Test Room');

      const actor = new ModEntityBuilder(actorId)
        .withName('Test Actor')
        .asActor()
        .atLocation('test-room')
        .withLocationComponent('test-room')
        .withBody(torsoId)
        .build();

      const torso = new ModEntityBuilder(torsoId)
        .asBodyPart({
          parent: null,
          children: [], // No breast parts
          subType: 'torso',
        })
        .build();

      const otherActor = new ModEntityBuilder('other-actor')
        .withName('Other Person')
        .asActor()
        .atLocation('test-room')
        .withLocationComponent('test-room')
        .build();

      fixture.reset([room, actor, torso, otherActor]);

      // Act
      const actions = fixture.discoverActions(actorId);

      // Assert - Action should not be discovered (missing breast anatomy)
      expect(actions).not.toContainEqual(
        expect.objectContaining({
          id: 'seduction:squeeze_breasts_draw_attention',
        })
      );
    });

    it('should respect clothing coverage prerequisites (isSocketCovered)', () => {
      // Arrange - Actor with breasts but both covered
      const actorId = 'actor-covered';
      const torsoId = `${actorId}_torso`;
      const leftBreastId = `${actorId}_left_breast`;
      const rightBreastId = `${actorId}_right_breast`;
      const shirtId = 'covering-shirt';

      const room = ModEntityScenarios.createRoom('test-room', 'Test Room');

      const actor = new ModEntityBuilder(actorId)
        .withName('Covered Actor')
        .asActor()
        .atLocation('test-room')
        .withLocationComponent('test-room')
        .withBody(torsoId)
        .withComponent('clothing:equipment', {
          equipped: {
            torso_upper: { base: [shirtId] },
          },
        })
        .withComponent('clothing:slot_metadata', {
          slotMappings: {
            torso_upper: {
              coveredSockets: ['left_chest', 'right_chest'], // Both breasts covered
              allowedLayers: ['base', 'outer'],
            },
          },
        })
        .build();

      const torso = new ModEntityBuilder(torsoId)
        .asBodyPart({
          parent: null,
          children: [leftBreastId, rightBreastId],
          subType: 'torso',
        })
        .build();

      const leftBreast = new ModEntityBuilder(leftBreastId)
        .asBodyPart({ parent: torsoId, children: [], subType: 'breast' })
        .build();

      const rightBreast = new ModEntityBuilder(rightBreastId)
        .asBodyPart({ parent: torsoId, children: [], subType: 'breast' })
        .build();

      const shirt = new ModEntityBuilder(shirtId)
        .withName('Covering Shirt')
        .build();

      const otherActor = new ModEntityBuilder('other-actor')
        .withName('Other Person')
        .asActor()
        .atLocation('test-room')
        .withLocationComponent('test-room')
        .build();

      fixture.reset([
        room,
        actor,
        torso,
        leftBreast,
        rightBreast,
        shirt,
        otherActor,
      ]);

      // Act
      const actions = fixture.discoverActions(actorId);

      // Assert - Action requires at least one breast uncovered
      expect(actions).not.toContainEqual(
        expect.objectContaining({
          id: 'seduction:squeeze_breasts_draw_attention',
        })
      );
    });
  });

  describe('Forbidden Components', () => {
    it('should respect forbidden_components for targetless actions', () => {
      // Arrange - Actor with breasts but in forbidden state (hugging)
      const actorId = 'actor-forbidden';
      const torsoId = `${actorId}_torso`;
      const leftBreastId = `${actorId}_left_breast`;
      const rightBreastId = `${actorId}_right_breast`;

      const room = ModEntityScenarios.createRoom('test-room', 'Test Room');

      const actor = new ModEntityBuilder(actorId)
        .withName('Hugging Actor')
        .asActor()
        .atLocation('test-room')
        .withLocationComponent('test-room')
        .withBody(torsoId)
        .withComponent('hugging-states:hugging', {
          embraced_entity_id: 'target-id',
          initiated: true,
        })
        .build();

      const torso = new ModEntityBuilder(torsoId)
        .asBodyPart({
          parent: null,
          children: [leftBreastId, rightBreastId],
          subType: 'torso',
        })
        .build();

      const leftBreast = new ModEntityBuilder(leftBreastId)
        .asBodyPart({ parent: torsoId, children: [], subType: 'breast' })
        .build();

      const rightBreast = new ModEntityBuilder(rightBreastId)
        .asBodyPart({ parent: torsoId, children: [], subType: 'breast' })
        .build();

      const otherActor = new ModEntityBuilder('other-actor')
        .withName('Other Person')
        .asActor()
        .atLocation('test-room')
        .withLocationComponent('test-room')
        .build();

      fixture.reset([room, actor, torso, leftBreast, rightBreast, otherActor]);

      // Act
      const actions = fixture.discoverActions(actorId);

      // Assert - Action forbidden when hugging (forbidden_components check)
      expect(actions).not.toContainEqual(
        expect.objectContaining({
          id: 'seduction:squeeze_breasts_draw_attention',
        })
      );
    });
  });
});
