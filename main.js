import * as THREE from "https://unpkg.com/three@0.168.0/build/three.module.js?module";
import { OrbitControls } from "https://unpkg.com/three@0.168.0/examples/jsm/controls/OrbitControls.js?module";
import * as AUDIO_SYSTEM from "./audio.js";

const PARAMS = {
  transitionSmoothness: 6.0,
  bpmSync: true,

  waveWidth: 14,
  waveHeight: 3.8,
  meshDensityX: 620,
  meshDensityY: 140,
  globalScale: 1.35,

  layerCount: 6,
  baseRotationX: -Math.PI * 0.5,

  dimensions: {
    energy: 0.45,
    turbulence: 0.45,
    depth: 0.55,
    detail: 0.5,
    lineCount: 3,
    lineSpacing: 0.5,
    lineSharpness: 0.8,
    lineFill: 0.18,
    red: 0.94,
    green: 0.71,
    blue: 0.37,
    saturation: 0.78,
    openness: 0.55,
    softness: 0.5,
    glow: 1.0,
    shimmerAmount: 0.7
  },

  debug: {
    freeze: false,
    wireframe: false,
    singleLayer: false,
    noNoise: false,
    noSway: false,
    additive: true,
    cameraPan: false
  }
};

window.WAVE_PARAMS = PARAMS;
window.DIMENSIONS = PARAMS.dimensions;
window.DEBUG_OPTIONS = PARAMS.debug;

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
  bandCount: 3,
  bandSpacing: 0.08,
  bandSharpness: 0.8,
  bandFill: 0.18,
  baseRotationX: PARAMS.baseRotationX,
  baseRgb: { r: 240, g: 180, b: 95 },
  shimmerAmount: 0.7,
  alphaMultiplier: 1.0
};

const TARGET = {
  ...ACTIVE,
  baseRgb: { ...ACTIVE.baseRgb }
};

const uiUpdateCallbacks = [];

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
  "bandCount",
  "bandSpacing",
  "bandSharpness",
  "bandFill",
  "baseRotationX",
  "shimmerAmount",
  "alphaMultiplier"
];

