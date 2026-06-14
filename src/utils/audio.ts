// Web Audio API Sound Synthesizer for Retro Game Impacts and UI feedback.
// Lazily loaded to avoid browser blocking policies.

let audioCtx: AudioContext | null = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function playPunchSound() {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    // Dynamic pitch falloff for air swing
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(350, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

    osc.start();
    osc.stop(ctx.currentTime + 0.16);
  } catch (e) {
    console.warn('Audio play failed', e);
  }
}

export function playSlapSound() {
  try {
    const ctx = getAudioContext();
    
    // Slap uses white noise with a fast envelope and bandpass filter
    const bufferSize = ctx.sampleRate * 0.15; // 150ms buffer
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    // Fill buffer with noise
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noiseNode = ctx.createBufferSource();
    noiseNode.buffer = buffer;
    
    // Bandpass filter centered at 1500Hz for "smack/slap" timbre
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.12);
    filter.Q.value = 3.0;

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
    gainNode.gain.setValueAtTime(0.5, ctx.currentTime + 0.02); // Punchy crack initiation
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);

    noiseNode.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Also inject a quick low-mid wave for bone impact body
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(180, ctx.currentTime);
    subOsc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.1);
    subGain.gain.setValueAtTime(0.4, ctx.currentTime);
    subGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

    subOsc.connect(subGain);
    subGain.connect(ctx.destination);

    noiseNode.start();
    subOsc.start();
    
    noiseNode.stop(ctx.currentTime + 0.15);
    subOsc.stop(ctx.currentTime + 0.15);
  } catch (e) {
    console.warn('Audio play failed', e);
  }
}

export function playHitSound() {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.22);

    // Distort a bit with short envelope
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);

    const lowOsc = ctx.createOscillator();
    const lowGain = ctx.createGain();
    lowOsc.type = 'sine';
    lowOsc.frequency.setValueAtTime(90, ctx.currentTime);
    lowGain.gain.setValueAtTime(0.6, ctx.currentTime);
    lowGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);
    lowOsc.connect(lowGain);
    lowGain.connect(ctx.destination);

    osc.start();
    lowOsc.start();
    
    osc.stop(ctx.currentTime + 0.23);
    lowOsc.stop(ctx.currentTime + 0.23);
  } catch (e) {
    console.warn('Audio play failed', e);
  }
}

export function playBlockSound() {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // High metallic ping that decays into wood thud
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);

    const helperOsc = ctx.createOscillator();
    const helperGain = ctx.createGain();
    helperOsc.type = 'square';
    helperOsc.frequency.setValueAtTime(300, ctx.currentTime);
    helperGain.gain.setValueAtTime(0.1, ctx.currentTime);
    helperGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);

    helperOsc.connect(helperGain);
    helperGain.connect(ctx.destination);

    osc.start();
    helperOsc.start();
    
    osc.stop(ctx.currentTime + 0.12);
    helperOsc.stop(ctx.currentTime + 0.12);
  } catch (e) {
    console.warn('Audio play failed', e);
  }
}

export function playCameraSnapSound() {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(2000, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) {
    console.warn('Audio play failed', e);
  }
}

export function playCountdownBeep(highPitch = false) {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(highPitch ? 1000 : 550, ctx.currentTime);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch (e) {
    console.warn('Audio play failed', e);
  }
}

export function playFanfare() {
  try {
    const ctx = getAudioContext();
    const notes = [261.63, 329.63, 392.00, 523.25]; // C E G C cascade
    
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);
      
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + idx * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.35);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(ctx.currentTime + idx * 0.12);
      osc.stop(ctx.currentTime + idx * 0.12 + 0.4);
    });
  } catch (e) {
    console.warn('Audio play failed', e);
  }
}

export function playDefeatSound() {
  try {
    const ctx = getAudioContext();
    const notes = [311.13, 293.66, 277.18, 220.00]; // Eb D Db A sad decline
    
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.15);
      
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + idx * 0.15 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.15 + 0.45);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(ctx.currentTime + idx * 0.15);
      osc.stop(ctx.currentTime + idx * 0.15 + 0.5);
    });
  } catch (e) {
    console.warn('Audio play failed', e);
  }
}
