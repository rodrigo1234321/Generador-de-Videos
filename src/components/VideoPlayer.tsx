'use client';

import React from 'react';
import { Player } from '@remotion/player';
import { VideoComposition, SceneData } from '@/remotion/VideoComposition';

interface VideoPlayerProps {
  audioUrl: string;
  scenes: SceneData[];
  durationSeconds: number;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ audioUrl, scenes, durationSeconds }) => {
  const fps = 30;
  const durationInFrames = Math.max(30, Math.round(durationSeconds * fps));

  return (
    <div className="w-full flex flex-col items-center gap-6">
      <div className="relative aspect-[9/16] w-full max-w-[360px] rounded-3xl overflow-hidden shadow-2xl border border-white/[0.08] bg-black glow-purple">
        <Player
          component={VideoComposition}
          inputProps={{
            audioUrl,
            scenes,
          }}
          durationInFrames={durationInFrames}
          fps={fps}
          compositionWidth={1080}
          compositionHeight={1920}
          style={{
            width: '100%',
            height: '100%',
          }}
          controls
          loop
        />
      </div>
      <p className="text-xs text-gray-500 text-center">
        Usa los controles del reproductor para reproducir, pausar y ajustar el volumen.
      </p>
    </div>
  );
};
