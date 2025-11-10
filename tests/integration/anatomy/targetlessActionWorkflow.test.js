import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';
import { ModEntityBuilder, ModEntityScenarios } from '../../common/mods/ModEntityBuilder.js';
import '../../common/mods/domainMatchers.js';

describe('Targetless Action Workflow - Anatomy Prerequisites', () => {
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

  it('should complete full workflow: discovery → execution → effects', async () => {
    // Arrange - Actor with required anatomy (breasts uncovered)
    const actorId = 'seductive-actor';
    const torsoId = `${actorId}_torso`;
    const leftBreastId = `${actorId}_left_breast`;
    const rightBreastId = `${actorId}_right_breast`;

    const room = ModEntityScenarios.createRoom('test-room', 'Test Room');

    const actor = new ModEntityBuilder(actorId)
      .withName('Seductive Actor')
      .asActor()
      .atLocation('test-room')
      .withLocationComponent('test-room')
      .withBody(torsoId)
      .build();

    const torso = new ModEntityBuilder(torsoId)
      .asBodyPart({ parent: null, children: [leftBreastId, rightBreastId], subType: 'torso' })
      .build();

    const leftBreast = new ModEntityBuilder(leftBreastId)
      .asBodyPart({ parent: torsoId, children: [], subType: 'breast' })
      .build();

    const rightBreast = new ModEntityBuilder(rightBreastId)
      .asBodyPart({ parent: torsoId, children: [], subType: 'breast' })
      .build();

    // Other actor required for hasOtherActorsAtLocation prerequisite
    const otherActor = new ModEntityBuilder('audience-member')
      .withName('Audience Member')
      .asActor()
      .atLocation('test-room')
      .withLocationComponent('test-room')
      .build();

    fixture.reset([room, actor, torso, leftBreast, rightBreast, otherActor]);

    // Act - Discover actions
    const discovered = fixture.discoverActions(actorId);

    // Assert - Action is discovered
    expect(discovered).toContainEqual(
      expect.objectContaining({
        id: 'seduction:squeeze_breasts_draw_attention'
      })
    );

    // Act - Execute action (targetless - no target ID)
    await fixture.executeAction(actorId);

    // Assert - Action succeeded
    expect(fixture.events).toHaveActionSuccess();
  });

  it('should NOT discover when other actors prerequisite fails', () => {
    // Arrange - Actor with breasts but alone (no other actors at location)
    const actorId = 'lonely-actor';
    const torsoId = `${actorId}_torso`;
    const leftBreastId = `${actorId}_left_breast`;
    const rightBreastId = `${actorId}_right_breast`;

    const room = ModEntityScenarios.createRoom('empty-room', 'Empty Room');

    const actor = new ModEntityBuilder(actorId)
      .withName('Lonely Actor')
      .asActor()
      .atLocation('empty-room')
      .withLocationComponent('empty-room')
      .withBody(torsoId)
      .build();

    const torso = new ModEntityBuilder(torsoId)
      .asBodyPart({ parent: null, children: [leftBreastId, rightBreastId], subType: 'torso' })
      .build();

    const leftBreast = new ModEntityBuilder(leftBreastId)
      .asBodyPart({ parent: torsoId, children: [], subType: 'breast' })
      .build();

    const rightBreast = new ModEntityBuilder(rightBreastId)
      .asBodyPart({ parent: torsoId, children: [], subType: 'breast' })
      .build();

    fixture.reset([room, actor, torso, leftBreast, rightBreast]);

    // Act
    const discovered = fixture.discoverActions(actorId);

    // Assert - Action requires other actors present (hasOtherActorsAtLocation fails)
    expect(discovered).not.toContainEqual(
      expect.objectContaining({
        id: 'seduction:squeeze_breasts_draw_attention'
      })
    );
  });
});
