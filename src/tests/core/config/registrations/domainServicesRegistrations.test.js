// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../../../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../../../../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('../../../../../core/services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../../../../../core/eventBus.js').default} EventBus */
/** @typedef {import('../../../../../logic/jsonLogicEvaluationService.js').default} JsonLogicEvaluationService */
/** @typedef {import('../../../../../services/targetResolutionService.js').default} TargetResolutionService */
/** @typedef {import('../../../../../services/actionValidationService.js').default} ActionValidationService */
/** @typedef {import('../../../../../services/payloadValueResolverService.js').default} PayloadValueResolverService */
/** @typedef {any} AppContainer */

// --- Jest Imports ---
import {describe, beforeEach, it, expect, jest} from '@jest/globals';

// --- Class Under Test ---
import {registerDomainServices} from '../../../../core/config/registrations/domainServicesRegistrations.js'; // Adjust path if needed

// --- Dependencies ---
import {tokens} from '../../../../core/config/tokens.js';

// --- MOCK the Modules (Classes being registered) to simplify testing ---
// Mocking the actual classes ensures their constructors don't cause issues
// if they have complex logic or unmocked internal dependencies.
jest.mock('../../../../services/conditionEvaluationService.js');
jest.mock("../../../../services/itemTargetResolver.js");
jest.mock("../../../../services/targetResolutionService.js");
jest.mock("../../../../services/actionValidationContextBuilder.js");
jest.mock("../../../../services/prerequisiteEvaluationService.js");
jest.mock("../../../../validation/domainContextCompatibilityChecker.js");
jest.mock("../../../../services/actionValidationService.js");
jest.mock("../../../../services/payloadValueResolverService.js");
jest.mock("../../../../actions/actionExecutor.js");
jest.mock("../../../../core/commandParser.js");
jest.mock('../../../../logic/jsonLogicEvaluationService.js'); // Mocking this as well, though often infrastructural
jest.mock('../../../../core/gameStateManager.js'); // Also needed

// --- Import AFTER mocking ---
import ConditionEvaluationService from '../../../../services/conditionEvaluationService.js';
import {ItemTargetResolverService} from "../../../../services/itemTargetResolver.js";
import TargetResolutionService from "../../../../services/targetResolutionService.js";
import {ActionValidationContextBuilder} from "../../../../services/actionValidationContextBuilder.js";
import {PrerequisiteEvaluationService} from "../../../../services/prerequisiteEvaluationService.js";
import {DomainContextCompatibilityChecker} from "../../../../validation/domainContextCompatibilityChecker.js";
import {ActionValidationService} from "../../../../services/actionValidationService.js";
import PayloadValueResolverService from "../../../../services/payloadValueResolverService.js";
import ActionExecutor from "../../../../actions/actionExecutor.js";
import CommandParser from "../../../../core/commandParser.js";
import JsonLogicEvaluationService from '../../../../logic/jsonLogicEvaluationService.js';
import GameStateManager from '../../../../core/gameStateManager.js';

// --- Mock Implementations (Core & External Dependencies) ---
const mockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};
// Mock other dependencies required by the factories within domainServicesRegistrations
const mockEntityManager = {}; // Provide a basic object or mock methods if needed by factories
const mockvalidatedEventDispatcher = {};
const mockGameDataRepository = {};
const mockEventBus = {};
// We mock JsonLogicEvaluationService class above, so provide its mock instance here
const mockJsonLogicServiceInstance = new JsonLogicEvaluationService();

// --- Mock Custom DI Container (Copied from interpreterRegistrations.test.js) ---
const createMockContainer = () => {
    const registrations = new Map();
    const container = {
        _registrations: registrations,
        register: jest.fn((token, factoryOrValue, options = {}) => {
            if (!token) throw new Error('Mock Register Error: Token is required.');
            const registration = {factoryOrValue, options, instance: undefined};
            registrations.set(token, registration);

            if (options?.lifecycle === 'singleton') {
                if (typeof factoryOrValue === 'function' && registration.instance === undefined) {
                    try {
                        const factory = factoryOrValue;
                        // Simulate resolution during registration for testing purposes
                        registration.instance = factory(container);
                    } catch (e) {
                        // console.warn(`Mock container: Error executing factory during registration for ${String(token)}: ${e.message}`);
                        registration.instance = undefined;
                    }
                } else if (typeof factoryOrValue !== 'function') {
                    registration.instance = factoryOrValue;
                }
            }
        }),
        resolve: jest.fn((token) => {
            const registration = registrations.get(token);
            if (!registration) {
                const registeredTokens = Array.from(registrations.keys()).map(String).join(', ');
                throw new Error(`Mock Resolve Error: Token not registered: ${String(token)}. Registered tokens are: [${registeredTokens}]`);
            }

            const {factoryOrValue, options} = registration;

            if (options?.lifecycle === 'singleton') {
                if (registration.instance !== undefined) {
                    return registration.instance;
                }
                if (typeof factoryOrValue === 'function') {
                    try {
                        registration.instance = factoryOrValue(container);
                    } catch (e) {
                        console.error(`Mock container: Error executing factory during resolve for ${String(token)}: ${e.message}`);
                        throw e;
                    }

                } else {
                    registration.instance = factoryOrValue;
                }
                return registration.instance;
            }

            // Transient or non-singleton
            if (typeof factoryOrValue === 'function') {
                try {
                    return factoryOrValue(container);
                } catch (e) {
                    console.error(`Mock container: Error executing transient factory during resolve for ${String(token)}: ${e.message}`);
                    throw e;
                }
            }
            return factoryOrValue; // Return value directly
        }),
        resolveAll: jest.fn((tag) => { // Basic mock for resolveAll needed by Registrar helper
            const resolved = [];
            registrations.forEach((reg, token) => {
                // This is a simplified mock: real resolveAll needs tag checking logic stored during registration
                // For basic registration tests, this might suffice if resolveAll isn't heavily used IN the registration fn itself
                if (reg.options?.tags?.includes(tag)) {
                    try {
                        resolved.push(container.resolve(token));
                    } catch (e) {
                        // Ignore resolve errors during mock resolveAll
                    }
                }
            });
            return resolved;
        })
    };
    return container;
};


