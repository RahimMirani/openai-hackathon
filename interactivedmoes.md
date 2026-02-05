{
  "syllabus_summary": {
    "domain": "Fifth-grade science (NGSS-style disciplinary core ideas)",
    "target_level": "Grade 5",
    "top_concepts": [
      "Matter is made of particles and total mass is conserved during changes",
      "Matter and energy flow through ecosystems (plants, animals, decomposers, sun)",
      "Earth systems interactions and observable sky patterns (shadows, day/night, seasons)"
    ],
    "core_skills": [
      "Developing and using models",
      "Planning investigations and analyzing/interpreting data",
      "Using evidence, math/computational thinking, and communication"
    ]
  },
  "interactive_demos": [
    {
      "title": "Mass Keeper Lab",
      "concepts_covered": [
        "Conservation of matter",
        "Physical vs chemical change"
      ],
      "key_inputs": [
        "Select substances to mix",
        "Toggle open vs closed container",
        "Apply heat/cooling or stirring"
      ],
      "key_outputs": [
        "Before/after total mass readout",
        "Particle model animation",
        "Flag for new substance formed or not"
      ],
      "what_it_teaches": "Learners see that total mass stays constant in a closed system even when appearance changes.",
      "core_mechanic": "Deterministic simulation of particle rearrangement and mass accounting",
      "success_condition": "Player predicts post-change mass and substance outcome correctly across trials",
      "failure_condition": "Repeated incorrect predictions of mass conservation or reaction outcomes",
      "build_complexity": "low",
      "estimated_build_time_hours": 6
    },
    {
      "title": "Ecosystem Matter Loop",
      "concepts_covered": [
        "Matter cycling",
        "Energy transfer from sun through food"
      ],
      "key_inputs": [
        "Set sunlight level",
        "Adjust counts of plants/animals/decomposers",
        "Trigger events (drought, overgrazing)"
      ],
      "key_outputs": [
        "Live biomass bars by group",
        "Matter-flow arrows",
        "Energy-source trace for each trophic level"
      ],
      "what_it_teaches": "Learners observe how matter moves through organisms and how food energy originates from sunlight.",
      "core_mechanic": "Turn-based ecosystem state updates with explicit transfer rules",
      "success_condition": "Maintain stable ecosystem balance for N turns while meeting biomass targets",
      "failure_condition": "System collapse (producer crash, consumer starvation, or decomposer bottleneck)",
      "build_complexity": "medium",
      "estimated_build_time_hours": 10
    },
    {
      "title": "Water on Earth Mapper",
      "concepts_covered": [
        "Water distribution on Earth",
        "Data interpretation"
      ],
      "key_inputs": [
        "Allocate water quantities to reservoirs (oceans, ice, groundwater, surface, atmosphere)",
        "Choose chart type",
        "Run quiz mode"
      ],
      "key_outputs": [
        "Percent-by-reservoir charts",
        "Error delta from target distribution",
        "Hint feedback tied to evidence statements"
      ],
      "what_it_teaches": "Learners build evidence-based understanding that most water is in oceans and only small portions are easily accessible freshwater.",
      "core_mechanic": "Puzzle matching with immediate quantitative feedback",
      "success_condition": "Reach target distribution within tolerance in limited attempts",
      "failure_condition": "Exceed attempt/time limit without meeting distribution accuracy",
      "build_complexity": "low",
      "estimated_build_time_hours": 5
    },
    {
      "title": "Earth System Link Builder",
      "concepts_covered": [
        "Geosphere-biosphere-hydrosphere-atmosphere interactions",
        "Cause and effect in systems"
      ],
      "key_inputs": [
        "Select a scenario (rainstorm, erosion, volcanic event, land-use change)",
        "Create causal links among spheres",
        "Set interaction strengths"
      ],
      "key_outputs": [
        "System graph with feedback loops",
        "Time-step impact indicators by sphere",
        "Consistency check against expected patterns"
      ],
      "what_it_teaches": "Learners model how one Earth system component change propagates to others.",
      "core_mechanic": "Graph-based causal simulation with rule validation",
      "success_condition": "Construct a valid interaction model that reproduces scenario outcomes",
      "failure_condition": "Model produces contradictory or non-physical sphere responses",
      "build_complexity": "medium",
      "estimated_build_time_hours": 12
    },
    {
      "title": "Shadow & Stars Predictor",
      "concepts_covered": [
        "Daily shadow changes",
        "Day/night and seasonal star appearance patterns"
      ],
      "key_inputs": [
        "Set date, time, and observer latitude",
        "Move virtual gnomon",
        "Toggle season and hemisphere"
      ],
      "key_outputs": [
        "Shadow length/direction visualization",
        "Daylight duration graph",
        "Night sky star pattern view"
      ],
      "what_it_teaches": "Learners connect repeating sky patterns to time and season, and make testable predictions.",
      "core_mechanic": "Predict-then-simulate cycle with deterministic astronomy rules",
      "success_condition": "Correctly predict pattern outcomes across daily and seasonal challenges",
      "failure_condition": "Prediction accuracy remains below threshold after multiple rounds",
      "build_complexity": "medium",
      "estimated_build_time_hours": 11
    }
  ],
  "recommended_first_demo": {
    "title": "Mass Keeper Lab",
    "why_first": "It is the fastest deterministic prototype with clear win/fail states and directly maps to core fifth-grade matter standards."
  }
}
