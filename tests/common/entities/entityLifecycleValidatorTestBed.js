/**
 * @file EntityLifecycleValidatorTestBed - Test helper for EntityLifecycleValidator tests
 * @description Provides centralized setup and utilities for testing EntityLifecycleValidator
 */

import { jest } from '@jest/globals';
import EntityLifecycleValidator from '../../../src/entities/services/helpers/EntityLifecycleValidator.js';
import { createMockLogger } from '../mockFactories/index.js';
import BaseTestBed from '../baseTestBed.js';

/**
 * TestBed for EntityLifecycleValidator providing mocks and utilities
 */
export class EntityLifecycleValidatorTestBed extends BaseTestBed {
  /**
   * Creates a new EntityLifecycleValidatorTestBed instance.
   *
   * @param {object} [options] - Configuration options
   */
  constructor(options = {}) {
    super();

    // Create mock dependencies
    this.logger = createMockLogger();

    // Create validator instance
    this.validator = new EntityLifecycleValidator({
      logger: this.logger,
    });
  }

  /**
   * Creates a mock repository for entity existence testing.
   *
   * @param {string[]} [existingEntityIds] - IDs of entities that exist
   * @returns {object} Mock repository
   */
  createMockRepository(existingEntityIds = []) {
    return {
      has: jest.fn((id) => existingEntityIds.includes(id)),
      get: jest.fn((id) => (existingEntityIds.includes(id) ? { id } : null)),
      set: jest.fn(),
      delete: jest.fn(),
    };
  }

  /**
   * Creates valid serialized entity data.
   *
   * @param {string} [instanceId] - Entity instance ID
   * @param {string} [definitionId] - Entity definition ID
   * @param {object} [components] - Entity components
   * @param {object} [additionalProps] - Additional properties
   * @returns {object} Valid serialized entity
   */
  createValidSerializedEntity(
    instanceId = 'test-entity-1',
    definitionId = 'test:definition',
    components = {},
    additionalProps = {}
  ) {
    return {
      instanceId,
      definitionId,
      components,
      ...additionalProps,
    };
  }

  /**
   * Creates invalid serialized entity data for validation testing.
   *
   * @param {string} type - Type of invalid data
   * @returns {any} Invalid serialized entity
   */
  createInvalidSerializedEntity(type) {
    switch (type) {
      case 'null':
        return null;
      case 'undefined':
        return undefined;
      case 'not-object':
        return 'invalid';
      case 'missing-instanceId':
        return { definitionId: 'test:def' };
      case 'missing-definitionId':
        return { instanceId: 'test-entity' };
      case 'empty-instanceId':
        return { instanceId: '', definitionId: 'test:def' };
      case 'empty-definitionId':
        return { instanceId: 'test-entity', definitionId: '' };
      case 'non-string-instanceId':
        return { instanceId: 123, definitionId: 'test:def' };
      case 'non-string-definitionId':
        return { instanceId: 'test-entity', definitionId: 123 };
      case 'invalid-components-array':
        return {
          instanceId: 'test-entity',
          definitionId: 'test:def',
          components: [],
        };
      case 'invalid-components-string':
        return {
          instanceId: 'test-entity',
          definitionId: 'test:def',
          components: 'invalid',
        };
      default:
        return {};
    }
  }

  /**
   * Creates valid creation options.
   *
   * @param {string} [instanceId] - Optional instance ID
   * @param {object} [componentOverrides] - Optional component overrides
   * @param {object} [additionalProps] - Additional properties
   * @returns {object} Valid creation options
   */
  createValidCreationOptions(
    instanceId,
    componentOverrides,
    additionalProps = {}
  ) {
    const options = { ...additionalProps };
    if (instanceId !== undefined) options.instanceId = instanceId;
    if (componentOverrides !== undefined)
      options.componentOverrides = componentOverrides;
    return options;
  }

  /**
   * Creates invalid creation options for validation testing.
   *
   * @param {string} type - Type of invalid options
   * @returns {any} Invalid creation options
   */
  createInvalidCreationOptions(type) {
    switch (type) {
      case 'null':
        return null;
      case 'undefined':
        return undefined;
      case 'not-object':
        return 'invalid';
      case 'non-string-instanceId':
        return { instanceId: 123 };
      case 'invalid-componentOverrides-array':
        return { componentOverrides: [] };
      case 'invalid-componentOverrides-string':
        return { componentOverrides: 'invalid' };
      default:
        return {};
    }
  }

