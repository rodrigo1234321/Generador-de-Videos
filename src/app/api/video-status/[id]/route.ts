import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // 1. Obtener estado del video
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('*')
      .eq('id', id)
      .single();

    if (videoError || !video) {
      return NextResponse.json({ error: 'Video no encontrado' }, { status: 404 });
    }

    // 2. Obtener las escenas correspondientes
    const { data: scenes, error: scenesError } = await supabase
      .from('scenes')
      .select('*')
      .eq('video_id', id)
      .order('scene_order', { ascending: true });

    return NextResponse.json({
      video,
      scenes: scenes || [],
    });
  } catch (err: any) {
    console.error('Error en /api/video-status:', err);
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}
