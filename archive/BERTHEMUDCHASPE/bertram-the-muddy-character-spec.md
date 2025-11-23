# Character Specification: Bertram the Muddy

## 1. Character Overview

**Name**: Bertram (surname unknown, referred to as "Bertram the Muddy")
**Age**: 53 years old (appears 50-55)
**Occupation**: Master Leatherworker and Tanner
**Location**: Mudbrook-on-the-Bend
**Marital Status**: Widower (wife Anna died 6 years ago)

### Defining Characteristics

**Core Trait**: Radical sincerity without subtext - what you see is what you get
**Distinctive Physical Feature**: Permanent tan-brown skin discoloration from decades of tannery work
**Philosophical Approach**: Transactionally healthy - applies practical problem-solving to all aspects of life
**Character Essence**: Complete comfort in his own skin, zero performative identity, no hidden depths

### Character Purpose

Bertram represents a fascinating contrast to complex characters like Vespera Nightwhisper. Where Vespera has layers, contradictions, and performed identity, Bertram simply *is* - a skilled craftsman who knows who he is, processed his grief healthily, and addresses his needs with the same practical approach he applies to leatherwork. His "reciprocal services" posting is meant literally, with zero hidden meaning or romantic subtext.

---

## 2. Recipe Specification

### File Information

**Recipe File**: `data/mods/fantasy/recipes/bertram_the_muddy.recipe.json`
**Recipe ID**: `fantasy:bertram_the_muddy_recipe`
**Blueprint**: `anatomy:human_male` (standard male human blueprint with penis and testicles)

### Body Descriptors

| Descriptor | Value | Rationale |
|------------|-------|-----------|
| **height** | `average` | 5'8" - typical working-class height, neither tall nor short |
| **build** | `stocky` | Thick-bodied working-man's build - solid from decades of physical labor, strong forearms and hands from leatherwork, slight belly from contentment (not fat, not muscular, just solid) |
| **composition** | `soft` | Slight belly from contentment and age, but not overweight - healthy working man in his 50s |
| **hairDensity** | `moderate` | Practical grooming, clean but not polished, body hair present but not excessive |
| **skinColor** | `"weathered tan with brown tannery staining"` | **CRITICAL DISTINCTIVE FEATURE**: Permanent tan-brown discoloration from decades of exposure to tanning chemicals and leather dyes - this staining never washes out and is his defining physical marker |
| **smell** | `"leather oils and curing agents"` | Faint chemical smell from professional work - not unpleasant, just persistently present. Smells like leather, oils, and tanning agents even after bathing |

### Descriptor Components Usage

| Component | Value | Notes |
|-----------|-------|-------|
| `descriptors:facial_hair` | `full-beard` | Neatly trimmed full beard, brown going grey |
| `descriptors:body_hair` | `moderate` | Present but practical, not excessive |
| `descriptors:hair_style` | `straight` | Short, practical, brown going grey |
| `descriptors:color_extended` (hair) | `brown` | Brown hair transitioning to grey at 53 |
| `descriptors:color_extended` (beard) | `brown` | Brown beard with grey throughout |
| `descriptors:color_basic` (eyes) | `brown` | Warm brown eyes with smile-lines |

**New Enum Values Required**: **NONE** - All existing descriptor enums are sufficient for Bertram's appearance.

---

## 3. Anatomy Slot Configuration

### Slot Assignment Table

