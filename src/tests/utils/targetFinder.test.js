// src/tests/utils/targetFinder.test.js

// --- Tell Jest to Mock the Actual Dependencies ---

// Mock the NameComponent module that findTarget uses
import {describe, expect, it, jest} from "@jest/globals";

jest.mock('../../components/nameComponent.js', () => ({
    // Important: Must match the export structure of the original file
    // If NameComponent is a default export use: module.exports = class MockNameComponent ...
    // If it's a named export like in the example:
    NameComponent: class MockNameComponent { // Use a distinct name if preferred (MockNameComponent)
        constructor(value) {
            this.value = value;
        }
    }
}));

// Mock the Entity class for test setup consistency (optional but good practice)
// Since findTarget doesn't directly import Entity, we could just use a local
// helper class. But mocking it ensures we use the same pattern.
// If Entity is a default export:
jest.mock('../../entities/entity.js', () => (
    // Default export mock
    class MockEntity {
        constructor(id) {
            this.id = id;
            this.components = new Map();
        }

        addComponent(componentInstance) {
            const componentClass = componentInstance.constructor;
            this.components.set(componentClass, componentInstance);
        }


        getComponent(ComponentClass) {
            // This 'ComponentClass' will now correctly reference the
            // *mocked* NameComponent when called by findTarget
            return this.components.get(ComponentClass);
        }

        hasComponent(ComponentClass) {
            return this.components.has(ComponentClass);
        }

        // Helper for tests - Fix the toString to use the mocked component correctly
        toString() {
            // We need to get the *mocked* NameComponent class reference here
            // Since this mock runs in its own scope, we might need to import it INSIDE the mock
            // Or, more simply, assume getComponent works and use it:
            const nameComp = this.getComponent(require('../components/nameComponent.js').NameComponent); // Get the mocked class reference
            const name = nameComp && nameComp.value ? nameComp.value : 'Unnamed';
            return `MockEntity[${this.id}, Name: ${name}]`;
        }
    }
));


// --- Import the function to test and the (now mocked) dependencies ---

// Import the function under test
import {findTarget} from "../../utils/targetFinder.js";

// Import the MOCKED versions (Jest redirects these imports)
import {NameComponent} from '../../components/nameComponent.js'; // Gets the MockNameComponent class from jest.mock
import Entity from '../../entities/entity.js';                 // Gets the MockEntity class from jest.mock


// --- Helper Function (Uses the MOCKED Entity and NameComponent) ---
const createNamedEntity = (id, name) => {
    const entity = new Entity(id); // Uses the MockEntity
    if (name !== undefined) { // Allow null for testing nullNamedEntity
        // Uses the MockNameComponent via the imported (and mocked) NameComponent
        entity.addComponent(new NameComponent(name));
    }
    return entity;
};

