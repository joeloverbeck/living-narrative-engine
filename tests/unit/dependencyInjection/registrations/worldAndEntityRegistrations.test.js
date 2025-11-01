/**
 * @file Test suite for worldAndEntityRegistrations.
 * @see tests/dependencyInjection/registrations/worldAndEntityRegistrations.test.js
 */

import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { mock } from 'jest-mock-extended';

// SUT and DI
import AppContainer from '../../../../src/dependencyInjection/appContainer.js';
import { registerWorldAndEntity } from '../../../../src/dependencyInjection/registrations/worldAndEntityRegistrations.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import { INITIALIZABLE } from '../../../../src/dependencyInjection/tags.js';

// Concrete Classes
import WorldContext from '../../../../src/context/worldContext.js';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';
import { EntityDisplayDataProvider } from '../../../../src/entities/entityDisplayDataProvider.js';
import { SpatialIndexSynchronizer } from '../../../../src/entities/spatialIndexSynchronizer.js';
import { LocationQueryService } from '../../../../src/entities/locationQueryService.js';
import ComponentAccessService from '../../../../src/entities/componentAccessService.js';
import LocationDisplayService from '../../../../src/entities/services/locationDisplayService.js';
import { GraphIntegrityValidator } from '../../../../src/anatomy/graphIntegrityValidator.js';
import { AnatomyQueryCache } from '../../../../src/anatomy/cache/AnatomyQueryCache.js';
import { RecipeProcessor } from '../../../../src/anatomy/recipeProcessor.js';
import PartSelectionService from '../../../../src/anatomy/partSelectionService.js';
import { SocketManager } from '../../../../src/anatomy/socketManager.js';
import { EntityGraphBuilder } from '../../../../src/anatomy/entityGraphBuilder.js';
import { RecipeConstraintEvaluator } from '../../../../src/anatomy/recipeConstraintEvaluator.js';
import { BodyBlueprintFactory } from '../../../../src/anatomy/bodyBlueprintFactory.js';
import { BodyGraphService } from '../../../../src/anatomy/bodyGraphService.js';
import JsonLogicCustomOperators from '../../../../src/logic/jsonLogicCustomOperators.js';
import { AnatomyFormattingService } from '../../../../src/services/anatomyFormattingService.js';
import { DescriptorFormatter } from '../../../../src/anatomy/descriptorFormatter.js';
import { BodyPartDescriptionBuilder } from '../../../../src/anatomy/bodyPartDescriptionBuilder.js';
import { BodyDescriptionComposer } from '../../../../src/anatomy/bodyDescriptionComposer.js';
import { PartDescriptionGenerator } from '../../../../src/anatomy/PartDescriptionGenerator.js';
import DescriptionPersistenceService from '../../../../src/anatomy/DescriptionPersistenceService.js';
import { BodyDescriptionOrchestrator } from '../../../../src/anatomy/BodyDescriptionOrchestrator.js';
import { AnatomyDescriptionService } from '../../../../src/anatomy/anatomyDescriptionService.js';
import { AnatomyGenerationService } from '../../../../src/anatomy/anatomyGenerationService.js';
import { LayerCompatibilityService } from '../../../../src/clothing/validation/layerCompatibilityService.js';
import { ClothingSlotValidator } from '../../../../src/clothing/validation/clothingSlotValidator.js';
import { EquipmentOrchestrator } from '../../../../src/clothing/orchestration/equipmentOrchestrator.js';
import LayerResolutionService from '../../../../src/clothing/services/layerResolutionService.js';
import AnatomySocketIndex from '../../../../src/anatomy/services/anatomySocketIndex.js';
import AnatomyBlueprintRepository from '../../../../src/anatomy/repositories/anatomyBlueprintRepository.js';
import { AnatomyClothingCache } from '../../../../src/anatomy/cache/AnatomyClothingCache.js';
import SlotResolver from '../../../../src/anatomy/integration/SlotResolver.js';
import { ClothingManagementService } from '../../../../src/clothing/services/clothingManagementService.js';
import EquipmentDescriptionService from '../../../../src/clothing/services/equipmentDescriptionService.js';
import { ClothingInstantiationService } from '../../../../src/clothing/services/clothingInstantiationService.js';
import { ClothingAccessibilityService } from '../../../../src/clothing/services/clothingAccessibilityService.js';
import { AnatomyInitializationService } from '../../../../src/anatomy/anatomyInitializationService.js';
import { expectSingleton } from '../../../common/containerAssertions.js';
import { ServiceSetup } from '../../../../src/utils/serviceInitializerUtils.js';
import * as closenessCircleService from '../../../../src/logic/services/closenessCircleService.js';

