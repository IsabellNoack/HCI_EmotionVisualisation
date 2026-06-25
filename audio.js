const AUDIO = {
  enabled: false,    // visual reactive mode (user toggle)
  beatStrength: 0,   // strength of last detected beat pulse
  beatDecay: 150,    // ms for beat pulse to decay back toward target
  
  // Real-time audio features
  volume: 0,
  bass: 0,
  mids: 0,
  treble: 0,
  rawFrequencies: []
};

// State variables
let audioCtx = null;
let analyser = null;
let gainNode = null;
let hasLoadedAudio = false;
let isPlayingState = false;

// Beat tracking state
const ENERGY_HISTORY_SIZE = 180; // ~3s at 60fps
let energyHistory = [];
let lastBeatTime = -Infinity;
let beatTimes = [];
let detectedBpm = 0;

// Audio element for true pause/resume support (unlike BufferSource)
let audioElement = null;

export function initContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256; // Larger FFT for better spectrum details
    
    gainNode = audioCtx.createGain();
    gainNode.gain.value = 0.5; // Start at 50% volume
    gainNode.connect(audioCtx.destination);
  }
}

export async function loadTrack(filename) {
  initContext();
  
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }
  
  try {
    stopPlayback();
    
    audioElement = new Audio();
    // Use decodeURIComponent or direct string if it is already clean, but encodeURIComponent helps with spaces
    // Wait, the file is served relative to the server so encode/decode is needed to match spaces in URLs.
    audioElement.src = "./audio/" + encodeURI(filename);
    audioElement.loop = true;
    audioElement.crossOrigin = "anonymous";
    audioElement.volume = gainNode.gain.value;
    
    const mediaSource = audioCtx.createMediaElementSource(audioElement);
    mediaSource.connect(analyser);
    mediaSource.connect(gainNode);
    
    hasLoadedAudio = true;
    
    // Reset beat tracking
    energyHistory = [];
    lastBeatTime = -Infinity;
    beatTimes = [];
    detectedBpm = 0;
    
    window.dispatchEvent(new CustomEvent('audioStateChange', { detail: getAudioState() }));
    return true;
  } catch(err) {
    console.error('Failed to load track:', filename, err);
    hasLoadedAudio = false;
    isPlayingState = false;
    return false;
  }
}

export async function loadDefaultTrack() {
  return await loadTrack("Metronome 120 BPM - QuickSounds.com.mp3");
}

export async function loadFile(file) {
  initContext();
  
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }
  
  try {
    // Stop any previous playback & connections
    stopPlayback();
    
    // Create HTMLAudioElement for true pause/resume support
    audioElement = new Audio();
    audioElement.src = URL.createObjectURL(file);
    audioElement.loop = true;
    audioElement.volume = gainNode.gain.value; // Match current volume
    
    try {
      // Connect: AudioElement -> MediaSource -> Analyser(for FFT) + GainNode(volume/destination)
      const mediaSource = audioCtx.createMediaElementSource(audioElement);
      
      // Route: source -> analyser (for beat detection)
      mediaSource.connect(analyser);
      // Route: source -> gain (for volume) -> speakers
      mediaSource.connect(gainNode);
    } catch(e) {
      console.error('Media element connection error:', e);
    }
    
    hasLoadedAudio = true;
    
    // Auto-play on load
    audioElement.play().then(() => {
      isPlayingState = true;
      window.dispatchEvent(new CustomEvent('audioStateChange', { detail: getAudioState() }));
      
      // Reset beat tracking for new file
      energyHistory = [];
      lastBeatTime = -Infinity;
      beatTimes = [];
      detectedBpm = 0;
    }).catch(e => {
      console.error('Playback failed:', e);
      isPlayingState = false;
    });
    
    return true;
  } catch(err) {
    console.error('Failed to load audio file:', err);
    hasLoadedAudio = false;
    isPlayingState = false;
    return false;
  }
}

export async function play() {
  if (!hasLoadedAudio) {
    const loaded = await loadDefaultTrack();
    if (!loaded) return false;
  }
  
  if (!audioElement) return false;
  
  try {
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }
    
    // Resume from where we paused!
    audioElement.play().then(() => {
      isPlayingState = true;
      window.dispatchEvent(new CustomEvent('audioStateChange', { detail: getAudioState() }));
    }).catch(e => {
      console.error('Play failed:', e);
      isPlayingState = false;
    });
    
    return true;
  } catch(e) {
    console.error('Error starting playback:', e);
    return false;
  }
}

