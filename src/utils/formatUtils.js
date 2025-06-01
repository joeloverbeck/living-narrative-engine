// src/utils/FormatUtils.js

/**
 * @fileoverview A collection of static utility functions for common data formatting operations.
 */

/**
 * @module FormatUtils
 * @description Provides static utility functions for formatting data.
 */
export const FormatUtils = {
    /**
     * Formats a total number of seconds into a HH:MM:SS string.
     *
     * @param {number} totalSeconds - The total number of seconds to format.
     * @returns {string} The formatted time string (e.g., "01:05:32") or 'N/A' if the input is invalid.
     * Handles invalid inputs (non-numbers, NaN, negative numbers) by returning 'N/A'.
     */
    formatPlaytime(totalSeconds) {
        if (typeof totalSeconds !== 'number' || isNaN(totalSeconds) || totalSeconds < 0) {
            return 'N/A';
        }

        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = Math.floor(totalSeconds % 60);

        const formattedHours = String(hours).padStart(2, '0');
        const formattedMinutes = String(minutes).padStart(2, '0');
        const formattedSeconds = String(seconds).padStart(2, '0');

        return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
    }

    // Future formatting utilities can be added here.
    // e.g., formatTimestamp, formatLargeNumber, etc.
};

// For CommonJS environments, though ES module is standard for this project.
// if (typeof module !== 'undefined' && module.exports) {
//     module.exports = FormatUtils;
// }