| Slot | Part Entity | Status | Rationale |
|------|-------------|--------|-----------|
| **head** | `humanoid_head_weathered` | Existing | Weathered, unremarkable face of a 53-year-old working man, warm brown eyes with smile-lines from easy smiling |
| **hair** | `human_hair_brown_grey_short_practical` | **NEW** | Brown hair going grey, kept short and practical for work, may have trace sawdust/dye |
| **face** | `humanoid_face_bearded_full_trimmed` | **NEW** | Full beard neatly trimmed, brown with grey throughout, no dramatic features - just warm and unremarkable |
| **torso_upper** | `human_male_torso_working_build` | **NEW** | Thick-bodied build, strong shoulders and chest from decades of physical labor, no six-pack but solid |
| **torso_lower** | `human_male_torso_lower` | Existing | Standard male blueprint anatomy including penis and testicles (blueprint-defined sockets) |
| **left_arm** | `humanoid_arm_weathered_tannery_stained` | **NEW** | Strong forearms from working leather, permanent tan-brown staining from chemicals, practical strength |
| **right_arm** | `humanoid_arm_weathered_tannery_stained` | **NEW** | Mirror of left arm - same staining and working strength |
| **left_hand** | `humanoid_hand_craftsman_stained` | **NEW** | **CRITICAL**: Broad, strong hands with specific callus patterns from leatherwork, dark crescents under fingernails from embedded dyes/tannins, short practical nails, "all digits functional" |
| **right_hand** | `humanoid_hand_craftsman_stained` | **NEW** | Mirror of left hand - same craftsman markers |
| **left_leg** | `humanoid_leg_average` | Existing | Average height, functional working legs |
| **right_leg** | `humanoid_leg_average` | Existing | Mirror of left leg |
| **left_foot** | `humanoid_foot_average` | Existing | Standard feet, practical and functional |
| **right_foot** | `humanoid_foot_average` | Existing | Mirror of left foot |

### Male Anatomy Blueprint Notes

**Blueprint**: `anatomy:human_male`
**Additional Slots** (defined by blueprint):
- `penis` - Standard male anatomy
- `left_testicle` - Standard male anatomy
- `right_testicle` - Standard male anatomy

**Reference Implementation**: See `data/mods/patrol/recipes/dylan_crace.recipe.json` for correct male blueprint usage.

### New Anatomy Part Entities Required

The following anatomy part entities need to be created to accurately represent Bertram's distinctive features:

1. **`human_hair_brown_grey_short_practical.entity.json`**
   - Short practical hairstyle
   - Brown base color transitioning to grey
   - May contain trace sawdust and dye residue
   - Kept trimmed for work purposes

2. **`humanoid_face_bearded_full_trimmed.entity.json`**
   - Full beard, neatly trimmed
   - Brown with grey throughout
   - Weathered but warm features
   - Smile-lines around eyes
   - Unremarkable but kind face

3. **`human_male_torso_working_build.entity.json`**
   - Thick working-man's build
   - Strong from labor but not muscular
   - Slight belly from contentment (age 53)
   - Solid, practical physique

4. **`humanoid_arm_weathered_tannery_stained.entity.json`**
   - Strong forearms from decades of leatherwork
   - Permanent tan-brown chemical staining
   - Weathered skin texture
   - Working-man strength (not bodybuilder)

