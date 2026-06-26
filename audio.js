// Simple, clean audio processing module for noise-wave reactivity
const AUDIO = {
  enabled: false,
  isPlaying: false,
  beatStrength: 0,
  beatDecay: 150,
  volume: 0,
  bass: 0,
  mids: 0,
  treble: 0,
  bpm: 0,
  rawFrequencies: [],
  reactivitySource: "auto",
  sensitivity: 2.5,
  detectedSource: "mids",
  hasFile: false,
  trackFilename: "Metronome 120 BPM - QuickSounds.com.mp3"
};

let audioCtx = null;
let analyser = null;
let gainNode = null;
let audioElement = null;

let energyHistory = [];
let lastBeatTime = -Infinity;
let beatTimes = [];

const bassHistory = [];
const midsHistory = [];
const trebleHistory = [];

export function initContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    
    gainNode = audioCtx.createGain();
    gainNode.gain.value = 0.5; // Start at 50%
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
    audioElement.src = "./audio/" + encodeURI(filename);
    audioElement.loop = true;
    audioElement.crossOrigin = "anonymous";
    audioElement.volume = gainNode.gain.value;

    const mediaSource = audioCtx.createMediaElementSource(audioElement);
    mediaSource.connect(analyser);
    mediaSource.connect(gainNode);

    AUDIO.hasFile = true;
    AUDIO.trackFilename = filename;
    energyHistory = [];
    lastBeatTime = -Infinity;
    beatTimes = [];
    AUDIO.bpm = 0;

    window.dispatchEvent(new CustomEvent('audioStateChange', { detail: getAudioState() }));
    return true;
  } catch (err) {
    console.error('Failed to load track:', filename, err);
    AUDIO.hasFile = false;
    AUDIO.isPlaying = false;
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
    stopPlayback();
    audioElement = new Audio();
    audioElement.src = URL.createObjectURL(file);
    audioElement.loop = true;
    audioElement.volume = gainNode.gain.value;

    const mediaSource = audioCtx.createMediaElementSource(audioElement);
    mediaSource.connect(analyser);
    mediaSource.connect(gainNode);

    AUDIO.hasFile = true;
    AUDIO.trackFilename = file.name;
    energyHistory = [];
    lastBeatTime = -Infinity;
    beatTimes = [];
    AUDIO.bpm = 0;

    await play();
    return true;
  } catch (err) {
    console.error('Failed to load file:', err);
    AUDIO.hasFile = false;
    AUDIO.isPlaying = false;
    return false;
  }
}

export async function play() {
  if (!AUDIO.hasFile) {
    const loaded = await loadDefaultTrack();
    if (!loaded) return false;
  }
  if (!audioElement) return false;
  try {
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }
    await audioElement.play();
    AUDIO.isPlaying = true;
    window.dispatchEvent(new CustomEvent('audioStateChange', { detail: getAudioState() }));
    return true;
  } catch (e) {
    console.error('Play failed:', e);
    AUDIO.isPlaying = false;
    return false;
  }
}

export function pause() {
  if (!AUDIO.isPlaying || !audioElement) return;
  audioElement.pause();
  AUDIO.isPlaying = false;
  window.dispatchEvent(new CustomEvent('audioStateChange', { detail: getAudioState() }));
}

function stopPlayback() {
  try {
    if (audioElement) {
      audioElement.pause();
      URL.revokeObjectURL(audioElement.src);
      audioElement = null;
    }
  } catch (e) {}
  AUDIO.isPlaying = false;
}

export function setVolume(value) {
  const vol = Math.max(0, Math.min(1, value));
  if (gainNode) gainNode.gain.value = vol;
  if (audioElement) audioElement.volume = vol;
}

export function setEnabled(val) {
  AUDIO.enabled = val;
  window.dispatchEvent(new CustomEvent('audioStateChange', { detail: getAudioState() }));
}

export function setReactivitySource(src) {
  AUDIO.reactivitySource = src;
  window.dispatchEvent(new CustomEvent('audioStateChange', { detail: getAudioState() }));
}

export function setSensitivity(val) {
  AUDIO.sensitivity = val;
  window.dispatchEvent(new CustomEvent('audioStateChange', { detail: getAudioState() }));
}

function getEnergy() {
  if (!analyser) return 0;
  const data = new Float32Array(analyser.frequencyBinCount);
  analyser.getFloatFrequencyData(data);

  let source = AUDIO.reactivitySource;
  if (source === "auto") {
    source = AUDIO.detectedSource;
  }

  let startBin = 0;
  let endBin = data.length;

  if (source === "bass") {
    startBin = 1;
    endBin = 4; // ~170Hz - 680Hz
  } else if (source === "mids") {
    startBin = 4;
    endBin = 16; // ~680Hz - 2750Hz
  } else if (source === "treble") {
    startBin = 16;
    endBin = 48; // ~2750Hz - 8250Hz
  }

  let energySum = 0;
  let count = 0;
  for (let i = startBin; i < Math.min(endBin, data.length); i++) {
    const db = data[i];
    if (!isFinite(db)) continue;
    energySum += Math.pow(10, (db + 120) / 30);
    count++;
  }
  return count > 0 ? energySum / count : 0;
}

