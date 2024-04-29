// Imports
// Dat gui does not come with three.js
// JsonData contains the world coordinates for curves
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import WiringPath from "./dictionary/wiring_path.json";
import gui from "./gui.js"
import mqtt from 'mqtt'

/*
=========================================
1: Initial setup
=========================================
*/

//Scene and camera setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(-5, 5, 5); // Set the initial position of the camera
camera.lookAt(new THREE.Vector3(0, 0, 0)); // Make the camera look at the center of the scene

// Renderer setup on DOM
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
const currentStyling = renderer.domElement.style
renderer.domElement.style = currentStyling + 'pointer-events: auto;'
document.body.appendChild(renderer.domElement);

// Window resizing fix
// Resizing not required, useful for raycasting
window.addEventListener("resize", () => {
  const newWidth = window.innerWidth;
  const newHeight = window.innerHeight;

  camera.aspect = newWidth / newHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(newWidth, newHeight);
});

// Camera controls
// Create OrbitControls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // Animation loop is required when either damping or auto-rotation are enabled
controls.dampingFactor = 0.1;
controls.screenSpacePanning = false;
controls.maxPolarAngle = Math.PI / 1.7;
//controls.minDistance = 0.3;
controls.maxDistance = 3;

// Add ambient light
const ambientLight = new THREE.AmbientLight(0xffffff, 1); // Color, intensity
scene.add(ambientLight);
// Add directional light
const directionalLight = new THREE.DirectionalLight(0xffeedd, 5);
directionalLight.position.set(0, 3, 3);
scene.add(directionalLight);
// Directional light helper
const directionalLightHelper = new THREE.DirectionalLightHelper(
  directionalLight,
  1
);
//scene.add(directionalLightHelper);

const MaxDataFrameLength = 512;
const DefaultScopeSize = 256;
const ConnectionTimeout = 30000;

const UnderVoltColorMatrix = { r: 12, g: 217, b: 0 };
const OverVoltColorMatrix = { r: 128, g: 114, b: 0 };

const LowTempColorMatrix = { r: 64, g: 115, b: 161 };
const HighTempColorMatrix = { r: 138, g: 0, b: 0 };

const defaultStatistic = {
  networkLatency: 0,
  renderingLatency: 0,
  sensorInterval: 0,
}

const defaultConfig = {
  interval: 200,
  adaptiveInterval: true,
  statorOpacity: 100,
  rotorOpacity: 100,
  wireOpacity: 100,
  inputOpacity: 100,
  motorShowEndBell: false,
  motorShowFrame: true,
  motorShowFanCover: true,
  motorShowFan: true,
  motorShowShaft: true,
  motorShowBearing: true,
  currentParticleColor: "#ff0000",
  currentParticleDensity: 100,
  currentHideULine: false,
  currentHideVLine: false,
  currentHideWLine: false,
  // currentAmplitude: 0.005,
  currentParticleScale: 0.005,
  currentParticleOpacity: 0.7,
};

const defaultStatus = {
  timestamp: new Date(),
  status: "UNKNOWN",
  speed: 0,
  temp: 0,
  currentU: 0,
  currentV: 0,
  currentW: 0,
  voltageU: 0,
  voltageV: 0,
  voltageW: 0,
  vibrationX: 0,
  vibrationY: 0,
  vibrationZ: 0,
};

const statistic = JSON.parse(JSON.stringify(defaultStatistic));
const config = JSON.parse(JSON.stringify(defaultConfig));
const datasets = [JSON.parse(JSON.stringify(defaultStatus))];
const latestDatasetFrame = JSON.parse(JSON.stringify(defaultStatus));


function resetDataset() {
  return new Promise((resolve, reject) => {
    try {
      for (let id = 0; id <= MaxDataFrameLength; id++) {
        datasets.push(JSON.parse(JSON.stringify(defaultStatus)));
      }
    } catch(e) {
      return reject(e);
    }
    return resolve();
  })
}

const generateDataFrames = resetDataset()

generateDataFrames.then(() => {
  // do something.
})

const loader = new THREE.CubeTextureLoader();

const textureCube = loader.load([
  'px.png', 'nx.png',
  'py.png', 'ny.png',
  'pz.png', 'nz.png'
]);

scene.background = textureCube;

/*
=========================================
2: Model loading
=========================================
*/

// Declare a variable to store the loaded model
let motorModel;

// Load the motor model from public
// Use the THREE.Cache to load the model synchronously
async function loadModelAsync() {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();

    // Use the Cache to load the model synchronously
    loader.load(
      "motor.glb",
      (gltf) => {
        motorModel = gltf.scene; // Assign the loaded model to the global variable
        scene.add(motorModel);
        resolve();
      },
      (xhr) => {
        //console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
        // You can add conditions here based on xhr progress if needed
      },
      (error) => {
        console.error("An error happened while loading the model:", error);
        reject(error);
      }
    );
  });
}

// Wait for model loading to be finished, then proceed with code
try {
  await loadModelAsync();
  // Log model load
  //console.log("Model loaded successfully:", motorModel);
} catch (error) {
  // Handle errors that occurred during loading
  console.error("Error loading the model:", error);
}

/*
=========================================
3: Model child visibility
=========================================
*/

// Assign variables to model children
// Create an object to store the GLTF model children
const modelChildren = {};
// Iterate through the children and assign them to the object based on their names
motorModel.children.forEach((child) => {
  modelChildren[child.name] = child;
});

