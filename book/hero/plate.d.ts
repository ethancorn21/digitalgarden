// Types for plate.js, which stays plain JS (it is the garden-footer lab's plates.js cut down).
export function mountPlate(
  cv: HTMLCanvasElement,
  data: unknown,
  o?: { t?: number; hold?: boolean; ready?: () => void },
): void
