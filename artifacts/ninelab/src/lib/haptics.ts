// Subtle haptic feedback for touch interactions (Android Chrome; iOS Safari
// has no vibration API and ignores this silently). One helper so the app has
// ONE haptic vocabulary — a 10ms tick for taps, a short double for success.
// Never call in loops or on scroll; haptics are punctuation, not texture.

export function haptic(pattern: number | number[] = 10): void {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    /* some webviews throw on vibrate — never let feedback break a tap */
  }
}

/** Tap acknowledgement — cards, chips, sheet opens. */
export const hapticTap = () => haptic(10);

/** Success beat — gate completed, quiz passed, certificate issued. */
export const hapticSuccess = () => haptic([12, 40, 18]);