// Interactable children of motorModel
// Children for rotating
const rotorShaft = modelChildren["rotorShaft"];
const rotorScage = modelChildren["rotorScage"]; // Opacity aswell
rotorScage.renderOrder = -1;
const bearingBackInner = modelChildren["bearingBackInner"];
const bearingFrontInner = modelChildren["bearingFrontInner"];
const bearingBallsFrontParent = modelChildren["bearingBallsFrontParent"];
const bearingBallsBackParent = modelChildren["bearingBallsBackParent"];
const platform = modelChildren["platform"];
const fan = modelChildren["fan"]; // Opacity aswell

const bearingBallsFrontNames = [
  "bearingBallsFront",
  "bearingBallsFront001",
  "bearingBallsFront002",
  "bearingBallsFront003",
  "bearingBallsFront004",
  "bearingBallsFront005",
  "bearingBallsFront006",
  "bearingBallsFront007",
  "bearingBallsFront008",
  "bearingBallsFront009",
  "bearingBallsFront010",
  "bearingBallsFront011",
];

// Create an object to store the bearing ball references for the front
const bearingBallsFront = {};

// Loop through the names and create references
for (const name of bearingBallsFrontNames) {
  bearingBallsFront[name] = modelChildren[name];
  if (bearingBallsFront[name]) {
    bearingBallsFront[name].parent = bearingBallsFrontParent; // Parent to middle model
  }
};

const bearingBallsBackNames = [
  "bearingBallsBack",
  "bearingBallsBack001",
  "bearingBallsBack002",
  "bearingBallsBack003",
  "bearingBallsBack004",
  "bearingBallsBack005",
  "bearingBallsBack006",
  "bearingBallsBack007",
  "bearingBallsBack008",
  "bearingBallsBack009",
  "bearingBallsBack010",
  "bearingBallsBack011",
];

// Create an object to store the bearing ball references for the back
const bearingBallsBack = {};

// Loop through the names and create references
for (const name of bearingBallsBackNames) {
  bearingBallsBack[name] = modelChildren[name];
  if (bearingBallsBack[name]) {
    bearingBallsBack[name].parent = bearingBallsBackParent; // Parent to middle model
  }
};


// Rotational functions
// Animate bearing rotations
function rotateComponent(component, rotationAngle) {
  if (component) {
    component.rotation.set(0, 0, rotationAngle);
  }
};

function rotateBearingBalls(bearingBalls, rotationAngle) {
  for (const name in bearingBalls) {
    const bearingBall = bearingBalls[name];
    if (bearingBall) {
      bearingBall.rotation.set(0, 0, rotationAngle);
    }
  }
};

// Children for hiding
// Cover for the connection box
const housingCover = modelChildren["housingCover"];
if (housingCover) {
  housingCover.visible = false; // Hide housingCover
};

// Children for opacity/hiding (fan and rotor squirrelcage already defined)
const corpusMid = modelChildren["corpusMid"];
const corpusFront = modelChildren["corpusFront"];
const corpusBack = modelChildren["corpusBack"];
const cablesInner = modelChildren["cablesInner"];
const stator = modelChildren["stator"];
const cablesInput = modelChildren["cablesInput"];

// Starting default opacity values for dat gui
// Adjust whatever you think should be using opacity
// Define default opacity values
// const defaultOpacities = {
//   //corpusMid: 0.5,
//   //corpusFront: 0.01,
//   //corpusBack: 0.5,
//   stator: 1,
//   rotorScage: 1,
//   //rotorShaft: 1,
//   cablesInner: 1,
//   cablesInput: 1,
//   //fan: 1,
// };

corpusFront.visible = config.motorShowEndBell
corpusMid.visible = config.motorShowFrame
corpusBack.visible = config.motorShowFanCover
fan.visible = config.motorShowFan
rotorShaft.visible = config.motorShowShaft

// Removed
platform.visible = false;

// Set default opacity values
// for (const modelName in defaultOpacities) {
//   const model = modelChildren[modelName];
//   if (model) {
//     if (model.children.length > 0) {
//       // Model with children
//       model.userData.originalOpacity = defaultOpacities[modelName];
//       model.traverse((child) => {
//         if (child.isMesh) {
//           child.material.transparent = true;
//           child.material.opacity = defaultOpacities[modelName];
//         }
//       });
//     } else if (model.isMesh) {
//       // Model without children
//       model.material.transparent = true;
//       model.material.opacity = defaultOpacities[modelName];
//     }
//   }
// };

cablesInput.traverse((child) => {
  if (child.material && child.name === 'Cylinder001_13') {
    const cableInputMat = child.material.clone();
    cableInputMat.color = new THREE.Color(`rgb(${UnderVoltColorMatrix.r}, ${UnderVoltColorMatrix.g}, ${UnderVoltColorMatrix.b})`);
    child.material = cableInputMat;
  }
});

/*
=========================================
4: Magnetic field setup
=========================================
*/

// Sprites represent the magnetic field polarities
// Texture loader
const textureLoader = new THREE.TextureLoader();
const textureSouth = textureLoader.load("south.png");
const textureNorth = textureLoader.load("north.png");

// Material setup
// Use present controls to make sprites transparent through models
const createMaterial = (map, color) =>
  new THREE.SpriteMaterial({
    map,
    depthWrite: false,
    depthTest: false,
    color: new THREE.Color(color),
    transparent: true,
    opacity: 1,
    sizeAttenuation: true,
    blending: THREE.NormalBlending,
  });

// Resize sprites
const spriteScale = 0.1;

