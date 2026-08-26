export function haptic(type: "light" | "medium" | "heavy" | "success" = "light") {
  try {
    const v = navigator as any;
    if (!v.vibrate) return;
    const patterns: Record<string, number | number[]> = {
      light: 12,
      medium: 20,
      heavy: [20, 12, 20],
      success: [12, 30, 12],
    };
    v.vibrate(patterns[type]);
  } catch {}
}

export function useHaptic() {
  return { haptic };
}
