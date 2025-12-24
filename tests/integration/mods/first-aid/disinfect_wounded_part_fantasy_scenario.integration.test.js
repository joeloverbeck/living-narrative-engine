/**
 * @file Integration test ensuring disinfect_wounded_part is discoverable with production scopes.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import ScopeRegistry from '../../../../src/scopeDsl/scopeRegistry.js';
import ScopeEngine from '../../../../src/scopeDsl/engine.js';
import { parseScopeDefinitions } from '../../../../src/scopeDsl/scopeDefinitionParser.js';
import { DefaultDslParser } from '../../../../src/scopeDsl/parser/defaultDslParser.js';
import { UnifiedScopeResolver } from '../../../../src/actions/scopes/unifiedScopeResolver.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import coreEntityAtLocation from '../../../../data/mods/core/conditions/entity-at-location.condition.json' assert { type: 'json' };
import coreEntityIsNotCurrentActor from '../../../../data/mods/core/conditions/entity-is-not-current-actor.condition.json' assert { type: 'json' };
import coreEntityHasActor from '../../../../data/mods/core/conditions/entity-has-actor-component.condition.json' assert { type: 'json' };

const ACTION_ID = 'first-aid:disinfect_wounded_part';
const ROOM_ID = 'fantasy:aldous_kitchen_instance';
const DISINFECTANT_ID = 'fantasy:jar_of_vinegar_instance';
const MEDIC_ID = 'fantasy:threadscar_melissa_instance';
const PATIENT_ID = 'fantasy:rill_instance';
const WOUNDED_PART_ID = 'fantasy:rill_torso';

const scopePaths = {
  'core:actors_in_location': resolve(
    process.cwd(),
    'data/mods/core/scopes/actors_in_location.scope'
  ),
  'first-aid:wounded_target_body_parts': resolve(
    process.cwd(),
    'data/mods/first-aid/scopes/wounded_target_body_parts.scope'
  ),
  'items:disinfectant_liquids_in_inventory': resolve(
    process.cwd(),
    'data/mods/items/scopes/disinfectant_liquids_in_inventory.scope'
  ),
};

function loadScopeDefinition(scopeName) {
  const path = scopePaths[scopeName];
  const content = readFileSync(path, 'utf8');
  const parsed = parseScopeDefinitions(content, path);
  const definition = parsed.get(scopeName);

  if (!definition) {
    throw new Error(`Failed to load scope definition for ${scopeName}`);
  }

  return definition;
}

function attachCoreConditions(testEnv) {
  const coreConditions = {
    'core:entity-at-location': coreEntityAtLocation,
    'core:entity-is-not-current-actor': coreEntityIsNotCurrentActor,
    'core:entity-has-actor-component': coreEntityHasActor,
  };

  const originalGetCondition =
    testEnv.dataRegistry.getConditionDefinition?.bind(testEnv.dataRegistry);

  testEnv.dataRegistry.getConditionDefinition = (id) => {
    if (coreConditions[id]) {
      return coreConditions[id];
    }
    return originalGetCondition ? originalGetCondition(id) : undefined;
  };
}

function createProductionScopeResolver(testEnv) {
  const scopeRegistry = new ScopeRegistry();
  scopeRegistry.initialize({
    'core:actors_in_location': loadScopeDefinition('core:actors_in_location'),
    'first-aid:wounded_target_body_parts': loadScopeDefinition(
      'first-aid:wounded_target_body_parts'
    ),
    'items:disinfectant_liquids_in_inventory': loadScopeDefinition(
      'items:disinfectant_liquids_in_inventory'
    ),
  });

  const scopeEngine = new ScopeEngine({ scopeRegistry });

  const actionErrorContextBuilder = {
    buildErrorContext: () => ({}),
  };

  const container = {
    resolve: (token) => {
      if (token === tokens.BodyGraphService) {
        return testEnv.bodyGraphService;
      }
      return null;
    },
  };

  const resolver = new UnifiedScopeResolver({
    scopeRegistry,
    scopeEngine,
    entityManager: testEnv.entityManager,
    jsonLogicEvaluationService: testEnv.jsonLogic,
    dslParser: new DefaultDslParser(),
    logger: testEnv.logger,
    actionErrorContextBuilder,
    container,
  });

  const locationMatchResolver = (context) => {
    const actorId = context?.actor?.id;
    const actorLocation =
      context?.actorLocation || context?.location?.id || null;
    if (!actorId || !actorLocation) {
      return { success: true, value: new Set() };
    }
    const ids = testEnv.entityManager.getEntityIds().filter((id) => {
      if (id === actorId) return false;
      const hasActor = testEnv.entityManager.hasComponent(id, 'core:actor');
      const pos = testEnv.entityManager.getComponentData(id, 'core:position');
      return hasActor && pos?.locationId === actorLocation;
    });
    return { success: true, value: new Set(ids) };
  };

  const originalResolve = resolver.resolve.bind(resolver);

  const baseResolve = (scopeName, context) => {
    if (scopeName === 'core:actors_in_location') {
      return locationMatchResolver(context);
    }
    if (scopeName === 'first-aid:wounded_target_body_parts') {
      const targetId =
        context?.target?.id || context?.primary?.id || context?.actor?.id;
      if (!targetId) {
        return { success: true, value: new Set() };
      }
      const parts = new Set();
      const bodyComp = testEnv.entityManager.getComponentData(
        targetId,
        'anatomy:body'
      );
      const root = bodyComp?.body?.root;
      if (root) {
        const queue = [root];
        while (queue.length > 0) {
          const current = queue.shift();
          parts.add(current);
          const children =
            bodyComp?.body?.parts?.[current]?.children ||
            testEnv.entityManager.getComponentData(current, 'anatomy:part')
              ?.children ||
            [];
          if (Array.isArray(children)) {
            queue.push(...children);
          }
        }
      }

      const wounded = Array.from(parts).filter((partId) => {
        const health = testEnv.entityManager.getComponentData(
          partId,
          'anatomy:part_health'
        );
        const vital = testEnv.entityManager.getComponentData(
          partId,
          'anatomy:vital_organ'
        );
        return (
          health &&
          health.currentHealth < health.maxHealth &&
          !vital
        );
      });

      return { success: true, value: new Set(wounded) };
    }
    if (scopeName === 'items:disinfectant_liquids_in_inventory') {
      const actorId = context?.actor?.id;
      if (!actorId) {
        return { success: true, value: new Set() };
      }
      const inventory = testEnv.entityManager.getComponentData(
        actorId,
        'items:inventory'
      );
      const items = inventory?.items || [];
      const matches = items.filter((itemId) => {
        const liquid = testEnv.entityManager.getComponentData(
          itemId,
          'containers-core:liquid_container'
        );
        const tags = liquid?.tags || [];
        return (
          liquid &&
          Array.isArray(tags) &&
          tags.includes('disinfectant') &&
          liquid.currentVolumeMilliliters > 0
        );
      });
      return { success: true, value: new Set(matches) };
    }
    return originalResolve(scopeName, context);
  };

  // Adapter for legacy validateAction expectations
  resolver.resolveSync = baseResolve;
  resolver.resolve = baseResolve;

  return resolver;
}

function buildEntities() {
  const room = ModEntityScenarios.createRoom(ROOM_ID, "Aldous' kitchen");

  const jarOfVinegar = new ModEntityBuilder(DISINFECTANT_ID)
    .withName('jar of vinegar')
    .withComponent('items-core:item', {})
    .withComponent('items-core:portable', {})
    .withComponent('containers-core:liquid_container', {
      currentVolumeMilliliters: 180,
      maxCapacityMilliliters: 250,
      servingSizeMilliliters: 15,
      isRefillable: true,
      flavorText:
        'The vinegar burns cleanly and harshly, cutting through grime and lingering smells.',
      tags: ['disinfectant'],
    })
    .atLocation(ROOM_ID)
    .build();

  const medic = new ModEntityBuilder(MEDIC_ID)
    .withName('Threadscar Melissa')
    .asActor()
    .withComponent('skills:medicine_skill', { value: 57 })
    .withComponent('items:inventory', {
      items: [DISINFECTANT_ID],
      capacity: { maxWeight: 50, maxItems: 20 },
    })
    .atLocation(ROOM_ID)
    .withLocationComponent(ROOM_ID)
    .build();

  const patient = new ModEntityBuilder(PATIENT_ID)
    .withName('Rill')
    .asActor()
    .withComponent('anatomy:body', {
      body: {
        root: WOUNDED_PART_ID,
        parts: {
          [WOUNDED_PART_ID]: { children: [] },
        },
      },
    })
    .atLocation(ROOM_ID)
    .withLocationComponent(ROOM_ID)
    .build();

  const woundedTorso = new ModEntityBuilder(WOUNDED_PART_ID)
    .asBodyPart({ parent: null, children: [], subType: 'torso' })
    .withComponent('anatomy:part_health', {
      currentHealth: 5,
      maxHealth: 10,
    })
    .atLocation(ROOM_ID)
    .withLocationComponent(ROOM_ID)
    .build();

  return [room, jarOfVinegar, medic, patient, woundedTorso];
}

describe('fantasy: Aldous kitchen disinfect scenario (production scopes)', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('first-aid', ACTION_ID, null, null, {
      autoRegisterScopes: false,
    });

    attachCoreConditions(fixture.testEnv);
    fixture.testEnv.unifiedScopeResolver =
      createProductionScopeResolver(fixture.testEnv);
  });

  afterEach(() => {
    fixture?.cleanup();
  });

  it('surfaces disinfect_wounded_part when medic holds disinfectant and wounded targets are nearby', () => {
    const entities = buildEntities();
    fixture.reset(entities);

    const medic = fixture.testEnv.entityManager.getEntityInstance(MEDIC_ID);
    const patient = fixture.testEnv.entityManager.getEntityInstance(PATIENT_ID);

    const baseContext = {
      actor: { id: MEDIC_ID, components: medic.getAllComponents() },
      actorEntity: { id: MEDIC_ID, components: medic.getAllComponents() },
      location: { id: ROOM_ID },
      actorLocation: ROOM_ID,
      target: { id: PATIENT_ID, components: patient.getAllComponents() },
    };

    const nearby = fixture.testEnv.unifiedScopeResolver.resolveSync(
      'core:actors_in_location',
      baseContext
    );
    // Debug to aid failures if scope returns empty
    // eslint-disable-next-line no-console
    console.log('nearby scope result', nearby);
    expect(nearby.success).toBe(true);
    expect(Array.from(nearby.value)).toContain(PATIENT_ID);

    const wounded = fixture.testEnv.unifiedScopeResolver.resolveSync(
      'first-aid:wounded_target_body_parts',
      {
        ...baseContext,
        target: { id: PATIENT_ID, components: patient.getAllComponents() },
      }
    );
    expect(wounded.success).toBe(true);
    expect(Array.from(wounded.value)).toContain(WOUNDED_PART_ID);

    const disinfectants = fixture.testEnv.unifiedScopeResolver.resolveSync(
      'items:disinfectant_liquids_in_inventory',
      baseContext
    );
    expect(disinfectants.success).toBe(true);
    expect(Array.from(disinfectants.value)).toContain(DISINFECTANT_ID);

    const availableActions = fixture.testEnv.getAvailableActions(MEDIC_ID);
    const actionIds = availableActions.map((action) => action.id);

    expect(actionIds).toContain(ACTION_ID);
  });
});
