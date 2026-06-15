// Avoid memory leaks by caching the loaded model globally
let model: any = null;
let loadingPromise: Promise<any> | null = null;

export const loadNsfwModel = async () => {
  if (model) return model;
  
  // Prevent multiple simultaneous loads
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      // Dynamic imports — TF.js and NSFW.js are only downloaded when
      // the user actually initiates an upload. This keeps them out of
      // the initial bundle entirely (~48 MB savings).
      const [nsfwjs, tf] = await Promise.all([
        import('nsfwjs'),
        import('@tensorflow/tfjs')
      ]);

      // Explicitly set backend to webgl if available for faster processing
      await tf.ready();
      model = await nsfwjs.load();
      return model;
    } catch (error) {
      console.error("Failed to load NSFW model", error);
      loadingPromise = null;
      return null;
    }
  })();

  return loadingPromise;
};

export const checkImageIsSafe = async (file: File): Promise<boolean> => {
  try {
    const loadedModel = await loadNsfwModel();
    if (!loadedModel) {
      // If the AI model fails to load, we allow the upload as a fallback
      return true;
    }

    return new Promise((resolve) => {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.src = e.target?.result as string;
        img.onload = async () => {
          try {
            // Predict content
            const predictions = await loadedModel.classify(img);
            
            // Expected classes: 'Porn', 'Hentai', 'Sexy', 'Neutral', 'Drawing'
            let isSafe = true;
            for (const p of predictions) {
              // Block if Porn or Hentai probability is very high (> 60%)
              // We leave 'Sexy' alone as it might just be artistic anatomy, but strict NSFW is blocked.
              if ((p.className === 'Porn' || p.className === 'Hentai') && p.probability > 0.60) {
                isSafe = false;
                break;
              }
            }
            
            resolve(isSafe);
          } catch (predictionErr) {
            console.error("Prediction error:", predictionErr);
            resolve(true);
          }
        };
      };
      
      reader.onerror = () => resolve(true);
      reader.readAsDataURL(file);
    });
  } catch (err) {
    console.error("NSFW check error:", err);
    return true;
  }
};
