# CLIGEN-001: Database Schema Extension & Model Creation

## Summary

Extend the IndexedDB schema to support cliché storage and create the Cliche model with comprehensive validation. This ticket establishes the foundational data layer for the Clichés Generator feature, including database schema modifications, model definition, and data validation rules.

## Status

- **Type**: Implementation
- **Priority**: High (Critical Path)
- **Complexity**: Medium
- **Estimated Time**: 4 hours
- **Dependencies**: None (First ticket in sequence)

## Objectives

### Primary Goals

1. **Extend Database Schema** - Add cliches store to IndexedDB
2. **Create Cliche Model** - Define data structure with validation
3. **Implement Indexes** - Ensure efficient data retrieval
4. **Add Validation Rules** - Enforce data integrity
5. **Create Type Definitions** - JSDoc types for IDE support
6. **Setup Migrations** - Handle schema versioning

### Success Criteria

- [ ] Database schema includes cliches store
- [ ] One-to-one relationship enforced via unique index
- [ ] Cliche model validates all required fields
- [ ] Type definitions provide full IDE support
- [ ] Migration handles existing databases gracefully
- [ ] All database operations < 50ms
- [ ] Unit tests achieve 100% coverage

## Technical Specification

### 1. Database Schema Extension

#### File: `src/characterBuilder/storage/character-database.js`

```javascript
/**
 * Extend existing database configuration
 * Current version: 1, will increment to 2
 */

// Add to existing stores array in CharacterDatabase class
class CharacterDatabase {
  #dbName = 'CharacterBuilderDB';
  #version = 2; // Increment from 1 to 2
  
  async #initializeDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.#dbName, this.#version);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const oldVersion = event.oldVersion;
        
        // Existing stores (version 1)
        if (oldVersion < 1) {
          // Create existing stores
          this.#createCharacterConceptsStore(db);
          this.#createThematicDirectionsStore(db);
          this.#createMetadataStore(db);
        }
        
        // New cliches store (version 2)
        if (oldVersion < 2) {
          this.#createClichesStore(db);
        }
      };
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Create cliches object store
   * @private
   */
  #createClichesStore(db) {
    if (!db.objectStoreNames.contains('cliches')) {
      const store = db.createObjectStore('cliches', { 
        keyPath: 'id' 
      });
      
      // Unique index for one-to-one relationship with directions
      store.createIndex('directionId', 'directionId', { 
        unique: true 
      });
      
      // Non-unique index for concept tracking
      store.createIndex('conceptId', 'conceptId', { 
        unique: false 
      });
      
      // Index for chronological queries
      store.createIndex('createdAt', 'createdAt', { 
        unique: false 
      });
      
      // Composite index for concept + direction queries
      store.createIndex('conceptDirection', ['conceptId', 'directionId'], {
        unique: true
      });
    }
  }
}
```

### 2. Cliche Model Definition

#### File: `src/characterBuilder/models/cliche.js`

