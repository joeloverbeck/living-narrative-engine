/**
 * @file Shared fixtures for the lick testicles (lying close) action suites.
 * @description Provides reusable builders and scope overrides for lying-down testicle licking scenarios
 * where partners share close proximity on the same furniture and the target's testicles must be exposed.
 */

import { ModEntityBuilder } from '../ModEntityBuilder.js';

/**
 * Builds a complete scenario for testing lick_testicles_lying_close action.
 * Creates two characters (Ava and Nolan) lying on the same bed with proper components.
 *
 * @param {object} options - Configuration options
 * @param {boolean} [options.coverLeftTesticle] - If true, covers target's left testicle with clothing
 * @param {boolean} [options.coverRightTesticle] - If true, covers target's right testicle with clothing
 * @param {boolean} [options.includeActorLying] - If false, omits actor's lying_down component
 * @param {boolean} [options.includePrimaryLying] - If false, omits primary's lying_down component
 * @param {boolean} [options.includeCloseness] - If false, omits mutual closeness components
 * @param {boolean} [options.useDifferentFurniture] - If true, places participants on different furniture
 * @param {boolean} [options.actorGivingBlowjob] - If true, adds giving_blowjob component to actor
 * @param {boolean} [options.targetFuckingActor] - If true, adds fucking_vaginally component to target
 * @returns {object} Scenario data with entities, IDs, and metadata
 */
export function buildLickTesticlesLyingCloseScenario(options = {}) {
  const {
    coverLeftTesticle = false,
    coverRightTesticle = false,
    includeActorLying = true,
    includePrimaryLying = true,
    includeCloseness = true,
    useDifferentFurniture = false,
    actorGivingBlowjob = false,
    targetFuckingActor = false,
  } = options;

  const actorId = 'actor-ava';
  const primaryId = 'primary-nolan';
  const roomId = 'room-bedroom';
  const bedId = 'furniture-bed';
  const secondBedId = 'furniture-bed-2';
  const leftTesticleId = 'body-part-nolan-left-testicle';
  const rightTesticleId = 'body-part-nolan-right-testicle';
  const clothingId = 'clothing-underwear';

  // Build room
  const room = new ModEntityBuilder(roomId)
    .withName('Bedroom')
    .asRoom('Bedroom')
    .build();

  // Build furniture
  const bed = new ModEntityBuilder(bedId)
    .withName('Bed')
    .atLocation(roomId)
    .withLocationComponent(roomId)
    .withComponent('positioning:allows_lying', {})
    .build();

  const secondBed = useDifferentFurniture
    ? new ModEntityBuilder(secondBedId)
        .withName('Second Bed')
        .atLocation(roomId)
        .withLocationComponent(roomId)
        .withComponent('positioning:allows_lying', {})
        .build()
    : null;

  // Build actor
  const actorBuilder = new ModEntityBuilder(actorId)
    .withName('Ava')
    .atLocation(roomId)
    .withLocationComponent(roomId)
    .asActor();

  if (includeActorLying) {
    actorBuilder.withComponent('positioning:lying_down', {
      furniture_id: bedId,
      state: 'lying_on_back',
    });
  }

  if (includeCloseness) {
    actorBuilder.closeToEntity(primaryId);
  }

  if (actorGivingBlowjob) {
    actorBuilder.withComponent('sex-states:giving_blowjob', {
      target_id: primaryId,
    });
  }

  const actor = actorBuilder.build();

  // Build primary with anatomy
  const primaryBuilder = new ModEntityBuilder(primaryId)
    .withName('Nolan')
    .atLocation(roomId)
    .withLocationComponent(roomId)
    .asActor()
    .withComponent('anatomy:body', {
      slots: {
        left_testicle: {
          part_id: leftTesticleId,
          ...(coverLeftTesticle && { covered_by: [clothingId] }),
        },
        right_testicle: {
          part_id: rightTesticleId,
          ...(coverRightTesticle && { covered_by: [clothingId] }),
        },
      },
    });

  if (includePrimaryLying) {
    primaryBuilder.withComponent('positioning:lying_down', {
      furniture_id: useDifferentFurniture ? secondBedId : bedId,
      state: 'lying_on_back',
    });
  }

  if (includeCloseness) {
    primaryBuilder.closeToEntity(actorId);
  }

  if (targetFuckingActor) {
    primaryBuilder.withComponent('sex-states:fucking_vaginally', {
      targetId: actorId,
    });
  }

  const primary = primaryBuilder.build();

  // Build body parts
  const leftTesticle = new ModEntityBuilder(leftTesticleId)
    .withComponent('anatomy:body_part', { type: 'testicle' })
    .build();

  const rightTesticle = new ModEntityBuilder(rightTesticleId)
    .withComponent('anatomy:body_part', { type: 'testicle' })
    .build();

  // Build clothing if needed
  const clothing =
    coverLeftTesticle || coverRightTesticle
      ? new ModEntityBuilder(clothingId)
          .withComponent('items:clothing', { slot: 'groin' })
          .build()
      : null;

  const entities = [
    room,
    bed,
    ...(secondBed ? [secondBed] : []),
    actor,
    primary,
    leftTesticle,
    rightTesticle,
    ...(clothing ? [clothing] : []),
  ];

  return {
    entities,
    actorId,
    primaryId,
    roomId,
    furnitureId: bedId,
    leftTesticleId,
    rightTesticleId,
    ...((coverLeftTesticle || coverRightTesticle) && { clothingId }),
  };
}