// Function to create sprites
const createSprite = (material, position) => {
  const sprite = new THREE.Sprite(material.clone());
  sprite.renderOrder = 1;
  sprite.position.set(...position);
  return sprite;
};

// Stator winding magnetic field polarity
// Each sprite must be assigned its own texture and color
// Create an instance of each sprite with its own material properties
// If that is not done, the sprites do not work correctly
const createSpriteArray = (texture, color, positions) =>
  positions.map((position) =>
    createSprite(createMaterial(texture, color), position)
  );

const spriteData = [
  {
    texture: textureSouth,
    color: "#e74c3c",
    positions: [
      [0, 0.22, 0.3],
      [0, 0.22, 0.1],
      [0, 0.22, -0.1],
    ],
  },
  {
    texture: textureNorth,
    color: "#3498db",
    positions: [
      [0, -0.22, 0.3],
      [0, -0.22, 0.1],
      [0, -0.22, -0.1],
    ],
  },
  {
    texture: textureSouth,
    color: "#e74c3c",
    positions: [
      [0.2, 0.12, 0.3],
      [0.2, 0.12, 0.1],
      [0.2, 0.12, -0.1],
    ],
  },
  {
    texture: textureNorth,
    color: "#3498db",
    positions: [
      [-0.2, -0.12, 0.3],
      [-0.2, -0.12, 0.1],
      [-0.2, -0.12, -0.1],
    ],
  },
  {
    texture: textureSouth,
    color: "#e74c3c",
    positions: [
      [0.2, -0.12, 0.3],
      [0.2, -0.12, 0.1],
      [0.2, -0.12, -0.1],
    ],
  },
  {
    texture: textureNorth,
    color: "#3498db",
    positions: [
      [-0.2, 0.12, 0.3],
      [-0.2, 0.12, 0.1],
      [-0.2, 0.12, -0.1],
    ],
  },
];

const sprites = spriteData.flatMap(({ texture, color, positions }) =>
  createSpriteArray(texture, color, positions)
);

sprites.forEach((sprite) => {
  scene.add(sprite);
  sprite.userData.initialTexture = sprite.material.map;
  sprite.userData.initialColor = new THREE.Color(
    sprite.material.map === textureSouth ? "#e74c3c" : "#3498db"
  );
});

// Have the sprites alternate their color and texture in animate
// Sprites will alternate their properties on sineValue change
function animateAlternatingSprites(sprite, initialScale, phaseShift, time) {
  const currentTime = (time + phaseShift) % 1;

  const sineValue = Math.sin(currentTime * Math.PI * 2);

  let scale = Math.abs(sineValue) * initialScale;
  sprite.scale.set(scale, scale, 1);

  const threshold = 0;

  if (sineValue < threshold && sprite.userData.textureChanged !== true) {
    sprite.material.map = sprite.userData.initialTexture;
    sprite.material.color = sprite.userData.initialColor;
    sprite.userData.textureChanged = true;
  } else if (
    sineValue > threshold &&
    sprite.userData.textureChanged !== false
  ) {
    // Change to the other texture and color
    sprite.material.map =
      sprite.userData.initialTexture === textureSouth
        ? textureNorth
        : textureSouth;
    sprite.material.color =
      sprite.material.map === textureSouth
        ? new THREE.Color("#e74c3c") // South color (red)
        : new THREE.Color("#3498db"); // North color (blue)
    sprite.userData.textureChanged = false;
  }
}

// Stator winding magnetic field polarity sum
// Create two independent sprites
const independentSprite1 = createSprite(
  createMaterial(textureNorth, "#3498db"),
  [0, 0.22, 0.3]
);
const independentSprite2 = createSprite(
  createMaterial(textureSouth, "#e74c3c"),
  [0, -0.22, 0.3]
);

// Scale down the sprites
independentSprite1.scale.set(spriteScale, spriteScale, 1);
independentSprite2.scale.set(spriteScale, spriteScale, 1);

// Add the sprites to the scene
scene.add(independentSprite1);
scene.add(independentSprite2);

// Offset for the animation
const initialAngle1 = Math.PI / 2; // 90 degrees
const initialAngle2 = -Math.PI / 2; // -90 degrees

// Magnetic field sum rotation animation
const animateIndependentSprites = function (time) {
  const rotationAngle = -time * Math.PI * 2; // Full rotation as time goes from 0 to 1

  independentSprite1.position.x =
    0.22 * Math.cos(rotationAngle + initialAngle1);
  independentSprite1.position.y =
    0.22 * Math.sin(rotationAngle + initialAngle1);

  independentSprite2.position.x =
    0.22 * Math.cos(rotationAngle + initialAngle2);
  independentSprite2.position.y =
    0.22 * Math.sin(rotationAngle + initialAngle2);
};

// Hide them by default for dat gui
// Set visibility to false initially
sprites.forEach((sprite) => {
  sprite.visible = false;
});

independentSprite1.visible = false;
independentSprite2.visible = false;

/*
=========================================
5: Electrical current setup
=========================================
*/

// Create curves from the JSON data
// Data taken from the import
function createCurvesFromJson(data, curvePath) {
  for (let i = 0; i < data.length - 1; i++) {
    const start = new THREE.Vector3(data[i].x, data[i].y, data[i].z);
    const end = new THREE.Vector3(data[i + 1].x, data[i + 1].y, data[i + 1].z);
    const lineCurve = new THREE.LineCurve3(start, end);
    curvePath.add(lineCurve);
  }
}

