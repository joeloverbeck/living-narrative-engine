# Activity Description System Activation Specification

## Overview

This specification defines the activation of the **Activity Description Composition System** for 16 relationship and positioning components across four mods. The system will generate natural language activity summaries that integrate seamlessly into character body descriptions through the existing anatomy pipeline.

The activity description system discovers metadata from component definitions, ranks activities by priority, applies conditional visibility rules, and composes natural language phrases that appear in the `activity` slot of body descriptions. This spec targets components that represent ongoing interactions and positional states that should be visible in character descriptions.

**Reference Documentation:**
- Activity Description System: `docs/activity-description-system/README.md`
- Architecture: `docs/activity-description-system/architecture.md`
- Metadata Patterns: `docs/activity-description-system/metadata-patterns.md`
- Integration Guide: `docs/activity-description-system/integration-guide.md`

## Scope

### Components to Activate (16 total)

**Companionship Mod (2 components):**
1. `companionship:following` — following another entity
2. `companionship:leading` — being followed by others (derived cache component)

**Hand-Holding Mod (2 components):**
3. `hand-holding:hand_held` — having hand held by another
4. `hand-holding:holding_hand` — holding another's hand

**Kissing Mod (1 component):**
5. `kissing:kissing` — actively kissing another entity

**Positioning Mod (11 components):**
6. `positioning:being_bitten_in_neck` — neck being bitten by another
7. `positioning:being_hugged` — being embraced in a hug
8. `positioning:bending_over` — bending over a surface
9. `positioning:biting_neck` — biting another's neck
10. `positioning:giving_blowjob` — performing oral sex
11. `positioning:hugging` — embracing another entity
12. `positioning:kneeling_before` — **ALREADY ACTIVATED** (reference implementation)
13. `positioning:lying_down` — lying on furniture
14. `positioning:receiving_blowjob` — receiving oral sex
15. `positioning:sitting_on` — sitting on furniture
16. `positioning:straddling_waist` — straddling another entity's waist

### Reference Implementation

`positioning:kneeling_before` already includes complete `activityMetadata` and serves as the canonical example for this activation. All other components should follow the same structure and patterns established there.

## Metadata Authoring Strategy

### Inline Metadata Approach

All 16 components will use **inline metadata** embedded directly in their component schemas. This approach is appropriate because:

1. Each component has a **single, predictable activity phrase** without complex conditional logic
2. The activity **directly corresponds** to the component's lifecycle (add component → activity visible)
3. **No grouping rules** or multi-mode output is required
4. The pattern is **simple and maintainable** within component definitions

### Metadata Field Structure

Each component's `dataSchema.properties` must include an `activityMetadata` object with the following structure:

```json
{
  "activityMetadata": {
    "type": "object",
    "description": "Inline metadata for activity description generation. Allows this component to define how it should be described in activity summaries without requiring a separate metadata component.",
    "additionalProperties": false,
    "properties": {
      "shouldDescribeInActivity": {
        "type": "boolean",
        "default": true,
        "description": "Whether this component should be included in activity descriptions. Set to false to hide from activity summaries."
      },
      "template": {
        "type": "string",
        "default": "[COMPONENT-SPECIFIC TEMPLATE]",
        "description": "Template string with placeholders: {actor} for the entity with this component, {target} for the entity referenced by targetRole property"
      },
      "targetRole": {
        "type": "string",
        "default": "[COMPONENT-SPECIFIC PROPERTY NAME]",
        "description": "Property name in this component's data containing the target entity ID. Defaults to the primary relationship field."
      },
      "priority": {
        "type": "integer",
        "minimum": 0,
        "maximum": 100,
        "default": "[COMPONENT-SPECIFIC PRIORITY]",
        "description": "Display priority for activity ordering. Higher values appear first. Range: 0-100. [Rationale for priority level]"
      }
    }
  }
}
```

## Component-by-Component Specifications

### 1. companionship:following

**Current State:** No `activityMetadata` field

**Target Role Mapping:** `leaderId` (the entity being followed)

**Activity Template:** `{actor} is following {target}`

**Priority:** `60` — Relational state with moderate visibility

**Rationale:** Following is a persistent relationship but not as visually prominent as physical positions. Medium priority ensures it appears after more visually striking states like kneeling or straddling.

