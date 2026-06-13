import * as THREE from "https://unpkg.com/three@0.168.0/build/three.module.js?module";
import { OrbitControls } from "https://unpkg.com/three@0.168.0/examples/jsm/controls/OrbitControls.js?module";

// Tune these values and reload to shape the whole look quickly.
const PARAMS = {
  speed: 0.42,

  waveWidth: 14,
  waveHeight: 3.8,
  meshDensityX: 620,
  meshDensityY: 140,

  layerCount: 6,
  layerPhaseStep: 0.65,
  layerYOffset: 0.17,
  layerXOffset: 0.05,
  layerTilt: 0.03,
  layerScaleFalloff: 0.05,

  colorAH: 0.08,
  colorAS: 0.7,
  colorAL: 0.35,
  colorBH: 0.11,
  colorBS: 0.95,
  colorBL: 0.72,
  colorBHueShiftPerLayer: 0.02,

  // Single master RGB color. Edit this to recolor the whole wave quickly.
  baseRgb: { r: 240, g: 180, b: 95 },

  baseOpacity: 0.4,
  opacityFalloff: 0.015,

  waveAmpA: 0.32,
  waveAmpB: 0.14,
  noiseAmpY: 0.95,
  noiseScaleX: 0.42,
  noiseScaleY: 1.9,
  depthNoiseAmp: 1.6,
  depthWaveAmp: 0.34,

  filamentDensity: 34,
  filamentSharpness: 16,
  shimmerFrequency: 18,

  sceneSwayYSpeed: 0.15,
  sceneSwayXSpeed: 0.1,
  sceneSwayYAmount: 0.06,
  sceneSwayXAmount: 0.02,
  baseRotationX: -Math.PI * 0.5,

  debug: {
    enabled: false,
    wireframe: false,
    singleLayer: false,
    disableNoise: false,
    pause: false,
    showOverlay: true
  }
};

window.WAVE_PARAMS = PARAMS;

function getLayerColors(t, outA, outB) {
  const hasRgb =
    PARAMS.baseRgb &&
    Number.isFinite(PARAMS.baseRgb.r) &&
    Number.isFinite(PARAMS.baseRgb.g) &&
    Number.isFinite(PARAMS.baseRgb.b);

  if (hasRgb) {
    const r = THREE.MathUtils.clamp(PARAMS.baseRgb.r, 0, 255) / 255;
    const g = THREE.MathUtils.clamp(PARAMS.baseRgb.g, 0, 255) / 255;
    const b = THREE.MathUtils.clamp(PARAMS.baseRgb.b, 0, 255) / 255;

    outA.setRGB(r, g, b).multiplyScalar(0.42);
    outB.setRGB(r, g, b).multiplyScalar(0.9 + t * 0.22);
    return;
  }

  outA.setHSL(PARAMS.colorAH, PARAMS.colorAS, PARAMS.colorAL);
  outB.setHSL(
    PARAMS.colorBH + t * PARAMS.colorBHueShiftPerLayer,
    PARAMS.colorBS,
    PARAMS.colorBL
  );
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
controls.minDistance = 4.5;
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
  uniform float uNoiseMix;
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
    float nRaw = fbm(vec2(p.x * uNoiseScaleX + uTime * 0.16 + uPhase * 0.5, p.y * uNoiseScaleY - uTime * 0.08));
    float n = mix(0.5, nRaw, uNoiseMix);

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
      uNoiseMix: { value: 1.0 },
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

const debugOverlay = document.createElement("div");
debugOverlay.style.position = "fixed";
debugOverlay.style.top = "12px";
debugOverlay.style.left = "12px";
debugOverlay.style.padding = "10px 12px";
debugOverlay.style.background = "rgba(0, 0, 0, 0.6)";
debugOverlay.style.color = "#f2d8a7";
debugOverlay.style.font = "12px/1.4 monospace";
debugOverlay.style.border = "1px solid rgba(255, 205, 130, 0.4)";
debugOverlay.style.borderRadius = "8px";
debugOverlay.style.pointerEvents = "none";
debugOverlay.style.zIndex = "10";
document.body.appendChild(debugOverlay);

function updateDebugView() {
  const centerIndex = Math.floor(PARAMS.layerCount * 0.5);

  for (let i = 0; i < ribbons.length; i++) {
    const ribbon = ribbons[i];
    const material = ribbon.material;
    const visible = !PARAMS.debug.singleLayer || i === centerIndex;

    ribbon.visible = visible;
    material.wireframe = PARAMS.debug.wireframe;
    material.uniforms.uNoiseMix.value = PARAMS.debug.disableNoise ? 0.0 : 1.0;
  }

  debugOverlay.style.display = PARAMS.debug.enabled && PARAMS.debug.showOverlay ? "block" : "none";
  debugOverlay.textContent =
    "Debug Mode\n" +
    "1: toggle debug\n" +
    "2: wireframe = " + PARAMS.debug.wireframe + "\n" +
    "3: single layer = " + PARAMS.debug.singleLayer + "\n" +
    "4: noise off = " + PARAMS.debug.disableNoise + "\n" +
    "5: pause = " + PARAMS.debug.pause + "\n" +
    "h: show or hide this";
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();

  if (key === "1") {
    PARAMS.debug.enabled = !PARAMS.debug.enabled;
  }

  if (key === "h") {
    PARAMS.debug.showOverlay = !PARAMS.debug.showOverlay;
  }

  if (!PARAMS.debug.enabled) {
    updateDebugView();
    return;
  }

  if (key === "2") {
    PARAMS.debug.wireframe = !PARAMS.debug.wireframe;
  } else if (key === "3") {
    PARAMS.debug.singleLayer = !PARAMS.debug.singleLayer;
  } else if (key === "4") {
    PARAMS.debug.disableNoise = !PARAMS.debug.disableNoise;
  } else if (key === "5") {
    PARAMS.debug.pause = !PARAMS.debug.pause;
  }

  updateDebugView();
});