function updateTargetFromDimensions() {
  const d = PARAMS.dimensions;
  const energy = THREE.MathUtils.clamp(d.energy, 0, 1);
  const turbulence = THREE.MathUtils.clamp(d.turbulence, 0, 1);
  const depth = THREE.MathUtils.clamp(d.depth, 0, 1);
  const detail = THREE.MathUtils.clamp(d.detail, 0, 1);
  const lineCountSteps = THREE.MathUtils.clamp(Math.round(d.lineCount), 1, 5);
  const lineSpacing = THREE.MathUtils.clamp(d.lineSpacing, 0, 1);
  const lineSharpness = THREE.MathUtils.clamp(d.lineSharpness, 0, 1);
  const lineFill = THREE.MathUtils.clamp(d.lineFill, 0, 1);
  const red = THREE.MathUtils.clamp(d.red, 0, 1);
  const green = THREE.MathUtils.clamp(d.green, 0, 1);
  const blue = THREE.MathUtils.clamp(d.blue, 0, 1);
  const saturation = THREE.MathUtils.clamp(d.saturation, 0, 1);
  const openness = THREE.MathUtils.clamp(d.openness, 0, 1);
  const softness = THREE.MathUtils.clamp(d.softness, 0, 1);
  const glow = THREE.MathUtils.clamp(d.glow, 0, 2);
  const shimmerAmount = THREE.MathUtils.clamp(d.shimmerAmount !== undefined ? d.shimmerAmount : 0.7, 0, 1);

  TARGET.flowSpeed = THREE.MathUtils.lerp(0.0, 1.45, energy);
  TARGET.swaySpeed = THREE.MathUtils.lerp(0.0, 0.18, energy);

  TARGET.layerPhaseStep = THREE.MathUtils.lerp(0.42, 1.0, energy);
  TARGET.layerYOffset = THREE.MathUtils.lerp(0.08, 0.26, openness * (0.5 + 0.5 * depth));
  TARGET.layerXOffset = THREE.MathUtils.lerp(0.005, 0.09, openness * (0.5 + 0.5 * depth));
  TARGET.layerTilt = THREE.MathUtils.lerp(0.01, 0.05, openness);
  TARGET.layerScaleFalloff = THREE.MathUtils.lerp(0.03, 0.07, 1.0 - openness);

  TARGET.waveAmpA = THREE.MathUtils.lerp(0.0, 0.62, energy);
  TARGET.waveAmpB = THREE.MathUtils.lerp(0.0, 0.33, energy * (1.0 - 0.35 * softness));
  TARGET.depthWaveAmp = THREE.MathUtils.lerp(0.0, 0.5, depth * energy * (1.0 - 0.35 * softness));

  TARGET.noiseAmpY = THREE.MathUtils.lerp(0.0, 1.9, turbulence);
  TARGET.noiseScaleX = THREE.MathUtils.lerp(0.0, 0.95, turbulence);
  TARGET.noiseScaleY = THREE.MathUtils.lerp(0.0, 3.0, turbulence);
  TARGET.depthNoiseAmp = THREE.MathUtils.lerp(0.0, 3.2, turbulence * depth);

  TARGET.baseOpacity = THREE.MathUtils.lerp(0.25, 1.0, Math.min(glow, 1.0));
  TARGET.opacityFalloff = THREE.MathUtils.lerp(0.01, 0.024, 1.0 - openness);
  TARGET.filamentDensity = THREE.MathUtils.lerp(12, 72, detail);
  TARGET.filamentSharpness = THREE.MathUtils.lerp(8, 30, detail * (1.0 - softness * 0.5));
  TARGET.shimmerFrequency = THREE.MathUtils.lerp(5, 40, detail * (0.25 + 0.75 * energy));

  TARGET.sceneSwayYSpeed = THREE.MathUtils.lerp(0.0, 0.32, energy);
  TARGET.sceneSwayXSpeed = THREE.MathUtils.lerp(0.0, 0.22, energy);
  TARGET.sceneSwayYAmount = THREE.MathUtils.lerp(0.0, 0.11, openness);
  TARGET.sceneSwayXAmount = THREE.MathUtils.lerp(0.0, 0.04, openness);
  TARGET.bandCount = lineCountSteps * 2 - 1;
  TARGET.bandSpacing = THREE.MathUtils.lerp(0.035, 0.16, lineSpacing);
  TARGET.bandSharpness = lineSharpness;
  TARGET.bandFill = lineFill;
  TARGET.baseRotationX = PARAMS.baseRotationX;

  // Saturation 0 = grayscale, 1 = original RGB ratio.
  const gray = red * 0.299 + green * 0.587 + blue * 0.114;
  const satR = gray + (red - gray) * saturation;
  const satG = gray + (green - gray) * saturation;
  const satB = gray + (blue - gray) * saturation;

  const brightness = THREE.MathUtils.lerp(0.25, 1.0, Math.min(glow, 1.0));
  TARGET.baseRgb.r = satR * brightness * 255;
  TARGET.baseRgb.g = satG * brightness * 255;
  TARGET.baseRgb.b = satB * brightness * 255;

  TARGET.shimmerAmount = shimmerAmount;
  TARGET.alphaMultiplier = glow;
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
  panel.style.boxSizing = "border-box";
  panel.style.background = "rgba(0, 0, 0, 0.62)";
  panel.style.border = "1px solid rgba(255, 200, 120, 0.35)";
  panel.style.borderRadius = "8px";
  panel.style.color = "#ffd7a1";
  panel.style.font = "12px/1.3 monospace";
  panel.style.zIndex = "20";
  panel.style.backdropFilter = "blur(4px)";

  const contentWrapper = document.createElement("div");
  contentWrapper.className = "ui-panel-content";
  contentWrapper.style.maxHeight = "calc(100vh - 24px)";
  contentWrapper.style.overflowY = "auto";
  contentWrapper.style.padding = "10px";
  contentWrapper.style.boxSizing = "border-box";
  contentWrapper.style.scrollbarWidth = "thin";
  contentWrapper.style.scrollbarColor = "rgba(255, 200, 120, 0.3) rgba(0, 0, 0, 0.2)";

  // Collapsible panel settings
  let isCollapsed = localStorage.getItem("panel-collapsed") === "true";

  const toggleBtn = document.createElement("button");
  toggleBtn.style.position = "absolute";
  toggleBtn.style.left = "-36px";
  toggleBtn.style.top = "12px";
  toggleBtn.style.width = "36px";
  toggleBtn.style.height = "36px";
  toggleBtn.style.background = "rgba(0, 0, 0, 0.62)";
  toggleBtn.style.border = "1px solid rgba(255, 200, 120, 0.35)";
  toggleBtn.style.borderRight = "none";
  toggleBtn.style.borderRadius = "8px 0 0 8px";
  toggleBtn.style.color = "#ffd7a1";
  toggleBtn.style.cursor = "pointer";
  toggleBtn.style.display = "flex";
  toggleBtn.style.alignItems = "center";
  toggleBtn.style.justifyContent = "center";
  toggleBtn.style.backdropFilter = "blur(4px)";
  toggleBtn.style.outline = "none";
  toggleBtn.style.padding = "0";

  toggleBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);">
      <polyline points="9 18 15 12 9 6"></polyline>
    </svg>
  `;
  const svg = toggleBtn.querySelector("svg");

  toggleBtn.addEventListener("mouseenter", () => {
    toggleBtn.style.background = "rgba(0, 0, 0, 0.8)";
    toggleBtn.style.borderColor = "rgba(255, 200, 120, 0.6)";
  });
  toggleBtn.addEventListener("mouseleave", () => {
    toggleBtn.style.background = "rgba(0, 0, 0, 0.62)";
    toggleBtn.style.borderColor = "rgba(255, 200, 120, 0.35)";
  });

  function setCollapsed(collapsed) {
    isCollapsed = collapsed;
    localStorage.setItem("panel-collapsed", String(isCollapsed));
    if (isCollapsed) {
      panel.style.transform = "translateX(calc(100% + 12px))";
      svg.style.transform = "rotate(180deg)";
    } else {
      panel.style.transform = "translateX(0)";
      svg.style.transform = "rotate(0deg)";
    }
  }

  toggleBtn.addEventListener("click", () => {
    setCollapsed(!isCollapsed);
  });

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      const active = document.activeElement;
      if (active && (
        active.tagName === "INPUT" ||
        active.tagName === "TEXTAREA" ||
        active.tagName === "SELECT" ||
        active.isContentEditable
      )) {
        return;
      }
      e.preventDefault();
      setCollapsed(!isCollapsed);
    }
  });

  // Set initial state without animation
  if (isCollapsed) {
    panel.style.transform = "translateX(calc(100% + 12px))";
    svg.style.transform = "rotate(180deg)";
  } else {
    panel.style.transform = "translateX(0)";
    svg.style.transform = "rotate(0deg)";
  }

  requestAnimationFrame(() => {
    panel.style.transition = "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)";
  });

  panel.appendChild(toggleBtn);
  panel.appendChild(contentWrapper);

  const sliders = [];

  const randomizeBtn = document.createElement("button");
  randomizeBtn.textContent = "Randomize";
  randomizeBtn.style.width = "100%";
  randomizeBtn.style.padding = "8px 12px";
  randomizeBtn.style.marginTop = "14px";
  randomizeBtn.style.marginBottom = "0px";
  randomizeBtn.style.background = "transparent";
  randomizeBtn.style.border = "1px solid rgba(255, 215, 161, 0.5)";
  randomizeBtn.style.borderRadius = "6px";
  randomizeBtn.style.color = "#ffd7a1";
  randomizeBtn.style.font = "bold 11px monospace";
  randomizeBtn.style.cursor = "pointer";
  randomizeBtn.style.transition = "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)";
  randomizeBtn.style.letterSpacing = "1px";
  randomizeBtn.style.textTransform = "uppercase";
  randomizeBtn.style.boxShadow = "0 0 4px rgba(255, 215, 161, 0.05)";
  randomizeBtn.style.outline = "none";

  randomizeBtn.addEventListener("mouseenter", () => {
    randomizeBtn.style.background = "transparent";
    randomizeBtn.style.border = "2px solid rgba(255, 215, 161, 0.85)";
    randomizeBtn.style.padding = "7px 11px";
    randomizeBtn.style.boxShadow = "0 0 12px rgba(255, 215, 161, 0.4)";
    randomizeBtn.style.transform = "translateY(-1px)";
  });

  randomizeBtn.addEventListener("mouseleave", () => {
    randomizeBtn.style.background = "transparent";
    randomizeBtn.style.border = "1px solid rgba(255, 215, 161, 0.5)";
    randomizeBtn.style.padding = "8px 12px";
    randomizeBtn.style.boxShadow = "0 0 4px rgba(255, 215, 161, 0.05)";
    randomizeBtn.style.transform = "translateY(0)";
  });

  randomizeBtn.addEventListener("mousedown", () => {
    randomizeBtn.style.transform = "translateY(1px)";
    randomizeBtn.style.boxShadow = "0 0 6px rgba(255, 215, 161, 0.2)";
  });

  randomizeBtn.addEventListener("mouseup", () => {
    randomizeBtn.style.transform = "translateY(-1px)";
  });

  randomizeBtn.addEventListener("click", () => {
    randomizeBtn.style.transform = "scale(0.95)";
    setTimeout(() => {
      randomizeBtn.style.transform = "translateY(-1px)";
    }, 100);

    sliders.forEach(s => s.randomize());
    updateTargetFromDimensions();
  });

  function addSectionHeader(labelText) {
    const header = document.createElement("div");
    header.textContent = labelText;
    header.style.marginTop = "8px";
    header.style.marginBottom = "4px";
    header.style.fontWeight = "700";
    header.style.opacity = "0.95";
    header.style.letterSpacing = "0.2px";
    header.style.textAlign = "center";
    contentWrapper.appendChild(header);
  }

  function addDimensionSlider(key, labelText, skewPower = 1) {
    addSlider(key, labelText, 0, 1, 0.01, (v) => v.toFixed(2), skewPower);
  }

  function addParamSlider(key, labelText, min, max, step, formatValue, skewPower = 1, randomMin = null, randomMax = null) {
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
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(PARAMS[key]);

    const value = document.createElement("span");
    value.textContent = formatValue(PARAMS[key]);
    value.style.textAlign = "right";

    const updateUI = () => {
      input.value = String(PARAMS[key]);
      value.textContent = formatValue(PARAMS[key]);
    };
    uiUpdateCallbacks.push(updateUI);

    input.addEventListener("input", () => {
      PARAMS[key] = Number(input.value);
      value.textContent = formatValue(PARAMS[key]);
    });

    row.appendChild(name);
    row.appendChild(input);
    row.appendChild(value);
    contentWrapper.appendChild(row);

    sliders.push({
      randomize: () => {
        const rMin = randomMin !== null ? randomMin : min;
        const rMax = randomMax !== null ? randomMax : max;
        const rand = Math.pow(Math.random(), skewPower);
        const range = rMax - rMin;
        const steps = Math.round(range / step);
        const randomStep = Math.floor(rand * (steps + 1));
        const val = rMin + Math.min(randomStep, steps) * step;
        PARAMS[key] = Number(val.toFixed(5));
        updateUI();
      }
    });
  }

  function addSlider(key, labelText, min, max, step, formatValue, skewPower = 1, randomMin = null, randomMax = null) {
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
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(PARAMS.dimensions[key]);

    const value = document.createElement("span");
    value.textContent = formatValue(PARAMS.dimensions[key]);
    value.style.textAlign = "right";

    const updateUI = () => {
      input.value = String(PARAMS.dimensions[key]);
      value.textContent = formatValue(PARAMS.dimensions[key]);
    };
    uiUpdateCallbacks.push(updateUI);

    input.addEventListener("input", () => {
      PARAMS.dimensions[key] = Number(input.value);
      value.textContent = formatValue(Number(input.value));
      updateTargetFromDimensions();
    });

    row.appendChild(name);
    row.appendChild(input);
    row.appendChild(value);
    contentWrapper.appendChild(row);

    sliders.push({
      randomize: () => {
        const rMin = randomMin !== null ? randomMin : min;
        const rMax = randomMax !== null ? randomMax : max;
        const rand = Math.pow(Math.random(), skewPower);
        const range = rMax - rMin;
        const steps = Math.round(range / step);
        const randomStep = Math.floor(rand * (steps + 1));
        const val = rMin + Math.min(randomStep, steps) * step;
        PARAMS.dimensions[key] = Number(val.toFixed(5));
        updateUI();
      }
    });
  }

  function addDebugCheckbox(key, labelText) {
    const row = document.createElement("label");
    row.style.display = "grid";
    row.style.gridTemplateColumns = "1fr auto";
    row.style.gap = "8px";
    row.style.alignItems = "center";
    row.style.margin = "4px 0";

    const name = document.createElement("span");
    name.textContent = labelText;

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = PARAMS.debug[key];

    const updateUI = () => {
      input.checked = PARAMS.debug[key];
    };
    uiUpdateCallbacks.push(updateUI);

    input.addEventListener("change", () => {
      PARAMS.debug[key] = input.checked;
    });

    row.appendChild(name);
    row.appendChild(input);
    contentWrapper.appendChild(row);
  }

  addSectionHeader("Dynamics");
  addDimensionSlider("energy", "energy");
  addDimensionSlider("turbulence", "noise");
  addDimensionSlider("depth", "depth");
  addDimensionSlider("detail", "detail");

  addSectionHeader("Lines");
  addSlider("lineCount", "count", 1, 5, 1, (v) => String(Math.round(v) * 2 - 1));
  addSlider("lineSpacing", "spacing", 0, 1, 0.005, (v) => Number(v).toFixed(3));
  addDimensionSlider("lineSharpness", "sharpness");
  addDimensionSlider("lineFill", "fill", 2.2);

  addSectionHeader("Form");
  addParamSlider("layerCount", "layers", 1, 16, 1, (v) => String(Math.round(v)));
  addDimensionSlider("openness", "openness");
  addDimensionSlider("softness", "softness");

  addSectionHeader("Color");
  addDimensionSlider("red", "red");
  addDimensionSlider("green", "green");
  addDimensionSlider("blue", "blue");
  addDimensionSlider("saturation", "saturation");
  addSlider("glow", "glow", 0, 2, 0.01, (v) => v.toFixed(2), 1, 1, 2);
  addDimensionSlider("shimmerAmount", "shimmer");

  addSectionHeader("Debug");
  addDebugCheckbox("freeze", "freeze motion");
  addDebugCheckbox("wireframe", "wireframe");
  addDebugCheckbox("singleLayer", "single layer");
  addDebugCheckbox("noNoise", "disable noise");
  addDebugCheckbox("noSway", "disable sway");
  addDebugCheckbox("additive", "additive blending");
  addDebugCheckbox("cameraPan", "lazy camera rotation");

  contentWrapper.appendChild(randomizeBtn);

  // --- Advanced Music UI Section ---
  const musicHeader = document.createElement("div");
  musicHeader.textContent = "Music";
  musicHeader.style.marginTop = "14px";
  musicHeader.style.marginBottom = "6px";
  musicHeader.style.fontWeight = "700";
  musicHeader.style.opacity = "0.95";
  musicHeader.style.letterSpacing = "0.2px";
  musicHeader.style.textAlign = "center";
  contentWrapper.appendChild(musicHeader);

  // Control Row containing Reactive checkbox (top) and Play button (bottom)
  const controlRow = document.createElement("div");
  controlRow.style.display = "flex";
  controlRow.style.flexDirection = "column";
  controlRow.style.gap = "8px";
  controlRow.style.marginTop = "8px";
  controlRow.style.marginBottom = "8px";

  const reactiveRow = document.createElement("label");
  reactiveRow.style.display = "flex";
  reactiveRow.style.alignItems = "center";
  reactiveRow.style.gap = "6px";
  reactiveRow.style.cursor = "pointer";
  reactiveRow.style.marginBottom = "2px";

  const reactiveCheckbox = document.createElement("input");
  reactiveCheckbox.type = "checkbox";
  reactiveCheckbox.checked = false;

  const reactiveLabel = document.createElement("span");
  reactiveLabel.textContent = "Reactive";
  reactiveLabel.style.fontSize = "11px";
  reactiveLabel.style.opacity = "0.9";

  reactiveCheckbox.addEventListener("change", () => {
    AUDIO_SYSTEM.setEnabled(reactiveCheckbox.checked);
  });

  reactiveRow.appendChild(reactiveCheckbox);
  reactiveRow.appendChild(reactiveLabel);

  const bpmSyncRow = document.createElement("label");
  bpmSyncRow.style.display = "flex";
  bpmSyncRow.style.alignItems = "center";
  bpmSyncRow.style.gap = "6px";
  bpmSyncRow.style.cursor = "pointer";
  bpmSyncRow.style.marginBottom = "2px";

  const bpmSyncCheckbox = document.createElement("input");
  bpmSyncCheckbox.type = "checkbox";
  bpmSyncCheckbox.checked = PARAMS.bpmSync;

  const bpmSyncLabel = document.createElement("span");
  bpmSyncLabel.textContent = "BPM Sync (Waves)";
  bpmSyncLabel.style.fontSize = "11px";
  bpmSyncLabel.style.opacity = "0.9";

  bpmSyncCheckbox.addEventListener("change", () => {
    PARAMS.bpmSync = bpmSyncCheckbox.checked;
  });

  bpmSyncRow.appendChild(bpmSyncCheckbox);
  bpmSyncRow.appendChild(bpmSyncLabel);

  const playPauseBtn = document.createElement("button");
  playPauseBtn.textContent = "\u25B6 Play";
  playPauseBtn.style.padding = "6px 12px";
  playPauseBtn.style.background = "transparent";
  playPauseBtn.style.border = "1px solid rgba(255, 215, 161, 0.4)";
  playPauseBtn.style.borderRadius = "5px";
  playPauseBtn.style.color = "#ffd7a1";
  playPauseBtn.style.font = "bold 11px monospace";
  playPauseBtn.style.cursor = "pointer";
  playPauseBtn.style.outline = "none";
  playPauseBtn.style.width = "100%";

  playPauseBtn.addEventListener("click", async () => {
    const state = AUDIO_SYSTEM.getAudioState();
    if (state.isPlaying) {
      AUDIO_SYSTEM.pause();
    } else {
      await AUDIO_SYSTEM.play();
    }
  });

  const testVisRow = document.createElement("label");
  testVisRow.style.display = "flex";
  testVisRow.style.alignItems = "center";
  testVisRow.style.gap = "6px";
  testVisRow.style.cursor = "pointer";
  testVisRow.style.marginBottom = "2px";

  const testVisCheckbox = document.createElement("input");
  testVisCheckbox.type = "checkbox";
  testVisCheckbox.checked = false;

  const testVisLabel = document.createElement("span");
  testVisLabel.textContent = "Show Audio-Test Vis (Bars & Curves)";
  testVisLabel.style.fontSize = "11px";
  testVisLabel.style.opacity = "0.9";

  testVisCheckbox.addEventListener("change", () => {
    showTestVis = testVisCheckbox.checked;
    if (testBarsGroup) testBarsGroup.visible = showTestVis;
    if (testCurveGroup) testCurveGroup.visible = showTestVis;
  });

  testVisRow.appendChild(testVisCheckbox);
  testVisRow.appendChild(testVisLabel);

  controlRow.appendChild(reactiveRow);
  controlRow.appendChild(bpmSyncRow);
  controlRow.appendChild(testVisRow);
  controlRow.appendChild(playPauseBtn);
  contentWrapper.appendChild(controlRow);

  // Custom File selector
  const fileRow = document.createElement("label");
  fileRow.style.display = "grid";
  fileRow.style.gridTemplateColumns = "76px minmax(0, 1fr)";
  fileRow.style.gap = "6px";
  fileRow.style.alignItems = "center";
  fileRow.style.margin = "6px 0";

  const customLabel = document.createElement("span");
  customLabel.textContent = "Custom File";
  customLabel.style.opacity = "0.8";

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "audio/*";
  fileInput.style.fontSize = "10px";
  fileInput.style.color = "#ffd7a1";
  fileInput.style.width = "100%";

  const fileNameDisplay = document.createElement("span");
  fileNameDisplay.textContent = "";
  fileNameDisplay.style.textAlign = "right";
  fileNameDisplay.style.opacity = "0.6";
  fileNameDisplay.style.fontSize = "10px";
  fileNameDisplay.style.display = "block";
  fileNameDisplay.style.marginTop = "2px";

  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    let displayName = file.name.length > 20 ? file.name.substring(0, 19) + '…' : file.name;
    fileNameDisplay.textContent = "Loading...";
    const loaded = await AUDIO_SYSTEM.loadFile(file);
    if (loaded) {
      fileNameDisplay.textContent = displayName;
    } else {
      fileNameDisplay.textContent = "Error loading";
    }
  });

  fileRow.appendChild(customLabel);
  fileRow.appendChild(fileInput);
  contentWrapper.appendChild(fileRow);
  contentWrapper.appendChild(fileNameDisplay);

  // Select Track dropdown
  const TRACKS = [
    { name: "Metronome 120 BPM", file: "Metronome 120 BPM - QuickSounds.com.mp3" },
    { name: "The Infinity (120 BPM)", file: "dcpixelwelt-the-infinity-120-bpm-d-major-13108.mp3" },
    { name: "Sad Track", file: "sad_track.mp3" },
    { name: "Ad Infinitum - New Dawn", file: "Ad Infinitum - New Dawn.mp3" },
    { name: "Ad Infinitum - Serpent's Downfall", file: "Ad Infinitum - The Serpent's Downfall.mp3" }
  ];

  const trackRow = document.createElement("label");
  trackRow.style.display = "grid";
  trackRow.style.gridTemplateColumns = "76px minmax(0, 1fr)";
  trackRow.style.gap = "6px";
  trackRow.style.alignItems = "center";
  trackRow.style.margin = "6px 0";

  const trackText = document.createElement("span");
  trackText.textContent = "Select Track";
  trackText.style.opacity = "0.8";

  const trackSelect = document.createElement("select");
  trackSelect.style.fontSize = "11px";
  trackSelect.style.background = "rgba(0, 0, 0, 0.4)";
  trackSelect.style.border = "1px solid rgba(255, 200, 120, 0.35)";
  trackSelect.style.color = "#ffd7a1";
  trackSelect.style.padding = "3px 6px";
  trackSelect.style.borderRadius = "4px";
  trackSelect.style.outline = "none";
  trackSelect.style.cursor = "pointer";

  TRACKS.forEach(track => {
    const opt = document.createElement("option");
    opt.value = track.file;
    opt.textContent = track.name;
    opt.style.background = "#111";
    trackSelect.appendChild(opt);
  });

  trackSelect.addEventListener("change", async (e) => {
    const wasPlaying = AUDIO_SYSTEM.getAudioState().isPlaying;
    fileNameDisplay.textContent = "";
    await AUDIO_SYSTEM.loadTrack(e.target.value);
    if (wasPlaying) {
      await AUDIO_SYSTEM.play();
    }
  });

  trackRow.appendChild(trackText);
  trackRow.appendChild(trackSelect);
  contentWrapper.appendChild(trackRow);

  // Select Source dropdown
  const sourceRow = document.createElement("label");
  sourceRow.style.display = "grid";
  sourceRow.style.gridTemplateColumns = "76px minmax(0, 1fr)";
  sourceRow.style.gap = "6px";
  sourceRow.style.alignItems = "center";
  sourceRow.style.margin = "6px 0";

  const sourceName = document.createElement("span");
  sourceName.textContent = "Select Source";
  sourceName.style.opacity = "0.8";

  const sourceSelect = document.createElement("select");
  sourceSelect.style.fontSize = "11px";
  sourceSelect.style.background = "rgba(0, 0, 0, 0.4)";
  sourceSelect.style.border = "1px solid rgba(255, 200, 120, 0.35)";
  sourceSelect.style.color = "#ffd7a1";
  sourceSelect.style.padding = "3px 6px";
  sourceSelect.style.borderRadius = "4px";
  sourceSelect.style.outline = "none";
  sourceSelect.style.cursor = "pointer";

  const SOURCES = [
    { name: "Auto (Dynamic)", value: "auto" },
    { name: "Bass (Kick)", value: "bass" },
    { name: "Mids (Melody)", value: "mids" },
    { name: "Treble (Hi-Hat)", value: "treble" },
    { name: "Volume (RMS)", value: "volume" }
  ];

  SOURCES.forEach(src => {
    const opt = document.createElement("option");
    opt.value = src.value;
    opt.textContent = src.name;
    opt.style.background = "#111";
    sourceSelect.appendChild(opt);
  });

  sourceSelect.addEventListener("change", (e) => {
    AUDIO_SYSTEM.setReactivitySource(e.target.value);
  });

  sourceRow.appendChild(sourceName);
  sourceRow.appendChild(sourceSelect);
  contentWrapper.appendChild(sourceRow);

  // Volume slider below
  const volRow = document.createElement("label");
  volRow.style.display = "grid";
  volRow.style.gridTemplateColumns = "76px minmax(0, 1fr) 36px";
  volRow.style.gap = "6px";
  volRow.style.alignItems = "center";
  volRow.style.marginTop = "8px";

  const volName = document.createElement("span");
  volName.textContent = "Volume";
  volName.style.opacity = "0.8";

  const volSlider = document.createElement("input");
  volSlider.type = "range";
  volSlider.min = "0";
  volSlider.max = "1";
  volSlider.step = "0.01";
  volSlider.value = "0.5";

  const volValue = document.createElement("span");
  volValue.textContent = "50%";
  volValue.style.textAlign = "right";

  volSlider.addEventListener("input", () => {
    AUDIO_SYSTEM.setVolume(Number(volSlider.value));
    volValue.textContent = Math.round(Number(volSlider.value) * 100) + "%";
  });

  volRow.appendChild(volName);
  volRow.appendChild(volSlider);
  volRow.appendChild(volValue);
  contentWrapper.appendChild(volRow);

  // Sensitivity slider below
  const sensRow = document.createElement("label");
  sensRow.style.display = "grid";
  sensRow.style.gridTemplateColumns = "76px minmax(0, 1fr) 36px";
  sensRow.style.gap = "6px";
  sensRow.style.alignItems = "center";
  sensRow.style.marginTop = "8px";

  const sensName = document.createElement("span");
  sensName.textContent = "Sensitivity";
  sensName.style.opacity = "0.8";

  const sensSlider = document.createElement("input");
  sensSlider.type = "range";
  sensSlider.min = "0.5";
  sensSlider.max = "8.0";
  sensSlider.step = "0.1";
  sensSlider.value = "2.5";

  const sensValue = document.createElement("span");
  sensValue.textContent = "2.5";
  sensValue.style.textAlign = "right";

  sensSlider.addEventListener("input", () => {
    AUDIO_SYSTEM.setSensitivity(Number(sensSlider.value));
    sensValue.textContent = Number(sensSlider.value).toFixed(1);
  });

  sensRow.appendChild(sensName);
  sensRow.appendChild(sensSlider);
  sensRow.appendChild(sensValue);
  contentWrapper.appendChild(sensRow);

  // Analysis Data Grid
  const analysisTitle = document.createElement("div");
  analysisTitle.textContent = "Analysis Data";
  analysisTitle.style.marginTop = "14px";
  analysisTitle.style.marginBottom = "6px";
  analysisTitle.style.fontWeight = "700";
  analysisTitle.style.opacity = "0.8";
  analysisTitle.style.textAlign = "center";
  contentWrapper.appendChild(analysisTitle);

  const metricsGrid = document.createElement("div");
  metricsGrid.style.display = "grid";
  metricsGrid.style.gridTemplateColumns = "1fr 1fr";
  metricsGrid.style.gap = "6px";
  metricsGrid.style.marginTop = "4px";

  function createCard(labelText, initVal) {
    const card = document.createElement("div");
    card.style.background = "rgba(255, 200, 120, 0.04)";
    card.style.border = "1px solid rgba(255, 200, 120, 0.15)";
    card.style.padding = "6px";
    card.style.borderRadius = "6px";
    card.style.display = "flex";
    card.style.flexDirection = "column";
    card.style.gap = "2px";

    const label = document.createElement("span");
    label.textContent = labelText;
    label.style.color = "rgba(255, 215, 161, 0.6)";
    label.style.fontSize = "9px";
    label.style.textTransform = "uppercase";

    const value = document.createElement("span");
    value.textContent = initVal;
    value.style.fontWeight = "bold";
    value.style.fontSize = "11px";
    value.style.color = "#ffd7a1";

    card.appendChild(label);
    card.appendChild(value);
    return { card, valEl: value };
  }

  const mVol = createCard("Volume (RMS)", "0.00");
  const mBass = createCard("Bass", "0.00");
  const mTreble = createCard("Treble", "0.00");
  const mBpm = createCard("BPM", "--");
  mBpm.valEl.style.color = "#ffb050";
  mBpm.valEl.style.textShadow = "0 0 4px rgba(255, 176, 80, 0.5)";

  const mSource = createCard("Active Source", "--");
  mSource.card.style.gridColumn = "span 2";

  metricsGrid.appendChild(mVol.card);
  metricsGrid.appendChild(mBpm.card);
  metricsGrid.appendChild(mBass.card);
  metricsGrid.appendChild(mTreble.card);
  metricsGrid.appendChild(mSource.card);
  contentWrapper.appendChild(metricsGrid);

  const dotsContainer = document.createElement("div");
  dotsContainer.style.display = "flex";
  dotsContainer.style.justifyContent = "center";
  dotsContainer.style.gap = "6px";
  dotsContainer.style.marginTop = "8px";
  contentWrapper.appendChild(dotsContainer);

  window.addEventListener('audioStateChange', (e) => {
    const s = e.detail;
    playPauseBtn.textContent = (s.isPlaying && s.hasFile) ? "\u25A0 Pause" : "\u25B6 Play";
    reactiveCheckbox.checked = s.enabled;
    sourceSelect.value = s.reactivitySource;
    if (s.trackFilename) {
      trackSelect.value = s.trackFilename;
    }
  });

  window._audioUIRefresh = () => {
    const state = AUDIO_SYSTEM.getAudioState();
    mVol.valEl.textContent = state.volume.toFixed(2);
    mBpm.valEl.textContent = state.bpm > 0 ? String(state.bpm) : "--";
    mBass.valEl.textContent = state.bass.toFixed(2);
    mTreble.valEl.textContent = state.treble.toFixed(2);

    let srcText = state.reactivitySource.toUpperCase();
    if (state.reactivitySource === "auto") {
      srcText += ` (${state.detectedSource.toUpperCase()})`;
    }
    mSource.valEl.textContent = state.isPlaying ? srcText : "--";

    if (!state.hasFile) return;

    const numDots = Math.min(12, Math.max(3, Math.round(Math.min(180, state.bpm || 120) / 20)));
    while (dotsContainer.children.length > numDots) {
      dotsContainer.removeChild(dotsContainer.lastChild);
    }
    while (dotsContainer.children.length < numDots) {
      const dot = document.createElement("div");
      dot.style.width = "8px";
      dot.style.height = "8px";
      dot.style.borderRadius = "50%";
      dot.style.background = "rgba(255, 215, 161, 0.15)";
      dot.style.transition = "background 0.05s ease-out";
      dotsContainer.appendChild(dot);
    }

    if (state.isPlaying && state.beatStrength > 0.01) {
      const dots = Array.from(dotsContainer.children);
      const activeIdx = Math.floor(state.beatStrength * numDots) % numDots;
      dots.forEach((dot, idx) => {
        dot.style.background = idx === activeIdx ? "rgba(255, 180, 80, 0.9)" : "rgba(255, 215, 161, 0.15)";
      });
    }
  };

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
    vec3 p3  = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
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

    p.y += (waveA + waveB) * body + (n - 0.5) * uNoiseAmpY * body;
    p.z += (n - 0.5) * uDepthNoiseAmp * body + sin(p.x * 2.25 - uTime * 0.5 + uPhase) * uDepthWaveAmp * body;

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
  uniform float uShimmerAmount;
  uniform float uBandCount;
  uniform float uBandSpacing;
  uniform float uBandSharpness;
  uniform float uBandFill;

  varying vec2 vUv;
  varying float vNoise;

  void main() {
    float body = pow(max(0.0, 1.0 - abs(vUv.y - 0.5) * 2.0), 1.25);
    float edge = smoothstep(0.03, 0.2, vUv.x) * smoothstep(0.03, 0.2, 1.0 - vUv.x);

    float bands = max(1.0, floor(uBandCount + 0.5));
    float y = vUv.y - 0.5;
    float spacing = max(0.001, uBandSpacing);
    float phase = y / spacing;
    float periodicDist = abs(fract(phase + 0.5) - 0.5);
    float width = mix(0.11, 0.006, clamp(uBandSharpness, 0.0, 1.0));
    float coreBand = 1.0 - smoothstep(width, width * 1.7, periodicDist);

    // Keep only the requested count of major bands while preserving smooth spacing transitions.
    float maxCenter = (bands - 1.0) * 0.5;
    float countMask = 1.0 - smoothstep(maxCenter + 0.5, maxCenter + 1.0, abs(phase));
    float bandMask = mix(coreBand, 1.0, clamp(uBandFill, 0.0, 1.0)) * countMask;

    float filaments = pow(abs(sin((vUv.y * uFilamentDensity + vUv.x * 2.4 + uTime * 0.72 + vNoise * 0.9) * 3.14159)), uFilamentSharpness);
    float shimmer = mix(1.0, 0.5 + 0.5 * sin(vUv.x * uShimmerFrequency + uTime * 1.7 + vNoise * 4.0), uShimmerAmount);
    float fill = clamp(uBandFill, 0.0, 1.0);
    float textureMask = mix(0.18 + filaments * 0.82, 1.0, fill);

    vec3 color = mix(uColorA, uColorB, clamp(vUv.x * 0.75 + vNoise * 0.45, 0.0, 1.0));
    float alpha = textureMask * body * edge * shimmer * uOpacity * bandMask;

    gl_FragColor = vec4(color, alpha);
  }
`;

