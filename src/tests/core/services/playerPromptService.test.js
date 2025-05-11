// src/tests/core/services/playerPromptService.test.js
// --- FILE START ---

import PlayerPromptService from '../../../core/turns/services/playerPromptService.js';
import {beforeEach, describe, expect, it, jest} from "@jest/globals";
import Entity from "../../../entities/entity.js"; // Import Entity for mock actor

// --- Import the ACTUAL Custom Error ---
// Import the same PromptError used by the service code
import { PromptError } from '../../../core/errors/promptError.js'; // Adjust path if necessary
// --- Removed inline PromptError definition ---


// Mock implementations for dependencies
const createMockLogger = () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
});

const createMockActionDiscoverySystem = () => ({
    getValidActions: jest.fn(),
});

const createMockPromptOutputPort = () => ({
    prompt: jest.fn(),
});

const createMockWorldContext = () => ({
    getLocationOfEntity: jest.fn(),
    getCurrentActor: jest.fn(),
    getCurrentLocation: jest.fn(),
});

const createMockEntityManager = () => ({
    getEntityInstance: jest.fn(),
    getComponentData: jest.fn(),
    hasComponent: jest.fn(),
});

const createMockGameDataRepository = () => ({
    getActionDefinition: jest.fn(),
    getEntityDefinition: jest.fn(),
});

// --- Shared Variables ---
let mockLogger;
let mockActionDiscoverySystem;
let mockPromptOutputPort;
let mockWorldContext;
let mockEntityManager;
let mockGameDataRepository;
let validDependencies;
let service; // The PlayerPromptService instance
let mockActor; // Define mockActor globally for use in tests

beforeEach(() => {
    // Reset mocks before each test
    mockLogger = createMockLogger();
    mockActionDiscoverySystem = createMockActionDiscoverySystem();
    mockPromptOutputPort = createMockPromptOutputPort();
    mockWorldContext = createMockWorldContext();
    mockEntityManager = createMockEntityManager();
    mockGameDataRepository = createMockGameDataRepository();

    validDependencies = {
        logger: mockLogger,
        actionDiscoverySystem: mockActionDiscoverySystem,
        promptOutputPort: mockPromptOutputPort,
        worldContext: mockWorldContext,
        entityManager: mockEntityManager,
        gameDataRepository: mockGameDataRepository,
    };

    // Instantiate the service for tests that need it
    service = new PlayerPromptService(validDependencies);

    // Define a standard mock actor for tests
    mockActor = new Entity('player:test');
});


describe('PlayerPromptService Constructor', () => {
    // --- Existing Constructor tests remain unchanged ---
    it('should succeed when all valid dependencies are provided', () => {
        expect(() => new PlayerPromptService(validDependencies)).not.toThrow();
        const localService = new PlayerPromptService(validDependencies); // Use local instance for this test
        expect(localService).toBeInstanceOf(PlayerPromptService);
        expect(mockLogger.info).toHaveBeenCalledWith('PlayerPromptService initialized successfully.');
    });

    describe('Logger Dependency Validation', () => { /* ... */ });
    describe('ActionDiscoverySystem Dependency Validation', () => { /* ... */ });
    describe('PromptOutputPort Dependency Validation', () => { /* ... */ });
    describe('WorldContext Dependency Validation', () => { /* ... */ });
    describe('EntityManager Dependency Validation', () => { /* ... */ });
    describe('GameDataRepository Dependency Validation', () => { /* ... */ });
});