export function pause() {
  if (!isPlayingState || !audioElement) return;
  
  audioElement.pause();
  isPlayingState = false;
  window.dispatchEvent(new CustomEvent('audioStateChange', { detail: getAudioState() }));
}

function stopPlayback() {
  try {
    if (audioElement) {
      audioElement.pause();
      URL.revokeObjectURL(audioElement.src);
      audioElement = null;
    }
  } catch(e) {}
  
  isPlayingState = false;
}

export function setVolume(value) {
  const vol = Math.max(0, Math.min(1, value));
  if (gainNode) gainNode.gain.value = vol;
  if (audioElement) audioElement.volume = vol;
}

/** 
 * Calculate energy from FFT data. Always returns a positive number.
 */
function getEnergy() {
  try {
    analyser.getFloatFrequencyData(new Float32Array(analyser.frequencyBinCount));
  } catch(e) {
    return -100; // dB scale baseline when silent
  }
  
  const data = new Float32Array(analyser.frequencyBinCount);
  analyser.getFloatFrequencyData(data);
  
  // Sum bass frequencies (first ~12 bins), convert from dB to linear scale
  let energy = 0;
  for (let i = 0; i < Math.min(12, data.length); i++) {
    const db = data[i];
    if (!isFinite(db)) continue;
    // -120dB → ~0, 0dB → 1. Higher is louder
    energy += Math.pow(10, (db + 120) / 30); // Amplify quiet signals slightly
  }
  
  return energy / 12;
}

function detectBeat(currentTime) {
  const energy = getEnergy();
  energyHistory.push(energy);
  
  while (energyHistory.length > ENERGY_HISTORY_SIZE) {
    energyHistory.shift();
  }
  
  if (energyHistory.length < 30) return false; // Need at least ~0.5s of data
  
  const windowSize = Math.min(12, energyHistory.length);
  let meanEnergy = 0;
  for (let i = energyHistory.length - windowSize; i < energyHistory.length; i++) {
    meanEnergy += energyHistory[i];
  }
  meanEnergy /= windowSize;
  
  // Beat = current energy significantly above recent average
  const ratio = meanEnergy > 0.1 ? energy / meanEnergy : (energy > 2 ? 3 : 0);
  
  // Debounce consecutive triggers on a single beat onset (min 250ms interval, supporting up to 240 BPM)
  const minInterval = 0.25;
  if (ratio > 1.4 && (currentTime - lastBeatTime) > minInterval) {
    lastBeatTime = currentTime;
    beatTimes.push(currentTime);
    
    while (beatTimes.length > 40) beatTimes.shift();
    
    // Update BPM estimate
    updateBpm();
    return true;
  }
  
  return false;
}

function updateBpm() {
  if (beatTimes.length < 3) return;
  
  const iois = []; // inter-onset intervals
  for (let i = 1; i < beatTimes.length; i++) {
    const interval = beatTimes[i] - beatTimes[i - 1];
    if (interval >= 0.25 && interval <= 2.5) { // 40-240 BPM range
      iois.push(interval);
    }
  }
  
  if (iois.length < 2) return;
  
  // Weight recent intervals more heavily
  let weightedSum = 0, weightTotal = 0;
  for (let i = 0; i < iois.length; i++) {
    const w = (i + 1) / iois.length; // newer = higher weight
    weightedSum += iois[i] * w;
    weightTotal += w;
  }
  
  if (weightTotal > 0) {
    detectedBpm = Math.round(60 / (weightedSum / weightTotal));
    detectedBpm = Math.max(40, Math.min(200, detectedBpm)); // Clamp
  }
}

