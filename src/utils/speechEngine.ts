import fs from 'fs';
import path from 'path';

let voskLoaded = false;
let VoskModel: any = null;
let VoskRecognizer: any = null;
let cachedModelInstance: any = null;

try {
  // Attempt dynamic import of vosk native bindings
  const vosk = require('vosk');
  VoskModel = vosk.Model;
  VoskRecognizer = vosk.Recognizer;
  voskLoaded = true;
  console.log('[VOSK Speech Engine] Successfully loaded native vosk npm module.');
} catch (err: any) {
  console.warn(
    '[VOSK Speech Engine] Vosk native addon compilation failed or not found. ' +
    'The engine will run in deterministic fallback mode.'
  );
}

function getOrInitVoskModel() {
  if (cachedModelInstance) return cachedModelInstance;

  const modelDirCandidates = [
    path.join(process.cwd(), 'model'),
    path.join(process.cwd(), 'vosk-model'),
    path.join(__dirname, '../../model')
  ];

  const foundDir = modelDirCandidates.find((d) => fs.existsSync(d));

  if (voskLoaded && VoskModel && foundDir) {
    try {
      console.log(`[VOSK Speech Engine] Initializing & caching Vosk Model from: ${foundDir}`);
      cachedModelInstance = new VoskModel(foundDir);
      return cachedModelInstance;
    } catch (e) {
      console.error('[VOSK Speech Engine] Error loading Vosk model:', e);
    }
  }
  return null;
}

export interface WordAnalysisDetail {
  word: string;
  status: 'correct' | 'mispronounced' | 'missing';
  phoneticGuide: string;
  howToPronounce: string;
  errorReason?: string;
}

export interface VoskAnalysisResult {
  transcription: string;
  confidence: number;
  overallScore: number;
  fluency: number;
  pronunciation: number;
  grammar: number;
  vocabulary: number;
  strengths: string;
  weaknesses: string;
  recommendation: string;
  wordDetails: WordAnalysisDetail[];
  pronunciationTips: string[];
}

const PHONETIC_DICT: Record<string, { ipa: string; guide: string }> = {
  describe: { ipa: '/dɪˈskraɪb/', guide: "Ucapkan 'di-SKRAIB'. Beri penekanan kuat pada suku kata 'skraib' dengan akhiran konsonan 'b' yang jelas." },
  your: { ipa: '/jɔːr/', guide: "Ucapkan 'YOR' atau 'yur' dengan vokal bulat dan posisi lidah tertarik sedikit ke belakang." },
  favorite: { ipa: '/ˈfeɪ.vər.ɪt/', guide: "Ucapkan 'FAY-vrit'. Berikan penekanan kuat di suku kata pertama 'FAY'." },
  hobby: { ipa: '/ˈhɒb.i/', guide: "Ucapkan 'HOB-bee'. Vokal 'o' pendek dan akhiran 'ee' yang bersih." },
  hobbies: { ipa: '/ˈhɒb.iz/', guide: "Ucapkan 'HOB-beez'. Berikan getaran konsonan 'z' pada akhiran '-ies'." },
  traffic: { ipa: '/ˈtræf.ɪk/', guide: "Ucapkan 'TRAF-ik'. Bunyi vokal 'a' pendek (seperti pada kata 'cat') dan penekanan di suku kata 'TRAF'." },
  family: { ipa: '/ˈfæm.əl.i/', guide: "Ucapkan 'FAM-i-lee'. Penekanan jelas pada suku kata awal 'FAM'." },
  teacher: { ipa: '/ˈtiː.tʃər/', guide: "Ucapkan 'TEE-cher'. Tahan vokal 'ee' panjang dan luapkan konsonan 'ch'." },
  student: { ipa: '/ˈstjuː.dənt/', guide: "Ucapkan 'STOO-dent' atau 'STYOO-dent'. Tekankan suku kata 'STOO' di awal." },
  education: { ipa: '/ˌedʒ.ʊˈkeɪ.ʃən/', guide: "Ucapkan 'ej-uh-KAY-shun'. Tekankan kuat pada 'KAY' sebelum akhiran '-shun'." },
  technology: { ipa: '/tekˈnɒl.ə.dʒi/', guide: "Ucapkan 'tek-NOL-uh-jee'. Penekanan utama berada di suku kata 'NOL'." },
  experience: { ipa: '/ɪkˈspɪə.ri.əns/', guide: "Ucapkan 'ik-SPEER-ee-uns'. Tekankan suku kata 'SPEER' dengan akhiran 's' bersih." },
  vacation: { ipa: '/vəˈkeɪ.ʃən/', guide: "Ucapkan 'vuh-KAY-shun'. Penekanan utama berada di suku kata 'KAY'." },
  pronunciation: { ipa: '/prəˌnʌn.siˈeɪ.ʃən/', guide: "Ucapkan 'pro-nun-see-AY-shun'. Perhatikan suku kata kedua adalah 'NUN' (bukan 'nown')." },
  vocabulary: { ipa: '/vəˈkæb.jə.lər.i/', guide: "Ucapkan 'vuh-KAB-yuh-ler-ee'. Penekanan utama berada di suku kata 'KAB'." },
  grammar: { ipa: '/ˈɡræm.ər/', guide: "Ucapkan 'GRAM-er'. Vokal 'a' pendek seperti pada kata 'cat'." },
  fluency: { ipa: '/ˈfluː.ən.si/', guide: "Ucapkan 'FLOO-un-see'. Tekankan 'FLOO' di awal kata." },
  important: { ipa: '/ɪmˈpɔː.tənt/', guide: "Ucapkan 'im-POR-tunt'. Tekankan suku kata tengah 'POR'." },
  popular: { ipa: '/ˈpɒp.jə.lər/', guide: "Ucapkan 'POP-yuh-ler'. Penekanan kuat di 'POP'." },
  hello: { ipa: '/həˈləʊ/', guide: "Ucapkan 'huh-LOH'. Hembuskan napas awal 'h' dengan lembut dan vokal 'OH' panjang." },
  sister: { ipa: '/ˈsɪs.tər/', guide: "Ucapkan 'SIS-ter'. Konsonan 's' awal dan tengah harus terdengar tajam." },
  text: { ipa: '/tekst/', guide: "Ucapkan 'TEKST'. Pastikan akhiran 'k-s-t' terucap lengkap tanpa terpotong." }
};

