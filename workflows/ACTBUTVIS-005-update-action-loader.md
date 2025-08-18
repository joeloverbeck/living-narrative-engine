# ACTBUTVIS-005: Update Action Loader for Visual Properties

## Status
**Status**: Not Started  
**Priority**: High  
**Type**: Loader Enhancement  
**Estimated Effort**: 2-3 hours  

## Dependencies
- **Requires**: Visual properties are already in action.schema.json
- **Blocks**: ACTBUTVIS-006 (Factory), ACTBUTVIS-011 (Integration Tests)

## Context
The ActionLoader currently uses the SimpleItemLoader base class which automatically handles loading and validation through the standard pipeline. Visual properties are already defined in the action schema and will be automatically validated and stored. However, we need to:
1. Create a visual properties validator for additional runtime validation
2. Override the `_processFetchedItem` method if special visual property handling is needed
3. Add logging for visual properties

## Objectives
1. Create visual properties validator utility
2. Optionally enhance ActionLoader with visual property awareness
3. Ensure visual data flows through properly (already handled by base class)
4. Add appropriate logging for debugging

## Implementation Details

### File Modifications

#### 1. Create Visual Properties Validator
**File**: `src/validation/visualPropertiesValidator.js` (NEW)

```javascript
/**
 * @file Visual properties validation utility
 */

import { validateColor } from '../utils/colorValidation.js';

/**
 * Validates visual properties for actions
 * @param {object} visual - Visual properties object
 * @param {string} actionId - Action ID for logging
 * @returns {object} Validated visual properties
 * @throws {Error} If visual properties are invalid
 */
export function validateVisualProperties(visual, actionId) {
  if (!visual || typeof visual !== 'object') {
    throw new Error(`Invalid visual properties for action ${actionId}`);
  }

  const validated = {};

  // Validate each color property if present
  const colorProps = [
    'backgroundColor',
    'textColor',
    'hoverBackgroundColor',
    'hoverTextColor'
  ];

  for (const prop of colorProps) {
    if (visual[prop]) {
      if (!validateColor(visual[prop])) {
        throw new Error(`Invalid ${prop} for action ${actionId}: ${visual[prop]}`);
      }
      validated[prop] = visual[prop];
    }
  }

  return validated;
}
```

#### 2. Create Color Validation Utility
**File**: `src/utils/colorValidation.js` (NEW)

```javascript
/**
 * @file Color validation utilities
 */

const COLOR_PATTERN = /^(#([0-9A-Fa-f]{3}){1,2}|rgb\(\s*(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\s*,\s*(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\s*,\s*(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\s*\)|rgba\(\s*(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\s*,\s*(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\s*,\s*(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\s*,\s*(0|0\.[0-9]+|1(\.0+)?)\s*\)|(aliceblue|antiquewhite|aqua|aquamarine|azure|beige|bisque|black|blanchedalmond|blue|blueviolet|brown|burlywood|cadetblue|chartreuse|chocolate|coral|cornflowerblue|cornsilk|crimson|cyan|darkblue|darkcyan|darkgoldenrod|darkgray|darkgrey|darkgreen|darkkhaki|darkmagenta|darkolivegreen|darkorange|darkorchid|darkred|darksalmon|darkseagreen|darkslateblue|darkslategray|darkslategrey|darkturquoise|darkviolet|deeppink|deepskyblue|dimgray|dimgrey|dodgerblue|firebrick|floralwhite|forestgreen|fuchsia|gainsboro|ghostwhite|gold|goldenrod|gray|grey|green|greenyellow|honeydew|hotpink|indianred|indigo|ivory|khaki|lavender|lavenderblush|lawngreen|lemonchiffon|lightblue|lightcoral|lightcyan|lightgoldenrodyellow|lightgray|lightgrey|lightgreen|lightpink|lightsalmon|lightseagreen|lightskyblue|lightslategray|lightslategrey|lightsteelblue|lightyellow|lime|limegreen|linen|magenta|maroon|mediumaquamarine|mediumblue|mediumorchid|mediumpurple|mediumseagreen|mediumslateblue|mediumspringgreen|mediumturquoise|mediumvioletred|midnightblue|mintcream|mistyrose|moccasin|navajowhite|navy|oldlace|olive|olivedrab|orange|orangered|orchid|palegoldenrod|palegreen|paleturquoise|palevioletred|papayawhip|peachpuff|peru|pink|plum|powderblue|purple|red|rosybrown|royalblue|saddlebrown|salmon|sandybrown|seagreen|seashell|sienna|silver|skyblue|slateblue|slategray|slategrey|snow|springgreen|steelblue|tan|teal|thistle|tomato|turquoise|violet|wheat|white|whitesmoke|yellow|yellowgreen))$/;

/**
 * Validates a CSS color value
 * @param {string} color - Color value to validate
 * @returns {boolean} True if valid
 */
export function validateColor(color) {
  if (typeof color !== 'string') return false;
  return COLOR_PATTERN.test(color);
}
```

#### 3. Optionally Enhance ActionLoader (if special handling needed)
**File**: `src/loaders/actionLoader.js`

The current implementation already handles visual properties correctly through the schema validation. If additional logging is desired:

