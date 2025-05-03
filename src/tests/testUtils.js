// src/tests/testUtils.js

import {PrerequisiteEvaluationService} from '../services/prerequisiteEvaluationService.js';
import {jest} from '@jest/globals';
import DomRenderer from '../domUI/domRenderer.js'; // Import DomRenderer

// --- Mock PrerequisiteEvaluationService ---
jest.mock('../services/prerequisiteEvaluationService.js'); // Mock needs to be in the utility or called before import in test

export function createMockPrerequisiteEvaluationService() {
    const mockInstance = new PrerequisiteEvaluationService();

    // Ensure evaluate exists as a mock fn
    if (!mockInstance.evaluate || !jest.isMockFunction(mockInstance.evaluate)) {
        mockInstance.evaluate = jest.fn();
    }

    // Fix the length property
    Object.defineProperty(mockInstance.evaluate, 'length', {
        value: 4,
        writable: false
    });

    // Set a default behavior (optional, can be done in test)
    mockInstance.evaluate.mockReturnValue(true);

    return mockInstance;
}

// --- Mock Logger ---
/**
 * Creates a mock logger object with Jest mock functions for standard levels.
 * @returns {{info: jest.Mock, warn: jest.Mock, error: jest.Mock, debug: jest.Mock}}
 */
export function createMockLogger() {
    return {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    };
}


// --- Mock DomRenderer ---
// Re-export DomRenderer so tests can import it from this central utility
export {DomRenderer};

/**
 * Creates a mock DOM Renderer object with Jest mock functions for its methods.
 * @returns {object} A mock DomRenderer instance.
 */
export function createMockDomRenderer() {
    return {
        renderMessage: jest.fn().mockReturnValue(true), // Default success
        // ****** CORRECTION: Default return value uses 'count', 'modified', 'failed' ******
        mutate: jest.fn().mockReturnValue({count: 1, modified: 1, failed: 0}), // Default successful modification of 1 element
        setTitle: jest.fn(),
        clearOutput: jest.fn(),
        setInputState: jest.fn(),
        toggleInventory: jest.fn(),
        // Add other methods used by handlers/systems if needed
    };
}