// --- Test Suite (Remains the same from here down) ---
describe('findTarget Utility Function', () => {

    // --- Test Data ---
    const goblin = createNamedEntity('gob1', 'Goblin');
    const goblinArcher = createNamedEntity('gob2', 'Goblin Archer');
    const orc = createNamedEntity('orc1', 'Orc');
    const goblinChief = createNamedEntity('gob3', 'Goblin Chief');
    const upperGoblin = createNamedEntity('gob4', 'GOBLIN'); // For case testing
    const unnamedEntity = createNamedEntity('unnamed1', undefined); // Entity without NameComponent
    const wronglyNamedEntity = createNamedEntity('wrong1', 123); // Entity with non-string name value
    const nullNamedEntity = createNamedEntity('nullName', null); // Entity with null name value

    const standardScope = [goblin, goblinArcher, orc, goblinChief, upperGoblin];
    const mixedScope = [goblin, unnamedEntity, wronglyNamedEntity, nullNamedEntity, orc];

    // --- Input Validation Tests ---
    describe('Input Validation', () => {
        it('should return NOT_FOUND if targetString is null', () => {
            const result = findTarget(null, standardScope);
            expect(result.status).toBe('NOT_FOUND');
            expect(result.matches).toEqual([]);
        });

        it('should return NOT_FOUND if targetString is undefined', () => {
            const result = findTarget(undefined, standardScope);
            expect(result.status).toBe('NOT_FOUND');
            expect(result.matches).toEqual([]);
        });

        it('should return NOT_FOUND if targetString is empty', () => {
            const result = findTarget('', standardScope);
            expect(result.status).toBe('NOT_FOUND');
            expect(result.matches).toEqual([]);
        });

        it('should return NOT_FOUND if targetString is only whitespace', () => {
            const result = findTarget('   ', standardScope);
            expect(result.status).toBe('NOT_FOUND');
            expect(result.matches).toEqual([]);
        });

        it('should return NOT_FOUND if searchScope is null', () => {
            const result = findTarget('goblin', null);
            expect(result.status).toBe('NOT_FOUND');
            expect(result.matches).toEqual([]);
        });

        it('should return NOT_FOUND if searchScope is undefined', () => {
            const result = findTarget('orc', undefined);
            expect(result.status).toBe('NOT_FOUND');
            expect(result.matches).toEqual([]);
        });

        it('should return NOT_FOUND if searchScope is not an array', () => {
            const result = findTarget('orc', {not: 'an array'});
            expect(result.status).toBe('NOT_FOUND');
            expect(result.matches).toEqual([]);
        });

        it('should return NOT_FOUND if searchScope is empty', () => {
            const result = findTarget('goblin', []);
            expect(result.status).toBe('NOT_FOUND');
            expect(result.matches).toEqual([]);
        });
    });

    // --- Search Logic Tests ---
    describe('Search Logic', () => {
        it('should return NOT_FOUND when no entity name matches', () => {
            const result = findTarget('Dragon', standardScope);
            expect(result.status).toBe('NOT_FOUND');
            expect(result.matches).toHaveLength(0);
        });

        it('should return FOUND_UNIQUE for a single exact match (case-insensitive)', () => {
            const result = findTarget('orc', standardScope);
            expect(result.status).toBe('FOUND_UNIQUE');
            expect(result.matches).toHaveLength(1);
            expect(result.matches).toContain(orc);
        });

        it('should return FOUND_UNIQUE for a single exact match (mixed case target)', () => {
            const result = findTarget('OrC', standardScope);
            expect(result.status).toBe('FOUND_UNIQUE');
            expect(result.matches).toHaveLength(1);
            expect(result.matches).toContain(orc);
        });

        it('should return FOUND_UNIQUE for a unique partial match', () => {
            const result = findTarget('archer', standardScope);
            expect(result.status).toBe('FOUND_UNIQUE');
            expect(result.matches).toHaveLength(1);
            expect(result.matches).toContain(goblinArcher);
        });

        it('should handle targetString with leading/trailing whitespace', () => {
            const result = findTarget('  Orc  ', standardScope);
            expect(result.status).toBe('FOUND_UNIQUE');
            expect(result.matches).toHaveLength(1);
            expect(result.matches).toContain(orc);
        });

        it('should return FOUND_AMBIGUOUS when multiple entities match partially', () => {
            const result = findTarget('goblin', standardScope); // Matches 'Goblin', 'Goblin Archer', 'Goblin Chief', 'GOBLIN'
            expect(result.status).toBe('FOUND_AMBIGUOUS');
            expect(result.matches).toHaveLength(4);
            expect(result.matches).toContain(goblin);
            expect(result.matches).toContain(goblinArcher);
            expect(result.matches).toContain(goblinChief);
            expect(result.matches).toContain(upperGoblin);
        });

        it('should return FOUND_AMBIGUOUS when multiple entities match exactly (case-insensitive)', () => {
            // Create a specific scope for this test
            const entityA = createNamedEntity('g1', 'goblin');
            const entityB = createNamedEntity('g2', 'Goblin');
            const entityC = createNamedEntity('g3', 'GoBlIn');
            const scope = [entityA, entityB, entityC, orc]; // Add orc to ensure it's not just finding all
            const result = findTarget('gObLiN', scope);
            expect(result.status).toBe('FOUND_AMBIGUOUS');
            expect(result.matches).toHaveLength(3);
            expect(result.matches).toContain(entityA);
            expect(result.matches).toContain(entityB);
            expect(result.matches).toContain(entityC);
            expect(result.matches).not.toContain(orc);
        });

        it('should correctly handle partial matches at start/middle/end', () => {
            const resultStart = findTarget('gob', standardScope); // Matches all 4 goblins
            expect(resultStart.status).toBe('FOUND_AMBIGUOUS');
            expect(resultStart.matches).toHaveLength(4);

            const resultMiddle = findTarget('blin ar', standardScope); // Matches 'Goblin Archer'
            expect(resultMiddle.status).toBe('FOUND_UNIQUE');
            expect(resultMiddle.matches).toHaveLength(1);
            expect(resultMiddle.matches).toContain(goblinArcher);

            const resultEnd = findTarget('chief', standardScope); // Matches 'Goblin Chief'
            expect(resultEnd.status).toBe('FOUND_UNIQUE');
            expect(resultEnd.matches).toHaveLength(1);
            expect(resultEnd.matches).toContain(goblinChief);
        });
    });

    // --- Edge Cases and Robustness ---
    describe('Edge Cases and Robustness', () => {
        it('should ignore entities without a NameComponent', () => {
            const result = findTarget('orc', mixedScope); // Should only find 'orc'
            expect(result.status).toBe('FOUND_UNIQUE');
            expect(result.matches).toHaveLength(1);
            expect(result.matches).toContain(orc);
        });

        it('should ignore entities where NameComponent value is not a string', () => {
            // Searching for 'goblin' should only find the valid 'goblin' in mixedScope
            const result = findTarget('goblin', mixedScope);
            expect(result.status).toBe('FOUND_UNIQUE');
            expect(result.matches).toHaveLength(1);
            expect(result.matches).toContain(goblin); // Only the original valid goblin
            expect(result.matches).not.toContain(wronglyNamedEntity);
            // expect(result.matches).not.toContain(nullNamedEntity); // null is handled separately now
        });

        it('should ignore entities where NameComponent value is null', () => {
            const result = findTarget('orc', mixedScope); // Search again, ensure nullNamedEntity is ignored
            expect(result.status).toBe('FOUND_UNIQUE');
            expect(result.matches).toHaveLength(1);
            expect(result.matches).toContain(orc);
            expect(result.matches).not.toContain(nullNamedEntity);

            // Also test searching for 'null' doesn't find it
            const resultNullSearch = findTarget('null', mixedScope);
            expect(resultNullSearch.status).toBe('NOT_FOUND'); // Should not match nullNamedEntity
        });


        it('should ignore non-object or non-entity-like items in searchScope', () => {
            const messyScope = [
                goblin,
                null,
                undefined,
                'a string',
                12345,
                {random: 'object'}, // Doesn't have getComponent
                orc,
                {} // Empty object doesn't have getComponent
            ];
            const result = findTarget('o', messyScope); // Should match 'Goblin' and 'Orc'
            expect(result.status).toBe('FOUND_AMBIGUOUS');
            expect(result.matches).toHaveLength(2);
            expect(result.matches).toContain(goblin);
            expect(result.matches).toContain(orc);
        });

        it('should work correctly when an empty options object is passed', () => {
            const result = findTarget('orc', standardScope, {});
            expect(result.status).toBe('FOUND_UNIQUE');
            expect(result.matches).toHaveLength(1);
            expect(result.matches).toContain(orc);
        });

        it('should work correctly when an options object with unrelated properties is passed', () => {
            const result = findTarget('orc', standardScope, {someOtherOption: true});
            expect(result.status).toBe('FOUND_UNIQUE');
            expect(result.matches).toHaveLength(1);
            expect(result.matches).toContain(orc);
        });
    });
});