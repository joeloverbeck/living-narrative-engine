# Added 'lissom' Build Descriptor to Anatomy System

## Summary

Successfully added 'lissom' as a new build descriptor option for the anatomy system.

## Changes Made

### 1. Schema Updates

- **data/schemas/anatomy.recipe.schema.json**: Added 'lissom' to the build enum (line 143)
- **data/mods/anatomy/components/body.component.json**: Added 'lissom' to the build enum (line 43)

### 2. Constants Update

- **src/anatomy/constants/bodyDescriptorConstants.js**: Added `LISSOM: 'lissom'` to BODY_BUILD_TYPES (line 12)

### 3. Test Updates

- **tests/unit/anatomy/workflows/anatomyGenerationWorkflow.test.js**:
  - Updated error message to include 'lissom' (line 463)
  - Added 'lissom' to validBuilds test array (line 529)
- **tests/unit/schemas/anatomy.recipe.schema.test.js**: Added 'lissom' to builds test array (line 348)
- **tests/unit/anatomy/components/bodyComponent.test.js**: Added 'lissom' to buildValues test array (line 129)

## Validation

- All unit tests pass
- All integration tests pass
- The validation system automatically uses the constants, so no additional validation code changes were needed
- 'lissom' is now available as a valid build descriptor throughout the anatomy system

## Notes

- 'lissom' means gracefully thin and supple, fitting well between 'slim' and 'toned' in the build progression
- The build descriptor is used in both anatomy recipes (initial configuration) and body components (generated anatomy)
- Both schemas must stay in sync for proper validation
