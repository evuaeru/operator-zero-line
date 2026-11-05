/**
 * AUDIO.JS - Web Audio API Procedural Tactical Sound Synthesizer
 * 100% Zero-dependency, instantaneous, high-impact audio
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SoundManager = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  class SoundManager {
    constructor() {
      this.ctx = null;
      this.masterGain = null;
      this.enabled = true;
      this.lastFootstep = 0;
    }

    init() {
      if (this.ctx) return;
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      } catch (e) {
        console.warn('Web Audio API not supported', e);
      }
    }

    resume() {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    createNoiseBuffer(duration = 0.5) {
      if (!this.ctx) return null;
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      return buffer;
    }

    playGunshot(type) {
      if (!this.enabled || !this.ctx) return;
      this.resume();
      const t = this.ctx.currentTime;

      if (type === 'sniper') {
        // High supersonic crack + deep heavy sub boom
        this.playTone(180, 40, 0.45, 'sawtooth', 0.8);
        this.playNoise(0.5, 600, 0.6);
      } else if (type === 'shotgun') {
        // Heavy concussive blast
        this.playTone(120, 30, 0.35, 'triangle', 0.9);
        this.playNoise(0.4, 400, 0.8);
      } else if (type === 'smg') {
        // High rapid snappy click
        this.playTone(280, 80, 0.08, 'sawtooth', 0.4);
        this.playNoise(0.1, 1400, 0.35);
      } else if (type === 'pistol') {
        // Crisp pop
        this.playTone(240, 60, 0.12, 'square', 0.5);
        this.playNoise(0.12, 1000, 0.4);
      } else {
        // Rifle (M4A1 CQB)
        this.playTone(190, 50, 0.16, 'sawtooth', 0.65);
        this.playNoise(0.18, 800, 0.55);
      }
    }

    playTone(startFreq, endFreq, duration, type = 'sine', gainLevel = 0.5) {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = this.ctx.currentTime;

      osc.type = type;
      osc.frequency.setValueAtTime(startFreq, t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(10, endFreq), t + duration);

      gain.gain.setValueAtTime(gainLevel, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + duration);
    }

    playNoise(duration, cutoff = 800, gainLevel = 0.5) {
      if (!this.ctx) return;
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.createNoiseBuffer(duration);
      if (!noise.buffer) return;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(cutoff, this.ctx.currentTime);

      const gain = this.ctx.createGain();
      const t = this.ctx.currentTime;

      gain.gain.setValueAtTime(gainLevel, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      noise.start(t);
      noise.stop(t + duration);
    }

    playHitmarker() {
      if (!this.enabled || !this.ctx) return;
      this.resume();
      const t = this.ctx.currentTime;
      // Crisp metallic feedback click
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1600, t);
      osc.frequency.setValueAtTime(2200, t + 0.02);

      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.06);
    }

    playExplosion() {
      if (!this.enabled || !this.ctx) return;
      this.resume();
      this.playTone(90, 20, 0.9, 'triangle', 1.0);
      this.playNoise(0.9, 350, 0.9);
    }

    playReload() {
      if (!this.enabled || !this.ctx) return;
      this.resume();
      const t = this.ctx.currentTime;
      // Mechanical click-clack
      this.playTone(400, 200, 0.08, 'square', 0.25);
      setTimeout(() => {
        this.playTone(300, 600, 0.1, 'triangle', 0.3);
      }, 350);
    }

    playPickup() {
      if (!this.enabled || !this.ctx) return;
      this.resume();
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, t);
      osc.frequency.exponentialRampToValueAtTime(880, t + 0.12);

      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.15);
    }

    playFootstep() {
      if (!this.enabled || !this.ctx) return;
      const now = performance.now();
      if (now - this.lastFootstep < 280) return;
      this.lastFootstep = now;

      this.resume();
      const t = this.ctx.currentTime;
      // Soft boot tap
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(110 + Math.random() * 30, t);
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.05);

      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.05);
    }
  }

  return SoundManager;
}));