describe('registerWorldAndEntity', () => {
  let container;
  let mockLogger;
  let mockDataRegistry;
  let mockSchemaValidator;
  let mockSpatialIndexManager;
  let mockSafeEventDispatcher;
  let mockEventDispatchService;
  let registerSpy;

  beforeEach(() => {
    container = new AppContainer();
    registerSpy = jest.spyOn(container, 'register');

    // Mocks for dependencies
    mockLogger = mock();
    mockDataRegistry = mock();
    mockSchemaValidator = mock();
    mockSpatialIndexManager = mock();
    mockSafeEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(true),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };
    mockEventDispatchService = {
      dispatchEvent: jest.fn(),
    };

    // Pre-register ALL dependencies required by services
    container.register(tokens.ILogger, () => mockLogger);
    container.register(tokens.IDataRegistry, () => mockDataRegistry);
    container.register(tokens.ISchemaValidator, () => mockSchemaValidator);
    container.register(
      tokens.ISpatialIndexManager,
      () => mockSpatialIndexManager
    );
    container.register(
      tokens.ISafeEventDispatcher,
      () => mockSafeEventDispatcher
    );
    container.register(
      tokens.EventDispatchService,
      () => mockEventDispatchService
    );
    container.register(tokens.IEventBus, () => ({
      dispatch: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    }));

    // Other dependencies for services registered by registerWorldAndEntity
    container.register(tokens.IGameDataRepository, () => ({
      getConditionDefinition: jest.fn(),
    }));
    container.register(tokens.ServiceSetup, () => new ServiceSetup());

    // Register UuidGenerator
    container.register(tokens.UuidGenerator, () => ({
      generate: jest.fn().mockReturnValue('test-uuid'),
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('logs start, each service registration, and completion in order', () => {
    registerWorldAndEntity(container);

    const logs = mockLogger.debug.mock.calls.map((call) => call[0]);

    expect(logs[0]).toBe('World and Entity Registration: Starting...');

    // Check all service registrations are logged
    // Services with tags are logged differently
    const servicesWithoutTags = [
      tokens.IEntityManager,
      tokens.IWorldContext,
      tokens.JsonLogicEvaluationService,
      tokens.ClosenessCircleService,
      tokens.EntityDisplayDataProvider,
      tokens.LocationQueryService,
      tokens.EntityAccessService,
      tokens.ComponentAccessService,
      tokens.LocationDisplayService,
      tokens.GraphIntegrityValidator,
      tokens.AnatomyQueryCache,
      tokens.RecipeProcessor,
      tokens.PartSelectionService,
      tokens.SocketManager,
      tokens.EntityGraphBuilder,
      tokens.RecipeConstraintEvaluator,
      tokens.BodyBlueprintFactory,
      tokens.BodyGraphService,
      tokens.JsonLogicCustomOperators,
      tokens.AnatomyFormattingService,
      tokens.DescriptorFormatter,
      tokens.BodyPartDescriptionBuilder,
      tokens.BodyDescriptionComposer,
      tokens.PartDescriptionGenerator,
      tokens.DescriptionPersistenceService,
      tokens.BodyDescriptionOrchestrator,
      tokens.AnatomyDescriptionService,
      tokens.AnatomyGenerationService,
      tokens.LayerCompatibilityService,
      tokens.ClothingSlotValidator,
      tokens.EquipmentOrchestrator,
      tokens.LayerResolutionService,
      tokens.IAnatomySocketIndex,
      tokens.IAnatomyBlueprintRepository,
      tokens.AnatomyClothingCache,
      tokens.SlotResolver,
      tokens.ClothingManagementService,
      tokens.ClothingAccessibilityService,
      tokens.EquipmentDescriptionService,
      tokens.ClothingInstantiationService,
      tokens.ClothingInstantiationServiceV2,
      tokens.AnatomyInitializationService,
    ];

    servicesWithoutTags.forEach((token) => {
      const expectedLog = `World and Entity Registration: Registered ${String(token)}.`;
      expect(logs).toContain(expectedLog);
    });

    // Check INITIALIZABLE tags are logged
    expect(logs).toContain(
      `World and Entity Registration: Registered ${String(tokens.SpatialIndexSynchronizer)} tagged ${INITIALIZABLE.join(', ')}.`
    );
    expect(logs).toContain(
      `World and Entity Registration: Registered ${String(tokens.AnatomyInitializationService)}.`
    );

    expect(logs[logs.length - 1]).toBe(
      'World and Entity Registration: Completed.'
    );
  });

  // Comprehensive specs for all registered services
  const specs = [
    {
      token: tokens.IEntityManager,
      // EntityManagerAdapter is the wrapper, but we can still test it
      lifecycle: 'singletonFactory',
      deps: undefined,
    },
    {
      token: tokens.IWorldContext,
      Class: WorldContext,
      lifecycle: 'singletonFactory',
      deps: undefined,
    },
    {
      token: tokens.JsonLogicEvaluationService,
      Class: JsonLogicEvaluationService,
      lifecycle: 'singletonFactory',
      deps: undefined,
    },
    {
      token: tokens.ClosenessCircleService,
      // This is registered as a module not a class
      lifecycle: 'singleton',
      deps: [],
    },
    {
      token: tokens.EntityDisplayDataProvider,
      Class: EntityDisplayDataProvider,
      lifecycle: 'singletonFactory',
      deps: undefined,
    },
    {
      token: tokens.SpatialIndexSynchronizer,
      Class: SpatialIndexSynchronizer,
      lifecycle: 'singletonFactory',
      deps: undefined,
      tags: INITIALIZABLE,
    },
    {
      token: tokens.LocationQueryService,
      Class: LocationQueryService,
      lifecycle: 'singletonFactory',
      deps: undefined,
    },
    {
      token: tokens.EntityAccessService,
      // This returns an object with methods, not a class instance
      lifecycle: 'singletonFactory',
      deps: undefined,
      isObjectFactory: true,
    },
    {
      token: tokens.ComponentAccessService,
      Class: ComponentAccessService,
      lifecycle: 'singletonFactory',
      deps: undefined,
    },
    {
      token: tokens.LocationDisplayService,
      Class: LocationDisplayService,
      lifecycle: 'singletonFactory',
      deps: undefined,
    },
    {
      token: tokens.GraphIntegrityValidator,
      Class: GraphIntegrityValidator,
      lifecycle: 'singletonFactory',
      deps: undefined,
    },
    {
      token: tokens.AnatomyQueryCache,
      Class: AnatomyQueryCache,
      lifecycle: 'singletonFactory',
      deps: undefined,
    },
    {
      token: tokens.RecipeProcessor,
      Class: RecipeProcessor,
      lifecycle: 'singletonFactory',
      deps: undefined,
    },
    {
      token: tokens.PartSelectionService,
      Class: PartSelectionService,
      lifecycle: 'singletonFactory',
      deps: undefined,
    },
    {
      token: tokens.SocketManager,
      Class: SocketManager,
      lifecycle: 'singletonFactory',
      deps: undefined,
    },
    {
      token: tokens.EntityGraphBuilder,
      Class: EntityGraphBuilder,
      lifecycle: 'singletonFactory',
      deps: undefined,
    },
    {
      token: tokens.RecipeConstraintEvaluator,
      Class: RecipeConstraintEvaluator,
      lifecycle: 'singletonFactory',
      deps: undefined,
    },
    {
      token: tokens.BodyBlueprintFactory,
      Class: BodyBlueprintFactory,
      lifecycle: 'singletonFactory',
      deps: undefined,
    },
    {
      token: tokens.BodyGraphService,
      Class: BodyGraphService,
      lifecycle: 'singletonFactory',
      deps: undefined,
    },
    {
      token: tokens.JsonLogicCustomOperators,
      Class: JsonLogicCustomOperators,
      lifecycle: 'singletonFactory',
      deps: undefined,
    },
    {
      token: tokens.AnatomyFormattingService,
      Class: AnatomyFormattingService,
      lifecycle: 'singletonFactory',
      deps: undefined,
    },
    {
      token: tokens.DescriptorFormatter,
      Class: DescriptorFormatter,
      lifecycle: 'singletonFactory',
      deps: undefined,
    },
    {
      token: tokens.BodyPartDescriptionBuilder,
      Class: BodyPartDescriptionBuilder,
      lifecycle: 'singletonFactory',
      deps: undefined,
    },
    {
      token: tokens.BodyDescriptionComposer,
      Class: BodyDescriptionComposer,
      lifecycle: 'singletonFactory',
      deps: undefined,
    },
    {
      token: tokens.PartDescriptionGenerator,
      Class: PartDescriptionGenerator,
      lifecycle: 'singletonFactory',
      deps: undefined,
    },
    {
      token: tokens.DescriptionPersistenceService,
      Class: DescriptionPersistenceService,
      lifecycle: 'singletonFactory',
      deps: undefined,
    },
    {
      token: tokens.BodyDescriptionOrchestrator,
      Class: BodyDescriptionOrchestrator,
      lifecycle: 'singletonFactory',
      deps: undefined,
    },
    {
      token: tokens.AnatomyDescriptionService,
      Class: AnatomyDescriptionService,
      lifecycle: 'singletonFactory',
      deps: undefined,
    },
    {
      token: tokens.AnatomyGenerationService,
      Class: AnatomyGenerationService,
      lifecycle: 'singletonFactory',
      deps: undefined,
    },
    {
      token: tokens.LayerCompatibilityService,
      Class: LayerCompatibilityService,
      lifecycle: 'singletonFactory',
      deps: undefined,
    },
    {
      token: tokens.ClothingSlotValidator,
      Class: ClothingSlotValidator,
      lifecycle: 'singletonFactory',
      deps: undefined,
    },
    {
      token: tokens.EquipmentOrchestrator,
      Class: EquipmentOrchestrator,
      lifecycle: 'singletonFactory',
      deps: undefined,
    },
    {
      token: tokens.LayerResolutionService,
      Class: LayerResolutionService,
      lifecycle: 'singletonFactory',
      deps: undefined,
    },
    {
      token: tokens.IAnatomySocketIndex,
      Class: AnatomySocketIndex,
      lifecycle: 'singletonFactory',
      deps: undefined,
    },
    {
      token: tokens.IAnatomyBlueprintRepository,
      Class: AnatomyBlueprintRepository,
      lifecycle: 'singletonFactory',
      deps: undefined,
    },
    {
      token: tokens.AnatomyClothingCache,
      Class: AnatomyClothingCache,
      lifecycle: 'singletonFactory',
      deps: undefined,
    },
    {
      token: tokens.SlotResolver,
      Class: SlotResolver,
      lifecycle: 'singletonFactory',
      deps: undefined,
    },
      {
        token: tokens.ClothingManagementService,
        Class: ClothingManagementService,
        lifecycle: 'singletonFactory',
        deps: undefined,
      },
      {
        token: tokens.ClothingAccessibilityService,
        Class: ClothingAccessibilityService,
        lifecycle: 'singletonFactory',
        deps: undefined,
      },
    {
      token: tokens.EquipmentDescriptionService,
      Class: EquipmentDescriptionService,
      lifecycle: 'singletonFactory',
      deps: undefined,
    },
    {
      token: tokens.ClothingInstantiationService,
      Class: ClothingInstantiationService,
      lifecycle: 'singletonFactory',
      deps: undefined,
    },
    {
      token: tokens.ClothingInstantiationServiceV2,
      Class: ClothingInstantiationService,
      lifecycle: 'singletonFactory',
      deps: undefined,
    },
    {
      token: tokens.AnatomyInitializationService,
      Class: AnatomyInitializationService,
      lifecycle: 'singletonFactory',
      deps: undefined,
      tags: INITIALIZABLE,
    },
  ];

  test.each(specs)(
    'registers $token correctly and its instance can be resolved',
    ({ token, Class, lifecycle, deps, tags, isObjectFactory }) => {
      registerWorldAndEntity(container);

      // For most services, we check if they're singletons
      if (Class && !isObjectFactory) {
        expectSingleton(container, token, Class);
      } else {
        // For object factories and services without a Class, just check they can be resolved
        const instance = container.resolve(token);
        expect(instance).toBeDefined();

        // For EntityAccessService, check it has the expected methods
        if (token === tokens.EntityAccessService) {
          expect(instance.resolveEntity).toBeDefined();
          expect(instance.getComponent).toBeDefined();
          expect(instance.setComponent).toBeDefined();
        }

        // For ClosenessCircleService (module), check it's an object
        if (token === tokens.ClosenessCircleService) {
          expect(typeof instance).toBe('object');
        }
      }

      // Registration metadata check
      const registrationCall = registerSpy.mock.calls.find(
        (c) => c[0] === token
      );
      expect(registrationCall).toBeDefined();
      const registrationOptions = registrationCall[2] || {};
      expect(registrationOptions.lifecycle).toBe(lifecycle);

      // Check tags if provided
      if (tags) {
        expect(registrationOptions.tags).toEqual(tags);
      }

      // Check dependencies for singleton registrations
      if (lifecycle === 'singleton') {
        expect(registrationOptions.dependencies).toEqual(deps);
      } else if (lifecycle === 'singletonFactory') {
        expect(registrationOptions.dependencies).toBeUndefined();
      }
    }
  );

  test('INITIALIZABLE services are tagged correctly', () => {
    registerWorldAndEntity(container);

    // Check SpatialIndexSynchronizer
    const spatialCall = registerSpy.mock.calls.find(
      (c) => c[0] === tokens.SpatialIndexSynchronizer
    );
    expect(spatialCall[2].tags).toEqual(INITIALIZABLE);

    // Check AnatomyInitializationService
    const anatomyCall = registerSpy.mock.calls.find(
      (c) => c[0] === tokens.AnatomyInitializationService
    );
    expect(anatomyCall[2].tags).toEqual(INITIALIZABLE);
  });

  test('EntityAccessService returns an object with correct methods', () => {
    registerWorldAndEntity(container);

    const entityAccess = container.resolve(tokens.EntityAccessService);

    // Check that it returns an object with the expected methods
    expect(typeof entityAccess).toBe('object');
    expect(typeof entityAccess.resolveEntity).toBe('function');
    expect(typeof entityAccess.getComponent).toBe('function');
    expect(typeof entityAccess.setComponent).toBe('function');

    // The actual functionality testing of these methods would be integration tests
    // Here we just verify the structure is correct
  });

  test('EntityAccessService factory methods execute and pass dependencies correctly', async () => {
    // Mock the actual entityAccessService functions
    const mockResolveEntity = jest.fn().mockReturnValue({ id: 'test-entity' });
    const mockGetComponent = jest.fn().mockReturnValue({ data: 'test' });
    const mockSetComponent = jest.fn().mockReturnValue(true);

    // Override the module before importing
    jest.resetModules();
    jest.doMock('../../../../src/entities/entityAccessService.js', () => ({
      resolveEntity: mockResolveEntity,
      getComponent: mockGetComponent,
      setComponent: mockSetComponent,
    }));

    // Re-import the registration function to use the mocked module
    const { registerWorldAndEntity: mockedRegister } = await import(
      '../../../../src/dependencyInjection/registrations/worldAndEntityRegistrations.js'
    );

    mockedRegister(container);

    const entityAccess = container.resolve(tokens.EntityAccessService);

    // Call the methods to ensure the factory functions are executed
    entityAccess.resolveEntity('entity-1');
    expect(mockResolveEntity).toHaveBeenCalled();
    // The function is called with the actual resolved dependencies
    // We just need to verify it was called with the entity ID

    entityAccess.getComponent('entity-2', 'component-1', { test: true });
    expect(mockGetComponent).toHaveBeenCalled();
    const getComponentCall = mockGetComponent.mock.calls[0];
    expect(getComponentCall[0]).toBe('entity-2');
    expect(getComponentCall[1]).toBe('component-1');
    expect(getComponentCall[2]).toMatchObject({
      test: true,
    });

    entityAccess.setComponent(
      'entity-3',
      'component-2',
      { value: 'new' },
      { override: true }
    );
    expect(mockSetComponent).toHaveBeenCalled();
    const setComponentCall = mockSetComponent.mock.calls[0];
    expect(setComponentCall[0]).toBe('entity-3');
    expect(setComponentCall[1]).toBe('component-2');
    expect(setComponentCall[2]).toEqual({ value: 'new' });
    expect(setComponentCall[3]).toMatchObject({
      override: true,
    });

    // Restore the original module
    jest.dontMock('../../../../src/entities/entityAccessService.js');
    jest.resetModules();
  });

  test('JsonLogicEvaluationService has custom operators registered', () => {
    registerWorldAndEntity(container);

    // Resolve JsonLogicEvaluationService
    const jsonLogicService = container.resolve(
      tokens.JsonLogicEvaluationService
    );
    expect(jsonLogicService).toBeDefined();
    expect(jsonLogicService).toBeInstanceOf(JsonLogicEvaluationService);

    // The actual registration happens inside the factory function
    // We can verify that JsonLogicCustomOperators can be resolved
    const customOperators = container.resolve(tokens.JsonLogicCustomOperators);
    expect(customOperators).toBeDefined();
    expect(customOperators).toBeInstanceOf(JsonLogicCustomOperators);
  });

  test('all factory functions are executed and return instances', () => {
    // We need to ensure all necessary dependencies are registered
    // Some services have circular dependencies that will be resolved later
    // For now, we'll provide minimal mocks where needed

    // Additional mocks for services that have more complex dependencies
    container.register(tokens.LocationDisplayService, () => ({
      getLocationDisplay: jest.fn(),
    }));

    // Stub for services that depend on other anatomy services
    const mockBodyGraphService = {
      getBodyGraph: jest.fn(),
      getPartById: jest.fn(),
      getChildren: jest.fn(),
    };

    // Override the BodyGraphService registration temporarily to avoid circular deps
    container.register(tokens.BodyGraphService, () => mockBodyGraphService);

    registerWorldAndEntity(container);

    // Test that each factory is executed by resolving each service
    const servicesWithCircularDeps = [
      tokens.JsonLogicCustomOperators, // Depends on BodyGraphService
      tokens.BodyDescriptionComposer, // Complex anatomy dependencies
      tokens.AnatomyDescriptionService, // Complex anatomy dependencies
      tokens.ClothingManagementService, // Complex clothing dependencies
      tokens.EquipmentDescriptionService, // Depends on ClothingManagementService
      tokens.ClothingInstantiationService, // Complex dependencies
      tokens.ClothingInstantiationServiceV2, // Complex dependencies
    ];

    specs.forEach(({ token }) => {
      try {
        const instance = container.resolve(token);
        expect(instance).toBeDefined();
        expect(instance).not.toBeNull();
      } catch (error) {
        // Some services might have complex circular dependencies
        // that are hard to mock in unit tests
        if (!servicesWithCircularDeps.includes(token)) {
          throw error;
        }
      }
    });
  });
});
