import React from 'react';
import { Img, interpolate, useCurrentFrame } from 'remotion';
import { SubtitleOverlay } from './SubtitleOverlay';

interface SceneProps {
  imageUrl: string;
  narrationText: string;
  durationInFrames: number;
}

export const Scene: React.FC<SceneProps> = ({ imageUrl, narrationText, durationInFrames }) => {
  const frame = useCurrentFrame();

  // Ken Burns: Slow zoom in
  const scale = interpolate(frame, [0, durationInFrames], [1.0, 1.12], {
    extrapolateRight: 'clamp',
  });

  // Fade-in at start of scene
  const opacity = interpolate(frame, [0, 8], [0, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        backgroundColor: '#121214',
        overflow: 'hidden',
        opacity,
      }}
    >
      <Img
        src={imageUrl}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${scale})`,
        }}
      />
      
      {/* Dark gradient overlay for text readability */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.7) 100%)',
          pointerEvents: 'none',
        }}
      />

      <SubtitleOverlay text={narrationText} />
    </div>
  );
};
