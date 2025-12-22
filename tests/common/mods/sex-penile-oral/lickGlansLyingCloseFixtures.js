import { ModEntityBuilder } from '../ModEntityBuilder.js';

/**
 * Builds a complete scenario for testing lick_glans_lying_close action.
 * Creates two characters (Ava and Nolan) lying on the same bed with proper components.
 *
 * @param {object} options - Configuration options
 * @param {boolean} options.coverPrimaryPenis - If true, covers primary's penis with clothing
 * @param {boolean} options.includeActorLying - If false, omits actor's lying_down component
 * @param {boolean} options.includePrimaryLying - If false, omits primary's lying_down component
 * @param {boolean} options.includeCloseness - If false, omits mutual closeness components
 * @param {boolean} options.useDifferentFurniture - If true, places participants on different furniture
 * @param {boolean} options.actorGivingBlowjob - If true, adds giving_blowjob component to actor
 * @returns {object} Scenario data with entities, IDs, and metadata
 */
export function buildLickGlansLyingCloseScenario(options = {}) {
  const {
    coverPrimaryPenis = false,
    includeActorLying = true,
    includePrimaryLying = true,
    includeCloseness = true,
    useDifferentFurniture = false,
    actorGivingBlowjob = false,
  } = options;

  const actorId = 'ava';
  const primaryId = 'nolan';
  const roomId = 'bedroom1';
  const bedId = 'bed1';
  const secondBedId = 'bed2';

  const primaryTorsoId = `${primaryId}_torso`;
  const primaryGroinId = `${primaryId}_groin`;
  const primaryPenisId = `${primaryGroinId}_penis`;
  const primaryClothingId = `${primaryId}_underwear`;

  const room = new ModEntityBuilder(roomId)
    .withName('Bedroom')
    .asRoom('Bedroom')
    .build();

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

  const actorBuilder = new ModEntityBuilder(actorId)
    .withName('Ava')
    .atLocation(roomId)
    .withLocationComponent(roomId)
    .asActor();

  if (includeActorLying) {
    actorBuilder.withComponent('lying-states:lying_on', {
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

  const primaryBuilder = new ModEntityBuilder(primaryId)
    .withName('Nolan')
    .atLocation(roomId)
    .withLocationComponent(roomId)
    .asActor()
    .withBody(primaryTorsoId);

  if (includePrimaryLying) {
    primaryBuilder.withComponent('lying-states:lying_on', {
      furniture_id: useDifferentFurniture ? secondBedId : bedId,
      state: 'lying_on_back',
    });
  }

  if (includeCloseness) {
    primaryBuilder.closeToEntity(actorId);
  }

  if (coverPrimaryPenis) {
    primaryBuilder
      .withComponent('clothing:equipment', {
        equipped: {
          torso_lower: {
            base: [primaryClothingId],
          },
        },
      })
      .withComponent('clothing:slot_metadata', {
        slotMappings: {
          torso_lower: {
            coveredSockets: ['penis'],
            allowedLayers: ['base', 'outer'],
          },
        },
      });
  }

  const actor = actorBuilder.build();
  const primary = primaryBuilder.build();

  const primaryTorso = new ModEntityBuilder(primaryTorsoId)
    .asBodyPart({
      parent: null,
      children: [primaryGroinId],
      subType: 'torso',
    })
    .build();

  const primaryGroin = new ModEntityBuilder(primaryGroinId)
    .asBodyPart({
      parent: primaryTorsoId,
      children: [primaryPenisId],
      subType: 'groin',
      sockets: {
        penis: { coveredBy: null, attachedPart: primaryPenisId },
      },
    })
    .build();

  const primaryPenis = new ModEntityBuilder(primaryPenisId)
    .asBodyPart({ parent: primaryGroinId, children: [], subType: 'penis' })
    .build();

  const primaryClothing = coverPrimaryPenis
    ? new ModEntityBuilder(primaryClothingId)
        .withComponent('items:item', {
          name: 'Underwear',
          volume: 1,
          weight: 1,
        })
        .withComponent('items:clothing', {
          slot: 'torso_lower',
          layer: 'base',
          coverage: ['torso_lower'],
        })
        .build()
    : null;

  const entities = [
    room,
    bed,
    ...(secondBed ? [secondBed] : []),
    actor,
    primary,
    primaryTorso,
    primaryGroin,
    primaryPenis,
    ...(primaryClothing ? [primaryClothing] : []),
  ];

  return {
    entities,
    actorId,
    primaryId,
    roomId,
    furnitureId: bedId,
    primaryPenisId,
    ...(coverPrimaryPenis && { clothingId: primaryClothingId }),
  };
}

/**
 * Installs a scope resolver override for the actors_lying_close_with_uncovered_penis scope.
 * This enables testing without requiring the full scope resolution system.
 *
 * @param {import('../ModTestFixture.js').ModTestFixture} testFixture - The test fixture instance
 * @returns {() => void} Cleanup function to restore original scope resolver
 */
export function installLyingCloseUncoveredPenisScopeOverride(testFixture) {
  const resolver = testFixture.testEnv.unifiedScopeResolver;
  const originalResolveSync = resolver.resolveSync.bind(resolver);

  resolver.resolveSync = (scopeName, context) => {
    if (scopeName === 'sex-core:actors_lying_close_with_uncovered_penis') {
      const actorId = context?.actor?.id;

      if (!actorId) {
        return { success: true, value: new Set() };
      }

      const actor = testFixture.entityManager.getEntityInstance(actorId);
      const actorLying = actor?.components?.['lying-states:lying_on'];
      const closenessPartners =
        actor?.components?.['personal-space-states:closeness']?.partners;

      if (
        !actorLying ||
        !Array.isArray(closenessPartners) ||
        closenessPartners.length === 0
      ) {
        return { success: true, value: new Set() };
      }

      const validPartners = closenessPartners.filter((partnerId) => {
        const partner = testFixture.entityManager.getEntityInstance(partnerId);

        if (!partner) {
          return false;
        }

        const partnerLying = partner.components?.['lying-states:lying_on'];
        if (!partnerLying) {
          return false;
        }

        // Check same furniture
        if (actorLying.furniture_id !== partnerLying.furniture_id) {
          return false;
        }

        // Check for penis anatomy
        const hasPenis = testFixture.testEnv.jsonLogic.evaluate(
          { hasPartOfType: ['target', 'penis'] },
          { target: partner }
        );

        if (!hasPenis) {
          return false;
        }

        // Check penis is not covered
        const penisCovered = testFixture.testEnv.jsonLogic.evaluate(
          { isSocketCovered: ['target', 'penis'] },
          { target: partner }
        );

        if (penisCovered) {
          return false;
        }

        // Check not currently fucking actor vaginally
        const fuckingVaginally =
          partner.components?.['sex-states:fucking_vaginally'];
        if (fuckingVaginally?.target_id === actorId) {
          return false;
        }

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
