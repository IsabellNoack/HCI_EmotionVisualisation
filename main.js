import * as THREE from "https://unpkg.com/three@0.168.0/build/three.module.js?module";
import { OrbitControls } from "https://unpkg.com/three@0.168.0/examples/jsm/controls/OrbitControls.js?module";

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

const ribbonGeometry = new THREE.PlaneGeometry(14, 3.8, 620, 140);

const vertexShader = `
  uniform float uTime;
  uniform float uPhase;

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

    float waveA = sin(p.x * 1.15 + uTime * 0.95 + uPhase) * 0.32;
    float waveB = sin(p.x * 2.85 - uTime * 0.62 + uPhase * 1.2) * 0.14;
    float n = fbm(vec2(p.x * 0.42 + uTime * 0.16 + uPhase * 0.5, p.y * 1.9 - uTime * 0.08));

    p.y += waveA + waveB + (n - 0.5) * 0.95 * body;
    p.z += (n - 0.5) * 1.6 * body + sin(p.x * 0.55 - uTime * 0.5 + uPhase) * 0.34 * body;

    vNoise = n;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uOpacity;

  varying vec2 vUv;
  varying float vNoise;

  void main() {
    float body = pow(max(0.0, 1.0 - abs(vUv.y - 0.5) * 2.0), 1.25);
    float edge = smoothstep(0.03, 0.2, vUv.x) * smoothstep(0.03, 0.2, 1.0 - vUv.x);

    float filaments = pow(abs(sin((vUv.y * 34.0 + vUv.x * 2.4 + uTime * 0.72 + vNoise * 0.9) * 3.14159)), 16.0);
    float shimmer = 0.65 + 0.35 * sin(vUv.x * 18.0 + uTime * 1.7 + vNoise * 4.0);

    vec3 color = mix(uColorA, uColorB, clamp(vUv.x * 0.75 + vNoise * 0.45, 0.0, 1.0));
    float alpha = (0.10 + filaments * 0.75) * body * edge * shimmer * uOpacity;

    gl_FragColor = vec4(color, alpha);
  }
`;

const ribbons = [];

for (let i = 0; i < 6; i++) {
  const t = i / 5;
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPhase: { value: i * 0.65 },
      uColorA: { value: new THREE.Color().setHSL(0.08, 0.7, 0.35) },
      uColorB: { value: new THREE.Color().setHSL(0.11 + t * 0.02, 0.95, 0.72) },
      uOpacity: { value: 0.22 - t * 0.015 }
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });

  const ribbon = new THREE.Mesh(ribbonGeometry, material);
  ribbon.position.y = (i - 2.5) * 0.17;
  ribbon.position.x = (i - 2.5) * 0.05;
  ribbon.rotation.z = (i - 2.5) * 0.03;
  ribbon.scale.setScalar(1.0 - i * 0.05);

  ribbons.push(ribbon);
  scene.add(ribbon);
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

function animate() {
  requestAnimationFrame(animate);
  const time = clock.getElapsedTime();
  const slowTime = time * 0.42;

  for (let i = 0; i < ribbons.length; i++) {
    const ribbon = ribbons[i];
    ribbon.material.uniforms.uTime.value = slowTime;
  }

  controls.update();

  scene.rotation.y = Math.sin(slowTime * 0.15) * 0.06;
  scene.rotation.x = Math.sin(slowTime * 0.1) * 0.02;

  renderer.render(scene, camera);
}

animate();