// --- UPDATED & NEW: Prompt Method Tests ---
describe('PlayerPromptService prompt Method', () => {

    // --- Happy Path Test (already exists, should still pass) ---
    it('should execute the happy path successfully', async () => {
        const mockLocation = new Entity('location:test');
        const mockDiscoveredActions = [{ id: 'core:look', command: 'look' }];

        mockWorldContext.getLocationOfEntity.mockResolvedValue(mockLocation);
        mockActionDiscoverySystem.getValidActions.mockResolvedValue(mockDiscoveredActions);
        mockPromptOutputPort.prompt.mockResolvedValue(undefined);

        await expect(service.prompt(mockActor)).resolves.toBeUndefined();

        expect(mockWorldContext.getLocationOfEntity).toHaveBeenCalledWith(mockActor.id);
        expect(mockActionDiscoverySystem.getValidActions).toHaveBeenCalledWith(mockActor, expect.any(Object));
        expect(mockPromptOutputPort.prompt).toHaveBeenCalledWith(mockActor.id, mockDiscoveredActions);
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Successfully sent prompt for actor ${mockActor.id}`));
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    // --- Invalid Actor Test ---
    describe('when actor input is invalid', () => {
        it.each([
            [null, 'null'],
            [undefined, 'undefined'],
            [{}, 'empty object'],
            [{ id: '' }, 'object with empty id'],
            [{ id: '   ' }, 'object with whitespace id'],
            ['not an entity', 'string'],
            [123, 'number'],
        ])('should reject with PromptError for invalid actor: %p (%s)', async (invalidActor, description) => {
            // Use try/catch to call only once and assert on the error
            let caughtError;
            try {
                await service.prompt(invalidActor);
            } catch (error) {
                caughtError = error;
            }

            expect(caughtError).toBeInstanceOf(PromptError);
            expect(caughtError.message).toMatch(/^Invalid actor provided/);
            expect(caughtError.cause).toBeUndefined(); // Verify no wrapping

            expect(mockLogger.error).toHaveBeenCalledWith(
                'PlayerPromptService.prompt: Invalid actor provided.',
                { actor: invalidActor }
            );

            // Ensure downstream calls were not made
            expect(mockWorldContext.getLocationOfEntity).not.toHaveBeenCalled();
            expect(mockActionDiscoverySystem.getValidActions).not.toHaveBeenCalled();
            expect(mockPromptOutputPort.prompt).not.toHaveBeenCalled();
        });
    });

    // --- Location Fetch Error Test ---
    it('should reject with PromptError if getLocationOfEntity throws', async () => {
        const locationError = new Error('Database connection failed');
        mockWorldContext.getLocationOfEntity.mockRejectedValue(locationError);

        // Use try/catch to call only once
        let caughtError;
        try {
            await service.prompt(mockActor);
        } catch (error) {
            caughtError = error;
        }

        expect(caughtError).toBeInstanceOf(PromptError);
        expect(caughtError).toMatchObject({
            message: `Failed to determine actor location for ${mockActor.id}`,
            cause: locationError,
        });

        // Verify logging
        expect(mockLogger.error).toHaveBeenCalledWith(
            `PlayerPromptService.prompt: Error fetching location for actor ${mockActor.id}.`,
            locationError
        );

        // Ensure downstream calls were not made
        expect(mockActionDiscoverySystem.getValidActions).not.toHaveBeenCalled();
        expect(mockPromptOutputPort.prompt).not.toHaveBeenCalled();
    });

    // --- Location Fetch Null/Undefined Test ---
    it.each([
        [null],
        [undefined]
    ])('should reject with PromptError if getLocationOfEntity resolves with %p', async (resolvedValue) => {
        mockWorldContext.getLocationOfEntity.mockResolvedValue(resolvedValue);

        // Use try/catch to call only once
        let caughtError;
        try {
            await service.prompt(mockActor);
        } catch (error) {
            caughtError = error;
        }

        expect(caughtError).toBeInstanceOf(PromptError);
        expect(caughtError).toMatchObject({
            message: `Failed to determine actor location for ${mockActor.id}: Location not found or undefined.`,
            cause: undefined,
        });

        // Verify logging
        expect(mockLogger.error).toHaveBeenCalledWith(
            `PlayerPromptService.prompt: Failed to get location for actor ${mockActor.id} (getLocationOfEntity resolved null/undefined).`
        );

        // Ensure downstream calls were not made
        expect(mockActionDiscoverySystem.getValidActions).not.toHaveBeenCalled();
        expect(mockPromptOutputPort.prompt).not.toHaveBeenCalled();
    });

    // --- Action Discovery Error Test ---
    describe('when action discovery fails', () => {
        const discoveryError = new Error('Discovery Boom!');
        const mockLocation = new Entity('location:test');

        beforeEach(() => {
            mockWorldContext.getLocationOfEntity.mockResolvedValue(mockLocation);
            mockActionDiscoverySystem.getValidActions.mockRejectedValue(discoveryError);
            mockPromptOutputPort.prompt.mockClear(); // Clear port mock for each sub-test
        });

        it('should reject with PromptError wrapping the discovery error', async () => {
            mockPromptOutputPort.prompt.mockResolvedValue(undefined); // Error path port call succeeds

            // Use try/catch to call only once
            let caughtError;
            try {
                await service.prompt(mockActor);
            } catch (error) {
                caughtError = error;
            }

            expect(caughtError).toBeInstanceOf(PromptError);
            expect(caughtError).toMatchObject({
                message: `Action discovery failed for actor ${mockActor.id}`,
                cause: discoveryError,
            });
        });

        it('should log the discovery error', async () => {
            mockPromptOutputPort.prompt.mockResolvedValue(undefined);
            await service.prompt(mockActor).catch(() => {}); // Suppress rejection for logging check

            expect(mockLogger.error).toHaveBeenCalledWith(
                `PlayerPromptService: Action discovery failed for actor ${mockActor.id}.`,
                discoveryError
            );
        });

        it('should attempt to call the output port with empty actions and error message', async () => {
            mockPromptOutputPort.prompt.mockResolvedValue(undefined);
            await service.prompt(mockActor).catch(() => {}); // Suppress rejection for mock check

            expect(mockPromptOutputPort.prompt).toHaveBeenCalledTimes(1);
            expect(mockPromptOutputPort.prompt).toHaveBeenCalledWith(
                mockActor.id,
                [],
                discoveryError.message
            );
        });

        it('should still reject with the original discovery PromptError even if the error-path port call fails', async () => {
            const portError = new Error('Error path port Boom!');
            mockPromptOutputPort.prompt.mockRejectedValue(portError); // Make error path port call fail

            // Use try/catch to call only once
            let caughtError;
            try {
                await service.prompt(mockActor);
            } catch (error) {
                caughtError = error;
            }

            expect(caughtError).toBeInstanceOf(PromptError);
            // Still expect the PromptError wrapping the *discovery* error
            expect(caughtError).toMatchObject({
                message: `Action discovery failed for actor ${mockActor.id}`,
                cause: discoveryError,
            });

            // Verify the secondary port error was logged
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`Failed to send error prompt via output port for actor ${mockActor.id} AFTER discovery failure`),
                portError
            );
            // Verify the original discovery error was also logged
            expect(mockLogger.error).toHaveBeenCalledWith(
                `PlayerPromptService: Action discovery failed for actor ${mockActor.id}.`,
                discoveryError
            );
        });
    });

    // --- Output Port Error Test (Happy Path Port Call Fails) ---
    // --- THIS IS THE CORRECTED TEST ---
    it('should reject with PromptError if the happy-path promptOutputPort.prompt throws', async () => {
        const portError = new Error('Port Boom!');
        const mockLocation = new Entity('location:test');
        const mockDiscoveredActions = [{ id: 'core:look', command: 'look' }];

        // Setup mocks
        mockWorldContext.getLocationOfEntity.mockResolvedValue(mockLocation);
        mockActionDiscoverySystem.getValidActions.mockResolvedValue(mockDiscoveredActions);
        mockPromptOutputPort.prompt.mockRejectedValue(portError); // Fail on the happy path call

        // Call the function ONCE and catch the error
        let caughtError;
        try {
            await service.prompt(mockActor);
        } catch (error) {
            caughtError = error;
        }

        // Assertions on the caught error
        expect(caughtError).toBeInstanceOf(PromptError);
        expect(caughtError).toMatchObject({
            message: `Failed to dispatch prompt via output port for actor ${mockActor.id}`,
            cause: portError,
        });

        // Assertions on logging
        expect(mockLogger.error).toHaveBeenCalledWith(
            `PlayerPromptService: Failed to dispatch prompt via output port for actor ${mockActor.id}.`,
            portError
        );

        // Assertions on mock calls (should now pass)
        expect(mockPromptOutputPort.prompt).toHaveBeenCalledTimes(1);
        expect(mockPromptOutputPort.prompt).toHaveBeenCalledWith(mockActor.id, mockDiscoveredActions);
    });
    // --- END OF CORRECTED TEST ---

});
// --- FILE END ---