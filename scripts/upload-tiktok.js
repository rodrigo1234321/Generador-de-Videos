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

async function uploadToTikTok(videoPath, caption) {
  console.log(`=== INICIANDO SUBIDA A TIKTOK EN EL NAVEGADOR ===`);
  console.log(`Video: ${path.basename(videoPath)}`);
  console.log(`Descripción: "${caption}"\n`);

  // Lanzar Chrome visible (headful) con sesión persistente
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null, // Ajustar pantalla completa
    args: [
      '--disable-blink-features=AutomationControlled', // Evita que TikTok detecte que es un bot
      '--start-maximized'
    ],
    userDataDir: path.join(__dirname, '..', 'tiktok-session') // Guarda la sesión (cookies/login)
  });

  const page = await browser.newPage();
  
  // Evadir fingerprinting básico
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  try {
    console.log('Navegando a la página de carga de TikTok Studio...');
    // Redirige a la página de carga oficial de TikTok Studio
    await page.goto('https://www.tiktok.com/tiktokstudio/upload?lang=es', {
      waitUntil: 'networkidle2',
      timeout: 120000
    });

    // 1. Comprobar si está logueado buscando el input de subida de archivos
    let loggedIn = false;
    try {
      await page.waitForSelector('input[type="file"]', { timeout: 6000 });
      loggedIn = true;
    } catch (e) {
      // Si no encuentra el input, requiere inicio de sesión
    }

    if (!loggedIn) {
      console.log('\n============================================================');
      console.log('¡ATENCIÓN! No tienes una sesión activa en TikTok.');
      console.log('1. Por favor, INICIA SESIÓN manualmente en la ventana de Chrome que se abrió.');
      console.log('2. Dirígete a la sección de carga (TikTok Studio → Subir).');
      console.log('El script detectará tu inicio de sesión automáticamente.');
      console.log('============================================================\n');

      // Esperar un tiempo prolongado (10 minutos) a que el usuario se loguee
      await page.waitForSelector('input[type="file"]', { timeout: 600000 });
      console.log('✓ ¡Sesión detectada exitosamente! Continuando con la carga...');
    }

    // 2. Subir el archivo de video
    console.log('Seleccionando y subiendo el video...');
    const fileInput = await page.$('input[type="file"]');
    await fileInput.uploadFile(videoPath);
    console.log('✓ Archivo cargado. Procesando el video (esto puede tardar unos segundos)...');

    // 3. Esperar a que el editor de subtítulos/descripción esté disponible
    // Usamos el selector genérico contenteditable o el rol textbox de TikTok
    console.log('Esperando a que se habilite el cuadro de texto...');
    const captionSelector = 'div[contenteditable="true"], div[role="textbox"], [data-e2e="caption-input"]';
    await page.waitForSelector(captionSelector, { timeout: 90000 });
    
    // Enfocar y escribir la descripción
    console.log('Escribiendo la descripción y los hashtags...');
    await page.focus(captionSelector);
    
    // Borrar texto previo por si acaso
    await page.keyboard.down('Control');
    await page.keyboard.press('A');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    
    // Escribir el nuevo título/hashtags letra por letra de forma natural
    await page.keyboard.type(caption, { delay: 50 });
    console.log('✓ Descripción escrita exitosamente.');

    // 4. Modo Seguro: Dejar la pestaña abierta para que el usuario revise y publique manualmente
    console.log('\n============================================================');
    console.log('✓ ¡TODO LISTO! El video y los hashtags ya fueron cargados.');
    console.log('Para evitar shadowbans de TikTok (que penaliza los clics directos de bots),');
    console.log('por favor revisa el video en pantalla y haz clic en el botón');
    console.log('rojo "Publicar" (o programar) manualmente.');
    console.log('============================================================\n');

    await askQuestion('Presiona ENTER en esta consola cuando hayas terminado para cerrar el navegador...');
    
  } catch (error) {
    console.error('✗ ERROR EN EL NAVEGADOR:', error.message || error);
  } finally {
    console.log('Cerrando navegador...');
    await browser.close();
    process.exit(0);
  }
}

// Permitir ejecución directa de prueba
if (require.main === module) {
  const videoPath = process.argv[2];
  const caption = process.argv[3] || '¡Video generado automáticamente! #ia #automatizacion';
  
  if (!videoPath) {
    console.error('Error: Proporciona la ruta del video.');
    console.log('Uso: node scripts/upload-tiktok.js "ruta/al/video.mp4" "Mi caption"');
    process.exit(1);
  }
  
  uploadToTikTok(videoPath, caption);
}

module.exports = { uploadToTikTok };
