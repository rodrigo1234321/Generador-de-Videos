'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { PromptInput } from '@/components/PromptInput';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';

export default function HomePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [recentVideos, setRecentVideos] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRecentVideos();
  }, []);

  const fetchRecentVideos = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(6);

      if (error) throw error;
      setRecentVideos(data || []);
    } catch (err) {
      console.error('Error cargando videos recientes:', err);
    }
  };

  const handleGenerate = async (prompt: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/generate-script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Error al iniciar la generación');
      }

      // Redirigir a la pagina de progreso
      router.push(`/generate/${data.videoId}`);
    } catch (err: any) {
      console.error('Error generando video:', err);
      setError(err.message || 'Ocurrió un error inesperado');
      setIsLoading(false);
    }
  };

  return (
    <>
      <Header />
      <main className="flex-1 bg-gradient-premium flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
        <div className="w-full max-w-4xl text-center space-y-6 mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-cyan-400 bg-cyan-950/30 border border-cyan-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            100% Gratis e Ilimitado
          </div>
          <h1 className="font-display text-4xl sm:text-6xl font-black tracking-tight text-white leading-[1.1]">
            Crea Videos Verticales <br />
            <span className="text-gradient">con Inteligencia Artificial</span>
          </h1>
          <p className="text-base sm:text-lg text-gray-400 max-w-xl mx-auto">
            Generá guion, locución y escenas visuales automatizadas estilo TikTok, Reels o Shorts a partir de una sola idea.
          </p>
        </div>

        <PromptInput onSubmit={handleGenerate} isLoading={isLoading} />

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-rose-950/20 border border-rose-500/30 text-rose-400 text-sm max-w-md text-center">
            {error}
          </div>
        )}

        {/* Recent Videos Historial */}
        <div className="w-full max-w-4xl mt-20 space-y-6">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
            <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
              </svg>
              Creaciones Recientes
            </h2>
          </div>

          {recentVideos.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">No hay creaciones previas todavía. ¡Crea el primer video arriba!</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {recentVideos.map((video) => (
                <Link
                  key={video.id}
                  href={`/generate/${video.id}`}
                  className="group p-5 rounded-2xl glass-card hover:bg-white/[0.02] border border-white/[0.04] hover:border-violet-500/20 transition-all duration-300 flex flex-col justify-between h-40"
                >
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-white line-clamp-2 group-hover:text-violet-400 transition-colors duration-200">
                      &ldquo;{video.prompt}&rdquo;
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(video.created_at).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        video.status === 'completed' || video.status === 'images_generated'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : video.status === 'error'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                      }`}
                    >
                      {video.status === 'completed' || video.status === 'images_generated'
                        ? 'Listo'
                        : video.status === 'error'
                        ? 'Error'
                        : 'Generando'}
                    </span>

                    <span className="text-xs text-violet-400 group-hover:translate-x-1 transition-transform duration-300 flex items-center gap-1">
                      Ver video &rarr;
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
