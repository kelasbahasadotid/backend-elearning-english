import fs from 'fs';
import path from 'path';
import { toIPA } from 'phonemize';

let voskLoaded = false;
let VoskModel: any = null;
let VoskRecognizer: any = null;
let cachedModelInstance: any = null;

try {
  const vosk = require('vosk');
  VoskModel = vosk.Model;
  VoskRecognizer = vosk.Recognizer;
  voskLoaded = true;
} catch (err: any) {
  // Vosk native addon is optional; engine runs smoothly in deterministic phonetic alignment mode
  voskLoaded = false;
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
  spokenAs?: string;
  similarity?: number;
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

/**
 * Returns accurate IPA notation for an English word using phonemize.
 */
export function getWordIPA(word: string): string {
  if (!word || typeof word !== 'string') return '';
  const clean = word.toLowerCase().trim().replace(/[^\w\s'-]/g, '');
  if (!clean) return '';

  try {
    const ipa = toIPA(clean);
    if (ipa && ipa.trim()) {
      const formatted = ipa.trim().replace(/^[\/\[]/, '').replace(/[\/\]]$/, '').trim();
      return `/${formatted}/`;
    }
  } catch {
    // ignore
  }

  return `/${clean}/`;
}

/**
 * Generates an intuitive Indonesian pronunciation guide for a word.
 */
export function generatePronunciationGuide(word: string, ipa: string): string {
  const clean = word.toLowerCase().trim();

  const curatedGuides: Record<string, string> = {
    describe: "Ucapkan 'di-SKRAIB'. Tekankan suku kata 'SKRAIB' dengan artikulasi vokal 'ai' dan lepaskan konsonan 'b' tegas di akhir.",
    favorite: "Ucapkan 'FAY-vuh-rit'. Tekankan suku kata pertama 'FAY' dan bunyikan 'v' dengan bibir bawah pada gigi atas.",
    travel: "Ucapkan 'TRAV-ul'. Bunyi 'v' diucapkan jelas dengan getaran vokal bulat.",
    destination: "Ucapkan 'des-ti-NAY-shun'. Tekankan suku kata 'NAY' sebelum akhiran '-shun' yang mengalir.",
    explain: "Ucapkan 'ik-SPLAYN'. Pastikan bunyi konsonan 'ks' dan 'pl' terdengar runtut tanpa terputus.",
    why: "Ucapkan 'WAI' dengan vokal terbuka bulat tanpa mendengung.",
    visiting: "Ucapkan 'VIZ-it-ing'. Huruf 's' berbunyi seperti 'z' lembut dan akhiran '-ing' terdengar jelas.",
    because: "Ucapkan 'bi-KOZ' atau 'bi-KUZ'. Vokal 'o' bulat dan akhiran 'z' lembut di ujung kata.",
    pronunciation: "Ucapkan 'pro-nun-see-AY-shun'. Suku kata kedua adalah 'NUN' (bukan 'nown') dengan penekanan di 'AY'.",
    vocabulary: "Ucapkan 'vuh-KAB-yuh-ler-ee'. Penekanan utama pada 'KAB' dengan artikulasi vokal yang jelas.",
    grammar: "Ucapkan 'GRAM-er'. Vokal 'a' pendek seperti pada kata 'cat'.",
    fluency: "Ucapkan 'FLOO-un-see'. Tekankan 'FLOO' di awal kata.",
    important: "Ucapkan 'im-POR-tunt'. Tekankan suku kata tengah 'POR'.",
    perseverance: "Ucapkan 'pur-suh-VEER-uns'. Tekankan kuat pada suku kata 'VEER'.",
    eloquent: "Ucapkan 'EL-uh-kwunt'. Penekanan di awal 'EL' dan artikulasi 'kw' yang bersih.",
    resilience: "Ucapkan 'ri-ZIL-yuns'. Berikan getaran 'z' dan penekanan di suku kata 'ZIL'.",
    technology: "Ucapkan 'tek-NOL-uh-jee'. Penekanan utama berada di suku kata 'NOL'.",
    experience: "Ucapkan 'ik-SPEER-ee-uns'. Tekankan suku kata 'SPEER' dengan akhiran 's' bersih.",
    weather: "Ucapkan 'WE-ther'. Konsonan 'th' diucapkan dengan ujung lidah di antara gigi atas dan bawah.",
    country: "Ucapkan 'KUN-tree'. Vokal 'u' pendek dan akhiran 'tree' yang tegas.",
    english: "Ucapkan 'ING-glish'. Tekankan 'ING' dan akhiran desis '-sh' yang mengalir.",
    speaking: "Ucapkan 'SPEEK-ing'. Vokal 'ee' panjang dan akhiran nasal '-ng' terdengar bersih.",
    practice: "Ucapkan 'PRAK-tis'. Penekanan di suku kata pertama 'PRAK' dan akhiran 's' tipis.",
    student: "Ucapkan 'STOO-dunt' atau 'STYOO-dunt'. Tekankan suku kata pertama 'STOO'.",
    teacher: "Ucapkan 'TEE-cher'. Tekankan suku kata pertama 'TEE' dengan konsonan '-cher' yang mengalir.",
    learning: "Ucapkan 'LUR-ning'. Tekankan 'LUR' dengan bunyi vokal bulat.",
    language: "Ucapkan 'LANG-gwij'. Penekanan di 'LANG' dan akhiran konsonan 'j' tajam.",
    confidence: "Ucapkan 'KON-fi-duns'. Tekankan suku kata awal 'KON'."
  };

  if (curatedGuides[clean]) {
    return curatedGuides[clean];
  }

  const upper = clean.toUpperCase();
  const lastChar = clean.slice(-1);
  let suffixTip = '';
  if (['t', 'd', 'p', 'b', 'k', 'g'].includes(lastChar)) {
    suffixTip = ` Perjelas pelepasan konsonan akhir '${lastChar.toUpperCase()}'.`;
  } else if (clean.endsWith('tion') || clean.endsWith('sion')) {
    suffixTip = " Beri intonasi '-shun' yang lembut di ujung kata.";
  } else if (clean.endsWith('ed')) {
    suffixTip = " Bunyikan akhiran '-ed' sesuai aturan fonetik konsonan sebelumnya.";
  } else if (clean.endsWith('ing')) {
    suffixTip = " Pastikan akhiran nasal '-ng' terdengar jelas tanpa menelan huruf.";
  } else if (clean.endsWith('s') || clean.endsWith('es')) {
    suffixTip = " Bunyikan desis konsonan 's' atau 'z' di akhir kata.";
  } else if (clean.endsWith('th')) {
    suffixTip = " Tempatkan ujung lidah di antara gigi untuk membunyikan konsonan 'th'.";
  }

  return `Ucapkan '${upper}' ${ipa}. Artikulasikan vokal secara tegas dan perhatikan ritme kata.${suffixTip}`;
}

/**
 * Calculates string similarity using Levenshtein distance (0.0 to 1.0).
 */
function calculateWordSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;
  if (!a || !b) return 0.0;

  const s1 = a.toLowerCase();
  const s2 = b.toLowerCase();
  if (s1 === s2) return 1.0;

  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  const distance = dp[m][n];
  const maxLen = Math.max(m, n);
  return Math.max(0, 1 - distance / maxLen);
}

/**
 * Sequential Sequence Alignment Algorithm (Needleman-Wunsch for Word Sequences)
 */
function alignWordSequences(
  promptWords: string[],
  spokenWords: string[]
): {
  alignedPairs: Array<{ promptWord: string | null; spokenWord: string | null; similarity: number; status: 'correct' | 'mispronounced' | 'missing' | 'extra' }>;
  correctCount: number;
  partialCount: number;
  missingCount: number;
  extraWords: string[];
} {
  const M = promptWords.length;
  const N = spokenWords.length;

  const MATCH_REWARD = 2.5;
  const GAP_PROMPT_PENALTY = -1.0;
  const GAP_SPOKEN_PENALTY = -0.8;
  const MISMATCH_PENALTY = -2.0;

  const dp: number[][] = Array.from({ length: M + 1 }, () => Array(N + 1).fill(0));

  for (let i = 0; i <= M; i++) dp[i][0] = i * GAP_PROMPT_PENALTY;
  for (let j = 0; j <= N; j++) dp[0][j] = j * GAP_SPOKEN_PENALTY;

  for (let i = 1; i <= M; i++) {
    for (let j = 1; j <= N; j++) {
      const sim = calculateWordSimilarity(promptWords[i - 1], spokenWords[j - 1]);
      let pairScore: number;
      if (sim >= 0.85) {
        pairScore = MATCH_REWARD * sim;
      } else if (sim >= 0.55) {
        pairScore = MATCH_REWARD * 0.4 * sim;
      } else {
        pairScore = MISMATCH_PENALTY;
      }

      dp[i][j] = Math.max(
        dp[i - 1][j - 1] + pairScore,
        dp[i - 1][j] + GAP_PROMPT_PENALTY,
        dp[i][j - 1] + GAP_SPOKEN_PENALTY
      );
    }
  }

  let i = M;
  let j = N;
  const rawPairs: Array<{ promptWord: string | null; spokenWord: string | null; similarity: number }> = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const sim = calculateWordSimilarity(promptWords[i - 1], spokenWords[j - 1]);
      let pairScore: number;
      if (sim >= 0.85) {
        pairScore = MATCH_REWARD * sim;
      } else if (sim >= 0.55) {
        pairScore = MATCH_REWARD * 0.4 * sim;
      } else {
        pairScore = MISMATCH_PENALTY;
      }

      if (Math.abs(dp[i][j] - (dp[i - 1][j - 1] + pairScore)) < 1e-4) {
        rawPairs.push({
          promptWord: promptWords[i - 1],
          spokenWord: spokenWords[j - 1],
          similarity: sim
        });
        i--;
        j--;
        continue;
      }
    }

    if (i > 0 && Math.abs(dp[i][j] - (dp[i - 1][j] + GAP_PROMPT_PENALTY)) < 1e-4) {
      rawPairs.push({
        promptWord: promptWords[i - 1],
        spokenWord: null,
        similarity: 0
      });
      i--;
    } else if (j > 0) {
      rawPairs.push({
        promptWord: null,
        spokenWord: spokenWords[j - 1],
        similarity: 0
      });
      j--;
    } else {
      break;
    }
  }

  rawPairs.reverse();

  let correctCount = 0;
  let partialCount = 0;
  let missingCount = 0;
  const extraWords: string[] = [];

  const alignedPairs = rawPairs.map((p) => {
    let status: 'correct' | 'mispronounced' | 'missing' | 'extra';
    if (p.promptWord && p.spokenWord) {
      if (p.similarity >= 0.85) {
        status = 'correct';
        correctCount++;
      } else if (p.similarity >= 0.55) {
        status = 'mispronounced';
        partialCount++;
      } else {
        status = 'missing';
        missingCount++;
      }
    } else if (p.promptWord && !p.spokenWord) {
      status = 'missing';
      missingCount++;
    } else {
      status = 'extra';
      if (p.spokenWord) extraWords.push(p.spokenWord);
    }
    return { ...p, status };
  });

  return {
    alignedPairs,
    correctCount,
    partialCount,
    missingCount,
    extraWords
  };
}