  /**
   * Generates test cases for invalid definition IDs.
   *
   * @returns {Array<[string, any]>} Test cases for parameterized tests
   */
  getInvalidDefinitionIdTestCases() {
    return [
      ['null', null],
      ['undefined', undefined],
      ['empty string', ''],
      ['whitespace only', '   '],
      ['number', 123],
      ['boolean', true],
      ['object', {}],
      ['array', []],
    ];
  }

  /**
   * Generates test cases for invalid instance IDs.
   *
   * @returns {Array<[string, any]>} Test cases for parameterized tests
   */
  getInvalidInstanceIdTestCases() {
    return [
      ['null', null],
      ['undefined', undefined],
      ['empty string', ''],
      ['whitespace only', '   '],
      ['number', 123],
      ['boolean', false],
      ['object', {}],
      ['array', []],
    ];
  }

  /**
   * Generates test cases for invalid serialized entities.
   *
   * @returns {Array<[string, any]>} Test cases for parameterized tests
   */
  getInvalidSerializedEntityTestCases() {
    return [
      ['null', this.createInvalidSerializedEntity('null')],
      ['undefined', this.createInvalidSerializedEntity('undefined')],
      ['not object', this.createInvalidSerializedEntity('not-object')],
      [
        'missing instanceId',
        this.createInvalidSerializedEntity('missing-instanceId'),
      ],
      [
        'missing definitionId',
        this.createInvalidSerializedEntity('missing-definitionId'),
      ],
      [
        'empty instanceId',
        this.createInvalidSerializedEntity('empty-instanceId'),
      ],
      [
        'empty definitionId',
        this.createInvalidSerializedEntity('empty-definitionId'),
      ],
      [
        'non-string instanceId',
        this.createInvalidSerializedEntity('non-string-instanceId'),
      ],
      [
        'non-string definitionId',
        this.createInvalidSerializedEntity('non-string-definitionId'),
      ],
    ];
  }

  /**
   * Generates test cases for invalid creation options.
   *
   * @returns {Array<[string, any]>} Test cases for parameterized tests
   */
  getInvalidCreationOptionsTestCases() {
    return [
      ['null', this.createInvalidCreationOptions('null')],
      ['undefined', this.createInvalidCreationOptions('undefined')],
      ['not object', this.createInvalidCreationOptions('not-object')],
      [
        'non-string instanceId',
        this.createInvalidCreationOptions('non-string-instanceId'),
      ],
      [
        'componentOverrides array',
        this.createInvalidCreationOptions('invalid-componentOverrides-array'),
      ],
      [
        'componentOverrides string',
        this.createInvalidCreationOptions('invalid-componentOverrides-string'),
      ],
    ];
  }

  /**
   * Asserts that specific log messages were generated.
   *
   * @param {object} expected - Expected log operations
   * @param {number} [expected.warnings] - Expected number of warning logs
   * @param {string[]} [expected.warningMessages] - Expected warning message patterns
   */
  assertLogOperations({ warnings, warningMessages } = {}) {
    if (warnings !== undefined) {
      expect(this.logger.warn).toHaveBeenCalledTimes(warnings);
    }
    if (warningMessages) {
      warningMessages.forEach((pattern) => {
        expect(this.logger.warn).toHaveBeenCalledWith(
          expect.stringContaining(pattern)
        );
      });
    }
  }

  /**
   * Asserts that a validation method throws a specific error.
   *
   * @param {Function} validationFn - Validation function to test
   * @param {Function} expectedErrorClass - Expected error class
   * @param {string} [expectedMessage] - Expected error message pattern
   */
  assertValidationThrows(validationFn, expectedErrorClass, expectedMessage) {
    expect(validationFn).toThrow(expectedErrorClass);
    if (expectedMessage) {
      expect(validationFn).toThrow(expect.stringContaining(expectedMessage));
    }
  }

  /**
   * Cleanup method called after each test.
   */
  cleanup() {
    super.cleanup();
    jest.clearAllMocks();
  }
}

export default EntityLifecycleValidatorTestBed;
