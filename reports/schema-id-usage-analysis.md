# Schema ID Usage Analysis Report

## Executive Summary

This report documents how JSON Schema IDs using the placeholder domain `http://example.com/schemas/` are utilized throughout the Living Narrative Engine codebase. The analysis reveals that these IDs are deeply integrated into the validation system and would require systematic changes across multiple layers of the application.

## Current Schema ID Format

All 67 schema files in `data/schemas/` use the following ID pattern:

```json
"$id": "http://example.com/schemas/[schema-name].schema.json"
```

## Schema Files Overview

### Root Level Schemas (24 files)

- `action.schema.json`
- `action-result.schema.json`
- `anatomy-formatting.schema.json`
- `anatomy.blueprint.schema.json`
- `anatomy.blueprint-part.schema.json`
- `anatomy.recipe.schema.json`
- `anatomy.slot-library.schema.json`
- `base-operation.schema.json`
- `common.schema.json`
- `component.schema.json`
- `condition.schema.json`
- `condition-container.schema.json`
- `entity-definition.schema.json`
- `entity-instance.schema.json`
- `event.schema.json`
- `game.schema.json`
- `goal.schema.json`
- `json-logic.schema.json`
- `llm-configs.schema.json`
- `macro.schema.json`
- `mod-manifest.schema.json`
- `operation.schema.json`
- `prompt-text.schema.json`
- `rule.schema.json`
- `ui-icons.schema.json`
- `ui-labels.schema.json`
- `world.schema.json`

### Operation Schemas (43 files in `operations/` subdirectory)

All operation schemas follow the same pattern with IDs like:

```json
"$id": "http://example.com/schemas/operations/[operation-name].schema.json"
```

## How Schema IDs Are Used

### 1. Schema Definition (`$id` property)

**Location**: All schema files  
**Purpose**: Unique identifier for each schema  
**Example**:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "http://example.com/schemas/component.schema.json",
  "title": "Component Definition"
}
```

### 2. Cross-Schema References (`$ref` property)

**Location**: Schema files with dependencies  
**Purpose**: Reference definitions from other schemas  
**Example**:

```json
{
  "properties": {
    "id": {
      "$ref": "http://example.com/schemas/common.schema.json#/definitions/namespacedId"
    }
  }
}
```

### 3. Content Type Mapping

**Location**: `src/configuration/staticConfiguration.js` (lines 134-165)  
**Purpose**: Maps content registry keys to their schema IDs  
**Implementation**:

```javascript
getContentTypeSchemaId(registryKey) {
  const map = {
    components: 'http://example.com/schemas/component.schema.json',
    actions: 'http://example.com/schemas/action.schema.json',
    events: 'http://example.com/schemas/event.schema.json',
    // ... etc
  };
  return map[registryKey];
}
```

### 4. Schema Loading Process

**Location**: `src/loaders/schemaLoader.js`  
**Purpose**: Extract and validate schema IDs during loading  
**Key Operations**:

- Line 122: Extract `$id` from loaded schema data
- Lines 123-127: Validate that `$id` exists
- Line 134: Register schemas with AJV using their IDs

### 5. AJV Schema Registration

**Location**: `src/validation/ajvSchemaValidator.js`  
**Purpose**: Register and retrieve schemas for validation  
**Key Methods**:

- `addSchema(schemaData, schemaId)`: Registers schema with its ID
- `getSchema(schemaId)`: Retrieves compiled validator by ID
- `isSchemaLoaded(schemaId)`: Checks if schema is registered

### 6. Runtime Validation

**Location**: Multiple loaders and validators  
**Purpose**: Validate content against schemas  
**Usage Pattern**:

```javascript
validateAgainstSchema(validator, schemaId, data, logger, context);
```

### 7. Test Assertions

**Location**: Various test files  
**Purpose**: Verify schema loading and validation  
**Example**:

```javascript
expect(
  validator.isSchemaLoaded('http://example.com/schemas/component.schema.json')
).toBe(true);
```

## File References

### Source Files Using Schema IDs (2 primary files)

1. `src/configuration/staticConfiguration.js` - Hardcoded schema ID mappings
2. `src/loaders/schemaLoader.js` - Schema loading and ID extraction

### Files with Schema URL References (394 total)

- All 67 schema files (using `$id`)
- Content definition files using `$schema` property
- Test files verifying schema functionality
- Documentation and report files

## Cross-Reference Analysis

### Common Reference Patterns

1. **Component definitions referencing common.schema.json**:
   - `namespacedId` definition
   - `BaseDefinition` properties
   - `entityReference` types

2. **Event/Action files referencing component.schema.json**:
   - Using schema for validation
   - Extending base definitions

3. **Operation schemas referencing base-operation.schema.json**:
   - Inheriting common operation properties
   - Validation patterns

## Impact of Changing Schema IDs

### High Impact Areas

1. **Static Configuration**: Direct string literals must be updated
2. **Schema Files**: All `$id` properties need modification
3. **Cross-References**: All `$ref` URLs must be updated
4. **Test Files**: Hardcoded schema ID assertions

### Low Impact Areas

1. **Schema Loading Logic**: Uses extracted IDs, not hardcoded
2. **Validation Logic**: References schemas by loaded ID
3. **Runtime Operations**: Work with registered schemas

## Recommendations for ID Change

### Option 1: Local URI Scheme

Replace with: `schema://living-narrative-engine/[schema-name].schema.json`

- Pros: Clearly local, no domain confusion
- Cons: Non-standard URI scheme

### Option 2: URN Format

Replace with: `urn:living-narrative-engine:schema:[schema-name]`

- Pros: Standard URN format, clearly not a URL
- Cons: Less familiar to developers

### Option 3: Tag URI

Replace with: `tag:living-narrative-engine,2025:schemas/[schema-name]`

- Pros: RFC 4151 standard, includes version/date
- Cons: More complex format

### Option 4: Relative IDs

Replace with: `/schemas/[schema-name].schema.json`

- Pros: Simple, clearly relative
- Cons: May cause issues with some validators

## Technical Considerations

1. **AJV Compatibility**: Ensure chosen format works with AJV validator
2. **JSON Schema Spec**: Verify compliance with JSON Schema draft-07
3. **Cross-Reference Resolution**: Test that `$ref` resolution works correctly
4. **Backward Compatibility**: Consider migration strategy for existing data

## Conclusion

The schema IDs are deeply integrated into the validation system through:

- Direct usage in 67 schema files
- Hardcoded mappings in configuration
- Cross-references between schemas
- Test assertions and validations

Any change to the ID format will require:

1. Updating all schema files
2. Modifying static configuration mappings
3. Updating all cross-references
4. Adjusting test expectations
5. Thorough testing of the validation system

The most critical files to update are:

- `src/configuration/staticConfiguration.js` (ID mappings)
- All files in `data/schemas/` (schema definitions)
- Any content files with explicit `$schema` references
