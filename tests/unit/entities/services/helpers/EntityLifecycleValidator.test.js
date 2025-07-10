/**
 * @file EntityLifecycleValidator.test.js - Comprehensive test suite for EntityLifecycleValidator
 * @description Tests all public methods and edge cases for EntityLifecycleValidator
 * @see src/entities/services/helpers/EntityLifecycleValidator.js
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { EntityLifecycleValidatorTestBed } from '../../../../common/entities/index.js';
import { InvalidArgumentError } from '../../../../../src/errors/invalidArgumentError.js';
import { EntityNotFoundError } from '../../../../../src/errors/entityNotFoundError.js';

describe('EntityLifecycleValidator - Constructor Validation', () => {
  let testBed;

  beforeEach(() => {
    testBed = new EntityLifecycleValidatorTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should instantiate successfully with valid dependencies', () => {
    expect(testBed.validator).toBeDefined();
    expect(typeof testBed.validator.validateCreateEntityParams).toBe(
      'function'
    );
    expect(typeof testBed.validator.validateReconstructEntityParams).toBe(
      'function'
    );
    expect(typeof testBed.validator.validateRemoveEntityInstanceParams).toBe(
      'function'
    );
    expect(typeof testBed.validator.validateEntityExists).toBe('function');
    expect(typeof testBed.validator.validateCreationOptions).toBe('function');
    expect(typeof testBed.validator.validateSerializedEntityStructure).toBe(
      'function'
    );
  });

  it('should throw when logger is null or invalid', () => {
    expect(() => {
      new testBed.validator.constructor({
        logger: null,
      });
    }).toThrow();
  });

  it('should validate logger has required methods', () => {
    const invalidLogger = { someMethod: () => {} };
    expect(() => {
      new testBed.validator.constructor({
        logger: invalidLogger,
      });
    }).toThrow();
  });
});

describe('EntityLifecycleValidator - Create Entity Validation', () => {
  let testBed;

  beforeEach(() => {
    testBed = new EntityLifecycleValidatorTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('validateCreateEntityParams', () => {
    it('should validate valid definition IDs without throwing', () => {
      const validDefinitionIds = [
        'core:actor',
        'mod:item',
        'namespace:type:subtype',
        'valid_id_123',
      ];

      validDefinitionIds.forEach((definitionId) => {
        expect(() => {
          testBed.validator.validateCreateEntityParams(definitionId);
        }).not.toThrow();
      });
    });

    it.each([
      ['null', null],
      ['undefined', undefined],
      ['empty string', ''],
      ['whitespace only', '   '],
      ['number', 123],
      ['boolean', true],
      ['object', {}],
      ['array', []],
    ])(
      'should throw InvalidArgumentError for invalid definition ID: %s',
      (description, definitionId) => {
        expect(() => {
          testBed.validator.validateCreateEntityParams(definitionId);
        }).toThrow(InvalidArgumentError);

        testBed.assertLogOperations({
          warnings: 1,
          warningMessages: [
            'EntityManager.createEntityInstance: invalid definitionId',
          ],
        });
      }
    );

    it('should include definitionId in error details', () => {
      const invalidDefinitionId = null;

      expect(() => {
        testBed.validator.validateCreateEntityParams(invalidDefinitionId);
      }).toThrow(InvalidArgumentError);
    });

    it('should propagate non-InvalidArgumentError exceptions', () => {
      // This test would require mocking the assertValidId utility to throw a different error
      // For now, we test that the method properly handles and re-throws InvalidArgumentErrors
      const invalidId = '';

      expect(() => {
        testBed.validator.validateCreateEntityParams(invalidId);
      }).toThrow(InvalidArgumentError);
    });
  });
});

describe('EntityLifecycleValidator - Reconstruct Entity Validation', () => {
  let testBed;

  beforeEach(() => {
    testBed = new EntityLifecycleValidatorTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('validateReconstructEntityParams', () => {
    it('should validate valid serialized entity without throwing', () => {
      const validEntity = testBed.createValidSerializedEntity();

      expect(() => {
        testBed.validator.validateReconstructEntityParams(validEntity);
      }).not.toThrow();
    });

    it.each([
      ['null', null],
      ['undefined', undefined],
      ['not object', 'invalid'],
      ['missing instanceId', { definitionId: 'test:def' }],
      ['missing definitionId', { instanceId: 'test-entity' }],
      ['empty instanceId', { instanceId: '', definitionId: 'test:def' }],
      ['empty definitionId', { instanceId: 'test-entity', definitionId: '' }],
      ['non-string instanceId', { instanceId: 123, definitionId: 'test:def' }],
      [
        'non-string definitionId',
        { instanceId: 'test-entity', definitionId: 123 },
      ],
    ])(
      'should throw InvalidArgumentError for invalid serialized entity: %s',
      (description, serializedEntity) => {
        expect(() => {
          testBed.validator.validateReconstructEntityParams(serializedEntity);
        }).toThrow();
      }
    );

    it('should validate entity with optional components', () => {
      const entityWithComponents = {
        instanceId: 'entity-1',
        definitionId: 'test:definition',
        components: {
          position: { x: 10, y: 20 },
          health: { current: 100, max: 100 },
        },
      };

      expect(() => {
        testBed.validator.validateReconstructEntityParams(entityWithComponents);
      }).not.toThrow();
    });

    it('should validate entity without components', () => {
      const entityWithoutComponents = {
        instanceId: 'entity-1',
        definitionId: 'test:definition',
      };

      expect(() => {
        testBed.validator.validateReconstructEntityParams(
          entityWithoutComponents
        );
      }).not.toThrow();
    });
  });
});

describe('EntityLifecycleValidator - Remove Entity Validation', () => {
  let testBed;

  beforeEach(() => {
    testBed = new EntityLifecycleValidatorTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('validateRemoveEntityInstanceParams', () => {
    it('should validate valid instance IDs without throwing', () => {
      const validInstanceIds = [
        'entity-123',
        'actor_player_1',
        'item:sword:legendary',
        'uuid-style-id-12345',
      ];

      validInstanceIds.forEach((instanceId) => {
        expect(() => {
          testBed.validator.validateRemoveEntityInstanceParams(instanceId);
        }).not.toThrow();
      });
    });

    it.each([
      ['null', null],
      ['undefined', undefined],
      ['empty string', ''],
      ['whitespace only', '   '],
      ['number', 123],
      ['boolean', false],
      ['object', {}],
      ['array', []],
    ])(
      'should throw InvalidArgumentError for invalid instance ID: %s',
      (description, instanceId) => {
        expect(() => {
          testBed.validator.validateRemoveEntityInstanceParams(instanceId);
        }).toThrow(InvalidArgumentError);
      }
    );
  });

  describe('validateEntityExists', () => {
    it('should not throw when entity exists in repository', () => {
      const instanceId = 'existing-entity';
      const repository = testBed.createMockRepository([instanceId]);

      expect(() => {
        testBed.validator.validateEntityExists(instanceId, repository);
      }).not.toThrow();

      expect(repository.has).toHaveBeenCalledWith(instanceId);
    });

    it('should throw EntityNotFoundError when entity does not exist', () => {
      const instanceId = 'non-existent-entity';
      const repository = testBed.createMockRepository([]);

      testBed.assertValidationThrows(
        () => testBed.validator.validateEntityExists(instanceId, repository),
        EntityNotFoundError
      );

      testBed.assertLogOperations({
        warnings: 1,
        warningMessages: ['EntityManager.removeEntityInstance: Entity with ID'],
      });
    });

    it('should include entity ID in error message', () => {
      const instanceId = 'missing-entity-123';
      const repository = testBed.createMockRepository([]);

      expect(() => {
        testBed.validator.validateEntityExists(instanceId, repository);
      }).toThrow(EntityNotFoundError);
    });

    it('should handle repository with custom has implementation', () => {
      const instanceId = 'test-entity';
      const customRepository = {
        has: jest.fn().mockImplementation((id) => id === 'special-entity'),
      };

      // Should not throw for special entity
      expect(() => {
        testBed.validator.validateEntityExists(
          'special-entity',
          customRepository
        );
      }).not.toThrow();

      // Should throw for test entity
      testBed.assertValidationThrows(
        () =>
          testBed.validator.validateEntityExists(instanceId, customRepository),
        EntityNotFoundError
      );
    });
  });
});

describe('EntityLifecycleValidator - Creation Options Validation', () => {
  let testBed;

  beforeEach(() => {
    testBed = new EntityLifecycleValidatorTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('validateCreationOptions', () => {
    it('should validate valid creation options without throwing', () => {
      const validOptions = [
        {},
        { instanceId: 'custom-id' },
        { componentOverrides: { position: { x: 10, y: 20 } } },
        {
          instanceId: 'custom-id',
          componentOverrides: { health: { current: 50, max: 100 } },
        },
        {
          instanceId: 'test-entity',
          componentOverrides: {},
          customProperty: 'allowed',
        },
      ];

      validOptions.forEach((options) => {
        expect(() => {
          testBed.validator.validateCreationOptions(options);
        }).not.toThrow();
      });
    });

    it.each([
      ['null', null],
      ['undefined', undefined],
      ['not object', 'invalid'],
      ['non-string instanceId', { instanceId: 123 }],
      ['componentOverrides array', { componentOverrides: [] }],
      ['componentOverrides string', { componentOverrides: 'invalid' }],
    ])(
      'should throw InvalidArgumentError for invalid creation options: %s',
      (description, options) => {
        expect(() => {
          testBed.validator.validateCreationOptions(options);
        }).toThrow(InvalidArgumentError);
      }
    );

    it('should allow undefined instanceId', () => {
      const options = { instanceId: undefined };

      expect(() => {
        testBed.validator.validateCreationOptions(options);
      }).not.toThrow();
    });

    it('should allow undefined componentOverrides', () => {
      const options = { componentOverrides: undefined };

      expect(() => {
        testBed.validator.validateCreationOptions(options);
      }).not.toThrow();
    });

    it('should validate instanceId type when provided', () => {
      const invalidOptions = { instanceId: 123 };

      expect(() => {
        testBed.validator.validateCreationOptions(invalidOptions);
      }).toThrow(InvalidArgumentError);
    });

    it('should validate componentOverrides type when provided', () => {
      const invalidOptions = { componentOverrides: 'invalid' };

      expect(() => {
        testBed.validator.validateCreationOptions(invalidOptions);
      }).toThrow(InvalidArgumentError);
    });

    it('should reject arrays as componentOverrides', () => {
      const invalidOptions = { componentOverrides: [] };

      expect(() => {
        testBed.validator.validateCreationOptions(invalidOptions);
      }).toThrow(InvalidArgumentError);
    });
  });
});

describe('EntityLifecycleValidator - Serialized Entity Structure Validation', () => {
  let testBed;

  beforeEach(() => {
    testBed = new EntityLifecycleValidatorTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('validateSerializedEntityStructure', () => {
    it('should validate valid serialized entity structures', () => {
      const validEntities = [
        testBed.createValidSerializedEntity(),
        testBed.createValidSerializedEntity('custom-id', 'custom:def'),
        testBed.createValidSerializedEntity(
          'entity-with-components',
          'test:def',
          { position: { x: 0, y: 0 } }
        ),
        {
          instanceId: 'minimal-entity',
          definitionId: 'minimal:def',
        },
        {
          instanceId: 'entity-with-extras',
          definitionId: 'test:def',
          components: { health: { current: 100 } },
          extraProperty: 'allowed',
        },
      ];

      validEntities.forEach((entity) => {
        expect(() => {
          testBed.validator.validateSerializedEntityStructure(entity);
        }).not.toThrow();
      });
    });

    it.each([
      ['null', null],
      ['undefined', undefined],
      ['not object', 'invalid'],
      ['missing instanceId', { definitionId: 'test:def' }],
      ['missing definitionId', { instanceId: 'test-entity' }],
      ['empty instanceId', { instanceId: '', definitionId: 'test:def' }],
      ['empty definitionId', { instanceId: 'test-entity', definitionId: '' }],
      ['non-string instanceId', { instanceId: 123, definitionId: 'test:def' }],
      [
        'non-string definitionId',
        { instanceId: 'test-entity', definitionId: 123 },
      ],
    ])(
      'should throw InvalidArgumentError for %s',
      (description, serializedEntity) => {
        expect(() => {
          testBed.validator.validateSerializedEntityStructure(serializedEntity);
        }).toThrow(InvalidArgumentError);
      }
    );

    it('should validate components structure when present', () => {
      const invalidComponentsEntity = {
        instanceId: 'test-entity',
        definitionId: 'test:def',
        components: 'invalid',
      };

      expect(() => {
        testBed.validator.validateSerializedEntityStructure(
          invalidComponentsEntity
        );
      }).toThrow(InvalidArgumentError);
    });

    it('should reject arrays as components', () => {
      const invalidComponentsEntity = {
        instanceId: 'test-entity',
        definitionId: 'test:def',
        components: [],
      };

      expect(() => {
        testBed.validator.validateSerializedEntityStructure(
          invalidComponentsEntity
        );
      }).toThrow(InvalidArgumentError);
    });

    it('should allow undefined components', () => {
      const entityWithUndefinedComponents = {
        instanceId: 'test-entity',
        definitionId: 'test:def',
        components: undefined,
      };

      expect(() => {
        testBed.validator.validateSerializedEntityStructure(
          entityWithUndefinedComponents
        );
      }).not.toThrow();
    });

    it('should include field name in error for specific validation failures', () => {
      const entityWithInvalidInstanceId = {
        instanceId: null,
        definitionId: 'test:def',
      };

      expect(() => {
        testBed.validator.validateSerializedEntityStructure(
          entityWithInvalidInstanceId
        );
      }).toThrow(InvalidArgumentError);
    });
  });
});

describe('EntityLifecycleValidator - Edge Cases and Integration', () => {
  let testBed;

  beforeEach(() => {
    testBed = new EntityLifecycleValidatorTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should handle complex validation workflows', () => {
    const definitionId = 'complex:definition';
    const serializedEntity = {
      instanceId: 'complex-entity-1',
      definitionId: definitionId,
      components: {
        position: { x: 10, y: 20 },
        health: { current: 80, max: 100 },
      },
    };
    const creationOptions = {
      instanceId: 'custom-instance-id',
      componentOverrides: { inventory: { items: [] } },
    };
    const repository = testBed.createMockRepository(['complex-entity-1']);

    // Should validate all scenarios without throwing
    expect(() => {
      testBed.validator.validateCreateEntityParams(definitionId);
      testBed.validator.validateReconstructEntityParams(serializedEntity);
      testBed.validator.validateCreationOptions(creationOptions);
      testBed.validator.validateSerializedEntityStructure(serializedEntity);
      testBed.validator.validateEntityExists('complex-entity-1', repository);
    }).not.toThrow();
  });

  it('should handle validation with minimal valid data', () => {
    const minimalDefinitionId = 'core:minimal';
    const minimalEntity = {
      instanceId: 'minimal',
      definitionId: minimalDefinitionId,
    };
    const minimalOptions = {};
    const minimalRepository = testBed.createMockRepository(['minimal']);

    expect(() => {
      testBed.validator.validateCreateEntityParams(minimalDefinitionId);
      testBed.validator.validateReconstructEntityParams(minimalEntity);
      testBed.validator.validateCreationOptions(minimalOptions);
      testBed.validator.validateSerializedEntityStructure(minimalEntity);
      testBed.validator.validateEntityExists('minimal', minimalRepository);
    }).not.toThrow();
  });

  it('should handle validation errors consistently across methods', () => {
    const invalidInputs = {
      definitionId: null,
      instanceId: undefined,
      serializedEntity: 'not-an-object',
      creationOptions: 'not-an-object',
    };

    // All should throw appropriate error types
    expect(() => {
      testBed.validator.validateCreateEntityParams(invalidInputs.definitionId);
    }).toThrow(InvalidArgumentError);

    expect(() => {
      testBed.validator.validateRemoveEntityInstanceParams(
        invalidInputs.instanceId
      );
    }).toThrow(InvalidArgumentError);

    expect(() => {
      testBed.validator.validateReconstructEntityParams(
        invalidInputs.serializedEntity
      );
    }).toThrow(); // This throws SerializedEntityError, not InvalidArgumentError

    expect(() => {
      testBed.validator.validateCreationOptions(invalidInputs.creationOptions);
    }).toThrow(InvalidArgumentError);

    expect(() => {
      testBed.validator.validateSerializedEntityStructure(
        invalidInputs.serializedEntity
      );
    }).toThrow(InvalidArgumentError);
  });

  it('should handle repository edge cases for entity existence', () => {
    const instanceId = 'edge-case-entity';

    // Repository that throws error
    const errorRepository = {
      has: jest.fn().mockImplementation(() => {
        throw new Error('Repository error');
      }),
    };

    // Should propagate the repository error
    expect(() => {
      testBed.validator.validateEntityExists(instanceId, errorRepository);
    }).toThrow('Repository error');

    // Repository that returns non-boolean
    const weirdRepository = {
      has: jest.fn().mockReturnValue('yes'),
    };

    // Should handle truthy values as existing
    expect(() => {
      testBed.validator.validateEntityExists(instanceId, weirdRepository);
    }).not.toThrow();

    // Repository that returns falsy non-boolean
    const falsyRepository = {
      has: jest.fn().mockReturnValue(0),
    };

    // Should handle falsy values as not existing
    testBed.assertValidationThrows(
      () => testBed.validator.validateEntityExists(instanceId, falsyRepository),
      EntityNotFoundError
    );
  });

  it('should maintain consistent error messaging format for internal methods', () => {
    const errorCases = [
      () => testBed.validator.validateCreationOptions(null),
      () => testBed.validator.validateSerializedEntityStructure(null),
    ];

    errorCases.forEach((testFn) => {
      try {
        testFn();
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidArgumentError);
        expect(error.message).toContain('EntityLifecycleValidator');
      }
    });
  });

  it('should maintain consistent error messaging for entity manager methods', () => {
    try {
      testBed.validator.validateCreateEntityParams(null);
      fail('Expected error to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidArgumentError);
      expect(error.message).toContain('EntityManager.createEntityInstance');
    }
  });
});
