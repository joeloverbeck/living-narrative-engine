/**
 * @file Unit tests for registerCustomScope context normalization
 * @description Ensures ModTestFixture.registerCustomScope accepts supported context formats
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ParameterValidator } from '../../../../src/scopeDsl/core/parameterValidator.js';

describe('ModTestFixture - registerCustomScope context normalization', () => {
  let testFixture;
  let actorEntity;
  let resolver;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'sitting',
      'sitting:sit_down'
    );
    const scenario = testFixture.createStandardActorTarget();
    actorEntity = scenario.actor;

    await testFixture.registerCustomScope('sitting', 'actors_sitting_close', {
      loadConditions: false,
    });

    resolver = testFixture.testEnv._registeredResolvers.get(
      'sitting:actors_sitting_close'
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  const extractResultIds = (result) =>
    result.value instanceof Set ? [...result.value].sort() : result.value;

  it('should accept direct entity format { id, components }', () => {
    const result = resolver(actorEntity);

    expect(result.success).toBe(true);
    expect(result.value).toBeInstanceOf(Set);
  });

  it('should accept enriched context { actorEntity: {...} }', () => {
    const baseline = resolver(actorEntity);
    const result = resolver({ actorEntity });

    expect(result.success).toBe(true);
    expect(extractResultIds(result)).toEqual(extractResultIds(baseline));
  });

  it('should accept actor pipeline context { actor: {...} }', () => {
    const baseline = resolver(actorEntity);
    const result = resolver({ actor: actorEntity, targets: {} });

    expect(result.success).toBe(true);
    expect(extractResultIds(result)).toEqual(extractResultIds(baseline));
  });

  it('should fail validation when no id extractable from any format', () => {
    const result = resolver({ unrelated: 'data' });

    expect(result.success).toBe(false);
    expect(result.error).toContain("actorEntity must have an 'id' property");
  });

  it('should preserve original entity reference after normalization', () => {
    const validateSpy = jest.spyOn(
      ParameterValidator,
      'validateActorEntity'
    );

    resolver({ actorEntity });

    const validatedEntity = validateSpy.mock.calls[0][0];
    expect(validatedEntity).toBe(actorEntity);
  });
});
