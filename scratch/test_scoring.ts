import { toIPA } from 'phonemize';

export interface WordAnalysisDetail {
  word: string;
  status: 'correct' | 'mispronounced' | 'missing';
  phoneticGuide: string;
  spokenAs?: string;
  similarity?: number;
  howToPronounce: string;
  errorReason?: string;
}

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
  } catch {}
  return `/${clean}/`;
}

export function generatePronunciationGuide(word: string, ipa: string): string {
  const clean = word.toLowerCase().trim();
  const curatedGuides: Record<string, string> = {
    describe: "Ucapkan 'di-SKRAIB'. Beri penekanan kuat pada suku kata 'skraib' dengan akhiran konsonan 'b' yang jelas.",
    favorite: "Ucapkan 'FAY-vuh-rit'. Berikan penekanan kuat di suku kata pertama 'FAY'.",
    travel: "Ucapkan 'TRAV-ul'. Bunyi 'v' jelas dengan bibir bawah menyentuh gigi atas.",
    destination: "Ucapkan 'des-ti-NAY-shun'. Tekankan suku kata 'NAY' sebelum akhiran '-shun'.",
    explain: "Ucapkan 'ik-SPLAYN'. Pastikan konsonan 'ks' dan 'pl' terdengar mengalir.",
    why: "Ucapkan 'WAI' dengan vokal terbuka yang bulat.",
    visiting: "Ucapkan 'VIZ-it-ing'. Huruf 's' berbunyi seperti 'z' lembut.",
    because: "Ucapkan 'bi-KOZ' atau 'bi-KUZ'. Vokal 'o' bulat dan akhiran 'z' lembut.",
    pronunciation: "Ucapkan 'pro-nun-see-AY-shun'. Perhatikan suku kata kedua adalah 'NUN' (bukan 'nown').",
    vocabulary: "Ucapkan 'vuh-KAB-yuh-ler-ee'. Penekanan utama berada di suku kata 'KAB'.",
    grammar: "Ucapkan 'GRAM-er'. Vokal 'a' pendek seperti pada kata 'cat'.",
    fluency: "Ucapkan 'FLOO-un-see'. Tekankan 'FLOO' di awal kata.",
    important: "Ucapkan 'im-POR-tunt'. Tekankan suku kata tengah 'POR'.",
  };

  if (curatedGuides[clean]) return curatedGuides[clean];

  const upper = clean.toUpperCase();
  return `Ucapkan '${upper}' ${ipa}. Berikan artikulasi vokal yang mantap dan ritme yang tegas.`;
}

function wordSimilarity(w1: string, w2: string): number {
  if (w1 === w2) return 1.0;
  if (!w1 || !w2) return 0.0;
  const s1 = w1.toLowerCase();
  const s2 = w2.toLowerCase();
  if (s1 === s2) return 1.0;

  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }

  const maxLen = Math.max(m, n);
  return Math.max(0, 1 - dp[m][n] / maxLen);
}

/**
 * Robust Speech Alignment using dynamic programming with strict alignment threshold
 */