**Implementation:**
```json
{
  "activityMetadata": {
    "type": "object",
    "description": "Inline metadata for activity description generation. Allows this component to define how it should be described in activity summaries without requiring a separate metadata component.",
    "additionalProperties": false,
    "properties": {
      "shouldDescribeInActivity": {
        "type": "boolean",
        "default": true,
        "description": "Whether this component should be included in activity descriptions. Set to false to hide from activity summaries."
      },
      "template": {
        "type": "string",
        "default": "{actor} is following {target}",
        "description": "Template string with placeholders: {actor} for the entity with this component, {target} for the entity referenced by targetRole property"
      },
      "targetRole": {
        "type": "string",
        "default": "leaderId",
        "description": "Property name in this component's data containing the target entity ID. Defaults to 'leaderId' for the entity being followed."
      },
      "priority": {
        "type": "integer",
        "minimum": 0,
        "maximum": 100,
        "default": 60,
        "description": "Display priority for activity ordering. Higher values appear first. Range: 0-100. Medium priority (60) for relational state with moderate visibility."
      }
    }
  }
}
```

### 2. companionship:leading

**Current State:** No `activityMetadata` field (derived cache component)

**Special Consideration:** This is a derived cache component that lists followers in an array. Since it doesn't reference a single target, it requires special handling.

**Target Role Mapping:** `followers[0]` (first follower in array) or special handling for multiple followers

**Activity Template:** `{actor} is leading {target}` (for single follower) or `{actor} is leading a group` (for multiple)

**Priority:** `58` — Slightly lower than following to avoid duplicate mentions

**Rationale:** Leading is the inverse relationship of following. Lower priority ensures that if both entities are visible, we prefer to describe from the follower's perspective to avoid redundancy.

**Implementation:**
```json
{
  "activityMetadata": {
    "type": "object",
    "description": "Inline metadata for activity description generation. Allows this component to define how it should be described in activity summaries without requiring a separate metadata component.",
    "additionalProperties": false,
    "properties": {
      "shouldDescribeInActivity": {
        "type": "boolean",
        "default": true,
        "description": "Whether this component should be included in activity descriptions. Set to false to hide from activity summaries."
      },
      "template": {
        "type": "string",
        "default": "{actor} is leading others",
        "description": "Template string with placeholders: {actor} for the entity with this component. Note: This is an array-based component, so template uses generic phrasing."
      },
      "targetRole": {
        "type": "string",
        "default": "followers",
        "description": "Property name in this component's data containing follower IDs. This is an array field requiring special handling by the activity service."
      },
      "priority": {
        "type": "integer",
        "minimum": 0,
        "maximum": 100,
        "default": 58,
        "description": "Display priority for activity ordering. Higher values appear first. Range: 0-100. Slightly lower than 'following' (58) to prefer describing from follower's perspective and avoid redundancy."
      }
    }
  }
}
```

**Note:** The activity service may need enhancement to handle array-based `targetRole` fields. For the initial implementation, the template uses generic phrasing without a specific target.

### 3. hand-holding:hand_held

**Current State:** No `activityMetadata` field

**Target Role Mapping:** `holding_entity_id` (the entity holding the hand)

**Activity Template:** `{actor}'s hand is being held by {target}`

**Priority:** `65` — Intimate physical contact with good visibility

**Rationale:** Hand-holding is a visible, intimate gesture that should be prominent in descriptions but lower than more dramatic positions like kneeling or straddling.

**Implementation:**
```json
{
  "activityMetadata": {
    "type": "object",
    "description": "Inline metadata for activity description generation. Allows this component to define how it should be described in activity summaries without requiring a separate metadata component.",
    "additionalProperties": false,
    "properties": {
      "shouldDescribeInActivity": {
        "type": "boolean",
        "default": true,
        "description": "Whether this component should be included in activity descriptions. Set to false to hide from activity summaries."
      },
      "template": {
        "type": "string",
        "default": "{actor}'s hand is being held by {target}",
        "description": "Template string with placeholders: {actor} for the entity with this component, {target} for the entity referenced by targetRole property"
      },
      "targetRole": {
        "type": "string",
        "default": "holding_entity_id",
        "description": "Property name in this component's data containing the target entity ID. Defaults to 'holding_entity_id' for the entity holding the hand."
      },
      "priority": {
        "type": "integer",
        "minimum": 0,
        "maximum": 100,
        "default": 65,
        "description": "Display priority for activity ordering. Higher values appear first. Range: 0-100. Moderate-high priority (65) for intimate physical contact with good visibility."
      }
    }
  }
}
```

### 4. hand-holding:holding_hand

**Current State:** No `activityMetadata` field

