import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

interface Scene {
  id: string;
  video_id: string;
  scene_order: number;
  image_prompt: string;
  stock_query?: string;
  [key: string]: any;
}

interface ImageResult {
  buffer: Buffer;
  contentType: string;
  provider: string;
}

// Lista única de palabras vacías, reutilizada por todos los proveedores que
// hacen búsqueda por palabras clave (antes estaba duplicada en Pexels y LoremFlickr).
const STOP_WORDS = new Set([
  'showing', 'with', 'wearing', 'jersey', 'cinematic', 'lighting', 'vibrant', 'image',
  'montage', 'focused', 'blurred', 'background', 'faded', 'proudly', 'looking', 'determined',
  'patriotic', 'radiant', 'light', 'emotional', 'style', 'hyperrealistic', 'detailed', 'split',
  'photo', 'realistic', 'close-up', 'close', 'side', 'other', 'shot', 'wide', 'stunning',
  'beautiful', 'ancient', 'glowing',
]);

function extractKeywords(prompt: string, maxWords = 3, separator = ' '): string {
  const keywords = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((word: string) => word.length > 3 && !STOP_WORDS.has(word))
    .slice(0, maxWords)
    .join(separator);

  return keywords || 'abstract';
}

async function fetchWithRetry(url: string, retries = 3, delay = 3000, timeoutMs = 25000): Promise<Response> {
  let lastError: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) return response;
      console.warn(`Intento ${i + 1} falló con código: ${response.status}`);
    } catch (err: any) {
      lastError = err;
      console.warn(`Intento ${i + 1} falló con error:`, err.message || err);
    }
    if (i < retries - 1) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error(`No se pudo descargar ${url} después de ${retries} intentos: ${lastError}`);
}

// ---------------------------------------------------------------------------
// Proveedores de imagen. Cada uno intenta generar/conseguir una imagen y
// devuelve null si no aplica o falla (para pasar al siguiente proveedor),
// en vez de lanzar excepciones que interrumpan la cadena.
// ---------------------------------------------------------------------------

async function tryPexels(scene: Scene): Promise<ImageResult | null> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return null;

  try {
    const searchQuery = scene.stock_query || extractKeywords(scene.image_prompt) || scene.image_prompt.slice(0, 50);
    let searchRes = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(searchQuery)}&per_page=3&orientation=portrait`,
      { headers: { Authorization: apiKey } }
    );

    if (!searchRes.ok) {
      console.warn(`[escena ${scene.scene_order}] Pexels API falló con status: ${searchRes.status}`);
      return null;
    }

    let data = await searchRes.json();

    // Si no hay fotos, intentar simplificar la búsqueda usando solo la última palabra (ej. "soccer stadium" -> "stadium")
    if (!data.photos?.length) {
      const words = searchQuery.split(' ').filter((w) => w.trim().length > 0);
      if (words.length > 1) {
        const simplifiedQuery = words[words.length - 1];
        console.log(`[escena ${scene.scene_order}] Pexels sin resultados para "${searchQuery}". Reintentando con simplificada: "${simplifiedQuery}"`);
        const retryRes = await fetch(
          `https://api.pexels.com/v1/search?query=${encodeURIComponent(simplifiedQuery)}&per_page=3&orientation=portrait`,
          { headers: { Authorization: apiKey } }
        );
        if (retryRes.ok) {
          data = await retryRes.json();
        }
      }
    }

    if (!data.photos?.length) {
      console.warn(`[escena ${scene.scene_order}] Pexels no encontró resultados tras reintentar.`);
      return null;
    }

    const photo = data.photos[Math.floor(Math.random() * data.photos.length)];
    const targetUrl = photo.src.portrait || photo.src.large2x || photo.src.original;
    const imageRes = await fetch(targetUrl);
    if (!imageRes.ok) return null;

    const arrayBuffer = await imageRes.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      contentType: imageRes.headers.get('content-type') || 'image/jpeg',
      provider: 'pexels',
    };
  } catch (err: any) {
    console.warn(`[escena ${scene.scene_order}] Pexels falló:`, err.message || err);
    return null;
  }
}

async function tryLoremFlickr(scene: Scene): Promise<ImageResult | null> {
  try {
    const keywords = scene.stock_query 
      ? scene.stock_query.replace(/\s+/g, ',') 
      : extractKeywords(scene.image_prompt, 3, ',');
    const url = `https://loremflickr.com/720/1280/${encodeURIComponent(keywords)}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[escena ${scene.scene_order}] LoremFlickr falló con status: ${res.status}`);
      return null;
    }
    const arrayBuffer = await res.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      contentType: res.headers.get('content-type') || 'image/jpeg',
      provider: 'loremflickr',
    };
  } catch (err: any) {
    console.warn(`[escena ${scene.scene_order}] LoremFlickr falló:`, err.message || err);
    return null;
  }
}

