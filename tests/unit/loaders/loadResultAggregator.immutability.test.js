// tests/unit/loaders/loadResultAggregator.immutability.test.js

import { LoadResultAggregator } from '../../../src/loaders/LoadResultAggregator.js';

/**
 * @typedef {import('../../../src/loaders/LoadResultAggregator.js').TotalResultsSummary} TotalResultsSummary
 * @typedef {import('../../../src/loaders/LoadResultAggregator.js').ModResultsSummary} ModResultsSummary
 */

/**
 * Mock for the result of an item loader.
 * @typedef {object} LoadItemsResult
 * @property {number} count
 * @property {number} overrides
 * @property {number} errors
 */

describe('LoadResultAggregator', () => {
    /** @type {TotalResultsSummary} */
    let initialTotals;

    beforeEach(() => {
        initialTotals = {
            items: { count: 10, overrides: 2, errors: 1 },
            monsters: { count: 5, overrides: 0, errors: 0 },
        };
    });

    describe('aggregate', () => {
        it('should return a new totals object, not the same instance', () => {
            // Arrange
            const aggregator = new LoadResultAggregator(initialTotals);
            /** @type {LoadItemsResult} */
            const result = { count: 2, overrides: 1, errors: 0 };

            // Act
            const newTotals = aggregator.aggregate(result, 'items');

            // Assert
            expect(newTotals).not.toBe(initialTotals);
        });

        it('should not mutate the original totals object', () => {
            // Arrange
            const originalTotalsClone = JSON.parse(JSON.stringify(initialTotals));
            const aggregator = new LoadResultAggregator(initialTotals);
            /** @type {LoadItemsResult} */
            const result = { count: 5, overrides: 0, errors: 1 };

            // Act
            aggregator.aggregate(result, 'items');

            // Assert
            expect(initialTotals).toEqual(originalTotalsClone);
        });

        it('should return a totals object with correctly updated values', () => {
            // Arrange
            const aggregator = new LoadResultAggregator(initialTotals);
            /** @type {LoadItemsResult} */
            const result = { count: 3, overrides: 1, errors: 1 };

            // Act
            const newTotals = aggregator.aggregate(result, 'items');

            // Assert
            expect(newTotals.items).toEqual({
                count: 13, // 10 + 3
                overrides: 3, // 2 + 1
                errors: 2, // 1 + 1
            });
            expect(newTotals.monsters).toEqual(initialTotals.monsters);
        });

        it('should add a new registry key to the totals if it does not exist', () => {
            // Arrange
            const aggregator = new LoadResultAggregator(initialTotals);
            /** @type {LoadItemsResult} */
            const result = { count: 15, overrides: 0, errors: 0 };

            // Act
            const newTotals = aggregator.aggregate(result, 'quests');

            // Assert
            expect(newTotals.quests).toEqual({
                count: 15,
                overrides: 0,
                errors: 0,
            });
            expect(newTotals.items).toEqual(initialTotals.items); // Ensure others are unchanged
        });

        it('should handle null or undefined results gracefully', () => {
            // Arrange
            const aggregator = new LoadResultAggregator(initialTotals);

            // Act
            const newTotals = aggregator.aggregate(null, 'items');

            // Assert
            expect(newTotals).toEqual(initialTotals);
            expect(newTotals).not.toBe(initialTotals);
        });

        it('should update the public modResults property correctly', () => {
            // Arrange
            const aggregator = new LoadResultAggregator(initialTotals);
            /** @type {LoadItemsResult} */
            const result = { count: 5, overrides: 2, errors: 1 };

            // Act
            aggregator.aggregate(result, 'items');

            // Assert
            expect(aggregator.modResults.items).toEqual({
                count: 5,
                overrides: 2,
                errors: 1,
            });
        });
    });

    describe('recordFailure', () => {
        it('should return a new totals object, not the same instance', () => {
            // Arrange
            const aggregator = new LoadResultAggregator(initialTotals);

            // Act
            const newTotals = aggregator.recordFailure('monsters');

            // Assert
            expect(newTotals).not.toBe(initialTotals);
        });

        it('should not mutate the original totals object', () => {
            // Arrange
            const originalTotalsClone = JSON.parse(JSON.stringify(initialTotals));
            const aggregator = new LoadResultAggregator(initialTotals);

            // Act
            aggregator.recordFailure('monsters');

            // Assert
            expect(initialTotals).toEqual(originalTotalsClone);
        });

        it('should return a totals object with the correctly incremented error count', () => {
            // Arrange
            const aggregator = new LoadResultAggregator(initialTotals);

            // Act
            const newTotals = aggregator.recordFailure('monsters');

            // Assert
            expect(newTotals.monsters.errors).toBe(1); // 5 + 1
            expect(newTotals.items).toEqual(initialTotals.items);
        });

        it('should add a new registry key and record a failure if the key does not exist', () => {
            // Arrange
            const aggregator = new LoadResultAggregator(initialTotals);

            // Act
            const newTotals = aggregator.recordFailure('spells');

            // Assert
            expect(newTotals.spells).toEqual({
                count: 0,
                overrides: 0,
                errors: 1,
            });
        });

        it('should update the public modResults property correctly', () => {
            // Arrange
            const aggregator = new LoadResultAggregator(initialTotals);

            // Act
            aggregator.recordFailure('items');

            // Assert
            expect(aggregator.modResults.items).toEqual({
                count: 0,
                overrides: 0,
                errors: 1,
            });
        });
    });
});