**Target Role Mapping:** `held_entity_id` (the entity whose hand is held)

**Activity Template:** `{actor} is holding {target}'s hand`

**Priority:** `67` — Active role, slightly higher than passive

**Rationale:** Holding someone's hand is the active side of the interaction. Slightly higher priority than being held ensures the active initiator's description takes precedence in activity ordering.

**Implementation:**
```json
{
  "activityMetadata": {
    "type": "object",
    "description": "Inline metadata for activity description generation. Allows this component to define how it should be described in activity summaries without requiring a separate metadata component.",
    "additionalProperties": false,
    "properties": {
      "shouldDescribeInActivity": {
        "type": "boolean",
        "default": true,
        "description": "Whether this component should be included in activity descriptions. Set to false to hide from activity summaries."
      },
      "template": {
        "type": "string",
        "default": "{actor} is holding {target}'s hand",
        "description": "Template string with placeholders: {actor} for the entity with this component, {target} for the entity referenced by targetRole property"
      },
      "targetRole": {
        "type": "string",
        "default": "held_entity_id",
        "description": "Property name in this component's data containing the target entity ID. Defaults to 'held_entity_id' for the entity whose hand is held."
      },
      "priority": {
        "type": "integer",
        "minimum": 0,
        "maximum": 100,
        "default": 67,
        "description": "Display priority for activity ordering. Higher values appear first. Range: 0-100. Active role priority (67) slightly higher than passive 'hand_held' to prefer initiator's perspective."
      }
    }
  }
}
```

### 5. kissing:kissing

**Current State:** No `activityMetadata` field

**Target Role Mapping:** `partner` (the entity being kissed)

**Activity Template:** `{actor} is kissing {target}`

**Priority:** `72` — Highly intimate and visually prominent

**Rationale:** Kissing is a prominent intimate act that should rank higher than hand-holding but below dramatic positional states like straddling or kneeling.

**Implementation:**
```json
{
  "activityMetadata": {
    "type": "object",
    "description": "Inline metadata for activity description generation. Allows this component to define how it should be described in activity summaries without requiring a separate metadata component.",
    "additionalProperties": false,
    "properties": {
      "shouldDescribeInActivity": {
        "type": "boolean",
        "default": true,
        "description": "Whether this component should be included in activity descriptions. Set to false to hide from activity summaries."
      },
      "template": {
        "type": "string",
        "default": "{actor} is kissing {target}",
        "description": "Template string with placeholders: {actor} for the entity with this component, {target} for the entity referenced by targetRole property"
      },
      "targetRole": {
        "type": "string",
        "default": "partner",
        "description": "Property name in this component's data containing the target entity ID. Defaults to 'partner' for the entity being kissed."
      },
      "priority": {
        "type": "integer",
        "minimum": 0,
        "maximum": 100,
        "default": 72,
        "description": "Display priority for activity ordering. Higher values appear first. Range: 0-100. High priority (72) for highly intimate and visually prominent interaction."
      }
    }
  }
}
```

### 6. positioning:being_bitten_in_neck

**Current State:** No `activityMetadata` field

**Target Role Mapping:** `biting_entity_id` (the entity biting the neck)

**Activity Template:** `{actor}'s neck is being bitten by {target}`

**Priority:** `70` — Intimate and dramatic passive state

**Rationale:** Neck biting is a highly intimate, dramatic interaction. Passive recipient role gets slightly lower priority than the active biter.

**Implementation:**
```json
{
  "activityMetadata": {
    "type": "object",
    "description": "Inline metadata for activity description generation. Allows this component to define how it should be described in activity summaries without requiring a separate metadata component.",
    "additionalProperties": false,
    "properties": {
      "shouldDescribeInActivity": {
        "type": "boolean",
        "default": true,
        "description": "Whether this component should be included in activity descriptions. Set to false to hide from activity summaries."
      },
      "template": {
        "type": "string",
        "default": "{actor}'s neck is being bitten by {target}",
        "description": "Template string with placeholders: {actor} for the entity with this component, {target} for the entity referenced by targetRole property"
      },
      "targetRole": {
        "type": "string",
        "default": "biting_entity_id",
        "description": "Property name in this component's data containing the target entity ID. Defaults to 'biting_entity_id' for the entity biting the neck."
      },
      "priority": {
        "type": "integer",
        "minimum": 0,
        "maximum": 100,
        "default": 70,
        "description": "Display priority for activity ordering. Higher values appear first. Range: 0-100. High priority (70) for intimate and dramatic passive state."
      }
    }
  }
}
```

