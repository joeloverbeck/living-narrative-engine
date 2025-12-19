import { beforeEach, describe, expect, it } from '@jest/globals';
import { IsClosestLeftOccupantOperator } from '../../../../src/logic/operators/isClosestLeftOccupantOperator.js';
import { SimpleEntityManager } from '../../../common/entities/index.js';

/**
 *
 */
function createTestLogger() {
  const logs = { debug: [], info: [], warn: [], error: [] };
  return {
    logs,
    debug: (...args) => logs.debug.push(args),
    info: (...args) => logs.info.push(args),
    warn: (...args) => logs.warn.push(args),
    error: (...args) => logs.error.push(args),
  };
}

describe('IsClosestLeftOccupantOperator - integration', () => {
  let entityManager;
  let logger;
  let operator;

  const furnitureId = 'furniture-1';
  const actorId = 'actor-1';
  const candidateId = 'candidate-1';

  beforeEach(() => {
    entityManager = new SimpleEntityManager([
      { id: furnitureId, components: {} },
      { id: actorId, components: {} },
      { id: candidateId, components: {} },
      { id: 'left-1', components: {} },
      { id: 'left-2', components: {} },
      { id: 'other-furniture', components: {} },
    ]);

    logger = createTestLogger();
    operator = new IsClosestLeftOccupantOperator({
      entityManager,
      logger,
    });
  });

  const contextFor = (candidate = candidateId) => ({
    entity: entityManager.getEntityInstance(candidate),
    target: entityManager.getEntityInstance(furnitureId),
    actor: entityManager.getEntityInstance(actorId),
  });

  const evaluate = (params, context = contextFor()) =>
    operator.evaluate(params, context);

  const setSitting = async (entityId, targetId, spotIndex) => {
    await entityManager.addComponent(entityId, 'positioning:sitting_on', {
      furniture_id: targetId,
      spot_index: spotIndex,
    });
  };

  const setFurnitureSpots = async (spots) => {
    await entityManager.addComponent(
      furnitureId,
      'sitting:allows_sitting',
      {
        spots,
      }
    );
  };

  it('returns true when candidate is the closest left occupant and the adjacent slot is free', async () => {
    await setSitting(actorId, furnitureId, 3);
    await setSitting(candidateId, furnitureId, 1);
    await setSitting('left-1', furnitureId, 0);
    await setFurnitureSpots(['left-1', candidateId, null, actorId]);

    expect(evaluate(['entity', 'target', 'actor'])).toBe(true);
  });

  it('resolves the actor from alternate context paths', async () => {
    await setSitting(actorId, furnitureId, 2);
    await setSitting(candidateId, furnitureId, 0);
    await setFurnitureSpots([candidateId, null, actorId]);

    const context = contextFor();
    context.actorAlias = context.actor;

    expect(evaluate(['entity', 'target', 'actorAlias'], context)).toBe(true);
  });

  it('returns false when the immediate left slot of the actor is occupied', async () => {
    await setSitting(actorId, furnitureId, 3);
    await setSitting(candidateId, furnitureId, 1);
    await setSitting('left-1', furnitureId, 2);
    await setFurnitureSpots(['left-2', candidateId, 'left-1', actorId]);

    expect(evaluate(['entity', 'target', 'actor'])).toBe(false);
  });

  it('returns false when another occupant sits closer to the actor', async () => {
    await setSitting(actorId, furnitureId, 4);
    await setSitting(candidateId, furnitureId, 0);
    await setSitting('left-1', furnitureId, 2);
    await setFurnitureSpots([candidateId, null, 'left-1', null, actorId]);

    expect(evaluate(['entity', 'target', 'actor'])).toBe(false);
  });

  it('returns false when the candidate is not sitting on the target furniture', async () => {
    await setSitting(actorId, furnitureId, 2);
    await setSitting(candidateId, 'other-furniture', 0);
    await setFurnitureSpots(['left-1', null, actorId]);

    expect(evaluate(['entity', 'target', 'actor'])).toBe(false);
  });

  it('returns false when the actor is seated on different furniture', async () => {
    await setSitting(actorId, 'other-furniture', 1);
    await setSitting(candidateId, furnitureId, 0);
    await setFurnitureSpots([candidateId, null]);

    expect(evaluate(['entity', 'target', 'actor'])).toBe(false);
  });

  it('returns false when the furniture record does not list the candidate at its slot', async () => {
    await setSitting(actorId, furnitureId, 3);
    await setSitting(candidateId, furnitureId, 1);
    await setFurnitureSpots(['left-1', 'someone-else', null, actorId]);

    expect(evaluate(['entity', 'target', 'actor'])).toBe(false);
  });

  it('returns false when the candidate lacks a sitting component', async () => {
    await setSitting(actorId, furnitureId, 2);
    await setFurnitureSpots([null, null, actorId]);

    expect(evaluate(['entity', 'target', 'actor'])).toBe(false);
  });

  it('returns false when the actor is not seated', async () => {
    await setSitting(candidateId, furnitureId, 1);
    await setFurnitureSpots(['left-1', candidateId, null]);

    expect(evaluate(['entity', 'target', 'actor'])).toBe(false);
  });

  it('returns false when parameters are missing', () => {
    expect(evaluate(['entity', 'target'], contextFor())).toBe(false);
    expect(logger.logs.warn.at(-1)[0]).toMatch(
      'Missing required actor parameter'
    );
  });

  it('returns false when the actor path cannot be resolved', async () => {
    await setSitting(actorId, furnitureId, 2);
    await setSitting(candidateId, furnitureId, 0);
    await setFurnitureSpots([candidateId, null, actorId]);

    expect(evaluate(['entity', 'target', 'missingPath'], contextFor())).toBe(
      false
    );
  });

  it('returns false when indices are outside the furniture configuration', async () => {
    await setSitting(actorId, furnitureId, 5);
    await setSitting(candidateId, furnitureId, 0);
    await setFurnitureSpots([candidateId, null, null]);

    expect(evaluate(['entity', 'target', 'actor'])).toBe(false);
  });

  it('returns false when spot indices are not numeric', async () => {
    await entityManager.addComponent(actorId, 'positioning:sitting_on', {
      furniture_id: furnitureId,
      spot_index: '2',
    });
    await setSitting(candidateId, furnitureId, 0);
    await setFurnitureSpots([candidateId, null, actorId]);

    expect(evaluate(['entity', 'target', 'actor'])).toBe(false);
  });

  it('returns false when the candidate is to the right of the actor', async () => {
    await setSitting(actorId, furnitureId, 0);
    await setSitting(candidateId, furnitureId, 2);
    await setFurnitureSpots([actorId, null, candidateId]);

    expect(evaluate(['entity', 'target', 'actor'])).toBe(false);
  });

  it('returns false when the furniture has no allows_sitting definition', async () => {
    await setSitting(actorId, furnitureId, 2);
    await setSitting(candidateId, furnitureId, 0);

    expect(evaluate(['entity', 'target', 'actor'])).toBe(false);
  });

  it('returns false when the furniture record mismatches the actor seat', async () => {
    await setSitting(actorId, furnitureId, 3);
    await setSitting(candidateId, furnitureId, 1);
    await setFurnitureSpots(['left-1', candidateId, null, 'other-actor']);

    expect(evaluate(['entity', 'target', 'actor'])).toBe(false);
  });
});
