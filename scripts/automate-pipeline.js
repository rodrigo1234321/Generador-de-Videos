const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { uploadToTikTok } = require('./upload-tiktok');
const readline = require('readline');

// Configuración del servidor local
const BASE_URL = 'http://127.0.0.1:3000';

async function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => rl.question(query, (ans) => {
    rl.close();
    resolve(ans);
  }));
}

async function run() {
  const prompt = process.argv[2];
  if (!prompt) {
    console.error('Error: Por favor proporciona un tema para el video.');
    console.error('Uso: node scripts/automate-pipeline.js "Mi tema del video"');
    process.exit(1);
  }

  console.log(`=== INICIANDO PIPELINE AUTÓNOMO PARA: "${prompt}" ===\n`);

  try {
    // 1. Generar Guion
    console.log('1. Generando guion con Gemini...');
    const scriptRes = await fetch(`${BASE_URL}/api/generate-script`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    if (!scriptRes.ok) {
      throw new Error(`Error en generate-script: ${scriptRes.statusText}`);
    }

    const { videoId, script } = await scriptRes.json();
    console.log(`✓ Guion generado exitosamente. ID del video: ${videoId}`);
    console.log(`  Título: "${script.title}"`);
    console.log(`  Hook: "${script.hook}"\n`);

    // 2. Generar Locución de Audio
    console.log('2. Generando locución de audio con Edge TTS...');
    const audioRes = await fetch(`${BASE_URL}/api/generate-audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId }),
    });

    if (!audioRes.ok) {
      throw new Error(`Error en generate-audio: ${audioRes.statusText}`);
    }
    console.log('✓ Audio generado y alineado exitosamente.\n');

    // 3. Descargar Imágenes de Stock
    console.log('3. Buscando imágenes de stock en Pexels...');
    const imageRes = await fetch(`${BASE_URL}/api/generate-images`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId }),
    });

    if (!imageRes.ok) {
      throw new Error(`Error en generate-images: ${imageRes.statusText}`);
    }
    console.log('✓ Imágenes de stock descargadas y asociadas.\n');

    // 4. Obtener Estado Final y Propiedades para Remotion
    console.log('4. Obteniendo datos finales de renderizado...');
    const statusRes = await fetch(`${BASE_URL}/api/video-status/${videoId}`);
    if (!statusRes.ok) {
      throw new Error(`Error en video-status: ${statusRes.statusText}`);
    }

    const { video, scenes } = await statusRes.json();
    
    // Formatear props de entrada para Remotion
    const remotionProps = {
      audioUrl: video.audio_url,
      scenes: scenes.map((s, idx) => {
        const scriptScene = video.script?.scenes?.[idx];
        return {
          imageUrl: s.image_url,
          narrationText: s.narration,
          durationSeconds: s.duration_seconds || 4,
          subtitles: scriptScene?.subtitles || [],
        };
      }),
      durationSeconds: video.duration_seconds || 15,
    };

    // Guardar props temporalmente
    const propsPath = path.join(__dirname, '..', 'temp-props.json');
    fs.writeFileSync(propsPath, JSON.stringify(remotionProps, null, 2));
    console.log(`✓ Propiedades de renderizado guardadas en: ${propsPath}\n`);

    // 5. Renderizar Video MP4 usando Remotion CLI
    const outputPath = path.join(__dirname, '..', `video-${videoId}.mp4`);
    console.log(`5. Renderizando video vertical (1080x1920) a: ${outputPath}...`);
    console.log('   (Esto puede tomar unos segundos...)');

    execSync(
      `npx remotion render src/remotion/entry.ts vertical-video "${outputPath}" --props="${propsPath}" --port=8989`,
      { stdio: 'inherit' }
    );

    console.log(`\n✓ ¡VIDEO RENDERIZADO CON ÉXITO! -> ${outputPath}\n`);

    // Limpieza
    if (fs.existsSync(propsPath)) {
      fs.unlinkSync(propsPath);
    }

    // 6. Subir a TikTok
    const answer = await askQuestion('¿Quieres abrir el navegador y subir este video a TikTok ahora mismo? (s/n): ');
    if (answer.toLowerCase() === 's' || answer.toLowerCase() === 'si') {
      const caption = `${script.title} ${script.hashtags.join(' ')}`;
      await uploadToTikTok(outputPath, caption);
    } else {
      console.log('\n✓ Proceso completado. El video quedó guardado localmente en la raíz.');
      process.exit(0);
    }

  } catch (error) {
    console.error('\n✗ ERROR EN LA AUTOMATIZACIÓN:', error.message || error);
    process.exit(1);
  }
}

run();
