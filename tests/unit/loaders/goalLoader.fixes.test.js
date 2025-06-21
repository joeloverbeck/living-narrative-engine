// Filename: tests/unit/loaders/goalLoader.fixes.test.js

/**
 * @file Test suite for GoalLoader.
 * @description This suite verifies the fixes for the content type lookup ('goal' vs 'goals')
 * and the incorrect method signature in `_processFetchedItem`.
 */

import {
    describe,
    test,
    expect,
    beforeEach,
    afterEach,
    jest,
} from '@jest/globals';
import { mock } from 'jest-mock-extended';

// System Under Test (SUT)
import GoalLoader from '../../../src/loaders/goalLoader.js';

// Mocks for constructor dependencies
const mockConfig = mock();
const mockPathResolver = mock();
const mockDataFetcher = mock();
const mockSchemaValidator = mock();
const mockDataRegistry = mock();
const mockLogger = mock();

describe('GoalLoader', () => {
    beforeEach(() => {
        // Reset mocks before each test to ensure a clean slate and prevent test leakage.
        jest.resetAllMocks();
    });

    afterEach(() => {
        // Clear any spies or other Jest-managed mocks.
        jest.clearAllMocks();
    });

    describe('Constructor', () => {
        test('should call BaseManifestItemLoader with the correct contentType "goals"', () => {
            // Arrange: Mock getContentTypeSchemaId to return a value to avoid the warning log.
            mockConfig.getContentTypeSchemaId.mockReturnValue('core:goal');

            // Act: Instantiate the loader.
            new GoalLoader(
                mockConfig,
                mockPathResolver,
                mockDataFetcher,
                mockSchemaValidator,
                mockDataRegistry,
                mockLogger
            );

            // Assert: Verify the config service was called with 'goals'. This confirms the primary fix.
            expect(mockConfig.getContentTypeSchemaId).toHaveBeenCalledWith('goals');
            expect(mockConfig.getContentTypeSchemaId).not.toHaveBeenCalledWith('goal');
        });

        test('should log a debug message when a primary schema ID is found', () => {
            // Arrange
            const schemaId = 'core:goal_schema_v1';
            mockConfig.getContentTypeSchemaId.mockReturnValue(schemaId);

            // Act
            new GoalLoader(
                mockConfig,
                mockPathResolver,
                mockDataFetcher,
                mockSchemaValidator,
                mockDataRegistry,
                mockLogger
            );

            // Assert
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining(
                    `Primary schema ID for content type 'goals' found: '${schemaId}'`
                )
            );
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        test('should log a warning if the primary schema ID is not found in configuration', () => {
            // Arrange: This simulates the original problem scenario.
            mockConfig.getContentTypeSchemaId.mockReturnValue(null);

            // Act
            new GoalLoader(
                mockConfig,
                mockPathResolver,
                mockDataFetcher,
                mockSchemaValidator,
                mockDataRegistry,
                mockLogger
            );

            // Assert: The warning should now be for 'goals', not 'goal'.
            expect(mockLogger.warn).toHaveBeenCalledWith(
                "GoalLoader: Primary schema ID for content type 'goals' not found in configuration. Primary validation might be skipped."
            );
        });
    });

    describe('_processFetchedItem', () => {
        test('should call _parseIdAndStoreItem with correct parameters, proving correct argument handling', async () => {
            // Arrange
            const loader = new GoalLoader(
                mockConfig,
                mockPathResolver,
                mockDataFetcher,
                mockSchemaValidator,
                mockDataRegistry,
                mockLogger
            );

            // Spy on the internal method to check the arguments it receives.
            const parseAndStoreSpy = jest
                .spyOn(loader, '_parseIdAndStoreItem')
                .mockReturnValue({
                    qualifiedId: 'test-mod:goal-1',
                    didOverride: false,
                });

            const modId = 'test-mod';
            const filename = 'goal1.json';
            const resolvedPath = '/mods/test-mod/goals/goal1.json';
            const goalData = { id: 'goal-1', description: 'Test goal' };
            const typeName = 'goals';

            // Act: Call the method with the full set of 5 arguments, as the base class does.
            await loader._processFetchedItem(
                modId,
                filename,
                resolvedPath,
                goalData,
                typeName
            );

            // Assert: This confirms the second bug fix. The method signature is correct,
            // and the `data` object is passed correctly, not the `resolvedPath` string.
            expect(parseAndStoreSpy).toHaveBeenCalledWith(
                goalData, // The actual data object
                'id', // The id property
                'goals', // The registry category
                modId, // The mod ID
                filename // The source filename
            );
        });
    });

    describe('Full Integration (`loadItemsForMod`)', () => {
        test('should successfully load, process, and store a goal definition', async () => {
            // Arrange
            const modId = 'test-mod-alpha';
            const manifest = {
                id: modId,
                name: 'Test Mod Alpha',
                version: '1.0.0',
                content: {
                    goals: ['my_first_goal.json'],
                },
            };
            const goalData = {
                id: 'alpha_goal_1',
                description: 'Achieve alpha state',
                conditions: [],
            };
            const resolvedPath = `/fake/path/mods/${modId}/goals/my_first_goal.json`;
            const qualifiedId = `${modId}:${goalData.id}`;

            // Setup mock return values for the full process
            mockConfig.getContentTypeSchemaId.mockReturnValue('core:goal');
            mockPathResolver.resolveModContentPath.mockReturnValue(resolvedPath);
            mockDataFetcher.fetch.mockResolvedValue(goalData);
            // Mock the registry's store method to check what it receives
            mockDataRegistry.store.mockReturnValue(false); // false = not an override

            const loader = new GoalLoader(
                mockConfig,
                mockPathResolver,
                mockDataFetcher,
                mockSchemaValidator,
                mockDataRegistry,
                mockLogger
            );

            // Spy on the validation step to abstract it away; we assume it works.
            jest
                .spyOn(loader, '_validatePrimarySchema')
                .mockReturnValue({ isValid: true, errors: null });

            // Act
            const result = await loader.loadItemsForMod(
                modId,
                manifest,
                'goals', // contentKey
                'goals', // contentTypeDir
                'goals' // typeName
            );

            // Assert
            // 1. Check final result summary
            expect(result).toEqual({ count: 1, overrides: 0, errors: 0 });

            // 2. Verify dependencies were called correctly
            expect(mockPathResolver.resolveModContentPath).toHaveBeenCalledWith(
                modId,
                'goals',
                'my_first_goal.json'
            );
            expect(mockDataFetcher.fetch).toHaveBeenCalledWith(resolvedPath);
            expect(loader._validatePrimarySchema).toHaveBeenCalledWith(
                goalData,
                'my_first_goal.json',
                modId,
                resolvedPath
            );

            // 3. The most important check: Was the item stored correctly?
            expect(mockDataRegistry.store).toHaveBeenCalledTimes(1);
            expect(mockDataRegistry.store).toHaveBeenCalledWith(
                'goals', // Correct category
                qualifiedId, // Correct fully qualified ID
                expect.objectContaining({
                    // The data object, enhanced with metadata
                    id: goalData.id,
                    _fullId: qualifiedId,
                    modId: modId,
                    description: goalData.description,
                })
            );

            // 4. Check for success logs
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining(`Mod [${modId}] - Processed 1/1 goals items.`)
            );
        });
    });
});
