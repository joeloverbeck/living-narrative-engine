# ANABLUNONHUM-022: Create Example Entity Definitions for Non-Human Parts

**Phase**: 5 - Example Content
**Priority**: Medium
**Estimated Effort**: 8-10 hours
**Dependencies**: ANABLUNONHUM-021

## Overview

Create body part entity definitions for non-human creatures (spider legs, dragon wings, tentacles, etc.) with proper socket components.

## Deliverables

### Spider Parts
- `spider_cephalothorax.entity.json` (root with 8 leg sockets, 2 pedipalp sockets, 1 abdomen socket)
- `spider_leg.entity.json`
- `spider_pedipalp.entity.json`
- `spider_abdomen.entity.json`

### Dragon Parts
- `dragon_torso.entity.json` (root with 4 leg sockets, 2 wing sockets, neck, tail sockets)
- `dragon_leg.entity.json`
- `dragon_wing.entity.json`
- `dragon_tail.entity.json`
- `dragon_head.entity.json`

### Octopoid Parts
- `kraken_mantle.entity.json` (root with 8 tentacle sockets, head socket)
- `kraken_tentacle.entity.json`
- `kraken_head.entity.json`

## Socket Component Format

Each root entity must define sockets matching template pattern:

```json
{
  "id": "anatomy:spider_cephalothorax",
  "components": {
    "anatomy:part": { "partType": "cephalothorax" },
    "anatomy:sockets": {
      "sockets": [
        {"id": "leg_1", "orientation": "position_1", "allowedTypes": ["leg", "arachnid_leg"]},
        {"id": "leg_2", "orientation": "position_2", "allowedTypes": ["leg", "arachnid_leg"]},
        // ... 8 total
        {"id": "pedipalp_1", "allowedTypes": ["pedipalp"]},
        {"id": "posterior_abdomen", "allowedTypes": ["abdomen"]}
      ]
    }
  }
}
```

## Validation

- All entities pass schema validation
- Socket IDs match template patterns
- Components properly defined
- Integration test with blueprints

## References

- **Source**: `reports/anatomy-blueprint-non-human-architecture.md` Section 5
