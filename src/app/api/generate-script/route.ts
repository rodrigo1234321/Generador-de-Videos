import { NextResponse } from 'next/server';
import { ai } from '@/lib/gemini';
import { createClient } from '@/utils/supabase/server';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Schema de validación (única fuente de verdad para la forma del guion)
// ---------------------------------------------------------------------------
const SceneSchema = z.object({
  narration: z.string().min(1),
  imagePrompt: z.string().min(1),
  durationSeconds: z.number().positive(),
  subtitleText: z.string().min(1),
  stockQuery: z.string().min(1),
});

const VideoScriptSchema = z.object({
  title: z.string().min(1),
  hook: z.string().min(1),
  scenes: z.array(SceneSchema).min(1),
  totalDurationSeconds: z.number().positive(),
  hashtags: z.array(z.string()),
});

type VideoScript = z.infer<typeof VideoScriptSchema>;

const GEMINI_MODEL = 'gemini-2.5-flash';

// El schema que espera la API de Google GenAI usa su propio formato (mayúsculas),
// distinto al de JSON Schema estándar, por eso se define a mano. Se mantiene
// alineado con SceneSchema/VideoScriptSchema de arriba: si cambian los campos,
// hay que actualizar ambos.
const GEMINI_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING', description: 'Título del video en español' },
    hook: { type: 'STRING', description: 'Gancho inicial fuerte de 2-3 segundos en español' },
    scenes: {
      type: 'ARRAY',
      description: 'Lista de escenas que componen el video',
      items: {
        type: 'OBJECT',
        properties: {
          narration: { type: 'STRING', description: 'Narración de esta escena en español' },
          imagePrompt: {
            type: 'STRING',
            description: 'Visual image prompt in English for Flux image generation (highly detailed, cinematic, etc.)',
          },
          durationSeconds: { type: 'NUMBER', description: 'Duración de esta escena en segundos (entre 3 y 6)' },
          subtitleText: { type: 'STRING', description: 'Texto del subtítulo exacto para esta escena en español' },
          stockQuery: { type: 'STRING', description: 'Very simple 2-3 words English search query for finding general matching stock photos on Pexels (e.g. "soccer boy", "writing napkin", "ancient Greece map", "crowded stadium", "ocean sunset"). Do not use celebrity names like Messi, use general terms like soccer player.' },
        },
        required: ['narration', 'imagePrompt', 'durationSeconds', 'subtitleText', 'stockQuery'],
      },
    },
    totalDurationSeconds: { type: 'NUMBER', description: 'Duración total del video sumando todas las escenas' },
    hashtags: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
  },
  required: ['title', 'hook', 'scenes', 'totalDurationSeconds', 'hashtags'],
} as const;

const SYSTEM_INSTRUCTION = `
  Eres un director creativo experto en videos de formato corto (TikTok, Reels, Shorts).
  Genera un guion estructurado y dinámico basado en el tema proporcionado por el usuario.
  El guion debe estar optimizado para retención de audiencia:
  - Debe incluir un "hook" inicial fuerte de 2-3 segundos.
  - La primera escena DEBE actuar como la introducción y gancho del video. Debe comenzar explicando de forma breve, concisa y atractiva de qué trata el video, dando un contexto inicial para situar a la audiencia antes de entrar en los detalles históricos o técnicos.
  - Debe estar dividido en escenas cortas (entre 3 y 6 segundos cada una).
  - La duración total recomendada debe rondar entre 15 y 45 segundos totales.
  - Para cada escena, escribe una narración atractiva en español y un prompt muy descriptivo y visual para generar una imagen en inglés (los generadores de imágenes funcionan mejor en inglés, ej: '3D Pixar style illustration of...').
  - Para cada escena, proporciona una consulta de búsqueda de stock simple en inglés ("stockQuery") de 2 a 3 palabras para encontrar fotos relevantes en bibliotecas públicas (como Pexels). Evita nombres propios específicos de celebridades como 'Messi' en stockQuery (usa 'soccer player' o 'argentina football').
  - Mantén el tono enérgico y entretenido.
`;

/** Llama a Gemini y devuelve el guion ya parseado y validado. */
async function generateValidatedScript(prompt: string): Promise<VideoScript> {
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: `Tema del video: ${prompt}`,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseSchema: GEMINI_RESPONSE_SCHEMA as any,
    },
  });

  if (!response.text) {
    throw new Error('No se recibió respuesta de Gemini');
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log('--- GEMINI RAW RESPONSE ---', response.text);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(response.text);
  } catch {
    throw new Error('Gemini devolvió un JSON inválido');
  }

  const result = VideoScriptSchema.safeParse(parsed);
  if (!result.success) {
    console.error('Guion generado no cumple el schema esperado:', result.error.flatten());
    throw new Error('El guion generado no tiene el formato esperado');
  }

  return result.data;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  let videoId: string | undefined;

  try {
    const { prompt } = await request.json();
    if (!prompt) {
      return NextResponse.json({ error: 'El prompt es requerido' }, { status: 400 });
    }

    // 1. Crear registro inicial en la base de datos
    const { data: video, error: createError } = await supabase
      .from('videos')
      .insert({ prompt, status: 'pending' })
      .select()
      .single();

    if (createError || !video) {
      console.error('Error creando video en db:', createError);
      return NextResponse.json({ error: 'Error al registrar el video en la base de datos' }, { status: 500 });
    }
    videoId = video.id;

    // 2. Generar y validar el guion estructurado
    let scriptData: VideoScript;
    try {
      scriptData = await generateValidatedScript(prompt);
    } catch (genError: any) {
      await supabase
        .from('videos')
        .update({ status: 'error', error_message: genError.message })
        .eq('id', videoId);
      return NextResponse.json({ error: genError.message || 'Error al generar el guion' }, { status: 422 });
    }

    // 3. Insertar las escenas en la tabla de escenas
    const scenesToInsert = scriptData.scenes.map((scene, index) => ({
      video_id: videoId,
      scene_order: index + 1,
      narration: scene.narration,
      image_prompt: scene.imagePrompt,
      duration_seconds: scene.durationSeconds,
    }));

    const { error: scenesError } = await supabase.from('scenes').insert(scenesToInsert);

    if (scenesError) {
      console.error('Error insertando escenas:', scenesError);
      await supabase
        .from('videos')
        .update({ status: 'error', error_message: 'Error al guardar las escenas' })
        .eq('id', videoId);
      return NextResponse.json({ error: 'Error al guardar las escenas del video' }, { status: 500 });
    }

    // 4. Actualizar el video con el guion generado y cambiar estado
    const { error: updateError } = await supabase
      .from('videos')
      .update({
        script: scriptData,
        duration_seconds: scriptData.totalDurationSeconds,
        status: 'script_generated',
      })
      .eq('id', videoId);

    if (updateError) {
      console.error('Error actualizando video:', updateError);
      await supabase
        .from('videos')
        .update({ status: 'error', error_message: 'Error al actualizar el video con el guion final' })
        .eq('id', videoId);
      return NextResponse.json({ error: 'Error al actualizar el estado del video' }, { status: 500 });
    }

    return NextResponse.json({ success: true, videoId, script: scriptData });
  } catch (err: any) {
    console.error('Error en /api/generate-script:', err);
    if (videoId) {
      await supabase
        .from('videos')
        .update({ status: 'error', error_message: err.message || 'Error interno' })
        .eq('id', videoId);
    }
    return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 });
  }
}