// Create curve
const pathL1 = new THREE.CurvePath();
createCurvesFromJson(WiringPath["pathL1"], pathL1);

const pathL2 = new THREE.CurvePath();
createCurvesFromJson(WiringPath["pathL2"], pathL2);

const pathL3 = new THREE.CurvePath();
createCurvesFromJson(WiringPath["pathL3"], pathL3);

// Adjust the particle density on the curve to be uniform
// Particle length
const lengthpathL1 = pathL1.getLength();
const lengthpathL2 = pathL2.getLength();
const lengthpathL3 = pathL3.getLength();

const desiredDensity = 0.1; // You can adjust this value (e.g., 0.1 means 10% of the curve length per segment)
const densityFactor = 50; // You can adjust this value based on your needs
// Calculate adjusted density
const adjustedDensity = desiredDensity * densityFactor;

const segmentPathL1 = Math.round(lengthpathL1 / adjustedDensity);
const segmentPathL2 = Math.round(lengthpathL2 / adjustedDensity);
const segmentPathL3 = Math.round(lengthpathL3 / adjustedDensity);

// Phase 1,2,3 parameters
let pathL1param = {
  scale: defaultConfig.currentParticleScale,
  color: defaultConfig.currentParticleColor,
  depthTest: false,
  depthWrite: false,
  transparency: true,
  opacity: 0.7,
  alphaTest: 1,
  segmentNumber: segmentPathL1,
  particlesPerSegment: defaultConfig.currentParticleDensity,
  hideParticles: false,
  phaseL1: (Math.PI * 4) / 3,
};

let pathL2param = {
  scale: defaultConfig.currentParticleScale,
  color: defaultConfig.currentParticleColor,
  depthTest: false,
  depthWrite: false,
  transparency: true,
  opacity: 0.7,
  alphaTest: 1,
  segmentNumber: segmentPathL2,
  particlesPerSegment: defaultConfig.currentParticleDensity,
  hideParticles: false,
  phaseL2: (Math.PI * 2) / 3,
};

let pathL3param = {
  scale: defaultConfig.currentParticleScale,
  color: defaultConfig.currentParticleColor,
  depthTest: false,
  depthWrite: false,
  transparency: true,
  opacity: 0.7,
  alphaTest: 1,
  segmentNumber: segmentPathL3,
  particlesPerSegment: defaultConfig.currentParticleDensity,
  hideParticles: false,
  phaseL3: 0,
};

// Current particles via sprites
const circleTexture = textureLoader.load("circle.png");

// Particle material
const spriteMaterial = new THREE.SpriteMaterial({
  map: circleTexture,
  depthWrite: false,
  depthTest: false,
  color: new THREE.Color(defaultConfig.currentParticleColor),
  transparent: true,
  opacity: defaultConfig.currentParticleOpacity,
  sizeAttenuation: true,
  blending: THREE.NormalBlending, // Adjust the blending mode
});

// Array to hold particles
const pathL1particles = [];
const pathL2particles = [];
const pathL3particles = [];

// Update particle materials
// Used in dat gui aswell
function updateParticleMaterial() {
  spriteMaterial.color.set(config.currentParticleColor);
  spriteMaterial.opacity = config.currentParticleOpacity;
  spriteMaterial.transparent = true;
  //spriteMaterial.alphaTest = commonCurrentParam.alphaTest;
  // When changing alphaTest, edit the opacity values in dat gui

  // Toggle visibility based on the hideParticles parameter for each instance
  pathL1particles.forEach((particle) => {
    particle.material.copy(spriteMaterial);
    particle.visible = !pathL1param.hideParticles;
  });
  pathL2particles.forEach((particle) => {
    particle.material.copy(spriteMaterial);
    particle.visible = !pathL2param.hideParticles;
  });
  pathL3particles.forEach((particle) => {
    particle.material.copy(spriteMaterial);
    particle.visible = !pathL3param.hideParticles;
  });
}

// Create the particles on the curves
function createParticles(curveParticles, curve, param) {
  curveParticles.forEach((particle) => scene.remove(particle));
  curveParticles.length = 0;

  const totalParticles = param.segmentNumber * param.particlesPerSegment;

  for (let i = 0; i < totalParticles; i++) {
    const sprite = new THREE.Sprite(spriteMaterial);
    // Make the particles more see-through with renderOrder
    sprite.renderOrder = 1;

    let scale;

    // If future addition contains schematics, scale down the particles with this
    if (param.hasOwnProperty("schemScale")) {
      // Use schematics scale for curves that have schemScale property
      scale = config.currentParticleScale * param.schemScale;
    } else {
      // Use common scale for curves without schemScale property
      scale = config.currentParticleScale;
    }

    sprite.scale.set(scale, scale, scale);

    curveParticles.push(sprite);
    scene.add(sprite);

    const t = i / totalParticles;
    const pointOnPath = curve.getPointAt(t);

    // Fix particles on curves
    if (pointOnPath) {
      sprite.position.copy(pointOnPath);
    } else {
      console.error("pointOnPath is null for sprite at index", i);
    }
  }
}

const curves = [
  { particles: pathL1particles, curve: pathL1, param: pathL1param },
  { particles: pathL2particles, curve: pathL2, param: pathL2param },
  { particles: pathL3particles, curve: pathL3, param: pathL3param },
];

curves.forEach(({ particles, curve, param }) => {
  createParticles(particles, curve, param);
});