### 7. positioning:being_hugged

**Current State:** No `activityMetadata` field

**Target Role Mapping:** `hugging_entity_id` (the entity doing the hugging)

**Activity Template:** `{actor} is being hugged by {target}`

**Priority:** `63` — Passive intimate embrace

**Rationale:** Being hugged is the passive side of an embrace. Lower priority than the active hugger ensures we prefer the initiator's perspective.

**Implementation:**
```json
{
  "activityMetadata": {
    "type": "object",
    "description": "Inline metadata for activity description generation. Allows this component to define how it should be described in activity summaries without requiring a separate metadata component.",
    "additionalProperties": false,
    "properties": {
      "shouldDescribeInActivity": {
        "type": "boolean",
        "default": true,
        "description": "Whether this component should be included in activity descriptions. Set to false to hide from activity summaries."
      },
      "template": {
        "type": "string",
        "default": "{actor} is being hugged by {target}",
        "description": "Template string with placeholders: {actor} for the entity with this component, {target} for the entity referenced by targetRole property"
      },
      "targetRole": {
        "type": "string",
        "default": "hugging_entity_id",
        "description": "Property name in this component's data containing the target entity ID. Defaults to 'hugging_entity_id' for the entity doing the hugging."
      },
      "priority": {
        "type": "integer",
        "minimum": 0,
        "maximum": 100,
        "default": 63,
        "description": "Display priority for activity ordering. Higher values appear first. Range: 0-100. Moderate priority (63) for passive intimate embrace, lower than active 'hugging'."
      }
    }
  }
}
```

### 8. positioning:bending_over

**Current State:** No `activityMetadata` field

**Target Role Mapping:** `surface_id` (the surface being bent over)

**Activity Template:** `{actor} is bending over {target}`

**Priority:** `68` — Noticeable positional state

**Rationale:** Bending over is a distinctive body position that should be visible but ranks below more intimate interactions.

**Implementation:**
```json
{
  "activityMetadata": {
    "type": "object",
    "description": "Inline metadata for activity description generation. Allows this component to define how it should be described in activity summaries without requiring a separate metadata component.",
    "additionalProperties": false,
    "properties": {
      "shouldDescribeInActivity": {
        "type": "boolean",
        "default": true,
        "description": "Whether this component should be included in activity descriptions. Set to false to hide from activity summaries."
      },
      "template": {
        "type": "string",
        "default": "{actor} is bending over {target}",
        "description": "Template string with placeholders: {actor} for the entity with this component, {target} for the entity referenced by targetRole property"
      },
      "targetRole": {
        "type": "string",
        "default": "surface_id",
        "description": "Property name in this component's data containing the target entity ID. Defaults to 'surface_id' for the surface being bent over."
      },
      "priority": {
        "type": "integer",
        "minimum": 0,
        "maximum": 100,
        "default": 68,
        "description": "Display priority for activity ordering. Higher values appear first. Range: 0-100. Moderate-high priority (68) for noticeable positional state."
      }
    }
  }
}
```

### 9. positioning:biting_neck

**Current State:** No `activityMetadata` field

**Target Role Mapping:** `bitten_entity_id` (the entity whose neck is being bitten)

**Activity Template:** `{actor} is biting {target}'s neck`

**Priority:** `73` — Active intimate and dramatic

**Rationale:** Actively biting someone's neck is a highly intimate, dominant action. Higher priority than the passive recipient.

**Implementation:**
```json
{
  "activityMetadata": {
    "type": "object",
    "description": "Inline metadata for activity description generation. Allows this component to define how it should be described in activity summaries without requiring a separate metadata component.",
    "additionalProperties": false,
    "properties": {
      "shouldDescribeInActivity": {
        "type": "boolean",
        "default": true,
        "description": "Whether this component should be included in activity descriptions. Set to false to hide from activity summaries."
      },
      "template": {
        "type": "string",
        "default": "{actor} is biting {target}'s neck",
        "description": "Template string with placeholders: {actor} for the entity with this component, {target} for the entity referenced by targetRole property"
      },
      "targetRole": {
        "type": "string",
        "default": "bitten_entity_id",
        "description": "Property name in this component's data containing the target entity ID. Defaults to 'bitten_entity_id' for the entity whose neck is being bitten."
      },
      "priority": {
        "type": "integer",
        "minimum": 0,
        "maximum": 100,
        "default": 73,
        "description": "Display priority for activity ordering. Higher values appear first. Range: 0-100. High priority (73) for active intimate and dramatic interaction."
      }
    }
  }
}
```

