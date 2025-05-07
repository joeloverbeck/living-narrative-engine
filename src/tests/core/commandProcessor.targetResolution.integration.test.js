// src/tests/core/commandProcessor.targetResolution.integration.test.js

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import CommandProcessor from '../../core/commandProcessor.js';
import { TargetResolutionService } from '../../services/targetResolutionService.js';
import ResolutionStatus from '../../types/resolutionStatus.js'; // CommandProcessor uses this
import { getEntityIdsForScopes } from '../../services/entityScopeService.js'; // TRS dependency

// --- Mock Imports for Types ---
/** @typedef {import('../../core/interfaces/ICommandParser.js').ICommandParser} ICommandParser */
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../core/interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../../core/interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../core/interfaces/IWorldContext.js').IWorldContext} IWorldContext */
/** @typedef {import('../../core/interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../core/interfaces/IGameDataRepository.js').IGameDataRepository} IGameDataRepository */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../data/schemas/action-definition.schema.json').ActionDefinition} ActionDefinition */
/** @typedef {import('../../actions/actionTypes.js').ParsedCommand} ParsedCommand */
/** @typedef {import('../../actions/actionTypes.js').ActionContext} ActionContext */


// --- Shared Mocks ---
/** @type {jest.Mocked<IEntityManager>} */
let mockEntityManager;
/** @type {jest.Mocked<IWorldContext>} */
let mockWorldContext;
/** @type {jest.Mocked<IGameDataRepository>} */
let mockGameDataRepository;
/** @type {jest.Mocked<ILogger>} */
let mockLogger;

// --- CommandProcessor Specific Mocks ---
/** @type {jest.Mocked<ICommandParser>} */
let mockCommandParser;
/** @type {jest.Mocked<IValidatedEventDispatcher>} */
let mockValidatedEventDispatcher;
/** @type {jest.Mocked<ISafeEventDispatcher>} */
let mockSafeEventDispatcher;

// --- Real Services ---
/** @type {TargetResolutionService} */
let targetResolutionService;
/** @type {CommandProcessor} */
let commandProcessor;

// --- Helper Variables ---
/** @type {Entity} */
const mockActor = { id: 'player1', getComponentData: jest.fn(), hasComponent: jest.fn() };
const MOCK_LOCATION_ID = 'room101';
const MOCK_LOCATION_ENTITY = { id: MOCK_LOCATION_ID, name: 'A Room', getComponentData: jest.fn() };

const NAME_COMPONENT_ID = 'core:name';
const INVENTORY_COMPONENT_ID = 'core:inventory';
const EXITS_COMPONENT_ID = 'core:exits';


