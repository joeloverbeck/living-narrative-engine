// src/core/config/registrations/coreSystemsRegistrations.test.js

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {any} AppContainer */ // Using 'any' as the custom container type isn't defined

// --- Jest Imports ---
import {describe, beforeEach, it, expect, jest} from '@jest/globals';

// --- Class Under Test ---
import {registerCoreSystems} from '../../../../core/config/registrations/coreSystemsRegistrations.js'; // Adjust path as needed

// --- Dependencies ---
import {tokens} from '../../../../core/config/tokens.js';
import {INITIALIZABLE} from "../../../../core/config/tags";

// --- Mock Implementations (Core Services) ---
const mockLogger = {
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
};

// --- Mock Custom DI Container (Simplified version for this test) ---
const createMockContainer = () => {
    const registrations = new Map();
    const container = {
        _registrations: registrations, // Expose for snapshot testing
        register: jest.fn((token, factoryOrValue, options = {}) => {
            if (!token) throw new Error('Mock Register Error: Token is required.');
            registrations.set(token, {factoryOrValue, options});
        }),
        resolve: jest.fn((token) => {
            // For this test, we only *really* need to resolve the logger
            if (token === tokens.ILogger) return mockLogger;
            // For other dependencies needed by system *factories* (if they were executed),
            // we'd need a more robust mock resolve. But here we just test registration calls.
            const registration = registrations.get(token);
            if (!registration) {
                // Allow resolving known tokens even if not strictly registered in *this* test
                // This helps if a factory tries to resolve something basic.
                // Example: If MoveCoordinatorSystem factory *was* executed and needed BlockerSystem
                if (token === tokens.EventBus) return {on: jest.fn(), off: jest.fn(), emit: jest.fn()};
                if (token === tokens.EntityManager) return { /* basic mock */};
                if (token === tokens.BlockerSystem) return { /* basic mock */};
                if (token === tokens.MovementSystem) return { /* basic mock */};
                if (token === tokens.GameDataRepository) return { /* basic mock */};
                if (token === tokens.GameStateManager) return { /* basic mock */};
                if (token === tokens.ActionExecutor) return { /* basic mock */};
                if (token === tokens.ConditionEvaluationService) return { /* basic mock */};
                if (token === tokens.ItemTargetResolverService) return { /* basic mock */};
                if (token === tokens.ValidatedEventDispatcher) return { /* basic mock */};
                if (token === tokens.ActionValidationService) return { /* basic mock */};

                // If it's none of the above known dependencies, it's likely an error in the test or SUT
                throw new Error(`Mock Resolve Error: Token not registered or mocked: ${String(token)}`);
            }
            // Basic resolve for testing purposes if needed, won't handle factories correctly here.
            if (typeof registration.factoryOrValue === 'function' && registration.options?.lifecycle === 'singleton') {
                // Return the factory itself for inspection, rather than executing it
                return registration.factoryOrValue;
            }
            return registration.factoryOrValue;
        }),
        // Add a mock resolveAll for SystemInitializer if it were tested here
        resolveAll: jest.fn((tag) => {
            const found = [];
            for (const [token, reg] of registrations.entries()) {
                if (reg.options?.tags?.includes(tag)) {
                    // In a real test needing instances, resolve here. For now, just return token.
                    found.push(token);
                }
            }
            return found;
        })
    };
    return container;
};

describe('registerCoreSystems', () => {
    /** @type {ReturnType<typeof createMockContainer>} */
    let mockContainer;

    // Whitelist of system tokens expected to be registered and tagged
    // UPDATED: Removed tokens.QuestSystem, tokens.QuestStartTriggerSystem
    const initializableSystemTokens = [
        tokens.GameRuleSystem, tokens.EquipmentEffectSystem, tokens.EquipmentSlotSystem,
        tokens.InventorySystem, tokens.CombatSystem, tokens.DeathSystem,
        tokens.WorldPresenceSystem, tokens.ItemUsageSystem, tokens.BlockerSystem,
        tokens.MovementSystem, tokens.MoveCoordinatorSystem,
        tokens.PerceptionSystem, tokens.NotificationUISystem,
        tokens.OpenableSystem, tokens.HealthSystem, tokens.StatusEffectSystem,
        tokens.LockSystem, tokens.ActionDiscoverySystem
    ];
    const expectedCount = 19;

    beforeEach(() => {
        jest.clearAllMocks();
        mockContainer = createMockContainer();

        // Pre-register the essential dependency needed *by* registerCoreSystems itself: ILogger
        mockContainer.register(tokens.ILogger, mockLogger); // No lifecycle needed for this mock setup
    });

    it(`should register ${expectedCount} systems/services with the '${INITIALIZABLE[0]}' tag`, () => { // <-- Test description updates automatically
        // Arrange
        registerCoreSystems(mockContainer);

        // Assert: Check that each whitelisted token was registered...
        initializableSystemTokens.forEach(token => {
            // ... this loop now won't check for WelcomeMessageService
            expect(mockContainer.register).toHaveBeenCalledWith(
                token,
                expect.any(Function),
                expect.objectContaining({
                    tags: expect.arrayContaining(INITIALIZABLE),
                    lifecycle: 'singleton'
                })
            );
        });

        expect(mockContainer.register).toHaveBeenCalledTimes(expectedCount);

        // Assert: Check logger calls
        expect(mockLogger.debug).toHaveBeenCalledWith('Core Systems Registration: Starting...');
        initializableSystemTokens.forEach(token => { // <-- This loop also won't check for WelcomeMessageService log
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Registered ${String(token)} tagged with ${INITIALIZABLE[0]}`));
        });
        // Check final info log message count - should match the updated expectedCount
        // NOTE: You might need to update the count *inside* registerCoreSystems.js's final log message too if it's hardcoded!
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Core Systems Registration: Completed registering ${expectedCount} systems`));
    });

    it('should match snapshot for registration calls', () => {
        // Arrange
        registerCoreSystems(mockContainer);

        // Assert
        // Snapshot the calls made to the mock container's register function
        // Exclude the pre-registered mockLogger call for a cleaner snapshot focused on the bundle's work
        const callsToSnapshot = mockContainer.register.mock.calls.filter(
            (call) => call[0] !== tokens.ILogger
        );
        // NOTE: This snapshot will differ from the original due to the removal
        // of QuestSystem and QuestStartTriggerSystem registrations.
        // You will need to update the snapshot (`jest --updateSnapshot`).
        expect(callsToSnapshot).toMatchSnapshot();
    });
});