```javascript
/**
 * @file Cliche model for storing common tropes and stereotypes
 * @see characterConcept.js
 * @see thematicDirection.js
 */

import { v4 as uuidv4 } from 'uuid';
import { assertNonBlankString, assertPresent } from '../../utils/validationUtils.js';

/**
 * @typedef {object} ClicheCategories
 * @property {string[]} names - Common/overused character names
 * @property {string[]} physicalDescriptions - Clichéd physical traits
 * @property {string[]} personalityTraits - Overused personality traits
 * @property {string[]} skillsAbilities - Common skills/abilities
 * @property {string[]} typicalLikes - Predictable likes/interests
 * @property {string[]} typicalDislikes - Common dislikes
 * @property {string[]} commonFears - Overused fears
 * @property {string[]} genericGoals - Predictable goals/motivations
 * @property {string[]} backgroundElements - Clichéd backstory elements
 * @property {string[]} overusedSecrets - Common secrets/reveals
 * @property {string[]} speechPatterns - Overused catchphrases/patterns
 */

/**
 * @typedef {object} LLMMetadata
 * @property {string} model - LLM model used for generation
 * @property {number} temperature - Temperature setting used
 * @property {number} tokens - Token count for generation
 * @property {number} responseTime - Generation time in ms
 * @property {string} promptVersion - Version of prompt used
 */

/**
 * @typedef {object} Cliche
 * @property {string} id - Unique identifier (UUID)
 * @property {string} directionId - Reference to parent ThematicDirection
 * @property {string} conceptId - Reference to original CharacterConcept
 * @property {ClicheCategories} categories - Categorized clichés
 * @property {string[]} tropesAndStereotypes - Overall narrative patterns
 * @property {string} createdAt - ISO timestamp of creation
 * @property {LLMMetadata} llmMetadata - Generation metadata
 */

/**
 * Cliche model class with validation
 */
export class Cliche {
  /**
   * Create a new Cliche instance
   * @param {object} data - Cliche data
   * @returns {Cliche} Validated cliche instance
   */
  constructor(data = {}) {
    this.#validate(data);
    
    this.id = data.id || uuidv4();
    this.directionId = data.directionId;
    this.conceptId = data.conceptId;
    this.categories = this.#validateCategories(data.categories);
    this.tropesAndStereotypes = data.tropesAndStereotypes || [];
    this.createdAt = data.createdAt || new Date().toISOString();
    this.llmMetadata = data.llmMetadata || {};
    
    // Freeze to prevent mutation
    Object.freeze(this);
    Object.freeze(this.categories);
    Object.freeze(this.tropesAndStereotypes);
    Object.freeze(this.llmMetadata);
  }
  
  /**
   * Validate required fields
   * @private
   */
  #validate(data) {
    assertPresent(data, 'Cliche data is required');
    assertNonBlankString(data.directionId, 'Direction ID is required');
    assertNonBlankString(data.conceptId, 'Concept ID is required');
    assertPresent(data.categories, 'Categories are required');
  }
  
  /**
   * Validate and normalize categories
   * @private
   */
  #validateCategories(categories) {
    const requiredCategories = [
      'names',
      'physicalDescriptions',
      'personalityTraits',
      'skillsAbilities',
      'typicalLikes',
      'typicalDislikes',
      'commonFears',
      'genericGoals',
      'backgroundElements',
      'overusedSecrets',
      'speechPatterns'
    ];
    
    const validated = {};
    
    for (const category of requiredCategories) {
      if (!Array.isArray(categories[category])) {
        validated[category] = [];
      } else {
        // Filter out empty strings and ensure all are strings
        validated[category] = categories[category]
          .filter(item => typeof item === 'string' && item.trim())
          .map(item => item.trim());
      }
    }
    
    return validated;
  }
  
  /**
   * Create from raw data with validation
   * @param {object} rawData - Raw data from storage or API
   * @returns {Cliche} Cliche instance
   */
  static fromRawData(rawData) {
    return new Cliche(rawData);
  }
  
  /**
   * Convert to plain object for storage
   * @returns {object} Plain object representation
   */
  toJSON() {
    return {
      id: this.id,
      directionId: this.directionId,
      conceptId: this.conceptId,
      categories: { ...this.categories },
      tropesAndStereotypes: [...this.tropesAndStereotypes],
      createdAt: this.createdAt,
      llmMetadata: { ...this.llmMetadata }
    };
  }
  
  /**
   * Get total cliché count across all categories
   * @returns {number} Total number of clichés
   */
  getTotalCount() {
    let count = this.tropesAndStereotypes.length;
    
    for (const category of Object.values(this.categories)) {
      count += category.length;
    }
    
    return count;
  }
  
  /**
   * Get category statistics
   * @returns {object} Count per category
   */
  getCategoryStats() {
    const stats = {};
    
    for (const [name, items] of Object.entries(this.categories)) {
      stats[name] = items.length;
    }
    
    stats.tropesAndStereotypes = this.tropesAndStereotypes.length;
    stats.total = this.getTotalCount();
    
    return stats;
  }
  
  /**
   * Check if cliché data is empty
   * @returns {boolean} True if no clichés present
   */
  isEmpty() {
    return this.getTotalCount() === 0;
  }
  
  /**
   * Get formatted display data
   * @returns {object} Formatted for UI display
   */
  getDisplayData() {
    return {
      categories: this.#formatCategoriesForDisplay(),
      tropesAndStereotypes: this.tropesAndStereotypes,
      metadata: {
        createdAt: new Date(this.createdAt).toLocaleDateString(),
        totalCount: this.getTotalCount(),
        model: this.llmMetadata.model || 'Unknown'
      }
    };
  }
  
  /**
   * Format categories with human-readable names
   * @private
   */
  #formatCategoriesForDisplay() {
    const displayNames = {
      names: 'Common Names',
      physicalDescriptions: 'Physical Descriptions',
      personalityTraits: 'Personality Traits',
      skillsAbilities: 'Skills & Abilities',
      typicalLikes: 'Typical Likes',
      typicalDislikes: 'Typical Dislikes',
      commonFears: 'Common Fears',
      genericGoals: 'Generic Goals',
      backgroundElements: 'Background Elements',
      overusedSecrets: 'Overused Secrets',
      speechPatterns: 'Speech Patterns'
    };
    
    const formatted = [];
    
    for (const [key, items] of Object.entries(this.categories)) {
      if (items.length > 0) {
        formatted.push({
          id: key,
          title: displayNames[key] || key,
          items: items,
          count: items.length
        });
      }
    }
    
    return formatted;
  }
}

export default Cliche;
```