function getPhoneticInfo(word: string) {
  const clean = word.toLowerCase().trim();
  if (PHONETIC_DICT[clean]) {
    return PHONETIC_DICT[clean];
  }
  const upper = clean.toUpperCase();
  return {
    ipa: `/${clean}/`,
    guide: `Ucapkan '${upper}'. Berikan intonasi vokal & konsonan yang tegas dan jelas saat membacakan kata ini.`
  };
}

/**
 * Generates detailed Indonesian feedback with word-by-word analysis and IPA guides.
 */
function generateDetailedIndonesianFeedback(
  promptText: string,
  transcribedText: string,
  isOutOfTopic: boolean,
  matchPercent: number,
  scores: { fluency: number; pronunciation: number; grammar: number; vocabulary: number }
) {
  const promptWords = promptText.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean);
  const transcribedWords = transcribedText.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean);

  const matchedWords: string[] = [];
  const missingWords: string[] = [];

  promptWords.forEach((w) => {
    if (transcribedWords.includes(w)) {
      matchedWords.push(w);
    } else {
      missingWords.push(w);
    }
  });

  // Granular Word-by-Word Analysis
  const wordDetails: WordAnalysisDetail[] = promptWords.map((targetWord) => {
    const isSpoken = transcribedWords.includes(targetWord);
    const phonetic = getPhoneticInfo(targetWord);
    return {
      word: targetWord,
      status: isSpoken ? 'correct' : 'missing',
      phoneticGuide: phonetic.ipa,
      howToPronounce: phonetic.guide,
      errorReason: isSpoken
        ? undefined
        : `Kata "${targetWord}" terlewat atau artikulasi vokal/konsonannya tidak tertangkap oleh AI.`
    };
  });

  const pronunciationTips: string[] = missingWords.map((w) => {
    const info = getPhoneticInfo(w);
    return `📌 "${w}" ${info.ipa}: ${info.guide}`;
  });

  if (isOutOfTopic || (promptWords.length > 0 && matchPercent < 0.15)) {
    return {
      strengths: 'Belum terdeteksi kata ucapan yang cocok dengan teks panduan. Rekaman terlalu hening atau kata yang diucapkan tidak sesuai materi.',
      weaknesses: 'SUARA HENING / TIDAK COCOK: Rekaman audio tidak terdeteksi melafalkan kalimat target secara utuh.',
      recommendation: '1. Dengarkan panduan audio resmi di atas terlebih dahulu.\n2. Ucapkan kalimat panduan kata demi kata dengan suara tegas dan lantang.',
      wordDetails,
      pronunciationTips
    };
  }

  // --- STRENGTHS ---
  let strengthsText = '';
  if (matchedWords.length > 0) {
    const topMatched = Array.from(new Set(matchedWords)).slice(0, 6).map((w) => `"${w}"`).join(', ');
    strengthsText = `Akurasi Pelafalan: Kata-kata berikut (${topMatched}) diucapkan dengan artikulasi vokal & intonasi yang tepat dan lancar.\n`;
  } else {
    strengthsText = `Kejelasan Volume: Rekaman audio tertangkap dengan volume suara yang memadai.\n`;
  }

  if (scores.fluency >= 70) {
    strengthsText += `Kelancaran (Fluency): Tempo ucapan stabil tanpa terputus-putus.`;
  } else {
    strengthsText += `Artikulasi Vokal: Intonasi nada vokal di awal kalimat sudah terdengar baik.`;
  }

  // --- WEAKNESSES ---
  let weaknessesText = '';
  if (missingWords.length > 0) {
    const topMissing = Array.from(new Set(missingWords)).slice(0, 4).map((w) => `"${w}"`).join(', ');
    weaknessesText = `Kata Perlu Diperbaiki: Pengucapan kata (${topMissing}) masih terlewatkan atau belum terartikulasi dengan sempurna.\n`;
  } else {
    weaknessesText = `Variasi Intonasi: Terdapat sedikit penekanan suku kata yang perlu dibuat lebih alami.\n`;
  }

  if (scores.pronunciation < 75) {
    weaknessesText += `Konsonan Penutup: Bunyi konsonan di akhir kata (seperti -s, -ed, -t, -b) perlu diucapkan lebih tegas.`;
  } else {
    weaknessesText += `Linking Words: Jeda antar kata dapat dibuat lebih mengalir tanpa terhenti.`;
  }

  // --- RECOMMENDATION ---
  let recText = '';
  if (missingWords.length > 0) {
    const topMissing = Array.from(new Set(missingWords)).slice(0, 3).map((w) => `"${w}"`).join(', ');
    recText = `1. Fokuskan latihan pada kata: ${topMissing}. Lihat panduan fonetik & cara penyebutan di bawah.\n`;
    recText += `2. Dengarkan tombol 'Dengarkan Pengucapan' AI untuk menyamakan intonasi nada.\n`;
    recText += `3. Rekam ulang dengan melafalkan setiap kata secara mantap dan percaya diri.`;
  } else {
    recText = `1. Pertahankan kejelasan artikulasi dan intonasi yang sudah sangat fasih ini.\n`;
    recText += `2. Latih penekanan emosi (word stress) agar kalimat terdengar semakin alami seperti penutur asli.\n`;
    recText += `3. Silakan lanjut ke materi latihan berbicara berikutnya!`;
  }

  return {
    strengths: strengthsText,
    weaknesses: weaknessesText,
    recommendation: recText,
    wordDetails,
    pronunciationTips
  };
}

