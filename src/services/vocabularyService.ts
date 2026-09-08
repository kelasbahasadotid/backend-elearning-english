import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { getWordIPA } from '../utils/speechEngine';

export interface VocabularyRecordInput {
  userId: number;
  term: string;
  translation?: string | null;
  phoneticIpa?: string | null;
  contextSentence?: string | null;
  sourceType: 'QUIZ' | 'SPEAKING_AI' | 'LESSON' | 'MANUAL';
  sourceId?: number | null;
  sourceTitle?: string | null;
  notes?: string | null;
  masteryLevel?: 'NEW' | 'LEARNING' | 'MASTERED';
}

export interface VocabularyItem {
  id: number;
  user_id: number;
  term: string;
  normalized_term: string;
  translation: string | null;
  phonetic_ipa: string | null;
  context_sentence: string | null;
  source_type: 'QUIZ' | 'SPEAKING_AI' | 'LESSON' | 'MANUAL';
  source_id: number | null;
  source_title: string | null;
  encounter_count: number;
  is_duplicate: number;
  first_encountered_at: string;
  last_encountered_at: string;
  mastery_level: 'NEW' | 'LEARNING' | 'MASTERED';
  notes: string | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Normalizes term for clean comparison and duplicate detection
 */
export function normalizeTerm(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^\w\s'-]/g, '') // remove punctuations
    .replace(/\s+/g, ' ');      // normalize multiple spaces
}

/**
 * Record or update a vocabulary item in a student's personal room
 */
export async function recordVocabularyItem(input: VocabularyRecordInput) {
  const {
    userId,
    term,
    translation = null,
    phoneticIpa = null,
    contextSentence = null,
    sourceType,
    sourceId = null,
    sourceTitle = null,
    notes = null,
    masteryLevel = 'NEW'
  } = input;

  const cleanTerm = String(term || '').trim();
  const normalized = normalizeTerm(cleanTerm);

  // Ignore empty or trivial single-letter tokens
  if (!normalized || normalized.length < 2) {
    return null;
  }

  // Auto-generate IPA if not provided and term is reasonable length (up to 4 words)
  let finalIpa = phoneticIpa;
  if (!finalIpa && cleanTerm.split(/\s+/).length <= 4) {
    finalIpa = getWordIPA(cleanTerm);
  }

  const conn = await pool.getConnection();
  try {
    // 1. Check if term already exists in this student's room
    const [existingRows] = await conn.query<RowDataPacket[]>(
      'SELECT * FROM student_vocabularies WHERE user_id = ? AND normalized_term = ?',
      [userId, normalized]
    );

    if (existingRows && existingRows.length > 0) {
      // DUPLICATE ENCOUNTERED
      const existing = existingRows[0] as VocabularyItem;
      const newEncounterCount = Number(existing.encounter_count || 1) + 1;

      // Update primary vocabulary record
      await conn.query(
        `UPDATE student_vocabularies 
         SET encounter_count = encounter_count + 1,
             is_duplicate = 1,
             last_encountered_at = NOW(),
             translation = COALESCE(?, translation),
             phonetic_ipa = COALESCE(?, phonetic_ipa),
             context_sentence = COALESCE(?, context_sentence),
             source_type = ?,
             source_id = COALESCE(?, source_id),
             source_title = COALESCE(?, source_title)
         WHERE id = ?`,
        [
          translation || null,
          finalIpa || null,
          contextSentence || null,
          sourceType,
          sourceId || null,
          sourceTitle || null,
          existing.id
        ]
      );

      // Log encounter history
      await conn.query(
        `INSERT INTO student_vocabulary_encounters 
         (vocabulary_id, user_id, source_type, source_id, source_title, context_sentence, encounter_number)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [existing.id, userId, sourceType, sourceId || null, sourceTitle || null, contextSentence || null, newEncounterCount]
      );

      const [updatedRows] = await conn.query<RowDataPacket[]>(
        'SELECT * FROM student_vocabularies WHERE id = ?',
        [existing.id]
      );

      return {
        item: updatedRows[0] as VocabularyItem,
        isDuplicate: true,
        duplicateInfo: {
          previousCount: existing.encounter_count,
          currentCount: newEncounterCount,
          message: `Kata / kalimat "${cleanTerm}" sudah ada di kamus vocab Anda (ditemui ${newEncounterCount} kali). Riwayat perjumpaan telah dicatat.`
        }
      };
    } else {
      // NEW VOCABULARY ITEM
      const [insertResult] = await conn.query<ResultSetHeader>(
        `INSERT INTO student_vocabularies 
         (user_id, term, normalized_term, translation, phonetic_ipa, context_sentence, source_type, source_id, source_title, encounter_count, is_duplicate, mastery_level, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)`,
        [
          userId,
          cleanTerm,
          normalized,
          translation || null,
          finalIpa || null,
          contextSentence || null,
          sourceType,
          sourceId || null,
          sourceTitle || null,
          masteryLevel,
          notes || null
        ]
      );

      const newId = insertResult.insertId;

      // Log initial encounter
      await conn.query(
        `INSERT INTO student_vocabulary_encounters 
         (vocabulary_id, user_id, source_type, source_id, source_title, context_sentence, encounter_number)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [newId, userId, sourceType, sourceId || null, sourceTitle || null, contextSentence || null]
      );

      const [newRows] = await conn.query<RowDataPacket[]>(
        'SELECT * FROM student_vocabularies WHERE id = ?',
        [newId]
      );

      return {
        item: newRows[0] as VocabularyItem,
        isDuplicate: false,
        duplicateInfo: null
      };
    }
  } finally {
    conn.release();
  }
}

/**
 * Auto-extract vocabulary items from student quiz attempt
 */
export async function extractVocabFromQuiz(
  userId: number,
  assessmentId: number,
  quizTitle: string,
  questions: any[],
  userAnswers: any
) {
  if (!questions || !Array.isArray(questions)) return [];

  const recordedItems: any[] = [];

  for (const q of questions) {
    const qId = q.id;
    const userAns = Array.isArray(userAnswers) ? userAnswers.find((a: any) => a.questionId === qId) : userAnswers?.[qId];

    // MATCHING PAIRS (Type 5)
    if (q.question_type_id === 5) {
      const qOptions = q.options || [];
      for (const opt of qOptions) {
        const leftTerm = opt.option_label || opt.left;
        const rightMeaning = opt.option_text || opt.match;

        if (leftTerm && rightMeaning) {
          const res = await recordVocabularyItem({
            userId,
            term: String(leftTerm).trim(),
            translation: String(rightMeaning).trim(),
            contextSentence: `Pasangan kata dari Kuis: ${quizTitle} (Soal: ${q.question_text || q.title})`,
            sourceType: 'QUIZ',
            sourceId: assessmentId,
            sourceTitle: quizTitle
          });
          if (res) recordedItems.push(res);
        }
      }
    } 
    // FILL IN THE BLANK (Type 4)
    else if (q.question_type_id === 4 && userAns) {
      const typedAnswer = String(userAns.answerText || userAns.answer || '').trim();
      const correctOption = (q.options || []).find((o: any) => o.is_correct === 1);
      const correctAnswer = correctOption ? String(correctOption.option_text).trim() : '';

      if (typedAnswer) {
        const res = await recordVocabularyItem({
          userId,
          term: typedAnswer,
          translation: correctAnswer && correctAnswer.toLowerCase() !== typedAnswer.toLowerCase() ? `Kunci jawaban: ${correctAnswer}` : null,
          contextSentence: q.question_text || `Soal kuis: ${quizTitle}`,
          sourceType: 'QUIZ',
          sourceId: assessmentId,
          sourceTitle: quizTitle
        });
        if (res) recordedItems.push(res);
      }
    }
    // MULTIPLE CHOICE (Type 1), MULTIPLE ANSWER (Type 2), TRUE/FALSE (Type 3)
    else {
      const qOptions = q.options || [];
      const selectedOptionId = userAns?.selectedOptionId || (Array.isArray(userAns?.selectedOptionIds) ? userAns.selectedOptionIds[0] : null);
      const chosenOpt = qOptions.find((o: any) => o.id === Number(selectedOptionId));

      if (chosenOpt && chosenOpt.option_text) {
        const optText = String(chosenOpt.option_text).trim();
        // If option text is a word/phrase (not overly long paragraph)
        if (optText.length > 1 && optText.length <= 80) {
          const res = await recordVocabularyItem({
            userId,
            term: optText,
            translation: null,
            contextSentence: q.question_text || `Pilihan jawaban dari ${quizTitle}`,
            sourceType: 'QUIZ',
            sourceId: assessmentId,
            sourceTitle: quizTitle
          });
          if (res) recordedItems.push(res);
        }
      }
    }
  }

  return recordedItems;
}

/**
 * Auto-extract vocabulary items from student speaking AI attempt
 */
export async function extractVocabFromSpeaking(
  userId: number,
  promptId: number,
  promptTitle: string,
  promptText: string,
  transcription?: string,
  wordAnalysis?: any[]
) {
  const recordedItems: any[] = [];

  // 1. Record the whole prompt sentence
  if (promptText && promptText.trim().length > 1) {
    const res = await recordVocabularyItem({
      userId,
      term: promptText.trim(),
      contextSentence: `Latihan Speaking AI: ${promptTitle}`,
      sourceType: 'SPEAKING_AI',
      sourceId: promptId,
      sourceTitle: promptTitle
    });
    if (res) recordedItems.push(res);
  }

  // 2. Extract key words from prompt/wordAnalysis
  if (Array.isArray(wordAnalysis) && wordAnalysis.length > 0) {
    for (const w of wordAnalysis) {
      const word = String(w.word || '').trim();
      if (word && word.length >= 3) {
        const res = await recordVocabularyItem({
          userId,
          term: word,
          phoneticIpa: w.ipa || getWordIPA(word),
          contextSentence: `Kata dalam kalimat latihan speaking: "${promptText}"`,
          sourceType: 'SPEAKING_AI',
          sourceId: promptId,
          sourceTitle: promptTitle
        });
        if (res) recordedItems.push(res);
      }
    }
  } else if (promptText) {
    // Split words from promptText
    const words = promptText
      .split(/\s+/)
      .map(w => w.replace(/[^\w]/g, '').trim())
      .filter(w => w.length >= 4); // significant words (length >= 4)

    // Take unique words
    const uniqueWords = Array.from(new Set(words.map(w => w.toLowerCase())));
    for (const uw of uniqueWords.slice(0, 10)) { // limit up to 10 key words per prompt
      const res = await recordVocabularyItem({
        userId,
        term: uw,
        phoneticIpa: getWordIPA(uw),
        contextSentence: `Kata dalam latihan speaking: "${promptText}"`,
        sourceType: 'SPEAKING_AI',
        sourceId: promptId,
        sourceTitle: promptTitle
      });
      if (res) recordedItems.push(res);
    }
  }

  return recordedItems;
}

/**
 * Get student vocabulary room with filtering, search, sorting & analytics
 */
export async function getStudentVocabularyRoom(
  userId: number,
  options: {
    search?: string;
    sourceType?: string;
    masteryLevel?: string;
    onlyDuplicates?: boolean;
    sortBy?: 'recent' | 'frequent' | 'alpha' | 'oldest';
    page?: number;
    limit?: number;
  }
) {
  const {
    search = '',
    sourceType,
    masteryLevel,
    onlyDuplicates = false,
    sortBy = 'recent',
    page = 1,
    limit = 20
  } = options;

  const conditions: string[] = ['user_id = ?'];
  const params: any[] = [userId];

  if (search && search.trim()) {
    conditions.push('(term LIKE ? OR translation LIKE ? OR context_sentence LIKE ?)');
    const q = `%${search.trim()}%`;
    params.push(q, q, q);
  }

  if (sourceType) {
    conditions.push('source_type = ?');
    params.push(sourceType);
  }

  if (masteryLevel) {
    conditions.push('mastery_level = ?');
    params.push(masteryLevel);
  }

  if (onlyDuplicates) {
    conditions.push('encounter_count > 1');
  }

  const whereSql = conditions.join(' AND ');

  let orderSql = 'last_encountered_at DESC';
  if (sortBy === 'frequent') {
    orderSql = 'encounter_count DESC, last_encountered_at DESC';
  } else if (sortBy === 'alpha') {
    orderSql = 'term ASC';
  } else if (sortBy === 'oldest') {
    orderSql = 'first_encountered_at ASC';
  }

  const offset = (Math.max(1, page) - 1) * Math.max(1, limit);

  // Count total matching
  const [countRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) as total FROM student_vocabularies WHERE ${whereSql}`,
    params
  );
  const total = countRows[0]?.total || 0;

  // Fetch paginated data
  const [items] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM student_vocabularies WHERE ${whereSql} ORDER BY ${orderSql} LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  // Room Summary Statistics
  const [statsRows] = await pool.query<RowDataPacket[]>(`
    SELECT 
      COUNT(*) as total_words,
      COALESCE(SUM(CASE WHEN encounter_count > 1 THEN 1 ELSE 0 END), 0) as duplicate_words_count,
      COALESCE(SUM(CASE WHEN source_type = 'QUIZ' THEN 1 ELSE 0 END), 0) as quiz_words_count,
      COALESCE(SUM(CASE WHEN source_type = 'SPEAKING_AI' THEN 1 ELSE 0 END), 0) as speaking_words_count,
      COALESCE(SUM(CASE WHEN source_type = 'MANUAL' THEN 1 ELSE 0 END), 0) as manual_words_count,
      COALESCE(SUM(CASE WHEN mastery_level = 'MASTERED' THEN 1 ELSE 0 END), 0) as mastered_count,
      COALESCE(SUM(CASE WHEN mastery_level = 'LEARNING' THEN 1 ELSE 0 END), 0) as learning_count,
      COALESCE(SUM(CASE WHEN mastery_level = 'NEW' THEN 1 ELSE 0 END), 0) as new_count
    FROM student_vocabularies
    WHERE user_id = ?
  `, [userId]);

  const stats = statsRows[0] || {
    total_words: 0,
    duplicate_words_count: 0,
    quiz_words_count: 0,
    speaking_words_count: 0,
    manual_words_count: 0,
    mastered_count: 0,
    learning_count: 0,
    new_count: 0
  };

  return {
    summary: {
      totalWords: Number(stats.total_words),
      duplicateWordsCount: Number(stats.duplicate_words_count),
      quizWordsCount: Number(stats.quiz_words_count),
      speakingWordsCount: Number(stats.speaking_words_count),
      manualWordsCount: Number(stats.manual_words_count),
      masteredCount: Number(stats.mastered_count),
      learningCount: Number(stats.learning_count),
      newCount: Number(stats.new_count)
    },
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / limit)
    },
    vocabularies: items.map((item: any) => ({
      ...item,
      is_duplicate: item.encounter_count > 1,
      duplicate_message: item.encounter_count > 1 
        ? `Kata ini telah Anda jumpai sebanyak ${item.encounter_count} kali di latihan kuis / speaking.`
        : null
    }))
  };
}

/**
 * Get detailed vocabulary item with full encounter history
 */
export async function getVocabularyItemDetails(userId: number, vocabId: number) {
  const [vocabRows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM student_vocabularies WHERE id = ? AND user_id = ?',
    [vocabId, userId]
  );

  if (!vocabRows || vocabRows.length === 0) {
    throw new Error('Kata kosakata tidak ditemukan');
  }

  const [encounters] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM student_vocabulary_encounters WHERE vocabulary_id = ? AND user_id = ? ORDER BY encounter_number ASC',
    [vocabId, userId]
  );

  const item = vocabRows[0];
  return {
    vocabulary: item,
    isDuplicate: item.encounter_count > 1,
    duplicateCount: item.encounter_count,
    encounters
  };
}

/**
 * Check if a word already exists in student's vocabulary room (Duplicate Check)
 */
export async function checkWordDuplicate(userId: number, term: string) {
  const normalized = normalizeTerm(term);
  if (!normalized) {
    return { isDuplicate: false, message: 'Kata tidak valid' };
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM student_vocabularies WHERE user_id = ? AND normalized_term = ?',
    [userId, normalized]
  );

  if (rows && rows.length > 0) {
    const item = rows[0];
    const [encounters] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM student_vocabulary_encounters WHERE vocabulary_id = ? ORDER BY encounter_number DESC LIMIT 5',
      [item.id]
    );

    return {
      isDuplicate: true,
      term: item.term,
      encounterCount: item.encounter_count,
      firstEncounteredAt: item.first_encountered_at,
      lastEncounteredAt: item.last_encountered_at,
      message: `Kata "${item.term}" sudah tersimpan di kamus vocab Anda dan pernah dijumpai ${item.encounter_count} kali.`,
      item,
      recentEncounters: encounters
    };
  }

  return {
    isDuplicate: false,
    term,
    encounterCount: 0,
    message: `Kata "${term}" belum ada di kamus vocab Anda (kata baru).`
  };
}

/**
 * Update vocabulary item (notes, translation, mastery level)
 */
export async function updateVocabularyItem(
  userId: number,
  vocabId: number,
  data: {
    translation?: string;
    notes?: string;
    mastery_level?: 'NEW' | 'LEARNING' | 'MASTERED';
    phonetic_ipa?: string;
  }
) {
  const updates: string[] = [];
  const values: any[] = [];

  if (data.translation !== undefined) {
    updates.push('translation = ?');
    values.push(data.translation);
  }
  if (data.notes !== undefined) {
    updates.push('notes = ?');
    values.push(data.notes);
  }
  if (data.mastery_level !== undefined) {
    updates.push('mastery_level = ?');
    values.push(data.mastery_level);
  }
  if (data.phonetic_ipa !== undefined) {
    updates.push('phonetic_ipa = ?');
    values.push(data.phonetic_ipa);
  }

  if (updates.length === 0) {
    throw new Error('Tidak ada data yang diperbarui');
  }

  values.push(vocabId, userId);
  await pool.query(
    `UPDATE student_vocabularies SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
    values
  );

  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM student_vocabularies WHERE id = ? AND user_id = ?',
    [vocabId, userId]
  );
  return rows[0];
}

/**
 * Delete a vocabulary item from student's room
 */
export async function deleteVocabularyItem(userId: number, vocabId: number) {
  const [res] = await pool.query<ResultSetHeader>(
    'DELETE FROM student_vocabularies WHERE id = ? AND user_id = ?',
    [vocabId, userId]
  );
  if (res.affectedRows === 0) {
    throw new Error('Kata kosakata tidak ditemukan atau tidak memiliki akses');
  }
  return true;
}
