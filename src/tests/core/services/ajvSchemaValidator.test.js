// src/tests/core/services/ajvSchemaValidator.test.js

import {describe, it, expect, beforeEach, jest} from '@jest/globals';
import AjvSchemaValidator from '../../../core/services/ajvSchemaValidator.js'; // Adjust path as needed

// --- Task 1: Prepare Test Assets ---

// 1a. Valid Schemas
const simpleObjectSchema = {
    $id: 'test://schemas/simple-object',
    type: 'object',
    properties: {
        name: {type: 'string'},
        count: {type: 'integer'},
    },
    additionalProperties: false,
};

const requiredPropsSchema = {
    $id: 'test://schemas/required-props',
    type: 'object',
    properties: {
        id: {type: 'string'},
        value: {type: 'number'},
        optionalFlag: {type: 'boolean'},
    },
    required: ['id', 'value'], // 'id' and 'value' are mandatory
    additionalProperties: true,
};

const basicTypeSchema = {
    $id: 'test://schemas/basic-type',
    type: 'string',
    minLength: 3,
};

// --- NEW: Complex "Real-Life" Schema ---
const commonSchema = {
    '$schema': 'http://json-schema.org/draft-07/schema#',
    '$id': 'http://example.com/schemas/common.schema.json',
    'title': 'Common Definitions',
    'definitions': {
        'namespacedId': {
            'description': "A unique identifier string, typically namespaced using a colon (e.g., 'core:player', 'mod_combat:action_attack'). Allows alphanumeric characters, underscore, hyphen, and colon.",
            'type': 'string',
            'pattern': '^[a-zA-Z0-9_\\-:]+$'
        },
        'DefinitionRefComponent': {
            'description': 'A generic component holding a single reference ID string, typically to a definition (e.g., an item definition ID on an instance, a character class definition).',
            'type': 'object',
            'required': ['id'],
            'properties': {
                'id': {
                    '$ref': '#/definitions/namespacedId',
                    'description': 'The namespaced ID referencing the target definition.'
                }
            },
            'additionalProperties': false
        },
        'nullableNamespacedId': {
            'description': 'A unique identifier string, typically namespaced (like namespacedId), or null.',
            'oneOf': [
                {'type': 'string', 'pattern': '^[a-zA-Z0-9_\\-:]+$'},
                {'type': 'null'}
            ]
        },
        'NameComponent': {
            'type': 'object',
            'additionalProperties': false,
            'required': ['value'],
            'properties': {
                'value': {
                    'type': 'string',
                    'description': "The primary display name or title of the entity (e.g., 'Player', 'Goblin Sentry', 'Iron Key')."
                }
            }
        },
        'DescriptionComponent': {
            'type': 'object',
            'additionalProperties': false,
            'required': ['text'],
            'properties': {
                'text': {'type': 'string', 'description': 'A static description text for the entity.'}
            }
        },
        'MetaDescriptionComponent': {
            'type': 'object',
            'additionalProperties': false,
            'required': ['keywords'],
            'properties': {
                'keywords': {
                    'type': 'array',
                    'description': "A list of concise keywords or short phrases describing the location's key features, atmosphere, or contents (e.g., ['damp stone', 'flickering torchlight', 'smell of decay', 'distant dripping']). Used as input for LLM description generation.",
                    'items': {'type': 'string'},
                    'minItems': 1
                },
                'style_hint': {
                    'type': 'string',
                    'description': "(Optional) Hint for the LLM about the desired writing style (e.g., 'brief', 'ominous', 'poetic')."
                }
            }
        },
        'PositionComponent': {
            'description': 'Schema for validating PositionComponent data.',
            'type': 'object',
            'properties': {
                'locationId': {
                    '$ref': '#/definitions/namespacedId',
                    'description': 'The ID of the location entity where the entity resides.'
                },
                'x': {
                    'description': 'Optional x-coordinate within the location (if grid-based).',
                    'type': 'number',
                    'default': 0
                },
                'y': {
                    'description': 'Optional y-coordinate within the location (if grid-based).',
                    'type': 'number',
                    'default': 0
                }
            },
            'required': ['locationId'],
            'additionalProperties': false
        },
        'HealthComponent': {
            'type': 'object',
            'description': "Tracks the entity's health points.",
            'properties': {
                'current': {
                    'type': 'integer',
                    'description': 'Current HP (hit points). Cannot exceed max.',
                    'minimum': 0
                },
                'max': {'type': 'integer', 'description': 'Maximum HP for the entity.', 'minimum': 1}
            },
            'required': ['current', 'max'],
            'additionalProperties': false
        },
        'InventoryComponent': {
            'type': 'object',
            'description': 'Holds a list of item entity IDs the entity carries.',
            'properties': {
                'items': {
                    'type': 'array',
                    'description': "Array of item entity identifier strings currently in the entity's inventory.",
                    'items': {'$ref': '#/definitions/namespacedId'},
                    'default': [],
                    'uniqueItems': false
                }
            },
            'required': ['items'],
            'additionalProperties': false
        },
        'AttackComponent': {
            'type': 'object',
            'description': "Defines the entity's base attack capability.",
            'properties': {
                'damage': {'type': 'integer', 'description': 'Base damage or attack strength value.', 'minimum': 0},
                'attack_verb': {
                    'type': 'string',
                    'description': "Optional verb used in combat messages (e.g., 'attacks', 'claws', 'bites'). Defaults based on context if omitted.",
                    'default': 'attacks'
                }
            },
            'required': ['damage'],
            'additionalProperties': false
        },
        'SkillComponent': {
            'type': 'object',
            'description': "Tracks the entity's skill levels.",
            'properties': {
                'skills': {
                    'type': 'object',
                    'description': "A map of skill IDs (e.g., 'core:skill_lockpicking') to their current integer value.",
                    'additionalProperties': {'type': 'integer', 'minimum': 0},
                    'propertyNames': {'$ref': '#/definitions/namespacedId'},
                    'examples': [{'core:skill_stealth': 5, 'core:skill_perception': 3}]
                }
            },
            'required': ['skills'],
            'additionalProperties': false
        },
        'StatsComponent': {
            'type': 'object',
            'description': "Tracks the entity's core attributes (stats).",
            'properties': {
                'attributes': {
                    'type': 'object',
                    'description': "A map of attribute IDs (e.g., 'core:attr_strength') to their current integer value.",
                    'additionalProperties': {'type': 'integer', 'minimum': 0},
                    'propertyNames': {'$ref': '#/definitions/namespacedId'},
                    'examples': [{'core:attr_strength': 8, 'core:attr_agility': 12}]
                }
            },
            'required': ['attributes'],
            'additionalProperties': false
        },
        'EntitiesPresentComponent': {
            'type': 'object',
            'description': 'Lists the IDs of entities currently present within this entity (typically used for Locations or Containers).',
            'properties': {
                'entityIds': {
                    'type': 'array',
                    'description': 'Array of entity identifier strings present.',
                    'items': {'$ref': '#/definitions/namespacedId'},
                    'default': [],
                    'uniqueItems': true
                }
            },
            'required': ['entityIds'],
            'additionalProperties': false
        },
        'ConnectionsComponent': {
            '$comment': 'This is a basic version. location.schema.json defines a more complex version specific to locations.',
            'type': 'object',
            'description': 'Defines simple directional exits from one location to another.',
            'properties': {
                'exits': {
                    'type': 'object',
                    'description': 'Map where keys are directions (or exit names) and values are target location IDs.',
                    'additionalProperties': {'$ref': '#/definitions/namespacedId'},
                    'propertyNames': {'type': 'string'},
                    'examples': [{'north': 'demo:room_hallway', 'east': 'demo:room_storage'}]
                }
            },
            'required': ['exits'],
            'additionalProperties': false
        },
        'EquipmentComponent': {
            'type': 'object',
            'description': 'Tracks items equipped by the entity in specific body slots.',
            'properties': {
                'slots': {
                    'type': 'object',
                    'description': "A map where keys are slot IDs (e.g., 'core:slot_main_hand') and values are the entity ID string of the equipped item, or null if empty.",
                    'additionalProperties': {'$ref': '#/definitions/nullableNamespacedId'},
                    'propertyNames': {'$ref': '#/definitions/namespacedId'},
                    'examples': [{'core:slot_main_hand': 'demo:item_sword', 'core:slot_head': null}]
                }
            },
            'required': ['slots'],
            'additionalProperties': false
        },
        'QuestLogComponent': {
            'type': 'object',
            'description': 'Component for entities (typically the player) that track quest progress.',
            'properties': {
                'active_quests': {
                    'type': 'array',
                    'description': 'List of IDs of quests currently being tracked.',
                    'items': {'$ref': '#/definitions/namespacedId'},
                    'default': [],
                    'uniqueItems': true
                },
                'completed_quests': {
                    'type': 'array',
                    'description': 'List of IDs of quests that have been completed.',
                    'items': {'$ref': '#/definitions/namespacedId'},
                    'default': [],
                    'uniqueItems': true
                }
            },
            'required': [],
            'additionalProperties': false
        },
        'TypedParameterBase': {
            'type': 'object',
            'description': "Base structure for objects where a 'type' string dictates the structure of a 'parameters' object.",
            'required': ['type', 'parameters'],
            'properties': {
                'type': {
                    'type': 'string',
                    'description': "Identifier determining the required structure of the 'parameters' object."
                },
                'parameters': {
                    'type': 'object',
                    'description': "Container for parameters specific to the 'type'. Specific properties defined in consuming schemas using oneOf/allOf."
                }
            },
            'additionalProperties': false
        },
        'eventDefinition': {
            'type': 'object',
            'description': 'Defines an event structure containing a name/ID and optional data payload.',
            'required': ['eventName'],
            'properties': {
                'eventName': {
                    '$ref': '#/definitions/namespacedId',
                    'description': 'The unique, namespaced name/ID of the event to fire.'
                },
                'eventData': {
                    'type': 'object',
                    'description': 'Optional payload data object for the event. Structure depends on the specific event being fired.',
                    'additionalProperties': true
                }
            },
            'additionalProperties': false
        },
        // --- NOTE: External $refs below will NOT be resolved by default Ajv setup ---
        // ---       Tests using these require adding the referenced schemas separately ---
        'OpenableComponent': {'$ref': './openable.schema.json'},
        'LockableComponent': {'$ref': './lockable.schema.json'},
        'ContainerComponent': {'$ref': './container.schema.json'},
        'EdibleComponent': {'$ref': './edible.schema.json'},
        'LiquidContainerComponent': {'$ref': './liquid-container.schema.json'},
        'PushableComponent': {'$ref': './pushable.schema.json'},
        'BreakableComponent': {'$ref': './breakable.schema.json'},
        'PassageDetailsComponent': { /* ... definition using internal refs only ... */}
    }
};
// --- End complex schema ---

