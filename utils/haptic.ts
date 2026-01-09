// Haptic Feedback Utility for Mobile Devices

export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

/**
 * Triggers haptic feedback on supported devices
 * @param type - The type of haptic feedback to trigger
 */
export const triggerHaptic = (type: HapticType = 'light'): void => {
  // Check if vibration API is supported
  if (!('vibrate' in navigator)) {
    return;
  }

  const patterns: Record<HapticType, number | number[]> = {
    light: 10,
    medium: 20,
    heavy: 30,
    success: [10, 50, 10],
    warning: [20, 100, 20],
    error: [30, 100, 30, 100, 30],
  };

  try {
    navigator.vibrate(patterns[type]);
  } catch (error) {
    console.warn('Haptic feedback not supported:', error);
  }
};

/**
 * Triggers haptic feedback on button press
 */
export const hapticButtonPress = (): void => {
  triggerHaptic('light');
};

/**
 * Triggers haptic feedback on successful action
 */
export const hapticSuccess = (): void => {
  triggerHaptic('success');
};

/**
 * Triggers haptic feedback on error
 */
export const hapticError = (): void => {
  triggerHaptic('error');
};

/**
 * Triggers haptic feedback on warning
 */
export const hapticWarning = (): void => {
  triggerHaptic('warning');
};

/**
 * Custom hook for haptic feedback
 */
export const useHaptic = () => {
  return {
    light: () => triggerHaptic('light'),
    medium: () => triggerHaptic('medium'),
    heavy: () => triggerHaptic('heavy'),
    success: hapticSuccess,
    warning: hapticWarning,
    error: hapticError,
  };
};