const phaseL1 = pathL1param.phaseL1;
const phaseL2 = pathL2param.phaseL2;
const phaseL3 = pathL3param.phaseL3;
let sineAmplitude = 0.005; // Adjust as needed

// Make particles move in a sine wave
// Animation in animate
const animateParticles = (
  curveParticles,
  curve,
  param,
  time,
  phase,
  sineAmplitude
) => {
  curveParticles.forEach((particle, i) => {
    const baseT = i / (param.segmentNumber * param.particlesPerSegment);

    // Use a sine wave to modify the t value directly
    const sineWave = Math.sin((baseT + time + phase) * 2 * Math.PI);
    let particleT = (baseT + sineWave * sineAmplitude) % 1;

    // Ensure particleT stays within the range [0, 1]
    particleT = particleT < 0 ? 1 + particleT : particleT;

    // Point on path is a value from 0 to 1
    // The 0 value is path start, 1 is path end
    const pointOnPath = curve.getPointAt(particleT);

    // Check if pointOnPath is not null before updating the particle's position
    if (pointOnPath) {
      // Update the particle's position based on the modified t value
      particle.position.copy(pointOnPath);
    } else {
      console.error("pointOnPath is null for particle at index", i);
    }
  });
};

// Current directional arrows
const arrows = [
  modelChildren["arrow1"],
  modelChildren["arrow2"],
  modelChildren["arrow3"],
  modelChildren["arrow4"],
  modelChildren["arrow5"],
  modelChildren["arrow6"],
  modelChildren["arrow7"],
  modelChildren["arrow8"],
  modelChildren["arrow9"],
  modelChildren["arrow10"],
  modelChildren["arrow11"],
  modelChildren["arrow12"],
];

// Set individual phase shifts for each arrow
const phaseShifts = [
  pathL1param.phaseL1,
  pathL1param.phaseL1,
  pathL2param.phaseL2,
  pathL2param.phaseL2,
  pathL3param.phaseL3,
  pathL3param.phaseL3,
  pathL1param.phaseL1,
  pathL1param.phaseL1,
  pathL2param.phaseL2,
  pathL2param.phaseL2,
  pathL3param.phaseL3,
  pathL3param.phaseL3,
];

// Combined function to calculate sine value and update arrow
function updateArrow(arrow, t, phaseShift) {
  const sineValue = Math.sin(2 * Math.PI * (t + phaseShift));
  arrow.visible = false ? sineValue !== 0 : !sineValue;
  arrow.scale.set(1, 1, -sineValue);
  arrow.updateMatrix();
}

/*
=========================================
6: GUI Setup
=========================================
*/

let t = 0;

var guiInputCheck = null;

const handlers = {
  interval: (newValue) => {
    guiInputCheck = debounce(() => {
      config.interval = newValue
    }, 500);

    guiInputCheck()
  },
  adaptiveInterval: (newValue) => {
    config.adaptiveInterval = newValue
  },
  statorOpacity: (newValue) => {
    if (newValue < 100) {
      stator.material.transparent = true;
    } else {
      stator.material.transparent = false;
    }
    stator.material.opacity = (1 / 100) * newValue;
  },
  rotorOpacity: (newValue) => {
    rotorScage.traverse((child) => {
      if (child.material) {
        let childMat = child.material.clone();
        if (newValue < 100) {
          childMat.transparent = true;
        } else {
          childMat.transparent = false;
        }
        childMat.opacity = (1 / 100) * newValue;
        child.material = childMat;
      }
    });
  },
  wireOpacity: (newValue) => {
    cablesInner.traverse((child) => {
      if (child.material) {
        let childMat = child.material.clone();
        if (newValue < 100) {
          childMat.transparent = true;
        } else {
          childMat.transparent = false;
        }
        childMat.opacity = (1 / 100) * newValue;
        child.material = childMat;
      }
    });
  },
  inputOpacity: (newValue) => {
    cablesInput.traverse((child) => {
      if (child.material) {
        let childMat = child.material.clone();
        if (newValue < 100) {
          childMat.transparent = true;
        } else {
          childMat.transparent = false;
        }
        childMat.opacity = (1 / 100) * newValue;
        child.material = childMat;
      }
    });
  },
  motorShowEndBell: (newValue) => {
    corpusFront.visible = newValue
  },
  motorShowFrame: (newValue) => {
    corpusMid.visible = newValue
  },
  motorShowFanCover: (newValue) => {
    corpusBack.visible = newValue
  },
  motorShowFan: (newValue) => {
    fan.visible = newValue
  },
  motorShowShaft: (newValue) => {
    rotorShaft.visible = newValue
  },
  motorShowBearing: (newValue) => {
    for (const key in modelChildren) {
        if (key.includes("bearing")) {
          const bearingModel = modelChildren[key];

          if (bearingModel) {
            bearingModel.visible = newValue;
          }
        }
      }
  },
  currentParticleColor: (newValue) => {
    spriteMaterial.color.set(new THREE.Color(newValue))
    updateParticleMaterial()
  },
  currentParticleDensity: (newValue) => {
    config.currentParticleDensity = newValue
    pathL1param.particlesPerSegment = config.currentParticleDensity;
    pathL2param.particlesPerSegment = config.currentParticleDensity;
    pathL3param.particlesPerSegment = config.currentParticleDensity;

    createParticles(pathL1particles, pathL1, pathL1param);
    createParticles(pathL2particles, pathL2, pathL2param);
    createParticles(pathL3particles, pathL3, pathL3param);
  },
  currentHideULine: (newValue) => {
    pathL1param.hideParticles = newValue
    updateParticleMaterial();
  },
  currentHideVLine: (newValue) => {
    pathL2param.hideParticles = newValue
    updateParticleMaterial();
  },
  currentHideWLine: (newValue) => {
    pathL3param.hideParticles = newValue
    updateParticleMaterial();
  },
  currentParticleScale: (newValue) => {
    config.currentParticleScale = newValue

    createParticles(pathL1particles, pathL1, pathL1param);
    createParticles(pathL2particles, pathL2, pathL2param);
    createParticles(pathL3particles, pathL3, pathL3param);
  },
  currentParticleOpacity: (newValue) => {
    config.currentParticleOpacity = newValue

    updateParticleMaterial();
  },
}

