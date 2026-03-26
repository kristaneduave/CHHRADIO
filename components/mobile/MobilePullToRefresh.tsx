import React, { useContext, useMemo, useRef, useState } from 'react';
import { LayoutScrollContext } from '../Layout';
import { useAppViewport } from '../responsive/useViewport';
import { triggerHaptic } from '../../utils/haptics';
import { PULL_TO_REFRESH_MAX_PULL_PX, PULL_TO_REFRESH_TRIGGER_PX } from '../../utils/mobileGestures';

interface MobilePullToRefreshProps {
  children: React.ReactNode;
  onRefresh: () => Promise<void> | void;
  disabled?: boolean;
  className?: string;
  indicatorLabel?: string;
}

const clampPullDistance = (distance: number) => {
  if (distance <= 0) return 0;
  const damped = distance * 0.55;
  return Math.min(PULL_TO_REFRESH_MAX_PULL_PX, damped);
};

const MobilePullToRefresh: React.FC<MobilePullToRefreshProps> = ({
  children,
  onRefresh,
  disabled = false,
  className = '',
  indicatorLabel = 'Pull to refresh',
}) => {
  const viewport = useAppViewport();
  const scrollContainer = useContext(LayoutScrollContext);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef<number | null>(null);
  const isTrackingRef = useRef(false);
  const hapticTriggeredRef = useRef(false);

  const isEnabled = viewport !== 'desktop' && !disabled;
  const progress = Math.min(1, pullDistance / PULL_TO_REFRESH_TRIGGER_PX);
  const indicatorText = useMemo(() => {
    if (refreshing) return 'Refreshing...';
    if (pullDistance >= PULL_TO_REFRESH_TRIGGER_PX) return 'Release to refresh';
    return indicatorLabel;
  }, [indicatorLabel, pullDistance, refreshing]);

  const resetGesture = () => {
    startYRef.current = null;
    isTrackingRef.current = false;
    hapticTriggeredRef.current = false;
    setPullDistance(0);
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!isEnabled || refreshing || event.touches.length !== 1) {
      resetGesture();
      return;
    }

    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, [contenteditable="true"]')) {
      resetGesture();
      return;
    }

    if ((scrollContainer?.scrollTop || 0) > 0) {
      resetGesture();
      return;
    }

    startYRef.current = event.touches[0].clientY;
    isTrackingRef.current = true;
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!isEnabled || refreshing || !isTrackingRef.current || event.touches.length !== 1) {
      return;
    }

    const startY = startYRef.current;
    if (startY === null) return;

    if ((scrollContainer?.scrollTop || 0) > 0) {
      resetGesture();
      return;
    }

    const deltaY = event.touches[0].clientY - startY;
    if (deltaY <= 0) {
      setPullDistance(0);
      return;
    }

    const nextDistance = clampPullDistance(deltaY);
    setPullDistance(nextDistance);

    if (nextDistance >= PULL_TO_REFRESH_TRIGGER_PX && !hapticTriggeredRef.current) {
      triggerHaptic('medium');
      hapticTriggeredRef.current = true;
    }
  };

  const handleTouchEnd = async () => {
    if (!isEnabled || refreshing) {
      resetGesture();
      return;
    }

    const shouldRefresh = isTrackingRef.current && pullDistance >= PULL_TO_REFRESH_TRIGGER_PX;
    resetGesture();

    if (!shouldRefresh) {
      return;
    }

    try {
      setRefreshing(true);
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div
      className={`relative ${className}`.trim()}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center overflow-hidden"
        style={{
          height: `${Math.max(pullDistance, refreshing ? 48 : 0)}px`,
          opacity: pullDistance > 0 || refreshing ? 1 : 0,
        }}
      >
        <div className="mt-2 flex flex-col items-center gap-1.5">
          <div className="relative h-4 w-10">
            <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-white/10" />
            <div
              className={`absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-200/35 bg-cyan-100/90 shadow-[0_0_14px_rgba(165,243,252,0.25)] transition-transform duration-200 ${refreshing ? 'animate-pulse' : ''}`}
              style={{
                transform: `translate(-50%, -50%) scale(${refreshing ? 1.1 : 0.65 + (progress * 0.5)})`,
              }}
            />
          </div>
          <div
            className="h-px rounded-full bg-cyan-200/70 transition-all duration-150"
            style={{ width: `${refreshing ? 40 : 10 + (progress * 30)}px` }}
          />
          <span className="text-[10px] font-medium tracking-[0.12em] text-slate-400">
            {indicatorText}
          </span>
        </div>
      </div>

      <div
        className="transition-transform duration-200 ease-out"
        style={{ transform: `translateY(${refreshing ? 42 : pullDistance}px)` }}
      >
        {children}
      </div>
    </div>
  );
};

export default MobilePullToRefresh;
