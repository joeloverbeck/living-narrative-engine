# Registry Ledger Entity Design Specification

## Overview

This specification documents the design of a registry ledger entity for Registrar Copperplate in the fantasy mod. The ledger serves as a thematically-appropriate writing implement that reflects the character's bureaucratic nature and centuries of archival work.

## Requirements Analysis

### Character Context: Registrar Copperplate

**Core Characteristics:**

- **Age & Experience**: 312 years old, 147 years of service at Mudbrook Aid Registry
- **Operational Speed**: Glacially slow, operates on geological timescales
- **Professional Focus**: Procedurally obsessed, rules are absolute, no exceptions
- **Archival Philosophy**: Alphabetical permanence, meticulous filing, institutional memory
- **Emotional Demeanor**: Treats all matters with equal solemn professionalism (dragon-slaying = chicken complaint)
- **Physical Traits**: Ink-stained claws from decades of archival work
- **Biological Constraints**: Cold weather slows processing speed further

**Speech Pattern** (NOT reflected in writing):

- Extensive ellipses and pauses
- Formal archaic phrasing
- Bureaucratic passive voice
- Maddeningly literal interpretations

**Writing Style** (polished final product):

- Bureaucratic precision without ellipses
- Institutional formality
- Archival permanence
- Emotional neutrality
- Meticulous detail

### Reference Pattern: Field Notebook (patrol mod)

**Source Files Analyzed:**

- `data/mods/patrol/entities/definitions/len_amezua.character.json`
- `data/mods/patrol/entities/definitions/field_notebook.entity.json`

**Pattern Identified:**

```json
{
  "components": {
    "core:name": { "text": "descriptive name" },
    "core:description": { "text": "physical appearance and notable features" },
    "items:item": {},
    "items:portable": {},
    "items:weight": { "weight": 0.3 },
    "items:readable": { "text": "character-appropriate content" }
  }
}
```

**Key Insights from Field Notebook:**

- `items:readable` contains rich, character-appropriate text
- Content reflects character's voice, concerns, and documentation style
- Personal commentary mixed with professional observations
- Physical description emphasizes usability and character connection

### Thematic Requirements

**Thematic Contrast:**

- **Field Notebook** (Len Amezua): Personal, urgent, unauthorized, whistleblowing tone
- **Registry Ledger** (Copperplate): Official, glacial, authorized, institutionally neutral

**Functional Requirements:**

1. Must be portable (carried/moved by Copperplate)
2. Must contain readable text accessible to players
3. Must reflect bureaucratic nature and archival purpose
4. Must demonstrate institutional permanence across decades
5. Physical appearance must suggest official, permanent record-keeping

## Entity Design

### Entity Definition

**Entity ID**: `fantasy:registry_ledger`

**File Location**: `data/mods/fantasy/entities/definitions/registry_ledger.entity.json`

### Component Structure

#### 1. core:name

```json
{
  "text": "registry ledger"
}
```

**Rationale**: Simple, official terminology. "Registry" emphasizes institutional purpose; "ledger" suggests permanent record-keeping (vs. temporary "notebook").

#### 2. core:description

```json
{
  "text": "A massive leather-bound ledger with copper-plated corners and spine reinforcements. The pages are yellowed with age, filled with meticulous handwriting in faded brown ink. Numerous colored bookmarks protrude from the edges, marking sections of particular bureaucratic importance. The cover bears the embossed seal of the Mudbrook Aid Registry, worn smooth by centuries of handling."
}
```

**Design Elements:**

- **Materials**: Leather-bound, copper-plated (matches "Copperplate" name, suggests durability)
- **Age Indicators**: Yellowed pages, faded ink, worn seal (centuries of use)
- **Organization**: Colored bookmarks (meticulous filing system)
- **Authority**: Official seal (institutional legitimacy)
- **Weight**: "Massive" sets expectation for physical heft

#### 3. items:item

```json
{}
```

**Purpose**: Marks entity as a portable item in the game system.

#### 4. items:portable

```json
{}
```

**Purpose**: Indicates entity can be carried/moved by characters.

#### 5. items:weight

```json
{
  "weight": 2.5
}
```

**Rationale**:

- 2.5 kg vs. 0.3 kg for field notebook
- Reflects official, permanent nature
- Large format ledger with many pages
- Heavy enough to feel substantial but portable
- Matches "massive" description

#### 6. items:readable

**Content Structure:**

