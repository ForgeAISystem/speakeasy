'use strict';

// Lowest-energy 200 ms window between two sample offsets: the safest place to
// cut speech without splitting a word.
function quietestPoint(samples, from, to, rate) {
  const win = Math.floor(0.2 * rate);
  let best = to;
  let bestEnergy = Infinity;
  for (let i = from; i + win < to; i += win) {
    let e = 0;
    for (let j = i; j < i + win; j++) e += samples[j] * samples[j];
    if (e < bestEnergy) { bestEnergy = e; best = i + Math.floor(win / 2); }
  }
  return best;
}

module.exports = { quietestPoint };
