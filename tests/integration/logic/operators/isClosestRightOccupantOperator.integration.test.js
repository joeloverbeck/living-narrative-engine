import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import EntityDefinition from '../../../../src/entities/entityDefinition.js';
import { IsClosestRightOccupantOperator } from '../../../../src/logic/operators/isClosestRightOccupantOperator.js';
import EntityManagerIntegrationTestBed from '../../../common/entities/entityManagerIntegrationTestBed.js';

/**
 * Integration coverage for {@link IsClosestRightOccupantOperator} using the real
 * {@link EntityManager}. The scenarios deliberately exercise the edge cases that
 * were previously only covered by unit tests, ensuring the operator interacts
 * correctly with actual entity data and component updates.
 */
describe('IsClosestRightOccupantOperator integration with EntityManager', () => {
  let testBed;
  let entityManager;
  let actor;
  let candidate;
  let bench;
  let operator;
  let benchDefinition;

  const registerDefinition = (definition) => {
    testBed.registry.store('entityDefinitions', definition.id, definition);
  };

  const createBench = async (instanceId, spots = undefined) => {
    const instance = await entityManager.createEntityInstance(
      benchDefinition.id,
      {
        instanceId,
      }
    );
    if (spots !== undefined) {
      await entityManager.addComponent(
        instance.id,
        'sitting:allows_sitting',
        {
          spots,
        }
      );
    }
    return instance;
  };

  const setActorSitting = async ({ furnitureId = bench.id, spotIndex }) => {
    await entityManager.addComponent(actor.id, 'positioning:sitting_on', {
      furniture_id: furnitureId,
      spot_index: spotIndex,
    });
  };

  const setCandidateSitting = async ({ furnitureId = bench.id, spotIndex }) => {
    await entityManager.addComponent(candidate.id, 'positioning:sitting_on', {
      furniture_id: furnitureId,
      spot_index: spotIndex,
    });
  };

  const setBenchSpots = async (spots) => {
    await entityManager.addComponent(bench.id, 'sitting:allows_sitting', {
      spots,
    });
  };

  const evaluate = (
    params = ['candidate', 'target', 'actor'],
    contextOverrides = {}
  ) => {
    const context = {
      candidate: { id: candidate.id },
      target: { id: bench.id },
      actor: { id: actor.id },
      ...contextOverrides,
    };
    return operator.evaluate(params, context);
  };

  beforeEach(async () => {
    testBed = new EntityManagerIntegrationTestBed();
    entityManager = testBed.entityManager;

    const actorDefinition = new EntityDefinition('integration:actor', {
      description: 'integration actor',
      components: {},
    });
    benchDefinition = new EntityDefinition('integration:bench', {
      description: 'integration bench',
      components: {},
    });

    registerDefinition(actorDefinition);
    registerDefinition(benchDefinition);

    actor = await entityManager.createEntityInstance(actorDefinition.id, {
      instanceId: 'actor-1',
    });
    candidate = await entityManager.createEntityInstance(actorDefinition.id, {
      instanceId: 'candidate-1',
    });
    bench = await createBench('bench-1', []);

    operator = new IsClosestRightOccupantOperator({
      entityManager,
      logger: testBed.logger,
    });
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  it('returns false when actor parameter is missing', async () => {
    await setBenchSpots([actor.id, null, candidate.id]);
    await setActorSitting({ spotIndex: 0 });
    await setCandidateSitting({ spotIndex: 2 });

    expect(evaluate(['candidate', 'target'])).toBe(false);
    expect(testBed.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Missing required actor parameter')
    );
  });

  it('logs a warning when actor path cannot be resolved', async () => {
    await setBenchSpots([actor.id, null, candidate.id]);
    await setActorSitting({ spotIndex: 0 });
    await setCandidateSitting({ spotIndex: 2 });

    expect(evaluate(['candidate', 'target', 'mentor'])).toBe(false);
    expect(testBed.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Could not resolve actor')
    );
  });

  it('resolves the actor using an alternate context key', async () => {
    await setBenchSpots([actor.id, null, candidate.id]);
    await setActorSitting({ spotIndex: 0 });
    await setCandidateSitting({ spotIndex: 2 });

    expect(
      evaluate(['candidate', 'target', 'mentor'], {
        mentor: { id: actor.id },
      })
    ).toBe(true);
  });

  it('supports actor identifiers provided as primitive strings', async () => {
    await setBenchSpots([actor.id, null, candidate.id]);
    await setActorSitting({ spotIndex: 0 });
    await setCandidateSitting({ spotIndex: 2 });

    expect(
      evaluate(['candidate', 'target', 'actor'], {
        actor: actor.id,
      })
    ).toBe(true);
  });

  it('returns false when the actor is not sitting', async () => {
    await setBenchSpots([actor.id, null, candidate.id]);
    await setCandidateSitting({ spotIndex: 2 });

    expect(evaluate()).toBe(false);
    expect(testBed.logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('is not sitting (no sitting_on component)')
    );
  });

  it('returns false when the actor sits on different furniture', async () => {
    const otherBench = await createBench('bench-2', [
      actor.id,
      null,
      candidate.id,
    ]);
    await setActorSitting({ furnitureId: otherBench.id, spotIndex: 0 });
    await setCandidateSitting({ spotIndex: 2 });
    await setBenchSpots([actor.id, null, candidate.id]);

    expect(evaluate()).toBe(false);
  });

  it('returns false when the candidate is not sitting', async () => {
    await setBenchSpots([actor.id, null, candidate.id]);
    await setActorSitting({ spotIndex: 0 });

    expect(evaluate()).toBe(false);
    expect(testBed.logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Candidate')
    );
  });

  it('returns false when the candidate sits on different furniture', async () => {
    const otherBench = await createBench('bench-2', [candidate.id, null]);
    await setActorSitting({ spotIndex: 0 });
    await setCandidateSitting({ furnitureId: otherBench.id, spotIndex: 0 });
    await setBenchSpots([actor.id, null, candidate.id]);

    expect(evaluate()).toBe(false);
  });

  it('returns false when spot indices are not numeric', async () => {
    await setBenchSpots([actor.id, null, candidate.id]);
    await setActorSitting({ spotIndex: '0' });
    await setCandidateSitting({ spotIndex: 2 });

    expect(evaluate()).toBe(false);
    expect(testBed.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Invalid spot_index values')
    );
  });

  it('returns false when the candidate is not to the right of the actor', async () => {
    await setBenchSpots([candidate.id, actor.id, null]);
    await setActorSitting({ spotIndex: 1 });
    await setCandidateSitting({ spotIndex: 0 });

    expect(evaluate()).toBe(false);
  });

  it('returns false when allows_sitting data is missing', async () => {
    await setActorSitting({ spotIndex: 0 });
    await setCandidateSitting({ spotIndex: 1 });

    expect(evaluate()).toBe(false);
  });

  it('returns false when allows_sitting spots are invalid', async () => {
    await entityManager.addComponent(bench.id, 'sitting:allows_sitting', {
      spots: 'invalid',
    });
    await setActorSitting({ spotIndex: 0 });
    await setCandidateSitting({ spotIndex: 1 });

    expect(evaluate()).toBe(false);
  });

  it('returns false when indices are out of bounds', async () => {
    await setBenchSpots([actor.id, null]);
    await setActorSitting({ spotIndex: 0 });
    await setCandidateSitting({ spotIndex: 3 });

    expect(evaluate()).toBe(false);
    expect(testBed.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Indices out of bounds')
    );
  });

  it('returns false when furniture disagrees with the actor position', async () => {
    await setBenchSpots([null, candidate.id, null]);
    await setActorSitting({ spotIndex: 0 });
    await setCandidateSitting({ spotIndex: 1 });

    expect(evaluate()).toBe(false);
    expect(testBed.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Actor')
    );
  });

  it('returns false when furniture disagrees with the candidate position', async () => {
    await setBenchSpots([actor.id, null, null]);
    await setActorSitting({ spotIndex: 0 });
    await setCandidateSitting({ spotIndex: 2 });

    expect(evaluate()).toBe(false);
    expect(testBed.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Candidate')
    );
  });

  it('returns false when the immediate right spot is occupied', async () => {
    await setBenchSpots([actor.id, 'blocker', candidate.id]);
    await setActorSitting({ spotIndex: 0 });
    await setCandidateSitting({ spotIndex: 2 });

    expect(evaluate()).toBe(false);
  });

  it('returns false when another occupant is closer to the actor', async () => {
    await setBenchSpots([actor.id, null, 'closer', candidate.id]);
    await setActorSitting({ spotIndex: 0 });
    await setCandidateSitting({ spotIndex: 3 });

    expect(evaluate()).toBe(false);
  });

  it('returns true when the candidate is the first occupant to the right', async () => {
    await setBenchSpots([actor.id, null, candidate.id, 'further']);
    await setActorSitting({ spotIndex: 0 });
    await setCandidateSitting({ spotIndex: 2 });

    expect(evaluate()).toBe(true);
  });
});