### 10. positioning:giving_blowjob

**Current State:** No `activityMetadata` field

**Target Role Mapping:** `receiving_entity_id` (the entity receiving oral sex)

**Activity Template:** `{actor} is performing oral sex on {target}`

**Priority:** `80` — Highly explicit sexual act

**Rationale:** Sexual activities are among the most prominent states and should rank very high in activity descriptions.

**Implementation:**
```json
{
  "activityMetadata": {
    "type": "object",
    "description": "Inline metadata for activity description generation. Allows this component to define how it should be described in activity summaries without requiring a separate metadata component.",
    "additionalProperties": false,
    "properties": {
      "shouldDescribeInActivity": {
        "type": "boolean",
        "default": true,
        "description": "Whether this component should be included in activity descriptions. Set to false to hide from activity summaries."
      },
      "template": {
        "type": "string",
        "default": "{actor} is performing oral sex on {target}",
        "description": "Template string with placeholders: {actor} for the entity with this component, {target} for the entity referenced by targetRole property"
      },
      "targetRole": {
        "type": "string",
        "default": "receiving_entity_id",
        "description": "Property name in this component's data containing the target entity ID. Defaults to 'receiving_entity_id' for the entity receiving oral sex."
      },
      "priority": {
        "type": "integer",
        "minimum": 0,
        "maximum": 100,
        "default": 80,
        "description": "Display priority for activity ordering. Higher values appear first. Range: 0-100. Very high priority (80) for highly explicit sexual act."
      }
    }
  }
}
```

### 11. positioning:hugging

**Current State:** No `activityMetadata` field

**Target Role Mapping:** `embraced_entity_id` (the entity being hugged)

**Activity Template:** `{actor} is hugging {target}`

**Priority:** `66` — Active intimate embrace

**Rationale:** Actively hugging someone is the initiator role. Higher priority than being hugged ensures we prefer the active perspective.

**Implementation:**
```json
{
  "activityMetadata": {
    "type": "object",
    "description": "Inline metadata for activity description generation. Allows this component to define how it should be described in activity summaries without requiring a separate metadata component.",
    "additionalProperties": false,
    "properties": {
      "shouldDescribeInActivity": {
        "type": "boolean",
        "default": true,
        "description": "Whether this component should be included in activity descriptions. Set to false to hide from activity summaries."
      },
      "template": {
        "type": "string",
        "default": "{actor} is hugging {target}",
        "description": "Template string with placeholders: {actor} for the entity with this component, {target} for the entity referenced by targetRole property"
      },
      "targetRole": {
        "type": "string",
        "default": "embraced_entity_id",
        "description": "Property name in this component's data containing the target entity ID. Defaults to 'embraced_entity_id' for the entity being hugged."
      },
      "priority": {
        "type": "integer",
        "minimum": 0,
        "maximum": 100,
        "default": 66,
        "description": "Display priority for activity ordering. Higher values appear first. Range: 0-100. Moderate-high priority (66) for active intimate embrace."
      }
    }
  }
}
```

### 12. positioning:kneeling_before

**Current State:** **ALREADY ACTIVATED** ✅

This component serves as the reference implementation. All metadata fields are already present and correctly configured:
- Template: `{actor} is kneeling before {target}`
- TargetRole: `entityId`
- Priority: `75`

**No changes required.** Other components should follow this pattern.

### 13. positioning:lying_down

**Current State:** No `activityMetadata` field

**Target Role Mapping:** `furniture_id` (the furniture being lain upon)

**Activity Template:** `{actor} is lying on {target}`

**Priority:** `64` — Passive positional state

**Rationale:** Lying down is a notable position but less visually dramatic than kneeling or straddling. Medium priority.

**Implementation:**
```json
{
  "activityMetadata": {
    "type": "object",
    "description": "Inline metadata for activity description generation. Allows this component to define how it should be described in activity summaries without requiring a separate metadata component.",
    "additionalProperties": false,
    "properties": {
      "shouldDescribeInActivity": {
        "type": "boolean",
        "default": true,
        "description": "Whether this component should be included in activity descriptions. Set to false to hide from activity summaries."
      },
      "template": {
        "type": "string",
        "default": "{actor} is lying on {target}",
        "description": "Template string with placeholders: {actor} for the entity with this component, {target} for the entity referenced by targetRole property"
      },
      "targetRole": {
        "type": "string",
        "default": "furniture_id",
        "description": "Property name in this component's data containing the target entity ID. Defaults to 'furniture_id' for the furniture being lain upon."
      },
      "priority": {
        "type": "integer",
        "minimum": 0,
        "maximum": 100,
        "default": 64,
        "description": "Display priority for activity ordering. Higher values appear first. Range: 0-100. Moderate priority (64) for passive positional state."
      }
    }
  }
}
```

