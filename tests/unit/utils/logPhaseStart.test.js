// tests/unit/utils/logPhaseStart.test.js

/**
 * @file Test suite for the logPhaseStart utility function.
 * @see {@link module:utils/logPhaseStart}
 */

import { mock } from 'jest-mock-extended';
import { logPhaseStart } from '../../../src/utils/logPhaseStart.js';

/**
 * @typedef {import('../../src/interfaces/coreServices.js').ILogger} ILogger
 */

describe('logPhaseStart', () => {
    /** @type {ILogger} */
    let mockLogger;

    beforeEach(() => {
        // Create a fresh mock logger for each test to ensure isolation.
        mockLogger = mock();
    });

    it('should log a standard phase name with the correct banner format', () => {
        // Arrange
        const phase = 'SchemaPhase';
        const expectedMessage = `— ${phase} starting —`;

        // Act
        logPhaseStart(mockLogger, phase);

        // Assert
        expect(mockLogger.info).toHaveBeenCalledTimes(1);
        expect(mockLogger.info).toHaveBeenCalledWith(expectedMessage);
    });

    it('should handle phase names with spaces or special characters', () => {
        // Arrange
        const phase = 'Content Loading & Processing';
        const expectedMessage = `— ${phase} starting —`;

        // Act
        logPhaseStart(mockLogger, phase);

        // Assert
        expect(mockLogger.info).toHaveBeenCalledTimes(1);
        expect(mockLogger.info).toHaveBeenCalledWith(expectedMessage);
    });

    it('should handle an empty string as a phase name', () => {
        // Arrange
        const phase = '';
        const expectedMessage = '—  starting —';

        // Act
        logPhaseStart(mockLogger, phase);

        // Assert
        expect(mockLogger.info).toHaveBeenCalledTimes(1);
        expect(mockLogger.info).toHaveBeenCalledWith(expectedMessage);
    });

    it('should coerce a null phase name to "null" in the output', () => {
        // Arrange
        const phase = null;
        const expectedMessage = '— null starting —';

        // Act
        logPhaseStart(mockLogger, phase);

        // Assert
        expect(mockLogger.info).toHaveBeenCalledTimes(1);
        expect(mockLogger.info).toHaveBeenCalledWith(expectedMessage);
    });

    it('should coerce an undefined phase name to "undefined" in the output', () => {
        // Arrange
        const phase = undefined;
        const expectedMessage = '— undefined starting —';

        // Act
        logPhaseStart(mockLogger, phase);

        // Assert
        expect(mockLogger.info).toHaveBeenCalledTimes(1);
        expect(mockLogger.info).toHaveBeenCalledWith(expectedMessage);
    });
});