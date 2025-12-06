import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import '../../../common/mods/domainMatchers.js';
import {
  buildPenetrationScenario,
  ACTION_ID,
} from '../../../common/mods/sex-vaginal-penetration/pullPenisOutOfVaginaFixtures.js';
import pullPenisOutOfVaginaAction from '../../../../data/mods/sex-vaginal-penetration/actions/pull_penis_out_of_vagina.action.json' assert { type: 'json' };

describe('sex-vaginal-penetration:pull_penis_out_of_vagina - Action Discovery', () => {
  let testFixture;

  /**
   *
   */
  function configureActionDiscovery() {
    testFixture.testEnv.actionIndex.buildIndex([pullPenisOutOfVaginaAction]);
  }

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'sex-vaginal-penetration',
      ACTION_ID
    );
    // Removed: restoreScopeResolver = installPullOutScopeOverride(testFixture);
    // Now uses real scope loading from disk to catch scope resolution bugs
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
});