### 14. positioning:receiving_blowjob

**Current State:** No `activityMetadata` field

**Target Role Mapping:** `giving_entity_id` (the entity performing oral sex)

**Activity Template:** `{actor} is receiving oral sex from {target}`

**Priority:** `78` — Passive sexual act, slightly lower than active

**Rationale:** Receiving oral sex is the passive side of the interaction. Slightly lower priority than the active performer.

**Implementation:**
```json
{
  "activityMetadata": {
    "type": "object",
    "description": "Inline metadata for activity description generation. Allows this component to define how it should be described in activity summaries without requiring a separate metadata component.",
    "additionalProperties": false,
    "properties": {
      "shouldDescribeInActivity": {
        "type": "boolean",
        "default": true,
        "description": "Whether this component should be included in activity descriptions. Set to false to hide from activity summaries."
      },
      "template": {
        "type": "string",
        "default": "{actor} is receiving oral sex from {target}",
        "description": "Template string with placeholders: {actor} for the entity with this component, {target} for the entity referenced by targetRole property"
      },
      "targetRole": {
        "type": "string",
        "default": "giving_entity_id",
        "description": "Property name in this component's data containing the target entity ID. Defaults to 'giving_entity_id' for the entity performing oral sex."
      },
      "priority": {
        "type": "integer",
        "minimum": 0,
        "maximum": 100,
        "default": 78,
        "description": "Display priority for activity ordering. Higher values appear first. Range: 0-100. High priority (78) for passive sexual act, slightly lower than active 'giving_blowjob'."
      }
    }
  }
}
```

### 15. positioning:sitting_on

**Current State:** No `activityMetadata` field

**Target Role Mapping:** `furniture_id` (the furniture being sat upon)

**Activity Template:** `{actor} is sitting on {target}`

**Priority:** `62` — Common passive positional state

**Rationale:** Sitting is a very common position. Lower priority than more distinctive positions like kneeling or lying.

**Implementation:**
```json
{
  "activityMetadata": {
    "type": "object",
    "description": "Inline metadata for activity description generation. Allows this component to define how it should be described in activity summaries without requiring a separate metadata component.",
    "additionalProperties": false,
    "properties": {
      "shouldDescribeInActivity": {
        "type": "boolean",
        "default": true,
        "description": "Whether this component should be included in activity descriptions. Set to false to hide from activity summaries."
      },
      "template": {
        "type": "string",
        "default": "{actor} is sitting on {target}",
        "description": "Template string with placeholders: {actor} for the entity with this component, {target} for the entity referenced by targetRole property"
      },
      "targetRole": {
        "type": "string",
        "default": "furniture_id",
        "description": "Property name in this component's data containing the target entity ID. Defaults to 'furniture_id' for the furniture being sat upon."
      },
      "priority": {
        "type": "integer",
        "minimum": 0,
        "maximum": 100,
        "default": 62,
        "description": "Display priority for activity ordering. Higher values appear first. Range: 0-100. Moderate priority (62) for common passive positional state."
      }
    }
  }
}
```

### 16. positioning:straddling_waist

**Current State:** No `activityMetadata` field

**Target Role Mapping:** `target_id` (the entity being straddled)

**Special Consideration:** This component has a `facing_away` boolean field that affects the interaction semantics. The basic template doesn't distinguish orientation, but future enhancements could use conditional metadata for orientation-specific phrasing.

**Activity Template:** `{actor} is straddling {target}'s waist`

**Priority:** `82` — Highly intimate and visually prominent position

**Rationale:** Straddling is a very intimate, dominant position with high visual prominence. Should rank among the highest priorities.

