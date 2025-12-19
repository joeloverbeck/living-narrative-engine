import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import EntityDefinition from '../../../../src/entities/entityDefinition.js';
import { CanScootCloserOperator } from '../../../../src/logic/operators/canScootCloserOperator.js';
import EntityManagerIntegrationTestBed from '../../../common/entities/entityManagerIntegrationTestBed.js';

describe('CanScootCloserOperator integration with EntityManager', () => {
  let testBed;
  let entityManager;
  let actorDefinition;
  let furnitureDefinition;
  let actor;
  let bench;
  let operator;

  const registerDefinition = (definition) => {
    testBed.registry.store('entityDefinitions', definition.id, definition);
  };

  const createBench = async (instanceId, spots = []) => {
    const instance = await entityManager.createEntityInstance(
      furnitureDefinition.id,
      { instanceId }
    );
    if (spots) {
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

  const setBenchSpots = async (spots) => {
    await entityManager.addComponent(bench.id, 'sitting:allows_sitting', {
      spots,
    });
  };

  const setActorSitting = async ({ furnitureId = bench.id, spotIndex }) => {
    await entityManager.addComponent(actor.id, 'sitting-states:sitting_on', {
      furniture_id: furnitureId,
      spot_index: spotIndex,
    });
  };

  const evaluate = (contextOverrides = {}) => {
    const context = {
      actor: { id: actor.id },
      target: { id: bench.id },
      ...contextOverrides,
    };
    return operator.evaluate(['actor', 'target'], context);
  };

  beforeEach(async () => {
    testBed = new EntityManagerIntegrationTestBed();
    entityManager = testBed.entityManager;

    actorDefinition = new EntityDefinition('integration:actor', {
      description: 'integration actor',
      components: {},
    });

    furnitureDefinition = new EntityDefinition('integration:bench', {
      description: 'integration bench',
      components: {},
    });

    registerDefinition(actorDefinition);
    registerDefinition(furnitureDefinition);

    actor = await entityManager.createEntityInstance(actorDefinition.id, {
      instanceId: 'actor-1',
    });

    bench = await createBench('bench-1', []);

    operator = new CanScootCloserOperator({
      entityManager,
      logger: testBed.logger,
    });
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  it('returns false when the actor is not sitting on any furniture', async () => {
    await setBenchSpots([null, actor.id]);

    expect(evaluate()).toBe(false);
  });

  it('returns false when actor sits on different furniture', async () => {
    const otherBench = await createBench('bench-2', [actor.id, null]);

    await setActorSitting({ furnitureId: otherBench.id, spotIndex: 1 });
    await setBenchSpots([null, actor.id]);

    expect(evaluate()).toBe(false);
  });

  it('returns false when furniture lacks allows_sitting component', async () => {
    await setActorSitting({ spotIndex: 1 });

    expect(evaluate()).toBe(false);
  });

  it('returns false when furniture has invalid spots data', async () => {
    await setActorSitting({ spotIndex: 1 });
    await entityManager.addComponent(bench.id, 'sitting:allows_sitting', {
      spots: 'invalid',
    });

    expect(evaluate()).toBe(false);
  });

  it('returns false when spot index is not numeric', async () => {
    await setActorSitting({ spotIndex: '2' });
    await setBenchSpots(['left', null, actor.id]);

    expect(evaluate()).toBe(false);
  });

  it('returns false when spot index is negative', async () => {
    await setActorSitting({ spotIndex: -1 });
    await setBenchSpots(['left', actor.id]);

    expect(evaluate()).toBe(false);
  });

  it('returns false when spot index is out of bounds', async () => {
    await setActorSitting({ spotIndex: 3 });
    await setBenchSpots(['left', null]);

    expect(evaluate()).toBe(false);
  });

  it('returns false when furniture state disagrees with actor position', async () => {
    await setActorSitting({ spotIndex: 1 });
    await setBenchSpots(['left', 'another-actor', actor.id]);

    expect(evaluate()).toBe(false);
  });

  it('returns false when actor already occupies the leftmost spot', async () => {
    await setActorSitting({ spotIndex: 0 });
    await setBenchSpots([actor.id, null, 'other']);

    expect(evaluate()).toBe(false);
  });

  it('returns false when the spot to the left is occupied', async () => {
    await setActorSitting({ spotIndex: 2 });
    await setBenchSpots(['left', 'blocking-occupant', actor.id]);

    expect(evaluate()).toBe(false);
  });

  it('returns false when there is no occupant to the left to scoot toward', async () => {
    await setActorSitting({ spotIndex: 2 });
    await setBenchSpots([null, null, actor.id]);

    expect(evaluate()).toBe(false);
  });

  it('returns false when gaps exist between occupants to the left', async () => {
    await setActorSitting({ spotIndex: 4 });
    await setBenchSpots(['left', null, 'closer', null, actor.id]);

    expect(evaluate()).toBe(false);
  });

  it('returns true when earlier positions are empty but the nearest spot has an occupant', async () => {
    await setActorSitting({ spotIndex: 3 });
    await setBenchSpots([null, 'left-neighbor', null, actor.id]);

    expect(evaluate()).toBe(true);
  });

  it('returns true when the actor can scoot closer with a solid block of occupants to the left', async () => {
    await setActorSitting({ spotIndex: 4 });
    await setBenchSpots(['left-one', 'left-two', 'left-three', null, actor.id]);

    expect(evaluate()).toBe(true);
    expect(testBed.logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('can scoot closer')
    );
  });
});
