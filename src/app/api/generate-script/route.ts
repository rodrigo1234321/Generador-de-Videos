import { NextResponse } from 'next/server';
import { ai } from '@/lib/gemini';
import { createClient } from '@/utils/supabase/server';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

const VideoScriptSchema = z.object({
  title: z.string(),
  hook: z.string(),
  scenes: z.array(z.object({
    narration: z.string(),
    imagePrompt: z.string(),
    durationSeconds: z.number(),
    subtitleText: z.string(),
  })),
  totalDurationSeconds: z.number(),
  hashtags: z.array(z.string()),
});

export async function POST(request: Request) {
  try {
    const { prompt } = await request.json();
    if (!prompt) {
      return NextResponse.json({ error: 'El prompt es requerido' }, { status: 400 });
    }

    const supabase = await createClient();

    // 1. Crear registro inicial en la base de datos
    const { data: video, error: createError } = await supabase
      .from('videos')
      .insert({
        prompt,
        status: 'pending',
      })
      .select()
      .single();

    if (createError || !video) {
      console.error('Error creando video en db:', createError);
      return NextResponse.json({ error: 'Error al registrar el video en la base de datos' }, { status: 500 });
    }

    // 2. Generar el guion estructurado con Gemini
    const systemInstruction = `
      Eres un director creativo experto en videos de formato corto (TikTok, Reels, Shorts).
      Genera un guion estructurado y dinámico basado en el tema proporcionado por el usuario.
      El guion debe estar optimizado para retención de audiencia:
      - Debe incluir un "hook" inicial fuerte de 2-3 segundos.
      - Debe estar dividido en escenas cortas (entre 3 y 6 segundos cada una).
      - La duración total recomendada debe rondar entre 15 y 45 segundos totales.
      - Para cada escena, escribe una narración atractiva en español y un prompt muy descriptivo y visual para generar una imagen en inglés (los generadores de imágenes funcionan mejor en inglés, ej: '3D Pixar style illustration of...').
      - Mantén el tono enérgico y entretenido.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Tema del video: ${prompt}`,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: zodToJsonSchema(VideoScriptSchema as any) as any,
      },
    });

    if (!response.text) {
      throw new Error('No se recibió respuesta de Gemini');
    }

    const scriptData = JSON.parse(response.text);

    // 3. Insertar las escenas en la tabla de escenas
    const scenesToInsert = scriptData.scenes.map((scene: any, index: number) => ({
      video_id: video.id,
      scene_order: index + 1,
      narration: scene.narration,
      image_prompt: scene.imagePrompt,
      duration_seconds: scene.durationSeconds,
    }));

    const { error: scenesError } = await supabase
      .from('scenes')
      .insert(scenesToInsert);

    if (scenesError) {
      console.error('Error insertando escenas:', scenesError);
      await supabase
        .from('videos')
        .update({ status: 'error', error_message: 'Error al guardar las escenas' })
        .eq('id', video.id);
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
      .eq('id', video.id);

    if (updateError) {
      console.error('Error actualizando video:', updateError);
      return NextResponse.json({ error: 'Error al actualizar el estado del video' }, { status: 500 });
    }

    return NextResponse.json({ success: true, videoId: video.id, script: scriptData });

  } catch (err: any) {
    console.error('Error en /api/generate-script:', err);
    return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 });
  }
}
