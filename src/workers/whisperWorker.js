import { pipeline, env } from '@xenova/transformers'

// Configure transformers.js for browser environment
env.allowLocalModels = false
env.useBrowserCache = true

class PipelineSingleton {
  static model = 'Xenova/whisper-tiny'
  static instance = null

  static async getInstance(progress_callback = null) {
    if (this.instance === null) {
      this.instance = await pipeline('automatic-speech-recognition', this.model, {
        progress_callback,
        quantized: true,
      })
    }
    return this.instance
  }
}

self.addEventListener('message', async (event) => {
  const { type, data } = event.data

  if (type === 'load') {
    try {
      self.postMessage({ status: 'loading', message: 'Memuat model AI Whisper...' })
      await PipelineSingleton.getInstance((progress) => {
        self.postMessage({ status: 'progress', data: progress })
      })
      self.postMessage({ status: 'ready', message: 'Model AI Whisper siap (100% Offline)' })
    } catch (err) {
      console.error('Worker load error:', err)
      self.postMessage({ status: 'error', error: err.message || 'Gagal memuat model' })
    }
  } else if (type === 'transcribe') {
    try {
      self.postMessage({ status: 'transcribing' })
      const transcriber = await PipelineSingleton.getInstance()
      const output = await transcriber(data.audio, {
        language: 'indonesian',
        task: 'transcribe',
        chunk_length_s: 30,
        stride_length_s: 5,
      })
      self.postMessage({ status: 'complete', output: output.text || '' })
    } catch (err) {
      console.error('Worker transcribe error:', err)
      self.postMessage({ status: 'error', error: err.message || 'Gagal mentranskripsi audio' })
    }
  }
})

