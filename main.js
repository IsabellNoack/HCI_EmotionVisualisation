import * as THREE from "https://unpkg.com/three@0.168.0/build/three.module.js?module";
import { OrbitControls } from "https://unpkg.com/three@0.168.0/examples/jsm/controls/OrbitControls.js?module";

const PARAMS = {
  transitionSmoothness: 6.0,

  waveWidth: 14,
  waveHeight: 3.8,
  meshDensityX: 620,
  meshDensityY: 140,
  globalScale: 1.35,

  layerCount: 6,
  baseRotationX: -Math.PI * 0.5,

  emotionDimensions: {
    energy: 0.45,
    turbulence: 0.45,
    red: 0.94,
    green: 0.71,
    blue: 0.37,
    saturation: 0.78,
    openness: 0.55,
    softness: 0.5,
    glow: 0.65
  }
};

window.WAVE_PARAMS = PARAMS;
window.EMOTION_DIMENSIONS = PARAMS.emotionDimensions;

const ACTIVE = {
  flowSpeed: 0.5,
  swaySpeed: 0.08,
  layerPhaseStep: 0.7,
  layerYOffset: 0.16,
  layerXOffset: 0.04,
  layerTilt: 0.025,
  layerScaleFalloff: 0.045,
  baseOpacity: 0.46,
  opacityFalloff: 0.014,
  waveAmpA: 0.3,
  waveAmpB: 0.12,
  noiseAmpY: 0.9,
  noiseScaleX: 0.44,
  noiseScaleY: 1.8,
  depthNoiseAmp: 1.4,
  depthWaveAmp: 0.28,
  filamentDensity: 34,
  filamentSharpness: 16,
  shimmerFrequency: 18,
  sceneSwayYSpeed: 0.16,
  sceneSwayXSpeed: 0.11,
  sceneSwayYAmount: 0.055,
  sceneSwayXAmount: 0.02,
  baseRotationX: PARAMS.baseRotationX,
  baseRgb: { r: 240, g: 180, b: 95 }
};

const TARGET = {
  ...ACTIVE,
  baseRgb: { ...ACTIVE.baseRgb }
};

const BLEND_KEYS = [
  "flowSpeed",
  "swaySpeed",
  "layerPhaseStep",
  "layerYOffset",
  "layerXOffset",
  "layerTilt",
  "layerScaleFalloff",
  "baseOpacity",
  "opacityFalloff",
  "waveAmpA",
  "waveAmpB",
  "noiseAmpY",
  "noiseScaleX",
  "noiseScaleY",
  "depthNoiseAmp",
  "depthWaveAmp",
  "filamentDensity",
  "filamentSharpness",
  "shimmerFrequency",
  "sceneSwayYSpeed",
  "sceneSwayXSpeed",
  "sceneSwayYAmount",
  "sceneSwayXAmount",
  "baseRotationX"
];

