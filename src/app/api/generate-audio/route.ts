import { NextResponse } from 'next/server';
import { EdgeTTS } from 'edge-tts-universal';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  try {
    const { videoId } = await request.json();
    if (!videoId) {
      return NextResponse.json({ error: 'videoId es requerido' }, { status: 400 });
    }

    const supabase = await createClient();

    // 1. Obtener guion de Supabase
    const { data: video, error: fetchError } = await supabase
      .from('videos')
      .select('script')
      .eq('id', videoId)
      .single();

    if (fetchError || !video || !video.script) {
      console.error('Error obteniendo guion:', fetchError);
      return NextResponse.json({ error: 'Video o guion no encontrado' }, { status: 404 });
    }

    const script = video.script as any;
    const narrationText = script.scenes
      .map((s: any) => s.narration)
      .join(' ');

    // 2. Generar audio con Edge TTS (es-MX-JorgeNeural)
    const tts = new EdgeTTS(narrationText, 'es-MX-JorgeNeural');

    // Generar buffer de audio
    const result = await tts.synthesize();
    const arrayBuffer = await result.audio.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    // 3. Subir buffer a Supabase Storage
    const fileName = `${videoId}/voice.mp3`;
    const { data: storageData, error: storageError } = await supabase.storage
      .from('video-assets')
      .upload(fileName, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: true,
      });

    if (storageError) {
      console.error('Error subiendo audio a storage:', storageError);
      throw storageError;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('video-assets')
      .getPublicUrl(fileName);

    // 4. Actualizar estado del video en DB
    const { error: updateError } = await supabase
      .from('videos')
      .update({ 
        audio_url: publicUrl, 
        status: 'audio_generated' 
      })
      .eq('id', videoId);

    if (updateError) {
      console.error('Error actualizando estado de audio en db:', updateError);
      return NextResponse.json({ error: 'Error al actualizar base de datos' }, { status: 500 });
    }

    return NextResponse.json({ success: true, audioUrl: publicUrl });

  } catch (err: any) {
    console.error('Error en /api/generate-audio:', err);
    return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 });
  }
}
