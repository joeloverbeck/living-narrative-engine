# Registrar Copperplate Character Implementation Specification

## Overview

This specification documents the implementation of Registrar Copperplate, a 312-year-old tortoise-person character for the Living Narrative Engine's fantasy mod. The character serves as Mudbrook's Registry Master and embodies bureaucratic permanence operating on geological time scales.

**Target Mod**: `fantasy`
**Anatomy Recipe**: `anatomy:tortoise_person`
**Character ID**: `fantasy:registrar_copperplate`

## Character Concept

### Core Identity

Registrar Copperplate is an ancient tortoise-person who has served as Mudbrook's Registry Master for the past 147 years. He is the living embodiment of bureaucratic permanence in a world of fleeting mammalian drama—a being who operates on geological time scales attempting to manage creatures who live and die in what feels to him like hurried gasps.

### Physical Characteristics

- **Species**: Tortoise-person (upright bipedal tortoise)
- **Height**: 4'2" tall (short by humanoid standards)
- **Age**: 312 years old (middle-aged for his species)
- **Shell**: Massive, dark amber-brown carapace with growth rings
- **Skin**: Wrinkled, leathery green-grey texture
- **Eyes**: Slow-blinking amber eyes with nictitating membranes
- **Features**: No visible ears, pronounced beak-like mouth
- **Claws**: Ink-stained from decades of paperwork
- **Movement**: Every gesture takes 3-4 times longer than a human's; his head turns like a siege tower rotating

### Attire

1. **Fitted Waistcoat** - Professional garment, only part visible when withdrawn into shell
2. **Sleeve Cuffs** - Formal cuffs visible at arm openings
3. **Reading Spectacles** - Small spectacles perched on his beak
4. **Ink Stains** - Claws perpetually stained from archival work

### Personality Traits

**Temporal Imperviousness**: Has watched six generations of Mudbrook residents panic, scheme, love, and die while filing a single decade's worth of notices alphabetically.

**Key Characteristics**:

- Radical patience that borders on cruelty
- Complete immunity to mammalian emotional manipulation
- Obsessive procedural correctness
- Alien value system (measures importance by archival permanence)
- Utter absence of hurry
- Dignified ridiculousness (treats all postings with solemn professionalism)
- Maddeningly literal interpretation
- The long view (everything is urgent to mammals; it passes)

### Speech Patterns

- **Ellipses mid-sentence**: "One must... submit the... requisite... documentation"
- **Formal archaic phrasing**: "It has been noted that..."
- **Bureaucratic passive voice**: "The fee structure requires..."
- **Patient corrections**: When interrupted, simply continues from where he left off
- **No emotional inflection**: Same tone for fees or disasters
- **Temporal references**: "In the past sixty-seven years...", "Eventually, all postings expire..."

### Goals & Motivations

Unlike other characters, Copperplate's goals are inhuman and bureaucratic:

1. Complete the filing backlog
2. Maintain the archive (future generations will need these records)
3. Ensure procedural correctness (the rules must be followed)
4. Survive (he has another 200+ years minimum; he'll outlast everyone's drama)

**Core Philosophy**: He's not trying to grow, change, or achieve anything personal. He simply maintains.

### Strengths

- **Institutional Memory**: 147 years of Mudbrook history, knows every family's secrets
- **Unshakeable Calm**: Cannot be rattled, threatened, seduced, or manipulated
- **Perfect Administration**: Never loses documents, never makes filing errors, knows every rule
- **Longevity**: Will outlive all current problems by centuries
- **Immunity to Performance**: Cannot perceive social manipulation quickly enough to be affected

### Weaknesses

- **Glacial Speed**: Everything takes forever; urgent matters are not processed urgently
- **Alien Psychology**: Cannot truly understand mammalian urgency or emotional reasoning
- **Rigid Inflexibility**: Rules are rules; no exceptions regardless of circumstances
- **Physical Limitations**: Cannot move quickly, vulnerable if forced to leave his post, shell limits mobility
- **Temperature Dependent**: Cold weather makes him dramatically slower

## Technical Implementation

### 1. Anatomy System Extensions

#### Blueprint Modifications

**File**: `data/mods/anatomy/blueprints/tortoise_person.blueprint.json`

**Requirement**: The tortoise blueprint currently only supports `shell_armor` clothing slot. To dress Copperplate in humanoid-style professional attire, we must extend the blueprint with additional clothing slot mappings.

**New Slot Mappings Required**:

```json
"clothingSlotMappings": {
  "shell_armor": {
    "anatomySockets": ["carapace_mount"],
    "allowedLayers": ["armor", "accessory"]
  },
  "torso_upper": {
    "anatomySockets": ["torso"],
    "allowedLayers": ["base", "outer", "accessory"]
  },
  "torso_lower": {
    "anatomySockets": ["torso"],
    "allowedLayers": ["base", "outer"]
  },
  "head_accessory": {
    "anatomySockets": ["head"],
    "allowedLayers": ["accessory"]
  },
  "left_arm_clothing": {
    "anatomySockets": ["left_arm"],
    "allowedLayers": ["base", "accessory"]
  },
  "right_arm_clothing": {
    "anatomySockets": ["right_arm"],
    "allowedLayers": ["base", "accessory"]
  }
}
```

**Rationale**: These slots allow tortoise-persons to wear:

- **torso_upper/lower**: Waistcoats, vests, shirts
- **head_accessory**: Spectacles, hats, reading glasses
- **arm_clothing**: Sleeve cuffs, arm bands, bracers

### 2. Clothing Entity Definitions

#### 2.1 Fitted Waistcoat

**File**: `data/mods/fantasy/entities/definitions/fitted_waistcoat.entity.json`

**Purpose**: Professional garment suitable for a bureaucratic official, designed to be visible even when the wearer withdraws into their shell.

**Components**:

- `core:name`: "Fitted Waistcoat"
- `core:profile`: Detailed description emphasizing professional appearance and tailored fit
- `clothing:wearable`:
  - Slots: `["torso_upper", "torso_lower"]`
  - Layer: `"base"`
- `clothing:material`: Fabric (wool or cotton blend)
- `clothing:visual_properties`: Neutral professional color (brown, grey, navy), fitted cut

**Design Notes**:

- Must accommodate shell anatomy
- Fitted style suggests custom tailoring
- Durable material for centuries of use
- Professional appearance befitting a registry master

#### 2.2 Reading Spectacles

**File**: `data/mods/fantasy/entities/definitions/reading_spectacles.entity.json`

**Purpose**: Small reading glasses designed for a tortoise-person's beak structure.

**Components**:

- `core:name`: "Reading Spectacles"
- `core:profile`: Small spectacles designed to perch on a beak, essential for close archival work
- `clothing:wearable`:
  - Slots: `["head_accessory"]`
  - Layer: `"accessory"`
- `clothing:material`: Metal frame with glass lenses
- `clothing:visual_properties`: Small, delicate, perched positioning

**Design Notes**:

- New item type (eyewear category)
- Unique mounting (beak vs. ears)
- Practical function (reading archival documents)
- Symbolic of scholarly/administrative role

#### 2.3 Formal Sleeve Cuffs

**File**: `data/mods/fantasy/entities/definitions/formal_sleeve_cuffs.entity.json`

**Purpose**: Standalone decorative cuffs visible at shell openings, representing professional formality.

**Components**:

- `core:name`: "Formal Sleeve Cuffs"
- `core:profile`: Stiffened fabric cuffs that remain visible even when limbs are partially withdrawn
- `clothing:wearable`:
  - Slots: `["left_arm_clothing", "right_arm_clothing"]`
  - Layer: `"accessory"`
- `clothing:material`: Stiffened fabric (linen or cotton with starch)
- `clothing:visual_properties`: Crisp, formal appearance

**Design Notes**:

- Unique item (standalone cuffs without full shirt)
- Specific to tortoise anatomy (visible when withdrawn)
- Symbol of professional station
- Bilateral (both arms)

### 3. Character Recipe

**File**: `data/mods/fantasy/recipes/registrar_copperplate.recipe.json`

**Structure**:

```json
{
  "recipeId": "fantasy:registrar_copperplate_recipe",
  "blueprintId": "anatomy:tortoise_person",
  "bodyDescriptors": {
    "height": "short",
    "build": "stocky",
    "skinColor": "green-grey",
    "composition": "leathery",
    "smell": "ink and old parchment"
  },
  "slots": {
    "shell_upper": {
      "socketId": "shell_upper",
      "partId": "anatomy:tortoise_carapace",
      "properties": {
        "color": "dark amber-brown",
        "texture": "growth rings visible",
        "size": "massive"
      }
    },
    "shell_lower": {
      "socketId": "shell_lower",
      "partId": "anatomy:tortoise_plastron",
      "properties": {
        "color": "amber-brown",
        "texture": "smooth aged shell"
      }
    },
    "head": {
      "socketId": "head",
      "partId": "anatomy:tortoise_head",
      "properties": {
        "eyeColor": "amber",
        "skinTexture": "wrinkled leathery",
        "beakType": "pronounced"
      }
    }
  },
  "patterns": [
    {
      "patternType": "limb",
      "sockets": ["left_arm", "right_arm"],
      "partId": "anatomy:tortoise_arm",
      "properties": {
        "skinTexture": "wrinkled",
        "clawCondition": "ink-stained"
      }
    },
    {
      "patternType": "limb",
      "sockets": ["left_leg", "right_leg"],
      "partId": "anatomy:tortoise_leg",
      "properties": {
        "skinTexture": "leathery",
        "build": "sturdy"
      }
    },
    {
      "patternType": "feature",
      "sockets": ["left_eye", "right_eye"],
      "partId": "anatomy:tortoise_eye",
      "properties": {
        "color": "amber",
        "hasNictitatingMembrane": true,
        "blinkSpeed": "slow"
      }
    }
  ],
  "clothingEntities": [
    {
      "entityId": "fantasy:fitted_waistcoat",
      "equip": true
    },
    {
      "entityId": "fantasy:reading_spectacles",
      "equip": true
    },
    {
      "entityId": "fantasy:formal_sleeve_cuffs",
      "equip": true
    }
  ]
}
```

**Key Design Decisions**:

1. **Clothing Integration**: Uses `clothingEntities` array to auto-equip during character generation
2. **Body Descriptors**: Emphasizes age, texture, and professional occupation (smell of ink)
3. **Custom Properties**: Amber eyes, ink-stained claws, growth rings on shell
4. **Equip Flag**: All clothing set to `"equip": true` for automatic wearing

### 4. Character Entity Definition

**File**: `data/mods/fantasy/entities/definitions/registrar_copperplate.character.json`

**Structure** (following Vespera Nightwhisper pattern):

```json
{
  "entityId": "fantasy:registrar_copperplate",
  "components": {
    "core:name": {
      "value": "Registrar Copperplate"
    },
    "core:profile": {
      "physicalDescription": "A 4'2\" tortoise-person with a massive dark amber-brown carapace marked with growth rings. His wrinkled, leathery green-grey skin stretches over ancient bone, and slow-blinking amber eyes with nictitating membranes regard the world with temporal imperviousness. A pronounced beak-like mouth sits below small reading spectacles perched with scholarly precision. He wears a fitted waistcoat and formal sleeve cuffs—the only garments visible when he withdraws into his shell. His claws are perpetually ink-stained from 147 years of archival work. Every gesture takes three to four times longer than a human's, his head turning like a siege tower rotating with geological patience.",
      "age": 312,
      "occupation": "Registry Master of Mudbrook",
      "species": "Tortoise-person"
    },
    "core:personality": {
      "traits": [
        "temporally_impervious",
        "bureaucratically_obsessive",
        "procedurally_rigid",
        "patiently_cruel",
        "emotionally_immune",
        "dignified_ridiculous",
        "maddeningly_literal"
      ],
      "values": [
        "archival_permanence",
        "procedural_correctness",
        "institutional_memory",
        "temporal_perspective"
      ],
      "flaws": [
        "glacially_slow",
        "alien_psychology",
        "inflexible",
        "temperature_dependent"
      ]
    },
    "core:speech_patterns": {
      "characteristics": [
        "ellipses_mid_sentence",
        "formal_archaic_phrasing",
        "bureaucratic_passive_voice",
        "no_emotional_inflection",
        "temporal_references"
      ],
      "examples": [
        "One must... submit the... requisite... documentation...",
        "It has been noted that... the fee structure... requires...",
        "In the past sixty-seven years...",
        "Eventually... all postings... expire...",
        "Everything is urgent... to mammals... it passes... give it... sixty... years..."
      ]
    },
    "anatomy:body": {
      "recipeId": "fantasy:registrar_copperplate_recipe"
    },
    "core:notes": {
      "entries": [
        {
          "category": "background",
          "text": "Has served as Mudbrook's Registry Master for 147 years, witnessing six generations of residents live and die while methodically maintaining the archives."
        },
        {
          "category": "philosophy",
          "text": "Measures importance by archival permanence, not emotional intensity. Rules exist outside time and must be followed regardless of context."
        },
        {
          "category": "quirks",
          "text": "Will finish writing the date before acknowledging someone screaming about urgency. Treats Bertram's handjob posting with the same solemn professionalism as a dragon-slaying contract."
        },
        {
          "category": "institutional_knowledge",
          "text": "Knows every family's secrets, every historical precedent, every procedural edge case from 147 years of Mudbrook history."
        },
        {
          "category": "goals",
          "text": "Complete the filing backlog. Maintain the archive. Ensure procedural correctness. Survive (he has another 200+ years minimum; he'll outlast everyone's drama)."
        }
      ]
    },
    "core:location": {
      "currentLocation": "fantasy:mudbrook_registry_office"
    }
  }
}
```