/**
 * Installs a scope resolver override for the actors_lying_close_with_uncovered_testicle scope.
 * This enables testing without requiring the full scope resolution system.
 *
 * @param {ModTestFixture} testFixture - The test fixture instance
 * @returns {Function} Cleanup function to restore original scope resolver
 */
export function installLyingCloseUncoveredTesticleScopeOverride(testFixture) {
  const resolver = testFixture.testEnv.unifiedScopeResolver;
  const originalResolveSync = resolver.resolveSync.bind(resolver);

  resolver.resolveSync = (scopeName, context) => {
    if (scopeName === 'sex-core:actors_lying_close_with_uncovered_testicle') {
      const actorId = context?.actor?.id;

      if (!actorId) {
        return { success: true, value: new Set() };
      }

      const actorEntity = testFixture.entityManager.getEntityInstance(actorId);

      // Get actor's lying position
      const actorLying = actorEntity?.components['positioning:lying_down'];
      if (!actorLying) {
        return { success: true, value: new Set() };
      }

      // Get actor's closeness partners
      const actorCloseness = actorEntity?.components['personal-space-states:closeness'];
      if (!actorCloseness?.partners) {
        return { success: true, value: new Set() };
      }

      // Filter partners by criteria
      const validPartners = actorCloseness.partners.filter((partnerId) => {
        const partnerEntity =
          testFixture.entityManager.getEntityInstance(partnerId);
        if (!partnerEntity) return false;

        // Check lying position
        const partnerLying = partnerEntity.components['positioning:lying_down'];
        if (!partnerLying) return false;

        // Check same furniture
        if (actorLying.furniture_id !== partnerLying.furniture_id) return false;

        // Check mutual closeness
        const partnerCloseness =
          partnerEntity.components['personal-space-states:closeness'];
        if (!partnerCloseness?.partners?.includes(actorId)) return false;

        // Check for testicle anatomy
        const partnerBody = partnerEntity.components['anatomy:body'];
        if (!partnerBody?.slots) return false;

        const hasLeftTesticle = !!partnerBody.slots.left_testicle;
        const hasRightTesticle = !!partnerBody.slots.right_testicle;
        if (!hasLeftTesticle && !hasRightTesticle) return false;

        // Check at least one testicle is uncovered
        const leftUncovered =
          hasLeftTesticle &&
          (!partnerBody.slots.left_testicle.covered_by ||
            partnerBody.slots.left_testicle.covered_by.length === 0);
        const rightUncovered =
          hasRightTesticle &&
          (!partnerBody.slots.right_testicle.covered_by ||
            partnerBody.slots.right_testicle.covered_by.length === 0);

        if (!leftUncovered && !rightUncovered) return false;

        // Check not currently fucking actor vaginally
        const fuckingVaginally =
          partnerEntity.components['sex-states:fucking_vaginally'];
        if (fuckingVaginally?.targetId === actorId) return false;

        return true;
      });

      return { success: true, value: new Set(validPartners) };
    }

    return originalResolveSync(scopeName, context);
  };

  // Return cleanup function
  return () => {
    resolver.resolveSync = originalResolveSync;
  };
}