function updateAudioFeatures() {
  if (!analyser || !hasLoadedAudio || !isPlayingState) {
    AUDIO.volume = 0;
    AUDIO.bass = 0;
    AUDIO.mids = 0;
    AUDIO.treble = 0;
    AUDIO.rawFrequencies = [];
    return;
  }
  
  try {
    // 1. Volume (RMS) from Time Domain
    const bufferLength = analyser.fftSize;
    const timeData = new Float32Array(bufferLength);
    analyser.getFloatTimeDomainData(timeData);
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += timeData[i] * timeData[i];
    }
    const rms = Math.sqrt(sum / bufferLength);
    AUDIO.volume = AUDIO.volume * 0.7 + rms * 0.3; // exponential smoothing
    
    // 2. Frequency bands from Frequency Domain
    const freqData = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(freqData);
    
    AUDIO.rawFrequencies = Array.from(freqData);
    
    let bassSum = 0, bassCount = 0;
    let midsSum = 0, midsCount = 0;
    let trebleSum = 0, trebleCount = 0;
    
    const binCount = freqData.length;
    for (let i = 0; i < binCount; i++) {
      const val = freqData[i] / 255.0;
      // In 256-fft, 128 bins. Sample rate 44.1k: each bin ~172Hz
      if (i >= 1 && i <= 3) { // ~170Hz - 510Hz (Bass)
        bassSum += val;
        bassCount++;
      } else if (i > 3 && i <= 16) { // ~510Hz - 2750Hz (Mids)
        midsSum += val;
        midsCount++;
      } else if (i > 16 && i <= 48) { // ~2750Hz - 8250Hz (Treble)
        trebleSum += val;
        trebleCount++;
      }
    }
    
    const targetBass = bassCount > 0 ? bassSum / bassCount : 0;
    const targetMids = midsCount > 0 ? midsSum / midsCount : 0;
    const targetTreble = trebleCount > 0 ? trebleSum / trebleCount : 0;
    
    // Smooth transitions
    AUDIO.bass = AUDIO.bass * 0.6 + targetBass * 0.4;
    AUDIO.mids = AUDIO.mids * 0.7 + targetMids * 0.3;
    AUDIO.treble = AUDIO.treble * 0.7 + targetTreble * 0.3;
  } catch (e) {
    console.error("Error updating audio features:", e);
  }
}

export function processBeatDetection() {
  if (!hasLoadedAudio || !isPlayingState) {
    updateAudioFeatures();
    return;
  }
  
  const currentTime = audioCtx ? audioCtx.currentTime : undefined;
  if (!currentTime || !isFinite(currentTime)) return;
  
  try {
    updateAudioFeatures();
    const isOnset = detectBeat(currentTime);
    
    if (isOnset && AUDIO.enabled) {
      // Trigger visual pulse on beat
      AUDIO.beatStrength = 1.0;
      
      // Extra pulse for fast music (>120 BPM) - syncopation feel
      if (detectedBpm > 120) {
        setTimeout(() => { 
          if (AUDIO.enabled && isPlayingState) {
            AUDIO.beatStrength = Math.max(AUDIO.beatStrength, 0.4);
          }
        }, Math.round(60 / detectedBpm * 1000 * 0.5)); // Half-beat delay
      }
    }
    
    // Exponential decay of beat pulse back to zero
    const decayRate = Math.exp(-AUDIO.beatDecay / 16.7); // ~60fps frame time
    AUDIO.beatStrength *= decayRate;
    
    if (AUDIO.beatStrength < 0.005) {
      AUDIO.beatStrength = 0;
    }
  } catch(e) {
    // Beat detection should NEVER crash the visualizer
    console.error('Beat detection error:', e);
  }
}

export function getAudioState() {
  return {
    enabled: AUDIO.enabled,
    isPlaying: isPlayingState,
    beatStrength: AUDIO.beatStrength,
    bpm: detectedBpm,
    hasFile: hasLoadedAudio,
    volume: AUDIO.volume,
    bass: AUDIO.bass,
    mids: AUDIO.mids,
    treble: AUDIO.treble,
    rawFrequencies: AUDIO.rawFrequencies
  };
}

/**
 * Apply beat-reactive modulation to visual parameters.
 */
export function applyBeatReactiveModulation(target) {
  if (!AUDIO.enabled || !isPlayingState) return;
  
  const strength = AUDIO.beatStrength;
  
  // Wave amplitude pulses on beats - stronger pulse
  target.waveAmpA += strength * 0.35;
  target.waveAmpB += strength * 0.2;
  
  // Flow speed increases momentarily creating visual "rush"
  target.flowSpeed += strength * 1.8;

  // Glow/opacity pulses create a beat flash effect
  target.alphaMultiplier += strength * 0.45;
}

