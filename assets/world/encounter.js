// The first patrol waits for the key. Its clock advances only with the running world.
export const FIRST_PATROL = {warning: 10, origin: -36.5, end: 1.75, speed: 2.05, step: .68};

export function createFirstEncounter(passed = false) {
  return {phase: passed ? 'passed' : 'waiting', time: 0, sheltered: false,
    witnessed: false, nextStep: 0, shadowShown: false};
}

export function advanceFirstEncounter(state, dt, {collected, nearCabinet, sheltered, playerZ}) {
  const events = [];
  state.time += dt;
  if (state.phase === 'waiting') {
    if (!collected || !nearCabinet) return events;
    Object.assign(state, {phase: 'warning', time: 0, witnessed: false, shadowShown: false, nextStep: 0});
    events.push('warning');
  } else if (state.phase === 'warning') {
    if (!state.shadowShown && state.time >= .65) {
      state.shadowShown = true; events.push('shadow');
    }
    if (state.time >= FIRST_PATROL.warning) {
      state.phase = 'patrol'; state.time = 0;
      events.push('patrol');
    }
  }
  if (state.phase === 'warning' || state.phase === 'patrol') {
    if (sheltered !== state.sheltered) events.push(sheltered ? 'sheltered' : 'exposed');
    state.sheltered = sheltered;
  }
  if (state.phase !== 'patrol') return events;
  const z = FIRST_PATROL.origin + state.time * FIRST_PATROL.speed;
  if (sheltered && Math.abs(z - playerZ) <= 3) state.witnessed = true;
  if (state.time >= state.nextStep) {
    state.nextStep = state.time + FIRST_PATROL.step;
    events.push('step');
  }
  if (z >= FIRST_PATROL.end) {
    state.phase = state.witnessed ? 'passed' : 'waiting'; state.time = 0;
    state.sheltered = false;
    events.push(state.phase);
  }
  return events;
}