gui.Init(statistic, config, datasets, handlers)

/*
=========================================
7: Animation
=========================================
*/

// Constants for frequency counting
let numberOfFrames = 0;
let startTime = null; // Initialize startTime variable

// Animate function, never ending
const animate = function () {
  // Start frequency count time
  const timestamp = performance.now();

  // Clock that counts from 0 to 1
  t = (t + latestDatasetFrame.speed * 0.01) % 1;

  // Rotate bearings, shaft and bearingballs
  // The ratio of inner ring and bearing ball diameter is more or less 3.
  const bearingRatio = 3;
  const rotationAngle = 2 * Math.PI * t;
  const rotationAngle2 = (2 * Math.PI * t) / bearingRatio;

  // Apply the rotation to components
  rotateComponent(rotorShaft, -rotationAngle);
  rotateComponent(rotorScage, -rotationAngle);
  rotateComponent(bearingFrontInner, -rotationAngle);
  rotateComponent(bearingBackInner, -rotationAngle);
  rotateComponent(bearingBallsFrontParent, -rotationAngle2);
  rotateComponent(bearingBallsBackParent, -rotationAngle2);
  rotateBearingBalls(bearingBallsFront, rotationAngle);
  rotateBearingBalls(bearingBallsBack, rotationAngle);
  rotateComponent(fan, -rotationAngle);

  // Magnetic field sprites
  // Enable/disabled via dat gui

  animateAlternatingSprites(sprites[0], spriteScale, pathL1param.phaseL1, t);
  animateAlternatingSprites(sprites[1], spriteScale, pathL1param.phaseL1, t);
  animateAlternatingSprites(sprites[2], spriteScale, pathL1param.phaseL1, t);

  animateAlternatingSprites(sprites[3], spriteScale, pathL1param.phaseL1, t);
  animateAlternatingSprites(sprites[4], spriteScale, pathL1param.phaseL1, t);
  animateAlternatingSprites(sprites[5], spriteScale, pathL1param.phaseL1, t);

  animateAlternatingSprites(sprites[6], spriteScale, pathL2param.phaseL2, t);
  animateAlternatingSprites(sprites[7], spriteScale, pathL2param.phaseL2, t);
  animateAlternatingSprites(sprites[8], spriteScale, pathL2param.phaseL2, t);

  animateAlternatingSprites(sprites[9], spriteScale, pathL2param.phaseL2, t);
  animateAlternatingSprites(sprites[10], spriteScale, pathL2param.phaseL2, t);
  animateAlternatingSprites(sprites[11], spriteScale, pathL2param.phaseL2, t);

  animateAlternatingSprites(sprites[12], spriteScale, pathL3param.phaseL3, t);
  animateAlternatingSprites(sprites[13], spriteScale, pathL3param.phaseL3, t);
  animateAlternatingSprites(sprites[14], spriteScale, pathL3param.phaseL3, t);

  animateAlternatingSprites(sprites[15], spriteScale, pathL3param.phaseL3, t);
  animateAlternatingSprites(sprites[16], spriteScale, pathL3param.phaseL3, t);
  animateAlternatingSprites(sprites[17], spriteScale, pathL3param.phaseL3, t);

  if (config.showCumulative) {
    animateIndependentSprites(t);
  };

  // Animate current particles
  animateParticles(
    pathL1particles,
    pathL1,
    pathL1param,
    t,
    phaseL1,
    sineAmplitude
  );

  animateParticles(
    pathL2particles,
    pathL2,
    pathL2param,
    t,
    phaseL2,
    sineAmplitude
  );

  animateParticles(
    pathL3particles,
    pathL3,
    pathL3param,
    t,
    phaseL3,
    sineAmplitude
  );

  // Update arrows with phase shifts and hiding state
  arrows.forEach((arrow, index) => {
    updateArrow(arrow, t, phaseShifts[index]);
  });

  // Camera controls damping
  controls.update(); // only required if controls.enableDamping = true, or if controls.autoRotate = true

  // Render scene and camera
  renderer.render(scene, camera);

  // End frequency count
  const frameDuration = performance.now() - timestamp;
  // Frequency counter
  if (numberOfFrames >= 1 / latestDatasetFrame.speed) {
    // Calculate the period (time for one cycle)
    const period = frameDuration * numberOfFrames;
    // Calculate the frequency
    const frequency = 1 / (period / 1000); // Convert period to seconds
    // estimatedFrequencyControl.setValue(frequency);

    // Reset the number of frames for the next cycle
    numberOfFrames = 0;
    startTime = timestamp;
  } else {
    // Increment the number of frames
    numberOfFrames++;
  };

  // Use request animation frame for performance
  requestAnimationFrame(animate);
};

// Call animate
animate();

/*
=========================================
8: Datasource and Visualization
=========================================
*/