5. **`humanoid_hand_craftsman_stained.entity.json`** (**MOST IMPORTANT**)
   - Broad, strong hands
   - Specific callus patterns from working leather
   - Dark crescents embedded under fingernails from dyes/tannins
   - Short, practical nails
   - Capable, honest craftsman's hands
   - "All digits functional" (Bertram's pride)

**Note**: These anatomy parts may already exist in similar forms. Check `data/mods/anatomy/entities/definitions/` before creating new entities. If similar parts exist (e.g., `humanoid_hand_scarred`), consider whether they can be reused or if Bertram's specific features (staining, calluses) require distinct entities.

---

## 4. Clothing Requirements

### Strategy
**Mix of Existing and New**: Reuse existing clothing where appropriate, create new items only where necessary for character authenticity (specifically the iconic leather apron).

### Existing Clothing to Reuse (6 items)

| Item Entity ID | Slot | Layer | Purpose |
|----------------|------|-------|---------|
| `graphite_wool_briefs` | groin | base | Simple, practical underwear |
| `shale_gray_nylon_field_pants` | legs | base | Practical work trousers (stained but clean) |
| `charcoal_wool_tshirt` | torso_upper | base | Simple work shirt under apron |
| `dark_brown_leather_belt` | waist | base | Self-made belt (perfect for leatherworker), has tool loops |
| `dark_gray_wool_boot_socks` | feet | base | Practical work socks |
| `black_leather_duty_boots` | feet | outer | Good boots (check if these exist, otherwise Bertram made his own) |

**Alternative Boot Check**: Search for `brown_leather_work_boots` or similar. If not available, use `black_leather_duty_boots` as closest match.

### New Clothing Entity to Create (1 item)

#### Leather Work Apron

**File**: `data/mods/clothing/entities/definitions/leather_work_apron.entity.json`
**Instance**: `data/mods/clothing/entities/instances/leather_work_apron.entity.json`
**Entity ID**: `clothing:leather_work_apron`

**Specifications**:
- **Slot**: `torso_upper`
- **Layer**: `outer`
- **Material**: Thick tanned leather
- **Color**: Tan-brown base with darker staining from years of use
- **Condition**: Well-worn but meticulously maintained (mended, functional)
- **Features**: Large front pocket for tools, reinforced stress points, leather tie straps
- **Significance**: **ICONIC** - This is Bertram's professional uniform and defining visual marker. He might go back to work at any moment.

**Components**:
```json
{
  "clothing:garment": {
    "name": "Leather Work Apron",
    "slot": "torso_upper",
    "layer": "outer",
    "coverage": ["torso_front"],
    "removable": true
  },
  "clothing:material": {
    "primaryMaterial": "leather",
    "thickness": "thick",
    "flexibility": "moderate"
  },
  "clothing:condition": {
    "integrity": "good",
    "cleanliness": "clean",
    "wear": "well-worn"
  },
  "clothing:appearance": {
    "color": "tan-brown with darker stains",
    "pattern": "solid",
    "style": "practical craftsman's apron"
  },
  "core:visual_properties": {
    "description": "A thick leather work apron, tan-brown and marked with darker stains from years of tannery work. The front pocket bulges slightly with tools, and the tie straps show careful mending. Despite its age and wear, the apron is clean and meticulously maintained - the mark of a craftsman who respects his tools and his trade."
  }
}
```

### Clothing Inventory Notes

**Starting Inventory**:
- All 7 items equipped (underwear, pants, shirt, apron, belt, socks, boots)
- No additional clothing items in inventory
- Bertram dresses functionally, not fashionably
- Everything is clean, mended, and ready for work

---

## 5. Character Entity Specification

### File Information

**Definition File**: `data/mods/fantasy/entities/definitions/bertram_the_muddy.character.json`
**Instance File**: `data/mods/fantasy/entities/instances/bertram_the_muddy.character.json`
**Entity ID**: `fantasy:bertram_the_muddy`

### Component Specifications

#### 5.1 Core Identity Components

##### core:name
```json
{
  "core:name": {
    "value": "Bertram"
  }
}
```

**Note**: No surname used - known as "Bertram the Muddy" in the community due to permanent tannery staining.

##### core:apparent_age
```json
{
  "core:apparent_age": {
    "value": "fifties"
  }
}
```

**Rationale**: Age 53, looks every year without apology - no attempt to appear younger.

##### core:profile
```json
{
  "core:profile": {
    "value": "Bertram is a 53-year-old master leatherworker whose decades at the tannery have left permanent marks - a tan-brown discoloration to his skin that never quite washes out, dark crescents embedded under his fingernails from leather dyes, and the faint but persistent smell of leather oils and curing agents. At 5'8\" with a thick working-man's build, he has the solid physique of someone who's spent a lifetime crafting saddles, belts, and boots with strong, calloused hands. His brown hair is going grey and kept short for practicality, his full beard is neatly trimmed, and his warm brown eyes carry smile-lines from a life of easy contentment.\n\nHe dresses in practical work clothes - wool shirt and trousers (both stained but clean), good boots he made himself, and a leather apron that might be the most honest thing about him: he could go back to work at any moment, and often does. Widowed six years ago after a happy marriage to his sweetheart Anna, Bertram mourned properly and moved forward without bitterness. He's respected in Mudbrook for his excellent craftsmanship and his radical sincerity - he means exactly what he says, has no hidden agendas, and solves problems with the same straightforward approach he applies to leatherwork.\n\nCurrently, he's posted a notice at the Municipal Aid Registry seeking reciprocal services - a fair exchange between adults with needs and no romantic complications. It's practical, honest, and quintessentially Bertram: if two people can help each other, why complicate it?"
  }
}
```

#### 5.2 Personality & Behavior Components

##### core:personality
```json
{
  "core:personality": {
    "traits": [
      "Radically sincere - means exactly what he says with no hidden meanings or layers",
      "Transactionally healthy - understands mutual benefit and fair exchange in all aspects of life",
      "Completely comfortable in his own skin - zero shame about his age, body, profession, or needs",
      "Matter-of-fact about sex - healthy libido, no romantic prospects, solved it practically",
      "Genuinely kind - remembers names, tips well, does excellent work for fair prices, not performatively nice",
      "No existential crisis - doesn't wonder who he 'really' is, just exists as Bertram without drama",
      "Emotionally resolved - processed grief over Anna's death like a healthy adult, grateful for what he had"
    ],
    "description": "Bertram represents the opposite of performative identity. He doesn't have layers or hidden depths - what you see is what you get. This radical transparency makes him fascinating to people like Vespera precisely because he doesn't wonder who he is or perform an identity. He just IS: a skilled leatherworker who drinks ale, watches sunsets, has physical needs, and meets them all with the same practical problem-solving approach."
  }
}
```

##### core:speech_patterns
```json
{
  "core:speech_patterns": {
    "examples": [
      "\"Like treating leather - you need the right pressure, proper care, attention to timing. Rush it and you'll damage the material. Take your time and you'll get quality results.\"",
      "\"A good handjob is like good craftsmanship. You need to understand what you're working with, adjust to feedback, take pride in the result.\"",
      "\"I had my great love. Anna and I had thirty years together, and they were good years. I'm grateful for that time, but I'm not looking to replace her. I just have needs, same as anyone.\"",
      "\"Reciprocal services seemed fair. Like posting for help moving furniture - you help me, I help you, everyone benefits. Why complicate it with romance when neither of us wants that?\"",
      "\"The tannery marks you. Gets into your skin, under your nails, into your clothes. But it's honest work that produces useful things. I'm proud of what I make.\"",
      "\"I don't understand why people perform who they are. Just be yourself - it's simpler and takes less energy.\"",
      "\"Good ale, a clean shop, and the smell of fresh leather - that's a fine day. Add some friendly company without strings, and that's even better.\""
    ],
    "notes": "Bertram's speech is direct, clear, and practically metaphorical - he naturally compares things to leatherwork. He's casually intimate, discussing his dead wife with warm fondness and his sexual preferences with the same matter-of-fact tone he'd use to discuss weather. He asks sincerely when he doesn't understand something, with no ego about admitting ignorance."
  }
}
```

##### core:strengths
```json
{
  "core:strengths": {
    "values": [
      "Master craftsman - creates genuinely excellent leather goods (saddles, belts, boots, bags) that are beautiful, durable, and fairly priced",
      "Radical sincerity - complete transparency with zero hidden agendas or performative behavior",
      "Emotional health - processed grief properly, maintains healthy boundaries, comfortable with himself",
      "Practical problem-solver - applies straightforward thinking to all life challenges",
      "Respected community member - known for fair dealing, quality work, and genuine kindness",
      "Strong working hands - decades of leatherwork have given him capable, skilled hands (all digits functional)",
      "Simple contentment - finds happiness in ale, sunsets, pipe smoking, clean leather, and honest company"
    ]
  }
}
```

##### core:weaknesses
```json
{
  "core:weaknesses": {
    "values": [
      "No romantic interest - not interested in remarrying or romantic entanglements, which limits certain social connections",
      "Permanently marked by profession - tannery staining and smell are indelible markers that some find off-putting",
      "Blunt honesty - his radical sincerity can confuse or unsettle people expecting social performance",
      "No hidden depths - what you see is truly what you get, which disappoints those seeking complexity",
      "Age and mortality - at 53 with decades of physical labor, he's not as strong as he once was",
      "Unconventional approach to needs - his practical solution to sexual needs via posted exchange is socially unusual"
    ]
  }
}
```

##### core:likes
```json
{
  "core:likes": {
    "values": [
      "Good ale",
      "Watching the sunset while smoking his pipe",
      "The smell of newly worked leather",
      "A clean, organized shop",
      "Occasional friendly sex with no strings attached",
      "Fair transactions and mutual benefit",
      "Well-crafted tools and materials",
      "Straightforward, honest people"
    ],
    "notes": "This is the complete list of what makes Bertram happy. He's content with simple pleasures and doesn't need more."
  }
}
```

##### core:dislikes
```json
{
  "core:dislikes": {
    "values": [
      "Pretension and performative behavior",
      "Unnecessary complexity when simple solutions exist",
      "Impersonal transactions (brothels felt too detached)",
      "Romantic expectations he can't meet",
      "People who don't say what they mean",
      "Dishonest craftsmanship or shoddy work",
      "Drama and emotional manipulation"
    ]
  }
}
```

##### core:fears
```json
{
  "core:fears": {
    "values": [],
    "notes": "Bertram has no significant fears. He's emotionally resolved, comfortable with mortality, secure in his identity, and at peace with his life choices. This absence of fear is part of what makes him remarkable - he's genuinely content."
  }
}
```

##### core:goals
```json
{
  "core:goals": {
    "shortTerm": [
      "Find someone for reciprocal services - a fair exchange with no romantic complications",
      "Complete the saddle commission for the merchant's daughter",
      "Maintain the quality of his leatherwork"
    ],
    "longTerm": [
      "Continue living contentedly with simple pleasures",
      "Preserve his craft and possibly teach an apprentice",
      "Maintain his health and capability for as long as possible"
    ],
    "notes": "Bertram's goals are modest and achievable. He's not seeking transformation or grand achievement - just continued contentment and useful work."
  }
}
```

##### core:secrets
```json
{
  "core:secrets": {
    "values": [],
    "notes": "Bertram has no secrets. He's radically transparent - what he wants, what he thinks, what he feels, all of it is openly stated. Even his 'reciprocal services' posting is completely public. This absence of hidden aspects is his defining characteristic."
  }
}
```

##### core:internal_tensions
```json
{
  "core:internal_tensions": {
    "values": [
      "Physical needs without romantic prospects - Resolved via practical posting for reciprocal services"
    ],
    "notes": "Bertram had one internal tension (sexual needs vs. no desire for romance) and solved it practically. He's not in ongoing conflict with himself - he identifies problems and addresses them directly."
  }
}
```

#### 5.3 Physical & Anatomical Components

##### anatomy:body
```json
{
  "anatomy:body": {
    "recipeId": "fantasy:bertram_the_muddy_recipe"
  }
}
```

#### 5.4 Knowledge & Notes Components

##### core:notes
```json
{
  "core:notes": {
    "subjects": [
      {
        "id": "fantasy:notice_reciprocal_services",
        "subject": "Reciprocal Services Posting",
        "subjectType": "entity",
        "content": "I posted this notice at the Municipal Aid Registry. It's straightforward - I'm willing to provide a service in exchange for receiving the same. Fair trade, consenting adults, no complications. Some people seem confused by it, but I don't see why. If two people can help each other meet a need, why complicate it with romance neither of us wants?"
      },
      {
        "id": "anna_belmont",
        "subject": "Anna (Deceased Wife)",
        "subjectType": "person",
        "content": "My wife Anna was a weaver. We married when I was 24, and we had thirty good years together before winter fever took her six years ago. She had a laugh that made the shop feel warmer, and she never minded the smell of the tannery on me. I miss her, and I always will, but I mourned properly and moved forward. She wouldn't have wanted me stuck in grief. I'm grateful for what we had - not everyone gets that kind of partnership."
      },
      {
        "id": "leatherworking_craft",
        "subject": "Leatherworking",
        "subjectType": "profession",
        "content": "I've been working leather for over thirty years. Saddles, belts, boots, bags - all of it honestly made, fairly priced, and built to last. The work gets into you - under your nails, into your skin, into your clothes. But I take pride in it. When someone buys one of my saddles, they're getting quality that'll outlast them if they treat it right. That's worth the staining."
      },
      {
        "id": "mudbrook_community",
        "subject": "Mudbrook Community",
        "subjectType": "location",
        "content": "I've lived in Mudbrook all my life. People know me - they know my work is good, they know I'm honest in my dealings, and yes, they know about my posting. Most folks don't seem bothered by it. I'm a respected community member despite being unconventional. That says something good about Mudbrook."
      }
    ]
  }
}
```

#### 5.5 System Components

##### core:actor
```json
{
  "core:actor": {}
}
```

##### core:player_type
```json
{
  "core:player_type": {
    "type": "npc"
  }
}
```

##### core:perception_log
```json
{
  "core:perception_log": {
    "entries": []
  }
}
```

---

## 6. Validation Requirements

### Recipe Validation

**Command**: `npm run validate:recipe`
**Script**: `scripts/validate-recipe.js` → `scripts/validate-recipe-v2.js`
**Schema**: `data/schemas/anatomy.recipe.schema.json`

**Requirements**:
- ✅ Recipe file must have valid `recipeId` in format `modId:identifier`
- ✅ Must reference valid `blueprintId`: `anatomy:human_male`
- ✅ All descriptor values must match enum constraints
- ✅ Free-form descriptors (skinColor, smell) can be custom strings
- ✅ All `slots` must reference valid part entity IDs
- ✅ Recipe structure must conform to schema

**Expected Validation Success**:
```bash
npm run validate:recipe
# Should output: "Recipe validation passed for bertram_the_muddy.recipe.json"
```

### Character Entity Validation

**Schema**: Character schema (check `data/schemas/` for specific character schema)
**Requirements**:
- ✅ All component IDs must be valid registered components
- ✅ Component data must conform to component schemas
- ✅ Reference to recipe must resolve: `fantasy:bertram_the_muddy_recipe`
- ✅ All entity references in notes must exist (e.g., `fantasy:notice_reciprocal_services`)

### Clothing Entity Validation

**Schema**: Clothing schemas for garment components
**Requirements**:
- ✅ `clothing:garment` must specify valid slot and layer
- ✅ `clothing:material` must have valid material types
- ✅ `clothing:condition` must have valid condition states
- ✅ `clothing:appearance` must have valid visual properties

### Testing Requirements

**Per User Request**:
- ✅ **Recipe validation ONLY**: Must pass `npm run validate:recipe`
- ❌ **NO comprehensive character testing required**
- ❌ **NO comprehensive clothing testing required**
- ❌ **Portrait creation handled externally** (not in scope)

**Minimal Validation Approach**:
1. Validate recipe structure and blueprint reference
2. Ensure mod manifests are updated correctly
3. Verify all file references resolve
4. No need for gameplay testing or integration tests

---

## 7. Implementation Checklist

### Phase 1: Recipe Creation

- [ ] Create `data/mods/fantasy/recipes/bertram_the_muddy.recipe.json`
  - [ ] Set `recipeId`: `fantasy:bertram_the_muddy_recipe`
  - [ ] Set `blueprintId`: `anatomy:human_male`
  - [ ] Define body descriptors (height, build, composition, hairDensity, skinColor, smell)
  - [ ] Configure all anatomy slots with part entity references
  - [ ] **Run validation**: `npm run validate:recipe`

### Phase 2: Anatomy Part Entities (If Needed)

- [ ] Check existing anatomy parts in `data/mods/anatomy/entities/definitions/`
- [ ] Create new anatomy parts only if existing ones don't match Bertram's features:
  - [ ] `human_hair_brown_grey_short_practical.entity.json` (if needed)
  - [ ] `humanoid_face_bearded_full_trimmed.entity.json` (if needed)
  - [ ] `human_male_torso_working_build.entity.json` (if needed)
  - [ ] `humanoid_arm_weathered_tannery_stained.entity.json` (if needed)
  - [ ] `humanoid_hand_craftsman_stained.entity.json` (MOST IMPORTANT - may need to create)

### Phase 3: Clothing Creation

- [ ] Create `data/mods/clothing/entities/definitions/leather_work_apron.entity.json`
  - [ ] Define `clothing:garment` component (slot: torso_upper, layer: outer)
  - [ ] Define `clothing:material` component (thick leather)
  - [ ] Define `clothing:condition` component (good integrity, well-worn)
  - [ ] Define `clothing:appearance` component (tan-brown with darker stains)
  - [ ] Define `core:visual_properties` component (detailed description)
- [ ] Create `data/mods/clothing/entities/instances/leather_work_apron.entity.json`

### Phase 4: Character Entity Creation

- [ ] Create `data/mods/fantasy/entities/definitions/bertram_the_muddy.character.json`
  - [ ] Add all core identity components (name, apparent_age, profile)
  - [ ] Add all personality components (personality, speech_patterns, strengths, weaknesses)
  - [ ] Add all preference components (likes, dislikes, fears, goals, secrets, internal_tensions)
  - [ ] Add anatomy reference: `anatomy:body` → `fantasy:bertram_the_muddy_recipe`
  - [ ] Add knowledge components (core:notes with 4 subjects)
  - [ ] Add system components (core:actor, core:player_type, core:perception_log)
- [ ] Create `data/mods/fantasy/entities/instances/bertram_the_muddy.character.json`
  - [ ] Set initial state (location, equipped clothing inventory)
  - [ ] Include all 7 clothing items (underwear, pants, shirt, apron, belt, socks, boots)

### Phase 5: Mod Manifest Updates

- [ ] Update `data/mods/fantasy/mod-manifest.json`
  - [ ] Add recipe to appropriate manifest section
  - [ ] Add character entity definition and instance references
  - [ ] Verify dependency chain is correct
- [ ] Update `data/mods/clothing/mod-manifest.json`
  - [ ] Add leather work apron definition and instance references

### Phase 6: Final Validation

- [ ] **Run recipe validation**: `npm run validate:recipe`
- [ ] Verify no validation errors
- [ ] Spot-check all file references resolve
- [ ] Confirm mod manifests load without errors

### Phase 7: Integration (Optional)

- [ ] Add Bertram to world/location if needed (e.g., Mudbrook Municipal Aid Registry)
- [ ] Create portrait externally (out of scope for this spec)
- [ ] Verify character appears in game and is interactable

---

## 8. Special Implementation Notes

### Critical Features to Preserve

1. **Permanent Tannery Staining**: The tan-brown skin discoloration is Bertram's most distinctive physical feature. This must be captured in:
   - Recipe `skinColor` descriptor: `"weathered tan with brown tannery staining"`
   - Profile description emphasizing the staining never washes out
   - Anatomy parts (arms, hands) showing chemical discoloration

2. **Craftsman's Hands**: Bertram's hands are critical character details:
   - Broad and strong from decades of leatherwork
   - Specific callus patterns from tools and leather
   - Dark crescents under fingernails from embedded dyes
   - "All digits functional" (source of pride)
   - These hands tell his professional story

3. **Radical Sincerity**: Bertram's character essence is complete transparency:
   - No secrets component (empty array)
   - No hidden depths in personality
   - Direct, clear speech patterns
   - What you see is what you get

4. **Professional Smell**: The faint chemical smell is permanent:
   - Recipe `smell` descriptor: `"leather oils and curing agents"`
   - Not unpleasant, just persistently present
   - Professional marker that defines him

5. **Emotional Health**: Bertram has processed grief properly:
   - No ongoing internal conflicts
   - Grateful for his marriage to Anna, not stuck in grief
   - Practical approach to current needs
   - Zero shame or crisis

### Contrast to Vespera Nightwhisper

Bertram is designed as a fascinating contrast to complex characters like Vespera:

| Aspect | Vespera | Bertram |
|--------|---------|---------|
| **Identity** | Layers, contradictions, performed | Transparent, no layers, just IS |
| **Complexity** | Hidden depths, secrets, tensions | What you see is what you get |
| **Approach** | Artistic, symbolic, mysterious | Practical, literal, straightforward |
| **Sexuality** | Complex, intertwined with identity | Matter-of-fact, a need to be met |
| **Grief** | Ongoing, shapes identity | Processed, moved forward healthily |
| **Self-Awareness** | Constant questioning of self | Zero questioning - knows who he is |

This contrast makes Bertram fascinating - he represents radical authenticity without performance.

### Connection to Existing Content

- **Notice**: `fantasy:notice_reciprocal_services` - Bertram's posting at Municipal Aid Registry
- **Location**: Mudbrook-on-the-Bend / Mudbrook Municipal Aid Registry
- **Community**: Respected member despite unconventional approach
- **Vespera**: Potential interaction - her complexity vs. his simplicity creates interesting dynamic

---

## 9. Reference Material

### Male Blueprint Reference

**Primary Reference**: `data/mods/patrol/recipes/dylan_crace.recipe.json`
- Uses `anatomy:human_male` blueprint correctly
- Shows proper male anatomy slot configuration
- Includes penis and testicles via blueprint-defined sockets

**Incorrect Example**: `data/mods/patrol/recipes/len_amezua.recipe.json`
- Uses `anatomy:human_female` blueprint (appears to be an error)
- Do NOT follow this pattern

### Character Specification Template

**Primary Template**: `specs/threadscar-melissa-character-spec.md`
- Shows complete specification format
- Includes rationale tables for all decisions
- Documents anatomy slots, clothing, validation
- Provides implementation checklist

### Female Character References

**Vespera Nightwhisper**: `data/mods/fantasy/entities/definitions/vespera_nightwhisper.character.json`
- Complex character with layers and secrets
- Multiple internal tensions
- Rich speech patterns and personality

**Threadscar Melissa**: `data/mods/fantasy/entities/definitions/threadscar_melissa.character.json`
- Combat-focused character
- Practical approach similar to Bertram
- Good reference for straightforward personality

---

## 10. Future Expansion Possibilities

### Potential Character Development

1. **Apprentice Relationship**: Bertram could take on an apprentice, teaching leatherwork
2. **Reciprocal Services Storyline**: Interaction with respondents to his posting
3. **Vespera Interaction**: Fascinating dynamic between complex artist and simple craftsman
4. **Guild Involvement**: Integration with leatherworkers' guild or trade organization
5. **Community Events**: Mudbrook events where Bertram's practical wisdom helps others

### Potential Questlines

1. **The Honest Trade**: Help Bertram navigate responses to his unconventional posting
2. **Master Craftsman**: Assist with special commission or preserve lost leatherworking technique
3. **Anna's Memory**: Help Bertram donate Anna's weaving tools to young craftswoman
4. **Teaching Sincerity**: Bertram helps overly complex character learn to be direct
5. **Fair Exchange**: Bertram mediates community dispute with his transactional wisdom

---

## Document Metadata

**Specification Version**: 1.0
**Created**: 2025-01-23
**Character Designer**: Based on brainstorming document
**Implementation Status**: Pending
**Validation Status**: Not yet validated

---

## Appendix A: Quick Reference

### Key File Paths

```
Recipe:
  data/mods/fantasy/recipes/bertram_the_muddy.recipe.json

Character:
  data/mods/fantasy/entities/definitions/bertram_the_muddy.character.json
  data/mods/fantasy/entities/instances/bertram_the_muddy.character.json

Clothing (NEW):
  data/mods/clothing/entities/definitions/leather_work_apron.entity.json
  data/mods/clothing/entities/instances/leather_work_apron.entity.json

Manifests to Update:
  data/mods/fantasy/mod-manifest.json
  data/mods/clothing/mod-manifest.json
```

### Validation Commands

```bash
# Validate recipe (REQUIRED)
npm run validate:recipe

# General mod validation
npm run validate

# Strict validation
npm run validate:strict
```

### Character Essence Summary

**In One Sentence**: Bertram the Muddy is a 53-year-old master leatherworker whose radical sincerity, permanent tannery staining, and complete lack of performative identity make him a fascinatingly simple contrast to complex characters - he just IS, without drama or hidden depths.

**Key Quote**: "I don't understand why people perform who they are. Just be yourself - it's simpler and takes less energy."

---

*End of Specification Document*