export function alignWordSequences(
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
      const sim = wordSimilarity(promptWords[i - 1], spokenWords[j - 1]);
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
      const sim = wordSimilarity(promptWords[i - 1], spokenWords[j - 1]);
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

  const alignedPairs = rawPairs.map(p => {
    let status: 'correct' | 'mispronounced' | 'missing' | 'extra';
    if (p.promptWord && p.spokenWord) {
      if (p.similarity >= 0.85) {
        status = 'correct';
        correctCount++;
      } else if (p.similarity >= 0.55) {
        status = 'mispronounced';
        partialCount++;
      } else {
        // Under 0.55 similarity is not a true match
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

export function evaluateSpeech(promptText: string, transcribedText: string) {
  const cleanPrompt = (promptText || '').trim();
  const cleanTranscript = (transcribedText || '').trim();

  const promptWords = cleanPrompt.toLowerCase().replace(/[^\w\s'-]/g, '').split(/\s+/).filter(Boolean);
  const transcribedWords = cleanTranscript.toLowerCase().replace(/[^\w\s'-]/g, '').split(/\s+/).filter(Boolean);

  if (promptWords.length === 0) {
    return { overallScore: 100, fluency: 100, pronunciation: 100, grammar: 100, vocabulary: 100, wordDetails: [] };
  }

  if (transcribedWords.length === 0 || cleanTranscript.includes('---')) {
    const wordDetails = promptWords.map(w => {
      const ipa = getWordIPA(w);
      return {
        word: w,
        status: 'missing' as const,
        phoneticGuide: ipa,
        spokenAs: '-',
        similarity: 0,
        howToPronounce: generatePronunciationGuide(w, ipa),
        errorReason: `Kata "${w}" tidak terdengar dalam rekaman audio.`
      };
    });
    return {
      overallScore: 0,
      fluency: 0,
      pronunciation: 0,
      grammar: 0,
      vocabulary: 0,
      wordDetails,
      pronunciationTips: promptWords.slice(0, 4).map(w => `📌 "${w}" ${getWordIPA(w)}: ${generatePronunciationGuide(w, getWordIPA(w))}`),
      strengths: 'Suara belum terdeteksi pada mikrofon.',
      weaknesses: 'Rekaman hening atau mikrofon belum menangkap suara Anda.',
      recommendation: 'Pastikan mikrofon aktif dan ucapkan kalimat panduan secara jelas.'
    };
  }

  const { alignedPairs, correctCount, partialCount, missingCount, extraWords } = alignWordSequences(promptWords, transcribedWords);

  const wordDetails: WordAnalysisDetail[] = [];
  const mispronouncedList: Array<{ word: string; spoken: string; ipa: string }> = [];
  const missingList: Array<{ word: string; ipa: string }> = [];
  const correctList: Array<{ word: string; ipa: string }> = [];

  alignedPairs.forEach(pair => {
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

  // Build highly specific, informative, and natural Indonesian Feedback
  // 1. KELEBIHAN (STRENGTHS)
  let strengths = '';
  if (correctList.length > 0) {
    const correctNames = correctList.map(c => `"${c.word}" (${c.ipa})`).join(', ');
    strengths = `• Kata-kata yang diucapkan dengan benar (${correctList.length}/${totalWords} kata):\n  ${correctNames}\n`;
    if (correctCount >= totalWords * 0.8) {
      strengths += `• Intonasi dan kejelasan artikulasi sangat baik sepanjang kalimat.\n`;
    } else if (correctCount >= totalWords * 0.5) {
      strengths += `• Struktur pengucapan di bagian akhir kalimat terdengar jelas dan lancar.\n`;
    } else {
      strengths += `• Beberapa kata dasar berhasil dikenali dengan artikulasi yang cukup jelas.\n`;
    }
  } else {
    strengths = `• Volume rekaman audio tertangkap dengan jelas oleh mikrofon.\n`;
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
    weaknesses = `• Secara umum kalimat sudah terucap sangat baik. Latih penekanan emosi (word stress) agar semakin natural seperti penutur asli.\n`;
  }

  // 3. REKOMENDASI (RECOMMENDATIONS)
  let recommendation = '';
  const focusWords = [...mispronouncedList.map(m => m.word), ...missingList.map(m => m.word)];
  if (focusWords.length > 0) {
    const topFocus = Array.from(new Set(focusWords)).slice(0, 4);
    recommendation += `1. Fokuskan latihan pada kata yang bermasalah: ${topFocus.map(w => `"${w}" (${getWordIPA(w)})`).join(', ')}.\n`;
    recommendation += `2. Klik tombol speaker 🔊 pada masing-masing kartu kata di bawah untuk mendengarkan fonetiknya secara terpisah.\n`;
    recommendation += `3. Dengarkan tombol 'Putar Contoh Pelafalan Teks' untuk menirukan intonasi dan jeda antar kata secara runtut.\n`;
    recommendation += `4. Rekam kembali dengan berbicara perlahan, artikulasi vokal/konsonan tegas, dan percaya diri.`;
  } else {
    recommendation = `1. Pelafalan dan intonasi Anda sudah sangat luar biasa!\n2. Silakan lanjut ke materi latihan Speaking berikutnya.`;
  }

  const pronunciationTips = focusWords.slice(0, 5).map(w => `📌 "${w}" ${getWordIPA(w)}: ${generatePronunciationGuide(w, getWordIPA(w))}`);

  return {
    overallScore,
    fluency,
    pronunciation,
    grammar,
    vocabulary,
    wordDetails,
    pronunciationTips,
    strengths: strengths.trim(),
    weaknesses: weaknesses.trim(),
    recommendation: recommendation.trim()
  };
}

const prompt = "Describe your favorite travel destination and explain why you love visiting it.";
const transcript = "what your how far is there traffic Lee definitely on and explain where you love visiting it";

console.log("=== ENHANCED DYNAMIC FEEDBACK TEST ===");
const res = evaluateSpeech(prompt, transcript);
console.log("Overall Score:", res.overallScore, "%");
console.log("Fluency:", res.fluency, "%");
console.log("Pronunciation:", res.pronunciation, "%");
console.log("Grammar:", res.grammar, "%");
console.log("Vocabulary:", res.vocabulary, "%");
console.log("\n--- KELEBIHAN ---\n" + res.strengths);
console.log("\n--- PERLU DITINGKATKAN ---\n" + res.weaknesses);
console.log("\n--- REKOMENDASI ---\n" + res.recommendation);
