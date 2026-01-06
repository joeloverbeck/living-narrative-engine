# Expressions to add

Analyze the existing expressions in data/mods/emotions/expressions/ to have an idea for how to implement these expressions.

## Attachment Swell

Priority: 74
Prerequisites: sexualStates.love_attachment >= 0.65 AND emotions.affection >= 0.55 AND (sexualStates.love_attachment - previousSexualStates.love_attachment) >= 0.12
Actor description: A protective softness spreads through me. I want them okay. I want to stay close enough to matter. My voice gentles without me deciding to. My shoulders loosen; I lean in a fraction as if proximity is reassurance.
General description: {actor} stays subtly close to their target of affection, attention tuned toward them in a protective, warm way.

## Aroused but ashamed conflict

Priority: 88
Prerequisites: sexualStates.aroused_but_ashamed >= 0.65 AND sexualStates.sexual_lust >= 0.45 AND emotions.shame >= 0.45
Actor description: My attention keeps snapping back to my target of arousal, and then I hate myself for it. I want to hide my reaction and I can't unfeel it. If I speak, my words will come out overly careful, like I'm trying to sound normal at gunpoint. Heat rises to my face; my hands stay busy with anything that looks casual.
General description: {actor} looks conflicted—avoiding eye contact, then glancing back, posture tense as if suppressing a reaction.
Auditory: I catch an unsteady breath and a voice that hesitates around simple sentences.