/**
 * @file Integration tests for sex-vaginal-penetration:insert_primary_penis_into_your_vagina action discovery.
 * @description Ensures the receptive penetration initiation action only appears with proper anatomy, exposure, positioning, and state.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import insertPrimaryPenisAction from '../../../../data/mods/sex-vaginal-penetration/actions/insert_primary_penis_into_your_vagina.action.json';

describe('sex-vaginal-penetration:insert_primary_penis_into_your_vagina action discovery', () => {
  let testFixture;
  let configureActionDiscovery;
  let restoreScopeResolver;

  /**
   * @description Determines whether an entity has a penis anatomy part.
   * @param {object} entity - Entity instance to inspect.
   * @returns {boolean} True if the entity has a penis body part.
   */
  function entityHasPenis(entity) {
    const bodyComponent = entity?.components?.['anatomy:body'];
    const rootId = bodyComponent?.body?.root;

    if (!rootId) {
      return false;
    }

    const visited = new Set();
    const stack = [rootId];

    while (stack.length > 0) {
      const partId = stack.pop();
      if (visited.has(partId)) {
        continue;
      }
      visited.add(partId);

      const partEntity = testFixture.entityManager.getEntityInstance(partId);
      const anatomyPart = partEntity?.components?.['anatomy:part'];

      if (!anatomyPart) {
        continue;
      }

      if (anatomyPart.subType === 'penis') {
        return true;
      }

      if (Array.isArray(anatomyPart.children)) {
        anatomyPart.children.forEach((childId) => {
          if (!visited.has(childId)) {
            stack.push(childId);
          }
        });
      }
    }

    return false;
  }

  /**
   * @description Checks if the specified socket is covered by clothing.
   * @param {object} entity - Entity whose clothing configuration to inspect.
   * @param {string} socketName - Anatomy socket identifier to evaluate.
   * @returns {boolean} True if the socket is covered by any equipped clothing.
   */
  function isSocketCovered(entity, socketName) {
    const equipment = entity?.components?.['clothing:equipment']?.equipped;
    const slotMetadata =
      entity?.components?.['clothing:slot_metadata']?.slotMappings;

    if (!equipment || !slotMetadata) {
      return false;
    }

    return Object.entries(slotMetadata).some(([slotName, metadata]) => {
      if (!metadata?.coveredSockets?.includes(socketName)) {
        return false;
      }

      const slotLayers = equipment[slotName];
      if (!slotLayers) {
        return false;
      }

      return Object.values(slotLayers).some(
        (items) => Array.isArray(items) && items.length > 0
      );
    });
  }

  /**
   * @description Resolves the uncovered penis scope using the test fixture entity state.
   * @param {object} context - Resolver context passed by the scope system.
   * @returns {object} Scope resolution result mirroring engine semantics.
   */
  function resolveUncoveredPenisScope(context) {
    const actorId = context?.actor?.id;

    if (!actorId) {
      return { success: true, value: new Set() };
    }

    const actorEntity = testFixture.entityManager.getEntityInstance(actorId);
    const closeness = actorEntity?.components?.['personal-space-states:closeness'];
    const partners = Array.isArray(closeness?.partners)
      ? closeness.partners
      : [];

    if (partners.length === 0) {
      return { success: true, value: new Set() };
    }

    const actorFacingAway =
      actorEntity?.components?.['facing-states:facing_away']?.facing_away_from ||
      [];

    const validPartners = partners.filter((partnerId) => {
      const partner = testFixture.entityManager.getEntityInstance(partnerId);

      if (!partner) {
        return false;
      }

      if (!entityHasPenis(partner)) {
        return false;
      }

      if (isSocketCovered(partner, 'penis')) {
        return false;
      }

      const partnerFacingAway =
        partner.components?.['facing-states:facing_away']?.facing_away_from || [];

      const facingEachOther =
        !partnerFacingAway.includes(actorId) &&
        !actorFacingAway.includes(partnerId);
      const actorBehindTarget = partnerFacingAway.includes(actorId);

      if (!facingEachOther && !actorBehindTarget) {
        return false;
      }

      const partnerKneelingBeforeActor =
        partner.components?.['deference-states:kneeling_before']?.entityId ===
        actorId;
      const actorKneelingBeforePartner =
        actorEntity?.components?.['deference-states:kneeling_before']?.entityId ===
        partnerId;

      if (partnerKneelingBeforeActor || actorKneelingBeforePartner) {
        return false;
      }

      return true;
    });

    return { success: true, value: new Set(validPartners) };
  }

  /**
   * @description Builds entities for discovery scenarios with configurable positioning and state.
   * @param {object} [options] - Scenario configuration options.
   * @param {boolean} [options.includeCloseness] - Whether both entities share closeness.
   * @param {boolean} [options.targetFacingAway] - Whether the target faces away from the actor.
   * @param {boolean} [options.coverPenis] - Whether clothing covers the target's penis.
   * @param {boolean} [options.coverVagina] - Whether clothing covers the actor's vagina.
   * @param {boolean} [options.includePenis] - Whether to include a penis anatomy part for the target.
   * @param {boolean} [options.includeVagina] - Whether to include a vagina anatomy part for the actor.
   * @param {boolean} [options.actorSitting] - Whether the actor is sitting on furniture.
   * @param {boolean} [options.actorBeingFucked] - Whether the actor starts with the penetration state component.
   * @returns {Array<object>} Entities to load into the test environment.
   */
  function buildScenario(options = {}) {
    const {
      includeCloseness = true,
      targetFacingAway = false,
      coverPenis = false,
      coverVagina = false,
      includePenis = true,
      includeVagina = true,
      actorSitting = false,
      actorBeingFucked = false,
    } = options;

    const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

    const actorPelvisId = includeVagina
      ? 'actorPelvisWithVagina1'
      : 'actorPelvisNoVagina1';
    const actorVaginaId = `${actorPelvisId}_vagina`;
    const targetGroinId = includePenis
      ? 'targetGroinWithPenis1'
      : 'targetGroinNoPenis1';
    const targetPenisId = `${targetGroinId}_penis`;

    const actorBuilder = new ModEntityBuilder('alana')
      .withName('Alana')
      .atLocation('room1')
      .withBody(actorPelvisId)
      .asActor();

    const targetBuilder = new ModEntityBuilder('dorian')
      .withName('Dorian')
      .atLocation('room1')
      .withBody(targetGroinId)
      .asActor();

    if (includeCloseness) {
      actorBuilder.closeToEntity('dorian');
      targetBuilder.closeToEntity('alana');
    }

    if (actorBeingFucked) {
      actorBuilder.withComponent('sex-states:being_fucked_vaginally', {
        actorId: 'dorian',
      });
    }

    if (actorSitting) {
      actorBuilder.withComponent('sitting-states:sitting_on', {
        furniture_id: 'stool1',
        spot_index: 0,
      });
    }

    if (targetFacingAway) {
      targetBuilder.withComponent('facing-states:facing_away', {
        facing_away_from: ['alana'],
      });
    }

    if (coverVagina) {
      actorBuilder
        .withComponent('clothing:equipment', {
          equipped: {
            torso_lower: {
              base: ['skirt1'],
            },
          },
        })
        .withComponent('clothing:slot_metadata', {
          slotMappings: {
            torso_lower: {
              coveredSockets: ['vagina'],
              allowedLayers: ['base', 'outer'],
            },
          },
        });
    }

    if (coverPenis) {
      targetBuilder
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
              coveredSockets: ['penis'],
              allowedLayers: ['base', 'outer'],
            },
          },
        });
    }

    const actor = actorBuilder.build();
    const target = targetBuilder.build();

    const actorPelvisChildren = includeVagina ? [actorVaginaId] : [];
    const targetGroinChildren = includePenis ? [targetPenisId] : [];

    const actorPelvis = new ModEntityBuilder(actorPelvisId)
      .asBodyPart({
        parent: null,
        children: actorPelvisChildren,
        subType: 'pelvis',
      })
      .build();

    const targetGroin = new ModEntityBuilder(targetGroinId)
      .asBodyPart({
        parent: null,
        children: targetGroinChildren,
        subType: 'groin',
      })
      .build();

    const entities = [room, actor, target, actorPelvis, targetGroin];

    if (includeVagina) {
      const actorVagina = new ModEntityBuilder(actorVaginaId)
        .asBodyPart({ parent: actorPelvisId, children: [], subType: 'vagina' })
        .build();
      entities.push(actorVagina);
    }

    if (includePenis) {
      const targetPenis = new ModEntityBuilder(targetPenisId)
        .asBodyPart({ parent: targetGroinId, children: [], subType: 'penis' })
        .build();
      entities.push(targetPenis);
    }

    if (coverVagina) {
      entities.push(new ModEntityBuilder('skirt1').withName('Skirt').build());
    }

    if (coverPenis) {
      entities.push(new ModEntityBuilder('pants1').withName('Pants').build());
    }

    if (actorSitting) {
      entities.push(
        new ModEntityBuilder('stool1')
          .withName('Stool')
          .atLocation('room1')
          .build()
      );
    }

    return entities;
  }

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'sex',
      'sex-vaginal-penetration:insert_primary_penis_into_your_vagina'
    );

    const { testEnv } = testFixture;

    configureActionDiscovery = () => {
      testEnv.actionIndex.buildIndex([insertPrimaryPenisAction]);
    };

    const resolver = testEnv.unifiedScopeResolver;
    const originalResolveSync = resolver.resolveSync;

    resolver.resolveSync = (scopeName, context) => {
      if (
        scopeName ===
        'sex-vaginal-penetration:actors_with_uncovered_penis_facing_each_other_or_target_facing_away'
      ) {
        return resolveUncoveredPenisScope(context);
      }

      return originalResolveSync.call(resolver, scopeName, context);
    };

    restoreScopeResolver = () => {
      resolver.resolveSync = originalResolveSync;
    };
  });

  afterEach(() => {
    if (restoreScopeResolver) {
      restoreScopeResolver();
      restoreScopeResolver = null;
    }

    if (testFixture) {
      testFixture.cleanup();
      testFixture = null;
    }
  });

  describe('Action structure validation', () => {
    it('defines metadata and template correctly', () => {
      expect(insertPrimaryPenisAction.id).toBe(
        'sex-vaginal-penetration:insert_primary_penis_into_your_vagina'
      );
      expect(insertPrimaryPenisAction.template).toBe(
        "insert {primary}'s penis into your vagina"
      );
      expect(insertPrimaryPenisAction.targets.primary.scope).toBe(
        'sex-vaginal-penetration:actors_with_uncovered_penis_facing_each_other_or_target_facing_away'
      );
    });

    it('requires closeness and forbids conflicting actor states', () => {
      expect(insertPrimaryPenisAction.required_components.actor).toEqual([
        'personal-space-states:closeness',
      ]);
      expect(insertPrimaryPenisAction.forbidden_components.actor).toEqual([
        'sex-states:being_fucked_vaginally',
        'sitting-states:sitting_on',
      ]);
    });

    it('enforces vagina ownership and exposure prerequisites', () => {
      expect(insertPrimaryPenisAction.prerequisites).toEqual([
        {
          logic: { hasPartOfType: ['actor', 'vagina'] },
          failure_message: 'You need a vagina to perform this action.',
        },
        {
          logic: { not: { isSocketCovered: ['actor', 'vagina'] } },
          failure_message:
            'Your vagina must be uncovered to perform this action.',
        },
      ]);
    });
  });

  describe('Action discovery scenarios', () => {
    it('appears when penis is uncovered and partners are close', async () => {
      const entities = buildScenario();
      testFixture.reset(entities);
      configureActionDiscovery();

      const actorEntity = testFixture.entityManager.getEntityInstance('alana');
      const prerequisitesPassed =
        testFixture.testEnv.prerequisiteService.evaluate(
          insertPrimaryPenisAction.prerequisites,
          insertPrimaryPenisAction,
          actorEntity
        );
      expect(prerequisitesPassed).toBe(true);

      expect(
        testFixture.testEnv.validateAction(
          'alana',
          'sex-vaginal-penetration:insert_primary_penis_into_your_vagina'
        )
      ).toBe(true);

      const actions = await testFixture.discoverActions('alana');
      const foundAction = actions.find(
        (action) =>
          action.id ===
          'sex-vaginal-penetration:insert_primary_penis_into_your_vagina'
      );

      expect(foundAction).toBeDefined();
    });

    it('appears when the actor is behind a target who faces away', async () => {
      const entities = buildScenario({ targetFacingAway: true });
      testFixture.reset(entities);
      configureActionDiscovery();

      const actions = await testFixture.discoverActions('alana');
      const foundAction = actions.find(
        (action) =>
          action.id ===
          'sex-vaginal-penetration:insert_primary_penis_into_your_vagina'
      );

      expect(foundAction).toBeDefined();
    });

    it('does not appear without closeness', async () => {
      const entities = buildScenario({ includeCloseness: false });
      testFixture.reset(entities);
      configureActionDiscovery();

      const actions = await testFixture.discoverActions('alana');
      const foundAction = actions.find(
        (action) =>
          action.id ===
          'sex-vaginal-penetration:insert_primary_penis_into_your_vagina'
      );

      expect(foundAction).toBeUndefined();
    });

    it('does not appear when the actor vagina is covered', async () => {
      const entities = buildScenario({ coverVagina: true });
      testFixture.reset(entities);
      configureActionDiscovery();

      const actorEntity = testFixture.entityManager.getEntityInstance('alana');
      const prerequisitesPassed =
        testFixture.testEnv.prerequisiteService.evaluate(
          insertPrimaryPenisAction.prerequisites,
          insertPrimaryPenisAction,
          actorEntity
        );
      expect(prerequisitesPassed).toBe(false);

      const actions = await testFixture.discoverActions('alana');
      const foundAction = actions.find(
        (action) =>
          action.id ===
          'sex-vaginal-penetration:insert_primary_penis_into_your_vagina'
      );

      expect(foundAction).toBeUndefined();
    });

    it('does not appear when the actor lacks a vagina', async () => {
      const entities = buildScenario({ includeVagina: false });
      testFixture.reset(entities);
      configureActionDiscovery();

      const actorEntity = testFixture.entityManager.getEntityInstance('alana');
      const prerequisitesPassed =
        testFixture.testEnv.prerequisiteService.evaluate(
          insertPrimaryPenisAction.prerequisites,
          insertPrimaryPenisAction,
          actorEntity
        );
      expect(prerequisitesPassed).toBe(false);

      const actions = await testFixture.discoverActions('alana');
      const foundAction = actions.find(
        (action) =>
          action.id ===
          'sex-vaginal-penetration:insert_primary_penis_into_your_vagina'
      );

      expect(foundAction).toBeUndefined();
    });

    it('does not appear when the actor is already being penetrated vaginally', async () => {
      const entities = buildScenario({ actorBeingFucked: true });
      testFixture.reset(entities);
      configureActionDiscovery();

      const actions = await testFixture.discoverActions('alana');
      const foundAction = actions.find(
        (action) =>
          action.id ===
          'sex-vaginal-penetration:insert_primary_penis_into_your_vagina'
      );

      expect(foundAction).toBeUndefined();
    });

    it('does not appear when the actor is sitting on furniture', async () => {
      const entities = buildScenario({ actorSitting: true });
      testFixture.reset(entities);
      configureActionDiscovery();

      const actions = await testFixture.discoverActions('alana');
      const foundAction = actions.find(
        (action) =>
          action.id ===
          'sex-vaginal-penetration:insert_primary_penis_into_your_vagina'
      );

      expect(foundAction).toBeUndefined();
    });

    it('does not appear when the partner penis is covered', async () => {
      const entities = buildScenario({ coverPenis: true });
      testFixture.reset(entities);
      configureActionDiscovery();

      const actions = await testFixture.discoverActions('alana');
      const foundAction = actions.find(
        (action) =>
          action.id ===
          'sex-vaginal-penetration:insert_primary_penis_into_your_vagina'
      );

      expect(foundAction).toBeUndefined();
    });

    it('does not appear when the partner lacks a penis', async () => {
      const entities = buildScenario({ includePenis: false });
      testFixture.reset(entities);
      configureActionDiscovery();

      const actions = await testFixture.discoverActions('alana');
      const foundAction = actions.find(
        (action) =>
          action.id ===
          'sex-vaginal-penetration:insert_primary_penis_into_your_vagina'
      );

      expect(foundAction).toBeUndefined();
    });
  });
});
