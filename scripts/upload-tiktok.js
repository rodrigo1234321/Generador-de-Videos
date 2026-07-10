const puppeteer = require('puppeteer');
const path = require('path');
const readline = require('readline');

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

// Helper robusto para buscar un selector en el frame principal y en cualquier iframe secundario de la página
async function waitForSelectorInAnyFrame(page, selector, timeoutMs = 60000) {
  const startTime = Date.now();
  console.log(`Buscando selector "${selector}" en todos los frames...`);
  
  while (Date.now() - startTime < timeoutMs) {
    // 1. Intentar en el frame principal
    const mainEl = await page.$(selector).catch(() => null);
    if (mainEl) return { element: mainEl, frame: page };

    // 2. Intentar en todos los iframes activos
    const frames = page.frames();
    for (const frame of frames) {
      try {
        const el = await frame.$(selector);
        if (el) return { element: el, frame };
      } catch (e) {
        // Ignorar errores de acceso a frames (ej. cross-origin)
      }
    }

    // Esperar 1.5 segundos antes del siguiente intento
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error(`Timeout: No se encontró el selector "${selector}" en ningún frame tras ${timeoutMs / 1000}s.`);
}

async function uploadToTikTok(videoPath, caption) {
  console.log(`=== INICIANDO SUBIDA A TIKTOK EN EL NAVEGADOR ===`);
  console.log(`Video: ${path.basename(videoPath)}`);
  console.log(`Descripción: "${caption}"\n`);

  // Lanzar Chrome visible (headful) con sesión persistente
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: [
      '--disable-blink-features=AutomationControlled', // Quita la bandera navigator.webdriver
      '--start-maximized'
    ],
    userDataDir: path.join(__dirname, '..', 'tiktok-session') // Guarda cookies y logins
  });

  const page = await browser.newPage();
  
  // Evadir bot-detection básico
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  try {
    console.log('Navegando a TikTok Studio...');
    await page.goto('https://www.tiktok.com/tiktokstudio/upload?lang=es', {
      waitUntil: 'networkidle2',
      timeout: 120000
    });

    console.log('\n============================================================');
    console.log('Esperando inicio de sesión y pantalla de carga...');
    console.log('Si no has iniciado sesión, por favor hazlo manualmente en la ventana de Chrome.');
    console.log('El script continuará automáticamente al detectar la zona de subida.');
    console.log('============================================================\n');

    // Esperar un máximo de 10 minutos (600000ms) a que el input de archivos esté disponible
    const uploadInputInfo = await waitForSelectorInAnyFrame(page, 'input[type="file"]', 600000);
    const { element: fileInput, frame: targetFrame } = uploadInputInfo;
    console.log('✓ ¡Pantalla de subida detectada!');

    console.log('Subiendo el archivo de video...');
    await fileInput.uploadFile(videoPath);
    console.log('✓ Video seleccionado. Esperando a que cargue y procese...');

    // Esperar a que aparezca la caja de texto en el frame correcto
    console.log('Esperando que aparezca la caja de descripción...');
    const captionSelector = 'div[contenteditable="true"], div[role="textbox"], [data-e2e="caption-input"]';
    
    // Polling para encontrar el cuadro de texto dentro del frame correcto
    let captionInput = null;
    const captionStartTime = Date.now();
    while (Date.now() - captionStartTime < 90000) {
      captionInput = await targetFrame.$(captionSelector).catch(() => null);
      if (captionInput) break;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    if (!captionInput) {
      throw new Error("No se encontró el cuadro de descripción en el frame donde se subió el video.");
    }

    console.log('Escribiendo la descripción y los hashtags...');
    await captionInput.focus();
    
    // Borrar contenido por si tiene el nombre del archivo
    await page.keyboard.down('Control');
    await page.keyboard.press('A');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    
    // Escribir caption de forma fluida
    await page.keyboard.type(caption, { delay: 45 });
    console.log('✓ Descripción y hashtags añadidos.');

    console.log('\n============================================================');
    console.log('✓ ¡PROCESO DE SUBIDA COMPLETADO CON ÉXITO!');
    console.log('Revisa el video en la pantalla de Chrome y haz clic en');
    console.log('"Publicar" o "Programar" manualmente cuando desees.');
    console.log('============================================================\n');

    await askQuestion('Presiona ENTER en esta consola cuando desees cerrar la ventana del navegador...');

  } catch (error) {
    console.error('\n✗ ERROR EN LA AUTOMATIZACIÓN:', error.message || error);
  } finally {
    console.log('Cerrando navegador...');
    await browser.close();
    process.exit(0);
  }
}

if (require.main === module) {
  const videoPath = process.argv[2];
  const caption = process.argv[3] || '¡Video generado automáticamente! #ia #automatizacion';
  
  if (!videoPath) {
    console.error('Error: Proporciona la ruta del video.');
    process.exit(1);
  }
  
  uploadToTikTok(videoPath, caption);
}

module.exports = { uploadToTikTok };
