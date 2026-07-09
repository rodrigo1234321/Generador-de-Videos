import React from 'react';
import { Composition } from 'remotion';
import { VideoComposition } from './VideoComposition';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="vertical-video"
        component={VideoComposition as any}
        durationInFrames={900} // Default duration, overwritten by inputProps
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          audioUrl: '',
          scenes: [] as any[],
        }}
      />
    </>
  );
};
