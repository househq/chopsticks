// src/utils/imageGen.js
// HuggingFace Inference API wrapper for free image generation
// Primary model: black-forest-labs/FLUX.1-schnell (free, no credit card required)

const HF_API = 'https://api-inference.huggingface.co/models/';
const PRIMARY_MODEL = 'black-forest-labs/FLUX.1-schnell';
const FALLBACK_MODEL = 'stabilityai/stable-diffusion-xl-base-1.0';
const REQUEST_TIMEOUT_MS = 45_000;

/**
 * Generate an image from a text prompt using HuggingFace Inference API.
 * @param {string} prompt - User prompt
 * @param {object} [opts]
 * @param {string} [opts.model]      - Override model (default: FLUX.1-schnell)
 * @param {string} [opts.negPrompt]  - Negative prompt
 * @param {number} [opts.steps]      - Inference steps (4 for FLUX-schnell)
 * @returns {Promise<Buffer>}        - PNG image buffer
 */
export async function generateImage(prompt, opts = {}) {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) {
    throw new Error('HUGGINGFACE_API_KEY is not configured. Set it in your .env file to enable image generation.');
  }

  const model = opts.model || PRIMARY_MODEL;
  const url = `${HF_API}${model}`;

  const body = {
    inputs: sanitizePrompt(prompt),
    parameters: {
      num_inference_steps: opts.steps ?? (model.includes('schnell') ? 4 : 20),
      ...(opts.negPrompt ? { negative_prompt: opts.negPrompt } : {}),
    },
    options: { wait_for_model: true },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Use-Cache': 'false',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      // Model loading — HF returns 503 with estimated_time
      if (res.status === 503) {
        throw new Error('The AI model is warming up (cold start). Please try again in 30–60 seconds.');
      }
      if (res.status === 429) {
        throw new Error('Rate limit reached on HuggingFace. Please wait a moment and try again.');
      }
      throw new Error(`HuggingFace API error (${res.status}): ${errText.slice(0, 200)}`);
    }

    const arrayBuf = await res.arrayBuffer();
    return Buffer.from(arrayBuf);
  } catch (err) {
    if (err.name === 'AbortError') {
      // Try fallback if on primary model
      if (model === PRIMARY_MODEL) {
        return generateImage(prompt, { ...opts, model: FALLBACK_MODEL });
      }
      throw new Error('Image generation timed out after 45 seconds. The model may be busy — try again shortly.');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Sanitize and truncate a prompt.
 * @param {string} prompt
 * @returns {string}
 */
function sanitizePrompt(prompt) {
  return prompt
    .replace(/[<>]/g, '') // strip angle brackets
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

/**
 * Check if image generation is available (API key configured).
 * @returns {boolean}
 */
export function isImageGenAvailable() {
  return Boolean(process.env.HUGGINGFACE_API_KEY);
}
