import React from 'react';

export default function PomodoroTimer({
  duration,
  remaining,
  color,
  isBreak = false,
  isPaused = false,
}) {
  const size = 200;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const totalSeconds = duration * 60;
  const progress = totalSeconds > 0 ? (totalSeconds - remaining) / totalSeconds : 0;
  const dashOffset = circumference * (1 - progress);

  const displayMinutes = Math.floor(remaining / 60);
  const displaySeconds = remaining % 60;
  const timeText = `${displayMinutes}:${displaySeconds.toString().padStart(2, '0')}`;

  return (
    <div className={`pomodoro-timer ${isBreak ? 'break' : ''} ${isPaused ? 'paused' : ''}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="pomodoro-timer-svg">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
        />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color || '#3498DB'}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{
            transform: 'rotate(-90deg)',
            transformOrigin: '50% 50%',
            transition: 'stroke-dashoffset 1s linear',
          }}
        />
        {/* Glow filter effect */}
        <defs>
          <filter id="timer-glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>
      <div className="pomodoro-timer-center">
        <span className="pomodoro-timer-time">{timeText}</span>
        <span className="pomodoro-timer-label">
          {isBreak ? 'Break' : isPaused ? 'Paused' : 'Focus'}
        </span>
      </div>
    </div>
  );
}