// 1b. Structurally Invalid Schema
const structurallyInvalidSchema = {
    $id: 'test://schemas/invalid-structure',
    type: 'object',
    properties: {
        name: {type: 'strng'}, // Intentional typo in type
    },
};

// 1c. Sample Data (Valid)
const validSimpleObjectData = {name: 'Test', count: 42};
const validRequiredPropsData = {id: 'req-123', value: 99.9, extra: 'allowed'};
const validBasicTypeData = 'validString';

// 1d. Sample Data (Invalid)
const invalidSimpleObjectData_ExtraProp = {name: 'Test', count: 1, extra: true}; // Fails additionalProperties
const invalidSimpleObjectData_WrongType = {name: 123, count: 1}; // Fails name type
const invalidRequiredPropsData_MissingRequired = {id: 'req-456'}; // Missing 'value'
const invalidRequiredPropsData_WrongType = {id: 'req-789', value: 'not a number'}; // Wrong type for 'value'
const invalidBasicTypeData_TooShort = 'no'; // Fails minLength

// --- Test Suite ---

describe('AjvSchemaValidator', () => {
    let validator;
    let mockLogger; // <-- Declare mockLogger here

    // Create a fresh instance before each test for isolation
    beforeEach(() => {
        // Create a mock logger that adheres to the ILogger interface
        // Use jest.fn() for mock functions
        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        };
        // Pass the mock logger to the constructor
        validator = new AjvSchemaValidator(mockLogger); // <-- Pass mockLogger
    });

    // --- Task 2: Test constructor ---
    describe('constructor', () => {
        it('should create an instance without throwing errors', () => {
            // The beforeEach block already does the creation,
            // so we just need to ensure it didn't throw implicitly.
            // If beforeEach failed, the test wouldn't run.
            // We can add an explicit check for robustness.
            expect(() => new AjvSchemaValidator(mockLogger)).not.toThrow();
        });


        it('should throw an error if an invalid logger is provided', () => {
            // Test missing methods
            expect(() => new AjvSchemaValidator({})).toThrow(/Missing or invalid 'logger' dependency/);
            expect(() => new AjvSchemaValidator({
                info: jest.fn(),
                warn: jest.fn(),
                error: jest.fn()
            })).toThrow(/Missing or invalid 'logger' dependency/); // Missing debug
            // Test null/undefined
            expect(() => new AjvSchemaValidator(null)).toThrow(/Missing or invalid 'logger' dependency/);
            expect(() => new AjvSchemaValidator(undefined)).toThrow(/Missing or invalid 'logger' dependency/);
        });

        it('should initialize internal Ajv instance (implicitly tested by other methods)', () => {
            // No direct assertion needed as per ticket - functionality confirms initialization
            // The beforeEach ensures validator is created if mockLogger is valid
            expect(validator).toBeDefined();
            expect(validator).toBeInstanceOf(AjvSchemaValidator);
            // Optionally, you could check if the internal #ajv property is set,
            // but that tests internal implementation details. Accessing private fields
            // in tests is generally discouraged but sometimes necessary.
            // Example (may require specific Jest/babel config for private fields):
            // expect(validator['#ajv']).toBeDefined();
            // expect(validator['#ajv']).not.toBeNull();
        });
    });

    // --- Task 3: Test addSchema Method ---
    describe('addSchema', () => {
        it('should resolve successfully when adding a valid schema with a unique ID', async () => {
            await expect(validator.addSchema(simpleObjectSchema, simpleObjectSchema.$id))
                .resolves.toBeUndefined(); // Resolves with void/undefined
            // Verify schema is actually loaded (optional, but good practice)
            expect(validator.isSchemaLoaded(simpleObjectSchema.$id)).toBe(true);
        });

        it('should resolve successfully when adding the complex commonSchema', async () => {
            // Note: This test assumes external $refs like "./openable.schema.json" are NOT
            // required to be resolvable for Ajv to *add* the schema successfully, only
            // if those specific parts are actually used during validation later.
            // If Ajv requires all refs during addSchema, this test would need mocks/dummies.
            await expect(validator.addSchema(commonSchema, commonSchema.$id))
                .resolves.toBeUndefined();
            expect(validator.isSchemaLoaded(commonSchema.$id)).toBe(true);
        });

        it('should reject when attempting to add the same schema ID again', async () => {
            await validator.addSchema(simpleObjectSchema, simpleObjectSchema.$id); // Add first time
            // Attempt to add again
            // Match the specific error message thrown by the AjvSchemaValidator wrapper class
            const expectedErrorMessage = `AjvSchemaValidator: Schema with ID '${simpleObjectSchema.$id}' already exists. Ajv does not overwrite. Use removeSchema first if replacement is intended.`;
            await expect(validator.addSchema(requiredPropsSchema, simpleObjectSchema.$id)) // Using different schema but same ID
                .rejects.toThrow(expectedErrorMessage); // <-- Use the exact expected message
        });

        it('should reject when attempting to add a structurally invalid schema', async () => {
            await expect(validator.addSchema(structurallyInvalidSchema, structurallyInvalidSchema.$id))
                .rejects.toThrow(); // Ajv throws detailed errors for invalid schemas
            // Check it wasn't loaded
            expect(validator.isSchemaLoaded(structurallyInvalidSchema.$id)).toBe(false);
        });

        it('should reject when adding with null schemaData', async () => {
            await expect(validator.addSchema(null, 'test://schemas/null-schema'))
                .rejects.toThrow(/Invalid or empty schemaData/);
        });

        it('should reject when adding with empty object schemaData', async () => {
            await expect(validator.addSchema({}, 'test://schemas/empty-schema'))
                .rejects.toThrow(/Invalid or empty schemaData/);
        });

        it('should reject when adding with null schemaId', async () => {
            await expect(validator.addSchema(simpleObjectSchema, null))
                .rejects.toThrow(/Invalid or empty schemaId/);
        });

        it('should reject when adding with empty string schemaId', async () => {
            await expect(validator.addSchema(simpleObjectSchema, ''))
                .rejects.toThrow(/Invalid or empty schemaId/);
        });

        it('should reject when adding with non-string schemaId', async () => {
            await expect(validator.addSchema(simpleObjectSchema, 123))
                .rejects.toThrow(/Invalid or empty schemaId/);
        });
    });

    // --- Task 4: Test isSchemaLoaded Method ---
    describe('isSchemaLoaded', () => {
        it('should return true after a schema has been successfully added', async () => {
            await validator.addSchema(simpleObjectSchema, simpleObjectSchema.$id);
            expect(validator.isSchemaLoaded(simpleObjectSchema.$id)).toBe(true);
        });

        it('should return false for a schema ID that has not been added', () => {
            expect(validator.isSchemaLoaded('test://schemas/non-existent')).toBe(false);
        });

        it('should return false if called after adding a schema failed', async () => {
            try {
                await validator.addSchema(structurallyInvalidSchema, structurallyInvalidSchema.$id);
            } catch (e) {
                // Expected failure
            }
            expect(validator.isSchemaLoaded(structurallyInvalidSchema.$id)).toBe(false);
        });

        it('should return false for invalid schemaId input (null)', () => {
            expect(validator.isSchemaLoaded(null)).toBe(false);
        });

        it('should return false for invalid schemaId input (empty string)', () => {
            expect(validator.isSchemaLoaded('')).toBe(false);
        });

        it('should return false for invalid schemaId input (undefined)', () => {
            expect(validator.isSchemaLoaded(undefined)).toBe(false);
        });

        it('should return false for invalid schemaId input (number)', () => {
            expect(validator.isSchemaLoaded(12345)).toBe(false);
        });
    });

    // --- Task 5: Test getValidator Method ---
    describe('getValidator', () => {
        it('should return a function after a schema has been successfully added', async () => {
            await validator.addSchema(simpleObjectSchema, simpleObjectSchema.$id);
            const validateFn = validator.getValidator(simpleObjectSchema.$id);
            expect(validateFn).toBeDefined();
            expect(validateFn).toBeInstanceOf(Function);
        });

        it('should return undefined for a schema ID that has not been added', () => {
            expect(validator.getValidator('test://schemas/non-existent')).toBeUndefined();
        });

        it('should return undefined if called after adding a schema failed', async () => {
            try {
                await validator.addSchema(structurallyInvalidSchema, structurallyInvalidSchema.$id);
            } catch (e) {
                // Expected failure
            }
            expect(validator.getValidator(structurallyInvalidSchema.$id)).toBeUndefined();
        });

        it('should return undefined for invalid schemaId input (null)', () => {
            expect(validator.getValidator(null)).toBeUndefined();
        });

        it('should return undefined for invalid schemaId input (empty string)', () => {
            expect(validator.getValidator('')).toBeUndefined();
        });

        it('should return undefined for invalid schemaId input (undefined)', () => {
            expect(validator.getValidator(undefined)).toBeUndefined();
        });

        it('should return undefined for invalid schemaId input (number)', () => {
            expect(validator.getValidator(9876)).toBeUndefined();
        });
    });

    // --- Task 6: Test Returned Validator Function ---
    describe('Returned Validator Function', () => {
        let validateSimpleObject;
        let validateRequiredProps;
        let validateBasicType;

        // Add schemas before tests in this block
        beforeEach(async () => {
            await validator.addSchema(simpleObjectSchema, simpleObjectSchema.$id);
            await validator.addSchema(requiredPropsSchema, requiredPropsSchema.$id);
            await validator.addSchema(basicTypeSchema, basicTypeSchema.$id);

            validateSimpleObject = validator.getValidator(simpleObjectSchema.$id);
            validateRequiredProps = validator.getValidator(requiredPropsSchema.$id);
            validateBasicType = validator.getValidator(basicTypeSchema.$id);
        });

        it('should return { isValid: true, errors: null } for data matching simpleObjectSchema', () => {
            const result = validateSimpleObject(validSimpleObjectData);
            expect(result).toEqual({isValid: true, errors: null});
        });

        it('should return { isValid: true, errors: null } for data matching requiredPropsSchema', () => {
            const result = validateRequiredProps(validRequiredPropsData);
            expect(result).toEqual({isValid: true, errors: null});
        });

        it('should return { isValid: true, errors: null } for data matching basicTypeSchema', () => {
            const result = validateBasicType(validBasicTypeData);
            expect(result).toEqual({isValid: true, errors: null});
        });

        it('should return { isValid: false, errors: Array } for data with extra prop violating simpleObjectSchema', () => {
            const result = validateSimpleObject(invalidSimpleObjectData_ExtraProp);
            expect(result.isValid).toBe(false);
            expect(result.errors).toEqual(expect.any(Array));
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0].keyword).toBe('additionalProperties'); // Check specific Ajv error details
        });

        it('should return { isValid: false, errors: Array } for data with wrong type violating simpleObjectSchema', () => {
            const result = validateSimpleObject(invalidSimpleObjectData_WrongType);
            expect(result.isValid).toBe(false);
            expect(result.errors).toEqual(expect.any(Array));
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0].instancePath).toBe('/name');
            expect(result.errors[0].keyword).toBe('type');
        });

        it('should return { isValid: false, errors: Array } for data missing required prop violating requiredPropsSchema', () => {
            const result = validateRequiredProps(invalidRequiredPropsData_MissingRequired);
            expect(result.isValid).toBe(false);
            expect(result.errors).toEqual(expect.any(Array));
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0].keyword).toBe('required');
            expect(result.errors[0].params.missingProperty).toBe('value');
        });

        it('should return { isValid: false, errors: Array } for data with wrong type violating requiredPropsSchema', () => {
            const result = validateRequiredProps(invalidRequiredPropsData_WrongType);
            expect(result.isValid).toBe(false);
            expect(result.errors).toEqual(expect.any(Array));
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0].instancePath).toBe('/value');
            expect(result.errors[0].keyword).toBe('type');
        });

        it('should return { isValid: false, errors: Array } for data violating basicTypeSchema (minLength)', () => {
            const result = validateBasicType(invalidBasicTypeData_TooShort);
            expect(result.isValid).toBe(false);
            expect(result.errors).toEqual(expect.any(Array));
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0].keyword).toBe('minLength');
        });

        // Optional/Advanced: Test potential runtime errors (skipped as per thought process, less likely with standard usage)
        // it('should handle potential runtime errors during validation gracefully', () => { ... });
    });
});