```javascript
/**
 * @file Defines the ActionLoader class, responsible for loading
 * action definitions from mods based on the manifest.
 */

import { SimpleItemLoader } from './simpleItemLoader.js';

/** @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../interfaces/coreServices.js').IPathResolver} IPathResolver */
/** @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

/**
 * Loads action definitions from mods.
 */
class ActionLoader extends SimpleItemLoader {
  /**
   * @param {IConfiguration} config - Configuration service instance.
   * @param {IPathResolver} pathResolver - Path resolution service instance.
   * @param {IDataFetcher} dataFetcher - Data fetching service instance.
   * @param {ISchemaValidator} schemaValidator - Schema validation service instance.
   * @param {IDataRegistry} dataRegistry - Data registry service instance.
   * @param {ILogger} logger - Logging service instance.
   */
  constructor(
    config,
    pathResolver,
    dataFetcher,
    schemaValidator,
    dataRegistry,
    logger
  ) {
    super(
      'actions',
      config,
      pathResolver,
      dataFetcher,
      schemaValidator,
      dataRegistry,
      logger
    );
  }

  /**
   * Override to add visual properties logging
   * @protected
   * @override
   * @async
   */
  async _processFetchedItem(modId, filename, resolvedPath, data, registryKey) {
    // Call parent implementation
    const result = await super._processFetchedItem(
      modId,
      filename,
      resolvedPath,
      data,
      registryKey
    );

    // Add visual properties logging if present
    if (data.visual) {
      this._logger.debug(
        `Action ${result.qualifiedId} loaded with visual properties:`,
        data.visual
      );
    }

    return result;
  }

  /**
   * Override to provide summary of visual properties
   * @public
   * @async
   */
  async loadItemsForMod(modId, modManifest, contentKey, diskFolder, registryKey) {
    const result = await super.loadItemsForMod(
      modId,
      modManifest,
      contentKey,
      diskFolder,
      registryKey
    );

    // Count actions with visual properties
    const actionsKey = `${registryKey}.${modId}`;
    const actions = this._dataRegistry.getAll(actionsKey) || [];
    const visualCount = actions.filter(a => a.visual).length;

    if (visualCount > 0) {
      this._logger.info(
        `${visualCount} actions from mod '${modId}' have visual customization properties.`
      );
    }

    return result;
  }
}

export default ActionLoader;
```

### Testing Requirements

#### Unit Tests
**File**: `tests/unit/loaders/actionLoader.test.js` (ENHANCE EXISTING)

Add tests for visual properties:

```javascript
describe('ActionLoader - Visual Properties', () => {
  it('should load action with valid visual properties', async () => {
    const mockDataFetcher = createMockDataFetcher({
      fetch: jest.fn().mockResolvedValue({
        id: 'test_action',
        name: 'Test Action',
        description: 'Test description',
        template: 'test {target}',
        targets: 'none',
        visual: {
          backgroundColor: '#ff0000',
          textColor: '#ffffff'
        }
      })
    });

    const loader = new ActionLoader(
      mockConfig,
      mockPathResolver,
      mockDataFetcher,
      mockSchemaValidator,
      mockDataRegistry,
      mockLogger
    );

    const manifest = {
      content: {
        actions: ['test_action.json']
      }
    };

    await loader.loadItemsForMod('test_mod', manifest, 'actions', 'actions', 'actions');

    // Verify store was called with visual properties
    expect(mockDataRegistry.store).toHaveBeenCalledWith(
      'actions',
      'test_mod:test_action',
      expect.objectContaining({
        visual: {
          backgroundColor: '#ff0000',
          textColor: '#ffffff'
        }
      })
    );
  });

  it('should handle actions without visual properties', async () => {
    const mockDataFetcher = createMockDataFetcher({
      fetch: jest.fn().mockResolvedValue({
        id: 'test_action',
        name: 'Test Action',
        description: 'Test description',
        template: 'test {target}',
        targets: 'none'
        // No visual property
      })
    });

    const loader = new ActionLoader(
      mockConfig,
      mockPathResolver,
      mockDataFetcher,
      mockSchemaValidator,
      mockDataRegistry,
      mockLogger
    );

    const manifest = {
      content: {
        actions: ['test_action.json']
      }
    };

    await loader.loadItemsForMod('test_mod', manifest, 'actions', 'actions', 'actions');

    // Should still store the action
    expect(mockDataRegistry.store).toHaveBeenCalled();
  });
});
```

## Acceptance Criteria

1. ✅ ActionLoader preserves visual properties from JSON files (automatic via SimpleItemLoader)
2. ✅ Visual properties are validated during load (via schema validation)
3. ✅ Invalid visual properties are caught by schema validation
4. ✅ Visual properties are stored in the data registry (automatic)
5. ✅ Optional: Loader logs visual property information
6. ✅ Schema validation handles invalid visual properties
7. ✅ Optional: Batch loading reports visual properties count
8. ✅ Unit tests verify visual property scenarios
9. ✅ Backward compatibility maintained (automatic)

## Notes

- The current architecture already handles visual properties correctly through the schema validation pipeline
- Additional validation utilities are optional but recommended for runtime validation
- The SimpleItemLoader base class automatically handles storage and validation
- Visual properties are already defined in action.schema.json

## Related Tickets
- **Schema**: Visual properties already in action.schema.json
- **Next**: ACTBUTVIS-006 (Factory integration)
- **Testing**: ACTBUTVIS-010 (Unit tests), ACTBUTVIS-011 (Integration tests)

## References
- Action Loader: `src/loaders/actionLoader.js`
- Base Loader: `src/loaders/simpleItemLoader.js` → `src/loaders/baseManifestItemLoader.js`
- Action Schema: `data/schemas/action.schema.json` (already includes visual properties)
- Original Spec: `specs/action-button-visual-customization.spec.md`