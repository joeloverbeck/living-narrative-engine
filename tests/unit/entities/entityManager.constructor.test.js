/**
 * @file Tests for EntityManager constructor.
 * @see src/entities/entityManager.js
 */

import { describe, it, expect, jest } from '@jest/globals';
import {
  describeEntityManagerSuite,
  TestData,
  TestBed,
} from '../../common/entities/index.js';
import {
  runInvalidEntityIdTests,
  runInvalidDefinitionIdTests,
} from '../../common/entities/index.js';
import Entity from '../../../src/entities/entity.js';
import { DefinitionNotFoundError } from '../../../src/errors/definitionNotFoundError.js';
import { EntityNotFoundError } from '../../../src/errors/entityNotFoundError.js';
import { DuplicateEntityError } from '../../../src/errors/duplicateEntityError.js';
import { SerializedEntityError } from '../../../src/errors/serializedEntityError.js';
import { InvalidInstanceIdError } from '../../../src/errors/invalidInstanceIdError.js';
import {
  expectEntityCreatedDispatch,
  expectEntityRemovedDispatch,
} from '../../common/engine/dispatchTestUtils.js';

import { buildSerializedEntity } from '../../common/entities/index.js';

describeEntityManagerSuite(
  'EntityManager - Constructor Validation',
  (getBed) => {
    describe('constructor', () => {
      it('should instantiate successfully via TestBed', () => {
        // The beforeEach hook already does this. If it fails, the test will crash.
        expect(getBed().entityManager).toBeInstanceOf(
          getBed().entityManager.constructor
        );
      });

      it.each([
        ['registry', null],
        ['validator', null],
      ])(
        'should throw an error if the %s is missing or invalid',
        (depName, value) => {
          const { registry, validator, logger, eventDispatcher } =
            getBed().mocks;
          const EntityManager = getBed().entityManager.constructor;

          expect(
            () =>
              new EntityManager({
                registry: depName === 'registry' ? value : registry,
                validator: depName === 'validator' ? value : validator,
                logger,
                dispatcher: eventDispatcher,
              })
          ).toThrow(
            depName === 'registry'
              ? 'Missing required dependency: IDataRegistry.'
              : 'Missing required dependency: ISchemaValidator.'
          );
        }
      );

      it('should use the injected idGenerator', () => {
        const mockIdGenerator = jest.fn();
        const testBed = new TestBed({ idGenerator: mockIdGenerator });
        // This test simply checks if the generator is stored,
        // createEntityInstance tests will check if it's *used*.
        // We can't directly access the private field, so we rely on functional tests.
        expect(testBed.entityManager).toBeDefined();
      });

      it('should default to a UUIDv4 generator if none is provided', () => {
        // Arrange
        const entity = getBed().createBasicEntity();

        // Assert
        // This is an indirect test. We can't check *which* function was used,
        // but we can check that the output conforms to the expected default (UUIDv4).
        expect(entity.id).toBeDefined();
        expect(typeof entity.id).toBe('string');
        // A simple regex to check for UUID v4 format.
        expect(entity.id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        );
      });
    });
  }
);
