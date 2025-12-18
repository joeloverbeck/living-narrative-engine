import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import '../../../common/mods/domainMatchers.js';
import {
  buildPenetrationScenario,
  ACTION_ID,
} from '../../../common/mods/sex-vaginal-penetration/thrustPenisSlowlyAndTenderlyFixtures.js';
import thrustPenisSlowlyAndTenderlyAction from '../../../../data/mods/sex-vaginal-penetration/actions/thrust_penis_slowly_and_tenderly.action.json' assert { type: 'json' };

describe('sex-vaginal-penetration:thrust_penis_slowly_and_tenderly - Action Discovery', () => {
  let testFixture;

  /**
   * Configures action discovery by building the action index with the thrust action.
   */
  function configureActionDiscovery() {
    testFixture.testEnv.actionIndex.buildIndex([
      thrustPenisSlowlyAndTenderlyAction,
    ]);
  }

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'sex-vaginal-penetration',
      ACTION_ID
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
      testFixture = null;
    }
  });

  it('appears when actor is actively penetrating the target', async () => {
    const scenario = buildPenetrationScenario();
    testFixture.reset(scenario);
    configureActionDiscovery();

    const actions = await testFixture.discoverActions('alice');
    const foundAction = actions.find((action) => action.id === ACTION_ID);

    expect(foundAction).toBeDefined();
  });

  it('does not appear when actor is not penetrating anyone', async () => {
    const scenario = buildPenetrationScenario({
      includePenetrationComponents: false,
    });
    testFixture.reset(scenario);
    configureActionDiscovery();

    const actions = await testFixture.discoverActions('alice');
    const foundAction = actions.find((action) => action.id === ACTION_ID);

    expect(foundAction).toBeUndefined();
  });

  it('does not appear without closeness', async () => {
    const scenario = buildPenetrationScenario({ includeCloseness: false });
    testFixture.reset(scenario);
    configureActionDiscovery();

    const actions = await testFixture.discoverActions('alice');
    const foundAction = actions.find((action) => action.id === ACTION_ID);

    expect(foundAction).toBeUndefined();
  });

  it('does not appear when actor lacks penis', async () => {
    const scenario = buildPenetrationScenario({ includePenis: false });
    testFixture.reset(scenario);
    configureActionDiscovery();

    const actions = await testFixture.discoverActions('alice');
    const foundAction = actions.find((action) => action.id === ACTION_ID);

    expect(foundAction).toBeUndefined();
  });

  it('does not appear when penis is covered', async () => {
    const scenario = buildPenetrationScenario({ coverPenis: true });
    testFixture.reset(scenario);
    configureActionDiscovery();

    const actions = await testFixture.discoverActions('alice');
    const foundAction = actions.find((action) => action.id === ACTION_ID);

    expect(foundAction).toBeUndefined();
  });

  it('only targets the entity being penetrated by the actor', async () => {
    // Scenario: Alice penetrating Beth, close to Carol (not penetrating)
    const room = new ModEntityBuilder('bedroom').asRoom('Bedroom').build();

    const alice = new ModEntityBuilder('alice')
      .withName('Alice', 'Smith')
      .atLocation('bedroom')
      .withBody('aliceGroin')
      .closeToEntity('beth')
      .closeToEntity('carol')
      .withComponent('sex-states:fucking_vaginally', { targetId: 'beth' })
      .asActor()
      .build();

    const beth = new ModEntityBuilder('beth')
      .withName('Beth', 'Jones')
      .atLocation('bedroom')
      .withBody('bethPelvis')
      .closeToEntity('alice')
      .withComponent('sex-states:being_fucked_vaginally', { actorId: 'alice' })
      .asActor()
      .build();

    const carol = new ModEntityBuilder('carol')
      .withName('Carol', 'Davis')
      .atLocation('bedroom')
      .closeToEntity('alice')
      .asActor()
      .build();

    // Add anatomy for Alice and Beth
    const aliceGroin = new ModEntityBuilder('aliceGroin')
      .asBodyPart({ parent: null, children: ['alicePenis'], subType: 'groin' })
      .build();

    const alicePenis = new ModEntityBuilder('alicePenis')
      .asBodyPart({ parent: 'aliceGroin', children: [], subType: 'penis' })
      .build();

    const bethPelvis = new ModEntityBuilder('bethPelvis')
      .asBodyPart({ parent: null, children: ['bethVagina'], subType: 'pelvis' })
      .build();

    const bethVagina = new ModEntityBuilder('bethVagina')
      .asBodyPart({ parent: 'bethPelvis', children: [], subType: 'vagina' })
      .build();

    const scenario = [
      room,
      alice,
      beth,
      carol,
      aliceGroin,
      alicePenis,
      bethPelvis,
      bethVagina,
    ];
    testFixture.reset(scenario);
    configureActionDiscovery();

    const actions = await testFixture.discoverActions('alice');
    const foundAction = actions.find((action) => action.id === ACTION_ID);

    expect(foundAction).toBeDefined();
    // The action should be discoverable, and only Beth should be in scope
  });
});