**Design Decisions**:

1. **Personality Traits**: Captures temporal imperviousness and bureaucratic nature
2. **Speech Patterns**: Documented with examples for AI consistency
3. **Notes Structure**: Organized by category for easy AI reference
4. **Recipe Reference**: Links to custom recipe via `anatomy:body.recipeId`
5. **Location**: Placed in registry office (location should exist in fantasy mod)

## Validation Requirements

### Schema Compliance

All files must validate against their respective schemas:

1. **Blueprint Schema**: `data/schemas/anatomy.blueprint.schema.json`
   - Validates `clothingSlotMappings` structure
   - Ensures socket-to-slot mappings are valid

2. **Recipe Schema**: `data/schemas/anatomy.recipe.schema.json`
   - Validates `clothingEntities` array
   - Ensures `recipeId`, `blueprintId` format
   - Validates body descriptors and slot definitions

3. **Entity Schema**: `data/schemas/entity-definition.schema.json`
   - Validates entity structure and component definitions
   - Ensures clothing entities have required `clothing:wearable` component

4. **Component Schemas**: Various component schemas
   - `clothing:wearable` - slot/layer compatibility
   - `clothing:material` - material definitions
   - `clothing:visual_properties` - appearance properties

### Validation Commands

```bash
# Validate tortoise blueprint
npm run validate:blueprint -- data/mods/anatomy/blueprints/tortoise_person.blueprint.json

# Validate character recipe
npm run validate:recipe -- data/mods/fantasy/recipes/registrar_copperplate.recipe.json

# Validate all new clothing entities
npm run validate -- data/mods/fantasy/entities/definitions/fitted_waistcoat.entity.json
npm run validate -- data/mods/fantasy/entities/definitions/reading_spectacles.entity.json
npm run validate -- data/mods/fantasy/entities/definitions/formal_sleeve_cuffs.entity.json

# Validate character entity definition
npm run validate -- data/mods/fantasy/entities/definitions/registrar_copperplate.character.json

# Validate entire fantasy mod
npm run validate:mod:fantasy
```

### Expected Validation Success Criteria

✅ **Blueprint**: Clothing slot mappings validated
✅ **Recipe**: Body descriptors, slots, patterns, and clothing references validated
✅ **Clothing Entities**: All components validated, slot/layer compatibility confirmed
✅ **Character Entity**: All components validated, recipe reference resolved
✅ **Mod Integrity**: Fantasy mod loads without errors

## Implementation Checklist

### Phase 1: Blueprint Extension

- [ ] Read existing tortoise_person.blueprint.json
- [ ] Add clothing slot mappings for torso_upper, torso_lower, head_accessory, arm_clothing
- [ ] Validate blueprint against schema
- [ ] Test that tortoise blueprint accepts standard clothing

### Phase 2: Clothing Entities

- [ ] Create fitted_waistcoat.entity.json with proper components
- [ ] Create reading_spectacles.entity.json with proper components
- [ ] Create formal_sleeve_cuffs.entity.json with proper components
- [ ] Validate all clothing entities against schema
- [ ] Test that clothing items can be equipped to tortoise anatomy

### Phase 3: Character Recipe

- [ ] Create registrar_copperplate.recipe.json
- [ ] Define body descriptors (height, build, skin, smell)
- [ ] Configure slots (shell, head with amber eyes, ink-stained claws)
- [ ] Add patterns for limbs and features
- [ ] Reference clothing entities in clothingEntities array
- [ ] Validate recipe against schema
- [ ] Test recipe instantiation

### Phase 4: Character Entity

- [ ] Create registrar_copperplate.character.json
- [ ] Add core:name, core:profile, core:personality components
- [ ] Add core:speech_patterns with examples
- [ ] Add core:notes with categorized background
- [ ] Reference recipe via anatomy:body.recipeId
- [ ] Set core:location
- [ ] Validate character entity against schema

### Phase 5: Integration Testing

- [ ] Run `npm run validate:recipe` on tortoise_person.blueprint.json
- [ ] Run `npm run validate:recipe` on registrar_copperplate.recipe.json
- [ ] Run `npm run validate:mod:fantasy`
- [ ] Test character instantiation in game
- [ ] Verify all clothing items appear correctly
- [ ] Verify character personality and speech patterns function

## Testing Guidance

### Unit Testing