function updateTargetFromDimensions() {
  const d = PARAMS.emotionDimensions;
  const energy = THREE.MathUtils.clamp(d.energy, 0, 1);
  const turbulence = THREE.MathUtils.clamp(d.turbulence, 0, 1);
  const red = THREE.MathUtils.clamp(d.red, 0, 1);
  const green = THREE.MathUtils.clamp(d.green, 0, 1);
  const blue = THREE.MathUtils.clamp(d.blue, 0, 1);
  const saturation = THREE.MathUtils.clamp(d.saturation, 0, 1);
  const openness = THREE.MathUtils.clamp(d.openness, 0, 1);
  const softness = THREE.MathUtils.clamp(d.softness, 0, 1);
  const glow = THREE.MathUtils.clamp(d.glow, 0, 1);

  TARGET.flowSpeed = THREE.MathUtils.lerp(0.0, 1.45, energy);
  TARGET.swaySpeed = THREE.MathUtils.lerp(0.0, 0.18, energy);

  TARGET.layerPhaseStep = THREE.MathUtils.lerp(0.42, 1.0, energy);
  TARGET.layerYOffset = THREE.MathUtils.lerp(0.1, 0.24, openness);
  TARGET.layerXOffset = THREE.MathUtils.lerp(0.01, 0.08, openness);
  TARGET.layerTilt = THREE.MathUtils.lerp(0.01, 0.05, openness);
  TARGET.layerScaleFalloff = THREE.MathUtils.lerp(0.03, 0.07, 1.0 - openness);

  TARGET.waveAmpA = THREE.MathUtils.lerp(0.0, 0.62, energy);
  TARGET.waveAmpB = THREE.MathUtils.lerp(0.0, 0.33, energy * (1.0 - 0.35 * softness));
  TARGET.depthWaveAmp = THREE.MathUtils.lerp(0.0, 0.4, energy * (1.0 - 0.35 * softness));

  TARGET.noiseAmpY = THREE.MathUtils.lerp(0.0, 1.9, turbulence);
  TARGET.noiseScaleX = THREE.MathUtils.lerp(0.0, 0.95, turbulence);
  TARGET.noiseScaleY = THREE.MathUtils.lerp(0.0, 3.0, turbulence);
  TARGET.depthNoiseAmp = THREE.MathUtils.lerp(0.0, 2.9, turbulence);

  TARGET.baseOpacity = THREE.MathUtils.lerp(0.25, 0.7, glow);
  TARGET.opacityFalloff = THREE.MathUtils.lerp(0.01, 0.024, 1.0 - openness);
  TARGET.filamentDensity = THREE.MathUtils.lerp(18, 58, energy);
  TARGET.filamentSharpness = THREE.MathUtils.lerp(28, 8, softness);
  TARGET.shimmerFrequency = THREE.MathUtils.lerp(7, 34, energy);

  TARGET.sceneSwayYSpeed = THREE.MathUtils.lerp(0.0, 0.32, energy);
  TARGET.sceneSwayXSpeed = THREE.MathUtils.lerp(0.0, 0.22, energy);
  TARGET.sceneSwayYAmount = THREE.MathUtils.lerp(0.0, 0.11, openness);
  TARGET.sceneSwayXAmount = THREE.MathUtils.lerp(0.0, 0.04, openness);
  TARGET.baseRotationX = PARAMS.baseRotationX;

  // Saturation 0 = grayscale, 1 = original RGB ratio.
  const gray = red * 0.299 + green * 0.587 + blue * 0.114;
  const satR = gray + (red - gray) * saturation;
  const satG = gray + (green - gray) * saturation;
  const satB = gray + (blue - gray) * saturation;

  const brightness = THREE.MathUtils.lerp(0.25, 1.0, glow);
  TARGET.baseRgb.r = satR * brightness * 255;
  TARGET.baseRgb.g = satG * brightness * 255;
  TARGET.baseRgb.b = satB * brightness * 255;
}

function smoothActiveParams(deltaSeconds) {
  const alpha = 1.0 - Math.exp(-PARAMS.transitionSmoothness * deltaSeconds);

  for (let i = 0; i < BLEND_KEYS.length; i++) {
    const key = BLEND_KEYS[i];
    ACTIVE[key] = THREE.MathUtils.lerp(ACTIVE[key], TARGET[key], alpha);
  }

  ACTIVE.baseRgb.r = THREE.MathUtils.lerp(ACTIVE.baseRgb.r, TARGET.baseRgb.r, alpha);
  ACTIVE.baseRgb.g = THREE.MathUtils.lerp(ACTIVE.baseRgb.g, TARGET.baseRgb.g, alpha);
  ACTIVE.baseRgb.b = THREE.MathUtils.lerp(ACTIVE.baseRgb.b, TARGET.baseRgb.b, alpha);
}

function getLayerColors(t, outA, outB) {
  const r = THREE.MathUtils.clamp(ACTIVE.baseRgb.r, 0, 255) / 255;
  const g = THREE.MathUtils.clamp(ACTIVE.baseRgb.g, 0, 255) / 255;
  const b = THREE.MathUtils.clamp(ACTIVE.baseRgb.b, 0, 255) / 255;

  outA.setRGB(r, g, b).multiplyScalar(0.42);
  outB.setRGB(r, g, b).multiplyScalar(0.9 + t * 0.22);
}

