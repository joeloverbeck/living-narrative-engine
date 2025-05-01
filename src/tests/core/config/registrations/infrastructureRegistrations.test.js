// src/tests/core/config/registrations/infrastructureRegistrations.test.js

import AppContainer from '../../../../core/config/appContainer.js';
import {tokens} from '../../../../core/config/tokens.js';
import {registerInfrastructure} from '../../../../core/config/registrations/infrastructureRegistrations.js';
import ValidatedEventDispatcher from '../../../../services/validatedEventDispatcher.js';
import {mockDeep} from 'jest-mock-extended';
import {afterEach, beforeEach, describe, expect, jest, test} from "@jest/globals"; // Need to install/use jest-mock-extended or similar

// --- Mock Dependencies ---
// Mock only the essential dependencies needed for registerInfrastructure and ValidatedEventDispatcher
const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
};
const mockEventBus = {
    dispatch: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
};
const mockGameDataRepository = {
    getEventDefinition: jest.fn(),
    getActionDefinition: jest.fn(),
    // Add other methods if VED indirectly needs them via GameDataRepository
};
const mockSchemaValidator = {
    validate: jest.fn().mockReturnValue({isValid: true}), // Assume valid by default
    isSchemaLoaded: jest.fn().mockReturnValue(true),        // Assume loaded by default
    addSchema: jest.fn(),
};
// Mocks for dependencies needed by WorldLoader factory inside registerInfrastructure
const mockDataRegistry = mockDeep(); // Using mockDeep for simplicity
const mockSchemaLoader = mockDeep();
const mockComponentLoader = mockDeep();
const mockRuleLoader = mockDeep();
const mockActionLoader = mockDeep();
const mockEventLoader = mockDeep();
const mockEntityLoader = mockDeep();
const mockConfiguration = mockDeep();
const mockGameConfigLoader = mockDeep();
const mockModManifestLoader = mockDeep();


describe('registerInfrastructure', () => {
    let container;

    beforeEach(() => {
        container = new AppContainer();
        // Register mocks needed by registerInfrastructure and its direct/indirect dependencies
        container.register(tokens.ILogger, () => mockLogger);
        container.register(tokens.EventBus, () => mockEventBus);
        container.register(tokens.GameDataRepository, () => mockGameDataRepository);
        container.register(tokens.ISchemaValidator, () => mockSchemaValidator);
        // Mocks for WorldLoader dependencies
        container.register(tokens.IDataRegistry, () => mockDataRegistry);
        container.register(tokens.SchemaLoader, () => mockSchemaLoader);
        container.register(tokens.ComponentDefinitionLoader, () => mockComponentLoader);
        container.register(tokens.RuleLoader, () => mockRuleLoader);
        container.register(tokens.ActionLoader, () => mockActionLoader);
        container.register(tokens.EventLoader, () => mockEventLoader);
        container.register(tokens.EntityLoader, () => mockEntityLoader);
        container.register(tokens.IConfiguration, () => mockConfiguration);
        container.register(tokens.GameConfigLoader, () => mockGameConfigLoader);
        container.register(tokens.ModManifestLoader, () => mockModManifestLoader);
        // Need IPathResolver for WorldLoader
        container.register(tokens.IPathResolver, () => mockDeep());
        // Need ISpatialIndexManager for EntityManager
        container.register(tokens.ISpatialIndexManager, () => mockDeep());
    });

    afterEach(() => {
        jest.clearAllMocks(); // Clear mocks between tests
    });

    test('should register EventBus correctly', () => {
        registerInfrastructure(container);
        expect(() => container.resolve(tokens.EventBus)).not.toThrow();
        const eventBus = container.resolve(tokens.EventBus);
        expect(eventBus).toBeDefined();
    });

    test('should register ISpatialIndexManager correctly', () => {
        registerInfrastructure(container);
        expect(() => container.resolve(tokens.ISpatialIndexManager)).not.toThrow();
        const spatialManager = container.resolve(tokens.ISpatialIndexManager);
        expect(spatialManager).toBeDefined();
    });

    test('should register WorldLoader correctly', () => {
        registerInfrastructure(container);
        expect(() => container.resolve(tokens.WorldLoader)).not.toThrow();
        const worldLoader = container.resolve(tokens.WorldLoader);
        expect(worldLoader).toBeDefined();
    });

    test('should register GameDataRepository correctly', () => {
        registerInfrastructure(container);
        expect(() => container.resolve(tokens.GameDataRepository)).not.toThrow();
        const repo = container.resolve(tokens.GameDataRepository);
        expect(repo).toBeDefined();
    });

    test('should register EntityManager correctly', () => {
        registerInfrastructure(container);
        expect(() => container.resolve(tokens.EntityManager)).not.toThrow();
        const entityManager = container.resolve(tokens.EntityManager);
        expect(entityManager).toBeDefined();
    });

    // --- ADDED TEST CASE for ValidatedEventDispatcher ---
    test('should register IValidatedEventDispatcher correctly', () => {
        // Arrange: Register necessary dependencies (done in beforeEach)
        // Act
        registerInfrastructure(container); // Call the registration function

        // Assert
        // 1. Check if resolving throws an error
        expect(() => container.resolve(tokens.IValidatedEventDispatcher)).not.toThrow();

        // 2. Check if the resolved instance is of the correct type
        const dispatcherInstance = container.resolve(tokens.IValidatedEventDispatcher);
        expect(dispatcherInstance).toBeInstanceOf(ValidatedEventDispatcher);

        // 3. Verify logger was called during registration (optional, but good practice)
        expect(mockLogger.debug).toHaveBeenCalledWith(`Infrastructure Registration: Registered ${tokens.IValidatedEventDispatcher}.`);
    });
    // --- END ADDED TEST CASE ---

    test('should register SystemServiceRegistry correctly', () => {
        registerInfrastructure(container);
        expect(() => container.resolve(tokens.SystemServiceRegistry)).not.toThrow();
        const registry = container.resolve(tokens.SystemServiceRegistry);
        expect(registry).toBeDefined();
    });

    test('should register SystemDataRegistry correctly', () => {
        registerInfrastructure(container);
        expect(() => container.resolve(tokens.SystemDataRegistry)).not.toThrow();
        const registry = container.resolve(tokens.SystemDataRegistry);
        expect(registry).toBeDefined();
    });

    test('should log completion message', () => {
        registerInfrastructure(container);
        expect(mockLogger.info).toHaveBeenCalledWith('Infrastructure Registration: complete.');
    });
});