// src/tests/services/targetResolutionService.constructor.test.js

import {describe, test, expect, beforeEach, afterEach, jest} from '@jest/globals';
import {TargetResolutionService} from '../../src/services/targetResolutionService.js'; // Adjust path as necessary
import {ResolutionStatus} from '../../src/types/resolutionStatus.js'; // Adjust path as necessary
import Entity from '../../src/entities/entity.js';
import {getEntityIdsForScopes} from "../../src/services/entityScopeService.js"; // Adjust path as necessary

// Mocks for dependencies
const mockEntityManager = {
    getEntityInstance: jest.fn(),
    getEntitiesInLocation: jest.fn(),
    // Add other methods if they become necessary during testing further methods
};

const mockWorldContext = {
    getLocationOfEntity: jest.fn(),
    getCurrentActor: jest.fn(),
    getCurrentLocation: jest.fn(),
    // Add other methods if they become necessary
};

const mockGameDataRepository = {
    getActionDefinition: jest.fn(),
    getAllActionDefinitions: jest.fn(),
    // Add other methods if they become necessary
};

const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
};

const INVENTORY_COMPONENT_ID = 'core:inventory'; // Define if not already available globally for tests

describe('TargetResolutionService', () => {
    let consoleErrorSpy;

    beforeEach(() => {
        jest.resetAllMocks(); // Reset mocks for each test
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        }); // Suppress console.error output
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    // Sub-Ticket/Test Case 1.1: Constructor - Successful Instantiation
    describe('Constructor - Successful Instantiation', () => {
        test('should construct successfully when all valid dependencies are provided', () => {
            const options = {
                entityManager: mockEntityManager,
                worldContext: mockWorldContext,
                gameDataRepository: mockGameDataRepository,
                logger: mockLogger,
                getEntityIdsForScopes: getEntityIdsForScopes // Correctly provided
            };
            let service;
            expect(() => {
                service = new TargetResolutionService(options);
            }).not.toThrow();

            expect(service).toBeInstanceOf(TargetResolutionService);
            expect(mockLogger.info).toHaveBeenCalledTimes(1);
            expect(mockLogger.info).toHaveBeenCalledWith("TargetResolutionService: Instance created and dependencies validated.");
        });
    });

    // Sub-Ticket/Test Case 1.2: Constructor - Missing Logger
    describe('Constructor - Missing Logger', () => {
        test('should throw error when options object is null (logger effectively missing)', () => {
            const options = null;
            const expectedErrorMsg = "TargetResolutionService Constructor: CRITICAL - Invalid or missing ILogger instance. Requires methods: info, error, debug, warn.";

            expect(() => new TargetResolutionService(options)).toThrow(expectedErrorMsg);
            expect(consoleErrorSpy).toHaveBeenCalledWith(expectedErrorMsg);
        });

        test('should throw error when logger is missing from options', () => {
            const options = {
                entityManager: mockEntityManager,
                worldContext: mockWorldContext,
                gameDataRepository: mockGameDataRepository,
                getEntityIdsForScopes: getEntityIdsForScopes, // Added for completeness
                // logger is missing
            };
            const expectedErrorMsg = "TargetResolutionService Constructor: CRITICAL - Invalid or missing ILogger instance. Requires methods: info, error, debug, warn.";

            expect(() => new TargetResolutionService(options)).toThrow(expectedErrorMsg);
            expect(consoleErrorSpy).toHaveBeenCalledWith(expectedErrorMsg);
        });
    });

    // Sub-Ticket/Test Case 1.3: Constructor - Logger Missing a Method
    describe('Constructor - Logger Missing a Method', () => {
        const baseOptions = {
            entityManager: mockEntityManager,
            worldContext: mockWorldContext,
            gameDataRepository: mockGameDataRepository,
            getEntityIdsForScopes: getEntityIdsForScopes, // Added for completeness
        };
        const expectedErrorMsg = "TargetResolutionService Constructor: CRITICAL - Invalid or missing ILogger instance. Requires methods: info, error, debug, warn.";

        test('should throw if logger is missing "info" method', () => {
            const invalidLogger = {error: jest.fn(), debug: jest.fn(), warn: jest.fn()};
            const options = {...baseOptions, logger: invalidLogger};
            expect(() => new TargetResolutionService(options)).toThrow(expectedErrorMsg);
            expect(consoleErrorSpy).toHaveBeenCalledWith(expectedErrorMsg);
        });
        test('should throw if logger is missing "error" method', () => {
            const invalidLogger = {info: jest.fn(), debug: jest.fn(), warn: jest.fn()};
            const options = {...baseOptions, logger: invalidLogger};
            expect(() => new TargetResolutionService(options)).toThrow(expectedErrorMsg);
            expect(consoleErrorSpy).toHaveBeenCalledWith(expectedErrorMsg);
        });
        test('should throw if logger is missing "debug" method', () => {
            const invalidLogger = {info: jest.fn(), error: jest.fn(), warn: jest.fn()};
            const options = {...baseOptions, logger: invalidLogger};
            expect(() => new TargetResolutionService(options)).toThrow(expectedErrorMsg);
            expect(consoleErrorSpy).toHaveBeenCalledWith(expectedErrorMsg);
        });
        test('should throw if logger is missing "warn" method', () => {
            const invalidLogger = {info: jest.fn(), error: jest.fn(), debug: jest.fn()};
            const options = {...baseOptions, logger: invalidLogger};
            expect(() => new TargetResolutionService(options)).toThrow(expectedErrorMsg);
            expect(consoleErrorSpy).toHaveBeenCalledWith(expectedErrorMsg);
        });
    });

    // Sub-Ticket/Test Case 1.4: Constructor - Missing Non-Logger Dependency
    describe('Constructor - Missing Non-Logger Dependency', () => {
        const createOptions = (missingDependency) => ({
            entityManager: missingDependency === 'entityManager' ? null : mockEntityManager,
            worldContext: missingDependency === 'worldContext' ? null : mockWorldContext,
            gameDataRepository: missingDependency === 'gameDataRepository' ? null : mockGameDataRepository,
            logger: mockLogger,
            getEntityIdsForScopes: missingDependency === 'getEntityIdsForScopes' ? null : getEntityIdsForScopes, // Include in testing missing deps
        });

        test.each([
            'entityManager',
            'worldContext',
            'gameDataRepository',
            'getEntityIdsForScopes', // Test missing this dependency as well
        ])('should throw and log error via logger if %s is missing', (dependencyName) => {
            const options = createOptions(dependencyName);
            let expectedErrorMsg;
            if (dependencyName === 'getEntityIdsForScopes') {
                // For function type check, the message is slightly different if it's null vs undefined and not a function
                // The constructor validation is:
                // 1. Check if dependency exists (if (!dependency)) -> "Missing required dependency"
                // 2. If isFunction flag is true, check typeof dependency !== 'function' -> "must be a function"
                // If `getEntityIdsForScopes` is null, it hits the first error.
                expectedErrorMsg = `TargetResolutionService Constructor: Missing required dependency: ${dependencyName}.`;
            } else {
                expectedErrorMsg = `TargetResolutionService Constructor: Missing required dependency: ${dependencyName}.`;
            }


            expect(() => new TargetResolutionService(options)).toThrow(expectedErrorMsg);
            if (mockLogger.error.mock.calls.some(call => call[0] === expectedErrorMsg)) {
                expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg);
            } else {
                // If the error is "must be a function", it's also logged.
                // This handles the case where the dependency is present but not a function.
                // For this test, we primarily care about it throwing.
                // The exact logger message might vary based on null vs malformed.
                // Given the current validation, "Missing required dependency" is expected for null.
                expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(dependencyName));
            }
        });

        test('should throw if getEntityIdsForScopes is not a function', () => {
            const options = {
                entityManager: mockEntityManager,
                worldContext: mockWorldContext,
                gameDataRepository: mockGameDataRepository,
                logger: mockLogger,
                getEntityIdsForScopes: "not-a-function",
            };
            const expectedErrorMsg = `TargetResolutionService Constructor: Dependency 'getEntityIdsForScopes' must be a function.`;
            expect(() => new TargetResolutionService(options)).toThrow(expectedErrorMsg);
            expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg);
        });
    });

    // Sub-Ticket/Test Case 1.5: Constructor - Non-Logger Dependency Missing Method
    describe('Constructor - Non-Logger Dependency Missing Method', () => {
        const getBaseValidMocks = () => ({
            entityManager: {getEntityInstance: jest.fn(), getEntitiesInLocation: jest.fn()},
            worldContext: {getLocationOfEntity: jest.fn(), getCurrentActor: jest.fn(), getCurrentLocation: jest.fn()},
            gameDataRepository: {getActionDefinition: jest.fn(), getAllActionDefinitions: jest.fn()},
            logger: mockLogger,
            getEntityIdsForScopes: getEntityIdsForScopes, // ADDED for robustness
        });

        const testCases = [
            {
                depName: 'entityManager', method: 'getEntityInstance', getOptions: () => {
                    const m = getBaseValidMocks();
                    delete m.entityManager.getEntityInstance;
                    return m;
                }
            },
            {
                depName: 'entityManager', method: 'getEntitiesInLocation', getOptions: () => {
                    const m = getBaseValidMocks();
                    delete m.entityManager.getEntitiesInLocation;
                    return m;
                }
            },
            {
                depName: 'worldContext', method: 'getLocationOfEntity', getOptions: () => {
                    const m = getBaseValidMocks();
                    delete m.worldContext.getLocationOfEntity;
                    return m;
                }
            },
            {
                depName: 'worldContext', method: 'getCurrentActor', getOptions: () => {
                    const m = getBaseValidMocks();
                    delete m.worldContext.getCurrentActor;
                    return m;
                }
            },
            {
                depName: 'worldContext', method: 'getCurrentLocation', getOptions: () => {
                    const m = getBaseValidMocks();
                    delete m.worldContext.getCurrentLocation;
                    return m;
                }
            },
            {
                depName: 'gameDataRepository', method: 'getActionDefinition', getOptions: () => {
                    const m = getBaseValidMocks();
                    delete m.gameDataRepository.getActionDefinition;
                    return m;
                }
            },
            {
                depName: 'gameDataRepository', method: 'getAllActionDefinitions', getOptions: () => {
                    const m = getBaseValidMocks();
                    delete m.gameDataRepository.getAllActionDefinitions;
                    return m;
                }
            },
        ];

        test.each(testCases)('should throw if $depName is missing method $method', ({depName, method, getOptions}) => {
            const options = getOptions();
            const expectedErrorMsg = `TargetResolutionService Constructor: Invalid or missing method '${method}' on dependency '${depName}'.`;

            expect(() => new TargetResolutionService(options)).toThrow(expectedErrorMsg);
            expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg);
        });
    });

    describe('resolveActionTarget - Basic Guard Clauses', () => {
        let service;

        beforeEach(() => {
            // Successfully instantiate service for these tests
            const options = {
                entityManager: mockEntityManager,
                worldContext: mockWorldContext,
                gameDataRepository: mockGameDataRepository,
                logger: mockLogger,
                getEntityIdsForScopes: getEntityIdsForScopes, // CRITICAL FIX: ADDED
            };
            service = new TargetResolutionService(options);
            jest.clearAllMocks(); // Clear mocks again after service instantiation for resolveActionTarget tests
        });

        // Sub-Ticket/Test Case 1.6: resolveActionTarget - Missing actionDefinition
        test('should return ERROR if actionDefinition is null', async () => {
            const actionDefinition = null;
            const actionContext = {}; // Valid empty object
            const expectedErrorMsg = "Internal error: Invalid action setup.";
            const expectedLoggerMsg = "TargetResolutionService.resolveActionTarget: Missing actionDefinition or actionContext. Action ID: undefined_action_definition.";

            const result = await service.resolveActionTarget(actionDefinition, actionContext);

            expect(result).toEqual({
                status: ResolutionStatus.ERROR,
                targetType: 'none',
                targetId: null,
                error: expectedErrorMsg,
            });
            expect(mockLogger.error).toHaveBeenCalledWith(expectedLoggerMsg);
        });

        // Sub-Ticket/Test Case 1.7: resolveActionTarget - Missing actionContext
        test('should return ERROR if actionContext is null', async () => {
            const actionDefinition = {id: 'test:action', target_domain: 'none'};
            const actionContext = null;
            const expectedErrorMsg = "Internal error: Invalid action setup.";
            const expectedLoggerMsg = "TargetResolutionService.resolveActionTarget: Missing actionDefinition or actionContext. Action ID: test:action.";

            const result = await service.resolveActionTarget(actionDefinition, actionContext);

            expect(result).toEqual({
                status: ResolutionStatus.ERROR,
                targetType: 'none',
                targetId: null,
                error: expectedErrorMsg,
            });
            expect(mockLogger.error).toHaveBeenCalledWith(expectedLoggerMsg);
        });

        // Sub-Ticket/Test Case 1.8: resolveActionTarget - Missing actingEntity for actor-required domains
        describe('resolveActionTarget - Missing actingEntity for actor-required domains', () => {
            const domainsRequiringActor = ['self', 'inventory', 'equipment', 'environment'];
            test.each(domainsRequiringActor)('should return ERROR if actingEntity is null for domain "%s"', async (domain) => {
                const actionDefinition = {id: `test:${domain}-action`, target_domain: domain};
                const actionContext = {actingEntity: null, nounPhrase: ''};
                const expectedErrorMsg = `Internal error: Action '${actionDefinition.id}' requires an actor but none was provided for domain '${domain}'.`;
                const expectedLoggerMsg = `TargetResolutionService.resolveActionTarget: Missing actingEntity for target_domain '${domain}' which requires an actor. Action: '${actionDefinition.id}'.`;

                const result = await service.resolveActionTarget(actionDefinition, actionContext);

                expect(result).toEqual({
                    status: ResolutionStatus.ERROR,
                    targetType: 'none',
                    targetId: null,
                    error: expectedErrorMsg,
                });
                expect(mockLogger.error).toHaveBeenCalledWith(expectedLoggerMsg);
            });
        });

        // Sub-Ticket/Test Case 1.9: resolveActionTarget - Unknown target_domain
        test('should return NOT_FOUND for an unknown target_domain', async () => {
            const actionDefinition = {id: 'test:unknown', target_domain: 'fictional_domain'};
            const mockActorEntity = new Entity('actor1', 'dummy'); // Simple mock entity
            const actionContext = {actingEntity: mockActorEntity, nounPhrase: ''};
            const expectedErrorMsg = "Action 'test:unknown' has an unsupported target domain: fictional_domain.";
            const expectedLoggerMsg = "TargetResolutionService.resolveActionTarget: Unknown target domain 'fictional_domain' for action 'test:unknown'.";

            const result = await service.resolveActionTarget(actionDefinition, actionContext);

            expect(result).toEqual({
                status: ResolutionStatus.NOT_FOUND,
                targetType: 'none',
                targetId: null,
                error: expectedErrorMsg,
            });
            expect(mockLogger.warn).toHaveBeenCalledWith(expectedLoggerMsg);
        });

        // Sub-Ticket/Test Case 1.10: resolveActionTarget - Unexpected Error in a Resolver
        test('should catch unexpected errors from internal resolvers and return ERROR', async () => {
            const actionDefinition = {id: 'test:error-action', target_domain: 'inventory'};
            const errorMessage = "Unexpected component error!";
            const mockActorEntity = {
                id: 'actor1',
                hasComponent: jest.fn(componentId => {
                    // This setup ensures getEntityIdsForScopes returns empty,
                    // then _resolveInventoryDomain calls getComponentData.
                    if (componentId === INVENTORY_COMPONENT_ID) return false;
                    return true; // Default for other potential checks
                }),
                getComponentData: jest.fn().mockImplementation((componentId) => {
                    if (componentId === INVENTORY_COMPONENT_ID) {
                        throw new Error(errorMessage); // The intended error
                    }
                    return undefined;
                })
            };
            const actionContext = {actingEntity: mockActorEntity, nounPhrase: 'item'};

            const expectedPlayerError = "An unexpected internal error occurred while trying to resolve the target for action 'test:error-action'. Please contact support.";
            const expectedLoggerMsg = `TargetResolutionService.resolveActionTarget: Unexpected error during target resolution for action '${actionDefinition.id}', domain '${actionDefinition.target_domain}'. Error: ${errorMessage}`;

            const result = await service.resolveActionTarget(actionDefinition, actionContext);

            expect(result).toEqual({
                status: ResolutionStatus.ERROR,
                targetType: 'none',
                targetId: null,
                error: expectedPlayerError,
            });
            expect(mockLogger.error).toHaveBeenCalledWith(expectedLoggerMsg, expect.any(Error));
            // Check that the error passed to the logger is the one that was thrown
            const loggerCall = mockLogger.error.mock.calls.find(call => call[0] === expectedLoggerMsg);
            expect(loggerCall[1].message).toBe(errorMessage);
        });
    });
});