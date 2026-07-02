'use client';

import { useEffect, useState } from 'react';

/**
 * Counts down to an absolute `expiresAt` timestamp coming from the server,
 * not a client-side "5:00 minus elapsed" timer. This matters under bad
 * network conditions: if the hold request took 3s to round-trip, or the
 * tab was backgrounded and throttled, a locally-started timer would drift
 * and show the wrong time. Re-deriving from `expiresAt` every tick keeps
 * the displayed countdown accurate even after lag or a tab being backgrounded.
 */
export function Countdown({
  expiresAt,
  onExpire,
}: {
  expiresAt: string;
  onExpire?: () => void;
}) {
  const [remainingMs, setRemainingMs] = useState(() => new Date(expiresAt).getTime() - Date.now());
  const [firedExpire, setFiredExpire] = useState(false);

  useEffect(() => {
    const tick = () => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      setRemainingMs(ms);
      if (ms <= 0 && !firedExpire) {
        setFiredExpire(true);
        onExpire?.();
      }
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt]);

  const clamped = Math.max(0, remainingMs);
  const totalSeconds = Math.floor(clamped / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const isUrgent = clamped < 60_000;

  return (
    <div className="flex items-center gap-3">
      <div
        className={`font-mono text-4xl tracking-widest tabular-nums ${
          isUrgent ? 'text-coral' : 'text-amber'
        }`}
      >
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </div>
      <div className="text-xs uppercase tracking-[0.2em] text-mist/70">
        {clamped > 0 ? 'thời gian giữ vé còn lại' : 'đã hết thời gian giữ vé'}
      </div>
    </div>
  );
}
