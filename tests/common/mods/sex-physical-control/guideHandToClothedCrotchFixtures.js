/**
 * @file Shared fixtures for the sex-penile-manual clothed crotch hand guidance suites.
 * @description Provides reusable builders for scenarios where an actor coaxes a close partner's hand
 * to the clothed bulge of their crotch while maintaining mutual proximity requirements.
 */

import { ModEntityBuilder } from '../ModEntityBuilder.js';

/**
 * Identifier for the guide hand to clothed crotch action.
 *
 * @type {string}
 */
export const GUIDE_HAND_TO_CLOTHED_CROTCH_ACTION_ID =
  'sex-physical-control:guide_hand_to_clothed_crotch';

/**
 * Default actor identifier for clothed crotch hand guidance scenarios.
 *
 * @type {string}
 */
export const GUIDE_HAND_TO_CLOTHED_CROTCH_ACTOR_ID = 'marin';

/**
 * Default primary partner identifier for clothed crotch hand guidance scenarios.
 *
 * @type {string}
 */
export const GUIDE_HAND_TO_CLOTHED_CROTCH_PRIMARY_ID = 'avery';

/**
 * Default room identifier used for clothed crotch hand guidance scenarios.
 *
 * @type {string}
 */
export const GUIDE_HAND_TO_CLOTHED_CROTCH_ROOM_ID = 'amber_suite';

/**
 * Default clothing identifier worn by the actor over their crotch.
 *
 * @type {string}
 */
export const GUIDE_HAND_TO_CLOTHED_CROTCH_ACTOR_CLOTHING_ID =
  `${GUIDE_HAND_TO_CLOTHED_CROTCH_ACTOR_ID}_slacks`;

/**
 * Default groin identifier for the actor's anatomy tree.
 *
 * @type {string}
 */
export const GUIDE_HAND_TO_CLOTHED_CROTCH_ACTOR_GROIN_ID =
  `${GUIDE_HAND_TO_CLOTHED_CROTCH_ACTOR_ID}_groin`;

/**
 * Default penis identifier for the actor's anatomy tree.
 *
 * @type {string}
 */
export const GUIDE_HAND_TO_CLOTHED_CROTCH_ACTOR_PENIS_ID =
  `${GUIDE_HAND_TO_CLOTHED_CROTCH_ACTOR_GROIN_ID}_penis`;

/**
 * @typedef {object} GuideHandToClothedCrotchScenarioOptions
 * @property {boolean} [includeCloseness=true] - Whether mutual positioning:closeness components are applied.
 * @property {boolean} [includeActorPenis=true] - Whether the actor has a penis body part attached.
 * @property {boolean} [coverActorPenis=true] - Whether the actor's penis socket reports coveredBy metadata and slot coverage.
 * @property {boolean} [includeReceivingBlowjob=false] - Whether the actor includes positioning:receiving_blowjob.
 * @property {boolean} [includeKneelingConflict=false] - Whether the actor kneels before the target, breaking the shared scope.
 * @property {boolean} [includeHandAnatomy=true] - Whether to attach basic hand anatomy to both participants.
 */

/**
 * Builds a close-partner scenario tailored for the guide hand to clothed crotch action.
 * Ensures the actor has configurable penis anatomy, coverage metadata, and optional component toggles for tests.
 *
 * @param {GuideHandToClothedCrotchScenarioOptions} [options] - Scenario customization options.
 * @returns {{
 *   entities: Array<object>,
 *   actorId: string,
 *   primaryId: string,
 *   actorPenisId: string,
 *   actorClothingId: string
 * }} Entity collection and identifier references for the scenario.
 */