```
REGISTRY LEDGER
Official Archive of the Mudbrook Aid Registry
Master Copy, commenced Year 1638

=== Filing Entry 1784.03.07 ===
Form 3, Subsection A: Marriage contract received and processed.
Processing duration: 17 minutes, 40 seconds.
Filed alphabetically under proper designation.
All procedures followed correctly.

=== Filing Entry 1784.03.09 ===
Form 7, Section B: Contract for handjob services received.
All supplementary documentation attached and verified.
Exemplary completeness demonstrated by submitting party.
Filed under B (Bertram). Alphabetical permanence maintained.

=== Filing Entry 1785.08.02 ===
Backlog Reduction Initiative: Status Report.
Current backlog: 37 years behind schedule.
Projected completion date: Year 1792.
This timeline is acceptable given proper procedural adherence.
Steady progress maintained.

=== Filing Entry 1786.01.15 ===
Environmental Impact Assessment: Winter Operations.
Cold weather conditions extend processing times significantly.
Average pause duration increased to 3.7 minutes per entry.
Brazier heating essential for continued operations.
Temperature-dependent biology limits productivity during winter months.
Mammals demonstrate insufficient understanding of this constraint.

=== Filing Entry 1787.06.21 ===
Form 12: Dragon-slaying contract received.
Three witnesses verified. Official seal authenticated.
Filed with same procedural care as previous day's chicken complaint (Form 8A).
Content of contract irrelevant to archival duty.
All documentation receives equal methodical processing.

=== Filing Entry 1788.11.03 ===
Institutional Knowledge Observation.
147 years of continuous service completed.
Every family secret in Mudbrook documented and filed.
Marriages, divorces, disputes, contracts spanning six generations.
The archive remembers what individuals forget.
This is the permanence we maintain.

=== Archival Philosophy ===
Every document receives equal methodical care.
Future generations will require these records.
This is the duty I uphold.
This is what I maintain across centuries.
The procedures remain constant while mammals panic and perish.
The archive continues.

Two hundred years of service remain before retirement.
The work is never complete.
This is acceptable.

=== END ARCHIVE ENTRIES ===
```

**Writing Style Characteristics:**

1. **Bureaucratic Precision**
   - Form numbers and subsections
   - Exact timestamps and durations
   - Procedural terminology
   - Filing location details

2. **Institutional Formality**
   - Official passive voice
   - Archival phrasing meant for permanence
   - Professional neutrality
   - Systematic organization

3. **Emotional Neutrality**
   - Dragon-slaying = chicken complaint (equal procedural weight)
   - Handjob contract = marriage contract (no judgment)
   - Personal observations stated factually
   - No urgency or alarm

4. **Temporal Scale**
   - Multi-decade backlogs treated as routine
   - 147 years of service noted matter-of-factly
   - 200 years remaining before retirement
   - Geological patience

5. **Character Details**
   - Temperature-dependent biology
   - Mammalian incomprehension
   - Ink-stained claws (implied through meticulous handwriting)
   - Institutional memory spanning generations

**Key Design Decision:**
The writing contains **NO ellipses**. This reflects the polished final product of Copperplate's work, not his halting speech pattern. The ledger represents professional bureaucratic prose meant to endure centuries.

## Thematic Analysis

### Contrast with Field Notebook

| Aspect        | Field Notebook (Len)               | Registry Ledger (Copperplate)   |
| ------------- | ---------------------------------- | ------------------------------- |
| **Purpose**   | Personal documentation             | Official record-keeping         |
| **Authority** | Unauthorized, whistleblowing       | Authorized, institutional       |
| **Tone**      | Urgent, concerned, emotional       | Glacial, neutral, procedural    |
| **Timeframe** | Days and weeks                     | Decades and centuries           |
| **Content**   | Warning, documentation of failures | Routine filing, archival duty   |
| **Audience**  | Future investigators               | Future archivists               |
| **Weight**    | 0.3 kg (portable, urgent)          | 2.5 kg (substantial, permanent) |
| **Emotion**   | Fear, frustration, duty            | None, pure procedure            |

### Character Coherence

The registry ledger reinforces Copperplate's character through:

1. **Physical Design**: Copper-plated corners echo his name
2. **Content Style**: Bureaucratic precision matches his speech formality
3. **Temporal Scale**: Multi-decade entries reflect his 312-year lifespan
4. **Emotional Neutrality**: Equal treatment of all matters matches his demeanor
5. **Institutional Focus**: Archive permanence reflects his life's work
6. **Biological Details**: Temperature sensitivity documented factually

## Implementation Guidance

### File Creation

**Location**: `data/mods/fantasy/entities/definitions/registry_ledger.entity.json`

**Schema Compliance**: Must validate against `schema://living-narrative-engine/entity-definition.schema.json`

### Integration Points

