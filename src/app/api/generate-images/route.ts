import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  try {
    const { videoId } = await request.json();
    if (!videoId) {
      return NextResponse.json({ error: 'videoId es requerido' }, { status: 400 });
    }

    const supabase = await createClient();

    // 1. Obtener las escenas del guion
    const { data: scenes, error: fetchError } = await supabase
      .from('scenes')
      .select('*')
      .eq('video_id', videoId)
      .order('scene_order', { ascending: true });

    if (fetchError || !scenes || scenes.length === 0) {
      console.error('Error obteniendo escenas:', fetchError);
      return NextResponse.json({ error: 'Escenas no encontradas para este video' }, { status: 404 });
    }

    // 2. Generar y descargar imágenes para cada escena en paralelo
    await Promise.all(
      scenes.map(async (scene) => {
        const encodedPrompt = encodeURIComponent(scene.image_prompt);
        const seed = Math.floor(Math.random() * 1000000);
        
        // URL de Pollinations.ai con dimensiones verticales (1080x1920) y modelo Flux
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1080&height=1920&model=flux&nologo=true&seed=${seed}`;

        try {
          // Descargar la imagen
          const imageResponse = await fetch(imageUrl);
          if (!imageResponse.ok) {
            throw new Error(`Failed to fetch image from Pollinations: ${imageResponse.statusText}`);
          }
          
          const arrayBuffer = await imageResponse.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          const fileName = `${videoId}/scene_${scene.scene_order}.jpg`;

          // Subir al bucket publico
          const { error: uploadError } = await supabase.storage
            .from('video-assets')
            .upload(fileName, buffer, {
              contentType: 'image/jpeg',
              upsert: true,
            });

          if (uploadError) {
            console.error(`Error subiendo escena ${scene.scene_order} a storage:`, uploadError);
            throw uploadError;
          }

          const { data: { publicUrl } } = supabase.storage
            .from('video-assets')
            .getPublicUrl(fileName);

          // Actualizar URL en la tabla de escenas
          const { error: updateSceneError } = await supabase
            .from('scenes')
            .update({ image_url: publicUrl })
            .eq('id', scene.id);

          if (updateSceneError) {
            console.error(`Error actualizando escena ${scene.scene_order} en db:`, updateSceneError);
            throw updateSceneError;
          }

        } catch (innerError: any) {
          console.error(`Error procesando escena ${scene.scene_order}:`, innerError);
          throw innerError;
        }
      })
    );

    // 3. Actualizar estado del video en DB
    const { error: updateVideoError } = await supabase
      .from('videos')
      .update({ status: 'images_generated' })
      .eq('id', videoId);

    if (updateVideoError) {
      console.error('Error actualizando estado del video a images_generated:', updateVideoError);
      return NextResponse.json({ error: 'Error al actualizar base de datos' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error('Error en /api/generate-images:', err);
    return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 });
  }
}
