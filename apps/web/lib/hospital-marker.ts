/** Shared inventory symbol. Pulse is cosmetic and never encodes live status. */
export function hospitalMarker(name: string, selected: boolean, reducedMotion = false): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'map-marker sw-hospital-pin';
  button.dataset.selected = String(selected);
  button.dataset.reducedMotion = String(reducedMotion);
  button.setAttribute('aria-label', `${name}, provisional point, unverified entrance`);
  button.setAttribute('aria-pressed', String(selected));
  const symbol = document.createElement('span');
  symbol.className = 'sw-hospital-pin-symbol'; symbol.setAttribute('aria-hidden', 'true');
  const image = document.createElement('img');
  image.src = '/brand/hospital-pin.svg'; image.alt = ''; image.width = 28; image.height = 34; image.draggable = false;
  symbol.append(image); button.append(symbol);
  const label = document.createElement('span');
  label.className = 'sw-hospital-pin-label'; label.textContent = `${name} · Provisional point`;
  label.setAttribute('aria-hidden', 'true'); button.append(label);
  return button;
}