function detectBeat(currentTime) {
  const energy = getEnergy();
  energyHistory.push(energy);
  if (energyHistory.length > 60) {
    energyHistory.shift();
  }
  if (energyHistory.length < 15) return false;

  const avgEnergy = energyHistory.reduce((a, b) => a + b, 0) / energyHistory.length;
  const threshold = 1.35;

  if (energy > avgEnergy * threshold && (currentTime - lastBeatTime) > 0.25) {
    lastBeatTime = currentTime;
    beatTimes.push(currentTime);
    if (beatTimes.length > 10) {
      beatTimes.shift();
    }
    updateBpm();
    return true;
  }
  return false;
}

function updateBpm() {
  if (beatTimes.length < 3) return;
  const intervals = [];
  for (let i = 1; i < beatTimes.length; i++) {
    intervals.push(beatTimes[i] - beatTimes[i - 1]);
  }
  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  AUDIO.bpm = Math.round(60 / avgInterval);
  if (AUDIO.bpm < 40 || AUDIO.bpm > 200) {
    AUDIO.bpm = 120;
  }
}

function updateAudioFeatures() {
  if (!analyser || !AUDIO.hasFile || !AUDIO.isPlaying) {
    AUDIO.volume = 0;
    AUDIO.bass = 0;
    AUDIO.mids = 0;
    AUDIO.treble = 0;
    AUDIO.rawFrequencies = [];
    return;
  }
  try {
    const bufferLength = analyser.fftSize;
    const timeData = new Float32Array(bufferLength);
    analyser.getFloatTimeDomainData(timeData);
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += timeData[i] * timeData[i];
    }
    AUDIO.volume = AUDIO.volume * 0.7 + Math.sqrt(sum / bufferLength) * 0.3;

    const freqData = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(freqData);
    AUDIO.rawFrequencies = Array.from(freqData);

    let bassSum = 0, bassCount = 0;
    let midsSum = 0, midsCount = 0;
    let trebleSum = 0, trebleCount = 0;

    for (let i = 0; i < freqData.length; i++) {
      const val = freqData[i] / 255.0;
      if (i >= 1 && i <= 3) {
        bassSum += val;
        bassCount++;
      } else if (i > 3 && i <= 16) {
        midsSum += val;
        midsCount++;
      } else if (i > 16 && i <= 48) {
        trebleSum += val;
        trebleCount++;
      }
    }
    AUDIO.bass = AUDIO.bass * 0.6 + (bassCount > 0 ? bassSum / bassCount : 0) * 0.4;
    AUDIO.mids = AUDIO.mids * 0.7 + (midsCount > 0 ? midsSum / midsCount : 0) * 0.3;
    AUDIO.treble = AUDIO.treble * 0.7 + (trebleCount > 0 ? trebleSum / trebleCount : 0) * 0.3;
  } catch (e) {
    console.error("Error updating audio features:", e);
  }
}

function updateAutoSource() {
  bassHistory.push(AUDIO.bass);
  midsHistory.push(AUDIO.mids);
  trebleHistory.push(AUDIO.treble);

  if (bassHistory.length > 60) {
    bassHistory.shift();
    midsHistory.shift();
    trebleHistory.shift();
  }

  if (bassHistory.length < 10) {
    AUDIO.detectedSource = "mids";
    return;
  }

  const bassRange = Math.max(...bassHistory) - Math.min(...bassHistory);
  const midsRange = Math.max(...midsHistory) - Math.min(...midsHistory);
  const trebleRange = Math.max(...trebleHistory) - Math.min(...trebleHistory);

  if (bassRange > midsRange && bassRange > trebleRange) {
    AUDIO.detectedSource = "bass";
  } else if (midsRange > bassRange && midsRange > trebleRange) {
    AUDIO.detectedSource = "mids";
  } else {
    AUDIO.detectedSource = "treble";
  }
}

export function processBeatDetection() {
  if (!AUDIO.hasFile || !AUDIO.isPlaying) {
    updateAudioFeatures();
    AUDIO.beatStrength = 0;
    return;
  }
  const currentTime = audioCtx ? audioCtx.currentTime : undefined;
  if (!currentTime || !isFinite(currentTime)) return;

  try {
    updateAudioFeatures();

    if (AUDIO.reactivitySource === "auto") {
      updateAutoSource();
    } else {
      bassHistory.length = 0;
      midsHistory.length = 0;
      trebleHistory.length = 0;
    }

    const isOnset = detectBeat(currentTime);
    if (isOnset && AUDIO.enabled) {
      AUDIO.beatStrength = 1.0;
    }

    const decayRate = Math.exp(-16.7 / AUDIO.beatDecay);
    AUDIO.beatStrength *= decayRate;
    if (AUDIO.beatStrength < 0.005) {
      AUDIO.beatStrength = 0;
    }
  } catch (e) {
    console.error('Beat detection error:', e);
  }
}

export function getAudioState() {
  return {
    enabled: AUDIO.enabled,
    isPlaying: AUDIO.isPlaying,
    beatStrength: AUDIO.beatStrength,
    bpm: AUDIO.bpm || 0,
    hasFile: AUDIO.hasFile,
    volume: AUDIO.volume,
    bass: AUDIO.bass,
    mids: AUDIO.mids,
    treble: AUDIO.treble,
    rawFrequencies: AUDIO.rawFrequencies,
    reactivitySource: AUDIO.reactivitySource,
    sensitivity: AUDIO.sensitivity,
    detectedSource: AUDIO.detectedSource,
    trackFilename: AUDIO.trackFilename
  };
}
