/**
 * @file Integration tests for sex-vaginal-penetration:insert_penis_into_vagina action discovery.
 * @description Ensures the penetration initiation action appears only when anatomy, exposure,
 * positioning, and state requirements are satisfied.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import insertPenisIntoVaginaAction from '../../../../data/mods/sex-vaginal-penetration/actions/insert_penis_into_vagina.action.json';
import slidePenisAlongLabiaAction from '../../../../data/mods/sex-vaginal-penetration/actions/slide_penis_along_labia.action.json';

describe('sex-vaginal-penetration:insert_penis_into_vagina action discovery', () => {
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

      const partnerSitting = partner.components?.['positioning:sitting_on'];
      if (partnerSitting) {
        return false;
      }

      return true;
    });

    return { success: true, value: new Set(validPartners) };
  }

  /**
   * @description Builds entities for discovery scenarios with configurable positioning and state.
   * @param {object} [options] - Scenario configuration options.
   * @param {boolean} [options.targetFacingAway] - Whether the target faces away from the actor.
   * @param {boolean} [options.includeCloseness] - Whether both entities share closeness.
   * @param {boolean} [options.coverVagina] - Whether clothing covers the target's vagina.
   * @param {boolean} [options.includePenis] - Whether to include a penis anatomy part for the actor.
   * @param {boolean} [options.coverPenis] - Whether clothing covers the actor's penis.
   * @param {boolean} [options.targetSitting] - Whether the target is sitting on furniture.
   * @param {boolean} [options.actorSitting] - Whether the actor is sitting on furniture.
   * @param {boolean} [options.targetStraddling] - Whether the target is straddling the actor's waist.
   * @param {boolean} [options.includePenetrationComponent] - Whether the actor starts with the penetration state component.
   * @returns {Array<object>} Entities to load into the test environment.
   */
  function buildScenario(options = {}) {
    const {
      targetFacingAway = false,
      includeCloseness = true,
      coverVagina = false,
      includePenis = true,
      coverPenis = false,
      targetSitting = false,
      actorSitting = false,
      targetStraddling = false,
      includePenetrationComponent = false,
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

    if (includePenetrationComponent) {
      actorBuilder.withComponent('positioning:fucking_vaginally', {
        targetId: 'beth',
      });
      targetBuilder.withComponent('positioning:being_fucked_vaginally', {
        actorId: 'alice',
      });
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

    if (actorSitting) {
      actorBuilder.withComponent('positioning:sitting_on', {
        furniture_id: 'stool1',
        spot_index: 0,
      });
    }

    if (targetStraddling) {
      targetBuilder.withComponent('positioning:straddling_waist', {
        target_id: 'alice',
        facing_away: false,
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

    const pelvisChildren = ['vagina1'];
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

    const vagina = new ModEntityBuilder('vagina1')
      .asBodyPart({
        parent: 'targetPelvis1',
        children: [],
        subType: 'vagina',
      })
      .build();

    const entities = [room, actor, target, actorGroin, targetPelvis, vagina];

    if (includePenis) {
      const actorPenis = new ModEntityBuilder(actorPenisId)
        .asBodyPart({
          parent: actorGroinId,
          children: [],
          subType: 'penis',
        })
        .build();
      entities.push(actorPenis);
    }

    if (coverVagina) {
      entities.push(new ModEntityBuilder('skirt1').withName('Skirt').build());
    }

    if (coverPenis) {
      entities.push(new ModEntityBuilder('pants1').withName('Pants').build());
    }

    if (targetSitting || actorSitting) {
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
      'sex-vaginal-penetration:insert_penis_into_vagina'
    );

    const { testEnv } = testFixture;

    configureActionDiscovery = () => {
      testEnv.actionIndex.buildIndex([insertPenisIntoVaginaAction]);
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

  describe('Action structure validation', () => {
    it('should define core metadata correctly', () => {
      expect(insertPenisIntoVaginaAction.id).toBe(
        'sex-vaginal-penetration:insert_penis_into_vagina'
      );
      expect(insertPenisIntoVaginaAction.name).toBe('Insert Penis Into Vagina');
      expect(insertPenisIntoVaginaAction.description).toBe(
        "Insert your penis into your partner's vagina to initiate vaginal penetration."
      );
      expect(insertPenisIntoVaginaAction.template).toBe(
        "insert your penis into {primary}'s vagina"
      );
    });

    it('should reuse uncovered vagina scope and placeholders', () => {
      expect(insertPenisIntoVaginaAction.targets.primary.scope).toBe(
        'sex-vaginal-penetration:actors_with_uncovered_vagina_facing_each_other_or_target_facing_away'
      );
      expect(insertPenisIntoVaginaAction.targets.primary.placeholder).toBe(
        'primary'
      );
      expect(insertPenisIntoVaginaAction.targets.primary.description).toBe(
        'Partner with an uncovered vagina who is positioned for penetration'
      );
    });

    it('should require actor closeness to the target', () => {
      expect(insertPenisIntoVaginaAction.required_components.actor).toEqual([
        'positioning:closeness',
      ]);
    });

    it('should forbid actors already penetrating vaginally or receiving blowjob', () => {
      expect(insertPenisIntoVaginaAction.forbidden_components.actor).toEqual([
        'positioning:fucking_vaginally',
        'positioning:receiving_blowjob',
      ]);
    });

    it('should forbid the target from sitting on furniture', () => {
      expect(insertPenisIntoVaginaAction.forbidden_components.primary).toEqual([
        'positioning:sitting_on',
      ]);
    });

    it('should copy prerequisites from slide penis along labia', () => {
      expect(insertPenisIntoVaginaAction.prerequisites).toEqual(
        slidePenisAlongLabiaAction.prerequisites
      );
    });

    it('should match the sex-vaginal-penetration visual styling palette', () => {
      expect(insertPenisIntoVaginaAction.visual).toEqual({
        backgroundColor: '#6c0f36',
        textColor: '#ffe6ef',
        hoverBackgroundColor: '#861445',
        hoverTextColor: '#fff2f7',
      });
    });
  });

  describe('Action discovery scenarios', () => {
    it('appears when target vagina is uncovered and actors meet state requirements', async () => {
      const entities = buildScenario();
      testFixture.reset(entities);
      configureActionDiscovery();

      const actorEntity = testFixture.entityManager.getEntityInstance('alice');
      const prerequisitesPassed =
        testFixture.testEnv.prerequisiteService.evaluate(
          insertPenisIntoVaginaAction.prerequisites,
          insertPenisIntoVaginaAction,
          actorEntity
        );
      expect(prerequisitesPassed).toBe(true);

      expect(
        testFixture.testEnv.validateAction(
          'alice',
          'sex-vaginal-penetration:insert_penis_into_vagina'
        )
      ).toBe(true);

      const actions = await testFixture.discoverActions('alice');
      const foundAction = actions.find(
        (action) =>
          action.id === 'sex-vaginal-penetration:insert_penis_into_vagina'
      );

      expect(foundAction).toBeDefined();
    });

    it('appears when the actor is behind a target who faces away', async () => {
      const entities = buildScenario({ targetFacingAway: true });
      testFixture.reset(entities);
      configureActionDiscovery();

      const actions = await testFixture.discoverActions('alice');
      const foundAction = actions.find(
        (action) =>
          action.id === 'sex-vaginal-penetration:insert_penis_into_vagina'
      );

      expect(foundAction).toBeDefined();
    });

    it('appears when the actor is sitting and the target straddles their waist', async () => {
      const entities = buildScenario({
        actorSitting: true,
        targetStraddling: true,
      });
      testFixture.reset(entities);
      configureActionDiscovery();

      const actions = await testFixture.discoverActions('alice');
      const foundAction = actions.find(
        (action) =>
          action.id === 'sex-vaginal-penetration:insert_penis_into_vagina'
      );

      expect(foundAction).toBeDefined();
    });

    it('does not appear when the actor is already penetrating the target', async () => {
      const entities = buildScenario({ includePenetrationComponent: true });
      testFixture.reset(entities);
      configureActionDiscovery();

      const actions = await testFixture.discoverActions('alice');
      const foundAction = actions.find(
        (action) =>
          action.id === 'sex-vaginal-penetration:insert_penis_into_vagina'
      );

      expect(foundAction).toBeUndefined();
    });

    it('does not appear when the target vagina is covered', async () => {
      const entities = buildScenario({ coverVagina: true });
      testFixture.reset(entities);
      configureActionDiscovery();

      const actions = await testFixture.discoverActions('alice');
      const foundAction = actions.find(
        (action) =>
          action.id === 'sex-vaginal-penetration:insert_penis_into_vagina'
      );

      expect(foundAction).toBeUndefined();
    });

    it("does not appear when the actor's penis is covered", async () => {
      const entities = buildScenario({ coverPenis: true });
      testFixture.reset(entities);
      configureActionDiscovery();

      const actions = await testFixture.discoverActions('alice');
      const foundAction = actions.find(
        (action) =>
          action.id === 'sex-vaginal-penetration:insert_penis_into_vagina'
      );

      expect(foundAction).toBeUndefined();
    });

    it('does not appear when actors are not close', async () => {
      const entities = buildScenario({ includeCloseness: false });
      testFixture.reset(entities);
      configureActionDiscovery();

      const actions = await testFixture.discoverActions('alice');
      const foundAction = actions.find(
        (action) =>
          action.id === 'sex-vaginal-penetration:insert_penis_into_vagina'
      );

      expect(foundAction).toBeUndefined();
    });

    it('does not appear when the target is sitting', async () => {
      const entities = buildScenario({ targetSitting: true });
      testFixture.reset(entities);
      configureActionDiscovery();

      expect(
        testFixture.testEnv.validateAction(
          'alice',
          'sex-vaginal-penetration:insert_penis_into_vagina'
        )
      ).toBe(false);

      const actions = await testFixture.discoverActions('alice');
      const foundAction = actions.find(
        (action) =>
          action.id === 'sex-vaginal-penetration:insert_penis_into_vagina'
      );

      expect(foundAction).toBeUndefined();
    });

    it('does not appear when the actor lacks a penis', async () => {
      const entities = buildScenario({ includePenis: false });
      testFixture.reset(entities);
      configureActionDiscovery();

      const actions = await testFixture.discoverActions('alice');
      const foundAction = actions.find(
        (action) =>
          action.id === 'sex-vaginal-penetration:insert_penis_into_vagina'
      );

      expect(foundAction).toBeUndefined();
    });

    it('does not appear when the actor is receiving a blowjob', async () => {
      const entities = buildScenario();

      // Add receiving_blowjob component to the actor
      const actorEntity = entities.find((e) => e.id === 'alice');
      actorEntity.components['positioning:receiving_blowjob'] = {
        giving_entity_id: 'beth',
        consented: true,
      };

      testFixture.reset(entities);
      configureActionDiscovery();

      const actions = await testFixture.discoverActions('alice');
      const foundAction = actions.find(
        (action) =>
          action.id === 'sex-vaginal-penetration:insert_penis_into_vagina'
      );

      expect(foundAction).toBeUndefined();
    });
  });
});
