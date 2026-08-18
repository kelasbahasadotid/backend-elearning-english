import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));           // Increased for base64 file attachments
app.use(express.urlencoded({ limit: '50mb', extended: true }));


// Serve uploads static folder
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

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

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;
