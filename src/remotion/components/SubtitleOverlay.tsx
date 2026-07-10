import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig, spring } from 'remotion';

interface WordTime {
  text: string;
  start: number; // relative start time in seconds
  end: number;   // relative end time in seconds
}

interface SubtitleOverlayProps {
  subtitles?: WordTime[];
  fallbackText: string;
  durationInFrames: number;
}

export const SubtitleOverlay: React.FC<SubtitleOverlayProps> = ({ subtitles, fallbackText, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;

  // --- MODO A: Subtítulos precisos palabra por palabra (con resaltado de palabra activa) ---
  if (subtitles && subtitles.length > 0) {
    // Buscar la palabra que se está pronunciando en este preciso momento
    let activeIndex = subtitles.findIndex(
      (w) => currentTime >= w.start && currentTime <= w.end
    );

    // Si no hay ninguna activa exactamente, buscar la última palabra que terminó antes del tiempo actual
    if (activeIndex === -1) {
      for (let i = subtitles.length - 1; i >= 0; i--) {
        if (currentTime >= subtitles[i].end) {
          activeIndex = i;
          break;
        }
      }
      if (activeIndex === -1) activeIndex = 0;
    }

    // Mostramos un grupo de 3-4 palabras centrado en la palabra activa
    const chunkSize = 3;
    const chunkIndex = Math.floor(activeIndex / chunkSize);
    const currentChunk = subtitles.slice(chunkIndex * chunkSize, (chunkIndex + 1) * chunkSize);

    // Animación de pop para la palabra activa
    const activeWordInChunkIndex = activeIndex % chunkSize;
    
    return (
      <div
        style={{
          position: 'absolute',
          bottom: 200,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          padding: '0 30px',
          zIndex: 10,
        }}
      >
        <div
          style={{
            fontFamily: '"Outfit", "Inter", system-ui, -apple-system, sans-serif',
            fontSize: 44,
            fontWeight: 900,
            textAlign: 'center',
            textTransform: 'uppercase',
            textShadow: '3px 3px 0px #000, -2px -2px 0px #000, 2px -2px 0px #000, -2px 2px 0px #000, 0 0 12px rgba(0,0,0,0.8)',
            letterSpacing: 1.5,
            lineHeight: 1.3,
          }}
        >
          {currentChunk.map((word, idx) => {
            const isActive = idx === activeWordInChunkIndex;
            
            return (
              <span
                key={idx}
                style={{
                  color: isActive ? '#F4E04D' : '#FFFFFF', // Amarillo premium para la palabra activa
                  display: 'inline-block',
                  margin: '0 18px',
                  transform: isActive ? 'scale(1.18)' : 'scale(1.0)',
                  transition: 'transform 0.08s ease, color 0.08s ease',
                  WebkitTextStroke: '1px rgba(0,0,0,0.3)',
                }}
              >
                {word.text}{' '}
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  // --- MODO B: Fallback (agrupamiento por tiempo uniforme) ---
  const words = fallbackText.split(' ');
  const chunkSize = 3;
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(' '));
  }

  const framesPerChunk = Math.max(10, Math.floor(durationInFrames / chunks.length));
  const currentChunkIndex = Math.min(
    Math.floor(frame / framesPerChunk),
    chunks.length - 1
  );
  const currentChunk = chunks[currentChunkIndex];
  const localFrame = frame - currentChunkIndex * framesPerChunk;

  const popScale = spring({
    frame: localFrame,
    fps,
    config: {
      damping: 14,
      mass: 0.4,
      stiffness: 200,
    },
  });

  const fadeIn = interpolate(localFrame, [0, 4], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const fadeOut = interpolate(
    localFrame,
    [framesPerChunk - 5, framesPerChunk],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const opacity = Math.min(fadeIn, fadeOut);
  const translateY = interpolate(localFrame, [0, 6], [12, 0], {
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 200,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        padding: '0 40px',
        zIndex: 10,
      }}
    >
      <span
        style={{
          fontFamily: '"Outfit", "Inter", system-ui, -apple-system, sans-serif',
          fontSize: 42,
          fontWeight: 900,
          color: '#FFFFFF',
          textTransform: 'uppercase',
          textAlign: 'center',
          textShadow:
            '3px 3px 0px #000, -2px -2px 0px #000, 2px -2px 0px #000, -2px 2px 0px #000, 0 0 12px rgba(0,0,0,0.8)',
          letterSpacing: 1.5,
          transform: `scale(${popScale}) translateY(${translateY}px)`,
          opacity,
          display: 'inline-block',
          lineHeight: 1.3,
          WebkitTextStroke: '1px rgba(0,0,0,0.3)',
        }}
      >
        {currentChunk}
      </span>
    </div>
  );
};