const ribbons = [];
const waveGroup = new THREE.Group();
waveGroup.scale.setScalar(PARAMS.globalScale);
scene.add(waveGroup);

function clearRibbons() {
  for (let i = 0; i < ribbons.length; i++) {
    const ribbon = ribbons[i];
    waveGroup.remove(ribbon);
    ribbon.material.dispose();
  }
  ribbons.length = 0;
}

function addRibbon(index, total) {
  const t = total > 1 ? index / (total - 1) : 0;
  const colorA = new THREE.Color();
  const colorB = new THREE.Color();
  getLayerColors(t, colorA, colorB);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPhase: { value: index * PARAMS.layerPhaseStep },
      uColorA: { value: colorA },
      uColorB: { value: colorB },
      uOpacity: { value: (PARAMS.baseOpacity - t * PARAMS.opacityFalloff) * (PARAMS.dimensions.alphaMultiplier !== undefined ? PARAMS.dimensions.alphaMultiplier : 1.0) },
      uWaveAmpA: { value: PARAMS.waveAmpA },
      uWaveAmpB: { value: PARAMS.waveAmpB },
      uNoiseAmpY: { value: PARAMS.noiseAmpY },
      uNoiseScaleX: { value: PARAMS.noiseScaleX },
      uNoiseScaleY: { value: PARAMS.noiseScaleY },
      uDepthNoiseAmp: { value: PARAMS.depthNoiseAmp },
      uDepthWaveAmp: { value: PARAMS.depthWaveAmp },
      uFilamentDensity: { value: PARAMS.filamentDensity },
      uFilamentSharpness: { value: PARAMS.filamentSharpness },
      uShimmerFrequency: { value: PARAMS.shimmerFrequency },
      uShimmerAmount: { value: PARAMS.dimensions.shimmerAmount !== undefined ? PARAMS.dimensions.shimmerAmount : 0.7 },
      uBandCount: { value: ACTIVE.bandCount },
      uBandSpacing: { value: ACTIVE.bandSpacing },
      uBandSharpness: { value: ACTIVE.bandSharpness },
      uBandFill: { value: ACTIVE.bandFill }
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });

  const ribbon = new THREE.Mesh(ribbonGeometry, material);
  const centered = index - (total - 1) * 0.5;
  ribbon.position.y = centered * PARAMS.layerYOffset;
  ribbon.position.x = centered * PARAMS.layerXOffset;
  ribbon.rotation.z = centered * PARAMS.layerTilt;
  ribbon.scale.setScalar(1.0 - index * PARAMS.layerScaleFalloff);
  ribbon.userData.layerT = t;

  ribbons.push(ribbon);
  waveGroup.add(ribbon);
}