describe('registerDomainServices', () => {
    /** @type {ReturnType<typeof createMockContainer>} */
    let mockContainer;

    beforeEach(() => {
        jest.clearAllMocks(); // Clear mocks defined via jest.mock

        mockContainer = createMockContainer();

        // Pre-register MOCKED core/external dependencies required by domain services
        mockContainer.register(tokens.ILogger, mockLogger, {lifecycle: 'singleton'});
        mockContainer.register(tokens.EntityManager, mockEntityManager, {lifecycle: 'singleton'});
        mockContainer.register(tokens.ValidatedEventDispatcher, mockvalidatedEventDispatcher, {lifecycle: 'singleton'});
        mockContainer.register(tokens.GameDataRepository, mockGameDataRepository, {lifecycle: 'singleton'});
        mockContainer.register(tokens.EventBus, mockEventBus, {lifecycle: 'singleton'});
        // Register the mocked JsonLogicEvaluationService instance
        mockContainer.register(tokens.JsonLogicEvaluationService, mockJsonLogicServiceInstance, {lifecycle: 'singleton'});
        // Pre-register services that might be dependencies *within* the bundle but are resolved early
        // We register the *mocked classes* directly here, assuming singleton lifestyle for simplicity in testing.
        mockContainer.register(tokens.TargetResolutionService, new TargetResolutionService(), {lifecycle: 'singleton'});
        mockContainer.register(tokens.ActionValidationContextBuilder, new ActionValidationContextBuilder(), {lifecycle: 'singleton'});
        mockContainer.register(tokens.DomainContextCompatibilityChecker, new DomainContextCompatibilityChecker(), {lifecycle: 'singleton'});
        mockContainer.register(tokens.PrerequisiteEvaluationService, new PrerequisiteEvaluationService(), {lifecycle: 'singleton'});
        mockContainer.register(tokens.PayloadValueResolverService, new PayloadValueResolverService(), {lifecycle: 'singleton'});
        mockContainer.register(tokens.ActionValidationService, new ActionValidationService(), {lifecycle: 'singleton'});
        mockContainer.register(tokens.GameStateManager, new GameStateManager(), {lifecycle: 'singleton'});


        // Clear call counts on the mock service functions/constructors
        Object.values(mockLogger).forEach(fn => fn.mockClear?.());
        ConditionEvaluationService.mockClear();
        ItemTargetResolverService.mockClear();
        TargetResolutionService.mockClear();
        ActionValidationContextBuilder.mockClear();
        PrerequisiteEvaluationService.mockClear();
        DomainContextCompatibilityChecker.mockClear();
        ActionValidationService.mockClear();
        PayloadValueResolverService.mockClear();
        ActionExecutor.mockClear();
        CommandParser.mockClear();
        JsonLogicEvaluationService.mockClear(); // Clear constructor mock too
        GameStateManager.mockClear();
    });

    it('should register domain services without throwing errors', () => {
        // Arrange & Act
        expect(() => {
            registerDomainServices(mockContainer);
        }).not.toThrow();

        // Assert: Check if main services were registered (using the mock register function)
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.ConditionEvaluationService, expect.any(Function), expect.anything());
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.ItemTargetResolverService, expect.any(Function), expect.anything());
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.TargetResolutionService, expect.any(Function), expect.anything());
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.JsonLogicEvaluationService, expect.any(Function), expect.anything()); // Check registration, even if pre-registered
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.ActionValidationContextBuilder, expect.any(Function), expect.anything());
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.PrerequisiteEvaluationService, expect.any(Function), expect.anything());
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.DomainContextCompatibilityChecker, expect.any(Function), expect.anything());
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.ActionValidationService, expect.any(Function), expect.anything());
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.PayloadValueResolverService, expect.any(Function), expect.anything());
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.ActionExecutor, expect.any(Function), expect.anything());
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.GameStateManager, expect.any(Function), expect.anything());
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.CommandParser, expect.any(Function), expect.anything());
    });

    it('resolving ActionExecutor does not throw', () => {
        // Arrange: Register dependencies (done in beforeEach) and then the domain services
        registerDomainServices(mockContainer);

        // Act & Assert: Try resolving a key service that depends on others in the bundle
        let resolvedService;
        expect(() => {
            resolvedService = mockContainer.resolve(tokens.ActionExecutor);
        }).not.toThrow();

        // Assert: Check if something was actually resolved
        expect(resolvedService).toBeDefined();

        // Assert: Check that the MOCK ActionExecutor constructor was called via the factory (at least once)
        expect(ActionExecutor).toHaveBeenCalled();
    });
});