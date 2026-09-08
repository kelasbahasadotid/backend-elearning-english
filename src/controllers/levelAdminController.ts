import { Request, Response } from 'express';
import {
  getAllLevels,
  upsertLevel,
  deleteLevel as deleteLevelService,
  bulkSaveLevels
} from '../services/levelService';

/**
 * Get all gamification levels
 */
export const getLevels = async (req: Request, res: Response) => {
  try {
    const levels = await getAllLevels();
    res.json(levels);
  } catch (error: any) {
    console.error('Failed to get levels:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

/**
 * Create a new level
 */
export const createLevel = async (req: Request, res: Response): Promise<void> => {
  try {
    const { level_number, name, min_xp, badge_icon, description } = req.body;

    if (level_number === undefined || !name || min_xp === undefined) {
      res.status(400).json({ error: 'Field level_number, name, dan min_xp wajib diisi' });
      return;
    }

    const created = await upsertLevel({
      level_number: Number(level_number),
      name: String(name).trim(),
      min_xp: Number(min_xp),
      badge_icon: badge_icon || null,
      description: description || null
    });

    res.status(201).json({
      message: `Level ${level_number} ("${name}") berhasil ditambahkan`,
      level: created
    });
  } catch (error: any) {
    console.error('Failed to create level:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

/**
 * Update an existing level
 */
export const updateLevel = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { level_number, name, min_xp, badge_icon, description } = req.body;

    if (!id) {
      res.status(400).json({ error: 'Invalid level ID' });
      return;
    }

    if (level_number === undefined || !name || min_xp === undefined) {
      res.status(400).json({ error: 'Field level_number, name, dan min_xp wajib diisi' });
      return;
    }

    const updated = await upsertLevel({
      id,
      level_number: Number(level_number),
      name: String(name).trim(),
      min_xp: Number(min_xp),
      badge_icon: badge_icon !== undefined ? badge_icon : null,
      description: description !== undefined ? description : null
    });

    res.json({
      message: `Level ${level_number} ("${name}") berhasil diperbarui`,
      level: updated
    });
  } catch (error: any) {
    console.error('Failed to update level:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

/**
 * Delete a level (Level 1 protected)
 */
export const deleteLevel = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'Invalid level ID' });
      return;
    }

    await deleteLevelService(id);
    res.json({ message: 'Level berhasil dihapus' });
  } catch (error: any) {
    console.error('Failed to delete level:', error);
    res.status(400).json({ error: error.message || 'Gagal menghapus level' });
  }
};

/**
 * Bulk save all levels configuration from Admin
 */
export const bulkUpdateLevels = async (req: Request, res: Response): Promise<void> => {
  try {
    const { levels } = req.body;
    if (!Array.isArray(levels) || levels.length === 0) {
      res.status(400).json({ error: 'Array levels diperlukan' });
      return;
    }

    const updatedLevels = await bulkSaveLevels(levels);
    res.json({
      message: 'Seluruh tingkatan level berhasil disimpan dan diperbarui!',
      levels: updatedLevels
    });
  } catch (error: any) {
    console.error('Failed to bulk save levels:', error);
    res.status(400).json({ error: error.message || 'Gagal menyimpan konfigurasi level' });
  }
};
