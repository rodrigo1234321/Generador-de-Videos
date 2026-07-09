import React, { useState } from 'react';

interface PromptInputProps {
  onSubmit: (prompt: string) => void;
  isLoading: boolean;
}

const SUGGESTIONS = [
  "3 datos curiosos sobre Lionel Messi",
  "La misteriosa historia de la Atlántida",
  "¿Por qué el cielo es azul? Explicado simple",
  "Cinco hábitos mañaneros para cambiar tu vida"
];

export const PromptInput: React.FC<PromptInputProps> = ({ onSubmit, isLoading }) => {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;
    onSubmit(prompt);
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      <form onSubmit={handleSubmit} className="relative flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Escribe un tema para tu video (ej. '3 mitos sobre los dinosaurios')"
          disabled={isLoading}
          className="flex-1 px-4 py-3 rounded-xl text-base text-white placeholder-gray-500 bg-[#0f1016]/80 border border-white/[0.08] focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/30 outline-none backdrop-blur-md transition-all duration-300"
        />
        <button
          type="submit"
          disabled={isLoading || !prompt.trim()}
          className="px-6 py-3 rounded-xl font-medium bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 disabled:opacity-50 text-white shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Generando...
            </>
          ) : (
            <>
              Crear Video
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </>
          )}
        </button>
      </form>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Ideas:</span>
        {SUGGESTIONS.map((suggestion, index) => (
          <button
            key={index}
            type="button"
            disabled={isLoading}
            onClick={() => setPrompt(suggestion)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.08] hover:text-white transition-all duration-200 cursor-pointer"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
};
