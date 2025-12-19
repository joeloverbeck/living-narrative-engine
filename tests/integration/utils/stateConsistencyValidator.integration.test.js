import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import EntityDefinition from '../../../src/entities/entityDefinition.js';
import { StateConsistencyValidator } from '../../../src/utils/stateConsistencyValidator.js';
import EntityManagerIntegrationTestBed from '../../common/entities/entityManagerIntegrationTestBed.js';

class TestLogger {
  constructor() {
    this.debugMessages = [];
    this.infoMessages = [];
    this.warnMessages = [];
    this.errorMessages = [];
  }

  debug(message, context) {
    this.debugMessages.push({ message, context });
  }

  info(message, context) {
    this.infoMessages.push({ message, context });
  }

  warn(message, context) {
    this.warnMessages.push({ message, context });
  }

  error(message, context) {
    this.errorMessages.push({ message, context });
  }

  reset() {
    this.debugMessages = [];
    this.infoMessages = [];
    this.warnMessages = [];
    this.errorMessages = [];
  }
}

describe('StateConsistencyValidator integration', () => {
  let testBed;
  let entityManager;
  let logger;
  let validator;
  let actorDefinition;
  let furnitureDefinition;

  const registerDefinition = (definition) => {
    testBed.mocks.registry.store(
      'entityDefinitions',
      definition.id,
      definition
    );
  };

  const createActor = async (instanceId) => {
    return await entityManager.createEntityInstance(actorDefinition.id, {
      instanceId,
    });
  };

  const createFurniture = async (instanceId, spotCount = 1) => {
    const furniture = await entityManager.createEntityInstance(
      furnitureDefinition.id,
      { instanceId }
    );
    await entityManager.addComponent(
      furniture.id,
      'sitting:allows_sitting',
      { spots: new Array(spotCount).fill(null) }
    );
    return furniture;
  };

  beforeEach(() => {
    testBed = new EntityManagerIntegrationTestBed();
    entityManager = testBed.entityManager;
    logger = new TestLogger();
    validator = new StateConsistencyValidator({
      logger,
      entityManager,
    });

    actorDefinition = new EntityDefinition('integration:actor', {
      description: 'integration actor',
      components: {},
    });

    furnitureDefinition = new EntityDefinition('integration:furniture', {
      description: 'integration furniture',
      components: {},
    });

    registerDefinition(actorDefinition);
    registerDefinition(furnitureDefinition);
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  it('detects unidirectional closeness relationships and clears when symmetry is restored', async () => {
    const actorOne = await createActor('actor-one');
    const actorTwo = await createActor('actor-two');

    await entityManager.addComponent(actorOne.id, 'personal-space-states:closeness', {
      partners: [actorTwo.id],
    });
    await entityManager.addComponent(actorTwo.id, 'personal-space-states:closeness', {
      partners: [],
    });

    const issues = validator.validateAllClosenessRelationships();

    expect(issues).toEqual([
      expect.objectContaining({
        type: 'unidirectional_closeness',
        from: actorOne.id,
        to: actorTwo.id,
      }),
    ]);
    expect(logger.warnMessages).toEqual([
      expect.objectContaining({
        message: 'Closeness relationship consistency issues found',
        context: expect.objectContaining({
          issues: expect.arrayContaining([
            expect.objectContaining({ from: actorOne.id, to: actorTwo.id }),
          ]),
        }),
      }),
    ]);

    logger.reset();
    await entityManager.addComponent(actorTwo.id, 'personal-space-states:closeness', {
      partners: [actorOne.id],
    });

    const resolvedIssues = validator.validateAllClosenessRelationships();

    expect(resolvedIssues).toHaveLength(0);
    expect(logger.warnMessages).toHaveLength(0);
  });

  it('flags orphaned movement locks and honors sitting state as resolution', async () => {
    const actor = await createActor('actor-with-lock');
    await entityManager.addComponent(actor.id, 'core:movement', {
      locked: true,
    });

    const issues = validator.validateMovementLocks();

    expect(issues).toEqual([
      expect.objectContaining({
        type: 'orphaned_movement_lock',
        entityId: actor.id,
      }),
    ]);
    expect(logger.warnMessages[0]).toEqual(
      expect.objectContaining({
        message: 'Movement lock consistency issues found',
        context: expect.objectContaining({
          issues: expect.arrayContaining([
            expect.objectContaining({ entityId: actor.id }),
          ]),
        }),
      })
    );

    logger.reset();
    await entityManager.addComponent(actor.id, 'sitting-states:sitting_on', {
      furniture_id: 'bench-one',
      spot_index: 0,
    });

    const resolved = validator.validateMovementLocks();

    expect(resolved).toHaveLength(0);
    expect(logger.warnMessages).toHaveLength(0);
  });

  it('validates furniture occupancy and distinguishes missing and mismatched sitting data', async () => {
    const furniture = await createFurniture('bench-two', 2);
    const occupant = await createActor('seated-actor');

    await entityManager.addComponent(
      furniture.id,
      'sitting:allows_sitting',
      {
        spots: [occupant.id, null],
      }
    );

    const missingIssues = validator.validateFurnitureOccupancy();

    expect(missingIssues).toEqual([
      expect.objectContaining({
        type: 'missing_sitting_component',
        furnitureId: furniture.id,
        occupantId: occupant.id,
        spotIndex: 0,
      }),
    ]);

    logger.reset();
    await entityManager.addComponent(occupant.id, 'sitting-states:sitting_on', {
      furniture_id: 'other-bench',
      spot_index: 1,
    });

    const mismatchIssues = validator.validateFurnitureOccupancy();

    expect(mismatchIssues).toEqual([
      expect.objectContaining({
        type: 'sitting_mismatch',
        furnitureId: furniture.id,
        occupantId: occupant.id,
        spotIndex: 0,
        actualFurniture: 'other-bench',
        actualSpot: 1,
      }),
    ]);

    logger.reset();
    await entityManager.addComponent(occupant.id, 'sitting-states:sitting_on', {
      furniture_id: furniture.id,
      spot_index: 0,
    });

    const resolved = validator.validateFurnitureOccupancy();

    expect(resolved).toHaveLength(0);
    expect(logger.warnMessages).toHaveLength(0);
  });

  it('aggregates validation results into a comprehensive report', async () => {
    const closenessSource = await createActor('actor-three');
    const closenessTarget = await createActor('actor-four');
    const movementActor = await createActor('actor-five');
    const furniture = await createFurniture('bench-three');
    const furnitureOccupant = await createActor('actor-six');

    await entityManager.addComponent(
      closenessSource.id,
      'personal-space-states:closeness',
      {
        partners: [closenessTarget.id],
      }
    );
    await entityManager.addComponent(
      closenessTarget.id,
      'personal-space-states:closeness',
      {
        partners: [],
      }
    );
    await entityManager.addComponent(movementActor.id, 'core:movement', {
      locked: true,
    });
    await entityManager.addComponent(
      furniture.id,
      'sitting:allows_sitting',
      {
        spots: [furnitureOccupant.id],
      }
    );

    const report = validator.performFullValidation();

    expect(report.totalIssues).toBe(3);
    expect(report.closenessIssues).toHaveLength(1);
    expect(report.movementLockIssues).toHaveLength(1);
    expect(report.furnitureOccupancyIssues).toHaveLength(1);
    expect(logger.warnMessages.length).toBeGreaterThanOrEqual(3);

    logger.reset();

    await entityManager.addComponent(
      closenessTarget.id,
      'personal-space-states:closeness',
      {
        partners: [closenessSource.id],
      }
    );
    await entityManager.addComponent(movementActor.id, 'core:movement', {
      locked: false,
    });
    await entityManager.addComponent(
      furnitureOccupant.id,
      'sitting-states:sitting_on',
      {
        furniture_id: furniture.id,
        spot_index: 0,
      }
    );

    const cleanReport = validator.performFullValidation();

    expect(cleanReport.totalIssues).toBe(0);
    expect(cleanReport.closenessIssues).toHaveLength(0);
    expect(cleanReport.movementLockIssues).toHaveLength(0);
    expect(cleanReport.furnitureOccupancyIssues).toHaveLength(0);
    expect(logger.infoMessages).toEqual([
      expect.objectContaining({
        message: 'State consistency validation passed - no issues found',
      }),
    ]);
  });

  it('repairs supported issue types and reports unrecoverable cases', async () => {
    const closenessSource = await createActor('actor-seven');
    const closenessTarget = await createActor('actor-eight');
    const movementActor = await createActor('actor-nine');
    const mismatchOccupant = await createActor('actor-ten');
    const missingOccupant = await createActor('actor-eleven');
    const furniture = await createFurniture('bench-four', 2);

    await entityManager.addComponent(
      closenessSource.id,
      'personal-space-states:closeness',
      {
        partners: [closenessTarget.id],
      }
    );
    await entityManager.addComponent(
      closenessTarget.id,
      'personal-space-states:closeness',
      {
        partners: [],
      }
    );
    await entityManager.addComponent(movementActor.id, 'core:movement', {
      locked: true,
    });
    await entityManager.addComponent(
      furniture.id,
      'sitting:allows_sitting',
      {
        spots: [mismatchOccupant.id, missingOccupant.id],
      }
    );
    await entityManager.addComponent(
      mismatchOccupant.id,
      'sitting-states:sitting_on',
      {
        furniture_id: 'wrong-furniture',
        spot_index: 2,
      }
    );

    const { closenessIssues, movementLockIssues, furnitureOccupancyIssues } =
      validator.performFullValidation();

    const issues = [
      ...closenessIssues,
      ...movementLockIssues,
      ...furnitureOccupancyIssues,
    ];

    const repairReport = await validator.repairIssues(issues);

    expect(repairReport.attempted).toBe(issues.length);
    expect(repairReport.successful).toBe(3);
    expect(repairReport.failed).toHaveLength(1);
    expect(repairReport.failed[0]).toEqual(
      expect.objectContaining({
        issue: expect.objectContaining({ type: 'missing_sitting_component' }),
        reason: expect.stringContaining('manual intervention required'),
      })
    );

    const updatedCloseness = await entityManager.getComponentData(
      closenessSource.id,
      'personal-space-states:closeness'
    );
    expect(updatedCloseness.partners).not.toContain(closenessTarget.id);

    const updatedMovement = await entityManager.getComponentData(
      movementActor.id,
      'core:movement'
    );
    expect(updatedMovement.locked).toBe(false);

    const repairedSitting = await entityManager.getComponentData(
      mismatchOccupant.id,
      'sitting-states:sitting_on'
    );
    expect(repairedSitting).toEqual({
      furniture_id: furniture.id,
      spot_index: 0,
    });

    expect(logger.debugMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: 'Repaired unidirectional closeness',
        }),
        expect.objectContaining({
          message: 'Repaired orphaned movement lock',
        }),
        expect.objectContaining({
          message: 'Repaired sitting component mismatch',
        }),
      ])
    );
    expect(logger.infoMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: 'Issue repair completed',
          context: expect.objectContaining({
            attempted: issues.length,
            successful: 3,
          }),
        }),
      ])
    );
  });
});