### 3. Model Validation Schema

#### File: `src/characterBuilder/models/schemas/clicheSchema.js`

```javascript
/**
 * JSON Schema for Cliche model validation
 * Used with AJV for runtime validation
 */

export const clicheSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: ['directionId', 'conceptId', 'categories'],
  properties: {
    id: {
      type: 'string',
      pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
      description: 'UUID v4'
    },
    directionId: {
      type: 'string',
      minLength: 1,
      description: 'Reference to ThematicDirection'
    },
    conceptId: {
      type: 'string',
      minLength: 1,
      description: 'Reference to CharacterConcept'
    },
    categories: {
      type: 'object',
      required: [
        'names',
        'physicalDescriptions',
        'personalityTraits',
        'skillsAbilities',
        'typicalLikes',
        'typicalDislikes',
        'commonFears',
        'genericGoals',
        'backgroundElements',
        'overusedSecrets',
        'speechPatterns'
      ],
      properties: {
        names: { $ref: '#/definitions/stringArray' },
        physicalDescriptions: { $ref: '#/definitions/stringArray' },
        personalityTraits: { $ref: '#/definitions/stringArray' },
        skillsAbilities: { $ref: '#/definitions/stringArray' },
        typicalLikes: { $ref: '#/definitions/stringArray' },
        typicalDislikes: { $ref: '#/definitions/stringArray' },
        commonFears: { $ref: '#/definitions/stringArray' },
        genericGoals: { $ref: '#/definitions/stringArray' },
        backgroundElements: { $ref: '#/definitions/stringArray' },
        overusedSecrets: { $ref: '#/definitions/stringArray' },
        speechPatterns: { $ref: '#/definitions/stringArray' }
      },
      additionalProperties: false
    },
    tropesAndStereotypes: {
      type: 'array',
      items: { type: 'string' },
      description: 'Overall narrative patterns to avoid'
    },
    createdAt: {
      type: 'string',
      format: 'date-time',
      description: 'ISO 8601 timestamp'
    },
    llmMetadata: {
      type: 'object',
      properties: {
        model: { type: 'string' },
        temperature: { type: 'number', minimum: 0, maximum: 2 },
        tokens: { type: 'integer', minimum: 0 },
        responseTime: { type: 'number', minimum: 0 },
        promptVersion: { type: 'string' }
      },
      additionalProperties: true
    }
  },
  definitions: {
    stringArray: {
      type: 'array',
      items: {
        type: 'string',
        minLength: 1
      }
    }
  },
  additionalProperties: false
};

export default clicheSchema;
```

