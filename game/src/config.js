// Skylark over Kepulauan Cahaya - tuning numbers in one place.
// All speeds are world units per second, all altitudes are feet.
// One world unit is roughly one metre of ground distance.

var SKY = {};

SKY.canvasWidth = 1280;
SKY.canvasHeight = 720;

SKY.worldSize = 4200;          // square map, world units
SKY.seaLevel = 0;              // terrain height below this is water

// Flight model
SKY.minSpeed = 42;             // slowest the Skylark still flies
SKY.maxSpeed = 235;            // flat out, full throttle
SKY.takeoffSpeed = 70;         // wheels leave the runway here
SKY.stallSpeed = 55;           // below this the nose drops
SKY.climbRate = 0.42;          // fraction of speed turned into climb
SKY.turnRate = 0.55;           // radians per second at full bank
SKY.bankMax = 0.85;            // radians of bank
SKY.pitchMax = 0.55;           // radians of pitch
SKY.throttleStep = 0.55;       // throttle change per second of key hold
SKY.drag = 0.35;               // how fast speed chases its target
SKY.gravitySink = 26;          // feet per second lost when stalled

// Fuel and damage
SKY.fuelStart = 100;
SKY.fuelBurn = 0.55;           // per second at full throttle
SKY.fuelRingBonus = 14;        // fuel back per ring flown
SKY.damageHardLanding = 22;    // damage from a rough touchdown
SKY.damageRoughLanding = 60;   // damage from a hard off-runway landing
SKY.damageGroundHit = 100;     // hitting terrain or sea at speed
SKY.damageMax = 100;

// Sorties: 3 sorties, each harder than the last.
SKY.sorties = [
  { rings: 4, timeLimit: 90, wind: 0,  fuel: 100, name: 'SORTIE 1 - FIRST LIGHT' },
  { rings: 6, timeLimit: 95, wind: 9,  fuel: 100, name: 'SORTIE 2 - TRADE WINDS' },
  { rings: 8, timeLimit: 100, wind: 16, fuel: 90,  name: 'SORTIE 3 - STORM EDGE' }
];

// Scoring
SKY.scoreRing = 100;
SKY.scoreRingAltitudeBonus = 25;   // extra when the ring is flown cleanly
SKY.scoreLanding = 250;
SKY.scoreLandingSoftBonus = 150;   // gentle touchdown
SKY.scoreTimeBonusPerSecond = 4;
SKY.scorePerfectSortie = 300;      // every ring, no damage taken

// Rings
SKY.ringRadius = 55;           // world units, generous and readable
SKY.ringAltMin = 140;          // feet
SKY.ringAltMax = 520;          // feet

// Runway (world coordinates, heading north = -z)
SKY.runway = { x: 0, z: 900, heading: 0, length: 620, width: 120 };

// Camera
SKY.camDistance = 95;          // world units behind the plane
SKY.camHeight = 34;            // world units above the plane
SKY.camFov = 620;              // focal length in pixels
SKY.horizonY = 300;            // screen y of the horizon line

// Colours - one warm tropical palette for the whole game.
SKY.colours = {
  skyTop: '#2f7fc9',
  skyMid: '#7ec3e8',
  skyHorizon: '#cfeef7',
  seaDeep: '#0e5f8a',
  seaShallow: '#2fa8a0',
  sand: '#f2dd9e',
  grass: '#5da24a',
  hill: '#3e7d38',
  forest: '#2c6b2e',
  runway: '#3c3f45',
  runwayMark: '#f5f2e6',
  ringGold: '#ffc93c',
  ringGlow: '#ffe9a3',
  planeBody: '#f4f1e6',
  planeTrim: '#d84a2f',
  planeGlass: '#9fd8ef',
  hudBack: 'rgba(8, 24, 40, 0.78)',
  hudEdge: '#ffd34d',
  hudText: '#ffffff',
  hudGood: '#7ee787',
  hudWarn: '#ffb454',
  hudBad: '#ff6b5e'
};

// Stars on the results screen.
SKY.starThresholds = [900, 1600, 2400]; // score needed for 1, 2, 3 stars
