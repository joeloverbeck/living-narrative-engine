// src/interfaces/ITurnContext.test.js
// ──────────────────────────────────────────────────────────────────────────────
//  Unit Tests for ITurnContext Interface Structure
// ──────────────────────────────────────────────────────────────────────────────

import {describe, test, expect, jest} from '@jest/globals';
import {ITurnContext} from '../../../../core/turns/interfaces/ITurnContext.js';

// ──────────────────────────────────────────────────────────────────────────────
//  Mock Implementation
// ──────────────────────────────────────────────────────────────────────────────

/**
 * @description Simple mock class for ITurnContext to test interface structure.
 * This class defines all methods present in the ITurnContext interface.
 * The mock methods are minimal, returning null or simple default values,
 * as the goal is to test structure, not behavior.
 */
class MockTurnContext extends ITurnContext {
    getActor() {
        return null; // Or a mock entity: { id: 'mockActor', name: 'Mock Actor' }
    }

    getLogger() {
        // Return a mock logger with minimal implementations
        return {
            debug: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
        };
    }

    getPlayerPromptService() {
        // Return a mock prompt service
        return {
            ask: jest.fn(),
            prompt: jest.fn(),
            // Add any other methods defined in IPlayerPromptService
        };
    }

    getGame() {
        // Return a mock game world or controller
        return {
            findEntityById: jest.fn(),
            // Add any other methods defined in GameWorld or its minimal interface
        };
    }

    endTurn(_errorOrNull) {
        // No specific return value needed for structural testing
        return undefined;
    }

    isAwaitingExternalEvent() {
        return false; // Simple default boolean
    }
}

// ──────────────────────────────────────────────────────────────────────────────
//  Test Suite
// ──────────────────────────────────────────────────────────────────────────────

describe('ITurnContext Interface Structure', () => {
    let mockContext;

    beforeEach(() => {
        mockContext = new MockTurnContext();
    });

    // Test for getActor method
    describe('getActor()', () => {
        test('should exist on MockTurnContext instance', () => {
            expect(typeof mockContext.getActor).toBe('function');
        });

        test('should be callable without throwing an unexpected error', () => {
            expect(() => mockContext.getActor()).not.toThrow();
        });
    });

    // Test for getLogger method
    describe('getLogger()', () => {
        test('should exist on MockTurnContext instance', () => {
            expect(typeof mockContext.getLogger).toBe('function');
        });

        test('should be callable without throwing an unexpected error', () => {
            expect(() => mockContext.getLogger()).not.toThrow();
        });

        test('getLogger() mock should return an object with logging methods', () => {
            const logger = mockContext.getLogger();
            expect(logger).toBeDefined();
            expect(typeof logger.debug).toBe('function');
            expect(typeof logger.info).toBe('function');
            expect(typeof logger.warn).toBe('function');
            expect(typeof logger.error).toBe('function');
        });
    });

    // Test for getPlayerPromptService method
    describe('getPlayerPromptService()', () => {
        test('should exist on MockTurnContext instance', () => {
            expect(typeof mockContext.getPlayerPromptService).toBe('function');
        });

        test('should be callable without throwing an unexpected error', () => {
            expect(() => mockContext.getPlayerPromptService()).not.toThrow();
        });
    });

    // Test for getGame method
    describe('getGame()', () => {
        test('should exist on MockTurnContext instance', () => {
            expect(typeof mockContext.getGame).toBe('function');
        });

        test('should be callable without throwing an unexpected error', () => {
            expect(() => mockContext.getGame()).not.toThrow();
        });
    });

    // Test for endTurn method
    describe('endTurn()', () => {
        test('should exist on MockTurnContext instance', () => {
            expect(typeof mockContext.endTurn).toBe('function');
        });

        test('should be callable with null without throwing an unexpected error', () => {
            expect(() => mockContext.endTurn(null)).not.toThrow();
        });

        test('should be callable with an Error object without throwing an unexpected error', () => {
            expect(() => mockContext.endTurn(new Error('Test error'))).not.toThrow();
        });

        test('should be callable with no arguments without throwing an unexpected error', () => {
            expect(() => mockContext.endTurn()).not.toThrow();
        });
    });

    // Test for isAwaitingExternalEvent method
    describe('isAwaitingExternalEvent()', () => {
        test('should exist on MockTurnContext instance', () => {
            expect(typeof mockContext.isAwaitingExternalEvent).toBe('function');
        });

        test('should be callable without throwing an unexpected error', () => {
            expect(() => mockContext.isAwaitingExternalEvent()).not.toThrow();
        });
    });
});