updateDebugView();

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

function animate() {
  requestAnimationFrame(animate);
  if (PARAMS.debug.pause) {
    controls.update();
    renderer.render(scene, camera);
    return;
  }

  const time = clock.getElapsedTime();
  const slowTime = time * PARAMS.speed;

  for (let i = 0; i < ribbons.length; i++) {
    const ribbon = ribbons[i];
    const uniforms = ribbon.material.uniforms;
    const t = ribbon.userData.layerT;

    getLayerColors(t, tempColorA, tempColorB);

    uniforms.uTime.value = slowTime;
    uniforms.uColorA.value.copy(tempColorA);
    uniforms.uColorB.value.copy(tempColorB);
    uniforms.uOpacity.value = PARAMS.baseOpacity - t * PARAMS.opacityFalloff;

    uniforms.uWaveAmpA.value = PARAMS.waveAmpA;
    uniforms.uWaveAmpB.value = PARAMS.waveAmpB;
    uniforms.uNoiseAmpY.value = PARAMS.noiseAmpY;
    uniforms.uNoiseScaleX.value = PARAMS.noiseScaleX;
    uniforms.uNoiseScaleY.value = PARAMS.noiseScaleY;
    uniforms.uDepthNoiseAmp.value = PARAMS.depthNoiseAmp;
    uniforms.uDepthWaveAmp.value = PARAMS.depthWaveAmp;
    uniforms.uFilamentDensity.value = PARAMS.filamentDensity;
    uniforms.uFilamentSharpness.value = PARAMS.filamentSharpness;
    uniforms.uShimmerFrequency.value = PARAMS.shimmerFrequency;
  }

  controls.update();

  waveGroup.rotation.y = Math.sin(slowTime * PARAMS.sceneSwayYSpeed) * PARAMS.sceneSwayYAmount;
  waveGroup.rotation.x = PARAMS.baseRotationX + Math.sin(slowTime * PARAMS.sceneSwayXSpeed) * PARAMS.sceneSwayXAmount;

  renderer.render(scene, camera);
}

animate();
