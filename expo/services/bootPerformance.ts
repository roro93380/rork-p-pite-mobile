const bootEpoch = typeof performance !== 'undefined' && typeof performance.now === 'function'
  ? performance.now()
  : Date.now();

const marks = new Map<string, number>();

function now() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

export function resetBootTrace(label = 'boot:start') {
  if (!__DEV__) {
    return;
  }

  marks.clear();
  marks.set(label, now());
  console.log(`[Boot] ${label} +0ms`);
}

export function markBootTrace(label: string) {
  if (!__DEV__) {
    return;
  }

  const timestamp = now();
  marks.set(label, timestamp);
  console.log(`[Boot] ${label} +${Math.round(timestamp - bootEpoch)}ms`);
}

export function measureBootStep(label: string, sinceLabel?: string) {
  if (!__DEV__) {
    return;
  }

  const timestamp = now();
  const since = sinceLabel ? marks.get(sinceLabel) ?? bootEpoch : bootEpoch;
  console.log(`[Boot] ${label} ${Math.round(timestamp - since)}ms`);
  marks.set(label, timestamp);
}