### 4. Database Migration Handler

#### File: `src/characterBuilder/storage/migrations/v2-add-cliches.js`

```javascript
/**
 * Migration to add cliches store (v1 -> v2)
 */

export class ClichesMigration {
  static version = 2;
  static fromVersion = 1;
  
  /**
   * Run migration
   * @param {IDBDatabase} db - Database instance
   * @param {IDBTransaction} transaction - Upgrade transaction
   */
  static async migrate(db, transaction) {
    console.log('Running migration: Adding cliches store (v1 -> v2)');
    
    try {
      // Create new store if it doesn't exist
      if (!db.objectStoreNames.contains('cliches')) {
        const store = db.createObjectStore('cliches', {
          keyPath: 'id'
        });
        
        // Create indexes
        store.createIndex('directionId', 'directionId', { unique: true });
        store.createIndex('conceptId', 'conceptId', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('conceptDirection', ['conceptId', 'directionId'], {
          unique: true
        });
        
        console.log('Cliches store created successfully');
      }
      
      // Update metadata store with migration info
      const metadataStore = transaction.objectStore('metadata');
      await metadataStore.put({
        key: 'migration_v2',
        value: {
          version: 2,
          migratedAt: new Date().toISOString(),
          description: 'Added cliches store for anti-pattern tracking'
        }
      });
      
      return true;
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  }
  
  /**
   * Rollback migration (if needed)
   * @param {IDBDatabase} db - Database instance
   */
  static async rollback(db) {
    // Note: IndexedDB doesn't support dropping stores in a version change
    // This would require opening a new version
    console.warn('Rollback not supported for IndexedDB migrations');
  }
  
  /**
   * Verify migration completed successfully
   * @param {IDBDatabase} db - Database instance
   * @returns {boolean} True if migration successful
   */
  static async verify(db) {
    return db.objectStoreNames.contains('cliches');
  }
}

export default ClichesMigration;
```

## Implementation Tasks

### Phase 1: Database Schema (1 hour)

1. **Backup existing database structure**
   - [ ] Document current schema
   - [ ] Create rollback plan
   - [ ] Test in development environment

2. **Implement schema changes**
   - [ ] Update CharacterDatabase class
   - [ ] Add version increment
   - [ ] Create cliches store
   - [ ] Add all indexes

3. **Test database upgrade**
   - [ ] Test fresh install
   - [ ] Test upgrade from v1
   - [ ] Verify indexes work

### Phase 2: Model Implementation (1.5 hours)

1. **Create Cliche model**
   - [ ] Implement constructor
   - [ ] Add validation methods
   - [ ] Create utility methods
   - [ ] Add display formatters

2. **Add type definitions**
   - [ ] JSDoc type definitions
   - [ ] Category type definitions
   - [ ] Metadata type definitions

3. **Implement model methods**
   - [ ] toJSON serialization
   - [ ] fromRawData factory
   - [ ] Statistics methods
   - [ ] Display helpers

### Phase 3: Validation Schema (1 hour)

1. **Create JSON schema**
   - [ ] Define all properties
   - [ ] Add validation rules
   - [ ] Create shared definitions
   - [ ] Test with AJV

2. **Integrate with validator**
   - [ ] Register schema
   - [ ] Create validation helper
   - [ ] Add error formatting

### Phase 4: Migration Handler (30 minutes)

1. **Create migration class**
   - [ ] Implement migrate method
   - [ ] Add verification
   - [ ] Create logging
   - [ ] Handle errors

2. **Test migration**
   - [ ] Test on empty database
   - [ ] Test on existing data
   - [ ] Verify rollback plan

## Testing Requirements

### Unit Tests

#### File: `tests/unit/characterBuilder/models/cliche.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { Cliche } from '../../../../src/characterBuilder/models/cliche.js';

