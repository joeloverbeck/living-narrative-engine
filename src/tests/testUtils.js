// src/tests/testUtils.js

import {PrerequisiteEvaluationService} from '../services/prerequisiteEvaluationService.js';
import {jest} from '@jest/globals';
import DomRenderer from '../core/domRenderer.js'; // Import DomRenderer

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

// Re-export DomRenderer so tests can import it from this central utility
export {DomRenderer};

// Optional: Add a helper to create a mocked DomRenderer instance
export function createMockDomRenderer() {
    return {
        renderMessage: jest.fn().mockReturnValue(true), // Default success
        mutate: jest.fn().mockReturnValue({count: 1, failed: 0, modified: 1}), // Default success
        setTitle: jest.fn(),
        clearOutput: jest.fn(),
        setInputState: jest.fn(),
        toggleInventory: jest.fn(),
        // Add other methods used by handlers/systems if needed
    };
}