function createMeaningfulMixerUI() {
  const panel = document.createElement("div");
  panel.style.position = "fixed";
  panel.style.right = "12px";
  panel.style.top = "12px";
  panel.style.width = "300px";
  panel.style.padding = "10px";
  panel.style.boxSizing = "border-box";
  panel.style.background = "rgba(0, 0, 0, 0.62)";
  panel.style.border = "1px solid rgba(255, 200, 120, 0.35)";
  panel.style.borderRadius = "8px";
  panel.style.color = "#ffd7a1";
  panel.style.font = "12px/1.3 monospace";
  panel.style.zIndex = "20";
  panel.style.backdropFilter = "blur(4px)";

  function addSectionHeader(labelText) {
    const header = document.createElement("div");
    header.textContent = labelText;
    header.style.marginTop = "8px";
    header.style.marginBottom = "4px";
    header.style.fontWeight = "700";
    header.style.opacity = "0.95";
    header.style.letterSpacing = "0.2px";
    header.style.textAlign = "center";
    panel.appendChild(header);
  }

  function addDimensionSlider(key, labelText) {
    const row = document.createElement("label");
    row.style.display = "grid";
    row.style.gridTemplateColumns = "76px minmax(0, 1fr) 44px";
    row.style.gap = "6px";
    row.style.alignItems = "center";
    row.style.margin = "6px 0";

    const name = document.createElement("span");
    name.textContent = labelText;

    const input = document.createElement("input");
    input.type = "range";
    input.min = "0";
    input.max = "1";
    input.step = "0.01";
    input.value = String(PARAMS.emotionDimensions[key].toFixed(2));

    const value = document.createElement("span");
    value.textContent = PARAMS.emotionDimensions[key].toFixed(2);
    value.style.textAlign = "right";

    input.addEventListener("input", () => {
      PARAMS.emotionDimensions[key] = Number(input.value);
      value.textContent = Number(input.value).toFixed(2);
      updateTargetFromDimensions();
    });

    row.appendChild(name);
    row.appendChild(input);
    row.appendChild(value);
    panel.appendChild(row);
  }

  addSectionHeader("Dynamics");
  addDimensionSlider("energy", "energy");
  addDimensionSlider("turbulence", "noise");

  addSectionHeader("Form");
  addDimensionSlider("openness", "openness");
  addDimensionSlider("softness", "softness");

  addSectionHeader("Color");
  addDimensionSlider("red", "red");
  addDimensionSlider("green", "green");
  addDimensionSlider("blue", "blue");
  addDimensionSlider("saturation", "saturation");
  addDimensionSlider("glow", "glow");

  document.body.appendChild(panel);
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 0, 7.5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 1.8;
controls.maxDistance = 14;
controls.maxPolarAngle = Math.PI * 0.92;
controls.update();

const ribbonGeometry = new THREE.PlaneGeometry(
  PARAMS.waveWidth,
  PARAMS.waveHeight,
  PARAMS.meshDensityX,
  PARAMS.meshDensityY
);

const vertexShader = `
  uniform float uTime;
  uniform float uPhase;
  uniform float uWaveAmpA;
  uniform float uWaveAmpB;
  uniform float uNoiseAmpY;
  uniform float uNoiseScaleX;
  uniform float uNoiseScaleY;
  uniform float uDepthNoiseAmp;
  uniform float uDepthWaveAmp;

  varying vec2 vUv;
  varying float vNoise;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 5; i++) {
      value += amp * noise(p);
      p *= 2.0;
      amp *= 0.5;
    }
    return value;
  }

  void main() {
    vUv = uv;

    vec3 p = position;
    float body = pow(max(0.0, 1.0 - abs(uv.y - 0.5) * 2.0), 1.25);

    float waveA = sin(p.x * 1.15 + uTime * 0.95 + uPhase) * uWaveAmpA;
    float waveB = sin(p.x * 2.85 - uTime * 0.62 + uPhase * 1.2) * uWaveAmpB;
    float n = fbm(vec2(p.x * uNoiseScaleX + uTime * 0.16 + uPhase * 0.5, p.y * uNoiseScaleY - uTime * 0.08));

    p.y += waveA + waveB + (n - 0.5) * uNoiseAmpY * body;
    p.z += (n - 0.5) * uDepthNoiseAmp * body + sin(p.x * 0.55 - uTime * 0.5 + uPhase) * uDepthWaveAmp * body;

    vNoise = n;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uOpacity;
  uniform float uFilamentDensity;
  uniform float uFilamentSharpness;
  uniform float uShimmerFrequency;

  varying vec2 vUv;
  varying float vNoise;

  void main() {
    float body = pow(max(0.0, 1.0 - abs(vUv.y - 0.5) * 2.0), 1.25);
    float edge = smoothstep(0.03, 0.2, vUv.x) * smoothstep(0.03, 0.2, 1.0 - vUv.x);

    float filaments = pow(abs(sin((vUv.y * uFilamentDensity + vUv.x * 2.4 + uTime * 0.72 + vNoise * 0.9) * 3.14159)), uFilamentSharpness);
    float shimmer = 0.65 + 0.35 * sin(vUv.x * uShimmerFrequency + uTime * 1.7 + vNoise * 4.0);

    vec3 color = mix(uColorA, uColorB, clamp(vUv.x * 0.75 + vNoise * 0.45, 0.0, 1.0));
    float alpha = (0.10 + filaments * 0.75) * body * edge * shimmer * uOpacity;

    gl_FragColor = vec4(color, alpha);
  }
`;

const ribbons = [];
const waveGroup = new THREE.Group();
waveGroup.scale.setScalar(PARAMS.globalScale);
scene.add(waveGroup);

for (let i = 0; i < PARAMS.layerCount; i++) {
  const t = PARAMS.layerCount > 1 ? i / (PARAMS.layerCount - 1) : 0;
  const colorA = new THREE.Color();
  const colorB = new THREE.Color();
  getLayerColors(t, colorA, colorB);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPhase: { value: i * PARAMS.layerPhaseStep },
      uColorA: { value: colorA },
      uColorB: { value: colorB },
      uOpacity: { value: PARAMS.baseOpacity - t * PARAMS.opacityFalloff },
      uWaveAmpA: { value: PARAMS.waveAmpA },
      uWaveAmpB: { value: PARAMS.waveAmpB },
      uNoiseAmpY: { value: PARAMS.noiseAmpY },
      uNoiseScaleX: { value: PARAMS.noiseScaleX },
      uNoiseScaleY: { value: PARAMS.noiseScaleY },
      uDepthNoiseAmp: { value: PARAMS.depthNoiseAmp },
      uDepthWaveAmp: { value: PARAMS.depthWaveAmp },
      uFilamentDensity: { value: PARAMS.filamentDensity },
      uFilamentSharpness: { value: PARAMS.filamentSharpness },
      uShimmerFrequency: { value: PARAMS.shimmerFrequency }
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });

  const ribbon = new THREE.Mesh(ribbonGeometry, material);
  const centered = i - (PARAMS.layerCount - 1) * 0.5;
  ribbon.position.y = centered * PARAMS.layerYOffset;
  ribbon.position.x = centered * PARAMS.layerXOffset;
  ribbon.rotation.z = centered * PARAMS.layerTilt;
  ribbon.scale.setScalar(1.0 - i * PARAMS.layerScaleFalloff);
  ribbon.userData.layerT = t;

  ribbons.push(ribbon);
  waveGroup.add(ribbon);
}