describe('Cliche Model', () => {
  let validData;
  
  beforeEach(() => {
    validData = {
      directionId: 'dir-123',
      conceptId: 'concept-456',
      categories: {
        names: ['John', 'Mary'],
        physicalDescriptions: ['Tall, dark, handsome'],
        personalityTraits: ['Brooding'],
        skillsAbilities: ['Master swordsman'],
        typicalLikes: ['Justice'],
        typicalDislikes: ['Injustice'],
        commonFears: ['Losing loved ones'],
        genericGoals: ['Save the world'],
        backgroundElements: ['Orphaned as a child'],
        overusedSecrets: ['Secret royal bloodline'],
        speechPatterns: ['...']
      },
      tropesAndStereotypes: ['The Chosen One']
    };
  });
  
  describe('Constructor', () => {
    it('should create valid cliche with all fields', () => {
      const cliche = new Cliche(validData);
      
      expect(cliche.directionId).toBe('dir-123');
      expect(cliche.conceptId).toBe('concept-456');
      expect(cliche.categories.names).toEqual(['John', 'Mary']);
      expect(cliche.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
    });
    
    it('should validate required fields', () => {
      expect(() => new Cliche({})).toThrow();
      expect(() => new Cliche({ directionId: '' })).toThrow();
      expect(() => new Cliche({ conceptId: '' })).toThrow();
    });
    
    it('should normalize category arrays', () => {
      validData.categories.names = ['  John  ', '', '  '];
      const cliche = new Cliche(validData);
      
      expect(cliche.categories.names).toEqual(['John']);
    });
    
    it('should freeze object to prevent mutation', () => {
      const cliche = new Cliche(validData);
      
      expect(() => {
        cliche.directionId = 'new-id';
      }).toThrow();
      
      expect(() => {
        cliche.categories.names.push('New Name');
      }).toThrow();
    });
  });
  
  describe('Utility Methods', () => {
    it('should calculate total count correctly', () => {
      const cliche = new Cliche(validData);
      const count = cliche.getTotalCount();
      
      expect(count).toBe(12); // 11 categories + 1 trope
    });
    
    it('should generate category statistics', () => {
      const cliche = new Cliche(validData);
      const stats = cliche.getCategoryStats();
      
      expect(stats.names).toBe(2);
      expect(stats.total).toBe(12);
    });
    
    it('should detect empty clichés', () => {
      validData.categories = {
        names: [],
        physicalDescriptions: [],
        personalityTraits: [],
        skillsAbilities: [],
        typicalLikes: [],
        typicalDislikes: [],
        commonFears: [],
        genericGoals: [],
        backgroundElements: [],
        overusedSecrets: [],
        speechPatterns: []
      };
      validData.tropesAndStereotypes = [];
      
      const cliche = new Cliche(validData);
      expect(cliche.isEmpty()).toBe(true);
    });
  });
  
  describe('Serialization', () => {
    it('should convert to JSON', () => {
      const cliche = new Cliche(validData);
      const json = cliche.toJSON();
      
      expect(json).toEqual(expect.objectContaining({
        directionId: 'dir-123',
        conceptId: 'concept-456',
        categories: expect.any(Object)
      }));
    });
    
    it('should create from raw data', () => {
      const cliche = Cliche.fromRawData(validData);
      
      expect(cliche).toBeInstanceOf(Cliche);
      expect(cliche.directionId).toBe('dir-123');
    });
  });
  
  describe('Display Formatting', () => {
    it('should format for display', () => {
      const cliche = new Cliche(validData);
      const display = cliche.getDisplayData();
      
      expect(display.categories).toBeInstanceOf(Array);
      expect(display.categories[0]).toHaveProperty('title');
      expect(display.metadata.totalCount).toBe(12);
    });
  });
});
```

### Integration Tests

#### File: `tests/integration/characterBuilder/storage/clicheStorage.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { CharacterDatabase } from '../../../../src/characterBuilder/storage/character-database.js';
import { Cliche } from '../../../../src/characterBuilder/models/cliche.js';

describe('Cliche Storage Integration', () => {
  let db;
  
  beforeEach(async () => {
    // Use in-memory database for tests
    db = new CharacterDatabase({ dbName: 'TestDB' });
    await db.initialize();
  });
  
  afterEach(async () => {
    await db.clear();
    await db.close();
  });
  
  describe('Store Operations', () => {
    it('should store and retrieve cliche', async () => {
      const cliche = new Cliche({
        directionId: 'dir-1',
        conceptId: 'concept-1',
        categories: { /* ... */ }
      });
      
      await db.store('cliches', cliche.toJSON());
      const retrieved = await db.getByIndex('cliches', 'directionId', 'dir-1');
      
      expect(retrieved.directionId).toBe('dir-1');
    });
    
    it('should enforce unique directionId constraint', async () => {
      const cliche1 = new Cliche({
        directionId: 'dir-1',
        conceptId: 'concept-1',
        categories: { /* ... */ }
      });
      
      const cliche2 = new Cliche({
        directionId: 'dir-1', // Same direction ID
        conceptId: 'concept-2',
        categories: { /* ... */ }
      });
      
      await db.store('cliches', cliche1.toJSON());
      
      await expect(
        db.store('cliches', cliche2.toJSON())
      ).rejects.toThrow();
    });
  });
  
  describe('Index Queries', () => {
    it('should query by conceptId', async () => {
      // Store multiple clichés for same concept
      await db.store('cliches', {
        id: '1',
        directionId: 'dir-1',
        conceptId: 'concept-1',
        categories: { /* ... */ }
      });
      
      await db.store('cliches', {
        id: '2',
        directionId: 'dir-2',
        conceptId: 'concept-1',
        categories: { /* ... */ }
      });
      
      const results = await db.getAllByIndex('cliches', 'conceptId', 'concept-1');
      expect(results).toHaveLength(2);
    });
  });
});
```

## Error Handling

### Common Errors

1. **Duplicate Direction ID**
   - Error: ConstraintError
   - Message: "Clichés already exist for this direction"
   - Recovery: Load existing clichés instead

2. **Invalid Model Data**
   - Error: ValidationError
   - Message: Specific field validation message
   - Recovery: Show validation errors to user

3. **Database Upgrade Failure**
   - Error: VersionError
   - Message: "Failed to upgrade database schema"
   - Recovery: Retry or fresh install

## Performance Considerations

### Optimization Strategies

1. **Index Usage**
   - Use directionId index for lookups
   - Composite index for complex queries
   - Avoid full table scans

2. **Data Size Management**
   - Limit array sizes in categories
   - Implement pagination if needed
   - Consider data compression

3. **Caching Strategy**
   - Cache frequently accessed clichés
   - Invalidate on updates
   - Memory-aware cache size

## Security Considerations

1. **Input Validation**
   - Validate all data before storage
   - Sanitize string inputs
   - Prevent injection attacks

2. **Data Integrity**
   - Enforce referential integrity
   - Validate foreign keys exist
   - Maintain data consistency

## Dependencies

### Internal Dependencies
- CharacterDatabase class
- Validation utilities
- UUID generation

### External Dependencies
- IndexedDB API
- uuid package

## Risks and Mitigation

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Schema migration fails | Low | High | Comprehensive testing, rollback plan |
| Data corruption | Low | High | Validation, backups |
| Performance degradation | Low | Medium | Indexes, optimization |
| Browser compatibility | Low | Low | IndexedDB widely supported |

## Acceptance Criteria

- [ ] Database schema successfully extended
- [ ] Cliche model fully implemented
- [ ] All validation rules enforced
- [ ] Unique constraint on directionId works
- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] Performance benchmarks met
- [ ] Documentation complete

## Definition of Done

- [ ] Code implemented according to specification
- [ ] Unit tests written and passing (100% coverage)
- [ ] Integration tests passing
- [ ] Code reviewed and approved
- [ ] Documentation updated
- [ ] No critical bugs
- [ ] Performance requirements met
- [ ] Security review completed