export function addMusicUI(panel, contentWrapper) {
  const sectionHeader = document.createElement("div");
  sectionHeader.textContent = "Music";
  sectionHeader.style.marginTop = "8px";
  sectionHeader.style.marginBottom = "4px";
  sectionHeader.style.fontWeight = "700";
  sectionHeader.style.opacity = "0.95";
  sectionHeader.style.textAlign = "center";
  contentWrapper.appendChild(sectionHeader);

  // Dropdown list of track names & files
  const TRACKS = [
    { name: "Metronome 120 BPM", file: "Metronome 120 BPM - QuickSounds.com.mp3" },
    { name: "The Infinity (120 BPM)", file: "dcpixelwelt-the-infinity-120-bpm-d-major-13108.mp3" },
    { name: "Ad Infinitum - New Dawn", file: "Ad Infinitum - New Dawn.mp3" },
    { name: "Ad Infinitum - Serpent's Downfall", file: "Ad Infinitum - The Serpent's Downfall.mp3" }
  ];

  // Track select row
  const trackLabel = document.createElement("label");
  trackLabel.style.display = "grid";
  trackLabel.style.gridTemplateColumns = "76px minmax(0,1fr)";
  trackLabel.style.gap = "6px";
  trackLabel.style.alignItems = "center";
  trackLabel.style.margin = "6px 0";

  const trackText = document.createElement("span");
  trackText.textContent = "Select Track";
  trackText.style.opacity = "0.8";
  trackText.style.fontSize = "10px";
  trackLabel.appendChild(trackText);

  const trackSelect = document.createElement("select");
  trackSelect.style.fontSize = "10px";
  trackSelect.style.background = "rgba(0, 0, 0, 0.4)";
  trackSelect.style.border = "1px solid rgba(255, 200, 120, 0.35)";
  trackSelect.style.color = "#ffd7a1";
  trackSelect.style.padding = "2px";
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
    const wasPlaying = isPlayingState;
    fileNameDisplay.textContent = ""; // Clear custom file name
    await loadTrack(e.target.value);
    if (wasPlaying) {
      await play();
    }
  });

  trackLabel.appendChild(trackSelect);
  contentWrapper.appendChild(trackLabel);

  // File input row (Custom File)
  const fileLabel = document.createElement("label");
  fileLabel.style.display = "grid";
  fileLabel.style.gridTemplateColumns = "76px minmax(0,1fr)";
  fileLabel.style.gap = "6px";
  fileLabel.style.alignItems = "center";
  fileLabel.style.margin = "6px 0";

  const customLabel = document.createElement("span");
  customLabel.textContent = "Custom File";
  customLabel.style.opacity = "0.8";
  customLabel.style.fontSize = "10px";
  fileLabel.appendChild(customLabel);

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "audio/*";
  fileInput.style.fontSize = "9px";
  fileInput.style.padding = "2px";

  const fileNameDisplay = document.createElement("span");
  fileNameDisplay.textContent = "";
  fileNameDisplay.style.textAlign = "right";
  fileNameDisplay.style.opacity = "0.6";
  fileNameDisplay.style.fontSize = "9px";
  fileNameDisplay.style.display = "block";
  fileNameDisplay.style.marginTop = "2px";

  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    let displayName = file.name.length > 12 ? 
      file.name.substring(0, 11).replace(/<[^>]*>?/gm, '') + '…' : 
      file.name;
    fileNameDisplay.textContent = "Loading...";

    const loaded = await loadFile(file);
    if (loaded) {
      fileNameDisplay.textContent = displayName;
      window.dispatchEvent(new CustomEvent('audioStateChange', { detail: getAudioState() }));
    } else {
      fileNameDisplay.textContent = "?";
    }
  });

  fileLabel.appendChild(fileInput);
  contentWrapper.appendChild(fileLabel);
  contentWrapper.appendChild(fileNameDisplay);

  // Transport controls row (play/pause)
  const controlRow = document.createElement("div");
  controlRow.style.display = "grid";
  controlRow.style.gridTemplateColumns = "1fr auto";
  controlRow.style.gap = "8px";
  controlRow.style.marginTop = "4px";

  const playPauseBtn = document.createElement("button");
  playPauseBtn.textContent = "\u25B6 Play";
  playPauseBtn.style.padding = "6px 10px";
  playPauseBtn.style.background = "transparent";
  playPauseBtn.style.border = "1px solid rgba(255, 215, 161, 0.4)";
  playPauseBtn.style.borderRadius = "5px";
  playPauseBtn.style.color = "#ffd7a1";
  playPauseBtn.style.font = "bold 10px monospace";
  playPauseBtn.style.cursor = "pointer";

  playPauseBtn.addEventListener("click", async () => {
    if (isPlayingState) {
      pause();
    } else {
      await play();
    }
  });

  controlRow.appendChild(playPauseBtn);

  // Reactive checkbox row
  const reactiveRow = document.createElement("label");
  reactiveRow.style.display = "grid";
  reactiveRow.style.gridTemplateColumns = "auto 1fr";
  reactiveRow.style.gap = "6px";
  reactiveRow.style.alignItems = "center";
  reactiveRow.style.marginTop = "4px";

  const reactiveCheckbox = document.createElement("input");
  reactiveCheckbox.type = "checkbox";
  reactiveCheckbox.checked = AUDIO.enabled;

  const reactiveLabel = document.createElement("span");
  reactiveLabel.textContent = "Music Reactive (syncs visuals to beat)";

  reactiveRow.appendChild(reactiveCheckbox);
  reactiveRow.appendChild(reactiveLabel);
  controlRow.appendChild(reactiveRow);

  contentWrapper.appendChild(controlRow);

  // Volume slider row
  const volRow = document.createElement("label");
  volRow.style.display = "grid";
  volRow.style.gridTemplateColumns = "76px minmax(0,1fr) 32px";
  volRow.style.gap = "6px";
  volRow.style.alignItems = "center";
  volRow.style.marginTop = "8px";

  const volName = document.createElement("span");
  volName.textContent = "Volume";

  const volSlider = document.createElement("input");
  volSlider.type = "range";
  volSlider.min = "0";
  volSlider.max = "1";
  volSlider.step = "0.01";
  volSlider.value = "0.3"; // Start low to avoid ear damage

  const volValue = document.createElement("span");
  volValue.textContent = "30%";
  volValue.style.textAlign = "right";

  volSlider.addEventListener("input", () => {
    setVolume(Number(volSlider.value));
    volValue.textContent = Math.round(Number(volSlider.value) * 100) + "%";
  });

  volRow.appendChild(volName);
  volRow.appendChild(volSlider);
  volRow.appendChild(volValue);
  contentWrapper.appendChild(volRow);

  // BPM display row
  const bpmRow = document.createElement("div");
  bpmRow.style.display = "grid";
  bpmRow.style.gridTemplateColumns = "76px auto 44px";
  bpmRow.style.gap = "8px";
  bpmRow.style.alignItems = "center";
  bpmRow.style.marginTop = "8px";

  const bpmLabelEl = document.createElement("span");
  bpmLabelEl.textContent = "BPM";
  bpmLabelEl.style.opacity = "0.7";

  const bpmValueEl = document.createElement("span");
  bpmValueEl.textContent = "-";
  bpmValueEl.style.textAlign = "center";
  bpmValueEl.style.fontWeight = "bold";
  bpmValueEl.style.color = "#ffd7a1";

  bpmRow.appendChild(bpmLabelEl);
  bpmRow.appendChild(bpmValueEl);
  contentWrapper.appendChild(bpmRow);

  // Beat indicator dots container
  const beatDotsContainer = document.createElement("div");
  beatDotsContainer.style.display = "flex";
  beatDotsContainer.style.justifyContent = "center";
  beatDotsContainer.style.gap = "6px";
  beatDotsContainer.style.marginTop = "4px";
  contentWrapper.appendChild(beatDotsContainer);

  // Reactive toggle handler
  reactiveCheckbox.addEventListener("change", () => {
    AUDIO.enabled = reactiveCheckbox.checked;
    window.dispatchEvent(new CustomEvent('audioStateChange', { detail: getAudioState() }));
  });

  // Sync external audio changes to UI
  window.addEventListener('audioStateChange', (e) => {
    const state = e.detail;
    
    // Update button label based on playback state
    if (isPlayingState && hasLoadedAudio) {
      playPauseBtn.textContent = "\u25A0 Pause";
    } else {
      playPauseBtn.textContent = "\u25B6 Play";
    }
    
    reactiveCheckbox.checked = state.enabled && state.isPlaying;
  });

  // Frame-by-frame UI refresh for BPM display and beat dots
  window._audioUIRefresh = () => {
    const state = getAudioState();
    bpmValueEl.textContent = state.bpm > 0 ? String(state.bpm) : "-";
    
    if (!state.hasFile) return;
    
    // Update dot count based on BPM
    const maxDots = Math.min(12, Math.max(3, Math.round(Math.min(180, state.bpm || 120) / 20)));
    
    while (beatDotsContainer.children.length > maxDots) {
      beatDotsContainer.removeChild(beatDotsContainer.lastChild);
    }
    while (beatDotsContainer.children.length < maxDots) {
      const dot = document.createElement("div");
      dot.style.width = "10px";
      dot.style.height = "10px";
      dot.style.borderRadius = "50%";
      dot.style.background = "rgba(255, 215, 161, 0.15)";
      beatDotsContainer.appendChild(dot);
    }

    if (state.isPlaying && state.beatStrength > 0.01) {
      const children = Array.from(beatDotsContainer.children);
      const activeDotIndex = Math.floor((AUDIO.beatStrength * maxDots)) % maxDots;
      children.forEach((child, idx) => {
        child.style.background = idx === activeDotIndex 
          ? "rgba(255, 180, 80, 0.9)" 
          : "rgba(255, 215, 161, 0.15)";
      });
    }
  };
}
