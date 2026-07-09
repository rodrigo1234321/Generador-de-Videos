'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { ProgressTracker } from '@/components/ProgressTracker';
import { VideoPlayer } from '@/components/VideoPlayer';
import { createClient } from '@/utils/supabase/client';

export default function GeneratePage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [status, setStatus] = useState<any>('pending');
  const [video, setVideo] = useState<any>(null);
  const [scenes, setScenes] = useState<any[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    
    // Poll status initially and then run pipeline steps
    pollStatus();
  }, [id]);

  const pollStatus = async () => {
    try {
      const response = await fetch(`/api/video-status/${id}`);
      if (!response.ok) {
        throw new Error('Error al obtener estado');
      }
      const data = await response.json();
      setVideo(data.video);
      setScenes(data.scenes);
      setStatus(data.video.status);
      setErrorMessage(data.video.error_message);

      // Run next step if applicable
      runPipelineStep(data.video.status);
    } catch (err: any) {
      console.error('Error polling status:', err);
      setErrorMessage('Error de conexión con la base de datos.');
      setStatus('error');
    }
  };

  const runPipelineStep = async (currentStatus: string) => {
    try {
      if (currentStatus === 'script_generated') {
        // Trigger Audio Generation
        const response = await fetch('/api/generate-audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId: id })
        });
        if (!response.ok) throw new Error('Error al generar la locución');
        pollStatus();
      } else if (currentStatus === 'audio_generated') {
        // Trigger Image Generation
        const response = await fetch('/api/generate-images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId: id })
        });
        if (!response.ok) throw new Error('Error al generar las imágenes');
        pollStatus();
      }
    } catch (err: any) {
      console.error('Pipeline error:', err);
      // Update state to error in DB and local state
      setStatus('error');
      setErrorMessage(err.message || 'Error en el procesamiento del video.');
      
      const supabase = createClient();
      await supabase
        .from('videos')
        .update({ status: 'error', error_message: err.message || 'Error en el procesamiento' })
        .eq('id', id);
    }
  };

  const isReady = status === 'images_generated' || status === 'completed';

  return (
    <>
      <Header />
      <main className="flex-1 bg-gradient-premium flex flex-col px-4 sm:px-6 lg:px-8 py-8">
        <div className="mx-auto max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-start mt-4">
          
          {/* Left Column: Player or Loading Progress */}
          <div className="space-y-6">
            {isReady && video ? (
              <div className="space-y-6">
                <div className="text-center md:text-left space-y-2">
                  <h1 className="text-2xl font-bold font-display text-white line-clamp-2">
                    {video.script?.title || 'Video Generado'}
                  </h1>
                  <p className="text-sm text-gray-400">
                    &ldquo;{video.prompt}&rdquo;
                  </p>
                </div>
                <VideoPlayer
                  audioUrl={video.audio_url}
                  scenes={scenes.map((s: any) => ({
                    imageUrl: s.image_url || 'https://image.pollinations.ai/prompt/placeholder',
                    narrationText: s.narration,
                    durationSeconds: s.duration_seconds || 4,
                  }))}
                  durationSeconds={video.duration_seconds || 15}
                />
              </div>
            ) : (
              <div className="glass-card p-6 rounded-3xl space-y-6">
                <ProgressTracker status={status} errorMessage={errorMessage} />
              </div>
            )}
          </div>

          {/* Right Column: Guion/Story preview */}
          <div className="glass-card p-6 rounded-3xl space-y-6">
            <h2 className="text-lg font-bold font-display text-white border-b border-white/[0.06] pb-3">
              Guion del Video
            </h2>

            {video && video.script ? (
              <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2">
                <div className="p-3.5 rounded-xl bg-violet-950/15 border border-violet-500/20">
                  <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest block mb-1">Gancho (Hook)</span>
                  <p className="text-sm text-gray-200 font-medium italic">&ldquo;{video.script.hook}&rdquo;</p>
                </div>

                <div className="space-y-4">
                  {scenes.map((scene: any, idx: number) => (
                    <div key={scene.id || idx} className="flex gap-4 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                      {/* Image Preview Container */}
                      <div className="w-16 h-28 bg-[#121214] rounded-lg border border-white/[0.08] overflow-hidden flex-shrink-0 flex items-center justify-center relative">
                        {scene.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={scene.image_url}
                            alt={`Scene ${scene.scene_order}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="text-[10px] text-gray-600 font-bold">Img {scene.scene_order}</div>
                        )}
                        <span className="absolute bottom-1 right-1 bg-black/70 px-1 py-0.5 rounded text-[8px] text-gray-300 font-mono">
                          {scene.duration_seconds || 4}s
                        </span>
                      </div>
                      
                      {/* Scene Text */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-500">Escena {scene.scene_order}</span>
                        </div>
                        <p className="text-xs text-gray-200 leading-relaxed">{scene.narration}</p>
                        <p className="text-[10px] text-gray-500 italic line-clamp-2">Prompt: {scene.image_prompt}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-gray-500 gap-3">
                <svg className="animate-spin h-6 w-6 text-violet-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <p className="text-xs">Generando guion y estructura...</p>
              </div>
            )}
          </div>

        </div>
      </main>
    </>
  );
}
