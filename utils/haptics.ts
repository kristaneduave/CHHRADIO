export const triggerHaptic = (style: 'light' | 'medium' | 'heavy' = 'light') => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
        switch (style) {
            case 'light':
                navigator.vibrate(10); // Very subtle tap
                break;
            case 'medium':
                navigator.vibrate(25); // Standard tap
                break;
            case 'heavy':
                navigator.vibrate(50); // Emphasized response
                break;
            default:
                navigator.vibrate(10);
        }
    }
};
