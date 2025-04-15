// src/tests/utils/geometryUtils.test.js (Conceptual Example using Jest syntax)

import {calculateDistanceSquaredCoords, calculateDistanceSquared} from '../../utils/geometryUtils.js';
import {describe, expect, test} from "@jest/globals";

describe('geometryUtils', () => {

    describe('calculateDistanceSquaredCoords', () => {
        test('should return 0 for same points', () => {
            expect(calculateDistanceSquaredCoords(10, 20, 10, 20)).toBe(0);
        });

        test('should calculate correct squared distance for horizontal line', () => {
            expect(calculateDistanceSquaredCoords(5, 10, 15, 10)).toBe(100); // dx=10, dy=0 => 10^2 = 100
        });

        test('should calculate correct squared distance for vertical line', () => {
            expect(calculateDistanceSquaredCoords(5, 10, 5, 15)).toBe(25); // dx=0, dy=5 => 5^2 = 25
        });

        test('should calculate correct squared distance for diagonal line (3-4-5 triangle)', () => {
            expect(calculateDistanceSquaredCoords(1, 1, 4, 5)).toBe(25); // dx=3, dy=4 => 3^2 + 4^2 = 9 + 16 = 25
        });

        test('should handle negative coordinates', () => {
            expect(calculateDistanceSquaredCoords(-1, -1, -4, -5)).toBe(25); // dx=-3, dy=-4 => (-3)^2 + (-4)^2 = 9 + 16 = 25
        });

        test('should throw TypeError for non-numeric input', () => {
            expect(() => calculateDistanceSquaredCoords('a', 1, 2, 3)).toThrow(TypeError);
            expect(() => calculateDistanceSquaredCoords(1, null, 2, 3)).toThrow(TypeError);
            expect(() => calculateDistanceSquaredCoords(1, 2, undefined, 3)).toThrow(TypeError);
            expect(() => calculateDistanceSquaredCoords(1, 2, 3, NaN)).toThrow(TypeError); // NaN is technically number, adjust expectation if needed
        });
    });

    describe('calculateDistanceSquared', () => {
        test('should return 0 for same position objects', () => {
            expect(calculateDistanceSquared({x: 10, y: 20}, {x: 10, y: 20})).toBe(0);
        });

        test('should calculate correct squared distance for position objects', () => {
            expect(calculateDistanceSquared({x: 1, y: 1}, {x: 4, y: 5})).toBe(25);
        });

        test('should handle missing coordinates (defaulting to 0)', () => {
            expect(calculateDistanceSquared({x: 3}, {y: 4})).toBe(25); // (3-0)^2 + (0-4)^2 = 9 + 16 = 25
            expect(calculateDistanceSquared({}, {})).toBe(0);
        });

        test('should handle null/undefined properties (defaulting to 0)', () => {
            expect(calculateDistanceSquared({x: 3, y: null}, {x: undefined, y: 4})).toBe(25);
        });

        test('should return NaN for invalid input types', () => {
            expect(calculateDistanceSquared(null, {x: 1, y: 1})).toBeNaN();
            expect(calculateDistanceSquared({x: 1, y: 1}, undefined)).toBeNaN();
            expect(calculateDistanceSquared('posA', 'posB')).toBeNaN();
        });
    });

});