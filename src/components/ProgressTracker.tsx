import React from 'react';

type VideoStatus = 'pending' | 'script_generated' | 'audio_generated' | 'images_generated' | 'completed' | 'error';

interface ProgressTrackerProps {
  status: VideoStatus;
  errorMessage?: string | null;
}

const STEPS = [
  { key: 'script', label: 'Escribiendo Guion con IA', desc: 'Gemini redacta las escenas y diseña los prompts de imágenes' },
  { key: 'audio', label: 'Sintetizando Voz Neural', desc: 'Generando la narración de voz en off realista en español' },
  { key: 'images', label: 'Creando Escenas Visuales', desc: 'Descargando imágenes de alta resolución (1080x1920) de Flux' },
  { key: 'ready', label: 'Video Listo', desc: 'Ensamblando y reproduciendo el video vertical en tiempo real' }
];

export const ProgressTracker: React.FC<ProgressTrackerProps> = ({ status, errorMessage }) => {
  const getStepState = (stepKey: string) => {
    if (status === 'error') return 'error';

    switch (stepKey) {
      case 'script':
        if (status === 'pending') return 'active';
        return 'completed';
      case 'audio':
        if (status === 'script_generated') return 'active';
        if (status === 'pending') return 'upcoming';
        return 'completed';
      case 'images':
        if (status === 'audio_generated') return 'active';
        if (status === 'pending' || status === 'script_generated') return 'upcoming';
        return 'completed';
      case 'ready':
        if (status === 'images_generated' || status === 'completed') return 'completed';
        return 'upcoming';
      default:
        return 'upcoming';
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-bold font-display text-white">Generando tu Video</h3>
        <p className="text-sm text-gray-400 mt-1">Esto puede demorar de 20 a 40 segundos, por favor no cierres la ventana</p>
      </div>

      <div className="space-y-4">
        {STEPS.map((step, index) => {
          const state = getStepState(step.key);

          return (
            <div
              key={step.key}
              className={`p-4 rounded-2xl border transition-all duration-300 ${
                state === 'active'
                  ? 'bg-violet-950/10 border-violet-500/30 glow-purple'
                  : state === 'completed'
                  ? 'bg-white/[0.01] border-white/[0.04] opacity-80'
                  : state === 'error'
                  ? 'bg-rose-950/10 border-rose-500/30'
                  : 'bg-transparent border-white/[0.02] opacity-40'
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Icon Column */}
                <div className="mt-0.5">
                  {state === 'completed' && (
                    <div className="h-6 w-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                      <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                  {state === 'active' && (
                    <div className="h-6 w-6 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center border border-violet-500/30 pulse-glow-cyan">
                      <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    </div>
                  )}
                  {state === 'upcoming' && (
                    <div className="h-6 w-6 rounded-full bg-white/[0.03] text-gray-500 flex items-center justify-center border border-white/[0.05]">
                      <span className="text-xs font-bold">{index + 1}</span>
                    </div>
                  )}
                  {state === 'error' && (
                    <div className="h-6 w-6 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
                      <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Content Column */}
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className={`font-semibold text-sm ${state === 'active' ? 'text-violet-400' : 'text-white'}`}>
                      {step.label}
                    </h4>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{step.desc}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {status === 'error' && (
        <div className="p-4 rounded-xl bg-rose-950/10 border border-rose-500/20 text-center">
          <p className="text-sm font-semibold text-rose-400">Hubo un error al generar el video</p>
          <p className="text-xs text-rose-500 mt-1">{errorMessage || 'Error desconocido'}</p>
        </div>
      )}
    </div>
  );
};