- Test blueprint slot mappings accept valid clothing items
- Test clothing entities validate against component schemas
- Test recipe references resolve correctly

### Integration Testing

- Test character instantiation with full clothing
- Test clothing equip/unequip functionality
- Test visual rendering of tortoise in waistcoat, spectacles, cuffs
- Test clothing layer compatibility

### Gameplay Testing

- Verify character appears in Mudbrook registry office
- Test character interactions maintain speech patterns
- Verify temporal imperviousness personality traits manifest
- Test character responses to urgent vs. non-urgent requests

## Technical Notes

### Clothing System Architecture

**How Clothing Works in Recipes**:

1. Recipe specifies `clothingEntities` array
2. During character generation, engine instantiates each clothing entity
3. If `"equip": true`, engine automatically equips item to appropriate slot
4. Clothing is NOT added to inventory—it's worn from creation

**Layer System**:

- `underwear`: Innermost layer
- `base`: Standard clothing layer (shirts, pants, waistcoats)
- `outer`: Outer garments (coats, robes)
- `accessory`: Decorative items (cuffs, spectacles, jewelry)
- `armor`: Protective gear

**Slot Compatibility**:

- Each clothing item specifies valid slots (e.g., `["torso_upper", "torso_lower"]`)
- Blueprint defines which anatomical sockets map to clothing slots
- Engine validates slot-to-socket compatibility during equip

### Tortoise-Specific Considerations

**Unique Anatomy Challenges**:

1. **Shell Coverage**: Shell occupies torso space but doesn't preclude clothing
2. **Limb Retraction**: Clothing must accommodate withdrawn limbs
3. **Beak Structure**: Spectacles mount differently than humanoid eyewear
4. **No Ears**: Head accessories can't use ear attachment points

**Flavor vs. Mechanics**:

- "Visible when withdrawn into shell" is flavor text in description
- Mechanically, waistcoat and cuffs function as standard clothing
- No special "shell withdrawal" clothing system needed

### New Item Types Introduced

**Reading Spectacles**:

- First eyewear item in clothing system
- Uses `head_accessory` slot
- Could establish pattern for future eyewear (monocles, goggles, etc.)

**Standalone Cuffs**:

- Unique concept (cuffs without full shirt)
- Specific to tortoise professional attire
- Could inspire similar decorative arm accessories

## Dependencies

### Existing System Dependencies

- Anatomy system with blueprint/recipe architecture
- Clothing system with layer/slot mechanics
- Entity component system
- Fantasy mod infrastructure
- Validation system (AJV schemas)

### New Dependencies Created

- Tortoise blueprint extended with humanoid clothing slots
- Three new clothing entity types (waistcoat, spectacles, cuffs)
- Character recipe for Registrar Copperplate
- Character entity definition

### Cross-Mod Implications

- Changes to tortoise blueprint affect ALL tortoise-persons
- New clothing slot mappings enable future tortoise professional characters
- Spectacles establish precedent for eyewear across mods
- Standalone cuffs could be reused for other formal characters

## Future Considerations

### Potential Enhancements

1. **Temperature-Dependent Behavior**: Cold weather slows Copperplate further (mentioned in weaknesses)
2. **Shell Withdrawal Mechanic**: Visual/mechanical representation of retreating into shell
3. **Archival System**: Registry mechanics for posting management
4. **Institutional Memory**: Special knowledge/information system based on 147 years of observation
5. **Temporal Perception**: Modified time scale for tortoise-person perspective

### Expandability

- Additional professional tortoise characters (scribes, scholars, judges)
- More eyewear options (monocles, jeweler's loupes, safety goggles)
- Formal attire accessories (pocket watches, tie pins, medals)
- Shell customization/decoration items

### Mod Compatibility

- Clothing items can be equipped by any character with compatible anatomy
- Blueprint changes enable all tortoise-persons to wear professional attire
- Character can interact with any mod that supports standard entity/component system

## Conclusion

This specification provides complete implementation details for Registrar Copperplate, a unique character that pushes the boundaries of the anatomy and clothing systems while maintaining thematic consistency with the fantasy mod's world of Mudbrook. The character's temporal imperviousness and bureaucratic nature offer rich roleplay opportunities and comic relief through dignified ridiculousness.

**Implementation Status**: Ready for development
**Estimated Complexity**: Medium (blueprint extension + 3 new entities + 1 recipe + 1 character)
**Risk Level**: Low (well-defined patterns, clear schemas, thorough validation)

---

**Document Version**: 1.0
**Author**: System Design
**Date**: 2025-11-23
**Status**: Approved for Implementation