var previousMessageTime = 0;
var latestMessageTime = 0;

var firstMessageTime = 0;
var startProcessTime = 0;
var endProcessTime = 0;

var isConnected = false;

var streamCheck = null;

const brokerUrl = import.meta.env.CLIENT_BROKER_URL;
const options = {
  clientId: import.meta.env.CLIENT_BROKER_ID,
  username: import.meta.env.CLIENT_BROKER_USER,
  password: import.meta.env.CLIENT_BROKER_PASS,
};
const topic = import.meta.env.CLIENT_BROKER_TOPIC;

// Connect to MQTT broker
const client = mqtt.connect(brokerUrl, options);
console.log('Connecting to MQTT broker...');
gui.SetConnect()

// When connected, subscribe to the specified topic
client.on('connect', () => {
  gui.SetListening();
  isConnected = true;
  console.log('Connected to MQTT broker!');
  client.subscribe(topic, { qos: 1 }, (err) => {
    if (err) {
      console.error('Error subscribing to topic:', err);
    } else {
      console.log('Subscribed to topic:', topic);
    }
  });
});

client.on('reconnect', () => {
  gui.SetReconnect();
  console.log('Reconnecting to MQTT broker...');
});

client.on('disconnected', () => {
  gui.SetDisconnect();
  isConnected = false;
  console.log('Disconnected from MQTT broker!');
  statistic.networkLatency = 0
  statistic.renderingLatency = 0
});

// Handle incoming messages
client.on('message', (topic, message) => {
  gui.SetRunning()
  let frame = null;
  latestMessageTime = Date.now();
  if (firstMessageTime === 0) {
    firstMessageTime = latestMessageTime;
  }
  statistic.networkLatency = latestMessageTime - previousMessageTime;
  previousMessageTime = latestMessageTime;

  frame = JSON.parse(message)

  datasets.push({
    timestamp: Date.parse(frame.timestamp),
    status: frame.motor_condition,
    speed: frame.speed,
    temp: frame.temperature,
    currentU: frame.current_u,
    currentV: frame.current_v,
    currentW: frame.current_w,
    voltageU: frame.voltage_u,
    voltageV: frame.voltage_v,
    voltageW: frame.voltage_w,
    vibrationX: frame.vibration_x,
    vibrationY: frame.vibration_y,
    vibrationZ: frame.vibration_z,
  });

  if (datasets.length > ((1000 / statistic.sensorInterval) * 60)) {
    datasets.shift();
  }

  const latestFrame = datasets[datasets.length - 1]
  const previousFrame = datasets[datasets.length - 2]

  latestDatasetFrame.timestamp = latestFrame.timestamp;
  latestDatasetFrame.status = latestFrame.status;
  latestDatasetFrame.speed = latestFrame.speed;
  latestDatasetFrame.temp = latestFrame.temp;
  latestDatasetFrame.currentU = latestFrame.currentU;
  latestDatasetFrame.currentV = latestFrame.currentV;
  latestDatasetFrame.currentW = latestFrame.currentW;
  latestDatasetFrame.voltageU = latestFrame.voltageU;
  latestDatasetFrame.voltageV = latestFrame.voltageV;
  latestDatasetFrame.voltageW = latestFrame.voltageW;
  latestDatasetFrame.vibrationX = latestFrame.vibrationX;
  latestDatasetFrame.vibrationY = latestFrame.vibrationY;
  latestDatasetFrame.vibrationZ = latestFrame.vibrationZ;

  if (previousFrame.timestamp !== null) {
    statistic.sensorInterval = latestFrame.timestamp - previousFrame.timestamp;
  }

  // console.log(`radian ${radian} vrmsAvg ${vrmsAvg} irmsAvg ${irmsAvg}`)

  // streamCheck = debounce(function() {
  //   if (isConnected) {
  //     gui.SetListening()
  //     return
  //   }
  // }, ConnectionTimeout);

  // streamCheck();
})

// Handle errors
client.on('error', (err) => {
  console.error('Error:', err);
});