describe('CommandProcessor - TargetResolutionService Integration Tests', () => {
    beforeEach(() => {
        jest.resetAllMocks();

        mockEntityManager = {
            getEntityInstance: jest.fn(),
            getEntitiesInLocation: jest.fn().mockReturnValue(new Set()),
            createEntityInstance: jest.fn(),
            getComponentData: jest.fn(),
            hasComponent: jest.fn(),
            getEntitiesWithComponent: jest.fn(),
            addComponent: jest.fn(),
            removeComponent: jest.fn(),
        };
        mockWorldContext = {
            getLocationOfEntity: jest.fn(),
            getCurrentActor: jest.fn(),
            getCurrentLocation: jest.fn(),
        };
        mockGameDataRepository = {
            getActionDefinition: jest.fn(),
            getAllActionDefinitions: jest.fn(),
        };
        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        };
        mockCommandParser = { parse: jest.fn() };
        mockValidatedEventDispatcher = { dispatchValidated: jest.fn() };
        mockSafeEventDispatcher = { dispatchSafely: jest.fn().mockResolvedValue(true) };

        targetResolutionService = new TargetResolutionService({
            entityManager: mockEntityManager,
            worldContext: mockWorldContext,
            gameDataRepository: mockGameDataRepository,
            logger: mockLogger,
            getEntityIdsForScopes: getEntityIdsForScopes,
        });

        commandProcessor = new CommandProcessor({
            commandParser: mockCommandParser,
            targetResolutionService: targetResolutionService,
            logger: mockLogger,
            validatedEventDispatcher: mockValidatedEventDispatcher,
            safeEventDispatcher: mockSafeEventDispatcher,
            worldContext: mockWorldContext,
            entityManager: mockEntityManager,
            gameDataRepository: mockGameDataRepository,
        });

        mockWorldContext.getLocationOfEntity.mockReturnValue(MOCK_LOCATION_ENTITY);
        mockWorldContext.getCurrentLocation.mockReturnValue(MOCK_LOCATION_ENTITY);
        mockActor.getComponentData.mockImplementation((componentId) => {
            if (componentId === INVENTORY_COMPONENT_ID) return { items: [] };
            return undefined;
        });
        mockActor.hasComponent.mockReturnValue(true);
        mockEntityManager.getEntityInstance.mockImplementation(id => {
            if (id === mockActor.id) return mockActor;
            if (id === MOCK_LOCATION_ID) return MOCK_LOCATION_ENTITY;
            return undefined;
        });
    });

    describe('1. Valid Inventory Pick (e.g., "take key")', () => {
        it('should succeed and dispatch core:attempt_action', async () => {
            const commandString = 'take key';
            const actionId = 'verb:take';
            const keyEntityId = 'key1';
            const keyEntity = { id: keyEntityId, getComponentData: jest.fn(id => id === NAME_COMPONENT_ID ? { text: 'key' } : undefined) };

            mockCommandParser.parse.mockReturnValue({
                actionId: actionId, directObjectPhrase: 'key', originalInput: commandString, error: null,
            });
            mockGameDataRepository.getActionDefinition.mockReturnValue({
                id: actionId, name: 'take', target_domain: 'inventory',
            });
            mockActor.getComponentData.mockImplementation((componentId) => {
                if (componentId === INVENTORY_COMPONENT_ID) return { items: [keyEntityId] };
                return undefined;
            });
            mockEntityManager.getEntityInstance.mockImplementation(id => {
                if (id === keyEntityId) return keyEntity;
                if (id === mockActor.id) return mockActor;
                return undefined;
            });

            const result = await commandProcessor.processCommand(mockActor, commandString);

            expect(result.success).toBe(true); // Expecting success now
            expect(result.turnEnded).toBe(false);
            expect(result.error).toBeNull();
            expect(result.internalError).toBeNull();
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(
                'core:attempt_action',
                expect.objectContaining({
                    actorId: mockActor.id,
                    actionId: actionId,
                    targetId: keyEntityId,
                })
            );
        });
    });

    describe('2. Ambiguous Environment Object (e.g., "examine rock")', () => {
        it('should fail with a user-facing ambiguity message', async () => {
            const commandString = 'examine rock';
            const actionId = 'verb:examine';
            const rockEntity1 = { id: 'rock1', getComponentData: jest.fn(id => id === NAME_COMPONENT_ID ? { text: 'mossy rock' } : undefined) };
            const rockEntity2 = { id: 'rock2', getComponentData: jest.fn(id => id === NAME_COMPONENT_ID ? { text: 'flat rock' } : undefined) };

            mockCommandParser.parse.mockReturnValue({
                actionId: actionId, directObjectPhrase: 'rock', originalInput: commandString, error: null,
            });
            mockGameDataRepository.getActionDefinition.mockReturnValue({
                id: actionId, name: 'examine', target_domain: 'environment',
            });
            mockEntityManager.getEntitiesInLocation.mockReturnValue(new Set([mockActor.id, rockEntity1.id, rockEntity2.id]));
            mockEntityManager.getEntityInstance.mockImplementation(id => {
                if (id === mockActor.id) return mockActor;
                if (id === rockEntity1.id) return rockEntity1;
                if (id === rockEntity2.id) return rockEntity2;
                if (id === MOCK_LOCATION_ID) return MOCK_LOCATION_ENTITY;
                return undefined;
            });

            const result = await commandProcessor.processCommand(mockActor, commandString);

            expect(result.success).toBe(false);
            expect(result.turnEnded).toBe(false);
            expect(result.error).toBe("Could not resolve target: Which item containing \"rock\" did you mean? For example: \"mossy rock\", \"flat rock\".");
            expect(result.internalError).toContain('Target resolution failed');
            expect(result.internalError).toContain(ResolutionStatus.AMBIGUOUS);
            expect(mockSafeEventDispatcher.dispatchSafely).not.toHaveBeenCalledWith(
                'core:attempt_action', expect.anything()
            );
        });
    });

    describe('3. Target Not Found (e.g., "take unicorn")', () => {
        it('should fail with a user-facing "not found" message from inventory', async () => {
            const commandString = 'take unicorn';
            const actionId = 'verb:take';
            const otherItemId = 'other_item';
            const otherItemEntity = { id: otherItemId, getComponentData: jest.fn(id => id === NAME_COMPONENT_ID ? { text: 'some other item' } : undefined) };

            mockCommandParser.parse.mockReturnValue({
                actionId: actionId, directObjectPhrase: 'unicorn', originalInput: commandString, error: null,
            });
            mockGameDataRepository.getActionDefinition.mockReturnValue({
                id: actionId, name: 'take', target_domain: 'inventory',
            });
            mockActor.getComponentData.mockImplementation((componentId) => {
                if (componentId === INVENTORY_COMPONENT_ID) return { items: [otherItemId] }; // Inventory has an item, but not unicorn
                return undefined;
            });
            mockEntityManager.getEntityInstance.mockImplementation(id => {
                if (id === otherItemId) return otherItemEntity;
                if (id === mockActor.id) return mockActor;
                return undefined;
            });

            const result = await commandProcessor.processCommand(mockActor, commandString);

            expect(result.success).toBe(false);
            expect(result.turnEnded).toBe(false);
            expect(result.error).toBe("Could not resolve target: You don't have \"unicorn\" in your inventory.");
            expect(result.internalError).toContain('Target resolution failed');
            expect(result.internalError).toContain(ResolutionStatus.NOT_FOUND);
            expect(mockSafeEventDispatcher.dispatchSafely).not.toHaveBeenCalledWith(
                'core:attempt_action', expect.anything()
            );
        });

        it('should fail with a user-facing "not found" message from environment', async () => {
            const commandString = 'examine unicorn';
            const actionId = 'verb:examine';
            const otherEnvItemId = 'env_item';
            const otherEnvItemEntity = {id: otherEnvItemId, getComponentData: jest.fn(id => id === NAME_COMPONENT_ID ? { text: 'a mundane item' } : undefined) };

            mockCommandParser.parse.mockReturnValue({
                actionId: actionId, directObjectPhrase: 'unicorn', originalInput: commandString, error: null,
            });
            mockGameDataRepository.getActionDefinition.mockReturnValue({
                id: actionId, name: 'examine', target_domain: 'environment',
            });
            mockEntityManager.getEntitiesInLocation.mockReturnValue(new Set([mockActor.id, otherEnvItemId]));
            mockEntityManager.getEntityInstance.mockImplementation(id => {
                if (id === mockActor.id) return mockActor;
                if (id === otherEnvItemId) return otherEnvItemEntity;
                if (id === MOCK_LOCATION_ID) return MOCK_LOCATION_ENTITY;
                return undefined;
            });

            const result = await commandProcessor.processCommand(mockActor, commandString);

            expect(result.success).toBe(false);
            expect(result.turnEnded).toBe(false);
            // TRS _resolveEnvironment, when matchNames returns NOT_FOUND for a specific noun, uses _msgNounPhraseNotFound(nounPhrase, "here")
            // which results in "You don't see "{nounPhrase}" here."
            expect(result.error).toBe("Could not resolve target: You don't see \"unicorn\" here.");
            expect(result.internalError).toContain('Target resolution failed');
            expect(result.internalError).toContain(ResolutionStatus.NOT_FOUND);
            expect(mockSafeEventDispatcher.dispatchSafely).not.toHaveBeenCalledWith(
                'core:attempt_action', expect.anything()
            );
        });
    });


    describe('4. Ambiguous/Duplicate Direction (e.g., "go north")', () => {
        it('should fail if direction is ambiguously defined', async () => {
            const commandString = 'go north';
            const actionId = 'verb:go';
            mockCommandParser.parse.mockReturnValue({
                actionId: actionId, directObjectPhrase: 'north', originalInput: commandString, error: null,
            });
            mockGameDataRepository.getActionDefinition.mockReturnValue({
                id: actionId, name: 'go', target_domain: 'direction',
            });
            MOCK_LOCATION_ENTITY.getComponentData.mockImplementation(id => {
                if (id === EXITS_COMPONENT_ID) {
                    return [
                        { direction: 'north', locationId: 'loc-a' },
                        { direction: 'north', locationId: 'loc-b' }
                    ];
                }
                return undefined;
            });

            const result = await commandProcessor.processCommand(mockActor, commandString);

            expect(result.success).toBe(false);
            expect(result.turnEnded).toBe(false);
            expect(result.error).toBe("Could not resolve target: The direction \"north\" is ambiguously defined here.");
            expect(result.internalError).toContain('Target resolution failed');
            expect(result.internalError).toContain(ResolutionStatus.AMBIGUOUS);
            expect(mockSafeEventDispatcher.dispatchSafely).not.toHaveBeenCalledWith(
                'core:attempt_action', expect.anything()
            );
        });
    });


    describe("5. Action with Target Domain 'none' (e.g., \"wait\")", () => {
        it('should succeed and dispatch core:attempt_action', async () => {
            const commandString = 'wait';
            const actionId = 'verb:wait';
            mockCommandParser.parse.mockReturnValue({
                actionId: actionId, directObjectPhrase: null, originalInput: commandString, error: null,
            });
            mockGameDataRepository.getActionDefinition.mockReturnValue({
                id: actionId, name: 'wait', target_domain: 'none',
            });

            const result = await commandProcessor.processCommand(mockActor, commandString);

            expect(result.success).toBe(true);
            expect(result.turnEnded).toBe(false);
            expect(result.error).toBeNull();
            expect(result.internalError).toBeNull();
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(
                'core:attempt_action',
                expect.objectContaining({
                    actorId: mockActor.id,
                    actionId: actionId,
                    targetId: null,
                    direction: null,
                })
            );
        });
    });

    describe("6. Action with Target Domain 'self' (e.g., \"inventory\")", () => {
        it('should succeed and dispatch core:attempt_action targeting self', async () => {
            const commandString = 'inventory';
            const actionId = 'verb:inventory';
            mockCommandParser.parse.mockReturnValue({
                actionId: actionId, directObjectPhrase: null, originalInput: commandString, error: null,
            });
            mockGameDataRepository.getActionDefinition.mockReturnValue({
                id: actionId, name: 'inventory', target_domain: 'self',
            });

            const result = await commandProcessor.processCommand(mockActor, commandString);

            expect(result.success).toBe(true);
            expect(result.turnEnded).toBe(false);
            expect(result.error).toBeNull();
            expect(result.internalError).toBeNull();
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(
                'core:attempt_action',
                expect.objectContaining({
                    actorId: mockActor.id,
                    actionId: actionId,
                    targetId: mockActor.id,
                })
            );
        });
    });

    describe('CommandProcessor specific error handling (pre-TargetResolution)', () => {
        it('should return parsing error if commandParser fails', async () => {
            const commandString = 'gibberish command';
            const parsingErrorMsg = 'I do not understand "gibberish".';
            mockCommandParser.parse.mockReturnValue({
                error: parsingErrorMsg, actionId: null, originalInput: commandString
            });

            const result = await commandProcessor.processCommand(mockActor, commandString);

            expect(result.success).toBe(false);
            expect(result.error).toBe(parsingErrorMsg);
            expect(result.internalError).toContain(`Parsing Error: ${parsingErrorMsg}`);
            expect(mockSafeEventDispatcher.dispatchSafely).not.toHaveBeenCalledWith(
                'core:attempt_action', expect.anything()
            );
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(
                'core:command_parse_failed',
                expect.objectContaining({ actorId: mockActor.id, commandString: commandString, error: parsingErrorMsg, })
            );
        });

        it('should return error if action definition is not found', async () => {
            const commandString = 'unknown_action';
            const actionId = 'verb:unknown';
            mockCommandParser.parse.mockReturnValue({
                actionId: actionId, originalInput: commandString, error: null,
            });
            mockGameDataRepository.getActionDefinition.mockReturnValue(null);

            const result = await commandProcessor.processCommand(mockActor, commandString);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Internal error: The definition for this action is missing.');
            expect(result.internalError).toContain(`ActionDefinition not found for parsed actionId '${actionId}'`);
            expect(mockSafeEventDispatcher.dispatchSafely).not.toHaveBeenCalledWith(
                'core:attempt_action', expect.anything()
            );
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(
                'core:system_error_occurred',
                expect.objectContaining({ message: 'Internal error: The definition for this action is missing.', })
            );
        });
    });
});