import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import pool from './config/db';

// Import routes
import authRoutes from './routes/authRoutes';
import courseRoutes from './routes/courseRoutes';
import paymentRoutes from './routes/paymentRoutes';
import studyRoutes from './routes/studyRoutes';
import quizRoutes from './routes/quizRoutes';
import speakingRoutes from './routes/speakingRoutes';
import certificateRoutes from './routes/certificateRoutes';
import adminRoutes from './routes/adminRoutes';
import tutorRoutes from './routes/tutorRoutes';
import studentRoutes from './routes/studentRoutes';
import notificationRoutes from './routes/notificationRoutes';
import taskRoutes from './routes/taskRoutes';
import discussionRoutes from './routes/discussionRoutes';
import h5pRoutes from './routes/h5pRoutes';
import mediaRoutes from './routes/mediaRoutes';
import swaggerUi from 'swagger-ui-express';
import { swaggerDocument, swaggerUiOptions } from './docs/swagger';
import { runSeasonAndLevelMigration } from './migrations/season_and_level_setup';
import { runStudentVocabularyMigration } from './migrations/student_vocabulary_setup';
import { initSeasonScheduler } from './services/seasonService';


dotenv.config();


const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Range', 'Cache-Control', 'Pragma'],
  exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length', 'Content-Type'],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));           // Increased for base64 file attachments
app.use(express.urlencoded({ limit: '50mb', extended: true }));


// Serve uploads static folder with streaming & no-cache headers
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
  setHeaders: (res, filePath) => {
    // Disable caching so audio never gets stuck or repeats stale audio
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Accept-Ranges', 'bytes');

    // Normalize audio mime types for seamless browser decoding
    const lowerPath = filePath.toLowerCase();
    if (lowerPath.endsWith('.mp3')) {
      res.setHeader('Content-Type', 'audio/mpeg');
    } else if (lowerPath.endsWith('.wav')) {
      // Auto-detect if file is actually an MPEG stream named .wav
      try {
        const fd = fs.openSync(filePath, 'r');
        const buf = Buffer.alloc(4);
        fs.readSync(fd, buf, 0, 4, 0);
        fs.closeSync(fd);
        const isMp3Header = (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) || buf.toString('utf8', 0, 3) === 'ID3';
        if (isMp3Header) {
          res.setHeader('Content-Type', 'audio/mpeg');
        } else {
          res.setHeader('Content-Type', 'audio/wav');
        }
      } catch (_) {
        res.setHeader('Content-Type', 'audio/wav');
      }
    } else if (lowerPath.endsWith('.aac')) {
      res.setHeader('Content-Type', 'audio/aac');
    } else if (lowerPath.endsWith('.ogg')) {
      res.setHeader('Content-Type', 'audio/ogg');
    } else if (lowerPath.endsWith('.m4a')) {
      res.setHeader('Content-Type', 'audio/mp4');
    } else if (lowerPath.endsWith('.webm')) {
      res.setHeader('Content-Type', 'audio/webm');
    }
  }
}));

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/orders', paymentRoutes);
app.use('/api/study', studyRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/speaking', speakingRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tutor', tutorRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/discussions', discussionRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api', h5pRoutes);


// OpenAPI 3.0 & Swagger UI Interactive API Documentation (/docs & /api-docs)
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, swaggerUiOptions));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, swaggerUiOptions));
app.get('/openapi.json', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(swaggerDocument);
});
app.get('/docs/swagger.json', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(swaggerDocument);
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', message: 'E-learning Language Backend is running' });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global Error Handler (OWASP / security rules: never swallow exceptions, return clean messages)
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT} (Bound to 0.0.0.0 for LAN/IP access)`);
  pool.getConnection()
    .then(async (conn) => {
      conn.release();
      console.log('✅ Database connected successfully to MySQL');
      try {
        await runSeasonAndLevelMigration();
        await runStudentVocabularyMigration();
        initSeasonScheduler();
      } catch (migrationErr: any) {
        console.warn('⚠️  Setup warning:', migrationErr.message);
      }

    })
    .catch((err: any) => {
      const dbHost = process.env.DB_HOST || '127.0.0.1';
      const dbPort = process.env.DB_PORT || '3306';
      console.warn(`⚠️  Database info: Belum terhubung ke MySQL di ${dbHost}:${dbPort} (${err.code || err.message}). Pastikan service MySQL/XAMPP/Docker sudah aktif.`);
    });
});


export default app;
