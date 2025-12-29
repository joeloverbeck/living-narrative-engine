/**
 * @file Unit tests for registerCustomScope location resolution
 * @description Ensures runtimeCtx.location is derived from actor core:position
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import ModEntityBuilder from '../../../common/mods/ModEntityBuilder.js';
import ScopeEngine from '../../../../src/scopeDsl/engine.js';

describe('ModTestFixture - registerCustomScope location resolution', () => {
  let testFixture;
  let resolver;
  let resolveSpy;
  let capturedRuntimeCtx;

  const captureRuntimeCtx = () => {
    capturedRuntimeCtx = null;
    resolveSpy = jest
      .spyOn(ScopeEngine.prototype, 'resolve')
      .mockImplementation((ast, actorEntity, runtimeCtx) => {
        capturedRuntimeCtx = runtimeCtx;
        return new Set();
      });
  };

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'sitting',
      'sitting:sit_down'
    );
    await testFixture.registerCustomScope('sitting', 'actors_sitting_close', {
      loadConditions: false,
    });
    resolver = testFixture.testEnv._registeredResolvers.get(
      'sitting:actors_sitting_close'
    );
  });

  afterEach(() => {
    if (resolveSpy) {
      resolveSpy.mockRestore();
      resolveSpy = null;
    }
    if (testFixture) {
      testFixture.cleanup();
    }
    capturedRuntimeCtx = null;
  });

  it('should resolve location from actor core:position component', () => {
    const scenario = testFixture.createStandardActorTarget();
    captureRuntimeCtx();

    const result = resolver(scenario.actor);

    expect(result.success).toBe(true);
    expect(capturedRuntimeCtx.location).toBeTruthy();
    expect(capturedRuntimeCtx.location.id).toBe(
      scenario.actor.components['core:position'].locationId
    );
  });

  it('should set location to null when actor has no position', () => {
    const actor = new ModEntityBuilder('actor1')
      .withName('Alice')
      .asActor()
      .build();
    testFixture.reset([actor]);
    captureRuntimeCtx();

    const result = resolver(actor);

    expect(result.success).toBe(true);
    expect(capturedRuntimeCtx.location).toBe(null);
  });

  it('should set location to null when locationId references missing entity', () => {
    const actor = new ModEntityBuilder('actor1')
      .withName('Alice')
      .atLocation('missing-room')
      .asActor()
      .build();
    testFixture.reset([actor]);
    captureRuntimeCtx();

    const result = resolver(actor);

    expect(result.success).toBe(true);
    expect(capturedRuntimeCtx.location).toBe(null);
  });

  it('should pass location entity to runtimeCtx for scope evaluation', () => {
    const scenario = testFixture.createStandardActorTarget();
    const locationId = scenario.actor.components['core:position'].locationId;
    const locationEntity = testFixture.testEnv.entityManager.getEntityInstance(
      locationId
    );
    captureRuntimeCtx();

    const result = resolver(scenario.actor);

    expect(result.success).toBe(true);
    expect(capturedRuntimeCtx.location).toBe(locationEntity);
  });
});
