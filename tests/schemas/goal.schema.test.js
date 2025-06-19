/**
 * @file Test suite for validating GOAP Goal definitions against goal.schema.json
 * @see tests/schemas/goal.schema.test.js
 */

import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { describe, beforeAll, test, expect } from '@jest/globals';

// Schemas to be loaded
import goalSchema from '../../data/schemas/goal.schema.json';
import commonSchema from '../../data/schemas/common.schema.json';
import jsonLogicSchema from '../../data/schemas/json-logic.schema.json';
import conditionContainerSchema from '../../data/schemas/condition-container.schema.json';

// Fixture data
import validGoalFixture from '../../data/fixtures/goals/goblin_attack_intruder.goal.json';

describe('JSON-Schema – GOAP Goal Definition', () => {
    /** @type {import('ajv').ValidateFunction} */
    let validate;

    beforeAll(() => {
        const ajv = new Ajv({ allErrors: true });
        addFormats(ajv);

        // It's crucial to add all referenced schemas to AJV instance
        // so that it can resolve the '$ref' pointers correctly.
        ajv.addSchema(commonSchema, 'http://example.com/schemas/common.schema.json');
        ajv.addSchema(
            jsonLogicSchema,
            'http://example.com/schemas/json-logic.schema.json'
        );
        ajv.addSchema(
            conditionContainerSchema,
            'http://example.com/schemas/condition-container.schema.json'
        );

        // Compile the main schema we want to test.
        validate = ajv.compile(goalSchema);
    });

    describe('Valid Fixture – monsters:goal_attack_intruder', () => {
        test('should validate successfully against the schema', () => {
            const ok = validate(validGoalFixture);
            if (!ok) {
                console.error(
                    'Validation errors for monsters:goal_attack_intruder:',
                    validate.errors
                );
            }
            expect(ok).toBe(true);
        });
    });

    describe('Schema property validations', () => {
        test('should fail validation if required "id" property is missing', () => {
            const invalidData = { ...validGoalFixture };
            delete invalidData.id;
            const ok = validate(invalidData);
            expect(ok).toBe(false);
            expect(validate.errors).toContainEqual(
                expect.objectContaining({
                    message: "must have required property 'id'",
                })
            );
        });

        test('should fail validation if required "priority" property is missing', () => {
            const invalidData = { ...validGoalFixture };
            delete invalidData.priority;
            const ok = validate(invalidData);
            expect(ok).toBe(false);
            expect(validate.errors).toContainEqual(
                expect.objectContaining({
                    message: "must have required property 'priority'",
                })
            );
        });

        test('should fail validation if required "relevance" property is missing', () => {
            const invalidData = { ...validGoalFixture };
            delete invalidData.relevance;
            const ok = validate(invalidData);
            expect(ok).toBe(false);
            expect(validate.errors).toContainEqual(
                expect.objectContaining({
                    message: "must have required property 'relevance'",
                })
            );
        });

        test('should fail validation if required "goalState" property is missing', () => {
            const invalidData = { ...validGoalFixture };
            delete invalidData.goalState;
            const ok = validate(invalidData);
            expect(ok).toBe(false);
            expect(validate.errors).toContainEqual(
                expect.objectContaining({
                    message: "must have required property 'goalState'",
                })
            );
        });

        test('should fail validation if "priority" is not a number', () => {
            const invalidData = { ...validGoalFixture, priority: 'high' };
            const ok = validate(invalidData);
            expect(ok).toBe(false);
            expect(validate.errors).toContainEqual(
                expect.objectContaining({
                    message: 'must be number',
                    instancePath: '/priority',
                })
            );
        });

        test('should fail validation if an extra, undefined property is included', () => {
            const invalidData = { ...validGoalFixture, unknownProperty: 'test' };
            const ok = validate(invalidData);
            expect(ok).toBe(false);
            expect(validate.errors).toContainEqual(
                expect.objectContaining({
                    message: 'must NOT have additional properties',
                    params: { additionalProperty: 'unknownProperty' },
                })
            );
        });
    });
});