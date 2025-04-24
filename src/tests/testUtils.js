// src/tests/testUtils.js

// Example in a test utility file (e.g., src/tests/testUtils.js or similar)
import {PrerequisiteEvaluationService} from '../services/prerequisiteEvaluationService';
import {jest} from "@jest/globals";

jest.mock('../services/prerequisiteEvaluationService'); // Mock needs to be in the utility or called before import in test

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