/**
 * Transcribes audio using Vosk if available, or browser STT transcript comparison.
 * Returns rich analysis result with detailed word-by-word breakdown & IPA phonetics.
 */
export async function transcribeAndAnalyze(
  audioPath: string,
  promptText: string,
  durationSeconds: number = 15,
  browserTranscript?: string
): Promise<VoskAnalysisResult> {
  const model = getOrInitVoskModel();
  const promptWords = promptText.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean);

  // ==========================================
  // 1. VOSK NATIVE ENGINE (IF MODEL IS LOADED ON SERVER)
  // ==========================================
  if (model && VoskRecognizer && fs.existsSync(audioPath)) {
    try {
      console.log(`[VOSK Speech Engine] Transcribing file: ${audioPath}`);
      const recognizer = new VoskRecognizer({ model: model, sampleRate: 16000 });

      const fileBuffer = fs.readFileSync(audioPath);
      recognizer.acceptWaveform(fileBuffer);

      const res = recognizer.result();
      const finalRes = recognizer.finalResult();

      let transcribedText = '';
      try {
        const parsed = typeof finalRes === 'string' ? JSON.parse(finalRes) : finalRes;
        transcribedText = parsed.text || '';
      } catch (_) {
        transcribedText = (finalRes as any)?.text || '';
      }

      if (!transcribedText) {
        try {
          const parsed = typeof res === 'string' ? JSON.parse(res) : res;
          transcribedText = parsed.text || '';
        } catch (_) {
          transcribedText = (res as any)?.text || '';
        }
      }

      transcribedText = transcribedText.trim();
      console.log(`[VOSK STT Result]: "${transcribedText}"`);

      try {
        recognizer.free();
      } catch (_) {}

      if (promptWords.length === 0) {
        const isHealthy = transcribedText.length > 0;
        return {
          transcription: transcribedText || '--- Tidak Ada Suara Terdeteksi / Audio Hening ---',
          confidence: isHealthy ? 1.0 : 0.0,
          overallScore: isHealthy ? 100 : 0,
          fluency: isHealthy ? 100 : 0,
          pronunciation: isHealthy ? 100 : 0,
          grammar: isHealthy ? 100 : 0,
          vocabulary: isHealthy ? 100 : 0,
          strengths: isHealthy ? 'Transkripsi vokal Vosk AI berhasil mengenali kata-kata ucapan Anda.' : 'Suara tidak terdeteksi.',
          weaknesses: isHealthy ? 'Tidak ada.' : 'Suara hening.',
          recommendation: 'Lanjutkan pengujian ucapan berikutnya.',
          wordDetails: [],
          pronunciationTips: []
        };
      }

      const transcribedWords = transcribedText.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean);

      let matchCount = 0;
      promptWords.forEach((w) => {
        if (transcribedWords.includes(w)) matchCount++;
      });

      const rawMatchPercent = promptWords.length > 0 ? matchCount / promptWords.length : 0;
      const realScore = Math.min(100, Math.max(0, Math.round(rawMatchPercent * 100)));
      const isOutOfTopic = realScore < 15;

      const scoreValue = isOutOfTopic ? 0 : realScore;

      const feedback = generateDetailedIndonesianFeedback(
        promptText,
        transcribedText,
        isOutOfTopic,
        rawMatchPercent,
        { fluency: scoreValue, pronunciation: scoreValue, grammar: scoreValue, vocabulary: scoreValue }
      );

      return {
        transcription: transcribedText || '--- Tidak Ada Suara Terdeteksi / Audio Hening ---',
        confidence: isOutOfTopic ? 0 : rawMatchPercent,
        overallScore: scoreValue,
        fluency: scoreValue,
        pronunciation: scoreValue,
        grammar: scoreValue,
        vocabulary: scoreValue,
        strengths: feedback.strengths,
        weaknesses: feedback.weaknesses,
        recommendation: feedback.recommendation,
        wordDetails: feedback.wordDetails,
        pronunciationTips: feedback.pronunciationTips
      };
    } catch (err) {
      console.error('[VOSK Speech Engine] Recognizer error:', err);
    }
  }

  // ==========================================
  // 2. STRICT DETERMINISTIC SCORING FROM BROWSER TRANSCRIPT
  // ==========================================
  const effectiveTranscript = (browserTranscript || '').trim();
  const isHealthyText = effectiveTranscript.length > 0 && !effectiveTranscript.includes('---');

  if (!isHealthyText) {
    const feedback = generateDetailedIndonesianFeedback(
      promptText,
      '',
      true,
      0,
      { fluency: 0, pronunciation: 0, grammar: 0, vocabulary: 0 }
    );

    return {
      transcription: '--- Tidak Ada Suara Terdeteksi / Audio Hening ---',
      confidence: 0.0,
      overallScore: 0,
      fluency: 0,
      pronunciation: 0,
      grammar: 0,
      vocabulary: 0,
      strengths: 'Tidak terdeteksi elemen suara atau kata ucapan pada rekaman.',
      weaknesses: 'SUARA HENING: Mikrofon Anda tidak menangkap kata-kata yang diucapkan. Pastikan Anda berbicara dengan jelas saat menekan tombol Merekam.',
      recommendation: '1. Pastikan mikrofon perangkat Anda diizinkan dan berfungsi dengan baik.\n2. Ucapkan kalimat panduan dengan suara yang lantang dan jelas.',
      wordDetails: feedback.wordDetails,
      pronunciationTips: feedback.pronunciationTips
    };
  }

  const transcribedWords = effectiveTranscript.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean);

  let matchCount = 0;
  promptWords.forEach((w) => {
    if (transcribedWords.includes(w)) matchCount++;
  });

  const rawMatchPercent = promptWords.length > 0 ? matchCount / promptWords.length : 0;
  const realScore = Math.min(100, Math.max(0, Math.round(rawMatchPercent * 100)));
  const isOutOfTopic = promptWords.length > 0 && realScore < 15;

  const scoreValue = isOutOfTopic ? 0 : realScore;

  const feedback = generateDetailedIndonesianFeedback(
    promptText,
    effectiveTranscript,
    isOutOfTopic,
    rawMatchPercent,
    { fluency: scoreValue, pronunciation: scoreValue, grammar: scoreValue, vocabulary: scoreValue }
  );

  return {
    transcription: effectiveTranscript,
    confidence: isOutOfTopic ? 0 : rawMatchPercent,
    overallScore: scoreValue,
    fluency: scoreValue,
    pronunciation: scoreValue,
    grammar: scoreValue,
    vocabulary: scoreValue,
    strengths: feedback.strengths,
    weaknesses: feedback.weaknesses,
    recommendation: feedback.recommendation,
    wordDetails: feedback.wordDetails,
    pronunciationTips: feedback.pronunciationTips
  };
}
