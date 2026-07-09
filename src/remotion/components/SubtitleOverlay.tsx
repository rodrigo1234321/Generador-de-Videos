import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';

interface SubtitleOverlayProps {
  text: string;
}

export const SubtitleOverlay: React.FC<SubtitleOverlayProps> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame,
    fps,
    config: {
      damping: 12,
      mass: 0.5,
    },
  });

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 180,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        padding: '0 50px',
        zIndex: 10,
      }}
    >
      <span
        style={{
          fontFamily: '"Outfit", "Inter", system-ui, -apple-system, sans-serif',
          fontSize: 60,
          fontWeight: 900,
          color: '#F4E04D', // Premium yellow
          textTransform: 'uppercase',
          textAlign: 'center',
          textShadow: '5px 5px 0px #000000, -2px -2px 0px #000000, 2px -2px 0px #000000, -2px 2px 0px #000000',
          letterSpacing: 1,
          transform: `scale(${scale})`,
          display: 'inline-block',
          lineHeight: 1.2,
        }}
      >
        {text}
      </span>
    </div>
  );
};
