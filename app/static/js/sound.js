// Mickey UI Sound Synthesizer using Web Audio API

const Sound = {
  ctx: null,

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },

  playTone(freq, type, duration, volume = 0.1, startTimeOffset = 0) {
    this.init();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = type; // 'sine', 'triangle', 'sawtooth', 'square'
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime + startTimeOffset);
    
    gain.gain.setValueAtTime(volume, this.ctx.currentTime + startTimeOffset);
    // Exponential decay
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + startTimeOffset + duration);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(this.ctx.currentTime + startTimeOffset);
    osc.stop(this.ctx.currentTime + startTimeOffset + duration);
  },

  // Premium MS To-Do styled "ding!"
  playComplete() {
    try {
      this.init();
      const now = this.ctx.currentTime;
      // Synthesize two overlapping sweet bell tones (chime)
      // Note 1: E6 (1318.5 Hz)
      this.playTone(1318.51, 'sine', 0.15, 0.08, 0);
      // Note 2: A6 (1760 Hz) shortly after
      this.playTone(1760.00, 'sine', 0.4, 0.12, 0.07);
    } catch (e) {
      console.warn("Audio Context failed to play sound:", e);
    }
  },

  // Biometric authentication verified / positive action
  playSuccess() {
    try {
      this.init();
      // Fast ascending arpeggio (C5 -> E5 -> G5 -> C6)
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        this.playTone(freq, 'sine', 0.25, 0.06, idx * 0.06);
      });
    } catch (e) {
      console.warn(e);
    }
  },

  // Auth lock screen / error warning
  playFailure() {
    try {
      this.init();
      // Low dual warning tone
      this.playTone(220.00, 'triangle', 0.15, 0.15, 0);
      this.playTone(196.00, 'triangle', 0.2, 0.15, 0.08);
    } catch (e) {
      console.warn(e);
    }
  },

  // Subtle clean click
  playClick() {
    try {
      this.init();
      // Very high pitched micro click
      this.playTone(2500, 'sine', 0.04, 0.04, 0);
    } catch (e) {
      console.warn(e);
    }
  }
};

// Auto initialize on first interaction to bypass browser autoplay policy
window.addEventListener('click', () => Sound.init(), { once: true });
window.addEventListener('keydown', () => Sound.init(), { once: true });