function render() {
  let lastDatasetFrame = defaultStatus;
  let updateLatency = config.interval;
  let ScopeSize = DefaultScopeSize;
  let ticker = 0;

  const datastream = function () {
    const latestDatasetFrame = datasets[datasets.length - 1]

    if (ticker > ConnectionTimeout && isConnected && JSON.stringify(lastDatasetFrame) === JSON.stringify(latestDatasetFrame)) {
      gui.SetListening()
      ticker = 0;
    }

    const scopeDatasets = datasets.slice(Math.max(datasets.length - ScopeSize, 0));

    if (updateLatency != config.interval) {
      // const generateDataFrames = resetDataset();

      // generateDataFrames.then(() => {
      //   gui.SyncGraph(scopeDatasets);
      //   gui.SyncInformation(scopeDatasets);

        updateLatency = config.interval;
        setTimeout(datastream, updateLatency);
      // })
      return;
    }
    startProcessTime = Date.now();
    ticker += updateLatency;

    switch (latestDatasetFrame.status) {
      case 'NORMAL':
        gui.SetNormal();
        break;
      case 'UNKNOWN':
        gui.SetUnknown();
        break;
      default:
        gui.SetError(latestDatasetFrame.status);
        break;
    }

    gui.SyncGraph(scopeDatasets);
    gui.SyncInformation(scopeDatasets);

    const frameHeatmapColor = getFrameHeatmap(latestDatasetFrame.temp)

    corpusFront.traverse((child) => {
      if (child.material) {
        const corpusFrontMat = child.material.clone();
        corpusFrontMat.color = frameHeatmapColor;
        child.material = corpusFrontMat;
      }
    });

    corpusMid.traverse((child) => {
      if (child.material) {
        const corpusMidMat = child.material.clone();
        corpusMidMat.color = frameHeatmapColor;
        child.material = corpusMidMat;
      }
    });

    corpusBack.traverse((child) => {
      if (child.material) {
        const corpusBackMat = child.material.clone();
        corpusBackMat.color = frameHeatmapColor;
        child.material = corpusBackMat;
      }
    });

    // Get data frames per revolution per milisecond
    const radian = Math.ceil(latestDatasetFrame.speed * (2 * Math.PI) / 60)
    const rmsLength = radian / (latestDatasetFrame.speed / 60)

    const vrmsU = Math.sqrt(datasets.slice(Math.max(datasets.length - rmsLength, 0)).map((dataset) => {
      return dataset.voltageU;
    }).reduce((total, voltage) => {
      return total + Math.pow(voltage, 2);
    }, 0) / rmsLength);

    const vrmsV = Math.sqrt(datasets.slice(Math.max(datasets.length - rmsLength, 0)).map((dataset) => {
      return dataset.voltageV;
    }).reduce((total, voltage) => {
      return total + Math.pow(voltage, 2);
    }, 0) / rmsLength);

    const vrmsW = Math.sqrt(datasets.slice(Math.max(datasets.length - rmsLength, 0)).map((dataset) => {
      return dataset.voltageW
    }).reduce((total, voltage) => {
      return total + Math.pow(voltage, 2);
    }, 0) / rmsLength);


    let vrmsAvg = (vrmsU + vrmsV + vrmsW) / 3;

    if (!vrmsAvg) {
      vrmsAvg = 0;
    }

    const wireVoltagemapColor = getWiringVoltagemap(vrmsAvg * Math.sqrt(2));

    cablesInput.traverse((child) => {
      if (child.material && child.name === 'Cylinder001_13') {
        const cableInputMat = child.material.clone();
        cableInputMat.color = wireVoltagemapColor;
        child.material = cableInputMat;
      }
    });

    const irmsU = Math.sqrt(datasets.slice(Math.max(datasets.length - rmsLength, 0)).map((dataset) => {
      return dataset.currentU;
    }).reduce((total, current) => {
      return total + Math.pow(current, 2);
    }, 0) / rmsLength);

    const irmsV = Math.sqrt(datasets.slice(Math.max(datasets.length - rmsLength, 0)).map((dataset) => {
      return dataset.currentV;
    }).reduce((total, current) => {
      return total + Math.pow(current, 2);
    }, 0) / rmsLength);

    const irmsW = Math.sqrt(datasets.slice(Math.max(datasets.length - rmsLength, 0)).map((dataset) => {
      return dataset.currentW
    }).reduce((total, current) => {
      return total + Math.pow(current, 2);
    }, 0));


    let irmsAvg = (irmsU + irmsV + irmsW) / 3;

    if (!irmsAvg) {
      irmsAvg = 0;
    }

    throttle(function() {
      sineAmplitude = irmsAvg * Math.sqrt(2);
    }, updateLatency)();

    endProcessTime = Date.now();
    statistic.renderingLatency = (endProcessTime - startProcessTime);

    setTimeout(datastream, updateLatency);
  }
  setTimeout(datastream, updateLatency);
}

render();

function debounce(func, delay) {
  let timer;
  return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => {
          func.apply(this, args);
      }, delay);
  };
}

function throttle(func, interval) {
  let isRunning = false;
  return function(...args) {
      if (!isRunning) {
          isRunning = true;
          func.apply(this, args);
          setTimeout(() => {
              isRunning = false;
          }, interval);
      }
  };
}

function getFrameHeatmap(temp) {
  let tempRange = Math.max(10, Math.min(temp, 60));
  let fadePercentage = ((tempRange - 10) / 60) * 1

  let diffRed = HighTempColorMatrix.r - LowTempColorMatrix.r;
  let diffGreen = HighTempColorMatrix.g - LowTempColorMatrix.g;
  let diffBlue = HighTempColorMatrix.b - LowTempColorMatrix.b;

  diffRed = parseInt((diffRed * fadePercentage) + LowTempColorMatrix.r);
  diffGreen = parseInt((diffGreen * fadePercentage) + LowTempColorMatrix.g);
  diffBlue = parseInt((diffBlue * fadePercentage) + LowTempColorMatrix.b);

  return new THREE.Color(`rgb(${diffRed}, ${diffGreen}, ${diffBlue})`)
}

function getWiringVoltagemap(vrms) {
  let voltageRange = Math.max(0, Math.min(vrms, 50));
  let fadePercentage = ((voltageRange - 0) / 50) * 1

  let diffRed = OverVoltColorMatrix.r - UnderVoltColorMatrix.r;
  let diffGreen = OverVoltColorMatrix.g - UnderVoltColorMatrix.g;
  let diffBlue = OverVoltColorMatrix.b - UnderVoltColorMatrix.b;

  diffRed = parseInt((diffRed * fadePercentage) + UnderVoltColorMatrix.r);
  diffGreen = parseInt((diffGreen * fadePercentage) + UnderVoltColorMatrix.g);
  diffBlue = parseInt((diffBlue * fadePercentage) + UnderVoltColorMatrix.b);

  return new THREE.Color(`rgb(${diffRed}, ${diffGreen}, ${diffBlue})`)
}