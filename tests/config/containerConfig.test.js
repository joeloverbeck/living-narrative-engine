// tests/config/containerConfig.test.js
// ****** MODIFIED FILE ******

import AppContainer from '../../src/config/appContainer.js'; // Adjust path as needed
import {configureContainer} from '../../src/config/containerConfig.js'; // Adjust path
import {tokens} from '../../src/config/tokens.js'; // Adjust path

// --- Import the classes we want to check ---
import CommandOutcomeInterpreter from '../../src/commands/interpreters/commandOutcomeInterpreter.js'; // Adjust path
import PlayerTurnHandler from '../../src/turns/handlers/playerTurnHandler.js'; // Adjust path
import TurnManager from '../../src/turns/turnManager.js';
import {afterEach, beforeEach, describe, expect, it} from "@jest/globals"; // Adjust path

// Mock external dependencies (DOM elements, document)
const mockOutputDiv = document.createElement('div');
const mockInputElement = document.createElement('input');
const mockTitleElement = document.createElement('h1');
const mockDocument = document; // Or a more isolated mock if needed

describe('Dependency Injection Container Configuration', () => {
    let container;

    beforeEach(() => {
        // Create a fresh container and configure it for each test
        container = new AppContainer();
        configureContainer(container, {
            outputDiv: mockOutputDiv,
            inputElement: mockInputElement,
            titleElement: mockTitleElement,
            // Pass the mock document if needed by UI registrations
            document: mockDocument
        });
    });

    afterEach(() => {
        // Clean up the container after each test
        container.reset();
        container = null;
    });

    // Test 1: Verify CommandOutcomeInterpreter can be resolved
    it('should resolve CommandOutcomeInterpreter successfully', () => {
        // VVVVVV MODIFIED LINE VVVVVV
        // Resolve using the interface token, as this seems to be how CommandOutcomeInterpreter is registered.
        const instance = container.resolve(tokens.ICommandOutcomeInterpreter);
        // ^^^^^^ MODIFIED LINE ^^^^^^
        expect(instance).toBeInstanceOf(CommandOutcomeInterpreter);
        expect(typeof instance.interpret).toBe('function');   // public API check
    });

    // Test 2: Verify PlayerTurnHandler (which depends on CommandOutcomeInterpreter) can be resolved
    it('should resolve PlayerTurnHandler successfully', () => {
        const instance = container.resolve(tokens.PlayerTurnHandler);
        expect(instance).toBeInstanceOf(PlayerTurnHandler);
        expect(typeof instance.startTurn).toBe('function');   // public API check
    });

    // Test 3: Verify ITurnManager (which depends on PlayerTurnHandler via Resolver) can be resolved
    it('should resolve ITurnManager successfully', () => {
        const instance = container.resolve(tokens.ITurnManager);
        expect(instance).toBeInstanceOf(TurnManager);
        expect(typeof instance.start).toBe('function');
        expect(typeof instance.advanceTurn).toBe('function');
    });

    // Test 4: Verify resolving by the "initializableSystem" tag includes ITurnManager
    // (This tests if the tagging and resolution order allows ITurnManager to be tagged correctly)
    it('should resolve ITurnManager when resolving by tag "initializableSystem"', () => {
        let initializables = [];
        expect(() => {
            // Assuming 'initializableSystem' is the correct tag string from ../tags.js
            initializables = container.resolveByTag('initializableSystem');
        }).not.toThrow();

        // Check that the array contains at least one item
        expect(initializables.length).toBeGreaterThan(0);

        // Find the TurnManager instance within the resolved tagged instances
        const turnManagerInstance = initializables.find(instance => instance instanceof TurnManager);

        // Assert that a TurnManager instance was found
        expect(turnManagerInstance).toBeInstanceOf(TurnManager);
    });

});