"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const chatController_1 = require("../controllers/chatController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
// Student Chat Routes
router.get('/my-conversation', chatController_1.getMyConversation);
router.post('/messages', chatController_1.sendStudentMessage);
router.put('/read', chatController_1.markMyChatRead);
exports.default = router;
