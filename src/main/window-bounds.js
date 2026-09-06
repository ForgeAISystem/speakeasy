'use strict';

const MIN_WIDTH = 560;
const MIN_HEIGHT = 480;

// Restore on the same display when possible, including screens left of the
// primary one. A disconnected display must never strand the title bar.
function restoreBounds(saved, displays, primary) {
  const valid = saved && ['x', 'y', 'width', 'height'].every((key) => Number.isFinite(saved[key]))
    && saved.width > 0 && saved.height > 0;
  const overlap = (area) => valid
    ? Math.max(0, Math.min(saved.x + saved.width, area.x + area.width) - Math.max(saved.x, area.x))
      * Math.max(0, Math.min(saved.y + saved.height, area.y + area.height) - Math.max(saved.y, area.y))
    : 0;
  const display = displays.reduce((best, next) => overlap(next.workArea) > overlap(best.workArea) ? next : best, primary);
  const area = display.workArea;
  const width = Math.min(area.width, Math.max(MIN_WIDTH, valid ? Math.round(saved.width) : 980));
  const height = Math.min(area.height, Math.max(MIN_HEIGHT, valid ? Math.round(saved.height) : 680));
  const onScreen = valid && overlap(area) > 0;
  return {
    x: onScreen ? Math.round(Math.max(area.x, Math.min(saved.x, area.x + area.width - width))) : Math.round(area.x + (area.width - width) / 2),
    y: onScreen ? Math.round(Math.max(area.y, Math.min(saved.y, area.y + area.height - height))) : Math.round(area.y + (area.height - height) / 2),
    width, height
  };
}

module.exports = { MIN_WIDTH, MIN_HEIGHT, restoreBounds };
