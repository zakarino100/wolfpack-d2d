type Callback = () => void;

let _onUnauthorized: Callback | null = null;
let _firing = false;

export function setUnauthorizedHandler(cb: Callback) {
  _onUnauthorized = cb;
}

export function fireUnauthorized() {
  if (_firing) return;
  _firing = true;
  _onUnauthorized?.();
  setTimeout(() => { _firing = false; }, 5000);
}