// Reference variables for audio test visualizers
let testBarsGroup = null;
let testCurveGroup = null;
let showTestVis = false;

function buildTestBars() {
  testBarsGroup = new THREE.Group();
  const count = 32;
  const barWidth = 0.2;
  const spacing = 0.3;
  const startX = -((count - 1) * spacing) / 2;

  const geometry = new THREE.BoxGeometry(barWidth, 1, barWidth);
  geometry.translate(0, 0.5, 0); // shift pivot to bottom

  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color().lerpColors(new THREE.Color(0xbd00ff), new THREE.Color(0x00f0ff), t),
      roughness: 0.2,
      metalness: 0.8,
      emissive: new THREE.Color().lerpColors(new THREE.Color(0x400060), new THREE.Color(0x004060), t),
      emissiveIntensity: 0.5
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(startX + i * spacing, 2.2, 0); // stack on top of curve
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    testBarsGroup.add(mesh);
  }
  testBarsGroup.visible = false;
  scene.add(testBarsGroup);
}

function buildTestWaveCurve() {
  testCurveGroup = new THREE.Group();
  const ribbonCount = 3;
  const pointsCount = 80;
  const width = 10;

  for (let r = 0; r < ribbonCount; r++) {
    const positions = new Float32Array(pointsCount * 3);
    const colors = new Float32Array(pointsCount * 3);

    const colorStart = new THREE.Color(0xbd00ff);
    const colorEnd = new THREE.Color(0x00f0ff);
    const tempColor = new THREE.Color();

    for (let i = 0; i < pointsCount; i++) {
      const t = i / (pointsCount - 1);
      const x = -width / 2 + t * width;
      const z = (r - 1) * 0.75;

      positions[i * 3] = x;
      positions[i * 3 + 1] = 1.0; // y baseline
      positions[i * 3 + 2] = z;

      tempColor.lerpColors(colorStart, colorEnd, t);
      colors[i * 3] = tempColor.r;
      colors[i * 3 + 1] = tempColor.g;
      colors[i * 3 + 2] = tempColor.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      linewidth: 3,
      transparent: true,
      opacity: 0.85 - r * 0.2
    });

    const line = new THREE.Line(geometry, material);
    line.userData = {
      pointsCount: pointsCount,
      width: width,
      zOffset: (r - 1) * 0.75,
      phaseOffset: r * 0.8
    };
    testCurveGroup.add(line);
  }
  testCurveGroup.visible = false;
  scene.add(testCurveGroup);
}

