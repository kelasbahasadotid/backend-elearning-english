"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mediaController_1 = require("../controllers/mediaController");
const auth_1 = require("../middleware/auth");
const upload_1 = require("../middleware/upload");
const router = (0, express_1.Router)();
// Public / All Roles Preview Endpoint
router.post('/synthesize-preview', mediaController_1.synthesizeMediaPreview);
router.get('/synthesize-preview', mediaController_1.synthesizeMediaPreview);
// Protect media management endpoints: Admin (1, 2), Tutor (3), Content Manager (5)
router.use(auth_1.authenticateToken);
router.use((0, auth_1.requireRole)([1, 2, 3, 5]));
// YouTube CSV Import & Template
router.get('/template-youtube-csv', mediaController_1.getYouTubeCsvTemplateEndpoint);
router.post('/import-youtube-csv', upload_1.uploadLibraryMedia.single('file'), mediaController_1.importYouTubeCsv);
// Media Library CRUD & Generator
router.get('/', mediaController_1.getMediaList);
router.get('/target-lessons', mediaController_1.getSpeakingTargets);
router.get('/speaking-targets', mediaController_1.getSpeakingTargets);
router.post('/upload', upload_1.uploadLibraryMedia.single('file'), mediaController_1.uploadMediaFile);
router.post('/link', mediaController_1.addMediaLink);
router.post('/generate-ai-audio', mediaController_1.generateAiAudio);
router.post('/generate-ai-dialogue', mediaController_1.generateAiDialogue);
router.put('/:id', mediaController_1.updateMedia);
router.delete('/:id', mediaController_1.deleteMedia);
exports.default = router;
