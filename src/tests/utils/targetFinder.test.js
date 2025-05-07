// src/tests/utils/targetFinder.test.js

import {describe, expect, it, jest} from '@jest/globals';

// --- Keep the import for use OUTSIDE of jest.mock (e.g., in createNamedEntity) ---
// Ensure this path is correct and the constant is exported properly
import {NAME_COMPONENT_ID} from '../../types/components.js';

// --- Mock Dependencies USING jest.requireActual INSIDE the factory ---

jest.mock('../../components/nameComponent.js', () => {
  // Use requireActual *inside* the factory to get the constant
  const {NAME_COMPONENT_TYPE_ID: ActualNameId} = jest.requireActual('../../types/components.js');
  return {
    NameComponent: class MockNameComponent {
      // Use the required constant for the ID
      static id = ActualNameId;
    }
  };
});

jest.mock('../../entities/entity.js', () => {
  // Use requireActual *inside* the factory to get the constant
  const {NAME_COMPONENT_TYPE_ID: ActualNameId} = jest.requireActual('../../types/components.js');
  // Assign to a local variable for convenience within this scope
  const nameComponentTypeId = ActualNameId;

  return class MockEntity {
    constructor(id) {
      this.id = id;
      this.components = new Map();
    }

    addComponent(componentTypeId, componentData) {
      if (typeof componentTypeId !== 'string' || !componentTypeId) {
        console.error(`MockEntity ${this.id}: Invalid componentTypeId in addComponent:`, componentTypeId);
        return;
      }
      if (componentData === undefined) {
        console.error(`MockEntity ${this.id}: Invalid componentData (undefined) in addComponent for ${componentTypeId}`);
        return;
      }
      this.components.set(componentTypeId, componentData);
    }

    getComponentData(componentTypeId) {
      return this.components.get(componentTypeId);
    }

    hasComponent(componentTypeId) {
      return this.components.has(componentTypeId);
    }

    toString() {
      // Use the constant ID obtained via requireActual inside the factory
      const nameData = this.getComponentData(nameComponentTypeId);
      const name = nameData && typeof nameData.value === 'string' ? nameData.value : 'Unnamed';
      return `MockEntity[${this.id}, Name: ${name}]`;
    }
  };
});


// --- Import the function to test and the (now mocked) dependencies ---

import {findTarget} from '../../utils/targetFinder.js';
// import {NameComponent} from '../../components/nameComponent.js'; // Mocked
import Entity from '../../entities/entity.js'; // Mocked

// --- Helper Function (Uses the top-level import - this is fine) ---
const createNamedEntity = (id, nameValue) => {
  const entity = new Entity(id); // Uses the MockEntity

  if (nameValue !== undefined) {
    // Using the top-level import here is okay because this function
    // is defined *after* imports are processed and outside jest.mock factories.
    const typeId = NAME_COMPONENT_ID;
    const data = {value: nameValue};
    entity.addComponent(typeId, data);
  }
  return entity;
};


// --- Test Suite (Should now load and run correctly) ---
describe('findTarget Utility Function', () => {

  // --- Test Data ---
  // createNamedEntity uses the top-level NAME_COMPONENT_TYPE_ID to add the component
  const goblin = createNamedEntity('gob1', 'Goblin');
  const goblinArcher = createNamedEntity('gob2', 'Goblin Archer');
  const orc = createNamedEntity('orc1', 'Orc');
  const goblinChief = createNamedEntity('gob3', 'Goblin Chief');
  const upperGoblin = createNamedEntity('gob4', 'GOBLIN');
  const unnamedEntity = createNamedEntity('unnamed1', undefined);
  const wronglyNamedEntity = createNamedEntity('wrong1', 123);
  const nullNamedEntity = createNamedEntity('nullName', null);

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
    // findTarget uses the *actual* NAME_COMPONENT_TYPE_ID from its import.
    // The MockEntity uses the *same* ID because it was obtained via requireActual.
    // The createNamedEntity helper added the component using the *same* ID via the top-level import.
    // Everything should now be aligned.
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
      const result = findTarget('goblin', standardScope);
      expect(result.status).toBe('FOUND_AMBIGUOUS');
      expect(result.matches).toHaveLength(4);
      expect(result.matches).toContain(goblin);
      expect(result.matches).toContain(goblinArcher);
      expect(result.matches).toContain(goblinChief);
      expect(result.matches).toContain(upperGoblin);
    });

    it('should return FOUND_AMBIGUOUS when multiple entities match exactly (case-insensitive)', () => {
      const entityA = createNamedEntity('g1', 'goblin');
      const entityB = createNamedEntity('g2', 'Goblin');
      const entityC = createNamedEntity('g3', 'GoBlIn');
      const scope = [entityA, entityB, entityC, orc];
      const result = findTarget('gObLiN', scope);
      expect(result.status).toBe('FOUND_AMBIGUOUS');
      expect(result.matches).toHaveLength(3);
      expect(result.matches).toContain(entityA);
      expect(result.matches).toContain(entityB);
      expect(result.matches).toContain(entityC);
      expect(result.matches).not.toContain(orc);
    });

    it('should correctly handle partial matches at start/middle/end', () => {
      const resultStart = findTarget('gob', standardScope);
      expect(resultStart.status).toBe('FOUND_AMBIGUOUS');
      expect(resultStart.matches).toHaveLength(4);

      const resultMiddle = findTarget('blin ar', standardScope);
      expect(resultMiddle.status).toBe('FOUND_UNIQUE');
      expect(resultMiddle.matches).toHaveLength(1);
      expect(resultMiddle.matches).toContain(goblinArcher);

      const resultEnd = findTarget('chief', standardScope);
      expect(resultEnd.status).toBe('FOUND_UNIQUE');
      expect(resultEnd.matches).toHaveLength(1);
      expect(resultEnd.matches).toContain(goblinChief);
    });
  });

  // --- Edge Cases and Robustness ---
  describe('Edge Cases and Robustness', () => {
    it('should ignore entities without a NameComponent', () => {
      const result = findTarget('orc', mixedScope);
      expect(result.status).toBe('FOUND_UNIQUE');
      expect(result.matches).toHaveLength(1);
      expect(result.matches).toContain(orc);
      expect(result.matches).not.toContain(unnamedEntity);
    });

    it('should ignore entities where NameComponent data value is not a string', () => {
      const result = findTarget('goblin', mixedScope);
      expect(result.status).toBe('FOUND_UNIQUE');
      expect(result.matches).toHaveLength(1);
      expect(result.matches).toContain(goblin);
      expect(result.matches).not.toContain(wronglyNamedEntity);
      expect(result.matches).not.toContain(nullNamedEntity);
    });

    it('should ignore entities where NameComponent data value is null', () => {
      const result = findTarget('orc', mixedScope);
      expect(result.status).toBe('FOUND_UNIQUE');
      expect(result.matches).toHaveLength(1);
      expect(result.matches).toContain(orc);
      expect(result.matches).not.toContain(nullNamedEntity);

      const resultNullSearch = findTarget('null', mixedScope);
      expect(resultNullSearch.status).toBe('NOT_FOUND');
    });

    it('should ignore non-object or non-entity-like items in searchScope', () => {
      const messyScope = [
        goblin, null, undefined, 'a string', 12345, {random: 'object'}, orc, {}
      ];
      const result = findTarget('o', messyScope);
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