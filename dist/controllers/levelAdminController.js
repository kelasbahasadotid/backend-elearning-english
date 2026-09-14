"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bulkUpdateLevels = exports.deleteLevel = exports.updateLevel = exports.createLevel = exports.getLevels = void 0;
const levelService_1 = require("../services/levelService");
/**
 * Get all gamification levels
 */
const getLevels = async (req, res) => {
    try {
        const levels = await (0, levelService_1.getAllLevels)();
        res.json(levels);
    }
    catch (error) {
        console.error('Failed to get levels:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
};
exports.getLevels = getLevels;
/**
 * Create a new level
 */
const createLevel = async (req, res) => {
    try {
        const { level_number, name, min_xp, badge_icon, description } = req.body;
        if (level_number === undefined || !name || min_xp === undefined) {
            res.status(400).json({ error: 'Field level_number, name, dan min_xp wajib diisi' });
            return;
        }
        const created = await (0, levelService_1.upsertLevel)({
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
    }
    catch (error) {
        console.error('Failed to create level:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
};
exports.createLevel = createLevel;
/**
 * Update an existing level
 */
const updateLevel = async (req, res) => {
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
        const updated = await (0, levelService_1.upsertLevel)({
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
    }
    catch (error) {
        console.error('Failed to update level:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
};
exports.updateLevel = updateLevel;
/**
 * Delete a level (Level 1 protected)
 */
const deleteLevel = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!id) {
            res.status(400).json({ error: 'Invalid level ID' });
            return;
        }
        await (0, levelService_1.deleteLevel)(id);
        res.json({ message: 'Level berhasil dihapus' });
    }
    catch (error) {
        console.error('Failed to delete level:', error);
        res.status(400).json({ error: error.message || 'Gagal menghapus level' });
    }
};
exports.deleteLevel = deleteLevel;
/**
 * Bulk save all levels configuration from Admin
 */
const bulkUpdateLevels = async (req, res) => {
    try {
        const { levels } = req.body;
        if (!Array.isArray(levels) || levels.length === 0) {
            res.status(400).json({ error: 'Array levels diperlukan' });
            return;
        }
        const updatedLevels = await (0, levelService_1.bulkSaveLevels)(levels);
        res.json({
            message: 'Seluruh tingkatan level berhasil disimpan dan diperbarui!',
            levels: updatedLevels
        });
    }
    catch (error) {
        console.error('Failed to bulk save levels:', error);
        res.status(400).json({ error: error.message || 'Gagal menyimpan konfigurasi level' });
    }
};
exports.bulkUpdateLevels = bulkUpdateLevels;
