# Plan de Implementación: Generador Automático de Videos Verticales (MVP)

Este documento detalla la arquitectura, el flujo de trabajo y las fases
de desarrollo para construir un Producto Mínimo Viable (MVP) de
generación automática de videos cortos (estilo TikTok, Reels o YouTube
Shorts) optimizado para plataformas móviles (1080x1920).

------------------------------------------------------------------------

## 1. Concepto del Producto

La plataforma permite a los usuarios ingresar un tema o concepto simple
y obtener, en pocos minutos, un video vertical editado con voz en off,
imágenes ilustrativas y subtítulos automatizados.

-   **Ejemplo de Entrada:** `"3 datos curiosos sobre Lionel Messi"`
-   **Flujo Interno:** Generación de guion → Síntesis de voz (TTS) →
    Generación/Búsqueda de imágenes → Renderizado de video con FFmpeg.
-   **Ejemplo de Salida:** Archivo `.mp4` vertical (1080x1920) listo
    para descargar y publicar.

------------------------------------------------------------------------

## 2. Arquitectura de Referencia y Stack Tecnológico

  -----------------------------------------------------------------------
  Componente              Herramienta / Servicio  Función
  ----------------------- ----------------------- -----------------------
  **Frontend**            Next.js (React)         Interfaz de usuario,
                                                  formularios de entrada
                                                  y reproductor de video.

  **Backend**             Node.js (Next.js API    Orquestación del
                          Routes)                 pipeline de generación
                                                  y procesamiento.

  **Base de Datos**       Supabase (PostgreSQL)   Persistencia de datos
                                                  de usuarios, historial
                                                  de videos y estados del
                                                  proceso.

  **Autenticación**       Supabase Auth           Registro y login de
                                                  usuarios.

  **Storage**             Supabase Storage        Almacenamiento de
                                                  recursos temporales y
                                                  video final.

  **IA de Texto**         Gemini 2.5 Flash        Generación del guion
                                                  estructurado, prompts
                                                  de imágenes y
                                                  subtítulos.

  **Voz (TTS)**           ElevenLabs (o Google    Conversión del texto
                          TTS)                    del guion a audio.

  **Imágenes**            OpenAI DALL·E / Flux (o Creación u obtención de
                          Unsplash API)           recursos visuales.

  **Motor de Render**     FFmpeg                  Combinación de audio,
                                                  imágenes y efectos.

  **Hosting**             Vercel                  Despliegue de la
                                                  aplicación.
  -----------------------------------------------------------------------

## 3. Pipeline

``` text
[Usuario: Prompt] -> [Gemini: Guion (JSON)] -> [TTS: Audio (MP3)]
                                               |
[Video Final (MP4)] <- [FFmpeg: Render] <- [Generador de Imágenes]
```

## 4. Cronograma

### Fase 1

-   Crear repositorio GitHub.
-   Inicializar Next.js.
-   Configurar Supabase, Vercel y Google AI Studio.
-   Variables de entorno:

``` env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
GEMINI_API_KEY=your_gemini_api_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key
```

### Fase 2

Tablas: `profiles`, `videos`, `scenes`, `credits`.

### Fase 3

Crear `/api/generate-script` usando Gemini y devolver JSON estructurado.

### Fase 4

Integrar ElevenLabs o Google TTS y generar `voice.mp3`.

### Fase 5

Generar imágenes a partir de los prompts.

### Fase 6

Renderizar con FFmpeg.

``` bash
ffmpeg -i voz.mp3 -i imagenes/%03d.jpg -vf "scale=1080:1920" -shortest salida.mp4
```

### Fase 7

Frontend con formulario, progreso, vista previa y descarga.

### Fase 8

Pipeline con estados:
`pending -> script_generated -> audio_generated -> rendering -> completed/error`

### Fase 9

Deploy en Vercel y pruebas.

## 5. Costos

  Servicio             Costo
  ------------ -------------
  Vercel                 \$0
  Supabase               \$0
  Gemini API             \$0
  ElevenLabs          \$0--5
  FFmpeg                 \$0
  **Total**      **\$0--10**

## 6. Integración con OpenCode

Prompt recomendado:

> Crea una ruta API en Next.js (TypeScript) que reciba un string, llame
> al modelo Gemini 2.5 Flash usando la biblioteca oficial de Google Gen
> AI y retorne un guion estructurado en el formato JSON especificado.
