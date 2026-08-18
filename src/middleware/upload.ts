import multer from 'multer';
import path from 'path';
import fs from 'fs';

const uploadDir = path.join(__dirname, '../../uploads/recordings');

// Ensure directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'recording-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req: any, file: any, cb: any) => {
  // Accept all recording uploads from browser MediaRecorder/HP
  cb(null, true);
};

export const uploadAudio = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // limit 50MB
  }
});

const mediaDir = path.join(__dirname, '../../uploads/h5p');
if (!fs.existsSync(mediaDir)) {
  fs.mkdirSync(mediaDir, { recursive: true });
}

const mediaStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, mediaDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || '.png';
    cb(null, 'h5p-media-' + uniqueSuffix + ext);
  }
});

export const uploadMedia = multer({
  storage: mediaStorage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  }
});

const libraryMediaDir = path.join(__dirname, '../../uploads/media');
if (!fs.existsSync(libraryMediaDir)) {
  fs.mkdirSync(libraryMediaDir, { recursive: true });
}

const libraryMediaStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, libraryMediaDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e6);
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, 'media-' + uniqueSuffix + '-' + sanitizedName);
  }
});

export const uploadLibraryMedia = multer({
  storage: libraryMediaStorage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB max
  }
});

