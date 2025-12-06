# Distress Gesture Mod Brainstorm Report

**Date**: 2025-02-15
**Purpose**: Evaluate whether the new distress-oriented actions (bury face in hands; clutch target's torso_upper clothing pleadingly) fit existing intimacy mods and outline a concept for a dedicated module with accessible color palettes.

## Current Mod Landscape

### Affection – Gentle Physical Contact

- Manifest focus: offers caring, supportive touch that can remain platonic, emphasizing warmth and comfort rather than distress.【F:data/mods/affection/mod-manifest.json†L5-L44】
- Example action: "Squeeze hand reassuringly" centers on comforting the other person, reinforcing the mod's reassuring tone and Soft Purple color identity.【F:data/mods/affection/actions/squeeze_hand_reassuringly.action.json†L4-L16】

### Caressing – Sensual Touch Actions

- Manifest focus: flirtatious, sensual contact designed to escalate sexual tension, distinct from affection or kissing.【F:data/mods/caressing/mod-manifest.json†L5-L52】
- Example action: "Run Thumb Across Lips" showcases slow, intimate touch that is explicitly romantic, matching the mod's Dark Purple palette.【F:data/mods/caressing/actions/run_thumb_across_lips.action.json†L4-L19】

### Kissing – Romantic Mouth-Based Intimacy

- Manifest focus: exclusively mouth-centric romantic interactions requiring mutual participation, with rules and states built around an ongoing kiss.【F:data/mods/kissing/mod-manifest.json†L5-L83】
- Even boundary-pushing entries such as "Pull back in revulsion" still presuppose an active kiss, keeping the emotional framing within romantic engagement rather than self-directed distress.【F:data/mods/kissing/actions/pull_back_in_revulsion.action.json†L4-L16】

## Gap Analysis for Distress-Laden Gestures

- Both proposed actions communicate vulnerability or overwhelm directed inward or toward the partner, contrasting with the reassurance-forward affection set and the flirtatious cadence of caressing.【F:data/mods/affection/mod-manifest.json†L5-L44】【F:data/mods/caressing/mod-manifest.json†L5-L52】
- The kissing mod's scope requires participants to already be engaged in a kiss, which neither new action assumes; in fact, burying one's face in the hands is solitary, underscoring the thematic gap.【F:data/mods/kissing/mod-manifest.json†L5-L83】
- No existing mod emphasizes desperate or pleading body language, suggesting a dedicated emotional-distress channel can keep tonal clarity across the intimacy suite.

## Mod Naming Brainstorm

1. **Supplication – Pleading Gestures**: Frames the mod around beseeching, emotionally laden movements that seek reassurance, aligning with the proposed clutching action while staying distinct from supportive Affection content.【F:data/mods/affection/mod-manifest.json†L5-L44】
2. **Frayed Composure – Distress Reactions**: Highlights the loss of composure present in burying one's face in their hands, differentiating it from the composed sensuality of Caressing.【F:data/mods/caressing/mod-manifest.json†L5-L52】
3. **Desperate Solace – Vulnerable Body Language**: Emphasizes actions that oscillate between seeking comfort and expressing emotional strain, complementing but not duplicating the romantic reciprocity of Kissing.【F:data/mods/kissing/mod-manifest.json†L5-L83】

## Color Scheme Recommendations

| Priority  | Palette            | Spec Section | Rationale                                                                                                                                                                      |
| --------- | ------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Primary   | **Dark Red Alert** | 6.2          | Conveys urgent emotional strain and high-stakes pleading, reinforcing the distress theme while remaining WCAG AAA compliant.【F:docs/mods/mod-color-schemes.md†L303-L337】     |
| Secondary | **Obsidian Frost** | 11.7         | Offers a contrasting, numbed visual option for actions that depict internalized despair or withdrawn coping, also AAA compliant.【F:docs/mods/mod-color-schemes.md†L655-L668】 |

Both palettes are currently unassigned, so the new mod can adopt them without conflicts while signaling distinct emotional contexts within the UI.【F:docs/mods/mod-color-schemes.md†L44-L337】【F:docs/mods/mod-color-schemes.md†L655-L668】

## Suggested Next Steps

1. Validate naming preference with narrative stakeholders, selecting one theme to guide action phrasing and descriptors.
2. Draft action schema entries using the chosen palette as the visual baseline, ensuring torso_upper clothing references align with clothing slot semantics.
3. Plan complementary actions (e.g., trembling grip, whispered plea) to round out the mod before implementation.
