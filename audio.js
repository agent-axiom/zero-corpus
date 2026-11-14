// The ventilation drone and recorder sounds are synthesised locally.
export function createAudio() {
  let ctx, master, drone, footNoise;
  let enabled = true, volume = .55, inWorld = false, lastStep = 0;

  function apply() {
    if (!ctx) return;
    master.gain.setTargetAtTime(enabled ? volume * .6 : 0, ctx.currentTime, .055);
    drone.gain.setTargetAtTime(inWorld ? .125 : .018, ctx.currentTime, .4);
  }
  function unlock() {
    if (!enabled) return;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    if (!ctx) {
      ctx = new Audio();
      master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
      drone = ctx.createGain(); drone.gain.value = 0; drone.connect(master);
      for (const hz of [49.8, 50.4, 99.9]) {
        const motor = ctx.createOscillator();
        motor.type = 'sine'; motor.frequency.value = hz;
        motor.connect(drone); motor.start();
      }
      apply();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  }
  function tone(hz, duration, gain = .12, type = 'sine', endHz = hz) {
    if (!enabled || !ctx || ctx.state !== 'running') return;
    const time = ctx.currentTime;
    const oscillator = ctx.createOscillator(), envelope = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(hz, time);
    oscillator.frequency.exponentialRampToValueAtTime(endHz, time + duration);
    envelope.gain.setValueAtTime(.0001, time);
    envelope.gain.exponentialRampToValueAtTime(gain, time + .015);
    envelope.gain.exponentialRampToValueAtTime(.0001, time + duration);
    oscillator.connect(envelope); envelope.connect(master);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
    oscillator.start(); oscillator.stop(time + duration);
  }
  function phoneRing(pan, distance) {
    if (!enabled || !inWorld || !ctx || ctx.state !== 'running') return;
    const position = ctx.createStereoPanner?.();
    if (position) {
      position.pan.value = Math.max(-1, Math.min(1, pan));
      position.connect(master);
    }
    const start = ctx.currentTime;
    const level = .18 / (1 + Math.max(0, distance) * .08);
    // One bell burst. The clapper alternately strikes two metal cups.
    const bells = [1035, 1470];
    let sounding = bells.length;
    bells.forEach((hz, side) => {
      const bell = ctx.createOscillator(), envelope = ctx.createGain();
      bell.type = 'triangle'; bell.frequency.value = hz;
      bell.connect(envelope); envelope.connect(position || master);
      envelope.gain.value = .0001;
      for (let hit = 0; hit < 5; hit++) {
        const at = start + hit * .13 + side * .065;
        envelope.gain.setValueAtTime(.0001, at);
        envelope.gain.exponentialRampToValueAtTime(level, at + .004);
        envelope.gain.exponentialRampToValueAtTime(.0001, at + .126);
      }
      bell.onended = () => {
        bell.disconnect(); envelope.disconnect();
        if (--sounding === 0) position?.disconnect();
      };
      bell.start(start); bell.stop(start + .74);
    });
  }
  function watcherStep(pan, distance) {
    if (!enabled || !inWorld || !ctx || ctx.state !== 'running') return;
    if (!footNoise) {
      footNoise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .19), ctx.sampleRate);
      const samples = footNoise.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    }
    const at = ctx.currentTime, level = .38 / (1 + distance * distance * .025);
    const position = ctx.createStereoPanner?.(), envelope = ctx.createGain();
    if (position) {
      position.pan.value = Math.max(-1, Math.min(1, pan));
      envelope.connect(position); position.connect(master);
    } else envelope.connect(master);
    envelope.gain.setValueAtTime(.0001, at);
    envelope.gain.exponentialRampToValueAtTime(level, at + .008);
    envelope.gain.exponentialRampToValueAtTime(.0001, at + .27);
    const impact = ctx.createOscillator();
    impact.frequency.setValueAtTime(87, at);
    impact.frequency.exponentialRampToValueAtTime(31, at + .21);
    impact.connect(envelope);
    const scrape = ctx.createBufferSource(), filter = ctx.createBiquadFilter();
    scrape.buffer = footNoise;
    filter.type = 'lowpass'; filter.frequency.value = 530; filter.Q.value = .5;
    scrape.connect(filter); filter.connect(envelope);
    scrape.onended = () => { scrape.disconnect(); filter.disconnect(); };
    impact.onended = () => { impact.disconnect(); envelope.disconnect(); position?.disconnect(); };
    impact.start(at); impact.stop(at + .28); scrape.start(at);
  }
  return {
    unlock, phoneRing, watcherStep,
    settings(on, level) { enabled = on; volume = level; apply(); },
    inWorld(on) { inWorld = on; apply(); },
    pickup() { tone(620, .13, .07, 'sine', 930); },
    turnstile() { tone(165, .17, .17, 'sawtooth', 48); tone(330, .09, .07, 'triangle', 83); },
    relay() { tone(1400, .028, .07, 'triangle', 360); tone(125, .13, .1, 'triangle', 45); },
    signal() { tone(275, .32, .09, 'triangle', 345); },
    threat() { tone(67, 1.5, .35, 'sawtooth', 43); },
    step() {
      const t = performance.now();
      if (t - lastStep < 430) return;
      lastStep = t; tone(96 + Math.random() * 15, .11, .15, 'triangle', 36);
    }
  };
}