async function tryPicsum(scene: Scene): Promise<ImageResult | null> {
  try {
    const seed = Math.floor(Math.random() * 1_000_000);
    const url = `https://picsum.photos/720/1280?random=${scene.scene_order}_${seed}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[escena ${scene.scene_order}] Picsum falló con status: ${res.status}`);
      return null;
    }
    const arrayBuffer = await res.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      contentType: res.headers.get('content-type') || 'image/jpeg',
      provider: 'picsum',
    };
  } catch (err: any) {
    console.warn(`[escena ${scene.scene_order}] Picsum falló:`, err.message || err);
    return null;
  }
}

// Orden de fallback enfocado 100% en imágenes de stock de alta calidad (rápido y estable)
const PROVIDERS = [tryPexels, tryLoremFlickr, tryPicsum];

async function getImageForScene(scene: Scene): Promise<ImageResult> {
  for (const provider of PROVIDERS) {
    const result = await provider(scene);
    if (result) return result;
  }
  throw new Error(`No se pudo obtener una imagen para la escena ${scene.scene_order} usando ningún proveedor.`);
}

async function processScene(scene: Scene, videoId: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  const { buffer, contentType, provider } = await getImageForScene(scene);
  const extension = contentType.includes('png') ? 'png' : 'jpg';
  const fileName = `${videoId}/scene_${scene.scene_order}.${extension}`;

  console.log(`Guardando escena ${scene.scene_order} (proveedor: ${provider}) como ${fileName}...`);

  const { error: uploadError } = await supabase.storage
    .from('video-assets')
    .upload(fileName, buffer, { contentType, upsert: true });

  if (uploadError) {
    throw new Error(`Error subiendo escena ${scene.scene_order} a storage: ${uploadError.message}`);
  }

  const { data: { publicUrl } } = supabase.storage.from('video-assets').getPublicUrl(fileName);

  const { error: updateSceneError } = await supabase
    .from('scenes')
    .update({ image_url: publicUrl })
    .eq('id', scene.id);

  if (updateSceneError) {
    throw new Error(`Error actualizando escena ${scene.scene_order} en db: ${updateSceneError.message}`);
  }

  return { sceneOrder: scene.scene_order, provider };
}

export async function POST(request: Request) {
  try {
    const { videoId } = await request.json();
    if (!videoId) {
      return NextResponse.json({ error: 'videoId es requerido' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: scenes, error: fetchError } = await supabase
      .from('scenes')
      .select('*')
      .eq('video_id', videoId)
      .order('scene_order', { ascending: true });

    if (fetchError || !scenes || scenes.length === 0) {
      console.error('Error obteniendo escenas:', fetchError);
      return NextResponse.json({ error: 'Escenas no encontradas para este video' }, { status: 404 });
    }

    // Se usa allSettled en vez de Promise.all: si una escena falla, no se
    // interrumpe el procesamiento de las demás. Al final se reporta el detalle.
    // Obtener el guion para extraer las stockQueries generadas por Gemini
    const { data: video } = await supabase
      .from('videos')
      .select('script')
      .eq('id', videoId)
      .single();

    const scriptScenes = (video?.script as any)?.scenes || [];

    const results = await Promise.allSettled(
      scenes.map((scene, idx) => {
        const scriptScene = scriptScenes[idx];
        const sceneWithQuery: Scene = {
          ...scene,
          stock_query: scriptScene?.stockQuery || '',
        };
        return processScene(sceneWithQuery, videoId, supabase);
      })
    );

    const failures = results
      .map((r, i) => ({ r, scene: scenes[i] }))
      .filter(({ r }) => r.status === 'rejected') as { r: PromiseRejectedResult; scene: Scene }[];

    if (failures.length === scenes.length) {
      const message = 'No se pudo generar ninguna imagen para este video.';
      await supabase.from('videos').update({ status: 'error', error_message: message }).eq('id', videoId);
      return NextResponse.json({ error: message }, { status: 500 });
    }

    if (failures.length > 0) {
      const failedOrders = failures.map((f) => f.scene.scene_order).join(', ');
      const message = `Fallaron las escenas: ${failedOrders}`;
      console.error(message, failures.map((f) => f.r.reason));
      await supabase
        .from('videos')
        .update({ status: 'error', error_message: message })
        .eq('id', videoId);
      return NextResponse.json({ error: message, failedScenes: failures.map((f) => f.scene.scene_order) }, { status: 500 });
    }

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
