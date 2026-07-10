import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'id es requerido' }, { status: 400 });
    }

    const supabase = await createClient();

    // 1. Obtener estado del video y escenas en paralelo (antes era secuencial)
    const [{ data: video, error: videoError }, { data: scenes, error: scenesError }] = await Promise.all([
      supabase.from('videos').select('*').eq('id', id).single(),
      supabase.from('scenes').select('*').eq('video_id', id).order('scene_order', { ascending: true }),
    ]);

    if (videoError || !video) {
      return NextResponse.json({ error: 'Video no encontrado' }, { status: 404 });
    }

    if (scenesError) {
      // No es fatal para el polling de estado, pero sí se debe dejar rastro.
      console.error('Error obteniendo escenas para video-status:', scenesError);
    }

    return NextResponse.json(
      { video, scenes: scenes || [] },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: any) {
    console.error('Error en /api/video-status:', err);
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}