const ambientLight = new THREE.AmbientLight(0xffd9a8, 0.45);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffc56e, 0.75);
directionalLight.position.set(2, 1, 4);
scene.add(directionalLight);

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener("resize", onWindowResize);

const clock = new THREE.Clock();
const tempColorA = new THREE.Color();
const tempColorB = new THREE.Color();
let flowTime = 0;
let swayTime = 0;
updateTargetFromDimensions();
createMeaningfulMixerUI();

function animate() {
  requestAnimationFrame(animate);
  updateTargetFromDimensions();
  const deltaTime = clock.getDelta();
  smoothActiveParams(deltaTime);

  flowTime += deltaTime * ACTIVE.flowSpeed;
  swayTime += deltaTime * ACTIVE.swaySpeed;

  for (let i = 0; i < ribbons.length; i++) {
    const ribbon = ribbons[i];
    const uniforms = ribbon.material.uniforms;
    const t = ribbon.userData.layerT;
    const centered = i - (PARAMS.layerCount - 1) * 0.5;

    getLayerColors(t, tempColorA, tempColorB);

    uniforms.uTime.value = flowTime;
    uniforms.uColorA.value.copy(tempColorA);
    uniforms.uColorB.value.copy(tempColorB);
    uniforms.uOpacity.value = ACTIVE.baseOpacity - t * ACTIVE.opacityFalloff;

    uniforms.uPhase.value = i * ACTIVE.layerPhaseStep;

    uniforms.uWaveAmpA.value = ACTIVE.waveAmpA;
    uniforms.uWaveAmpB.value = ACTIVE.waveAmpB;
    uniforms.uNoiseAmpY.value = ACTIVE.noiseAmpY;
    uniforms.uNoiseScaleX.value = ACTIVE.noiseScaleX;
    uniforms.uNoiseScaleY.value = ACTIVE.noiseScaleY;
    uniforms.uDepthNoiseAmp.value = ACTIVE.depthNoiseAmp;
    uniforms.uDepthWaveAmp.value = ACTIVE.depthWaveAmp;
    uniforms.uFilamentDensity.value = ACTIVE.filamentDensity;
    uniforms.uFilamentSharpness.value = ACTIVE.filamentSharpness;
    uniforms.uShimmerFrequency.value = ACTIVE.shimmerFrequency;

    ribbon.position.y = centered * ACTIVE.layerYOffset;
    ribbon.position.x = centered * ACTIVE.layerXOffset;
    ribbon.rotation.z = centered * ACTIVE.layerTilt;
    ribbon.scale.setScalar(1.0 - i * ACTIVE.layerScaleFalloff);
  }

  controls.update();

  waveGroup.rotation.y = Math.sin(swayTime * ACTIVE.sceneSwayYSpeed) * ACTIVE.sceneSwayYAmount;
  waveGroup.rotation.x = ACTIVE.baseRotationX + Math.sin(swayTime * ACTIVE.sceneSwayXSpeed) * ACTIVE.sceneSwayXAmount;

  renderer.render(scene, camera);
}

animate();
