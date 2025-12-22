/**
 * @file Integration tests for movement:pass_through_breach action discovery.
 * @description Validates discovery gating and target pairing via scope resolution.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from '@jest/globals';
import { readFileSync } from 'fs';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';
import '../../../common/mods/domainMatchers.js';
import { createMinimalTestContainer } from '../../../common/scopeDsl/minimalTestContainer.js';
import { parseScopeDefinitions } from '../../../../src/scopeDsl/scopeDefinitionParser.js';
import { UnifiedScopeResolver } from '../../../../src/actions/scopes/unifiedScopeResolver.js';
import { TargetResolutionService } from '../../../../src/actions/targetResolutionService.js';
import { ActionErrorContextBuilder } from '../../../../src/actions/errors/actionErrorContextBuilder.js';
import { createEntityDefinition } from '../../../common/entities/entityFactories.js';
import passThroughBreachAction from '../../../../data/mods/movement/actions/pass_through_breach.action.json';

const ACTION_ID = 'movement:pass_through_breach';

const registerPassThroughBreachResolvers = (fixture) => {
  const resolveActorLocationId = (context, entityManager) => {
    const actor = context?.actor || context?.actorEntity;
    const actorId = actor?.id;
    const actorPosition =
      actor?.components?.['core:position'] ||
      (actorId ? entityManager.getComponentData(actorId, 'core:position') : null);

    return (
      actorPosition?.locationId ||
      context?.actorLocation?.id ||
      context?.actorLocation ||
      null
    );
  };

  const getLocationExits = (locationId, entityManager) => {
    if (!locationId) {
      return [];
    }

    const location = entityManager.getEntityInstance(locationId);
    const exits = location?.components?.['locations:exits'];
    return Array.isArray(exits) ? exits : [];
  };

  const breachedBlockersResolver = function (context) {
    const entityManager = this.entityManager || fixture.testEnv.entityManager;
    const locationId = resolveActorLocationId(context, entityManager);
    const exits = getLocationExits(locationId, entityManager);

    const breachedBlockers = exits
      .map((exit) => exit?.blocker)
      .filter((blockerId) =>
        blockerId
          ? entityManager.getComponentData(
              blockerId,
              'breaching:breached'
            )
          : false
      );

    return { success: true, value: new Set(breachedBlockers) };
  };

  const destinationsResolver = function (context) {
    const entityManager = this.entityManager || fixture.testEnv.entityManager;
    const locationId = resolveActorLocationId(context, entityManager);
    const breachedBlockerId =
      context?.target?.id || context?.primary?.id || null;

    if (!breachedBlockerId) {
      return { success: true, value: new Set() };
    }

    const exits = getLocationExits(locationId, entityManager);
    const destinations = exits
      .filter((exit) => exit?.blocker === breachedBlockerId)
      .map((exit) => exit?.target)
      .filter(
        (targetId) => typeof targetId === 'string' && targetId.length > 0
      );

    return { success: true, value: new Set(destinations) };
  };

  ScopeResolverHelpers._registerResolvers(
    fixture.testEnv,
    fixture.testEnv.entityManager,
    {
      'breaching:breached_blockers_at_location': breachedBlockersResolver,
      'movement:destinations_for_breached_blocker': destinationsResolver,
    }
  );
};

const createBreachScenario = async (
  fixture,
  { breached = true } = {}
) => {
  const bodyRootId = fixture.createEntity({
    id: 'breach-body-root',
    name: 'Body Root',
    components: [
      { componentId: 'anatomy:part', data: { children: [] } },
      { componentId: 'core:movement', data: { locked: false } },
    ],
  });

  const originId = fixture.createEntity({
    id: 'breach-origin',
    name: 'Breach Hall',
    components: [{ componentId: 'core:location', data: {} }],
  });

  const destinationId = fixture.createEntity({
    id: 'breach-destination',
    name: 'Safe Room',
    components: [{ componentId: 'core:location', data: {} }],
  });

  const blockerComponents = [
    { componentId: 'core:name', data: { text: 'Splintered Gate' } },
  ];
  if (breached) {
    blockerComponents.push({
      componentId: 'breaching:breached',
      data: {},
    });
  }

  const blockerId = fixture.createEntity({
    id: 'breach-blocker',
    name: 'Splintered Gate',
    components: blockerComponents,
  });

  const actorId = fixture.createEntity({
    id: 'breach-actor',
    name: 'Runner',
    components: [
      { componentId: 'core:actor', data: {} },
      { componentId: 'core:position', data: { locationId: originId } },
      { componentId: 'core:movement', data: { locked: false } },
      { componentId: 'anatomy:body', data: { root: bodyRootId } },
    ],
  });

  await fixture.modifyComponent(originId, 'locations:exits', [
    {
      direction: 'through the breach',
      target: destinationId,
      blocker: blockerId,
    },
  ]);

  return {
    originId,
    destinationId,
    blockerId,
    actorId,
  };
};

describe('movement:pass_through_breach action discovery', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('movement', 'pass_through_breach');
    fixture.testEnv.actionIndex.buildIndex([passThroughBreachAction]);
    registerPassThroughBreachResolvers(fixture);
  });

  afterEach(() => {
    if (fixture) {
      fixture.cleanup();
    }
  });

  it('discovers the action when a breached blocker and destination are available', async () => {
    const scenario = await createBreachScenario(fixture, { breached: true });

    const actions = fixture.discoverActions(scenario.actorId);
    expect(actions).toContainAction(ACTION_ID);
  });

  it('does not discover the action when the blocker is not breached', async () => {
    const scenario = await createBreachScenario(fixture, { breached: false });

    const actions = fixture.discoverActions(scenario.actorId);
    expect(actions).not.toContainAction(ACTION_ID);
  });
});

describe('movement:pass_through_breach target pairing', () => {
  let containerHandle;
  let services;
  let targetResolutionService;
  let actorEntity;
  let discoveryContext;
  let blockerAId;
  let blockerBId;
  let destinationAId;
  let destinationBId;

  beforeAll(async () => {
    containerHandle = await createMinimalTestContainer();
    services = containerHandle.services;

    const breachedScopePath = new URL(
      '../../../../data/mods/breaching/scopes/breached_blockers_at_location.scope',
      import.meta.url
    );
    const destinationScopePath = new URL(
      '../../../../data/mods/movement/scopes/destinations_for_breached_blocker.scope',
      import.meta.url
    );

    const breachedScopes = parseScopeDefinitions(
      readFileSync(breachedScopePath, 'utf8'),
      breachedScopePath.pathname
    );
    const destinationScopes = parseScopeDefinitions(
      readFileSync(destinationScopePath, 'utf8'),
      destinationScopePath.pathname
    );

    const scopeDefinitions = {};
    for (const [scopeName, scopeData] of breachedScopes.entries()) {
      scopeDefinitions[scopeName] = {
        expr: scopeData.expr,
        ast: scopeData.ast,
      };
    }
    for (const [scopeName, scopeData] of destinationScopes.entries()) {
      scopeDefinitions[scopeName] = {
        expr: scopeData.expr,
        ast: scopeData.ast,
      };
    }

    services.scopeRegistry.initialize(scopeDefinitions);

    const actionErrorContextBuilder = new ActionErrorContextBuilder({
      entityManager: services.entityManager,
      logger: services.logger,
      fixSuggestionEngine: { suggestFixes: () => [] },
    });

    const unifiedScopeResolver = new UnifiedScopeResolver({
      scopeRegistry: services.scopeRegistry,
      scopeEngine: services.scopeEngine,
      entityManager: services.entityManager,
      jsonLogicEvaluationService: services.jsonLogicEval,
      dslParser: services.dslParser,
      logger: services.logger,
      actionErrorContextBuilder,
    });

    targetResolutionService = new TargetResolutionService({
      unifiedScopeResolver,
      logger: services.logger,
    });

    const registry = services.dataRegistry;
    const entityManager = services.entityManager;

    const storeDefinition = (id, components) => {
      registry.store(
        'entityDefinitions',
        id,
        createEntityDefinition(id, components)
      );
    };

    const createInstance = async (id) => {
      await entityManager.createEntityInstance(id, {
        instanceId: id,
        definitionId: id,
      });
    };

    const originId = 'pairing-origin';
    destinationAId = 'pairing-destination-a';
    destinationBId = 'pairing-destination-b';
    blockerAId = 'pairing-blocker-a';
    blockerBId = 'pairing-blocker-b';
    const actorId = 'pairing-actor';

    storeDefinition(originId, {
      'core:location': {},
      'locations:exits': [
        {
          direction: 'through the first breach',
          target: destinationAId,
          blocker: blockerAId,
        },
        {
          direction: 'through the second breach',
          target: destinationBId,
          blocker: blockerBId,
        },
      ],
    });

    storeDefinition(destinationAId, {
      'core:location': {},
      'core:name': { text: 'Safe Room A' },
    });

    storeDefinition(destinationBId, {
      'core:location': {},
      'core:name': { text: 'Safe Room B' },
    });

    storeDefinition(blockerAId, {
      'core:name': { text: 'Breach A' },
      'breaching:breached': {},
    });

    storeDefinition(blockerBId, {
      'core:name': { text: 'Breach B' },
      'breaching:breached': {},
    });

    storeDefinition(actorId, {
      'core:actor': {},
      'core:name': { text: 'Runner' },
      'core:position': { locationId: originId },
    });

    await Promise.all([
      createInstance(originId),
      createInstance(destinationAId),
      createInstance(destinationBId),
      createInstance(blockerAId),
      createInstance(blockerBId),
      createInstance(actorId),
    ]);

    actorEntity = entityManager.getEntityInstance(actorId);
    discoveryContext = {
      currentLocation: originId,
      entityManager,
      jsonLogicEval: services.jsonLogicEval,
    };
  });

  afterAll(async () => {
    if (containerHandle) {
      await containerHandle.cleanup();
    }
  });

  it('pairs destinations to the matching breached blocker', () => {
    const primaryResult = targetResolutionService.resolveTargets(
      'breaching:breached_blockers_at_location',
      actorEntity,
      discoveryContext,
      null,
      ACTION_ID
    );

    expect(primaryResult.success).toBe(true);
    const primaryIds = primaryResult.value.map((ctx) => ctx.entityId);
    expect(primaryIds).toEqual(
      expect.arrayContaining([blockerAId, blockerBId])
    );

    const resolveDestinations = (blockerId) => {
      const blockerEntity = services.entityManager.getEntityInstance(blockerId);
      const blockerContext = {
        id: blockerId,
        components:
          blockerEntity?.components ||
          blockerEntity?.getAllComponents?.() ||
          {},
      };
      const secondaryContext = { ...discoveryContext, target: blockerContext };

      const secondaryResult = targetResolutionService.resolveTargets(
        'movement:destinations_for_breached_blocker',
        actorEntity,
        secondaryContext,
        null,
        ACTION_ID
      );

      expect(secondaryResult.success).toBe(true);
      return secondaryResult.value.map((ctx) => ctx.entityId);
    };

    expect(resolveDestinations(blockerAId)).toEqual([destinationAId]);
    expect(resolveDestinations(blockerBId)).toEqual([destinationBId]);
  });
});