function rebuildRibbons(nextLayerCount) {
  const total = Math.max(1, Math.round(nextLayerCount));
  PARAMS.layerCount = total;
  clearRibbons();
  for (let i = 0; i < total; i++) {
    addRibbon(i, total);
  }
}

rebuildRibbons(PARAMS.layerCount);

const ambientLight = new THREE.AmbientLight(0xffd9a8, 0.45);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffc56e, 0.75);
directionalLight.position.set(2, 1, 4);
scene.add(directionalLight);

// Build reference visualizers (hidden by default)
buildTestBars();
buildTestWaveCurve();

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
let cameraPanTime = 0;
let wasPanning = false;
updateTargetFromDimensions();
createMeaningfulMixerUI();

function animate() {
  requestAnimationFrame(animate);

  // Process beat detection and apply reactive modulation
  // Process beat detection and apply reactive modulation directly to ACTIVE for instant pulse + smooth decay
  try { AUDIO_SYSTEM.processBeatDetection(); } catch(e) {}
  
  updateTargetFromDimensions();
  
  // Apply beat-reactive pulses to ACTIVE parameters (they'll smoothly decay back toward TARGET)
  const state = {};
  try {
    Object.assign(state, AUDIO_SYSTEM.getAudioState());
  } catch(e) {}
  
  const sensMultiplier = state.sensitivity !== undefined ? (state.sensitivity / 2.5) : 1.0;
  const s = (state.hasFile && state.isPlaying && state.enabled) ? (state.beatStrength * sensMultiplier) : 0;
  const isMusicActive = state.hasFile && state.isPlaying && state.enabled;
  const musicVal = isMusicActive ? (state.volume * 2.0 + state.beatStrength * 0.4) * sensMultiplier : 0;

  // Keep the physical wave group scale completely static to prevent the layout from stretching
  waveGroup.scale.setScalar(PARAMS.globalScale);
  
  if (Math.round(PARAMS.layerCount) !== ribbons.length) {
    rebuildRibbons(PARAMS.layerCount);
  }
  const deltaTime = clock.getDelta();
  smoothActiveParams(deltaTime);

  // Refresh audio UI elements each frame for BPM display and beat indicators
  if (window._audioUIRefresh && window._audioUIRefresh !== undefined) {
    window._audioUIRefresh();
  }

  // Update Test Visualizers if visible
  if (showTestVis && testBarsGroup && testCurveGroup) {
    const rawFreq = state.rawFrequencies || [];
    const sensitivity = state.sensitivity || 2.5;

    // Get selected dynamic color from ACTIVE.baseRgb
    const r = THREE.MathUtils.clamp(ACTIVE.baseRgb.r, 0, 255) / 255;
    const g = THREE.MathUtils.clamp(ACTIVE.baseRgb.g, 0, 255) / 255;
    const b = THREE.MathUtils.clamp(ACTIVE.baseRgb.b, 0, 255) / 255;
    const baseColor = new THREE.Color(r, g, b);
    
    // Create lighter / darker spectrum
    const darkColor = baseColor.clone().multiplyScalar(0.3);
    const lightColor = baseColor.clone().multiplyScalar(1.3);

    // 1. Animate Bars
    const bars = testBarsGroup.children;
    for (let i = 0; i < bars.length; i++) {
      const bar = bars[i];
      const t = i / (bars.length - 1);
      const tempColor = new THREE.Color().lerpColors(darkColor, lightColor, t);
      
      // Update color dynamically based on user selection
      bar.material.color.copy(tempColor);
      bar.material.emissive.copy(tempColor).multiplyScalar(0.3);

      const freqIdx = Math.floor((i / bars.length) * (rawFreq.length * 0.6));
      let amp = 0.05;
      if (state.isPlaying) {
        amp = (rawFreq[freqIdx] / 255.0) * sensitivity;
      }
      const targetYScale = Math.max(0.05, amp * 3.0);
      bar.scale.y = THREE.MathUtils.lerp(bar.scale.y, targetYScale, 0.25);
      bar.material.emissiveIntensity = bar.scale.y * 0.4;
    }

    // Calculate activeVal for curves
    let activeVal = 0;
    let currentActiveSource = state.reactivitySource;
    if (state.reactivitySource === "auto") {
      currentActiveSource = state.detectedSource;
    }
    if (currentActiveSource === "bass") {
      activeVal = state.bass;
    } else if (currentActiveSource === "mids") {
      activeVal = state.mids;
    } else if (currentActiveSource === "treble") {
      activeVal = state.treble;
    } else if (currentActiveSource === "volume") {
      activeVal = state.volume * 1.5;
    }
    activeVal = Math.min(1, Math.max(0, activeVal));

    // 2. Animate Curves
    testCurveGroup.children.forEach((line) => {
      const posAttr = line.geometry.attributes.position;
      const colorAttr = line.geometry.attributes.color;
      const { pointsCount, zOffset, phaseOffset } = line.userData;

      for (let i = 0; i < pointsCount; i++) {
        const x = posAttr.getX(i);
        const t = i / (pointsCount - 1);
        const tempColor = new THREE.Color().lerpColors(darkColor, lightColor, t);
        
        // Update color attribute dynamically
        colorAttr.setXYZ(i, tempColor.r, tempColor.g, tempColor.b);

        let y = 1.0; // Baseline y position
        if (state.isPlaying) {
          const reactionVal = Math.pow(activeVal, 2.5) * sensitivity * 1.5;
          const progress = i / (pointsCount - 1);
          const envelope = Math.sin(progress * Math.PI);
          y = 1.0 + Math.sin(x * 1.2 + phaseOffset) * envelope * reactionVal;
        }

        posAttr.setY(i, THREE.MathUtils.lerp(posAttr.getY(i), y, 0.25));
      }
      posAttr.needsUpdate = true;
      colorAttr.needsUpdate = true;
    });
  }

  let currentFlowSpeed = ACTIVE.flowSpeed;
  let currentSwaySpeed = ACTIVE.swaySpeed;

  if (PARAMS.bpmSync && isMusicActive) {
    const bpm = state.bpm > 0 ? state.bpm : 120;
    const bpmFactor = bpm / 120;
    
    // Scale baseline speeds with BPM
    const baseFlow = bpmFactor * 0.45;
    const baseSway = bpmFactor * 0.08;
    
    // Add beat-responsive speed surges (acceleration on beat hits)
    currentFlowSpeed = baseFlow + s * 1.5;
    currentSwaySpeed = baseSway + s * 0.3;
  }

  if (!PARAMS.debug.freeze) {
    flowTime += deltaTime * currentFlowSpeed;
    swayTime += deltaTime * currentSwaySpeed;
  }
  cameraPanTime += deltaTime;

  const centerLayer = Math.floor((ribbons.length - 1) * 0.5);
  const forceSingleLine = Math.round(PARAMS.dimensions.lineCount) <= 1;

  for (let i = 0; i < ribbons.length; i++) {
    const ribbon = ribbons[i];
    const uniforms = ribbon.material.uniforms;
    const t = ribbon.userData.layerT;
    const centered = i - (ribbons.length - 1) * 0.5;

    ribbon.visible = (!PARAMS.debug.singleLayer && !forceSingleLine) || i === centerLayer;
    ribbon.material.wireframe = PARAMS.debug.wireframe;
    ribbon.material.blending = PARAMS.debug.additive ? THREE.AdditiveBlending : THREE.NormalBlending;

    getLayerColors(t, tempColorA, tempColorB);

    uniforms.uTime.value = flowTime;
    uniforms.uColorA.value.copy(tempColorA);
    uniforms.uColorB.value.copy(tempColorB);
    uniforms.uOpacity.value = (ACTIVE.baseOpacity - t * ACTIVE.opacityFalloff) * ACTIVE.alphaMultiplier;

    uniforms.uPhase.value = i * ACTIVE.layerPhaseStep;

    uniforms.uWaveAmpA.value = ACTIVE.waveAmpA;
    uniforms.uWaveAmpB.value = ACTIVE.waveAmpB;
    uniforms.uNoiseAmpY.value = PARAMS.debug.noNoise ? 0.0 : ACTIVE.noiseAmpY;
    uniforms.uNoiseScaleX.value = ACTIVE.noiseScaleX;
    uniforms.uNoiseScaleY.value = ACTIVE.noiseScaleY;
    uniforms.uDepthNoiseAmp.value = PARAMS.debug.noNoise ? 0.0 : ACTIVE.depthNoiseAmp;
    uniforms.uDepthWaveAmp.value = ACTIVE.depthWaveAmp + musicVal * 0.8;
    uniforms.uFilamentDensity.value = ACTIVE.filamentDensity;
    uniforms.uFilamentSharpness.value = ACTIVE.filamentSharpness;
    uniforms.uShimmerFrequency.value = ACTIVE.shimmerFrequency;
    uniforms.uShimmerAmount.value = ACTIVE.shimmerAmount;
    uniforms.uBandCount.value = ACTIVE.bandCount;
    uniforms.uBandSpacing.value = ACTIVE.bandSpacing;
    uniforms.uBandSharpness.value = ACTIVE.bandSharpness;
    uniforms.uBandFill.value = ACTIVE.bandFill;

    ribbon.position.y = centered * ACTIVE.layerYOffset;
    ribbon.position.x = centered * ACTIVE.layerXOffset;
    ribbon.rotation.z = centered * ACTIVE.layerTilt;
    ribbon.scale.setScalar(1.0 - i * ACTIVE.layerScaleFalloff);
  }

  if (PARAMS.debug.cameraPan) {
    controls.autoRotate = true;
    controls.autoRotateSpeed = -0.8; // Smooth, slow rotation
    wasPanning = true;
  } else if (wasPanning) {
    controls.autoRotate = false;
    controls.target.set(0, 0, 0);
    wasPanning = false;
  }

  controls.update();

  if (PARAMS.debug.noSway) {
    waveGroup.rotation.y = 0;
    waveGroup.rotation.x = ACTIVE.baseRotationX;
  } else {
    waveGroup.rotation.y = Math.sin(swayTime * ACTIVE.sceneSwayYSpeed) * ACTIVE.sceneSwayYAmount;
    waveGroup.rotation.x = ACTIVE.baseRotationX + Math.sin(swayTime * ACTIVE.sceneSwayXSpeed) * ACTIVE.sceneSwayXAmount;
  }

  renderer.render(scene, camera);
}

animate();

// Poll the local server for latest AI updates
function pollAIUpdates() {
  fetch('/api/latest')
    .then(response => response.json())
    .then(data => {
      if (data && Object.keys(data).length > 0) {
        console.log("Received live parameters from AI:", data);
        for (const key in data) {
          if (key in PARAMS.dimensions) {
            PARAMS.dimensions[key] = Number(data[key]);
          }
        }
        updateTargetFromDimensions();
        uiUpdateCallbacks.forEach(cb => cb());
      }
    })
    .catch(err => {
      // Silently ignore connection errors to prevent console flooding
    });
}
// Check every 100 milliseconds
setInterval(pollAIUpdates, 1000);
