import { useState, useEffect, useRef, useCallback } from 'react'
import { blobTo16kHzFloat32 } from '../lib/audioUtils'

export function useOfflineWhisper() {
  const [modelStatus, setModelStatus] = useState('idle') // 'idle' | 'loading' | 'ready' | 'transcribing' | 'error'
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [progressText, setProgressText] = useState('')
  const [workerError, setWorkerError] = useState(null)

  const workerRef = useRef(null)
  const resolveTranscribeRef = useRef(null)
  const rejectTranscribeRef = useRef(null)

  useEffect(() => {
    // Initialize Web Worker
    const worker = new Worker(
      new URL('../workers/whisperWorker.js', import.meta.url),
      { type: 'module' }
    )

    worker.onmessage = (event) => {
      const { status, data, output, message, error } = event.data

      if (status === 'loading') {
        setModelStatus('loading')
        setProgressText(message || 'Memuat...')
      } else if (status === 'progress') {
        if (data && typeof data.progress === 'number') {
          const pct = Math.round(data.progress)
          setDownloadProgress(pct)
          if (data.file) {
            setProgressText(`Mengunduh ${data.file} (${pct}%)`)
          }
        }
      } else if (status === 'ready') {
        setModelStatus('ready')
        setDownloadProgress(100)
        setProgressText('Model AI Whisper siap (100% Offline)')
      } else if (status === 'transcribing') {
        setModelStatus('transcribing')
        setProgressText('Mentranskripsi suara dengan AI lokal...')
      } else if (status === 'complete') {
        setModelStatus('ready')
        setProgressText('')
        if (resolveTranscribeRef.current) {
          resolveTranscribeRef.current(output)
          resolveTranscribeRef.current = null
        }
      } else if (status === 'error') {
        setModelStatus('error')
        setWorkerError(error)
        if (rejectTranscribeRef.current) {
          rejectTranscribeRef.current(new Error(error))
          rejectTranscribeRef.current = null
        }
      }
    }

    worker.onerror = (err) => {
      console.error('Whisper worker error:', err)
      setModelStatus('error')
      setWorkerError('Gagal menjalankan Web Worker AI.')
    }

    workerRef.current = worker

    return () => {
      worker.terminate()
    }
  }, [])

  const loadModel = useCallback(() => {
    if (workerRef.current && modelStatus === 'idle') {
      setModelStatus('loading')
      workerRef.current.postMessage({ type: 'load' })
    }
  }, [modelStatus])

  const transcribeAudio = useCallback(async (audioBlob) => {
    if (!workerRef.current) {
      throw new Error('Worker AI belum siap.')
    }

    // Convert audio blob to 16kHz mono Float32Array
    const float32Array = await blobTo16kHzFloat32(audioBlob)

    return new Promise((resolve, reject) => {
      resolveTranscribeRef.current = resolve
      rejectTranscribeRef.current = reject
      workerRef.current.postMessage({
        type: 'transcribe',
        data: { audio: float32Array }
      })
    })
  }, [])

  return {
    modelStatus,
    downloadProgress,
    progressText,
    workerError,
    loadModel,
    transcribeAudio,
    isModelReady: modelStatus === 'ready',
    isTranscribing: modelStatus === 'transcribing',
    isLoadingModel: modelStatus === 'loading',
  }
}

