import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import EntityManagerIntegrationTestBed from '../../../common/entities/entityManagerIntegrationTestBed.js';
import EntityDefinition from '../../../../src/entities/entityDefinition.js';
import EntityValidationFactory from '../../../../src/entities/factories/EntityValidationFactory.js';
import EntityFactory from '../../../../src/entities/factories/entityFactory.js';
import createValidateAndClone from '../../../../src/entities/utils/createValidateAndClone.js';
import {
  initializeGlobalConfig,
  resetGlobalConfig,
} from '../../../../src/entities/utils/configUtils.js';
import { InvalidInstanceIdError } from '../../../../src/errors/invalidInstanceIdError.js';
import { SerializedEntityError } from '../../../../src/errors/serializedEntityError.js';
import { v4 as uuidv4 } from 'uuid';

describe('EntityValidationFactory - Integration Tests', () => {
  let testBed;
  let entityManager;
  let entityFactory;
  let validationFactory;
  let registry;
  let logger;
  let validator;
  let cloner;
  let idGenerator;
  let defaultPolicy;

  beforeEach(async () => {
    testBed = new EntityManagerIntegrationTestBed();
    entityManager = testBed.entityManager;
    registry = testBed.mocks.registry;
    logger = testBed.mocks.logger;
    validator = testBed.mocks.validator;

    // Initialize global configuration
    initializeGlobalConfig(logger, {});

    // Create dependencies for the factories
    cloner = (data) => JSON.parse(JSON.stringify(data));
    idGenerator = () => uuidv4();
    defaultPolicy = {};

    // Create the EntityFactory with EntityValidationFactory
    const validateAndClone = createValidateAndClone(validator, logger, cloner);
    
    validationFactory = new EntityValidationFactory({
      validator,
      logger,
      validateAndClone,
    });

    entityFactory = new EntityFactory({
      validator,
      logger,
      idGenerator,
      cloner,
      defaultPolicy,
    });

    // Set up test entity definitions in the registry
    const actorDefinition = new EntityDefinition('core:actor', {
      description: 'Actor entity for testing',
      components: {
        'core:short_term_memory': {},
        'core:notes': {},
        'core:goals': {},
      },
    });

    const locationDefinition = new EntityDefinition('core:location', {
      description: 'Location entity for testing',
      components: {
        'core:description': {
          name: 'Default Location',
          description: 'A default place',
        },
      },
    });

    registry.store('entityDefinitions', 'core:actor', actorDefinition);
    registry.store('entityDefinitions', 'core:location', locationDefinition);

    // Set up component schemas in validator
    validator.validate.mockImplementation(() => ({ isValid: true }));
    
    // Reset mock calls before each test
    validator.validate.mockClear();
  });

  afterEach(async () => {
    resetGlobalConfig();
    await testBed.cleanup();
  });

  describe('Entity Creation Integration', () => {
    it('should validate component overrides during entity creation workflow', () => {
      // Arrange
      const actorDefinition = registry.get('entityDefinitions', 'core:actor');
      const componentOverrides = {
        'core:short_term_memory': {
          entries: ['test memory'],
        },
        'core:notes': {
          notes: ['test note'],
        },
      };
      const repository = new Map(); // Mock repository for duplicate checking

      // Act
      const validatedOverrides = validationFactory.validateOverrides(
        componentOverrides,
        actorDefinition,
        'test-actor-1'
      );

      // Create entity using EntityFactory
      const entity = entityFactory.create(
        'core:actor',
        { componentOverrides, instanceId: 'test-actor-1' },
        registry,
        repository,
        actorDefinition
      );

      // Assert
      expect(entity).toBeDefined();
      expect(entity.id).toBe('test-actor-1');
      expect(validatedOverrides).toBeDefined();
      expect(validatedOverrides['core:short_term_memory']).toEqual({ entries: ['test memory'] });
      expect(validatedOverrides['core:notes']).toEqual({ notes: ['test note'] });

      // Verify validation was called for component overrides
      expect(validator.validate).toHaveBeenCalledTimes(4); // 2 overrides + 2 entity creation calls
      
      // Check that the specific components were validated
      const calls = validator.validate.mock.calls;
      const shortTermMemoryCalls = calls.filter(call => call[0] === 'core:short_term_memory');
      const notesCalls = calls.filter(call => call[0] === 'core:notes');
      
      expect(shortTermMemoryCalls.length).toBeGreaterThan(0);
      expect(notesCalls.length).toBeGreaterThan(0);
    });

    it('should validate and resolve instance IDs correctly', () => {
      // Arrange
      const repository = new Map();

      // Test auto-generated ID
      const generatedId = validationFactory.resolveInstanceId(undefined, idGenerator);
      expect(generatedId).toBeDefined();
      expect(typeof generatedId).toBe('string');

      // Test specific ID
      const specificId = validationFactory.resolveInstanceId('specific-id', idGenerator);
      expect(specificId).toBe('specific-id');

      // Test validation of create IDs
      expect(() => {
        validationFactory.validateCreateIds('core:actor', 'valid-instance-id');
      }).not.toThrow();
    });

    it('should detect duplicate IDs during entity creation', () => {
      // Arrange - Mock repository with existing entity
      const repository = new Map();
      repository.set('duplicate-test', {});

      // Act & Assert - Attempting to create another with same ID should throw
      expect(() => {
        validationFactory.checkDuplicateId(
          repository,
          'duplicate-test',
          "Entity with ID 'duplicate-test' already exists."
        );
      }).toThrow(/already exists/);
    });

    it('should validate definition and instance IDs with proper error handling', () => {
      // Test invalid definition ID
      expect(() => {
        validationFactory.validateCreateIds('', 'valid-id');
      }).toThrow(TypeError);

      // Test invalid instance ID
      expect(() => {
        validationFactory.validateCreateIds('core:actor', '');
      }).toThrow(InvalidInstanceIdError);

      // Test null instance ID (should be allowed)
      expect(() => {
        validationFactory.validateCreateIds('core:actor', null);
      }).not.toThrow();

      // Test undefined instance ID (should be allowed)
      expect(() => {
        validationFactory.validateCreateIds('core:actor', undefined);
      }).not.toThrow();
    });

    it('should handle component validation failures during creation', () => {
      // Arrange - Mock validator to fail
      validator.validate.mockImplementation((typeId) => {
        if (typeId === 'core:short_term_memory') {
          return {
            isValid: false,
            errors: ['Invalid memory format'],
          };
        }
        return { isValid: true };
      });

      const actorDefinition = registry.get('entityDefinitions', 'core:actor');
      const componentOverrides = {
        'core:short_term_memory': {
          invalid: 'data',
        },
      };

      // Act & Assert
      expect(() => {
        validationFactory.validateOverrides(
          componentOverrides,
          actorDefinition,
          'test-actor-failure'
        );
      }).toThrow(/Invalid memory format/);
    });
  });

  describe('Entity Reconstruction Integration', () => {
    it('should validate serialized components during reconstruction workflow', () => {
      // Arrange
      const serializedEntity = {
        instanceId: 'reconstructed-actor',
        definitionId: 'core:actor',
        components: {
          'core:short_term_memory': {
            entries: ['restored memory'],
          },
          'core:notes': {
            notes: ['restored note'],
          },
          'core:goals': null, // Test null component handling
        },
      };
      const repository = new Map();

      // Act - Validate reconstruction data
      validationFactory.validateReconstructData(serializedEntity);

      // Validate serialized components
      const validatedComponents = validationFactory.validateSerializedComponents(
        serializedEntity.components,
        serializedEntity.instanceId,
        serializedEntity.definitionId
      );

      // Reconstruct entity using EntityFactory
      const entity = entityFactory.reconstruct(serializedEntity, registry, repository);

      // Assert
      expect(entity).toBeDefined();
      expect(entity.id).toBe('reconstructed-actor');
      expect(validatedComponents).toBeDefined();
      expect(validatedComponents['core:short_term_memory']).toEqual({ entries: ['restored memory'] });
      expect(validatedComponents['core:notes']).toEqual({ notes: ['restored note'] });
      expect(validatedComponents['core:goals']).toBeNull();

      // Verify validation was called for each non-null component
      const calls = validator.validate.mock.calls;
      const shortTermMemoryCalls = calls.filter(call => 
        call[0] === 'core:short_term_memory' && 
        JSON.stringify(call[1]) === JSON.stringify({ entries: ['restored memory'] })
      );
      const notesCalls = calls.filter(call => 
        call[0] === 'core:notes' && 
        JSON.stringify(call[1]) === JSON.stringify({ notes: ['restored note'] })
      );
      
      expect(shortTermMemoryCalls.length).toBeGreaterThanOrEqual(1);
      expect(notesCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle malformed serialized data with proper error messages', () => {
      // Test missing serialized entity
      expect(() => {
        validationFactory.validateReconstructData(null);
      }).toThrow(SerializedEntityError);

      // Test invalid serialized entity type
      expect(() => {
        validationFactory.validateReconstructData('invalid');
      }).toThrow(SerializedEntityError);

      // Test missing instanceId
      expect(() => {
        validationFactory.validateReconstructData({
          definitionId: 'core:actor',
          components: {},
        });
      }).toThrow(InvalidInstanceIdError);

      // Test invalid instanceId
      expect(() => {
        validationFactory.validateReconstructData({
          instanceId: '',
          definitionId: 'core:actor',
          components: {},
        });
      }).toThrow(InvalidInstanceIdError);
    });

    it('should prevent reconstruction of entities with duplicate IDs', () => {
      // Arrange - Mock repository with existing entity
      const repository = new Map();
      repository.set('duplicate-reconstruct', {});

      const serializedEntity = {
        instanceId: 'duplicate-reconstruct',
        definitionId: 'core:actor',
        components: {},
      };

      // Act & Assert
      expect(() => {
        validationFactory.checkDuplicateId(
          repository,
          'duplicate-reconstruct',
          "EntityFactory.reconstruct: Entity with ID 'duplicate-reconstruct' already exists. Reconstruction aborted."
        );
      }).toThrow(/already exists/);
    });

    it('should handle component validation failures during reconstruction', () => {
      // Arrange - Mock validator to fail for specific component
      validator.validate.mockImplementation((typeId) => {
        if (typeId === 'core:short_term_memory') {
          return {
            isValid: false,
            errors: ['Corrupted memory data'],
          };
        }
        return { isValid: true };
      });

      const components = {
        'core:short_term_memory': {
          corrupted: 'data',
        },
      };

      // Act & Assert
      expect(() => {
        validationFactory.validateSerializedComponents(
          components,
          'failed-reconstruction',
          'core:actor'
        );
      }).toThrow(/Corrupted memory data/);
    });

    it('should handle empty or missing components during reconstruction', () => {
      // Test with no components
      const emptyComponents = {};
      const validatedComponents1 = validationFactory.validateSerializedComponents(
        emptyComponents,
        'no-components',
        'core:actor'
      );
      expect(validatedComponents1).toEqual({});

      // Test with missing components (null/undefined)
      const validatedComponents2 = validationFactory.validateSerializedComponents(
        null,
        'missing-components',
        'core:actor'
      );
      expect(validatedComponents2).toEqual({});

      const validatedComponents3 = validationFactory.validateSerializedComponents(
        undefined,
        'missing-components',
        'core:actor'
      );
      expect(validatedComponents3).toEqual({});
    });
  });

  describe('Error Handling and Logging Integration', () => {
    it('should log validation progress during component validation', () => {
      // Arrange
      const components = {
        'core:short_term_memory': { entries: [] },
      };

      // Act
      validationFactory.validateSerializedComponents(
        components,
        'logging-test',
        'core:actor'
      );

      // Assert - Check that appropriate debug logs were made
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('EntityValidationFactory')
      );
    });

    it('should propagate validation errors with proper context through the call stack', () => {
      // Arrange - Set up validation failure
      validator.validate.mockImplementation(() => ({
        isValid: false,
        errors: ['Test validation error'],
      }));

      const components = {
        'core:short_term_memory': { invalid: 'data' },
      };

      // Act & Assert - Error should bubble up with proper context
      expect(() => {
        validationFactory.validateSerializedComponents(
          components,
          'error-test',
          'core:actor'
        );
      }).toThrow(/Test validation error/);

      // Verify error was logged
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Test validation error')
      );
    });
  });

  describe('Cross-Component Validation Scenarios', () => {
    it('should validate multiple component types with different schemas', () => {
      // Arrange - Set up different validation responses for different components
      validator.validate.mockImplementation((typeId) => {
        switch (typeId) {
          case 'core:short_term_memory':
            return { isValid: true };
          case 'core:notes':
            return { isValid: true };
          case 'core:goals':
            return { isValid: true };
          default:
            return { isValid: false, errors: ['Unknown component type'] };
        }
      });

      const actorDefinition = registry.get('entityDefinitions', 'core:actor');
      const componentOverrides = {
        'core:short_term_memory': { entries: ['memory 1', 'memory 2'] },
        'core:notes': { notes: ['note 1'] },
        'core:goals': { goals: ['goal 1'] },
      };

      // Act
      const validatedOverrides = validationFactory.validateOverrides(
        componentOverrides,
        actorDefinition,
        'multi-component-test'
      );

      // Assert
      expect(validatedOverrides).toBeDefined();
      expect(Object.keys(validatedOverrides)).toHaveLength(3);
      expect(validator.validate).toHaveBeenCalledTimes(3);
    });

    it('should handle new components not in original definition during override', () => {
      // Arrange - Add a component not in the original definition
      const actorDefinition = registry.get('entityDefinitions', 'core:actor');
      const componentOverrides = {
        'core:new_component': { data: 'new component data' },
      };

      // Act
      const validatedOverrides = validationFactory.validateOverrides(
        componentOverrides,
        actorDefinition,
        'new-component-test'
      );

      // Assert
      expect(validatedOverrides).toBeDefined();
      expect(validatedOverrides['core:new_component']).toEqual({ data: 'new component data' });
      // Verify validation was called for the new component
      expect(validator.validate).toHaveBeenCalledTimes(1);
      const calls = validator.validate.mock.calls;
      expect(calls[0][0]).toBe('core:new_component');
      expect(calls[0][1]).toEqual({ data: 'new component data' });
    });
  });

  describe('ID Resolution and Management', () => {
    it('should resolve instance IDs correctly with various input scenarios', () => {
      // Test with valid custom ID
      const customId = validationFactory.resolveInstanceId('custom-id-123', idGenerator);
      expect(customId).toBe('custom-id-123');

      // Test with generated ID
      const generatedId1 = validationFactory.resolveInstanceId(undefined, idGenerator);
      expect(generatedId1).toBeDefined();
      expect(typeof generatedId1).toBe('string');
      expect(generatedId1.length).toBeGreaterThan(0);

      // Test another generated ID to verify uniqueness
      const generatedId2 = validationFactory.resolveInstanceId(null, idGenerator);
      expect(generatedId2).toBeDefined();
      expect(typeof generatedId2).toBe('string');

      // Verify IDs are unique (high probability with UUID)
      expect(generatedId1).not.toBe(generatedId2);
    });

    it('should validate ID formats and reject invalid IDs', () => {
      // Test various invalid ID formats
      const invalidIds = [''];

      invalidIds.forEach((invalidId) => {
        // Empty string should throw
        expect(() => {
          validationFactory.validateCreateIds('core:actor', invalidId);
        }).toThrow();
      });

      // Test valid scenarios
      expect(() => {
        validationFactory.validateCreateIds('core:actor', null);
      }).not.toThrow();

      expect(() => {
        validationFactory.validateCreateIds('core:actor', undefined);
      }).not.toThrow();

      expect(() => {
        validationFactory.validateCreateIds('core:actor', 'valid-id');
      }).not.toThrow();
    });
  });
});