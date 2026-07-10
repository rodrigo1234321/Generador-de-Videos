import { NextResponse } from 'next/server';
import { EdgeTTS } from 'edge-tts-universal';
import { createClient } from '@/utils/supabase/server';

const NS_PER_SECOND = 10_000_000; // 1 segundo = 10,000,000 unidades de 100-ns
const VOICE = 'es-MX-JorgeNeural';
const DEFAULT_SCENE_DURATION = 4;

interface SceneScript {
  narration: string;
  [key: string]: any;
}

interface Script {
  scenes: SceneScript[];
  [key: string]: any;
}

interface SubtitleWord {
  text: string;
  offset: number;
  duration: number;
}

interface SubtitleEntry {
  text: string;
  start: number;
  end: number;
}

interface AlignedScene extends SceneScript {
  scene_order: number;
  durationSeconds: number;
  subtitles: SubtitleEntry[];
}

function toSeconds(offsetIn100ns: number): number {
  return offsetIn100ns / NS_PER_SECOND;
}

function buildNarrationText(scenes: SceneScript[]): string {
  return scenes.map((s) => s.narration).join(' ');
}

/** Reparte las palabras devueltas por Edge TTS entre las escenas, en orden. */
function alignScenesWithSubtitles(scenes: SceneScript[], subtitleWords: SubtitleWord[]): AlignedScene[] {
  let wordIndex = 0;

  return scenes.map((scene, index) => {
    const isLast = index === scenes.length - 1;
    const sceneWordCount = scene.narration.split(/\s+/).filter((w) => w.trim().length > 0).length;

    const sceneWords = isLast
      ? subtitleWords.slice(wordIndex)
      : subtitleWords.slice(wordIndex, wordIndex + sceneWordCount);
    wordIndex += sceneWordCount;

    const firstWord = sceneWords[0];
    const lastWord = sceneWords[sceneWords.length - 1];

    const startSec = firstWord ? toSeconds(firstWord.offset) : 0;
    const endSec = lastWord ? toSeconds(lastWord.offset + lastWord.duration) : 0;

    let durationSeconds = endSec - startSec;
    if (durationSeconds <= 0 || isNaN(durationSeconds)) {
      durationSeconds = scene.durationSeconds || DEFAULT_SCENE_DURATION;
    }

    const subtitles: SubtitleEntry[] = sceneWords.map((word) => ({
      text: word.text,
      start: Math.max(0, toSeconds(word.offset) - startSec),
      end: Math.max(0, toSeconds(word.offset + word.duration) - startSec),
    }));

    return {
      ...scene,
      scene_order: index + 1,
      durationSeconds,
      subtitles,
    };
  });
}

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

    const script = video.script as Script;
    if (!Array.isArray(script.scenes) || script.scenes.length === 0) {
      return NextResponse.json({ error: 'El guion no tiene escenas válidas' }, { status: 422 });
    }

    const narrationText = buildNarrationText(script.scenes);
    if (!narrationText.trim()) {
      return NextResponse.json({ error: 'El guion no tiene texto de narración' }, { status: 422 });
    }

    // 2. Generar audio con Edge TTS
    let audioBuffer: Buffer;
    let subtitleWords: SubtitleWord[];
    try {
      const tts = new EdgeTTS(narrationText, VOICE);
      const result = await tts.synthesize();
      const arrayBuffer = await result.audio.arrayBuffer();
      audioBuffer = Buffer.from(arrayBuffer);
      subtitleWords = result.subtitle as SubtitleWord[];

      if (audioBuffer.length === 0) {
        throw new Error('El audio generado está vacío');
      }
    } catch (ttsError: any) {
      console.error('Error generando audio con Edge TTS:', ttsError);
      return NextResponse.json({ error: 'Error al generar el audio de narración' }, { status: 502 });
    }

    // 3. Subir buffer a Supabase Storage
    const fileName = `${videoId}/voice.mp3`;
    const { error: storageError } = await supabase.storage
      .from('video-assets')
      .upload(fileName, audioBuffer, { contentType: 'audio/mpeg', upsert: true });

    if (storageError) {
      console.error('Error subiendo audio a storage:', storageError);
      return NextResponse.json({ error: 'Error al subir el audio generado' }, { status: 500 });
    }

    const { data: { publicUrl } } = supabase.storage.from('video-assets').getPublicUrl(fileName);

    // 4. Alinear subtítulos palabra por palabra con las escenas
    const updatedScenes = alignScenesWithSubtitles(script.scenes, subtitleWords);

    // 5. Actualizar la duración real de cada escena en la base de datos (en paralelo)
    const sceneUpdateResults = await Promise.allSettled(
      updatedScenes.map((scene) =>
        supabase
          .from('scenes')
          .update({ duration_seconds: scene.durationSeconds })
          .eq('video_id', videoId)
          .eq('scene_order', scene.scene_order)
      )
    );

    const failedSceneUpdates = sceneUpdateResults.filter((r) => r.status === 'rejected');
    if (failedSceneUpdates.length > 0) {
      console.error('Algunas escenas no pudieron actualizar su duración:', failedSceneUpdates);
    }

    // 6. Actualizar el video con audio_url, guion con subtítulos y duración total
    const totalDurationSeconds = updatedScenes.reduce((acc, s) => acc + s.durationSeconds, 0);
    const updatedScript: Script = {
      ...script,
      scenes: updatedScenes,
      totalDurationSeconds,
    };

    const { error: updateError } = await supabase
      .from('videos')
      .update({
        audio_url: publicUrl,
        status: 'audio_generated',
        script: updatedScript,
        duration_seconds: totalDurationSeconds,
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
