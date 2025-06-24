import { describe, it, expect, jest } from '@jest/globals';
import EntityFactory from '../../../src/entities/factories/entityFactory.js';
import { TestBed, TestData } from '../../common/entities/index.js';
import { buildSerializedEntity } from '../../common/entities/index.js';
import { DuplicateEntityError } from '../../../src/errors/duplicateEntityError.js';
import { SerializedEntityError } from '../../../src/errors/serializedEntityError.js';
import { InvalidInstanceIdError } from '../../../src/errors/invalidInstanceIdError.js';

describe('EntityManager - Factory Error Translation', () => {
  const errorCases = [
    [
      'invalid serializedEntity data',
      new SerializedEntityError(
        'EntityFactory.reconstruct: serializedEntity data is missing or invalid.'
      ),
      new SerializedEntityError(
        'EntityManager.reconstructEntity: serializedEntity data is missing or invalid.'
      ),
    ],
    [
      'invalid instanceId',
      new InvalidInstanceIdError(
        null,
        'EntityFactory.reconstruct: instanceId is missing or invalid in serialized data.'
      ),
      new InvalidInstanceIdError(
        null,
        'EntityManager.reconstructEntity: instanceId is missing or invalid in serialized data.'
      ),
    ],
  ];

  it.each(errorCases)('translates %s', (_, factoryErr, expected) => {
    const testBed = new TestBed();
    jest
      .spyOn(EntityFactory.prototype, 'reconstruct')
      .mockImplementation(() => {
        throw factoryErr;
      });
    testBed.setupTestDefinitions('basic');
    const serialized = buildSerializedEntity(
      TestData.InstanceIDs.PRIMARY,
      TestData.DefinitionIDs.BASIC,
      {}
    );

    expect(() => testBed.entityManager.reconstructEntity(serialized)).toThrow(
      expected
    );
  });

  it('translates duplicate ID errors to DuplicateEntityError', () => {
    const testBed = new TestBed();
    const message =
      "EntityFactory.reconstruct: Entity with ID 'dup-1' already exists. Reconstruction aborted.";
    jest
      .spyOn(EntityFactory.prototype, 'reconstruct')
      .mockImplementation(() => {
        throw new Error(message);
      });
    testBed.setupTestDefinitions('basic');
    const serialized = buildSerializedEntity(
      'dup-1',
      TestData.DefinitionIDs.BASIC,
      {}
    );

    expect(() => testBed.entityManager.reconstructEntity(serialized)).toThrow(
      new DuplicateEntityError(
        'dup-1',
        "EntityManager.reconstructEntity: Entity with ID 'dup-1' already exists. Reconstruction aborted."
      )
    );
  });
});
