/**
 * @file Integration tests for lighting:ignite_light_source action discovery.
 * @description Validates discovery rules for combustible, unlit light sources.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';
import igniteLightAction from '../../../../data/mods/lighting/actions/ignite_light_source.action.json' assert { type: 'json' };
import {
  createActorWithLightSource,
  createCandle,
  createElectricLight,
  createLitOilLamp,
  createOilLamp,
} from '../../../common/mods/lighting/lightingFixtures.js';

const ACTION_ID = 'lighting:ignite_light_source';

describe('lighting:ignite_light_source action discovery', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('lighting', ACTION_ID);
    await ScopeResolverHelpers.registerCustomScope(
      testFixture.testEnv,
      'lighting',
      'unlit_combustible_light_sources_in_inventory'
    );

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }
      testEnv.actionIndex.buildIndex([igniteLightAction]);
    };
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('should discover action when actor has an unlit oil lamp in inventory', () => {
    const room = ModEntityScenarios.createRoom('lamp_room', 'Lamp Room');
    const lightSource = createOilLamp('lighting:oil_lamp');
    const actor = createActorWithLightSource('lighting:actor1', lightSource.id, {
      name: 'Avery',
      locationId: room.id,
    });

    testFixture.reset([room, actor, lightSource]);
    configureActionDiscovery();

    const availableActions = testFixture.testEnv.getAvailableActions(actor.id);

    expect(availableActions).toContainAction(ACTION_ID);
  });

  it('should discover action when actor has an unlit candle in inventory', () => {
    const room = ModEntityScenarios.createRoom('candle_room', 'Candle Room');
    const lightSource = createCandle('lighting:candle');
    const actor = createActorWithLightSource('lighting:actor2', lightSource.id, {
      name: 'Morgan',
      locationId: room.id,
    });

    testFixture.reset([room, actor, lightSource]);
    configureActionDiscovery();

    const availableActions = testFixture.testEnv.getAvailableActions(actor.id);

    expect(availableActions).toContainAction(ACTION_ID);
  });

  it('should not discover action when actor has no light sources', () => {
    const room = ModEntityScenarios.createRoom('empty_room', 'Empty Room');
    const actor = new ModEntityBuilder('lighting:actor3')
      .withName('Sky')
      .atLocation(room.id)
      .asActor()
      .withComponent('inventory:inventory', {
        items: [],
        capacity: { maxWeight: 50, maxItems: 10 },
      })
      .build();

    testFixture.reset([room, actor]);
    configureActionDiscovery();

    const availableActions = testFixture.testEnv.getAvailableActions(actor.id);

    expect(availableActions).not.toContainAction(ACTION_ID);
  });

  it('should not discover action when all light sources are already lit', () => {
    const room = ModEntityScenarios.createRoom('lit_room', 'Lit Room');
    const lightSource = createLitOilLamp('lighting:lit_oil_lamp');
    const actor = createActorWithLightSource('lighting:actor4', lightSource.id, {
      name: 'Jules',
      locationId: room.id,
    });

    testFixture.reset([room, actor, lightSource]);
    configureActionDiscovery();

    const availableActions = testFixture.testEnv.getAvailableActions(actor.id);

    expect(availableActions).not.toContainAction(ACTION_ID);
  });

  it('should not discover action for electric light sources', () => {
    const room = ModEntityScenarios.createRoom('electric_room', 'Electric Room');
    const lightSource = createElectricLight('lighting:electric_light');
    const actor = createActorWithLightSource('lighting:actor5', lightSource.id, {
      name: 'Casey',
      locationId: room.id,
    });

    testFixture.reset([room, actor, lightSource]);
    configureActionDiscovery();

    const availableActions = testFixture.testEnv.getAvailableActions(actor.id);

    expect(availableActions).not.toContainAction(ACTION_ID);
  });

  it('should not discover action when light source is not in inventory', () => {
    const room = ModEntityScenarios.createRoom('floor_room', 'Floor Room');
    const lightSource = createOilLamp('lighting:floor_lamp');
    const actor = new ModEntityBuilder('lighting:actor6')
      .withName('Quinn')
      .atLocation(room.id)
      .asActor()
      .withComponent('inventory:inventory', {
        items: [],
        capacity: { maxWeight: 50, maxItems: 10 },
      })
      .build();

    testFixture.reset([room, actor, lightSource]);
    configureActionDiscovery();

    const availableActions = testFixture.testEnv.getAvailableActions(actor.id);

    expect(availableActions).not.toContainAction(ACTION_ID);
  });
});
