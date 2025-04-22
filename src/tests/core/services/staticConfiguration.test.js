// src/tests/core/services/staticConfiguration.test.js

import {describe, it, expect, beforeEach} from '@jest/globals'; // Or '@vitest/globals'
import StaticConfiguration from '../../../core/services/staticConfiguration.js';

// --- Replicate Constants/Expected Values from staticConfiguration.js for Verification ---
// Source: const BASE_DATA_PATH = './data';
const EXPECTED_BASE_DATA_PATH = './data';

// Source: const SCHEMA_FILES = [...]
const EXPECTED_SCHEMA_FILES = [
    'common.schema.json',
    'event-definition.schema.json',
    'action-definition.schema.json',
    'entity.schema.json',
    'interaction-test.schema.json',
    'quest.schema.json',
    'objective.schema.json',
    'world-manifest.schema.json',
    'component-definition.schema.json',
    'json-logic.schema.json',
    'system-rule.schema.json',
];

// Source: const CONTENT_TYPE_SCHEMAS = {...}
const EXPECTED_CONTENT_TYPE_SCHEMAS = {
    common: 'http://example.com/schemas/common.schema.json',
    actions: 'http://example.com/schemas/action-definition.schema.json',
    entities: 'http://example.com/schemas/entity.schema.json',
    components: 'http://example.com/schemas/component-definition.schema.json',
    items: 'http://example.com/schemas/entity.schema.json',
    locations: 'http://example.com/schemas/entity.schema.json',
    connections: 'http://example.com/schemas/entity.schema.json',
    blockers: 'http://example.com/schemas/entity.schema.json',
    objectives: 'http://example.com/schemas/objective.schema.json',
    quests: 'http://example.com/schemas/quest.schema.json',
    interactionTests: 'http://example.com/schemas/interaction-test.schema.json',
    manifest: 'http://example.com/schemas/world-manifest.schema.json',
};

// Source: this.#manifestSchemaId = CONTENT_TYPE_SCHEMAS.manifest;
const EXPECTED_MANIFEST_SCHEMA_ID = EXPECTED_CONTENT_TYPE_SCHEMAS.manifest;

// Expected derived paths
const EXPECTED_SCHEMA_BASE_PATH = `${EXPECTED_BASE_DATA_PATH}/schemas`; // ./data/schemas
const EXPECTED_WORLD_BASE_PATH = `${EXPECTED_BASE_DATA_PATH}/worlds`; // ./data/worlds

// --- Test Suite ---