/**
 * Analyzes the student's spoken transcript against the target prompt sentence with high precision.
 */
export function analyzeSpeechAccuracy(
  promptText: string,
  transcribedText: string
): {
  overallScore: number;
  fluency: number;
  pronunciation: number;
  grammar: number;
  vocabulary: number;
  confidence: number;
  wordDetails: WordAnalysisDetail[];
  pronunciationTips: string[];
  strengths: string;
  weaknesses: string;
  recommendation: string;
} {
  const cleanPrompt = (promptText || '').trim();
  const cleanTranscript = (transcribedText || '').trim();

  const promptWords = cleanPrompt
    .toLowerCase()
    .replace(/[^\w\s'-]/g, '')
    .split(/\s+/)
    .filter(Boolean);

  const transcribedWords = cleanTranscript
    .toLowerCase()
    .replace(/[^\w\s'-]/g, '')
    .split(/\s+/)
    .filter(Boolean);

  // If prompt is empty
  if (promptWords.length === 0) {
    return {
      overallScore: 100,
      fluency: 100,
      pronunciation: 100,
      grammar: 100,
      vocabulary: 100,
      confidence: 1.0,
      wordDetails: [],
      pronunciationTips: [],
      strengths: 'Kalimat target kosong.',
      weaknesses: 'Tidak ada.',
      recommendation: 'Lanjutkan ke latihan berikutnya.'
    };
  }

  // If student did not speak or silence detected
  if (transcribedWords.length === 0 || cleanTranscript.includes('---')) {
    const wordDetails: WordAnalysisDetail[] = promptWords.map((word) => {
      const ipa = getWordIPA(word);
      return {
        word,
        status: 'missing',
        phoneticGuide: ipa,
        spokenAs: '-',
        similarity: 0,
        howToPronounce: generatePronunciationGuide(word, ipa),
        errorReason: `Kata "${word}" tidak terdengar dalam rekaman audio.`
      };
    });

    const pronunciationTips = promptWords.slice(0, 5).map((w) => {
      const ipa = getWordIPA(w);
      return `📌 "${w}" ${ipa}: ${generatePronunciationGuide(w, ipa)}`;
    });

    return {
      overallScore: 0,
      fluency: 0,
      pronunciation: 0,
      grammar: 0,
      vocabulary: 0,
      confidence: 0,
      wordDetails,
      pronunciationTips,
      strengths: '• Volume suara belum terdeteksi pada rekaman mikrofon.',
      weaknesses: '• Suara hening: Mikrofon tidak menangkap kata-kata yang diucapkan. Pastikan izin mikrofon aktif dan berbicara dengan suara jelas.',
      recommendation: '1. Pastikan mikrofon perangkat berfungsi dan peramban diizinkan mengakses mikrofon.\n2. Dengarkan contoh audio pelafalan di atas.\n3. Ucapkan kalimat panduan kata demi kata secara lantang.'
    };
  }

  // Sequential Sequence Alignment
  const { alignedPairs, correctCount, partialCount, missingCount, extraWords } = alignWordSequences(promptWords, transcribedWords);

  const wordDetails: WordAnalysisDetail[] = [];
  const mispronouncedList: Array<{ word: string; spoken: string; ipa: string }> = [];
  const missingList: Array<{ word: string; ipa: string }> = [];
  const correctList: Array<{ word: string; ipa: string }> = [];

  alignedPairs.forEach((pair) => {
    if (pair.promptWord) {
      const ipa = getWordIPA(pair.promptWord);
      let errorReason: string | undefined;

      if (pair.status === 'correct') {
        correctList.push({ word: pair.promptWord, ipa });
      } else if (pair.status === 'mispronounced') {
        mispronouncedList.push({ word: pair.promptWord, spoken: pair.spokenWord || '-', ipa });
        errorReason = `Terdengar sebagai "${pair.spokenWord}". Fonetik yang benar adalah ${ipa}.`;
      } else if (pair.status === 'missing') {
        missingList.push({ word: pair.promptWord, ipa });
        errorReason = `Kata "${pair.promptWord}" terlewatkan atau tidak terdengar (${ipa}).`;
      }

      wordDetails.push({
        word: pair.promptWord,
        status: pair.status as 'correct' | 'mispronounced' | 'missing',
        phoneticGuide: ipa,
        spokenAs: pair.spokenWord || '-',
        similarity: Math.round((pair.similarity || 0) * 100),
        howToPronounce: generatePronunciationGuide(pair.promptWord, ipa),
        errorReason
      });
    }
  });

  const totalWords = promptWords.length;
  const extraCount = extraWords.length;

  // Strict, realistic scoring:
  const correctWeight = correctCount * 1.0;
  const partialWeight = partialCount * 0.4;
  const rawCorrectness = (correctWeight + partialWeight) / totalWords;

  // Extra penalty (max 25%)
  const extraPenalty = Math.min(0.25, (extraCount / totalWords) * 0.25);

  const pronunciation = Math.max(0, Math.min(100, Math.round((rawCorrectness - extraPenalty * 0.6) * 100)));
  const fluencyRatio = Math.max(0, (correctCount / totalWords) - (extraCount / (totalWords * 1.5)) - (missingCount / (totalWords * 2)));
  const fluency = Math.max(0, Math.min(100, Math.round(fluencyRatio * 100)));
  const grammarRatio = Math.max(0, (correctCount / totalWords) - (missingCount / totalWords) * 0.4 - (extraCount / totalWords) * 0.3);
  const grammar = Math.max(0, Math.min(100, Math.round(grammarRatio * 100)));
  const vocabRatio = Math.max(0, (correctCount / totalWords) - (extraCount / (totalWords * 2)));
  const vocabulary = Math.max(0, Math.min(100, Math.round(vocabRatio * 100)));

  const overallScore = Math.max(0, Math.min(100, Math.round(
    pronunciation * 0.40 +
    fluency * 0.30 +
    grammar * 0.15 +
    vocabulary * 0.15
  )));

  // Dynamic Indonesian Feedback
  // 1. KELEBIHAN (STRENGTHS)
  let strengths = '';
  if (correctList.length > 0) {
    const correctNames = correctList.map(c => `"${c.word}" (${c.ipa})`).join(', ');
    strengths = `• Kata-kata yang diucapkan dengan benar (${correctList.length}/${totalWords} kata):\n  ${correctNames}\n`;
    if (correctCount >= totalWords * 0.8) {
      strengths += `• Intonasi dan artikulasi vokal sangat baik di seluruh kalimat.`;
    } else if (correctCount >= totalWords * 0.5) {
      strengths += `• Struktur pengucapan di bagian akhir kalimat terdengar jelas dan mengalir.`;
    } else {
      strengths += `• Beberapa kata berhasil diucapkan dengan artikulasi yang cukup jelas.`;
    }
  } else {
    strengths = `• Volume rekaman audio tertangkap dengan jelas oleh mikrofon.`;
  }

  // 2. PERLU DITINGKATKAN (WEAKNESSES)
  let weaknesses = '';
  if (mispronouncedList.length > 0) {
    const misDetails = mispronouncedList.map(m => `"${m.word}" (terdengar seperti "${m.spoken}", seharusnya ${m.ipa})`).join(', ');
    weaknesses += `• Pelafalan kurang tepat pada kata:\n  ${misDetails}\n`;
  }
  if (missingList.length > 0) {
    const missingNames = missingList.map(m => `"${m.word}" (${m.ipa})`).join(', ');
    weaknesses += `• Kata yang terlewat / tidak terdeteksi:\n  ${missingNames}\n`;
  }
  if (extraWords.length > 0) {
    const extraNames = extraWords.map(e => `"${e}"`).join(', ');
    weaknesses += `• Kata sisipan / bunyi tambahan yang tidak ada dalam teks target:\n  ${extraNames}\n`;
  }
  if (!weaknesses) {
    weaknesses = `• Secara umum kalimat sudah terucap sangat baik. Latih variasi intonasi emosi (word stress) agar semakin natural seperti penutur asli.`;
  }

  // 3. REKOMENDASI (RECOMMENDATIONS)
  let recommendation = '';
  const focusWords = [...mispronouncedList.map(m => m.word), ...missingList.map(m => m.word)];
  if (focusWords.length > 0) {
    const topFocus = Array.from(new Set(focusWords)).slice(0, 4);
    recommendation += `1. Fokuskan latihan pada kata: ${topFocus.map(w => `"${w}" (${getWordIPA(w)})`).join(', ')}.\n`;
    recommendation += `2. Klik tombol speaker 🔊 pada kartu kata di bawah untuk mendengarkan fonetiknya satu per satu.\n`;
    recommendation += `3. Dengarkan tombol 'Putar Contoh Pelafalan Teks' untuk menirukan intonasi dan jeda antar kata secara runtut.\n`;
    recommendation += `4. Rekam kembali dengan berbicara perlahan, artikulasi vokal/konsonan tegas, dan percaya diri.`;
  } else {
    recommendation = `1. Pelafalan dan intonasi Anda sudah sangat luar biasa!\n2. Silakan lanjut ke materi latihan Speaking berikutnya.`;
  }

  const pronunciationTips = focusWords.slice(0, 5).map((w) => `📌 "${w}" ${getWordIPA(w)}: ${generatePronunciationGuide(w, getWordIPA(w))}`);

  return {
    overallScore,
    fluency,
    pronunciation,
    grammar,
    vocabulary,
    confidence: rawCorrectness,
    wordDetails,
    pronunciationTips,
    strengths: strengths.trim(),
    weaknesses: weaknesses.trim(),
    recommendation: recommendation.trim()
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
  let recognizedText = (browserTranscript || '').trim();

  // 1. If Vosk native model is present on server, try Vosk transcription
  if (model && VoskRecognizer && fs.existsSync(audioPath)) {
    try {
      console.log(`[VOSK Speech Engine] Transcribing file: ${audioPath}`);
      const recognizer = new VoskRecognizer({ model: model, sampleRate: 16000 });

      const fileBuffer = fs.readFileSync(audioPath);
      recognizer.acceptWaveform(fileBuffer);

      const res = recognizer.result();
      const finalRes = recognizer.finalResult();

      let voskText = '';
      try {
        const parsed = typeof finalRes === 'string' ? JSON.parse(finalRes) : finalRes;
        voskText = parsed.text || '';
      } catch (_) {
        voskText = (finalRes as any)?.text || '';
      }

      if (!voskText) {
        try {
          const parsed = typeof res === 'string' ? JSON.parse(res) : res;
          voskText = parsed.text || '';
        } catch (_) {
          voskText = (res as any)?.text || '';
        }
      }

      if (voskText && voskText.trim()) {
        recognizedText = voskText.trim();
        console.log(`[VOSK STT Result]: "${recognizedText}"`);
      }

      try {
        recognizer.free();
      } catch (_) {}
    } catch (err) {
      console.error('[VOSK Speech Engine] Recognizer error:', err);
    }
  }

  // 2. Perform accurate speech accuracy analysis & IPA generation
  const analysis = analyzeSpeechAccuracy(promptText, recognizedText);

  return {
    transcription: recognizedText || '--- Tidak Ada Suara Terdeteksi / Audio Hening ---',
    confidence: analysis.confidence,
    overallScore: analysis.overallScore,
    fluency: analysis.fluency,
    pronunciation: analysis.pronunciation,
    grammar: analysis.grammar,
    vocabulary: analysis.vocabulary,
    strengths: analysis.strengths,
    weaknesses: analysis.weaknesses,
    recommendation: analysis.recommendation,
    wordDetails: analysis.wordDetails,
    pronunciationTips: analysis.pronunciationTips
  };
}
