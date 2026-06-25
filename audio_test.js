import * as THREE from "https://unpkg.com/three@0.168.0/build/three.module.js?module";
import { OrbitControls } from "https://unpkg.com/three@0.168.0/examples/jsm/controls/OrbitControls.js?module";
import * as AUDIO_SYSTEM from "./audio.js";

// Scene State
let scene, camera, renderer, controls;
let barsGroup, waveGroup, planeMesh;
let currentMode = "bars"; // "bars", "curve", "plane"
let basePlaneVertices = []; // To store original grid positions

// UI elements
const playBtn = document.getElementById("playBtn");
const volumeSlider = document.getElementById("volumeSlider");
const volumeVal = document.getElementById("volumeVal");
const reactiveToggle = document.getElementById("reactiveToggle");
const sensSlider = document.getElementById("sensSlider");
const sensVal = document.getElementById("sensVal");
const modeButtons = document.querySelectorAll(".mode-btn");

// UI Indicators
const mVolume = document.getElementById("mVolume");
const mBpm = document.getElementById("mBpm");
const mBass = document.getElementById("mBass");
const mTreble = document.getElementById("mTreble");

// Playback logic
let isPlaying = false;
let sensitivity = parseFloat(sensSlider.value);
let flowTime = 0;

// Initialize Three.js
function initThree() {
    // Scene & Fog
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07070a);
    scene.fog = new THREE.FogExp2(0x07070a, 0.025);

    // Camera
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 8, 16);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05; // Don't go under ground
    controls.minDistance = 5;
    controls.maxDistance = 40;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.15);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 15, 5);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // Add colored point lights for that premium glow look
    const purpleLight = new THREE.PointLight(0xbd00ff, 2.0, 30);
    purpleLight.position.set(-6, 4, 3);
    scene.add(purpleLight);

    const cyanLight = new THREE.PointLight(0x00f0ff, 2.0, 30);
    cyanLight.position.set(6, 4, -3);
    scene.add(cyanLight);

    // Grid Floor
    const gridHelper = new THREE.GridHelper(30, 30, 0x222233, 0x111116);
    gridHelper.position.y = -0.01;
    scene.add(gridHelper);

    // Build Visualizers
    buildBars();
    buildWaveCurve();
    buildGridPlane();

    // Set initial visibility based on mode
    updateVisualizerVisibility();

    // Event listener for resize
    window.addEventListener("resize", onWindowResize);
}

