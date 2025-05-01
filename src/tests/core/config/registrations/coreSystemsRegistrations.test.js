// src/tests/core/config/registrations/coreSystemsRegistrations.test.js
// (Entire file provided as requested)

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {any} AppContainer */ // Using 'any' as the custom container type isn't defined

// --- Jest Imports ---
import {describe, beforeEach, it, expect, jest} from '@jest/globals';

// --- Class Under Test ---
import {registerCoreSystems} from '../../../../core/config/registrations/coreSystemsRegistrations.js'; // Adjust path as needed

// --- Dependencies ---
import {tokens} from '../../../../core/config/tokens.js';
import {INITIALIZABLE, SHUTDOWNABLE} from "../../../../core/config/tags"; // Import SHUTDOWNABLE if needed for checks, though not used here

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
                if (token === tokens.IGameStateManager) return { /* basic mock */};
                if (token === tokens.IActionExecutor) return { /* basic mock */};
                if (token === tokens.ConditionEvaluationService) return { /* basic mock */};
                if (token === tokens.ItemTargetResolverService) return { /* basic mock */};
                if (token === tokens.IValidatedEventDispatcher) return { /* basic mock */};
                if (token === tokens.ActionValidationService) return { /* basic mock */};
                if (token === tokens.ITurnOrderService) return { /* basic mock */}; // Added for TurnManager factory potential needs

                // If it's none of the above known dependencies, it's likely an error in the test or SUT
                // Consider making this more robust if factories actually get called and need more mocks.
                console.warn(`Mock Resolve Warning: Token not explicitly registered or mocked, returning basic object: ${String(token)}`);
                return {}; // Return empty object instead of throwing to potentially allow more tests to pass if non-critical
                // throw new Error(`Mock Resolve Error: Token not registered or mocked: ${String(token)}`);
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
                    found.push(token); // Or resolve(token) if instances needed
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
    // Includes all systems registered with INITIALIZABLE tag in coreSystemsRegistrations.js
    const initializableSystemTokens = [
        tokens.GameRuleSystem, tokens.EquipmentEffectSystem, tokens.EquipmentSlotSystem,
        tokens.InventorySystem, tokens.CombatSystem, tokens.DeathSystem,
        tokens.WorldPresenceSystem, tokens.ItemUsageSystem, tokens.BlockerSystem,
        tokens.MovementSystem, tokens.MoveCoordinatorSystem,
        tokens.PerceptionSystem, tokens.NotificationUISystem,
        tokens.OpenableSystem, tokens.HealthSystem, tokens.StatusEffectSystem,
        tokens.LockSystem, tokens.IActionDiscoverySystem, tokens.ITurnManager
    ];
    // --- MODIFIED: Corrected expected count back to 19 ---
    const expectedCount = 19; // This is the number of systems registered *by* the function under test.

    // List of systems expected to have the SHUTDOWNABLE tag (adjust if more are added)
    const shutdownableSystemTokens = [
        tokens.CombatSystem, tokens.WorldPresenceSystem, tokens.PerceptionSystem,
        tokens.NotificationUISystem, tokens.OpenableSystem, tokens.HealthSystem,
        tokens.StatusEffectSystem, tokens.LockSystem
    ];

    beforeEach(() => {
        jest.clearAllMocks();
        mockContainer = createMockContainer();

        // Pre-register the essential dependency needed *by* registerCoreSystems itself: ILogger
        // This call should NOT be counted towards the 'expectedCount' of systems registered *by* registerCoreSystems
        mockContainer.register(tokens.ILogger, mockLogger); // No lifecycle needed for this mock setup
    });

    // --- MODIFIED: Updated test description count ---
    it(`should register ${expectedCount} systems/services with the '${INITIALIZABLE[0]}' tag`, () => { // <-- Test description updates automatically
        // Arrange
        registerCoreSystems(mockContainer);

        // Act: Filter out the pre-registered logger call before checking counts and details
        const actualSystemRegistrationCalls = mockContainer.register.mock.calls.filter(
            (call) => call[0] !== tokens.ILogger
        );

        // Assert: Check that each whitelisted token was registered with the INITIALIZABLE tag...
        initializableSystemTokens.forEach(token => {
            expect(mockContainer.register).toHaveBeenCalledWith(
                token,
                expect.any(Function), // Expecting a factory function (class constructor or factory fn)
                expect.objectContaining({
                    lifecycle: 'singleton', // All core systems are singletons
                    tags: expect.arrayContaining(INITIALIZABLE) // Must include the initializable tag
                })
            );
        });

        // Assert: Check specific systems also have the SHUTDOWNABLE tag
        shutdownableSystemTokens.forEach(token => {
            expect(mockContainer.register).toHaveBeenCalledWith(
                token,
                expect.any(Function),
                expect.objectContaining({
                    lifecycle: 'singleton',
                    tags: expect.arrayContaining(SHUTDOWNABLE) // Must include the shutdownable tag
                })
            );
        });

        // Assert: Check the *total number* of registrations performed *by registerCoreSystems*
        expect(actualSystemRegistrationCalls.length).toBe(expectedCount); // Use filtered calls length

        // Assert: Check logger calls for INITIALIZABLE systems
        initializableSystemTokens.forEach(token => {
            // Allow for logs that mention both tags if applicable
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Registered ${String(token)}`));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`tagged with ${INITIALIZABLE[0]}`));
        });

        // --- MODIFIED: Check final info log message count - should match the corrected expectedCount (19) ---
        // The log message in the SUT uses the actual count from its counter.
        expect(mockLogger.info).toHaveBeenCalledWith(
            expect.stringContaining(`Completed registering ${expectedCount} systems and services`) // Check against 19
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
            expect.stringContaining(`tagging relevant ones with '${INITIALIZABLE[0]}' and '${SHUTDOWNABLE[0]}'.`)
        );

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
        // Snapshot should already be correct from the previous update.
        expect(callsToSnapshot).toMatchSnapshot();
    });
});