export function buildGuideHandToClothedCrotchScenario(options = {}) {
  const {
    includeCloseness = true,
    includeActorPenis = true,
    coverActorPenis = true,
    includeReceivingBlowjob = false,
    includeKneelingConflict = false,
    includeHandAnatomy = true,
  } = options;

  const roomId = GUIDE_HAND_TO_CLOTHED_CROTCH_ROOM_ID;
  const actorId = GUIDE_HAND_TO_CLOTHED_CROTCH_ACTOR_ID;
  const primaryId = GUIDE_HAND_TO_CLOTHED_CROTCH_PRIMARY_ID;
  const actorClothingId = GUIDE_HAND_TO_CLOTHED_CROTCH_ACTOR_CLOTHING_ID;
  const actorGroinId = GUIDE_HAND_TO_CLOTHED_CROTCH_ACTOR_GROIN_ID;
  const actorPenisId = GUIDE_HAND_TO_CLOTHED_CROTCH_ACTOR_PENIS_ID;
  const actorHandId = `${actorId}_hand`;
  const actorHandRootId = includeActorPenis ? actorGroinId : `${actorId}_torso`;
  const primaryHandRootId = `${primaryId}_torso`;
  const primaryHandId = `${primaryId}_hand`;

  const room = new ModEntityBuilder(roomId).asRoom('Amber Suite').build();

  const actorBuilder = new ModEntityBuilder(actorId)
    .withName('Marin')
    .atLocation(roomId)
    .withLocationComponent(roomId)
    .asActor();

  if (includeCloseness) {
    actorBuilder.closeToEntity(primaryId);
  }

  if (includeReceivingBlowjob) {
    actorBuilder.withComponent('positioning:receiving_blowjob', {
      giving_entity_id: primaryId,
      consented: true,
    });
  }

  if (includeKneelingConflict) {
    actorBuilder.kneelingBefore(primaryId);
  }

  if (includeActorPenis) {
    actorBuilder.withBody(actorGroinId);
    actorBuilder.withComponent('clothing:equipment', {
      equipped: {
        torso_lower: {
          base: coverActorPenis ? [actorClothingId] : [],
        },
      },
    });
    actorBuilder.withComponent('clothing:slot_metadata', {
      slotMappings: {
        torso_lower: {
          coveredSockets: coverActorPenis
            ? ['penis', 'left_hip', 'right_hip']
            : ['left_hip', 'right_hip'],
          allowedLayers: ['underwear', 'base', 'outer'],
        },
      },
    });
  } else if (includeHandAnatomy) {
    actorBuilder.withBody(actorHandRootId);
  }

  const primaryBuilder = new ModEntityBuilder(primaryId)
    .withName('Avery')
    .atLocation(roomId)
    .withLocationComponent(roomId)
    .asActor();

  if (includeCloseness) {
    primaryBuilder.closeToEntity(actorId);
  }

  if (includeHandAnatomy) {
    primaryBuilder.withBody(primaryHandRootId);
  }

  const entities = [room];

  const actor = actorBuilder.build();
  const primary = primaryBuilder.build();
  entities.push(actor, primary);

  if (includeActorPenis) {
    const groinChildren = [];
    if (includeActorPenis) {
      groinChildren.push(actorPenisId);
    }
    if (includeHandAnatomy) {
      groinChildren.push(actorHandId);
    }

    const actorGroin = new ModEntityBuilder(actorGroinId)
      .asBodyPart({
        parent: null,
        children: groinChildren,
        subType: 'groin',
        sockets: {
          penis: {
            attachedPart: includeActorPenis ? actorPenisId : null,
            coveredBy: coverActorPenis ? actorClothingId : null,
          },
        },
      })
      .withLocationComponent(roomId)
      .build();

    entities.push(actorGroin);

    if (includeActorPenis) {
      const penis = new ModEntityBuilder(actorPenisId)
        .asBodyPart({ parent: actorGroinId, children: [], subType: 'penis' })
        .withLocationComponent(roomId)
        .build();

      entities.push(penis);
    }

    if (includeHandAnatomy) {
      const actorHand = new ModEntityBuilder(actorHandId)
        .asBodyPart({ parent: actorGroinId, children: [], subType: 'hand' })
        .atLocation(roomId)
        .withLocationComponent(roomId)
        .build();
      entities.push(actorHand);
    }

    const clothing = new ModEntityBuilder(actorClothingId)
      .withName('Charcoal Slacks')
      .build();

    if (coverActorPenis) {
      entities.push(clothing);
    }
  } else if (includeHandAnatomy) {
    const actorTorso = new ModEntityBuilder(actorHandRootId)
      .asBodyPart({
        parent: null,
        children: [actorHandId],
        subType: 'torso',
      })
      .atLocation(roomId)
      .withLocationComponent(roomId)
      .build();

    const actorHand = new ModEntityBuilder(actorHandId)
      .asBodyPart({ parent: actorHandRootId, children: [], subType: 'hand' })
      .atLocation(roomId)
      .withLocationComponent(roomId)
      .build();

    entities.push(actorTorso, actorHand);
  }

  if (includeHandAnatomy) {
    const primaryTorso = new ModEntityBuilder(primaryHandRootId)
      .asBodyPart({
        parent: null,
        children: [primaryHandId],
        subType: 'torso',
      })
      .atLocation(roomId)
      .withLocationComponent(roomId)
      .build();

    const primaryHand = new ModEntityBuilder(primaryHandId)
      .asBodyPart({
        parent: primaryHandRootId,
        children: [],
        subType: 'hand',
      })
      .atLocation(roomId)
      .withLocationComponent(roomId)
      .build();

    entities.push(primaryTorso, primaryHand);
  }

  return {
    entities,
    actorId,
    primaryId,
    actorPenisId,
    actorClothingId,
  };
}