**Implementation:**
```json
{
  "activityMetadata": {
    "type": "object",
    "description": "Inline metadata for activity description generation. Allows this component to define how it should be described in activity summaries without requiring a separate metadata component.",
    "additionalProperties": false,
    "properties": {
      "shouldDescribeInActivity": {
        "type": "boolean",
        "default": true,
        "description": "Whether this component should be included in activity descriptions. Set to false to hide from activity summaries."
      },
      "template": {
        "type": "string",
        "default": "{actor} is straddling {target}'s waist",
        "description": "Template string with placeholders: {actor} for the entity with this component, {target} for the entity referenced by targetRole property"
      },
      "targetRole": {
        "type": "string",
        "default": "target_id",
        "description": "Property name in this component's data containing the target entity ID. Defaults to 'target_id' for the entity being straddled."
      },
      "priority": {
        "type": "integer",
        "minimum": 0,
        "maximum": 100,
        "default": 82,
        "description": "Display priority for activity ordering. Higher values appear first. Range: 0-100. Very high priority (82) for highly intimate and visually prominent position."
      }
    }
  }
}
```

**Future Enhancement Opportunity:** Could use dedicated metadata components with conditional logic to distinguish "straddling waist facing toward" vs "straddling waist facing away" based on the `facing_away` property.

## Priority Distribution Summary

**Priority Range Analysis (0-100 scale):**

| Priority Range | Category | Components |
|----------------|----------|------------|
| **80-100** | Highly explicit sexual acts, dramatic positions | straddling_waist (82), giving_blowjob (80), receiving_blowjob (78) |
| **70-79** | Highly intimate interactions | kneeling_before (75), biting_neck (73), kissing (72), being_bitten_in_neck (70) |
| **60-69** | Moderate intimate interactions, visible positions | bending_over (68), holding_hand (67), hugging (66), hand_held (65), lying_down (64), being_hugged (63), sitting_on (62), following (60) |
| **50-59** | Relational states, less visible positions | leading (58) |

**Priority Pairing Logic:**
- Active/passive pairs have 2-3 point differentials (e.g., giving_blowjob:80 vs receiving_blowjob:78)
- Bilateral symmetrical pairs have small differentials to reflect initiator preference (e.g., hugging:66 vs being_hugged:63)
- Inverse relationships have larger differentials to avoid redundancy (e.g., following:60 vs leading:58)

## Implementation Workflow

### Phase 1: Component Schema Updates

For each of the 15 components requiring activation (all except `positioning:kneeling_before`):

1. **Locate the component file** in `data/mods/{mod-name}/components/{component-name}.component.json`
2. **Add the `activityMetadata` property** to the `dataSchema.properties` object
3. **Use the exact JSON structure** specified in the component's individual section above
4. **Validate the schema** against `schema://living-narrative-engine/component.schema.json`
5. **Commit changes** with descriptive message: `Add activity metadata to {component-name}`

### Phase 2: Integration Testing

After schema updates are complete:

1. **Verify `AnatomyFormattingService` initialization** includes activity integration config
2. **Confirm `BodyDescriptionComposer`** has `activity` slot in description order
3. **Test `ActivityDescriptionService`** discovers inline metadata from all 16 components
4. **Validate priority ordering** produces expected activity sequence
5. **Check template rendering** with pronoun substitution and name resolution

### Phase 3: System Validation

1. **Unit tests** for component schema validation (ensure activityMetadata conforms to spec)
2. **Integration tests** for activity description generation:
   - Single component active → correct template rendered
   - Multiple components → correct priority ordering
   - Target resolution → proper entity name/pronoun substitution
   - Cache invalidation → stale activity cleared on component changes
3. **End-to-end tests** for full body description composition with activities

## Testing Requirements

### Unit Tests

**Component Schema Validation** (`tests/unit/schemas/activityMetadata.test.js`):
```javascript
describe('Activity Metadata Schema Validation', () => {
  const componentsToTest = [
    'companionship:following',
    'companionship:leading',
    'hand-holding:hand_held',
    'hand-holding:holding_hand',
    'kissing:kissing',
    'positioning:being_bitten_in_neck',
    'positioning:being_hugged',
    'positioning:bending_over',
    'positioning:biting_neck',
    'positioning:giving_blowjob',
    'positioning:hugging',
    'positioning:lying_down',
    'positioning:receiving_blowjob',
    'positioning:sitting_on',
    'positioning:straddling_waist'
  ];

  componentsToTest.forEach(componentId => {
    it(`should have valid activityMetadata in ${componentId}`, () => {
      // Load component schema
      // Validate activityMetadata structure
      // Assert all required fields present
      // Assert priority in valid range (0-100)
      // Assert template contains {actor} placeholder
      // Assert targetRole matches a property in dataSchema
    });
  });
});
```

### Integration Tests

