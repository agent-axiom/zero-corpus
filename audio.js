// The ventilation drone and recorder sounds are synthesised locally.
export function createAudio() {
  let ctx, master, drone;
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
  return {
    unlock,
    settings(on, level) { enabled = on; volume = level; apply(); },
    inWorld(on) { inWorld = on; apply(); },
    pickup() { tone(620, .13, .07, 'sine', 930); },
    signal() { tone(275, .32, .09, 'triangle', 345); },
    threat() { tone(67, 1.5, .35, 'sawtooth', 43); },
    step() {
      const t = performance.now();
      if (t - lastStep < 430) return;
      lastStep = t; tone(96 + Math.random() * 15, .11, .15, 'triangle', 36);
    }
  };
}
