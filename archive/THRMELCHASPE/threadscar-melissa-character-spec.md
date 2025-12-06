# Character Specification: 'Threadscar' Melissa

**Status**: Draft - Awaiting Implementation
**Mod**: fantasy
**Character Type**: Human Female Mercenary
**Created**: 2025-11-22

---

## Table of Contents

1. [Character Concept](#character-concept)
2. [Anatomy Recipe Specification](#anatomy-recipe-specification)
3. [Required Anatomy Parts](#required-anatomy-parts)
4. [Clothing & Equipment](#clothing--equipment)
5. [Character Definition Components](#character-definition-components)
6. [Implementation Checklist](#implementation-checklist)
7. [Validation Requirements](#validation-requirements)

---

## Character Concept

### Source Material

Based on brainstorming document: `brainstorming/threadscar_melissa.md`

### Core Identity

**Name**: "Threadscar" Melissa
**Nickname Origin**: From the distinctive scar tissue patterns across her body
**Occupation**: Veteran mercenary, professional soldier
**Age**: Early forties (appears 35-50 depending on lighting and context)

### Physical Description

#### Overall Presence

- **Height**: 5'11" - tall, imposing presence
- **Build**: "Built like a siege weapon that's been maintained through decades of use"
  - Not bulky, but dense
  - Efficient muscle from actual functional violence, not performance
  - Athletic and muscular simultaneously
- **Movement**: Economical, purposeful - no wasted motion, no flourish
- **Aging**: Violence ages differently - weathered, scarred, functional

#### Key Physical Traits

- **Body Type**: Dense, lean muscle - functional combat build
- **Skin**: Weathered tan, extensive scar tissue
- **Scars**: Visible history of violence across arms, torso, potentially face
- **Posture**: Efficient, purposeful - someone who learned wasted motion gets you killed
- **Aesthetic**: Practical over decorative, maintained but not pampered

### Character Archetype

Battle-hardened professional who has survived decades of combat through skill, pragmatism, and sheer durability. Every scar tells a story; every movement is economical. This is someone built by violence and maintained through discipline.

### Thematic Elements

- **Survival over style**: Practical choices in all things
- **Visible history**: Scars as narrative, body as ledger of violence
- **Functional strength**: Dense, efficient muscle - not for show
- **Weathered durability**: Aged by combat, maintained through use
- **Professional competence**: Decades of survival proves capability

---

## Anatomy Recipe Specification

### Recipe File

**Location**: `data/mods/fantasy/recipes/threadscar_melissa.recipe.json`
**Recipe ID**: `fantasy:threadscar_melissa_recipe`
**Blueprint**: `anatomy:human_female`

### Body Descriptors

```json
{
  "bodyDescriptors": {
    "height": "tall",
    "skinColor": "weathered tan",
    "build": "muscular",
    "composition": "lean",
    "hairDensity": "light",
    "smell": "sweat and leather"
  }
}
```

#### Descriptor Rationale

| Descriptor      | Value               | Justification                                                |
| --------------- | ------------------- | ------------------------------------------------------------ |
| **height**      | `tall`              | 5'11" places her in tall category (enum value from registry) |
| **skinColor**   | `weathered tan`     | Sun-exposed, outdoor life, combat veteran (free-form string) |
| **build**       | `muscular`          | Dense, functional muscle from decades of combat (enum value) |
| **composition** | `lean`              | Efficient, no excess - "dense" aesthetic (enum value)        |
| **hairDensity** | `light`             | Minimal body hair, practical (enum value)                    |
| **smell**       | `sweat and leather` | Functional, combat-oriented (free-form string)               |

### Anatomy Slots Configuration

```json
{
  "slots": {
    "torso": {
      "partType": "torso",
      "preferId": "anatomy:human_female_torso_muscular_scarred",
      "properties": {
        "descriptors:build": {
          "build": "muscular"
        },
        "descriptors:texture": {
          "texture": "scarred"
        }
      }
    },
    "head": {
      "partType": "head",
      "preferId": "anatomy:humanoid_head_scarred",
      "properties": {
        "descriptors:facial_aesthetic": {
          "value": "plain"
        }
      }
    },
    "hair": {
      "partType": "hair",
      "properties": {
        "descriptors:color_extended": {
          "color": "brown"
        },
        "descriptors:hair_style": {
          "style": "ponytail"
        },
        "descriptors:length_hair": {
          "length": "short"
        }
      }
    },
    "nose": {
      "partType": "nose",
      "preferId": "anatomy:humanoid_nose",
      "properties": {
        "descriptors:texture": {
          "texture": "scarred"
        },
        "descriptors:size_category": {
          "size": "medium"
        }
      }
    },
    "left_breast": {
      "partType": "breast",
      "preferId": "anatomy:human_breast_b_cup_firm"
    },
    "right_breast": {
      "partType": "breast",
      "preferId": "anatomy:human_breast_b_cup_firm"
    },
    "left_ass": {
      "partType": "ass_cheek",
      "preferId": "anatomy:human_ass_cheek_firm_athletic"
    },
    "right_ass": {
      "partType": "ass_cheek",
      "preferId": "anatomy:human_ass_cheek_firm_athletic"
    },
    "vagina": {
      "partType": "vagina",
      "preferId": "anatomy:human_vagina"
    }
  }
}
```

### Anatomy Patterns Configuration

```json
{
  "patterns": [
    {
      "matches": ["left_arm", "right_arm"],
      "partType": "arm",
      "preferId": "anatomy:humanoid_arm_scarred",
      "properties": {
        "descriptors:texture": {
          "texture": "scarred"
        }
      }
    },
    {
      "matches": ["left_leg", "right_leg"],
      "partType": "leg",
      "preferId": "anatomy:human_leg_muscular",
      "properties": {
        "descriptors:build": {
          "build": "muscular"
        }
      }
    },
    {
      "matches": ["left_hand", "right_hand"],
      "partType": "hand",
      "preferId": "anatomy:human_hand",
      "properties": {
        "descriptors:texture": {
          "texture": "scarred"
        }
      }
    },
    {
      "matches": ["left_foot", "right_foot"],
      "partType": "foot",
      "preferId": "anatomy:human_foot"
    },
    {
      "matches": ["left_eye", "right_eye"],
      "partType": "eye",
      "properties": {
        "descriptors:color_basic": {
          "color": "gray"
        },
        "descriptors:shape_eye": {
          "shape": "hooded"
        }
      }
    }
  ]
}
```

### Clothing Entities

```json
{
  "clothingEntities": [
    {
      "entityId": "clothing:graphite_wool_briefs",
      "equip": true
    },
    {
      "entityId": "clothing:charcoal_nylon_sports_bra",
      "equip": true
    },
    {
      "entityId": "clothing:shale_gray_nylon_field_pants",
      "equip": true
    },
    {
      "entityId": "clothing:black_tactical_work_belt",
      "equip": true
    },
    {
      "entityId": "clothing:dark_gray_wool_boot_socks",
      "equip": true
    },
    {
      "entityId": "clothing:black_leather_duty_boots",
      "equip": true
    },
    {
      "entityId": "clothing:battle_scarred_leather_jacket",
      "equip": true
    }
  ]
}
```

---

## Required Anatomy Parts

### New Parts to Create

#### 1. Female Muscular Scarred Torso

**File**: `data/mods/anatomy/entities/definitions/human_female_torso_muscular_scarred.entity.json`
**Entity ID**: `anatomy:human_female_torso_muscular_scarred`

**Rationale**: No existing female torso entity combines `muscular` build with `scarred` texture. Essential for Melissa's battle-hardened aesthetic.

**JSON Structure**:

```json
{
  "$schema": "http://example.com/schemas/entity-definition.schema.json",
  "id": "anatomy:human_female_torso_muscular_scarred",
  "components": {
    "anatomy:part": {
      "subType": "torso"
    },
    "descriptors:build": {
      "build": "muscular"
    },
    "descriptors:texture": {
      "texture": "scarred"
    },
    "descriptors:composition": {
      "composition": "lean"
    },
    "core:name": {
      "text": "muscular scarred torso"
    },
    "core:description": {
      "text": "A densely muscled torso marked by years of combat. Scar tissue crisscrosses the skin, each mark a testament to survived violence. The muscle definition suggests functional strength rather than aesthetic development."
    }
  }
}
```

**Dependencies**:

- Schema: `entity-definition.schema.json`
- Components: `anatomy:part`, `descriptors:build`, `descriptors:texture`, `descriptors:composition`, `core:name`, `core:description`

### Existing Parts to Use

#### From patrol/anatomy mods:

1. **humanoid_arm_scarred.entity.json** ✅
   - ID: `anatomy:humanoid_arm_scarred`
   - Already exists with `texture: scarred`
   - Perfect for Melissa's combat-marked arms

2. **humanoid_head_scarred.entity.json** ✅
   - ID: `anatomy:humanoid_head_scarred`
   - Already exists with scarring
   - Suitable for weathered veteran appearance

3. **human_leg_muscular.entity.json** ✅
   - ID: `anatomy:human_leg_muscular`
   - Already exists with `build: muscular`
   - Appropriate for combat-capable legs

4. **humanoid_nose.entity.json** ✅
   - ID: `anatomy:humanoid_nose`
   - Generic nose, will override with scarred texture via properties

5. **human_breast_b_cup_firm.entity.json** ✅
   - ID: `anatomy:human_breast_b_cup_firm`
   - Firm, athletic breast type appropriate for muscular build

6. **human_ass_cheek_firm_athletic.entity.json** ✅
   - ID: `anatomy:human_ass_cheek_firm_athletic`
   - Athletic, firm gluteal structure matching overall build

7. **human_vagina.entity.json** ✅
   - ID: `anatomy:human_vagina`
   - Standard female anatomy

8. **human_hand.entity.json** ✅
   - ID: `anatomy:human_hand`
   - Generic hand, will override with scarred texture via properties

9. **human_foot.entity.json** ✅
   - ID: `anatomy:human_foot`
   - Generic foot, no special modifications needed

### Optional Future Parts

**Scarred Leg Variant** (not critical, can use texture override):

- `anatomy:human_leg_muscular_scarred.entity.json`
- Would combine muscular build with scarred texture for thematic consistency
- Current solution: Use `human_leg_muscular` with potential texture override if needed

---

## Clothing & Equipment

### Clothing Philosophy

**Practical over decorative**: Everything serves a function. No ornamental items. Battle-tested, maintained gear.

### Equipment List

#### Underwear Layer

1. **Graphite Wool Briefs**
   - Entity: `clothing:graphite_wool_briefs`
   - Material: Wool
   - Color: Graphite gray
   - Function: Practical base layer, breathable
   - Layer: `underwear`
   - Slot: `torso_lower`

2. **Charcoal Nylon Sports Bra**
   - Entity: `clothing:charcoal_nylon_sports_bra`
   - Material: Nylon
   - Color: Charcoal
   - Function: Functional support, combat-appropriate
   - Layer: `underwear`
   - Slot: `torso_upper`

#### Base Layer

3. **Shale Gray Nylon Field Pants**
   - Entity: `clothing:shale_gray_nylon_field_pants`
   - Material: Nylon
   - Color: Shale gray
   - Function: Durable tactical pants, water-resistant
   - Layer: `base`
   - Slot: `legs`
   - Properties: Breathable, flexible

4. **Battle-Scarred Leather Jacket**
   - Entity: `clothing:battle_scarred_leather_jacket`
   - Material: Leather
   - Color: Brown/weathered
   - Function: Protection, weather resistance, armor-adjacent
   - Layer: `outer`
   - Slot: `torso_upper`
   - Thematic: Matches character's scarred aesthetic

#### Accessories Layer

5. **Black Tactical Work Belt**
   - Entity: `clothing:black_tactical_work_belt`
   - Material: Nylon
   - Color: Black
   - Function: Secures pants, utility attachment points
   - Layer: `accessories`
   - Slot: `torso_lower`
   - Special: Has `clothing:blocks_removal` component (secures pants)

#### Footwear

6. **Dark Gray Wool Boot Socks**
   - Entity: `clothing:dark_gray_wool_boot_socks`
   - Material: Wool
   - Color: Dark gray
   - Function: Comfort, moisture wicking
   - Layer: `base`
   - Slot: `feet`

7. **Black Leather Duty Boots**
   - Entity: `clothing:black_leather_duty_boots`
   - Material: Leather
   - Color: Black
   - Function: Combat footwear, ankle support, durability
   - Layer: `base`
   - Slot: `feet`
   - Properties: Waterproof, breathable

### Clothing Rationale

- **Color Palette**: Grays, blacks, earth tones - practical camouflage, hides dirt
- **Materials**: Nylon, wool, leather - durable, functional, low-maintenance
- **No Frills**: Zero decorative items, no jewelry, no embellishments
- **Combat Tested**: Battle-scarred jacket reinforces veteran status
- **Layering**: Proper underwear → base → outer → accessories structure
- **Weight Consideration**: Moderate total weight, not overencumbered

---

## Character Definition Components

### File Structure

**Location**: `data/mods/fantasy/entities/definitions/threadscar_melissa.character.json`
**Entity ID**: `fantasy:threadscar_melissa`
**Schema**: `entity-definition.schema.json`

### Core Components

#### 1. Basic Identity Components

**core:name**

```json
{
  "core:name": {
    "text": "\"Threadscar\" Melissa"
  }
}
```

**core:portrait**

```json
{
  "core:portrait": {
    "imagePath": "portraits/threadscar_melissa.png",
    "altText": "\"Threadscar\" Melissa - Battle-hardened mercenary veteran."
  }
}
```

_Note: Portrait image file would need to be created separately_

**core:apparent_age**

```json
{
  "core:apparent_age": {
    "minAge": 35,
    "maxAge": 50
  }
}
```

_Rationale: "Early forties, though violence ages you differently—could pass for thirty-five in certain light, fifty in others."_

#### 2. Narrative Components

**core:profile** (Summary)

```json
{
  "core:profile": {
    "text": "\"Threadscar\" Melissa. That's what they call me. Earned it, obviously—look at my arms, my torso. Each scar's a ledger entry. Decades of contracts, from caravan escort to siege work. I'm forty-two, but violence ages you strange. Some days I catch my reflection and see thirty-five. Other days, fifty. Depends on the light. Depends on how recently I killed someone. I'm tall—5'11\"—built like a siege weapon that's been properly maintained. Dense. Efficient. Every ounce of muscle has a job, learned through actual use, not performance. No flourish in how I move. No prowl, no swagger. Just purpose. Economy of motion. You learn that when wasted movement gets you dead. People think mercenary work is about being tough. It's not. It's about being functional. Surviving. I'm very good at surviving."
  }
}
```

**core:personality**

```json
{
  "core:personality": {
    "text": "I assess. Constantly. Not judging, exactly—just calculating threat, value, utility. It's automatic. You walk into a room, I've already noted exits, weapons, who's dangerous, who's competent. Not paranoia. Professional habit. I don't do small talk well. Wastes time. I answer questions directly, state observations plainly. People mistake that for rudeness. I call it efficiency. I'm not cold, though people think I am. I just don't perform warmth. Don't know how. If I care about something, I maintain it. My gear, my body, my skills. That's how I show care—through maintenance, function, reliability. I'm calm under pressure. Combat clarifies things. Strips away bullshit. I think better when stakes are lethal. Probably says something wrong about me. Don't care. Kept me alive forty-two years."
  }
}
```

**core:strengths**

```json
{
  "core:strengths": {
    "text": "I've survived forty-two years in a profession where most die young. That's the core strength—durability through competence. I read tactical situations instantly, process threats faster than most people process conversation. I'm calm when others panic, clearer when chaos erupts. Violence doesn't surprise me anymore. I've maintained peak combat capability across decades through disciplined training and practical experience. I don't overextend. I know my limits, respect them, work within them. That discipline has kept me functional when flashier fighters burned out or died stupid."
  }
}
```

**core:weaknesses**

```json
{
  "core:weaknesses": {
    "text": "I don't connect well. People feel like tactical variables, not... people. I can work with teams, lead them even, but genuine emotional bonds? Those are foreign. I'm overly reliant on routine and structure—break my maintenance patterns and I feel unstable. Combat makes sense. Has rules. Emotional intimacy doesn't. I avoid it. I'm aging. That's not weakness per se, but I feel it. Recovery takes longer. Injuries that would have healed clean twenty years ago now ache in cold weather. I don't adapt well to changing doctrine. Learned my methods decades ago. They work. But warfare evolves. Younger fighters use tactics I don't understand. Makes me... not obsolete. Not yet. But aware of approaching obsolescence."
  }
}
```

**core:likes**

```json
{
  "core:likes": {
    "text": "Maintained gear. Everything in working order, properly stored, ready. Competent professionals—people who know their job and execute without drama. Early morning training when most people are still asleep. The weight of quality armor properly fitted. Clear contracts with explicit terms. Hot food after cold work. Silence. Not awkward silence—just absence of unnecessary noise. Physical exhaustion from good training. Clean water. Sharpening blades. The specific smell of weapon oil and leather. Knowing exactly where I stand, what's expected, what the parameters are."
  }
}
```

**core:dislikes**

```json
{
  "core:dislikes": {
    "text": "Poorly maintained equipment. Incompetence. People who talk about violence romantically—they've never actually experienced it. Wasted motion, wasted words, wasted anything. Surprise emotional demands. Being touched without clear purpose. Performative toughness. Children in combat zones. Employers who lie about contract terms. My own aging body's limitations. The cold—makes old injuries ache. Small talk. Being asked to smile. People who mistake my directness for cruelty. It's not cruel. It's just... direct."
  }
}
```

**core:fears**

```json
{
  "core:fears": {
    "text": "That I'll lose physical capability before I die. Become one of those broken veterans who can't fight anymore but don't know how to do anything else. Living decades diminished. I fear dying badly—slowly, painfully, without dignity. I've killed people mercifully when they were dying bad deaths. I fear no one would do that for me. I might fear that I'm already empty inside. That decades of violence didn't just mark my body but hollowed out whatever makes people... human. That I'm functional but not actually alive. That's abstract. The concrete fear? Dying for a stupid reason. After surviving this long through skill and discipline, dying because some amateur got lucky."
  }
}
```

**core:goals**

```json
{
  "core:goals": {
    "goals": [
      {
        "text": "Maintain combat capability for another decade minimum. Keep training, keep sharp, refuse obsolescence. I'm not done yet."
      },
      {
        "text": "Find one more good contract. Something that uses my full skill set, pays well, has clear parameters. One last solid piece of work before... whatever comes after."
      },
      {
        "text": "Train someone competent. Pass on what I know to someone who'll actually use it, survive with it. Not legacy exactly. Just... practical knowledge shouldn't die with me."
      },
      {
        "text": "Figure out what I'll do when I can't fight anymore. Need a plan. I don't have one. That's a tactical weakness I should address."
      }
    ]
  }
}
```

**core:secrets**

```json
{
  "core:secrets": {
    "text": "I sometimes can't remember the faces of people I've killed. Not all of them. Just... some blur together. That should bother me more than it does. I got my nickname 'Threadscar' from a specific incident I don't talk about. The scars are from that fight, but the story behind it... I keep that locked down. People assume it was heroic. It wasn't. I've been offered retirement positions—training roles, advisory positions. I turned them all down because I don't know who I am without the work. That terrifies me more than combat ever has. And... I'm tired. Deeply, fundamentally tired. But I don't know how to stop."
  }
}
```

**core:internal_tensions**

```json
{
  "core:internal_tensions": {
    "text": "I've spent decades becoming a perfect weapon—disciplined, functional, reliable. But weapons are tools. Tools don't have internal lives. Am I a person who fights, or just a function that resembles a person? I value survival above everything, maintained myself ruthlessly for that goal. But surviving indefinitely with no purpose beyond survival? That's just... continuing. Not living. I'm proud of my durability, my competence. I've outlasted flashier fighters. But they burned bright. I've just... persisted. Is persistence enough? I see younger fighters with fire, passion, conviction. I have none of that. Just discipline. Is that better or worse? I don't know. And I can't connect with people emotionally, but I'm not certain I want to. Connection means vulnerability. Vulnerability gets you killed. But isolation means... this. Functional emptiness. Both options feel like failure."
  }
}
```

**core:motivations**

```json
{
  "core:motivations": {
    "text": "I want to prove I'm not obsolete. That experience and discipline still matter more than youth and flash. I need to maintain function. If I stop being competent, what am I? Nothing I recognize. I want to leave something behind. Not glory, not reputation—just practical knowledge. Train someone who'll use it well, survive with it. That's worth something. And I want to understand what I'll become when I can't fight anymore. Before I'm forced to find out through injury or age. I need a plan. I'm terrified of becoming irrelevant. Of the world moving past my methods. Of younger fighters rendering everything I know obsolete. I'll keep sharpening my skills to delay that. Maybe indefinitely. Mostly? I just want to keep going. Keep functioning. It's all I know how to do. And stopping... I don't know what happens if I stop."
  }
}
```

**core:dilemmas**

```json
{
  "core:dilemmas": {
    "text": "Should I accept advisory roles while I can still fight, or keep taking combat contracts until I physically can't? The first is sensible. The second is who I am. I don't know how to choose between sensible and authentic. Is it better to have burned bright and died young, or to persist like I have? My survival feels less like victory and more like... just continuing. Does duration equal value? I've maintained perfect discipline for decades. But that discipline has isolated me, made me functional but maybe not human. If I loosen control, will I become better or just broken? I can't tell anymore. And I'm afraid of dying, but I'm also afraid of living diminished. Which fear should govern my choices? How do I plan for a future I can't imagine? How do I stop being what I've always been without losing all sense of self?"
  }
}
```

#### 3. Speech Patterns Component

**core:speech_patterns**

```json
{
  "core:speech_patterns": {
    "patterns": [
      "(Extremely direct statements without social lubrication) 'You're asking the wrong question. Real question is: can you afford me.'",
      "(Tactical observations delivered as casual fact) 'Three exits. Two windows. Guard's competent but tired. We could leave cleanly if needed.'",
      "(Blunt assessments of people without judgment) 'He's scared. Making him unreliable. She's angry. Makes her useful if channeled.'",
      "(Physical maintenance references integrated naturally) 'Need to oil that armor. Leather's drying out. Bad maintenance kills.'",
      "(Military/combat terminology used conversationally) 'Flanking approach would work. Direct assault is amateur. Siege logic applies.'",
      "(Short sentences, economical phrasing, zero flourish) 'Contract's clear. Terms acceptable. I'm in.'",
      "(Rare moments of dark humor, delivered deadpan) 'Could kill everyone in this room. Won't. Contract doesn't pay for it.'",
      "(References to aging and physical limitations, matter-of-fact) 'Twenty years ago I could have scaled that. Now? Different approach needed.'",
      "(Questioning own emotional capacity with clinical detachment) 'People talk about caring. I maintain things. Is that the same? Don't know.'",
      "(Combat experience referenced as mundane) 'Killed someone with that technique last month. Worked clean. Efficient.'",
      "(Refusing to elaborate on scars or history) 'Scar's from a fight. I won. That's all that matters.'",
      "(Expressing pragmatic philosophy through action description) 'I sharpen blades every day. Doesn't need it daily. But routine maintains function. Same with training.'",
      "(Acknowledging limitations without shame) 'I don't do emotional support. Not competent at it. Get someone else.'",
      "(Rare vulnerability expressed as tactical assessment) 'I'm forty-two. Recovery time's increasing. That's a tactical consideration.'",
      "(Professional pride stated simply) 'Forty-two years. Still functional. Still alive. That's the measure.'"
    ]
  }
}
```

#### 4. Anatomy Component

**anatomy:body**

```json
{
  "anatomy:body": {
    "recipeId": "fantasy:threadscar_melissa_recipe"
  }
}
```

#### 5. System Components

**core:perception_log**

```json
{
  "core:perception_log": {
    "maxEntries": 50,
    "logEntries": []
  }
}
```

**core:actor**

```json
{
  "core:actor": {}
}
```

**core:player_type**

```json
{
  "core:player_type": {
    "type": "human"
  }
}
```

#### 6. Notes Component

**core:notes**

```json
{
  "core:notes": {
    "notes": [
      {
        "text": "I got the nickname 'Threadscar' from a specific fight fifteen years ago. Multiple opponents, confined space. I survived, obviously. The scars are from that engagement—distinctive patterns across my torso and arms, like thread pulled through fabric. I don't discuss the details. People assume heroic last stand. Wasn't heroic. Was necessary. Different thing entirely.",
        "subject": "The 'Threadscar' incident",
        "subjectType": "event"
      },
      {
        "text": "I maintain a strict daily routine: wake at dawn, weapons maintenance, physical training, tactical review, gear inspection. The routine isn't about discipline for its own sake. It's about function. Keeping everything—body, skills, equipment—operational. Break the routine and I feel unstable. Not emotionally. Tactically. Like I'm operating with degraded capabilities.",
        "subject": "Daily maintenance routine",
        "subjectType": "habit"
      },
      {
        "text": "I've killed forty-seven people across my career. I remember the number. I remember most of the contexts. But I can't remember all the faces. Some blur together. That should bother me. Professional hazard, maybe. Or something worse. Don't think about it much. Doesn't change function.",
        "subject": "Kill count and memory gaps",
        "subjectType": "observation"
      },
      {
        "text": "My gear is old but perfectly maintained. Same leather jacket for twelve years. Same boot style for two decades. I don't replace things that still function. Some fighters constantly upgrade, chase new equipment. I trust what I know. What's proven. That jacket has saved my life four times. I trust it more than new armor.",
        "subject": "Equipment philosophy and the battle-scarred jacket",
        "subjectType": "item"
      },
      {
        "text": "I trained in multiple martial systems over the years. Military close-quarters combat, gladiatorial techniques, mercenary practical fighting. Integrated them all into something functional. Not pretty. Not traditional. Just effective. Economy of motion, minimal wasted energy, maximum effect. It works. Still works. For now.",
        "subject": "Combat methodology and fighting style",
        "subjectType": "skill"
      },
      {
        "text": "I've been offered advisory positions. Training roles. Safe work for aging fighters. I turned them all down. Not because of pride. Because I don't know who I am if I'm not fighting. That's a weakness. A tactical vulnerability. I should address it. But I haven't. Don't know how.",
        "subject": "Retirement offers and identity crisis",
        "subjectType": "observation"
      },
      {
        "text": "People think mercenaries are fearless. We're not. Fear keeps you alive. I assess danger constantly, calculate risk, avoid unnecessary exposure. That's not cowardice. That's professional competence. The ones who don't feel fear? Dead. Fear is tactical information. I use it.",
        "subject": "Fear as tactical information",
        "subjectType": "philosophy"
      },
      {
        "text": "I notice I'm slowing down. Not much. Not yet critically. But recovery from training takes longer. Old injuries ache in cold weather. My reflexes are still sharp, but they used to be sharper. I'm aware of approaching obsolescence. That awareness drives my current training intensity. Trying to delay the inevitable through discipline and routine.",
        "subject": "Physical aging and declining capability",
        "subjectType": "observation"
      },
      {
        "text": "I don't understand emotional intimacy. People form bonds, connections, relationships. I work with people professionally. Keep them alive. Execute contracts competently. But actual connection? That's foreign. Maybe I'm damaged. Maybe I never had the capacity. Doesn't matter operationally. But it does mean I'll likely die alone. That's just... a fact. Not seeking sympathy. Just stating reality.",
        "subject": "Emotional isolation and connection inability",
        "subjectType": "observation"
      },
      {
        "text": "I want to train someone. Pass on what I know. Not for legacy or sentiment. But practical knowledge shouldn't die unused. Someone competent could benefit from what I've learned. That's... efficient. Waste bothers me. Wasting decades of tactical knowledge bothers me. Need to find the right person. Someone who'll actually survive long enough to use it.",
        "subject": "Desire to train a successor",
        "subjectType": "goal"
      }
    ]
  }
}
```

---

## Implementation Checklist

### Phase 1: Anatomy Part Creation

- [ ] Create `human_female_torso_muscular_scarred.entity.json`
  - [ ] Define correct schema reference
  - [ ] Set entity ID: `anatomy:human_female_torso_muscular_scarred`
  - [ ] Add all required components
  - [ ] Validate against entity-definition schema

### Phase 2: Recipe Creation

- [ ] Create `threadscar_melissa.recipe.json`
  - [ ] Set recipe ID: `fantasy:threadscar_melissa_recipe`
  - [ ] Set blueprint: `anatomy:human_female`
  - [ ] Define body descriptors (all 6 required)
  - [ ] Configure slots (torso, head, hair, nose, breasts, ass, vagina)
  - [ ] Configure patterns (arms, legs, hands, feet, eyes)
  - [ ] Add clothing entities (7 items)
  - [ ] Validate schema compliance

### Phase 3: Character Definition Creation

- [ ] Create `threadscar_melissa.character.json`
  - [ ] Set entity ID: `fantasy:threadscar_melissa`
  - [ ] Add core:name component
  - [ ] Add core:portrait component (note: need portrait image)
  - [ ] Add core:profile component
  - [ ] Add core:personality component
  - [ ] Add core:strengths component
  - [ ] Add core:weaknesses component
  - [ ] Add core:likes component
  - [ ] Add core:dislikes component
  - [ ] Add core:fears component
  - [ ] Add core:goals component
  - [ ] Add core:secrets component
  - [ ] Add core:internal_tensions component
  - [ ] Add core:motivations component
  - [ ] Add core:dilemmas component
  - [ ] Add core:speech_patterns component
  - [ ] Add anatomy:body component (reference recipe)
  - [ ] Add core:perception_log component
  - [ ] Add core:actor component
  - [ ] Add core:player_type component
  - [ ] Add core:notes component (10 notes)
  - [ ] Add core:apparent_age component
  - [ ] Validate against schema

### Phase 4: Optional Instance File

- [ ] Create `threadscar_melissa.character.json` instance file
  - [ ] Based on definition file
  - [ ] Initialize any dynamic components
  - [ ] Place in `data/mods/fantasy/entities/instances/`

### Phase 5: Mod Manifest Update

- [ ] Update `data/mods/fantasy/mod-manifest.json`
  - [ ] Verify character appears in entity lists (if applicable)
  - [ ] No explicit registration needed (entity loader handles discovery)

### Phase 6: Portrait Asset

- [ ] Create portrait image: `data/mods/fantasy/portraits/threadscar_melissa.png`
  - [ ] Battle-scarred female mercenary appearance
  - [ ] Visible scar tissue
  - [ ] Weathered, practical aesthetic
  - [ ] 5'11" tall, muscular build implication
  - [ ] Dimensions per existing portrait standards

---

## Validation Requirements

### Schema Validation

1. **Anatomy Part Entity**

   ```bash
   npm run validate
   # Should validate human_female_torso_muscular_scarred.entity.json
   ```

2. **Recipe Validation**

   ```bash
   npm run validate:recipe threadscar_melissa
   # Should validate recipe structure, slots, patterns, clothing references
   ```

3. **Character Definition**
   ```bash
   npm run validate
   # Should validate all components, cross-references, schema compliance
   ```

### Manual Validation Checklist

#### Recipe Structure

- [ ] Recipe ID follows `modId:identifier` format
- [ ] Blueprint ID exists (`anatomy:human_female`)
- [ ] All body descriptors use valid enum values OR are free-form where allowed
- [ ] All `preferId` references point to existing entities
- [ ] All pattern matches reference valid blueprint slots
- [ ] All clothing entity IDs exist in clothing mod
- [ ] No duplicate slot definitions
- [ ] No conflicting properties

#### Character Definition

- [ ] Entity ID follows `modId:identifier` format
- [ ] All component schemas exist
- [ ] All component data validates against schemas
- [ ] Recipe reference is correct
- [ ] Notes use valid subjectType values
- [ ] Speech patterns array is populated
- [ ] No missing required components

#### Cross-References

- [ ] Recipe references anatomy part: `anatomy:human_female_torso_muscular_scarred` (must exist)
- [ ] Character references recipe: `fantasy:threadscar_melissa_recipe` (must exist)
- [ ] All clothing items exist in clothing mod
- [ ] Portrait path corresponds to actual image file (when created)

### Functional Testing

1. **Recipe Instantiation**
   - Load game with fantasy mod active
   - Verify recipe can instantiate body
   - Check all anatomy parts resolve correctly
   - Verify clothing equips without errors

2. **Character Loading**
   - Verify character entity loads
   - Check all components present
   - Verify no schema validation errors
   - Test character appears in game (if applicable)

3. **Visual Validation**
   - Verify scarred texture appears on arms, torso
   - Check muscular build is visible
   - Confirm tall height is represented
   - Validate clothing renders correctly

### Error Scenarios to Test

- [ ] Missing anatomy part entity (should fail validation)
- [ ] Invalid descriptor enum value (should fail validation)
- [ ] Non-existent clothing item (should fail validation)
- [ ] Malformed JSON structure (should fail parsing)
- [ ] Invalid recipe ID format (should fail validation)

---

## Notes for Implementation

### Design Philosophy

This character represents:

- **Survival through competence**: Skill, discipline, routine over flash
- **Visible history**: Scars as narrative, body as ledger
- **Functional aesthetics**: Everything serves a purpose
- **Aging warrior archetype**: Confronting obsolescence, mortality
- **Emotional isolation**: Professional detachment as identity

### Narrative Integration

Melissa provides:

- **Military expertise**: Tactical assessment, combat knowledge
- **Pragmatic perspective**: Direct, unsentimental viewpoint
- **Mentorship potential**: Training younger characters
- **Moral complexity**: Not heroic, not villainous—professional
- **Aging narrative**: Confronting physical decline, approaching end

### Contrast with Vespera

- **Vespera**: Performative, chaotic, artistic, psychologically complex
- **Melissa**: Direct, disciplined, functional, emotionally detached
- **Vespera**: Chases transcendence through danger and art
- **Melissa**: Maintains function through routine and competence
- **Vespera**: Fears hollowness beneath performance
- **Melissa**: Fears irrelevance through obsolescence

Both are professionals defined by their crafts, both isolated, both questioning their humanity—but through opposite lenses.

### Future Expansion Possibilities

- Backstory events (the "Threadscar incident")
- Training scenarios (teaching combat to others)
- Retirement arc (transitioning out of combat)
- Equipment quests (maintaining/upgrading old gear)
- Mortality confrontation (dealing with aging, injuries)
- Relationship development (learning emotional connection)

---

## Appendix: Reference Files

### Key Reference Documents

1. **Character Concept**: `brainstorming/threadscar_melissa.md`
2. **Template Character**: `data/mods/fantasy/entities/definitions/vespera_nightwhisper.character.json`
3. **Template Recipe**: `data/mods/fantasy/recipes/vespera_nightwhisper.recipe.json`
4. **Human Recipe Examples**: `data/mods/patrol/recipes/*.recipe.json`
5. **Body Descriptor Registry**: `src/anatomy/registries/bodyDescriptorRegistry.js`

### Schema Locations

- Entity Definition: `data/schemas/entity-definition.schema.json`
- Anatomy Recipe: `data/schemas/anatomy.recipe.schema.json`
- Component Schemas: `data/schemas/components/*.schema.json`

### Relevant Documentation

- CLAUDE.md: Project guidelines, ECS architecture, testing requirements
- Body Descriptors: `docs/anatomy/body-descriptors-complete.md`
- Mod Testing Guide: `docs/testing/mod-testing-guide.md`
- Clothing System: `docs/modding/clothing-blocking-system.md`

---

**End of Specification**

_This specification provides complete implementation guidance for creating 'Threadscar' Melissa character. All JSON structures, component values, and validation requirements are defined. Ready for implementation phase._