**Activity Description Generation** (`tests/integration/anatomy/activityDescriptionActivation.test.js`):
```javascript
describe('Activity Description System Activation', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  it('should generate activity descriptions for all activated components', async () => {
    // For each component, create entity with component
    // Generate activity description
    // Assert expected template output
    // Assert priority ordering when multiple components present
  });

  it('should properly resolve target entity names and pronouns', async () => {
    // Create actor with activityMetadata component
    // Create target entity with name
    // Generate activity description
    // Assert {target} replaced with actual name
  });

  it('should invalidate cache when components are added/removed', async () => {
    // Generate description, cache result
    // Add new component
    // Assert cache invalidated
    // Assert new description includes new component
  });
});
```

### End-to-End Tests

**Full Body Description Composition** (`tests/e2e/anatomy/activityInBodyDescription.test.js`):
```javascript
describe('Activity Integration in Body Descriptions', () => {
  it('should include activity section in body description', async () => {
    // Create entity with anatomy:body and activity components
    // Generate full body description via BodyDescriptionComposer
    // Assert 'Activity:' prefix present
    // Assert activity text appears in expected position
    // Assert formatting matches anatomy pipeline conventions
  });
});
```

## Acceptance Criteria

### Component Schemas ✓
- [ ] All 15 components have `activityMetadata` field in their schemas
- [ ] All metadata fields conform to the specification structure
- [ ] All templates include `{actor}` placeholder
- [ ] All templates reference valid `{target}` via targetRole
- [ ] All priorities are in range 0-100
- [ ] All schemas validate against component.schema.json

### Activity Generation ✓
- [ ] ActivityDescriptionService discovers inline metadata from all components
- [ ] Priority ordering produces expected sequence (highest to lowest)
- [ ] Templates render with proper entity name/pronoun substitution
- [ ] Multiple activities compose correctly with configured separator
- [ ] Activity slot integrates seamlessly into body descriptions

### Testing Coverage ✓
- [ ] Unit tests validate all component schemas
- [ ] Integration tests cover activity generation for all components
- [ ] Integration tests verify priority ordering
- [ ] Integration tests confirm cache invalidation
- [ ] End-to-end tests validate full pipeline integration

### Documentation ✓
- [ ] This specification document is complete and accurate
- [ ] Component changes are documented in commit messages
- [ ] Architecture documentation references activation

## Future Enhancement Opportunities

### Conditional Templates

Some components could benefit from dedicated metadata with conditional logic:

1. **positioning:straddling_waist** — Different templates based on `facing_away`:
   - `facing_away: false` → "{actor} is straddling {target}'s waist face-to-face"
   - `facing_away: true` → "{actor} is straddling {target}'s waist while facing away"

2. **companionship:leading** — Handle multiple followers gracefully:
   - Single follower → "{actor} is leading {target}"
   - Multiple followers → "{actor} is leading {count} followers"

3. **hand-holding/hugging pairs** — Suppress duplicate mentions:
   - If both entities have reciprocal components, show only higher priority version
   - Requires conditional visibility logic in dedicated metadata

### Grouping Rules

Related activities could be grouped for more natural phrasing:

- **Sexual activity grouping:** Combine `giving_blowjob` + other sexual components
- **Intimate contact grouping:** Combine `kissing` + `hugging` + `holding_hand`
- **Positional grouping:** Combine `sitting_on` + `lying_down` when on same furniture

These enhancements would require dedicated `activity:description_metadata` components with `grouping` configuration.

## Migration Notes

### For Mod Authors

When updating existing mods:

1. **Backup component files** before modification
2. **Add activityMetadata incrementally** (one component at a time)
3. **Test each component** individually before proceeding
4. **Coordinate priorities** with other mods to avoid conflicts

### For Core System

No core system changes required. All functionality exists in the activity description system as designed. This specification activates existing capabilities through metadata authoring.

## References

**Documentation:**
- Activity Description System README: `docs/activity-description-system/README.md`
- Metadata Patterns Guide: `docs/activity-description-system/metadata-patterns.md`
- Architecture Overview: `docs/activity-description-system/architecture.md`
- Integration Guide: `docs/activity-description-system/integration-guide.md`

**Reference Implementation:**
- `data/mods/positioning/components/kneeling_before.component.json` — Complete example

**Related Specs:**
- None (this is a foundational activation spec)

**Test Locations:**
- Unit tests: `tests/unit/schemas/`, `tests/unit/anatomy/services/`
- Integration tests: `tests/integration/anatomy/`
- End-to-end tests: `tests/e2e/anatomy/`
