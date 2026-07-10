import React from 'react';
import { Composition } from 'remotion';
import { VideoComposition } from './VideoComposition';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="vertical-video"
        component={VideoComposition as any}
        fps={30}
        width={1080}
        height={1920}
        calculateMetadata={({ inputProps }: { inputProps: any }) => {
          const durationSeconds = inputProps?.durationSeconds || 30;
          return {
            durationInFrames: Math.ceil(durationSeconds * 30),
            props: inputProps || {},
          };
        }}
        defaultProps={{
          audioUrl: '',
          scenes: [] as any[],
          durationSeconds: 30,
        }}
      />
    </>
  );
};
