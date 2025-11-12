/**
 * @file Integration tests for AnatomyUnitOfWork covering transactional rollback scenarios.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import { AnatomyUnitOfWork } from '../../../src/anatomy/orchestration/anatomyUnitOfWork.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { AnatomyGenerationError } from '../../../src/anatomy/orchestration/anatomyErrorHandler.js';

const CORE_NAME_COMPONENT = {
  id: 'core:name',
  description: 'Name component',
  dataSchema: {
    type: 'object',
    properties: {
      text: { type: 'string' },
    },
    required: ['text'],
  },
};

const CORE_DESCRIPTION_COMPONENT = {
  id: 'core:description',
  description: 'Description component',
  dataSchema: {
    type: 'object',
    properties: {
      text: { type: 'string' },
    },
  },
};

const ANATOMY_BODY_COMPONENT = {
  id: 'anatomy:body',
  description: 'Body anatomy root component',
  dataSchema: {
    type: 'object',
    properties: {
      body: {
        type: ['object', 'null'],
        nullable: true,
      },
      recipeId: { type: 'string' },
    },
  },
};

const ANATOMY_PART_COMPONENT = {
  id: 'anatomy:part',
  description: 'Anatomy part component',
  dataSchema: {
    type: 'object',
    properties: {
      partType: { type: 'string' },
    },
    required: ['partType'],
  },
};

describe('AnatomyUnitOfWork integration coverage', () => {
  let testBed;

  beforeEach(() => {
    testBed = new AnatomyIntegrationTestBed();
    testBed.loadComponents({
      'core:name': CORE_NAME_COMPONENT,
      'core:description': CORE_DESCRIPTION_COMPONENT,
      'anatomy:body': ANATOMY_BODY_COMPONENT,
      'anatomy:part': ANATOMY_PART_COMPONENT,
    });

    testBed.loadEntityDefinitions({
      'core:actor': {
        id: 'core:actor',
        description: 'Actor with anatomy',
        components: {
          'core:name': {},
          'anatomy:body': {},
        },
      },
      'anatomy:body_part': {
        id: 'anatomy:body_part',
        description: 'Simple anatomy part',
        components: {
          'anatomy:part': {},
          'core:description': {},
        },
      },
    });
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  it('requires both entityManager and logger dependencies', () => {
    expect(() => new AnatomyUnitOfWork({ logger: testBed.logger })).toThrow(
      InvalidArgumentError
    );

    expect(() => new AnatomyUnitOfWork({ entityManager: testBed.entityManager })).toThrow(
      InvalidArgumentError
    );
  });

  it('validates tracked entity identifiers', () => {
    const unitOfWork = new AnatomyUnitOfWork({
      entityManager: testBed.entityManager,
      logger: testBed.logger,
    });

    expect(() => unitOfWork.trackEntity('')).toThrow(InvalidArgumentError);
    expect(() => unitOfWork.trackEntities('not-an-array')).toThrow(InvalidArgumentError);
  });

  it('logs warning when rollback is invoked multiple times and prevents rollback after commit', async () => {
    const unitOfWork = new AnatomyUnitOfWork({
      entityManager: testBed.entityManager,
      logger: testBed.logger,
    });

    await unitOfWork.rollback();
    await unitOfWork.rollback();

    expect(testBed.logger.warn).toHaveBeenCalledWith(
      'AnatomyUnitOfWork: Rollback already performed'
    );

    const committedUnitOfWork = new AnatomyUnitOfWork({
      entityManager: testBed.entityManager,
      logger: testBed.logger,
    });
    await committedUnitOfWork.commit();

    await expect(committedUnitOfWork.rollback()).rejects.toThrow(
      'Cannot rollback a committed unit of work'
    );
  });

  it('tracks entity counts and exposes committed state getters', async () => {
    const unitOfWork = new AnatomyUnitOfWork({
      entityManager: testBed.entityManager,
      logger: testBed.logger,
    });

    const bodyPart = await testBed.entityManager.createEntityInstance('anatomy:body_part');
    unitOfWork.trackEntity(bodyPart.id);

    expect(unitOfWork.trackedEntityCount).toBe(1);

    await unitOfWork.commit();
    expect(unitOfWork.isCommitted).toBe(true);

    const committedMessages = testBed.logger.debug.mock.calls
      .map(([message]) => message)
      .filter(Boolean);
    expect(
      committedMessages.some((message) =>
        message.includes('AnatomyUnitOfWork: Committing unit of work')
      )
    ).toBe(true);
  });

  it('enforces active lifecycle via ensureActive guards', async () => {
    const unitOfWork = new AnatomyUnitOfWork({
      entityManager: testBed.entityManager,
      logger: testBed.logger,
    });

    await unitOfWork.commit();
    expect(() => unitOfWork.trackEntity('after-commit')).toThrow(
      'Unit of work has already been committed'
    );

    const rollbackUnitOfWork = new AnatomyUnitOfWork({
      entityManager: testBed.entityManager,
      logger: testBed.logger,
    });
    await rollbackUnitOfWork.rollback();

    expect(() => rollbackUnitOfWork.trackEntity('after-rollback')).toThrow(
      'Unit of work has already been rolled back'
    );
  });

  it('handles full rollback flow including already removed entities and deletion failures', async () => {
    const unitOfWork = new AnatomyUnitOfWork({
      entityManager: testBed.entityManager,
      logger: testBed.logger,
    });

    const survivingEntity = await testBed.entityManager.createEntityInstance(
      'anatomy:body_part'
    );
    const preRemovedEntity = await testBed.entityManager.createEntityInstance(
      'anatomy:body_part'
    );
    const failingEntity = await testBed.entityManager.createEntityInstance('anatomy:body_part');

    unitOfWork.trackEntities([
      survivingEntity.id,
      preRemovedEntity.id,
      failingEntity.id,
    ]);

    await testBed.entityManager.removeEntityInstance(preRemovedEntity.id);

    const originalRemove = testBed.entityManager.removeEntityInstance.bind(
      testBed.entityManager
    );
    const removeSpy = jest
      .spyOn(testBed.entityManager, 'removeEntityInstance')
      .mockImplementation(async (entityId, ...args) => {
        if (entityId === failingEntity.id) {
          throw new Error('simulated removal failure');
        }
        return originalRemove(entityId, ...args);
      });

    try {
      await expect(unitOfWork.rollback()).rejects.toBeInstanceOf(AnatomyGenerationError);
    } finally {
      removeSpy.mockRestore();
    }

    const debugMessages = testBed.logger.debug.mock.calls.map(([message]) => message);
    expect(
      debugMessages.some((message) =>
        message.includes(`Successfully deleted entity '${survivingEntity.id}'`)
      )
    ).toBe(true);
    expect(
      debugMessages.some((message) =>
        message.includes(`Entity '${preRemovedEntity.id}' already removed`)
      )
    ).toBe(true);

    const errorCalls = testBed.logger.error.mock.calls.map(([message]) => message);
    expect(
      errorCalls.some((message) =>
        message.includes(`Failed to delete entity '${failingEntity.id}' during rollback`)
      )
    ).toBe(true);

    expect(unitOfWork.isRolledBack).toBe(true);
  });
});
