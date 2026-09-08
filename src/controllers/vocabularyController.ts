import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import {
  getStudentVocabularyRoom,
  getVocabularyItemDetails,
  checkWordDuplicate,
  recordVocabularyItem,
  updateVocabularyItem,
  deleteVocabularyItem
} from '../services/vocabularyService';

/**
 * Get logged-in student's vocabulary room
 */
export const getMyVocabularyRoom = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const {
      search,
      source_type,
      mastery_level,
      only_duplicates,
      sort_by,
      page,
      limit
    } = req.query;

    const data = await getStudentVocabularyRoom(userId, {
      search: search ? String(search) : undefined,
      sourceType: source_type ? String(source_type) : undefined,
      masteryLevel: mastery_level ? String(mastery_level) : undefined,
      onlyDuplicates: only_duplicates === 'true' || only_duplicates === '1',
      sortBy: (sort_by as any) || 'recent',
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20
    });

    res.json(data);
  } catch (error: any) {
    console.error('Failed to get vocabulary room:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

/**
 * Get single vocabulary item details with encounter history
 */
export const getVocabularyDetails = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const vocabId = Number(req.params.id);

    if (!userId || !vocabId) {
      res.status(400).json({ error: 'Invalid vocabulary ID' });
      return;
    }

    const details = await getVocabularyItemDetails(userId, vocabId);
    res.json(details);
  } catch (error: any) {
    console.error('Failed to get vocabulary details:', error);
    res.status(404).json({ error: error.message || 'Vocabulary item not found' });
  }
};

/**
 * Check if a word or sentence already exists in student's room (Duplicate Check)
 */
export const checkVocabularyDuplicate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { term } = req.body;

    if (!userId || !term) {
      res.status(400).json({ error: 'Field term wajib diisi' });
      return;
    }

    const checkResult = await checkWordDuplicate(userId, String(term));
    res.json(checkResult);
  } catch (error: any) {
    console.error('Failed to check duplicate:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

/**
 * Manually add a vocabulary item to student's room
 */
export const createManualVocabulary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { term, translation, context_sentence, notes, phonetic_ipa } = req.body;

    if (!userId || !term || !String(term).trim()) {
      res.status(400).json({ error: 'Field term (kata/kalimat) wajib diisi' });
      return;
    }

    const result = await recordVocabularyItem({
      userId,
      term: String(term).trim(),
      translation: translation ? String(translation).trim() : null,
      contextSentence: context_sentence ? String(context_sentence).trim() : null,
      notes: notes ? String(notes).trim() : null,
      phoneticIpa: phonetic_ipa ? String(phonetic_ipa).trim() : null,
      sourceType: 'MANUAL',
      sourceTitle: 'Ditambahkan Manual oleh Siswa'
    });

    if (!result) {
      res.status(400).json({ error: 'Kata atau kalimat tidak valid' });
      return;
    }

    const statusCode = result.isDuplicate ? 200 : 201;
    res.status(statusCode).json({
      message: result.isDuplicate 
        ? `Kata "${term}" sudah ada sebelumnya. Jumlah perjumpaan dinaikkan menjadi ${result.item.encounter_count}x.` 
        : `Kata "${term}" berhasil ditambahkan ke kamus vocab Anda.`,
      data: result
    });
  } catch (error: any) {
    console.error('Failed to add manual vocabulary:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

/**
 * Update vocabulary notes, translation, or mastery level
 */
export const updateVocabulary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const vocabId = Number(req.params.id);

    if (!userId || !vocabId) {
      res.status(400).json({ error: 'Invalid vocabulary ID' });
      return;
    }

    const { translation, notes, mastery_level, phonetic_ipa } = req.body;

    const updated = await updateVocabularyItem(userId, vocabId, {
      translation,
      notes,
      mastery_level,
      phonetic_ipa
    });

    res.json({
      message: 'Kosakata berhasil diperbarui',
      vocabulary: updated
    });
  } catch (error: any) {
    console.error('Failed to update vocabulary:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

/**
 * Delete a vocabulary item from room
 */
export const deleteVocabulary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const vocabId = Number(req.params.id);

    if (!userId || !vocabId) {
      res.status(400).json({ error: 'Invalid vocabulary ID' });
      return;
    }

    await deleteVocabularyItem(userId, vocabId);
    res.json({ message: 'Kosakata berhasil dihapus dari kamus Anda' });
  } catch (error: any) {
    console.error('Failed to delete vocabulary:', error);
    res.status(404).json({ error: error.message || 'Gagal menghapus kosakata' });
  }
};

/**
 * Admin endpoint: view student's vocabulary room
 */
export const getStudentVocabularyAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = Number(req.params.userId);
    if (!userId) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }

    const {
      search,
      source_type,
      mastery_level,
      only_duplicates,
      sort_by,
      page,
      limit
    } = req.query;

    const data = await getStudentVocabularyRoom(userId, {
      search: search ? String(search) : undefined,
      sourceType: source_type ? String(source_type) : undefined,
      masteryLevel: mastery_level ? String(mastery_level) : undefined,
      onlyDuplicates: only_duplicates === 'true' || only_duplicates === '1',
      sortBy: (sort_by as any) || 'recent',
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20
    });

    res.json(data);
  } catch (error: any) {
    console.error('Failed to get student vocabulary for admin:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
