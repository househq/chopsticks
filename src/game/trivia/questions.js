// src/game/trivia/questions.js
// Local question bank (offline, deterministic, no external API dependency).

export const TRIVIA_QUESTIONS = [
  {
    id: "gen_001",
    category: "General",
    difficulty: "easy",
    prompt: "What is the capital of Japan?",
    choices: ["Seoul", "Tokyo", "Kyoto", "Osaka"],
    answerIndex: 1,
    explanation: "Tokyo is the capital of Japan."
  },
  {
    id: "gen_002",
    category: "General",
    difficulty: "easy",
    prompt: "How many continents are there on Earth?",
    choices: ["5", "6", "7", "8"],
    answerIndex: 2,
    explanation: "There are 7 continents."
  },
  {
    id: "gen_003",
    category: "General",
    difficulty: "easy",
    prompt: "Which planet is known as the Red Planet?",
    choices: ["Venus", "Mars", "Jupiter", "Mercury"],
    answerIndex: 1
  },
  {
    id: "gen_004",
    category: "General",
    difficulty: "easy",
    prompt: "What do bees primarily collect to make honey?",
    choices: ["Nectar", "Sap", "Salt", "Dew"],
    answerIndex: 0
  },
  {
    id: "gen_005",
    category: "General",
    difficulty: "normal",
    prompt: "Which of these is not a primary color of light (RGB)?",
    choices: ["Red", "Green", "Blue", "Yellow"],
    answerIndex: 3
  },
  {
    id: "gen_006",
    category: "General",
    difficulty: "normal",
    prompt: "Which ocean is the largest?",
    choices: ["Atlantic", "Indian", "Pacific", "Arctic"],
    answerIndex: 2
  },
  {
    id: "gen_007",
    category: "General",
    difficulty: "hard",
    prompt: "What is the chemical symbol for potassium?",
    choices: ["Pt", "Po", "K", "P"],
    answerIndex: 2
  },
  {
    id: "gen_008",
    category: "General",
    difficulty: "hard",
    prompt: "Which year did the first iPhone release?",
    choices: ["2005", "2007", "2009", "2011"],
    answerIndex: 1
  },

  {
    id: "tech_001",
    category: "Tech",
    difficulty: "easy",
    prompt: "What does CPU stand for?",
    choices: ["Central Processing Unit", "Computer Personal Unit", "Core Power Utility", "Central Program Uplink"],
    answerIndex: 0
  },
  {
    id: "tech_002",
    category: "Tech",
    difficulty: "normal",
    prompt: "In web URLs, what does HTTPS add compared to HTTP?",
    choices: ["Speed", "Encryption (TLS)", "Compression", "Caching"],
    answerIndex: 1
  },
  {
    id: "tech_003",
    category: "Tech",
    difficulty: "normal",
    prompt: "Which port is commonly used for HTTPS?",
    choices: ["21", "22", "80", "443"],
    answerIndex: 3
  },
  {
    id: "tech_004",
    category: "Tech",
    difficulty: "hard",
    prompt: "Which data structure is typically used for a LIFO order?",
    choices: ["Queue", "Stack", "Heap", "Graph"],
    answerIndex: 1
  },
  {
    id: "tech_005",
    category: "Tech",
    difficulty: "hard",
    prompt: "What is the time complexity of binary search on a sorted array?",
    choices: ["O(n)", "O(log n)", "O(n log n)", "O(1)"],
    answerIndex: 1
  },
  {
    id: "tech_006",
    category: "Tech",
    difficulty: "nightmare",
    prompt: "Which of these is a property of a cryptographic hash function?",
    choices: ["Reversible", "Collision resistance", "Infinite output", "Requires a key"],
    answerIndex: 1
  },

  {
    id: "music_001",
    category: "Music",
    difficulty: "easy",
    prompt: "A song played faster than normal is commonly described as…",
    choices: ["Pitch shifted", "Tempo increased", "In mono", "Quantized"],
    answerIndex: 1
  },
  {
    id: "music_002",
    category: "Music",
    difficulty: "normal",
    prompt: "Which clef is commonly used for higher pitched instruments and vocals?",
    choices: ["Treble clef", "Bass clef", "Alto clef", "Tenor clef"],
    answerIndex: 0
  },
  {
    id: "music_003",
    category: "Music",
    difficulty: "hard",
    prompt: "Standard concert pitch A is most commonly tuned to what frequency?",
    choices: ["432 Hz", "440 Hz", "448 Hz", "415 Hz"],
    answerIndex: 1
  },

  {
    id: "games_001",
    category: "Games",
    difficulty: "easy",
    prompt: "In most RPGs, what does 'HP' stand for?",
    choices: ["Hit Points", "High Power", "Hero Points", "Health Potion"],
    answerIndex: 0
  },
  {
    id: "games_002",
    category: "Games",
    difficulty: "normal",
    prompt: "In chess, which piece can move in an L-shape?",
    choices: ["Bishop", "Knight", "Rook", "Queen"],
    answerIndex: 1
  },
  {
    id: "games_003",
    category: "Games",
    difficulty: "hard",
    prompt: "In D&D, a 20-sided die is commonly referred to as…",
    choices: ["d6", "d10", "d12", "d20"],
    answerIndex: 3
  },
  {
    id: "games_004",
    category: "Games",
    difficulty: "nightmare",
    prompt: "In a typical Elo rating system, what happens when you beat a much higher-rated opponent?",
    choices: ["You gain more points than usual", "You gain fewer points than usual", "Ratings do not change", "Your rating is halved"],
    answerIndex: 0
  },

  {
    id: "science_001",
    category: "Science",
    difficulty: "easy",
    prompt: "Water boils at what temperature at sea level (Celsius)?",
    choices: ["50°C", "80°C", "100°C", "120°C"],
    answerIndex: 2
  },
  {
    id: "science_002",
    category: "Science",
    difficulty: "normal",
    prompt: "What is the powerhouse of the cell?",
    choices: ["Ribosome", "Mitochondrion", "Nucleus", "Chloroplast"],
    answerIndex: 1
  },
  {
    id: "science_003",
    category: "Science",
    difficulty: "hard",
    prompt: "Which particle has a negative electric charge?",
    choices: ["Proton", "Neutron", "Electron", "Photon"],
    answerIndex: 2
  },
  {
    id: "science_004",
    category: "Science",
    difficulty: "nightmare",
    prompt: "What does 'half-life' describe in radioactive decay?",
    choices: [
      "The time until the sample is completely gone",
      "The time for half the atoms in a sample to decay",
      "The time until decay starts",
      "The time for temperature to halve"
    ],
    answerIndex: 1
  },

  {
    id: "movies_001",
    category: "Movies",
    difficulty: "easy",
    prompt: "Which of these is a genre of film?",
    choices: ["Photosynthesis", "Nocturne", "Documentary", "Algebra"],
    answerIndex: 2
  },
  {
    id: "movies_002",
    category: "Movies",
    difficulty: "normal",
    prompt: "What do you call the written version of a movie's dialogue and action?",
    choices: ["Blueprint", "Script", "Storyboard", "Subtitle file"],
    answerIndex: 1
  },
  {
    id: "movies_003",
    category: "Movies",
    difficulty: "hard",
    prompt: "What is the name of the award commonly known as the 'Oscar'?",
    choices: ["Golden Globe", "BAFTA", "Academy Award", "Palme d'Or"],
    answerIndex: 2
  },

  // A few extra "Arcana" flavored questions for Dungeon Master vibes.
  {
    id: "arc_001",
    category: "Arcana",
    difficulty: "easy",
    prompt: "In many fantasy settings, a 'mana potion' typically restores…",
    choices: ["Health", "Magic energy", "Stamina", "Gold"],
    answerIndex: 1
  },
  {
    id: "arc_002",
    category: "Arcana",
    difficulty: "normal",
    prompt: "A 'tome' is best described as…",
    choices: ["A weapon", "A large book", "A gemstone", "A spell effect"],
    answerIndex: 1
  },
  {
    id: "arc_003",
    category: "Arcana",
    difficulty: "hard",
    prompt: "In classic fantasy tropes, 'abjuration' magic is most associated with…",
    choices: ["Protection and wards", "Illusions", "Necromancy", "Teleportation"],
    answerIndex: 0
  }
];

