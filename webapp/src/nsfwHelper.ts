import * as nsfwjs from 'nsfwjs';
import * as tf from '@tensorflow/tfjs';

// Avoid memory leaks by caching the loaded model globally
let model: nsfwjs.NSFWJS | null = null;

export const loadNsfwModel = async () => {
  if (model) return model;
  try {
    // Explicitly set backend to webgl if available for faster processing
    await tf.ready();
    model = await nsfwjs.load();
    return model;
  } catch (error) {
    console.error("Failed to load NSFW model", error);
    return null;
  }
};

export const checkImageIsSafe = async (file: File): Promise<boolean> => {
  return new Promise(async (resolve) => {
    try {
      const loadedModel = await loadNsfwModel();
      if (!loadedModel) {
        // If the AI model fails to load, we allow the upload as a fallback
        return resolve(true);
      }

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

    } catch (err) {
      console.error("NSFW check error:", err);
      resolve(true);
    }
  });
};