describe('StaticConfiguration', () => {
    let config;

    // Create a fresh instance before each test for isolation
    beforeEach(() => {
        config = new StaticConfiguration();
    });

    it('should instantiate without errors', () => {
        expect(config).toBeInstanceOf(StaticConfiguration);
    });

    // --- Test getBaseDataPath() ---
    describe('getBaseDataPath()', () => {
        it('should return the correct base data path', () => {
            expect(config.getBaseDataPath()).toBe(EXPECTED_BASE_DATA_PATH);
        });
    });

    // --- Test getSchemaFiles() ---
    describe('getSchemaFiles()', () => {
        it('should return an array containing the expected schema filenames', () => {
            const files = config.getSchemaFiles();
            expect(Array.isArray(files)).toBe(true);
            expect(files).toEqual(EXPECTED_SCHEMA_FILES);
            // Verify order as well (toEqual checks order for arrays)
            expect(files[0]).toBe('common.schema.json');
            expect(files[files.length - 1]).toBe('system-rule.schema.json');
        });

        it('should return a *copy* of the internal schema files array', () => {
            const files1 = config.getSchemaFiles();
            const files2 = config.getSchemaFiles();

            // Check they are equal in content but not the same instance
            expect(files1).toEqual(files2);
            expect(files1).not.toBe(files2);

            // Mutate the first copy
            files1.push('mutated.schema.json');

            // Get a new copy
            const files3 = config.getSchemaFiles();

            // Verify the mutation didn't affect the internal state
            expect(files3).toEqual(EXPECTED_SCHEMA_FILES); // Should be the original list
            expect(files3).not.toEqual(files1); // Should not match the mutated list
            expect(files3).not.toBe(files1); // Should be a different instance
        });
    });

    // --- Test getContentTypeSchemaId(typeName) ---
    describe('getContentTypeSchemaId(typeName)', () => {
        it('should return the correct schema ID for known content types', () => {
            // Test a few representative known types
            expect(config.getContentTypeSchemaId('actions')).toBe(EXPECTED_CONTENT_TYPE_SCHEMAS.actions);
            expect(config.getContentTypeSchemaId('items')).toBe(EXPECTED_CONTENT_TYPE_SCHEMAS.items);
            expect(config.getContentTypeSchemaId('locations')).toBe(EXPECTED_CONTENT_TYPE_SCHEMAS.locations);
            expect(config.getContentTypeSchemaId('manifest')).toBe(EXPECTED_CONTENT_TYPE_SCHEMAS.manifest);
            expect(config.getContentTypeSchemaId('liquidContainers')).toBe(EXPECTED_CONTENT_TYPE_SCHEMAS.liquidContainers);

            // Test all defined keys to be thorough
            Object.keys(EXPECTED_CONTENT_TYPE_SCHEMAS).forEach(key => {
                expect(config.getContentTypeSchemaId(key)).toBe(EXPECTED_CONTENT_TYPE_SCHEMAS[key]);
            });
        });

        it('should return undefined for unknown content type names', () => {
            expect(config.getContentTypeSchemaId('widgets')).toBeUndefined();
            expect(config.getContentTypeSchemaId('nonExistentType')).toBeUndefined();
            expect(config.getContentTypeSchemaId(' player ')).toBeUndefined(); // Check untrimmed
        });

        it('should return undefined for null, undefined, or empty string input', () => {
            expect(config.getContentTypeSchemaId(null)).toBeUndefined();
            expect(config.getContentTypeSchemaId(undefined)).toBeUndefined();
            expect(config.getContentTypeSchemaId('')).toBeUndefined();
        });

        // Edge case: check if an object property named 'null' or 'undefined' exists (unlikely but possible)
        // Assuming 'null' or 'undefined' are not valid keys in CONTENT_TYPE_SCHEMAS
        it('should return undefined even if object properties like "null" exist', () => {
            // Temporarily add a property to the prototype to simulate edge case (not recommended for production code testing)
            // Object.prototype['null'] = 'test'; // Avoid doing this if possible
            expect(config.getContentTypeSchemaId(null)).toBeUndefined();
            // delete Object.prototype['null']; // Clean up
        });
    });

    // --- Test getManifestSchemaId() ---
    describe('getManifestSchemaId()', () => {
        it('should return the correct manifest schema ID', () => {
            expect(config.getManifestSchemaId()).toBe(EXPECTED_MANIFEST_SCHEMA_ID);
        });
    });

    // --- Test getSchemaBasePath() ---
    describe('getSchemaBasePath()', () => {
        it('should return the correctly constructed schema base path', () => {
            expect(config.getSchemaBasePath()).toBe(EXPECTED_SCHEMA_BASE_PATH);
        });
    });

    // --- Test getContentBasePath(typeName) ---
    describe('getContentBasePath(typeName)', () => {
        it('should return the correctly constructed path for known content types', () => {
            expect(config.getContentBasePath('items')).toBe(`${EXPECTED_BASE_DATA_PATH}/items`); // ./data/items
            expect(config.getContentBasePath('entities')).toBe(`${EXPECTED_BASE_DATA_PATH}/entities`); // ./data/entities
            expect(config.getContentBasePath('actions')).toBe(`${EXPECTED_BASE_DATA_PATH}/actions`); // ./data/actions
            expect(config.getContentBasePath('locations')).toBe(`${EXPECTED_BASE_DATA_PATH}/locations`); // ./data/locations
        });

        it('should return a predictably constructed path for unknown content types', () => {
            expect(config.getContentBasePath('widgets')).toBe(`${EXPECTED_BASE_DATA_PATH}/widgets`); // ./data/widgets
            expect(config.getContentBasePath('someRandomType')).toBe(`${EXPECTED_BASE_DATA_PATH}/someRandomType`); // ./data/someRandomType
            expect(config.getContentBasePath('')).toBe(`${EXPECTED_BASE_DATA_PATH}/`); // ./data/
        });

        // It should handle null/undefined gracefully by converting them to strings "null"/"undefined" in path
        it('should construct path using string conversion for null/undefined input', () => {
            expect(config.getContentBasePath(null)).toBe(`${EXPECTED_BASE_DATA_PATH}/null`);
            expect(config.getContentBasePath(undefined)).toBe(`${EXPECTED_BASE_DATA_PATH}/undefined`);
        });
    });

    // --- Test getWorldBasePath() ---
    describe('getWorldBasePath()', () => {
        it('should return the correctly constructed world base path', () => {
            expect(config.getWorldBasePath()).toBe(EXPECTED_WORLD_BASE_PATH);
        });
    });
});