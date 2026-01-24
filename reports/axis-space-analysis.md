Axis Space Analysis
Prototypes Analyzed:
108
Recommendations:
8
Confidence:
medium
(?)
Confidence reflects how many independent detection methods agree: Low (0-1 methods), Medium (2 methods), High (3-4 methods).

New Axis Recommended?
MAYBE
Residual variance (30.3%) exceeds 15% threshold, indicating unexplained dimensions. However, no strong secondary signals (coverage gaps, hub prototypes) were detected. Consider reviewing poorly fitting prototypes.

How is this determined?
YES: (High residual AND coverage gaps) OR (Hub prototypes AND multi-axis conflicts)
MAYBE: High residual alone, OR any other single signal
NO: Residual ≤15% AND no detection signals
Important: PCA uses OR logic for triggering. High residual variance (>15%) alone is sufficient for MAYBE verdict, regardless of "Additional Components" count.

Explained by top 4 PCs:
49.1%
Signal Sources
✗ FAIL
PCA Analysis:
1
(residual >15% triggered)
✓ PASS
Hub Prototypes:
0
(no connectors)
✓ PASS
Coverage Gaps:
0
(distance ≤0.6)
✗ FAIL
Multi-Axis Conflicts:
7
(balanced usage)
Detection Logic: PCA signal triggers when residual variance >15% OR additional components >0. Either condition alone is sufficient for triggering INVESTIGATE recommendations.

Dimensionality Analysis (PCA)
Principal Component Analysis reveals whether the current axis set captures prototype variance. High residual variance suggests missing dimensions.

Residual Variance:
30.3%
(?)
Additional Components Suggested:
0
(?)
Dimensions Used:
--
Components for 80% Variance:
10
(?)
Components for 90% Variance:
13
(?)
Extreme Prototypes on Additional Component
Prototypes with highest |projection| on unexplained variance component

