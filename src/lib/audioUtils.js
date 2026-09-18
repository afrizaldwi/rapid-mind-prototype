/**
 * Utility to convert an audio Blob (from MediaRecorder) into a 16kHz mono Float32Array
 * required by the Whisper ASR pipeline.
 */
export async function blobTo16kHzFloat32(audioBlob) {
  const arrayBuffer = await audioBlob.arrayBuffer()
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  const audioCtx = new AudioCtx()
  
  const decoded = await audioCtx.decodeAudioData(arrayBuffer)
  await audioCtx.close().catch(() => {})

  const targetSampleRate = 16000
  const targetLength = Math.ceil(decoded.duration * targetSampleRate)
  
  const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext
  const offlineCtx = new OfflineCtx(1, targetLength, targetSampleRate)
  
  const source = offlineCtx.createBufferSource()
  source.buffer = decoded
  source.connect(offlineCtx.destination)
  source.start(0)
  
  const rendered = await offlineCtx.startRendering()
  return rendered.getChannelData(0)
}

