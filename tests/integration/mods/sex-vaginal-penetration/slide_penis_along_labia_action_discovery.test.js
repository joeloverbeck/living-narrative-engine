/**
 * @file Integration tests for sex-vaginal-penetration:slide_penis_along_labia action discovery.
 * @description Confirms the slide penis along labia action appears only when anatomy, exposure, orientation, and positioning requirements are satisfied.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import slidePenisAlongLabiaAction from '../../../../data/mods/sex-vaginal-penetration/actions/slide_penis_along_labia.action.json';

describe('sex-vaginal-penetration:slide_penis_along_labia action discovery', () => {
  let testFixture;
  let configureActionDiscovery;
  let restoreScopeResolver;

  /**
   * @description Determines whether an entity has a vagina anatomy part.
   * @param {object} entity - Entity instance to inspect.
   * @returns {boolean} True if the entity has a vagina body part.
   */
  function entityHasVagina(entity) {
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

      if (anatomyPart.subType === 'vagina') {
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
   * @description Resolves the uncovered vagina scope using the test fixture entity state.
   * @param {object} context - Resolver context passed by the scope system.
   * @returns {object} Scope resolution result mirroring engine semantics.
   */
  function resolveUncoveredVaginaScope(context) {
    const actorId = context?.actor?.id;

    if (!actorId) {
      return { success: true, value: new Set() };
    }

    const actorEntity = testFixture.entityManager.getEntityInstance(actorId);
    const closeness = actorEntity?.components?.['positioning:closeness'];
    const partners = Array.isArray(closeness?.partners)
      ? closeness.partners
      : [];

    if (partners.length === 0) {
      return { success: true, value: new Set() };
    }

    const actorFacingAway =
      actorEntity?.components?.['positioning:facing_away']?.facing_away_from ||
      [];

    const validPartners = partners.filter((partnerId) => {
      const partner = testFixture.entityManager.getEntityInstance(partnerId);

      if (!partner) {
        return false;
      }

      if (!entityHasVagina(partner)) {
        return false;
      }

      if (isSocketCovered(partner, 'vagina')) {
        return false;
      }

      const partnerFacingAway =
        partner.components?.['positioning:facing_away']?.facing_away_from || [];

      const facingEachOther =
        !partnerFacingAway.includes(actorId) &&
        !actorFacingAway.includes(partnerId);
      const actorBehindTarget = partnerFacingAway.includes(actorId);

      if (!facingEachOther && !actorBehindTarget) {
        return false;
      }

      const partnerKneelingBeforeActor =
        partner.components?.['positioning:kneeling_before']?.entityId ===
        actorId;
      const actorKneelingBeforePartner =
        actorEntity?.components?.['positioning:kneeling_before']?.entityId ===
        partnerId;

      if (partnerKneelingBeforeActor || actorKneelingBeforePartner) {
        return false;
      }

      return true;
    });

    return { success: true, value: new Set(validPartners) };
  }

  /**
   * @description Builds entities for discovery scenarios with configurable positioning.
   * @param {object} [options] - Scenario configuration options.
   * @param {boolean} [options.targetFacingAway] - Whether the target faces away from the actor.
   * @param {boolean} [options.includeCloseness] - Whether both entities share closeness.
   * @param {boolean} [options.coverVagina] - Whether clothing covers the target's vagina.
   * @param {boolean} [options.includePenis] - Whether to include a penis anatomy part for the actor.
   * @param {boolean} [options.coverPenis] - Whether clothing covers the actor's penis.
   * @param {boolean} [options.actorKneeling] - Whether the actor kneels before the target.
   * @param {boolean} [options.targetKneeling] - Whether the target kneels before the actor.
   * @param {boolean} [options.targetSitting] - Whether the target is sitting on furniture.
   * @param {boolean} [options.includeVagina] - Whether to include a vagina anatomy part.
   * @returns {Array<object>} Entities to load into the test environment.
   */
  function buildScenario(options = {}) {
    const {
      targetFacingAway = false,
      includeCloseness = true,
      coverVagina = false,
      actorKneeling = false,
      targetKneeling = false,
      includeVagina = true,
      includePenis = true,
      coverPenis = false,
      targetSitting = false,
      actorFuckingVaginally = false,
    } = options;

    const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

    const actorGroinId = includePenis
      ? 'actorGroinWithPenis1'
      : 'actorGroinNoPenis1';
    const actorPenisId = `${actorGroinId}_penis`;

    const actorBuilder = new ModEntityBuilder('alice')
      .withName('Alice')
      .atLocation('room1')
      .withBody(actorGroinId)
      .asActor();

    const targetBuilder = new ModEntityBuilder('beth')
      .withName('Beth')
      .atLocation('room1')
      .withBody('targetPelvis1')
      .asActor();

    if (includeCloseness) {
      actorBuilder.closeToEntity('beth');
      targetBuilder.closeToEntity('alice');
    }

    if (actorFuckingVaginally) {
      actorBuilder.withComponent('sex-states:fucking_vaginally', {
        targetId: 'beth',
      });
    }

    if (actorKneeling) {
      actorBuilder.kneelingBefore('beth');
    }

    if (targetKneeling) {
      targetBuilder.kneelingBefore('alice');
    }

    if (targetFacingAway) {
      targetBuilder.withComponent('positioning:facing_away', {
        facing_away_from: ['alice'],
      });
    }

    if (targetSitting) {
      targetBuilder.withComponent('positioning:sitting_on', {
        furniture_id: 'stool1',
        spot_index: 0,
      });
    }

    if (coverVagina) {
      targetBuilder
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
      actorBuilder
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

    const pelvisChildren = includeVagina ? ['vagina1'] : [];
    const actorGroinChildren = includePenis ? [actorPenisId] : [];
    const targetPelvis = new ModEntityBuilder('targetPelvis1')
      .asBodyPart({
        parent: null,
        children: pelvisChildren,
        subType: 'pelvis',
      })
      .build();

    const actorGroin = new ModEntityBuilder(actorGroinId)
      .asBodyPart({
        parent: null,
        children: actorGroinChildren,
        subType: 'groin',
      })
      .build();

    const vagina = includeVagina
      ? new ModEntityBuilder('vagina1')
          .asBodyPart({
            parent: 'targetPelvis1',
            children: [],
            subType: 'vagina',
          })
          .build()
      : null;

    const actorPenis = includePenis
      ? new ModEntityBuilder(actorPenisId)
          .asBodyPart({
            parent: actorGroinId,
            children: [],
            subType: 'penis',
          })
          .build()
      : null;

    const furniture = targetSitting
      ? new ModEntityBuilder('stool1')
          .withName('Stool')
          .atLocation('room1')
          .build()
      : null;

    const entities = [room, actor, target, actorGroin, targetPelvis];

    if (vagina) {
      entities.push(vagina);
    }

    if (actorPenis) {
      entities.push(actorPenis);
    }

    if (coverVagina) {
      entities.push(new ModEntityBuilder('skirt1').withName('skirt').build());
    }

    if (coverPenis) {
      entities.push(new ModEntityBuilder('pants1').withName('pants').build());
    }

    if (furniture) {
      entities.push(furniture);
    }

    return entities;
  }

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'sex',
      'sex-vaginal-penetration:slide_penis_along_labia'
    );

    const { testEnv } = testFixture;

    configureActionDiscovery = () => {
      testEnv.actionIndex.buildIndex([slidePenisAlongLabiaAction]);
    };

    const resolver = testEnv.unifiedScopeResolver;
    const originalResolveSync = resolver.resolveSync;

    resolver.resolveSync = (scopeName, context) => {
      if (
        scopeName ===
        'sex-vaginal-penetration:actors_with_uncovered_vagina_facing_each_other_or_target_facing_away'
      ) {
        return resolveUncoveredVaginaScope(context);
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

  it('appears when target has an uncovered vagina and actors face each other', async () => {
    const entities = buildScenario();
    testFixture.reset(entities);
    configureActionDiscovery();

    const actorEntity = testFixture.entityManager.getEntityInstance('alice');
    const hasPenis = testFixture.testEnv.jsonLogic.evaluate(
      { hasPartOfType: ['actor', 'penis'] },
      { actor: { id: 'alice' } }
    );
    const penisUncovered = testFixture.testEnv.jsonLogic.evaluate(
      { not: { isSocketCovered: ['actor', 'penis'] } },
      { actor: { id: 'alice' } }
    );
    expect(hasPenis).toBe(true);
    expect(penisUncovered).toBe(true);

    const prerequisitesPassed =
      testFixture.testEnv.prerequisiteService.evaluate(
        slidePenisAlongLabiaAction.prerequisites,
        slidePenisAlongLabiaAction,
        actorEntity
      );
    expect(prerequisitesPassed).toBe(true);

    expect(
      testFixture.testEnv.validateAction(
        'alice',
        'sex-vaginal-penetration:slide_penis_along_labia'
      )
    ).toBe(true);

    const actions = await testFixture.discoverActions('alice');
    const foundAction = actions.find(
      (action) =>
        action.id === 'sex-vaginal-penetration:slide_penis_along_labia'
    );

    expect(foundAction).toBeDefined();
    expect(foundAction.id).toBe(
      'sex-vaginal-penetration:slide_penis_along_labia'
    );
  });

  it('appears when actor is behind a target who is facing away', async () => {
    const entities = buildScenario({ targetFacingAway: true });
    testFixture.reset(entities);
    configureActionDiscovery();

    const actions = await testFixture.discoverActions('alice');
    const foundAction = actions.find(
      (action) =>
        action.id === 'sex-vaginal-penetration:slide_penis_along_labia'
    );

    expect(foundAction).toBeDefined();
  });

  it('does not appear when the target lacks a vagina', async () => {
    const entities = buildScenario({ includeVagina: false });
    testFixture.reset(entities);
    configureActionDiscovery();

    const actions = await testFixture.discoverActions('alice');
    const foundAction = actions.find(
      (action) =>
        action.id === 'sex-vaginal-penetration:slide_penis_along_labia'
    );

    expect(foundAction).toBeUndefined();
  });

  it('does not appear when the target vagina is covered', async () => {
    const entities = buildScenario({ coverVagina: true });
    testFixture.reset(entities);
    configureActionDiscovery();

    const vaginaCovered = testFixture.testEnv.jsonLogic.evaluate(
      { isSocketCovered: ['target', 'vagina'] },
      { actor: { id: 'alice' }, target: { id: 'beth' } }
    );
    expect(vaginaCovered).toBe(true);

    const actions = await testFixture.discoverActions('alice');
    const foundAction = actions.find(
      (action) =>
        action.id === 'sex-vaginal-penetration:slide_penis_along_labia'
    );

    expect(foundAction).toBeUndefined();
  });

  it('does not appear without closeness between actors', async () => {
    const entities = buildScenario({ includeCloseness: false });
    testFixture.reset(entities);
    configureActionDiscovery();

    const actions = await testFixture.discoverActions('alice');
    const foundAction = actions.find(
      (action) =>
        action.id === 'sex-vaginal-penetration:slide_penis_along_labia'
    );

    expect(foundAction).toBeUndefined();
  });

  it('does not appear when the actor is already fucking vaginally', async () => {
    const entities = buildScenario({ actorFuckingVaginally: true });
    testFixture.reset(entities);
    configureActionDiscovery();

    expect(
      testFixture.testEnv.validateAction(
        'alice',
        'sex-vaginal-penetration:slide_penis_along_labia'
      )
    ).toBe(false);

    const actions = await testFixture.discoverActions('alice');
    const foundAction = actions.find(
      (action) =>
        action.id === 'sex-vaginal-penetration:slide_penis_along_labia'
    );

    expect(foundAction).toBeUndefined();
  });

  it('does not appear when the actor is kneeling before the target', async () => {
    const entities = buildScenario({ actorKneeling: true });
    testFixture.reset(entities);
    configureActionDiscovery();

    const actions = await testFixture.discoverActions('alice');
    const foundAction = actions.find(
      (action) =>
        action.id === 'sex-vaginal-penetration:slide_penis_along_labia'
    );

    expect(foundAction).toBeUndefined();
  });

  it('does not appear when the target is kneeling before the actor', async () => {
    const entities = buildScenario({ targetKneeling: true });
    testFixture.reset(entities);
    configureActionDiscovery();

    const actions = await testFixture.discoverActions('alice');
    const foundAction = actions.find(
      (action) =>
        action.id === 'sex-vaginal-penetration:slide_penis_along_labia'
    );

    expect(foundAction).toBeUndefined();
  });

  it('does not appear when the target is sitting on furniture', async () => {
    const entities = buildScenario({ targetSitting: true });
    testFixture.reset(entities);
    configureActionDiscovery();

    expect(
      testFixture.testEnv.validateAction(
        'alice',
        'sex-vaginal-penetration:slide_penis_along_labia'
      )
    ).toBe(false);

    const actions = await testFixture.discoverActions('alice');
    const foundAction = actions.find(
      (action) =>
        action.id === 'sex-vaginal-penetration:slide_penis_along_labia'
    );

    expect(foundAction).toBeUndefined();
  });

  it('does not appear when the actor lacks a penis', async () => {
    const entities = buildScenario({ includePenis: false });
    testFixture.reset(entities);
    configureActionDiscovery();

    const hasPenis = testFixture.testEnv.jsonLogic.evaluate(
      { hasPartOfType: ['actor', 'penis'] },
      { actor: { id: 'alice' } }
    );
    expect(hasPenis).toBe(false);

    const actions = await testFixture.discoverActions('alice');
    const foundAction = actions.find(
      (action) =>
        action.id === 'sex-vaginal-penetration:slide_penis_along_labia'
    );

    expect(foundAction).toBeUndefined();
  });

  it("does not appear when the actor's penis is covered", async () => {
    const entities = buildScenario({ coverPenis: true });
    testFixture.reset(entities);
    configureActionDiscovery();

    const equipment = testFixture.entityManager.getComponentData(
      'alice',
      'clothing:equipment'
    );
    expect(equipment).toBeDefined();
    expect(equipment.equipped?.torso_lower?.base).toEqual(['pants1']);

    const slotMetadata = testFixture.entityManager.getComponentData(
      'alice',
      'clothing:slot_metadata'
    );
    expect(slotMetadata).toBeDefined();
    expect(slotMetadata.slotMappings?.torso_lower?.coveredSockets).toContain(
      'penis'
    );

    const penisCovered = testFixture.testEnv.jsonLogic.evaluate(
      { isSocketCovered: ['actor', 'penis'] },
      { actor: { id: 'alice' } }
    );
    expect(penisCovered).toBe(true);

    const actions = await testFixture.discoverActions('alice');
    const foundAction = actions.find(
      (action) =>
        action.id === 'sex-vaginal-penetration:slide_penis_along_labia'
    );

    expect(foundAction).toBeUndefined();
  });

  it('does not appear when the actor is receiving a blowjob', async () => {
    const entities = buildScenario();

    // Add receiving_blowjob component to the actor
    const actorEntity = entities.find((e) => e.id === 'alice');
    actorEntity.components['sex-states:receiving_blowjob'] = {
      giving_entity_id: 'beth',
      consented: true,
    };

    testFixture.reset(entities);
    configureActionDiscovery();

    const actions = await testFixture.discoverActions('alice');
    const foundAction = actions.find(
      (action) =>
        action.id === 'sex-vaginal-penetration:slide_penis_along_labia'
    );

    expect(foundAction).toBeUndefined();
  });
});