spellbound_absorption
2.758
nostalgia
2.507
rage
-2.361
sexual_confidence
-2.256
guilt
-2.240
Poorly Fitting Prototypes
Prototypes with highest reconstruction error (don't fit well in current axis space)

sympathy
RMSE: 1.366
sexual_indifference
RMSE: 1.291
empathic_distress
RMSE: 1.062
nostalgia
RMSE: 0.918
lonely_yearning
RMSE: 0.884
Hub Prototypes
Prototypes connecting multiple clusters may indicate missing dimensions.

No hub prototypes detected.
Coverage Gaps
Prototype clusters distant from all existing axes.

No coverage gaps detected.
Multi-Axis Conflicts
Prototypes using many axes with conflicting signs.

lonely_yearning
Axes: 11
Uses 11 axes with 9% sign balance - complex blend pattern
moral_outrage
Axes: 13
Uses 13 axes with 85% sign balance - complex blend pattern
guilt
Axes: 11
Uses 11 axes with 45% sign balance - complex blend pattern
remorse
Axes: 12
Uses 12 axes with 33% sign balance - complex blend pattern
empathic_distress
Axes: 11
Uses 11 axes with 9% sign balance - complex blend pattern
hatred
Axes: 11
Uses 11 axes with 27% sign balance - complex blend pattern
sexual_performance_anxiety
Axes: 11
Uses 11 axes with 9% sign balance - complex blend pattern
Sign Tensions (Informational)
Note: Mixed positive/negative weights are normal for emotional prototypes. This section shows structural patterns for understanding, not defects requiring action. Sign tensions do not contribute to confidence scoring or recommendations.

calm Informational
6 active axes, 0% balance
+: inhibitory_control, valence
−: arousal, threat, uncertainty
contentment Informational
5 active axes, 20% balance
+: agency_control, valence
−: arousal, threat, uncertainty
release Informational
7 active axes, 14% balance
+: engagement
−: arousal, inhibitory_control, threat
joy Informational
5 active axes, 20% balance
+: arousal, future_expectancy, valence
−: inhibitory_control
euphoria Informational
6 active axes, 33% balance
+: agency_control, arousal, engagement, valence
−: inhibitory_control, self_control
enthusiasm Informational
6 active axes, 33% balance
+: arousal, engagement, future_expectancy, valence
−: inhibitory_control, self_control
amusement Informational
6 active axes, 0% balance
+: arousal, engagement, valence
−: inhibitory_control, threat
awe Informational
7 active axes, 14% balance
+: arousal, engagement, uncertainty, valence
−: agency_control, inhibitory_control, self_control
aesthetic_appreciation Informational
9 active axes, 33% balance
+: engagement, valence
−: arousal, threat
fascination Informational
5 active axes, 20% balance
+: arousal, engagement, valence
−: inhibitory_control
entranced Informational
8 active axes, 25% balance
+: engagement, uncertainty
−: agency_control, arousal, inhibitory_control, self_control, threat
transfixed Informational
8 active axes, 0% balance
+: arousal, engagement, uncertainty
−: agency_control, inhibitory_control, self_control, threat
quiet_absorption Informational
8 active axes, 0% balance
+: engagement, inhibitory_control, self_control, valence
−: agency_control, arousal, threat, uncertainty
spellbound_absorption Informational
8 active axes, 25% balance
+: engagement, uncertainty
−: agency_control, arousal, inhibitory_control, self_control, threat
focused_absorption Informational
7 active axes, 14% balance
+: agency_control, engagement, inhibitory_control, self_control
−: arousal, threat, uncertainty
grief Informational
7 active axes, 14% balance
+: engagement, rumination, ruminative_tendency
−: agency_control, arousal, temporal_orientation, valence
numbness Informational
6 active axes, 33% balance
+: inhibitory_control, self_control
−: arousal, engagement, future_expectancy, valence
lonely_yearning Informational
11 active axes, 9% balance
+: affiliation, engagement, future_expectancy, temporal_orientation
−: self_evaluation, threat, valence
nostalgia Informational
7 active axes, 14% balance
+: affiliation, engagement, valence
−: temporal_orientation, threat
apathy Informational
6 active axes, 33% balance
+: inhibitory_control, self_control
−: arousal, engagement, future_expectancy, valence
unease Informational
6 active axes, 33% balance
+: threat
−: valence
apprehension Informational
9 active axes, 33% balance
+: inhibitory_control, self_control, temporal_orientation, threat
−: future_expectancy
stress_acute Informational
9 active axes, 33% balance
+: arousal, engagement, threat
−: agency_control, future_expectancy, inhibitory_control, self_control, valence
strain_chronic Informational
9 active axes, 33% balance
+: inhibitory_control, self_control, threat
−: agency_control, arousal, engagement, future_expectancy, valence
anxiety Informational
9 active axes, 11% balance
+: arousal, temporal_orientation, threat, uncertainty
−: agency_control, future_expectancy, inhibitory_control, self_control, valence
craving Informational
8 active axes, 0% balance
+: arousal, engagement
−: agency_control, inhibitory_control, self_control, valence
thrill Informational
5 active axes, 20% balance
+: arousal, threat, valence
−: inhibitory_control, self_control
fear Informational
6 active axes, 33% balance
+: arousal, threat
−: agency_control, inhibitory_control, self_control, valence
terror Informational
7 active axes, 14% balance
+: arousal, engagement, threat
−: agency_control, inhibitory_control, self_control, valence
panic Informational
8 active axes, 25% balance
+: arousal, engagement, threat
−: agency_control, future_expectancy, inhibitory_control, self_control, valence
dread Informational
9 active axes, 33% balance
+: arousal, temporal_orientation, threat
−: agency_control, future_expectancy, inhibitory_control, self_control, uncertainty, valence
alarm Informational
6 active axes, 33% balance
+: arousal, inhibitory_control, self_control, threat
−: agency_control, valence
freeze Informational
7 active axes, 14% balance
+: engagement, inhibitory_control, self_control, threat
−: agency_control, valence
suspicion Informational
5 active axes, 20% balance
+: engagement, threat, uncertainty
−: affiliation, valence
irritation Informational
5 active axes, 20% balance
+: arousal
−: inhibitory_control, self_control, valence
frustration Informational
6 active axes, 33% balance
+: arousal, engagement
−: agency_control, inhibitory_control, self_control, valence
smoldering_anger Informational
8 active axes, 25% balance
+: agency_control, engagement, inhibitory_control, self_control, threat
−: affiliation, arousal, valence
protest_anger Informational
8 active axes, 25% balance
+: affiliation, agency_control, arousal, engagement, threat
−: valence
rage Informational
7 active axes, 14% balance
+: agency_control, arousal, threat
−: affiliation, inhibitory_control, self_control, valence
wrath Informational
9 active axes, 11% balance
+: agency_control, arousal, engagement
−: affiliation, inhibitory_control, self_control, valence
resentment Informational
10 active axes, 20% balance
+: arousal, engagement, inhibitory_control, rumination, ruminative_tendency, self_control
−: agency_control, self_evaluation, temporal_orientation, valence
disgust Informational
7 active axes, 14% balance
+: arousal, contamination_salience, disgust_sensitivity
−: engagement, inhibitory_control, self_control, valence
shame Informational
6 active axes, 0% balance
+: evaluation_pressure, evaluation_sensitivity, self_control
−: agency_control, self_evaluation, valence
embarrassment Informational
6 active axes, 33% balance
+: arousal, evaluation_pressure, evaluation_sensitivity, self_control
−: self_evaluation, valence
awkwardness Informational
8 active axes, 0% balance
+: arousal, evaluation_pressure, evaluation_sensitivity
−: agency_control, self_control, valence
remorse Informational
12 active axes, 33% balance
+: affective_empathy, affiliation, cognitive_empathy, engagement, harm_aversion, rumination, ruminative_tendency, self_control
−: self_evaluation, temporal_orientation, valence
regret Informational
7 active axes, 14% balance
+: arousal, rumination, ruminative_tendency, self_control
−: self_evaluation, temporal_orientation, valence
humiliation Informational
7 active axes, 14% balance
+: arousal, evaluation_pressure, evaluation_sensitivity, self_control
−: agency_control, self_evaluation, valence
submission Informational
6 active axes, 33% balance
+: engagement, inhibitory_control, self_control, threat
−: agency_control
trusting_surrender Informational
8 active axes, 25% balance
+: engagement, future_expectancy, valence
−: agency_control, inhibitory_control, self_control, threat
jealousy Informational
10 active axes, 20% balance
+: arousal, engagement, threat, uncertainty
−: affiliation, agency_control, inhibitory_control, self_control, self_evaluation, valence
gratitude Informational
6 active axes, 33% balance
+: affiliation, self_control, valence
−: threat
empathic_distress Informational
11 active axes, 9% balance
+: affective_empathy, affiliation, arousal, engagement
−: agency_control, future_expectancy, inhibitory_control, self_control, self_evaluation, valence
hatred Informational
11 active axes, 27% balance
+: agency_control, arousal, engagement, threat
−: affective_empathy, affiliation, cognitive_empathy, harm_aversion, inhibitory_control, self_control, valence
surprise_startle Informational
6 active axes, 0% balance
+: arousal, engagement, threat
−: agency_control, inhibitory_control, self_control
confusion Informational
6 active axes, 33% balance
+: arousal, engagement, inhibitory_control, uncertainty
−: agency_control
sexual_lust Informational
8 active axes, 25% balance
+: arousal, engagement, self_evaluation, sexual_arousal, valence
−: inhibitory_control, self_control, threat
passion Informational
8 active axes, 25% balance
+: arousal, engagement, sexual_arousal, threat, valence
−: agency_control, inhibitory_control, self_control
sexual_sensual_pleasure Informational
7 active axes, 14% balance
+: self_evaluation, sexual_arousal, valence
−: inhibitory_control, self_control, threat
submissive_arousal Informational
8 active axes, 25% balance
+: engagement, inhibitory_control, sexual_arousal, valence
−: agency_control, self_control, threat
sexual_playfulness Informational
8 active axes, 25% balance
+: arousal, engagement, self_evaluation, sexual_arousal, valence
−: inhibitory_control, self_control, threat
aroused_with_shame Informational
8 active axes, 25% balance
+: arousal, sexual_arousal, threat
−: agency_control, inhibitory_control, self_control, self_evaluation, valence
fearful_arousal Informational
7 active axes, 14% balance
+: arousal, sexual_arousal, threat
−: agency_control, inhibitory_control, self_control, valence
sexual_craving Informational
9 active axes, 11% balance
+: arousal, engagement, sexual_arousal
−: agency_control, inhibitory_control, self_control, valence
erotic_thrill Informational
8 active axes, 25% balance
+: arousal, engagement, sexual_arousal, threat, valence
−: inhibitory_control, self_control
sexual_performance_anxiety Informational
11 active axes, 9% balance
+: arousal, evaluation_pressure, evaluation_sensitivity, sexual_arousal, temporal_orientation, uncertainty
−: agency_control, inhibitory_control, self_control, self_evaluation, valence
sexual_frustration Informational
8 active axes, 0% balance
+: arousal, engagement, sexual_arousal, threat
−: agency_control, inhibitory_control, self_control, valence
aroused_with_disgust Informational
8 active axes, 0% balance
+: arousal, contamination_salience, disgust_sensitivity, sexual_arousal
−: inhibitory_control, self_control, self_evaluation, valence
sexual_indifference Informational
7 active axes, 14% balance
+: inhibitory_control, self_control, sex_inhibition
−: arousal, engagement, threat
Axis Recommendations
medium
INVESTIGATE
PCA analysis suggests unexplained variance. Investigate the top-loading prototypes for potential axis candidates.
PCA residual variance ratio: 30.3%,Additional significant components: 0,Top loading prototypes: spellbound_absorption, nostalgia, rage, sexual_confidence, guilt
low
REFINE_EXISTING
Prototype "lonely_yearning" shows multi-axis conflict patterns that may be related to the axis gap.
Active axes: 11,Sign balance: 0.09
low
REFINE_EXISTING
Prototype "moral_outrage" shows multi-axis conflict patterns that may be related to the axis gap.
Active axes: 13,Sign balance: 0.85
low
REFINE_EXISTING
Prototype "guilt" shows multi-axis conflict patterns that may be related to the axis gap.
Active axes: 11,Sign balance: 0.45
low
REFINE_EXISTING
Prototype "remorse" shows multi-axis conflict patterns that may be related to the axis gap.
Active axes: 12,Sign balance: 0.33
low
REFINE_EXISTING
Prototype "empathic_distress" shows multi-axis conflict patterns that may be related to the axis gap.
Active axes: 11,Sign balance: 0.09
low
REFINE_EXISTING
Prototype "hatred" shows multi-axis conflict patterns that may be related to the axis gap.
Active axes: 11,Sign balance: 0.27
low
REFINE_EXISTING
Prototype "sexual_performance_anxiety" shows multi-axis conflict patterns that may be related to the axis gap.
Active axes: 11,Sign balance: 0.09
Flagged Prototypes Analysis
Prototypes flagged by detection methods with their dominant axis weights.

sympathy
High Recon. Error
Top Axes by Weight
cognitive_empathy
+0.800
engagement
+0.500
affiliation
+0.400
valence
+0.300
threat
-0.300
Why flagged: RMSE 1.366 (above 0.5 threshold)
sexual_indifference
High Recon. Error
Top Axes by Weight
sex_inhibition
+0.800
engagement
-0.700
arousal
-0.500
inhibitory_control
+0.500
self_control
+0.500
Why flagged: RMSE 1.291 (above 0.5 threshold)
empathic_distress
High Recon. Error
Top Axes by Weight
affective_empathy
+0.900
valence
-0.750
engagement
+0.750
arousal
+0.600
agency_control
-0.600
Why flagged: RMSE 1.062 (above 0.5 threshold)
nostalgia
High Recon. Error
Top Axes by Weight
engagement
+1.000
temporal_orientation
-0.850
affiliation
+0.500
valence
+0.250
threat
-0.250
Why flagged: RMSE 0.918 (above 0.5 threshold)
lonely_yearning
High Recon. Error
Top Axes by Weight
engagement
+0.900
affiliation
+0.900
valence
-0.600
temporal_orientation
+0.400
future_expectancy
+0.350
Why flagged: RMSE 0.884 (above 0.5 threshold)
spellbound_absorption
Extreme Projection
Top Axes by Weight
engagement
+1.000
agency_control
-0.850
uncertainty
+0.600
arousal
-0.550
inhibitory_control
-0.500
Why flagged: Projection score 2.758 on unexplained component
rage
Extreme Projection
Top Axes by Weight
arousal
+0.950
valence
-0.850
agency_control
+0.750
inhibitory_control
-0.750
self_control
-0.650
Why flagged: Projection score -2.361 on unexplained component
sexual_confidence
Extreme Projection
Top Axes by Weight
sexual_arousal
+0.850
agency_control
+0.750
uncertainty
-0.700
self_evaluation
+0.350
inhibitory_control
+0.300
Why flagged: Projection score -2.256 on unexplained component
guilt
Extreme Projection
Top Axes by Weight
self_evaluation
-0.600
harm_aversion
+0.550
rumination
+0.500
ruminative_tendency
+0.500
affective_empathy
+0.450
Why flagged: Projection score -2.240 on unexplained component
entranced
Extreme Projection
Top Axes by Weight
engagement
+1.000
agency_control
-0.600
threat
-0.500
inhibitory_control
-0.450
uncertainty
+0.400
Why flagged: Projection score 2.124 on unexplained component
confusion
Extreme Projection
Top Axes by Weight
uncertainty
+1.000
engagement
+0.400
arousal
+0.200
agency_control
-0.200
inhibitory_control
+0.200
Why flagged: Projection score 2.122 on unexplained component
dread
Extreme Projection
Top Axes by Weight
temporal_orientation
+0.700
threat
+0.700
future_expectancy
-0.600
valence
-0.500
uncertainty
-0.500
Why flagged: Projection score -2.107 on unexplained component
contempt
Extreme Projection
Top Axes by Weight
agency_control
+0.800
valence
-0.600
affiliation
-0.500
self_control
-0.400
inhibitory_control
-0.300
Why flagged: Projection score -1.989 on unexplained component
sexual_repulsion
Extreme Projection
Top Axes by Weight
sex_inhibition
+0.800
valence
-0.800
contamination_salience
+0.800
disgust_sensitivity
+0.500
inhibitory_control
+0.500
Why flagged: Projection score 1.956 on unexplained component
moral_outrage
high axis loading
Top Axes by Weight
engagement
+0.850
valence
-0.550
affiliation
+0.550
agency_control
+0.450
inhibitory_control
+0.450
Why flagged: high axis loading
remorse
high axis loading
Top Axes by Weight
rumination
+0.800
harm_aversion
+0.700
affective_empathy
+0.550
temporal_orientation
-0.500
ruminative_tendency
+0.500
Why flagged: high axis loading
hatred
high axis loading
Top Axes by Weight
valence
-0.950
affiliation
-0.850
harm_aversion
-0.650
engagement
+0.550
agency_control
+0.550
Why flagged: high axis loading
sexual_performance_anxiety
high axis loading
Top Axes by Weight
sexual_arousal
+0.800
evaluation_pressure
+0.800
uncertainty
+0.700
self_evaluation
-0.500
agency_control
-0.500
Why flagged: high axis loading