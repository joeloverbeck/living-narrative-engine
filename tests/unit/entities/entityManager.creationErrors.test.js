import { describe, it, expect, jest } from '@jest/globals';
import EntityFactory from '../../../src/entities/factories/entityFactory.js';
import { EntityManagerTestBed, TestData } from '../../common/entities/index.js';
import { DuplicateEntityError } from '../../../src/errors/duplicateEntityError.js';

describe('EntityManager - Factory Error Translation (create)', () => {
  it('translates duplicate ID errors to DuplicateEntityError', () => {
    const bed = new EntityManagerTestBed();
    const message = "Entity with ID 'dup-1' already exists.";
    jest.spyOn(EntityFactory.prototype, 'create').mockImplementation(() => {
      throw new Error(message);
    });
    bed.setupTestDefinitions('basic');

    expect(() =>
      bed.entityManager.createEntityInstance(TestData.DefinitionIDs.BASIC, {
        instanceId: 'dup-1',
      })
    ).toThrow(
      new DuplicateEntityError(
        'dup-1',
        "EntityManager.createEntityInstance: Entity with ID 'dup-1' already exists."
      )
    );
  });
});