// 1. Mode: 3D Spectrum Bars
function buildBars() {
    barsGroup = new THREE.Group();
    const count = 32;
    const barWidth = 0.28;
    const spacing = 0.42;
    const startX = -((count - 1) * spacing) / 2;

    const geometry = new THREE.BoxGeometry(barWidth, 1, barWidth);
    // Shift pivot point to the bottom of the box
    geometry.translate(0, 0.5, 0);

    for (let i = 0; i < count; i++) {
        // Linear interpolation from violet (bass) to cyan (treble)
        const t = i / (count - 1);
        const color = new THREE.Color().harmonicLead(t);
        
        // Custom material with slight emissive properties
        const material = new THREE.MeshStandardMaterial({
            color: new THREE.Color().lerpColors(new THREE.Color(0xbd00ff), new THREE.Color(0x00f0ff), t),
            roughness: 0.2,
            metalness: 0.8,
            emissive: new THREE.Color().lerpColors(new THREE.Color(0x400060), new THREE.Color(0x004060), t),
            emissiveIntensity: 0.5
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(startX + i * spacing, 0, 0);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        barsGroup.add(mesh);
    }
    scene.add(barsGroup);
}

// Helper: Custom gradient math for fun colors
THREE.Color.prototype.harmonicLead = function(t) {
    // Red-violet to cyan gradient
    return this.setHSL(0.8 - t * 0.5, 1.0, 0.5);
};

// 2. Mode: Responsive Wave Curves
function buildWaveCurve() {
    waveGroup = new THREE.Group();
    
    // We create 3 parallel ribbon curves for depth
    const ribbonCount = 3;
    const pointsCount = 80;
    const width = 14;

    for (let r = 0; r < ribbonCount; r++) {
        const positions = new Float32Array(pointsCount * 3);
        const colors = new Float32Array(pointsCount * 3);

        const colorStart = new THREE.Color(0xbd00ff);
        const colorEnd = new THREE.Color(0x00f0ff);
        const tempColor = new THREE.Color();

        for (let i = 0; i < pointsCount; i++) {
            const t = i / (pointsCount - 1);
            const x = -width / 2 + t * width;
            const z = (r - 1) * 0.75; // spaced in depth

            positions[i * 3] = x;
            positions[i * 3 + 1] = 0; // Y starts flat
            positions[i * 3 + 2] = z;

            tempColor.lerpColors(colorStart, colorEnd, t);
            colors[i * 3] = tempColor.r;
            colors[i * 3 + 1] = tempColor.g;
            colors[i * 3 + 2] = tempColor.b;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

        // Use custom thick lines or multiple points, standard LineBasicMaterial supports vertex colors
        const material = new THREE.LineBasicMaterial({
            vertexColors: true,
            linewidth: 3, // Note: linewidth > 1 usually not supported by WebGL implementations, but good practice
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
        waveGroup.add(line);
    }
    scene.add(waveGroup);
}

// 3. Mode: Deformable Plane
function buildGridPlane() {
    const size = 15;
    const segments = 40;
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    
    // Rotate to lie horizontally
    geometry.rotateX(-Math.PI / 2);

    const material = new THREE.MeshStandardMaterial({
        color: 0x00f0ff,
        wireframe: true,
        transparent: true,
        opacity: 0.35,
        emissive: 0x004080,
        emissiveIntensity: 0.2
    });

    planeMesh = new THREE.Mesh(geometry, material);
    planeMesh.position.set(0, 0, 0);
    
    // Keep reference to initial positions to apply offsets relative to baseline
    const posAttr = geometry.attributes.position;
    basePlaneVertices = [];
    for (let i = 0; i < posAttr.count; i++) {
        basePlaneVertices.push(new THREE.Vector3(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i)));
    }

    scene.add(planeMesh);
}

// Show active visualizer, hide others
function updateVisualizerVisibility() {
    barsGroup.visible = (currentMode === "bars");
    waveGroup.visible = (currentMode === "curve");
    planeMesh.visible = (currentMode === "plane");
}

// Handle window resizing
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    // Process audio updates inside AUDIO_SYSTEM
    try {
        AUDIO_SYSTEM.processBeatDetection();
    } catch(e) {}

    // Get current features
    const state = AUDIO_SYSTEM.getAudioState();
    isPlaying = state.isPlaying;

    // Update UI statistics
    mVolume.textContent = state.volume.toFixed(2);
    mBpm.textContent = state.bpm > 0 ? String(state.bpm) : "--";
    mBass.textContent = state.bass.toFixed(2);
    mTreble.textContent = state.treble.toFixed(2);

    // Apply active glow style changes based on volume
    if (state.isPlaying) {
        document.querySelector(".glass-panel").style.boxShadow = `0 8px 32px 0 rgba(189, 0, 255, ${0.1 + state.volume * 0.4})`;
    } else {
        document.querySelector(".glass-panel").style.boxShadow = "0 8px 32px 0 rgba(0, 0, 0, 0.37)";
    }

    // Refresh UI Playback Button label
    if (state.isPlaying) {
        playBtn.textContent = "⏸ Pause Track";
        playBtn.style.background = "linear-gradient(135deg, #00f0ff 0%, #007eff 100%)";
        playBtn.style.boxShadow = "0 4px 15px rgba(0, 240, 255, 0.3)";
    } else {
        playBtn.textContent = "▶ Play Track";
        playBtn.style.background = "linear-gradient(135deg, var(--accent-violet) 0%, #7e00ff 100%)";
        playBtn.style.boxShadow = "0 4px 15px var(--accent-glow)";
    }

    const reactive = reactiveToggle.checked;
    const deltaSeconds = 0.016; // Roughly 60fps
    flowTime += deltaSeconds;

    // 1. Animate Bars
    if (currentMode === "bars") {
        const bars = barsGroup.children;
        const rawFreq = state.rawFrequencies || [];
        const isReactive = reactive && state.isPlaying;

        for (let i = 0; i < bars.length; i++) {
            const bar = bars[i];
            
            // Map bar index to frequency array (first half is more energetic)
            const freqIdx = Math.floor((i / bars.length) * (rawFreq.length * 0.6));
            const amp = isReactive ? (rawFreq[freqIdx] / 255.0) * sensitivity : 0.05;
            
            // Idle bounce if not playing
            const idleOffset = !state.isPlaying ? Math.sin(flowTime * 2.0 + i * 0.4) * 0.1 + 0.12 : 0;
            const targetYScale = Math.max(0.05, amp + idleOffset);
            
            // Smooth lerp scaling to avoid hard jumps
            bar.scale.y = THREE.MathUtils.lerp(bar.scale.y, targetYScale, 0.25);
            
            // Make bars emit light stronger as they stretch
            bar.material.emissiveIntensity = bar.scale.y * 0.4;
        }
    }

    // 2. Animate Ribbon Curves
    else if (currentMode === "curve") {
        const isReactive = reactive && state.isPlaying;
        const rawFreq = state.rawFrequencies || [];

        waveGroup.children.forEach((line) => {
            const posAttr = line.geometry.attributes.position;
            const { pointsCount, zOffset, phaseOffset } = line.userData;

            for (let i = 0; i < pointsCount; i++) {
                const x = posAttr.getX(i);
                
                // Base sine movement (idle flow)
                const speed = isReactive ? 4.0 + state.bass * 6.0 : 2.0;
                let y = Math.sin(x * 0.7 - flowTime * speed + phaseOffset) * 0.35;

                if (isReactive) {
                    // Left wave is bass, middle is mids, right is treble
                    const progress = i / (pointsCount - 1);
                    let audioMultiplier = 0;
                    
                    if (progress < 0.35) {
                        audioMultiplier = state.bass * 2.0;
                    } else if (progress >= 0.35 && progress < 0.7) {
                        audioMultiplier = state.mids * 1.5;
                    } else {
                        audioMultiplier = state.treble * 3.0; // high frequencies are lower amplitude, boost them
                    }

                    // Displace curve point
                    y += Math.sin(x * 1.8 + flowTime * 8.0) * audioMultiplier * sensitivity * 0.4;
                }

                posAttr.setY(i, y);
            }
            posAttr.needsUpdate = true;
        });
    }

    // 3. Animate Deformable Plane
    else if (currentMode === "plane") {
        const isReactive = reactive && state.isPlaying;
        const posAttr = planeMesh.geometry.attributes.position;

        for (let i = 0; i < posAttr.count; i++) {
            const originalV = basePlaneVertices[i];
            
            // Distance from center of plane
            const dist = Math.sqrt(originalV.x * originalV.x + originalV.z * originalV.z);
            
            // Base fluid ripple wave
            const speed = isReactive ? 3.0 + state.bass * 5.0 : 1.5;
            let y = Math.sin(dist * 0.8 - flowTime * speed) * 0.2;

            if (isReactive) {
                // Modulate amplitude of ripples by volume/bass
                y += Math.sin(dist * 1.5 - flowTime * 8.0) * state.volume * sensitivity * 0.5;
            }

            posAttr.setY(i, y);
        }
        posAttr.needsUpdate = true;
    }

    // Update orbit controls
    controls.update();

    // Render frame
    renderer.render(scene, camera);
}

// Wire up UI event handlers
function setupUI() {
    // Play/Pause button
    playBtn.addEventListener("click", async () => {
        const state = AUDIO_SYSTEM.getAudioState();
        if (state.isPlaying) {
            AUDIO_SYSTEM.pause();
        } else {
            await AUDIO_SYSTEM.play();
        }
    });

    // Track Select Dropdown
    const trackSelect = document.getElementById("trackSelect");
    trackSelect.addEventListener("change", async (e) => {
        const wasPlaying = AUDIO_SYSTEM.getAudioState().isPlaying;
        await AUDIO_SYSTEM.loadTrack(e.target.value);
        if (wasPlaying) {
            await AUDIO_SYSTEM.play();
        }
    });

    // Volume Slider
    volumeSlider.addEventListener("input", (e) => {
        const vol = parseFloat(e.target.value);
        AUDIO_SYSTEM.setVolume(vol);
        volumeVal.textContent = Math.round(vol * 100) + "%";
    });

    // Sensitivity Slider
    sensSlider.addEventListener("input", (e) => {
        sensitivity = parseFloat(e.target.value);
        sensVal.textContent = sensitivity.toFixed(1);
    });

    // Mode Selector Buttons
    modeButtons.forEach((btn) => {
        btn.addEventListener("click", (e) => {
            modeButtons.forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            
            currentMode = btn.getAttribute("data-mode");
            updateVisualizerVisibility();
        });
    });

    // Sync volume slider initial position
    const state = AUDIO_SYSTEM.getAudioState();
    volumeSlider.value = 0.5; // match our default or read from audio.js
    volumeVal.textContent = "50%";
    AUDIO_SYSTEM.setVolume(0.5);
}

// Start
initThree();
setupUI();
animate();
