import { ZONA_MERAH_KEYWORDS, ZONA_KUNING_KEYWORDS } from './keywords'

/**
 * Analisis transkripsi verbal dan tentukan zona risiko
 * @param {string} transcript - Teks hasil speech-to-text
 * @returns {{ zona: string, detectedKeywords: string[], score: number }}
 */
export function analyzeTranscript(transcript) {
  const text = transcript.toLowerCase().trim()
  const detectedKeywords = []
  
  // Cek kata kunci zona merah
  for (const keyword of ZONA_MERAH_KEYWORDS) {
    if (text.includes(keyword)) {
      detectedKeywords.push(keyword)
    }
  }
  
  if (detectedKeywords.length > 0) {
    return {
      zona: 'merah',
      detectedKeywords,
      score: 3
    }
  }
  
  // Cek kata kunci zona kuning
  for (const keyword of ZONA_KUNING_KEYWORDS) {
    if (text.includes(keyword)) {
      detectedKeywords.push(keyword)
    }
  }
  
  if (detectedKeywords.length >= 2) {
    return {
      zona: 'kuning',
      detectedKeywords,
      score: 2
    }
  }
  
  if (detectedKeywords.length === 1) {
    return {
      zona: 'kuning',
      detectedKeywords,
      score: 1
    }
  }
  
  return {
    zona: 'hijau',
    detectedKeywords: [],
    score: 0
  }
}

/**
 * Analisis checklist non-verbal dan tentukan zona risiko
 * @param {Object} answers - Object berisi jawaban checklist {q1: bool, q2: bool, ...}
 * @returns {{ zona: string, criticalItems: string[], score: number }}
 */
export function analyzeChecklist(answers) {
  const criticalItems = []
  const warningItems = []
  
  const CRITICAL_QUESTIONS = {
    q1: 'Histeria / menjerit tidak terkendali',
    q2: 'Tidak merespons (disosiatif)',
    q3: 'Niat menyakiti diri sendiri'
  }
  
  const WARNING_QUESTIONS = {
    q4: 'Gemetar hebat / panik berlebihan',
    q5: 'Menangis terus-menerus',
    q6: 'Menolak makan/minum >24 jam',
    q7: 'Bingung / disorientasi'
  }
  
  // Cek item kritis (langsung Zona Merah)
  for (const [key, label] of Object.entries(CRITICAL_QUESTIONS)) {
    if (answers[key]) {
      criticalItems.push(label)
    }
  }
  
  if (criticalItems.length > 0) {
    return {
      zona: 'merah',
      criticalItems,
      warningItems: [],
      score: 3
    }
  }
  
  // Cek item peringatan
  for (const [key, label] of Object.entries(WARNING_QUESTIONS)) {
    if (answers[key]) {
      warningItems.push(label)
    }
  }
  
  if (warningItems.length >= 2) {
    return {
      zona: 'kuning',
      criticalItems: [],
      warningItems,
      score: 2
    }
  }
  
  if (warningItems.length === 1) {
    return {
      zona: 'kuning',
      criticalItems: [],
      warningItems,
      score: 1
    }
  }
  
  return {
    zona: 'hijau',
    criticalItems: [],
    warningItems: [],
    score: 0
  }
}
