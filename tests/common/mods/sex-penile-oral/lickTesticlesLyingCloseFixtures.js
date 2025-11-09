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
 * @param {Object} options - Configuration options
 * @param {boolean} [options.coverLeftTesticle=false] - If true, covers target's left testicle with clothing
 * @param {boolean} [options.coverRightTesticle=false] - If true, covers target's right testicle with clothing
 * @param {boolean} [options.includeActorLying=true] - If false, omits actor's lying_down component
 * @param {boolean} [options.includePrimaryLying=true] - If false, omits primary's lying_down component
 * @param {boolean} [options.includeCloseness=true] - If false, omits mutual closeness components
 * @param {boolean} [options.useDifferentFurniture=false] - If true, places participants on different furniture
 * @param {boolean} [options.actorGivingBlowjob=false] - If true, adds giving_blowjob component to actor
 * @param {boolean} [options.targetFuckingActor=false] - If true, adds fucking_vaginally component to target
 * @returns {Object} Scenario data with entities, IDs, and metadata
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

  const entities = {
    [actorId]: {
      id: actorId,
      components: {
        'core:name': { name: 'Ava' },
        'core:position': { locationId: roomId },
        ...(includeActorLying && {
          'positioning:lying_down': {
            furniture_id: bedId,
            state: 'lying_on_back',
          },
        }),
        ...(includeCloseness && {
          'positioning:closeness': { partners: [primaryId] },
        }),
        ...(actorGivingBlowjob && {
          'positioning:giving_blowjob': { target_id: primaryId },
        }),
      },
    },
    [primaryId]: {
      id: primaryId,
      components: {
        'core:name': { name: 'Nolan' },
        'core:position': { locationId: roomId },
        'anatomy:body': {
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
        },
        ...(includePrimaryLying && {
          'positioning:lying_down': {
            furniture_id: useDifferentFurniture ? secondBedId : bedId,
            state: 'lying_on_back',
          },
        }),
        ...(includeCloseness && {
          'positioning:closeness': { partners: [actorId] },
        }),
        ...(targetFuckingActor && {
          'positioning:fucking_vaginally': { targetId: actorId },
        }),
      },
    },
    [roomId]: {
      id: roomId,
      components: {
        'core:name': { name: 'Bedroom' },
      },
    },
    [bedId]: {
      id: bedId,
      components: {
        'core:name': { name: 'Bed' },
        'furniture:allows_lying': {},
      },
    },
    ...(useDifferentFurniture && {
      [secondBedId]: {
        id: secondBedId,
        components: {
          'core:name': { name: 'Second Bed' },
          'furniture:allows_lying': {},
        },
      },
    }),
    [leftTesticleId]: {
      id: leftTesticleId,
      components: {
        'anatomy:body_part': { type: 'testicle' },
      },
    },
    [rightTesticleId]: {
      id: rightTesticleId,
      components: {
        'anatomy:body_part': { type: 'testicle' },
      },
    },
    ...((coverLeftTesticle || coverRightTesticle) && {
      [clothingId]: {
        id: clothingId,
        components: {
          'items:clothing': { slot: 'groin' },
        },
      },
    }),
  };

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
  const originalResolver = testFixture.testEnv.scopeResolver.resolve.bind(
    testFixture.testEnv.scopeResolver
  );

  testFixture.testEnv.scopeResolver.resolve = (scopeId, context) => {
    if (scopeId === 'sex-core:actors_lying_close_with_uncovered_testicle') {
      const { actor } = context;
      const actorEntity = testFixture.entityManager.getEntity(actor);

      // Get actor's lying position
      const actorLying = actorEntity?.components['positioning:lying_down'];
      if (!actorLying) return [];

      // Get actor's closeness partners
      const actorCloseness = actorEntity?.components['positioning:closeness'];
      if (!actorCloseness?.partners) return [];

      // Filter partners by criteria
      const validPartners = actorCloseness.partners.filter((partnerId) => {
        const partnerEntity = testFixture.entityManager.getEntity(partnerId);
        if (!partnerEntity) return false;

        // Check lying position
        const partnerLying = partnerEntity.components['positioning:lying_down'];
        if (!partnerLying) return false;

        // Check same furniture
        if (actorLying.furniture_id !== partnerLying.furniture_id) return false;

        // Check mutual closeness
        const partnerCloseness = partnerEntity.components['positioning:closeness'];
        if (!partnerCloseness?.partners?.includes(actor)) return false;

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
        const fuckingVaginally = partnerEntity.components['positioning:fucking_vaginally'];
        if (fuckingVaginally?.targetId === actor) return false;

        return true;
      });

      return validPartners;
    }

    return originalResolver(scopeId, context);
  };

  // Return cleanup function
  return () => {
    testFixture.testEnv.scopeResolver.resolve = originalResolver;
  };
}
