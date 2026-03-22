export function track(
  event: string,
  properties?: Record<string, string | number | boolean>
): void {
  if (typeof window === 'undefined') return;
  const posthog = (window as unknown as { posthog?: { capture: (e: string, p?: Record<string, unknown>) => void } }).posthog;
  if (posthog) {
    posthog.capture(event, properties as Record<string, unknown>);
  }
}
