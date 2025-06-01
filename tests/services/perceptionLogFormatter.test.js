// test/services/perceptionLogFormatter.test.js
// --- FILE START ---

import {PerceptionLogFormatter} from '../../src/services/PerceptionLogFormatter.js';
import {beforeEach, describe, expect, it, jest} from '@jest/globals'; // Import jest

const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};

describe('PerceptionLogFormatter', () => {
    let formatter;

    beforeEach(() => {
        jest.clearAllMocks(); // Clear mocks before each test
        formatter = new PerceptionLogFormatter({logger: mockLogger});
    });

    describe('Constructor', () => {
        it('should initialize with a logger', () => {
            expect(formatter).toBeDefined();
            // The constructor itself calls logger.debug
            expect(mockLogger.debug).toHaveBeenCalledWith("PerceptionLogFormatter initialized.");
        });

        it('should throw an error if logger is not provided', () => {
            expect(() => new PerceptionLogFormatter({})).toThrow("PerceptionLogFormatter: Logger dependency is required.");
            expect(() => new PerceptionLogFormatter({logger: null})).toThrow("PerceptionLogFormatter: Logger dependency is required.");
        });
    });


    describe('format', () => {
        it('should return an empty array if rawLogEntries is null', () => {
            const result = formatter.format(null);
            expect(result).toEqual([]);
            expect(mockLogger.warn).toHaveBeenCalledWith("PerceptionLogFormatter.format: rawLogEntries is not a valid array or is null/undefined. Returning empty array.");
        });

        it('should return an empty array if rawLogEntries is undefined', () => {
            const result = formatter.format(undefined);
            expect(result).toEqual([]);
            expect(mockLogger.warn).toHaveBeenCalledWith("PerceptionLogFormatter.format: rawLogEntries is not a valid array or is null/undefined. Returning empty array.");
        });

        it('should return an empty array if rawLogEntries is not an array', () => {
            const result = formatter.format({an: "object"}); // Not an array
            expect(result).toEqual([]);
            expect(mockLogger.warn).toHaveBeenCalledWith("PerceptionLogFormatter.format: rawLogEntries is not a valid array or is null/undefined. Returning empty array.");
        });

        it('should return an empty array for an empty input array and log debug message', () => {
            const result = formatter.format([]);
            expect(result).toEqual([]);
            expect(mockLogger.debug).toHaveBeenCalledWith("PerceptionLogFormatter.format attempting to process 0 entries.");
        });

        it('should correctly format valid log entries with all fields', () => {
            const rawEntries = [
                {
                    eventId: 'ev1',
                    descriptionText: 'Event 1 happened.',
                    perceptionType: 'info',
                    timestamp: 'ts1',
                    actorId: 'a1',
                    targetId: 't1'
                },
                {
                    eventId: 'ev2',
                    descriptionText: 'Another event.',
                    perceptionType: 'combat',
                    timestamp: 'ts2',
                    actorId: 'a2',
                    targetId: 't2'
                }
            ];
            const result = formatter.format(rawEntries);

            expect(mockLogger.debug).toHaveBeenCalledWith("PerceptionLogFormatter.format attempting to process 2 entries.");
            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                content: 'Event 1 happened.',
                type: 'info',
                timestamp: 'ts1',
                eventId: 'ev1',
                actorId: 'a1',
                targetId: 't1'
            });
            expect(result[1]).toEqual({
                content: 'Another event.',
                type: 'combat',
                timestamp: 'ts2',
                eventId: 'ev2',
                actorId: 'a2',
                targetId: 't2'
            });
            // Ensure no unexpected warnings for valid entries
            // Check that no warn calls happened. Debug calls for empty content might occur if descriptionText was empty.
            // This test has descriptionText, so content won't be empty.
            expect(mockLogger.warn).not.toHaveBeenCalled();
            // Check that debug log for empty content did not happen for these specific entries
            const debugCallsForEmptyContent = mockLogger.debug.mock.calls.filter(
                call => call[0].includes("resulted in empty 'content'")
            );
            expect(debugCallsForEmptyContent.length).toBe(0);

        });

        it('should use empty string for content and log debug if descriptionText is missing', () => {
            const rawEntries = [{eventId: 'ev-no-desc', perceptionType: 'social', timestamp: 'ts-no-desc'}];
            const result = formatter.format(rawEntries);

            expect(result).toHaveLength(1);
            expect(result[0].content).toBe('');
            expect(result[0].eventId).toBe('ev-no-desc');
            expect(result[0].type).toBe('social');
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `PerceptionLogFormatter.format: Perception log entry (event ID: ev-no-desc) resulted in empty 'content' after mapping from 'descriptionText'. Original entry: ${JSON.stringify(rawEntries[0])}`
            );
        });

        it('should use empty string for content and log debug if descriptionText is null', () => {
            const rawEntries = [{
                eventId: 'ev-null-desc',
                descriptionText: null,
                perceptionType: 'social',
                timestamp: 'ts-null-desc'
            }];
            const result = formatter.format(rawEntries);

            expect(result).toHaveLength(1);
            expect(result[0].content).toBe('');
            expect(result[0].eventId).toBe('ev-null-desc');
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `PerceptionLogFormatter.format: Perception log entry (event ID: ev-null-desc) resulted in empty 'content' after mapping from 'descriptionText'. Original entry: ${JSON.stringify(rawEntries[0])}`
            );
        });


        it('should correctly format entries with missing optional fields (actorId, targetId), which should become undefined', () => {
            const rawEntries = [
                {
                    eventId: 'ev-no-actor-target',
                    descriptionText: 'Event with no actor/target.',
                    perceptionType: 'general',
                    timestamp: 'ts-no-actor-target'
                    // actorId and targetId are missing
                }
            ];
            const result = formatter.format(rawEntries);

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                content: 'Event with no actor/target.',
                type: 'general',
                timestamp: 'ts-no-actor-target',
                eventId: 'ev-no-actor-target',
                actorId: undefined,
                targetId: undefined
            });
            expect(mockLogger.warn).not.toHaveBeenCalled(); // No warnings should be issued for this valid (though sparse) entry.
        });


        it('should warn if timestamp is missing and map it as undefined', () => {
            const rawEntries = [{eventId: 'ev-no-ts', descriptionText: 'No timestamp here', perceptionType: 'info'}];
            const result = formatter.format(rawEntries);

            expect(result).toHaveLength(1);
            expect(result[0].timestamp).toBeUndefined();
            expect(result[0].eventId).toBe('ev-no-ts');
            expect(mockLogger.warn).toHaveBeenCalledTimes(1); // Only one warning for the missing timestamp
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `PerceptionLogFormatter.format: Perception log entry (event ID: ev-no-ts) missing 'timestamp'. Placeholder {timestamp} may not resolve correctly. Original entry: ${JSON.stringify(rawEntries[0])}`
            );
        });

        it('should use eventId "N/A" in warnings if eventId itself is missing when other fields are also missing', () => {
            const rawEntries = [{descriptionText: 'No timestamp, no eventId', perceptionType: 'info'}]; // No eventId, no timestamp
            formatter.format(rawEntries);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining("PerceptionLogFormatter.format: Perception log entry (event ID: N/A) missing 'timestamp'.")
            );

            jest.clearAllMocks(); // Clear for the next check
            formatter = new PerceptionLogFormatter({logger: mockLogger}); // Re-init to clear constructor log

            const rawEntries2 = [{descriptionText: 'No type, no eventId', timestamp: 'ts-no-type'}]; // No eventId, no perceptionType
            formatter.format(rawEntries2);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining("PerceptionLogFormatter.format: Perception log entry (event ID: N/A) missing 'perceptionType' (for 'type').")
            );
        });


        it('should warn if perceptionType is missing and map it as undefined', () => {
            const rawEntries = [{eventId: 'ev-no-type', descriptionText: 'No type here', timestamp: 'ts-no-type'}];
            const result = formatter.format(rawEntries);

            expect(result).toHaveLength(1);
            expect(result[0].type).toBeUndefined();
            expect(result[0].eventId).toBe('ev-no-type');
            expect(mockLogger.warn).toHaveBeenCalledTimes(1); // Only one warning for the missing perceptionType
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `PerceptionLogFormatter.format: Perception log entry (event ID: ev-no-type) missing 'perceptionType' (for 'type'). Placeholder {type} may not resolve correctly. Original entry: ${JSON.stringify(rawEntries[0])}`
            );
        });

        it('should filter out null entries and log a warning', () => {
            const rawEntries = [
                null,
                {eventId: 'evValid1', descriptionText: 'Valid Entry 1', timestamp: 'ts1', perceptionType: 'type1'},
                null,
                {eventId: 'evValid2', descriptionText: 'Valid Entry 2', timestamp: 'ts2', perceptionType: 'type2'},
            ];
            const result = formatter.format(rawEntries);

            expect(result).toHaveLength(2);
            expect(result[0].eventId).toBe('evValid1');
            expect(result[1].eventId).toBe('evValid2');
            expect(mockLogger.warn).toHaveBeenCalledTimes(2); // Expect exactly 2 warnings for the two null entries
            expect(mockLogger.warn).toHaveBeenCalledWith(`PerceptionLogFormatter.format: Invalid raw perception log entry skipped: null`);
            // Ensure the specific calls for null are present (implicitly covered if called 2 times and this one is present)
            // To be more explicit:
            expect(mockLogger.warn.mock.calls).toEqual(
                expect.arrayContaining([
                    [`PerceptionLogFormatter.format: Invalid raw perception log entry skipped: null`],
                    [`PerceptionLogFormatter.format: Invalid raw perception log entry skipped: null`]
                ])
            );
        });

        it('should filter out non-object entries and log a warning', () => {
            const rawEntries = [
                "not_an_object_string",
                {
                    eventId: 'evValid',
                    descriptionText: 'Valid Entry After String',
                    timestamp: 'tsValid',
                    perceptionType: 'typeValid'
                },
                12345, // number
                true,  // boolean
            ];
            const result = formatter.format(rawEntries);

            expect(result).toHaveLength(1);
            expect(result[0].eventId).toBe('evValid');
            expect(mockLogger.warn).toHaveBeenCalledTimes(3); // Expect exactly 3 warnings for the three non-object entries
            expect(mockLogger.warn).toHaveBeenCalledWith(`PerceptionLogFormatter.format: Invalid raw perception log entry skipped: "not_an_object_string"`);
            expect(mockLogger.warn).toHaveBeenCalledWith(`PerceptionLogFormatter.format: Invalid raw perception log entry skipped: 12345`);
            expect(mockLogger.warn).toHaveBeenCalledWith(`PerceptionLogFormatter.format: Invalid raw perception log entry skipped: true`);
        });


        it('should handle a mix of valid, invalid, and missing-field entries correctly', () => {
            const rawEntries = [
                {
                    eventId: 'evFull',
                    descriptionText: 'Full Valid',
                    perceptionType: 'system',
                    timestamp: 'tsFull',
                    actorId: 'actFull',
                    targetId: 'tarFull'
                },
                null, // Invalid: Filtered, 1 warn
                {eventId: 'evNoDesc', perceptionType: 'error', timestamp: 'tsNoDesc'}, // Valid (content becomes ""), 0 warn
                "invalid_string_entry", // Invalid: Filtered, 1 warn
                {eventId: 'evNoTs', descriptionText: 'No Timestamp', perceptionType: 'debug'}, // Valid, 1 warn (missing timestamp)
                {eventId: 'evNoType', descriptionText: 'No Type', timestamp: 'tsNoType'}, // Valid, 1 warn (missing perceptionType)
                {
                    eventId: 'evValid2',
                    descriptionText: 'Another Valid',
                    perceptionType: 'chat',
                    timestamp: 'tsValid2',
                    actorId: 'act2'
                } // Valid, 0 warn
            ];

            const result = formatter.format(rawEntries);

            expect(mockLogger.debug).toHaveBeenCalledWith("PerceptionLogFormatter.format attempting to process 7 entries.");
            expect(result).toHaveLength(5); // 2 invalid entries (null, string) filtered out

            // Check valid full entry (index 0)
            expect(result[0]).toEqual({
                content: 'Full Valid',
                type: 'system',
                timestamp: 'tsFull',
                eventId: 'evFull',
                actorId: 'actFull',
                targetId: 'tarFull'
            });

            // Check entry with missing descriptionText (index 1 in result)
            expect(result[1].eventId).toBe('evNoDesc');
            expect(result[1].content).toBe('');
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Perception log entry (event ID: evNoDesc) resulted in empty 'content'`));

            // Check entry with missing timestamp (index 2 in result)
            expect(result[2].eventId).toBe('evNoTs');
            expect(result[2].timestamp).toBeUndefined();
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`Perception log entry (event ID: evNoTs) missing 'timestamp'`));

            // Check entry with missing perceptionType (index 3 in result)
            expect(result[3].eventId).toBe('evNoType');
            expect(result[3].type).toBeUndefined();
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`Perception log entry (event ID: evNoType) missing 'perceptionType'`));

            // Check another valid entry (index 4 in result) (with optional targetId missing)
            expect(result[4]).toEqual({
                content: 'Another Valid',
                type: 'chat',
                timestamp: 'tsValid2',
                eventId: 'evValid2',
                actorId: 'act2',
                targetId: undefined
            });

            // Check specific warnings for invalid entries
            expect(mockLogger.warn).toHaveBeenCalledWith(`PerceptionLogFormatter.format: Invalid raw perception log entry skipped: null`);
            expect(mockLogger.warn).toHaveBeenCalledWith(`PerceptionLogFormatter.format: Invalid raw perception log entry skipped: "invalid_string_entry"`);

            // Total warn calls: 1 (null) + 1 (string) + 1 (missing timestamp) + 1 (missing perceptionType) = 4
            expect(mockLogger.warn).toHaveBeenCalledTimes(4);
        });
    });
});

// --- FILE END ---