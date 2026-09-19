/* Food Arena: real browser-local semantic ranking. Serve as a module worker over HTTPS/localhost. */
const LIBRARY_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js';
const MODEL = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
const DTYPE = 'q8';
let extractorPromise = null;
let extractorReady = false;
let currentRequestId = null;
let queue = Promise.resolve();
const progressAt = new Map();

function emit(type, id, detail = {}) {
  self.postMessage({ type, id, ...detail });
}

function downloadProgress(event) {
  const file = event.file || event.name || '';
  const key = `${event.status}:${file}`;
  const now = performance.now();
  // Network callbacks can arrive for every tiny chunk; retain useful UI cadence.
  if (event.status === 'progress' && event.progress !== 100 && now - (progressAt.get(key) || 0) < 180) return;
  progressAt.set(key, now);
  const progress = { status: event.status, file };
  for (const key of ['progress', 'loaded', 'total']) {
    if (Number.isFinite(event[key])) progress[key] = event[key];
  }
  emit('progress', currentRequestId, { stage: 'download', model: MODEL, ...progress });
}

async function getExtractor(id) {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      emit('progress', id, { stage: 'library', status: 'loading' });
      const { pipeline, env } = await import(LIBRARY_URL);
      env.allowLocalModels = false;
      env.useBrowserCache = true;
      // A single WASM thread also works without COOP/COEP/SharedArrayBuffer.
      env.backends.onnx.wasm.numThreads = 1;
      const extractor = await pipeline('feature-extraction', MODEL, {
        dtype: DTYPE,
        device: 'wasm',
        progress_callback: downloadProgress,
      });
      extractorReady = true;
      return extractor;
    })().catch((error) => {
      extractorPromise = null;
      extractorReady = false;
      throw error;
    });
  }
  return extractorPromise;
}

function validate(request) {
  if (!request || typeof request !== 'object') throw new Error('Richiesta non valida.');
  if (!['string', 'number'].includes(typeof request.id)) throw new Error('id richiesta obbligatorio.');
  if (typeof request.query !== 'string' || !request.query.trim() || request.query.length > 2000) throw new Error('Scrivi una richiesta pranzo fra 1 e 2000 caratteri.');
  if (!Array.isArray(request.items) || request.items.length < 1 || request.items.length > 80) throw new Error('Invia da 1 a 80 piatti disponibili.');
  const seen = new Set();
  for (const item of request.items) {
    if (!item || !['string', 'number'].includes(typeof item.id) || seen.has(item.id)) throw new Error('Ogni piatto deve avere un id unico.');
    seen.add(item.id);
    if (typeof item.name !== 'string' || !item.name.trim() || item.name.length > 300) throw new Error('Nome piatto non valido.');
    if (typeof item.description !== 'string' || item.description.length > 2000) throw new Error('Descrizione piatto non valida.');
  }
}

async function rank(request) {
  const id = request?.id ?? null;
  const startedAt = performance.now();
  let phase = 'validation';
  currentRequestId = id;
  try {
    validate(request);
    const wasReady = extractorReady;
    phase = 'initialization';
    const extractor = await getExtractor(id);
    const initializedAt = performance.now();
    emit('ready', id, { model: MODEL, dtype: DTYPE, device: 'wasm', local: true });
    phase = 'inference';
    emit('progress', id, { stage: 'inference', status: 'running', completed: 0, total: request.items.length });
    const queryTensor = await extractor(request.query.trim(), { pooling: 'mean', normalize: true });
    const queryVector = Array.from(queryTensor.data);
    queryTensor.dispose();
    const scores = [];
    // Bound peak tensor size on phones; no remote inference request is made.
    for (let start = 0; start < request.items.length; start += 8) {
      const batch = request.items.slice(start, start + 8);
      const tensor = await extractor(batch.map((item) => `${item.name.trim()}. ${item.description.trim()}`), {
        pooling: 'mean', normalize: true,
      });
      const width = tensor.dims[1];
      if (width !== queryVector.length) throw new Error('Dimensioni embedding incompatibili.');
      for (let index = 0; index < batch.length; index++) {
        let score = 0;
        for (let j = 0; j < width; j++) score += queryVector[j] * tensor.data[index * width + j];
        if (!Number.isFinite(score)) throw new Error('Il modello ha restituito un punteggio non valido.');
        scores.push({ id: batch[index].id, score: Math.max(-1, Math.min(1, score)), inputIndex: start + index });
      }
      tensor.dispose();
      emit('progress', id, { stage: 'inference', status: 'running', completed: scores.length, total: request.items.length });
    }
    scores.sort((a, b) => b.score - a.score || a.inputIndex - b.inputIndex);
    emit('result', id, {
      model: MODEL, dtype: DTYPE, device: 'wasm', local: true,
      scores: scores.map(({ id, score }) => ({ id, score })),
      order: scores.map(({ id }) => id),
      timings: {
        initializationMs: Math.round(initializedAt - startedAt),
        inferenceMs: Math.round(performance.now() - initializedAt),
        totalMs: Math.round(performance.now() - startedAt),
        modelWasReady: wasReady,
      },
    });
  } catch (error) {
    emit('error', id, {
      code: phase === 'validation' ? 'INVALID_INPUT' : phase === 'initialization' ? 'MODEL_LOAD_FAILED' : 'INFERENCE_FAILED',
      message: phase === 'validation' ? error.message : 'AI locale non disponibile. Nessun ordinamento AI prodotto.',
      detail: String(error?.message || error),
      stage: phase,
      local: true,
      retryable: phase !== 'validation',
    });
  } finally {
    currentRequestId = null;
  }
}

self.onmessage = ({ data }) => {
  // Serialize ONNX access; a failed request never poisons the following request.
  queue = queue.then(() => rank(data));
};
