"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadLibraryMedia = exports.uploadMedia = exports.uploadAudio = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const uploadDir = path_1.default.join(__dirname, '../../uploads/recordings');
// Ensure directory exists
if (!fs_1.default.existsSync(uploadDir)) {
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, 'recording-' + uniqueSuffix + path_1.default.extname(file.originalname));
    }
});
const fileFilter = (req, file, cb) => {
    // Accept all recording uploads from browser MediaRecorder/HP
    cb(null, true);
};
exports.uploadAudio = (0, multer_1.default)({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024 // limit 50MB
    }
});
const mediaDir = path_1.default.join(__dirname, '../../uploads/h5p');
if (!fs_1.default.existsSync(mediaDir)) {
    fs_1.default.mkdirSync(mediaDir, { recursive: true });
}
const mediaStorage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, mediaDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path_1.default.extname(file.originalname) || '.png';
        cb(null, 'h5p-media-' + uniqueSuffix + ext);
    }
});
exports.uploadMedia = (0, multer_1.default)({
    storage: mediaStorage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB
    }
});
const libraryMediaDir = path_1.default.join(__dirname, '../../uploads/media');
if (!fs_1.default.existsSync(libraryMediaDir)) {
    fs_1.default.mkdirSync(libraryMediaDir, { recursive: true });
}
const libraryMediaStorage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, libraryMediaDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e6);
        const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, 'media-' + uniqueSuffix + '-' + sanitizedName);
    }
});
exports.uploadLibraryMedia = (0, multer_1.default)({
    storage: libraryMediaStorage,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB max
    }
});
