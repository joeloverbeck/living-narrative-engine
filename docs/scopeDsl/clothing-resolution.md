# Clothing Resolution in Scope DSL

## Enhanced Coverage Resolution

The Scope DSL now supports intelligent clothing coverage resolution that considers items from other slots that cover the target region.

## How It Works

When resolving clothing slots like `torso_lower`, the system:

1. **Collects covering items** from all slots that cover the target region
2. **Collects direct items** from the target slot
3. **Calculates priorities** based on coverage and layer
4. **Applies mode filtering** (e.g., excludes accessories in `no_accessories` mode)
5. **Selects highest priority item** after filtering

## Resolution Examples

### Basic Coverage Resolution

```
Query: actor.clothing.torso_lower
Equipment:
- legs: jeans (covers torso_lower, priority: base)
- torso_lower: panties (direct, priority: underwear)
Result: jeans (base coverage > direct underwear)
```

### Complex Layering

```
Query: actor.clothing.torso_lower
Equipment:
- torso_upper: winter_coat (covers torso_lower, priority: outer)
- legs: jeans (covers torso_lower, priority: base)
- torso_lower: thermal_underwear (direct, priority: underwear)
Result: winter_coat (outer > base > underwear)
```

## Modes and Coverage

Coverage resolution respects all existing resolution modes:

- **`topmost`**: All layers considered, highest priority selected
- **`topmost_no_accessories`**: Accessories excluded from coverage resolution
- **Other modes**: Layer filtering applied after coverage resolution

## Tracing Coverage Resolution

Enable tracing to debug coverage resolution:

```javascript
const trace = {};
const result = scopeEngine.resolve('clothing:target_topmost_torso_lower_clothing', context, trace);

console.log(trace.coverageResolution);
// Shows: candidates, priorities, filtering, selection reasoning
```

## Performance Considerations

- Coverage resolution adds ~20-50% overhead vs legacy resolution
- Caching optimizes repeated priority calculations
- Simple cases (no covering items) use optimized legacy path
- Complex scenarios (10+ items) complete in <50ms