1. **Character Recipe**: `data/mods/fantasy/entities/definitions/registrar_copperplate.recipe.json`
   - Add registry_ledger to Copperplate's starting inventory or nearby location
   - Ensure entity is accessible in initial scenario

2. **Mod Manifest**: `data/mods/fantasy/mod-manifest.json`
   - Entity will be automatically discovered during mod loading
   - No manual manifest updates required

### Testing Recommendations

1. **Schema Validation**

   ```bash
   npm run validate
   ```

2. **Component Testing**
   - Verify `items:readable` content displays correctly
   - Test `items:portable` functionality (can be picked up/moved)
   - Confirm `items:weight` affects inventory appropriately

3. **Integration Testing**
   - Load fantasy mod with registrar_copperplate.recipe.json
   - Verify ledger appears in scenario
   - Test reading ledger content in-game

4. **Character Coherence Testing**
   - Compare ledger content tone with Copperplate's dialogue
   - Verify thematic consistency with character persona
   - Confirm absence of ellipses in written content

## Appendix: Complete Entity Definition

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "fantasy:registry_ledger",
  "description": "Official registry ledger used by Registrar Copperplate for archival work",
  "components": {
    "core:name": {
      "text": "registry ledger"
    },
    "core:description": {
      "text": "A massive leather-bound ledger with copper-plated corners and spine reinforcements. The pages are yellowed with age, filled with meticulous handwriting in faded brown ink. Numerous colored bookmarks protrude from the edges, marking sections of particular bureaucratic importance. The cover bears the embossed seal of the Mudbrook Aid Registry, worn smooth by centuries of handling."
    },
    "items:item": {},
    "items:portable": {},
    "items:weight": {
      "weight": 2.5
    },
    "items:readable": {
      "text": "REGISTRY LEDGER\nOfficial Archive of the Mudbrook Aid Registry\nMaster Copy, commenced Year 1638\n\n=== Filing Entry 1784.03.07 ===\nForm 3, Subsection A: Marriage contract received and processed.\nProcessing duration: 17 minutes, 40 seconds.\nFiled alphabetically under proper designation.\nAll procedures followed correctly.\n\n=== Filing Entry 1784.03.09 ===\nForm 7, Section B: Contract for handjob services received.\nAll supplementary documentation attached and verified.\nExemplary completeness demonstrated by submitting party.\nFiled under B (Bertram). Alphabetical permanence maintained.\n\n=== Filing Entry 1785.08.02 ===\nBacklog Reduction Initiative: Status Report.\nCurrent backlog: 37 years behind schedule.\nProjected completion date: Year 1792.\nThis timeline is acceptable given proper procedural adherence.\nSteady progress maintained.\n\n=== Filing Entry 1786.01.15 ===\nEnvironmental Impact Assessment: Winter Operations.\nCold weather conditions extend processing times significantly.\nAverage pause duration increased to 3.7 minutes per entry.\nBrazier heating essential for continued operations.\nTemperature-dependent biology limits productivity during winter months.\nMammals demonstrate insufficient understanding of this constraint.\n\n=== Filing Entry 1787.06.21 ===\nForm 12: Dragon-slaying contract received.\nThree witnesses verified. Official seal authenticated.\nFiled with same procedural care as previous day's chicken complaint (Form 8A).\nContent of contract irrelevant to archival duty.\nAll documentation receives equal methodical processing.\n\n=== Filing Entry 1788.11.03 ===\nInstitutional Knowledge Observation.\n147 years of continuous service completed.\nEvery family secret in Mudbrook documented and filed.\nMarriages, divorces, disputes, contracts spanning six generations.\nThe archive remembers what individuals forget.\nThis is the permanence we maintain.\n\n=== Archival Philosophy ===\nEvery document receives equal methodical care.\nFuture generations will require these records.\nThis is the duty I uphold.\nThis is what I maintain across centuries.\nThe procedures remain constant while mammals panic and perish.\nThe archive continues.\n\nTwo hundred years of service remain before retirement.\nThe work is never complete.\nThis is acceptable.\n\n=== END ARCHIVE ENTRIES ==="
    }
  }
}
```

## Revision History

- **Version 1.0** (Initial): Design specification created based on analysis of field_notebook pattern and Registrar Copperplate character
- **Key Decision**: Writing style contains no ellipses (polished product vs. speech pattern)

## References

- `data/mods/patrol/entities/definitions/len_amezua.character.json`
- `data/mods/patrol/entities/definitions/field_notebook.entity.json`
- `data/mods/fantasy/entities/definitions/registrar_copperplate.character.json`
- `data/mods/fantasy/entities/definitions/registrar_copperplate.recipe.json`
