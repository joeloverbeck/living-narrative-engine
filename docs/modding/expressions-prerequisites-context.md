  Context Keys + Values

  - actor: object from createEntityContext (src/logic/contextAssembler.js)
      - actor.id: the actor entity id passed to buildContext.
      - actor.components: a proxy accessor (src/logic/componentAccessor.js)
          - actor.components.<componentType>: the component data for the actor or null if missing.
          - If component lookup throws, returns { error: ComponentAccessorError }.
          - Available <componentType> values are whatever component types the actor entity has at runtime (dynamic per entity).
  - emotions: object mapping emotion names to intensity numbers (0..1) computed by EmotionCalculatorService
      - Keys from data/mods/core/lookups/emotion_prototypes.lookup.json:
          - calm, contentment, relief, confidence, joy, euphoria, enthusiasm, amusement, awe, inspiration, aesthetic_appreciation, interest, curiosity,
            fascination, flow, entrancement, hope, optimism, determination, anticipation, sadness, grief, disappointment, despair, numbness, fatigue, loneliness,
            nostalgia, boredom, apathy, unease, stress, anxiety, craving, thrill, fear, terror, dread, hypervigilance, courage, alarm, suspicion, irritation,
            frustration, anger, rage, resentment, contempt, disgust, cynicism, pride, triumph, shame, embarrassment, awkwardness, guilt, regret, humiliation,
            submission, envy, trusting_surrender, jealousy, trust, admiration, adoration, gratitude, affection, love_attachment, compassion, empathic_distress,
            hatred, surprise_startle, confusion.
      - Values are normalized intensities computed from mood axes + sexual axes.
  - sexualStates: object mapping sexual state names to intensity numbers (0..1) computed by EmotionCalculatorService
      - Keys from data/mods/core/lookups/sexual_prototypes.lookup.json:
          - sexual_lust, passion, sexual_sensual_pleasure, submissive_arousal, sexual_playfulness, romantic_yearning, sexual_confidence,
            sexual_dominant_pleasure, aroused_with_shame, fearful_arousal, sexual_craving, erotic_thrill, sexual_performance_anxiety, sexual_frustration,
            aroused_with_disgust, sexual_indifference, sexual_repulsion.
      - Values are normalized intensities computed from mood axes + sexual axes.
  - moodAxes: raw mood axis values from the mood component (defaults to 0 if missing)
      - Keys: valence, arousal, agency_control, threat, engagement, future_expectancy, self_evaluation
      - Values: numbers (typically -100..100 based on how mood components are stored).
  - sexualArousal: number in [0..1] or null if no sexual state component
      - Calculated from sex_excitation, sex_inhibition, and baseline_libido.
  - previousEmotions: object with the same keys as emotions
      - Values are numbers; if no previous state is provided, all values are 0.
  - previousSexualStates: object with the same keys as sexualStates
      - Values are numbers; if no previous state is provided, all values are 0.
  - previousMoodAxes: object with the same keys as moodAxes
      - Values are numbers; if no previous state is provided, all values are 0.