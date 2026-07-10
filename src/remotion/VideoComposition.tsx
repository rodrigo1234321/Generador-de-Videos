import React from 'react';
import { Audio, Series } from 'remotion';
import { Scene } from './components/Scene';

export interface SceneData {
  imageUrl: string;
  narrationText: string;
  durationSeconds: number;
  subtitles?: Array<{ text: string; start: number; end: number }>;
}

interface VideoCompositionProps {
  audioUrl: string;
  scenes: SceneData[];
}

export const VideoComposition: React.FC<VideoCompositionProps> = ({ audioUrl, scenes = [] }) => {
  const fps = 30;

  return (
    <div style={{ flex: 1, backgroundColor: '#000', width: '100%', height: '100%', position: 'relative' }}>
      {audioUrl && <Audio src={audioUrl} />}
      
      <Series>
        {scenes.map((scene, index) => {
          const durationInFrames = Math.max(15, Math.round(scene.durationSeconds * fps));
          return (
            <Series.Sequence key={index} durationInFrames={durationInFrames}>
              <Scene
                imageUrl={scene.imageUrl}
                narrationText={scene.narrationText}
                durationInFrames={durationInFrames}
                subtitles={scene.subtitles}
              />
            </Series.Sequence>
          );
        })}
      </Series>
    </div>
  );
};
