/**
 * @file This file contains the test suite for the EntityManager test helpers.
 * @see tests/unit/entities/entityManager.helpers.js
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
// Corrected the path to be relative to the test file's location as per the logs.
import {
  EntityManagerTestBed,
  TestData,
} from '../../../common/entities/index.js';
import EntityManager from '../../../../src/entities/entityManager.js';
import EntityDefinition from '../../../../src/entities/entityDefinition.js';
import {
  ACTOR_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../../src/constants/componentIds.js';

// We only need to mock EntityManager to verify that the EntityManagerTestBed instantiates it correctly.
// EntityDefinition should NOT be mocked, as we need its real implementation to create
// the test data objects that the system under test relies on.
jest.mock('../../../../src/entities/entityManager.js');

describe('EntityManager Test Helpers: EntityManagerTestBed & TestData', () => {
  describe('TestData Export', () => {
    it('should export a TestData object with the correct structure', () => {
      expect(TestData).toBeDefined();
      expect(typeof TestData).toBe('object');
    });

    it('should have a ComponentIDs map', () => {
      expect(TestData.ComponentIDs).toBeDefined();
      expect(TestData.ComponentIDs.ACTOR_COMPONENT_ID).toBe(ACTOR_COMPONENT_ID);
      expect(TestData.ComponentIDs.POSITION_COMPONENT_ID).toBe(
        POSITION_COMPONENT_ID
      );
    });

    it('should have a DefinitionIDs map', () => {
      expect(TestData.DefinitionIDs).toBeDefined();
      expect(TestData.DefinitionIDs.BASIC).toBe('test-def:basic');
      expect(TestData.DefinitionIDs.ACTOR).toBe('test-def:actor');
    });

    it('should have a map of pre-built Definitions', () => {
      expect(TestData.Definitions).toBeDefined();
      // The helper uses the real EntityDefinition, so this check is valid.
      expect(TestData.Definitions.basic).toBeInstanceOf(EntityDefinition);
      expect(TestData.Definitions.actor).toBeInstanceOf(EntityDefinition);
      expect(TestData.Definitions.withPos).toBeInstanceOf(EntityDefinition);
    });

    it('should have a map of InstanceIDs', () => {
      expect(TestData.InstanceIDs).toBeDefined();
      expect(TestData.InstanceIDs.PRIMARY).toBe('test-instance-01');
      expect(TestData.InstanceIDs.SECONDARY).toBe('test-instance-02');
    });
  });

  describe('EntityManagerTestBed Class', () => {
    let bed;

    beforeEach(() => {
      // Clear any static mocks before each test
      jest.clearAllMocks();
      bed = new EntityManagerTestBed();
    });

    describe('Constructor & Initialization', () => {
      it('should instantiate EntityManager with all required mocks', () => {
        expect(EntityManager).toHaveBeenCalledTimes(1);
        // FIX: The constructor now receives a 5th `options` argument, which is `{}` by default.
        // We update the test to expect this new argument.
        expect(EntityManager).toHaveBeenCalledWith({
          registry: bed.mocks.registry,
          validator: bed.mocks.validator,
          logger: bed.mocks.logger,
          dispatcher: bed.mocks.eventDispatcher,
        });
      });

      it('should provide a public property `entityManager` with the SUT instance', () => {
        expect(bed.entityManager).toBeDefined();
        expect(bed.entityManager).toBeInstanceOf(EntityManager);
      });

      it('should provide a public `mocks` property containing all created mocks', () => {
        expect(bed.mocks).toBeDefined();
        const mockKeys = Object.keys(bed.mocks);
        expect(mockKeys).toContain('registry');
        expect(mockKeys).toContain('validator');
        expect(mockKeys).toContain('logger');
        expect(mockKeys).toContain('eventDispatcher');
      });

      it('should initialize mocks with jest.fn() spies', () => {
        // Registry
        expect(bed.mocks.registry.getEntityDefinition).toBeDefined();
        expect(
          jest.isMockFunction(bed.mocks.registry.getEntityDefinition)
        ).toBe(true);

        // Validator
        expect(bed.mocks.validator.validate).toBeDefined();
        expect(jest.isMockFunction(bed.mocks.validator.validate)).toBe(true);
        // Check default implementation
        expect(bed.mocks.validator.validate()).toEqual({ isValid: true });

        // Logger
        expect(jest.isMockFunction(bed.mocks.logger.info)).toBe(true);
        expect(jest.isMockFunction(bed.mocks.logger.warn)).toBe(true);
        expect(jest.isMockFunction(bed.mocks.logger.error)).toBe(true);
        expect(jest.isMockFunction(bed.mocks.logger.debug)).toBe(true);

        // Event Dispatcher
        expect(jest.isMockFunction(bed.mocks.eventDispatcher.dispatch)).toBe(
          true
        );
      });
    });

    describe('setupDefinitions()', () => {
      it('should configure the mock registry to return specified definitions', () => {
        const { basic, actor } = TestData.Definitions;
        bed.setupDefinitions(basic, actor);

        const registry = bed.mocks.registry;
        // With the fix, these assertions should now pass as `basic` and `actor` are real objects with an `id`.
        expect(registry.getEntityDefinition(TestData.DefinitionIDs.BASIC)).toBe(
          basic
        );
        expect(registry.getEntityDefinition(TestData.DefinitionIDs.ACTOR)).toBe(
          actor
        );
      });

      it('should make the mock registry return undefined for unspecified IDs', () => {
        const { basic } = TestData.Definitions;
        bed.setupDefinitions(basic);

        const registry = bed.mocks.registry;
        expect(registry.getEntityDefinition(TestData.DefinitionIDs.BASIC)).toBe(
          basic
        );
        expect(
          registry.getEntityDefinition(TestData.DefinitionIDs.ACTOR)
        ).toBeUndefined();
        expect(registry.getEntityDefinition('non-existent-id')).toBeUndefined();
      });

      it('should handle being called with no definitions', () => {
        bed.setupDefinitions();
        const registry = bed.mocks.registry;
        expect(
          registry.getEntityDefinition(TestData.DefinitionIDs.BASIC)
        ).toBeUndefined();
      });
    });

    describe('cleanup()', () => {
      it('should call clearAll() on its entityManager instance', async () => {
        // FIX: The entityManager instance from the mocked module already has mock methods.
        // We directly assert on that mock method.
        const clearAllMethod = bed.entityManager.clearAll;

        await bed.cleanup();

        expect(clearAllMethod).toHaveBeenCalledTimes(1);
      });

      it('should clear all mocks via jest.clearAllMocks()', async () => {
        const { logger } = bed.mocks;
        logger.info('test call');
        expect(logger.info).toHaveBeenCalledTimes(1);

        await bed.cleanup();

        // jest.clearAllMocks() resets the counter.
        expect(logger.info).toHaveBeenCalledTimes(0);
      });
    });
  });
});
