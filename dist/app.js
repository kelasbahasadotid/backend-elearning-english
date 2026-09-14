"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = exports.server = void 0;
const http_1 = __importDefault(require("http"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const db_1 = __importDefault(require("./config/db"));
// Import routes
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const courseRoutes_1 = __importDefault(require("./routes/courseRoutes"));
const paymentRoutes_1 = __importDefault(require("./routes/paymentRoutes"));
const studyRoutes_1 = __importDefault(require("./routes/studyRoutes"));
const quizRoutes_1 = __importDefault(require("./routes/quizRoutes"));
const speakingRoutes_1 = __importDefault(require("./routes/speakingRoutes"));
const certificateRoutes_1 = __importDefault(require("./routes/certificateRoutes"));
const adminRoutes_1 = __importDefault(require("./routes/adminRoutes"));
const tutorRoutes_1 = __importDefault(require("./routes/tutorRoutes"));
const studentRoutes_1 = __importDefault(require("./routes/studentRoutes"));
const chatRoutes_1 = __importDefault(require("./routes/chatRoutes"));
const notificationRoutes_1 = __importDefault(require("./routes/notificationRoutes"));
const taskRoutes_1 = __importDefault(require("./routes/taskRoutes"));
const discussionRoutes_1 = __importDefault(require("./routes/discussionRoutes"));
const h5pRoutes_1 = __importDefault(require("./routes/h5pRoutes"));
const mediaRoutes_1 = __importDefault(require("./routes/mediaRoutes"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const swagger_1 = require("./docs/swagger");
const season_and_level_setup_1 = require("./migrations/season_and_level_setup");
const student_vocabulary_setup_1 = require("./migrations/student_vocabulary_setup");
const chat_setup_1 = require("./migrations/chat_setup");
const seasonService_1 = require("./services/seasonService");
const enrollmentExpiryService_1 = require("./services/enrollmentExpiryService");
const chatSocket_1 = require("./socket/chatSocket");
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
exports.server = server;
const io = (0, chatSocket_1.initChatSocket)(server);
exports.io = io;
const PORT = process.env.PORT || 3000;
// Middleware
app.use((0, cors_1.default)({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Range', 'Cache-Control', 'Pragma'],
    exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length', 'Content-Type'],
    credentials: true
}));
app.use(express_1.default.json({ limit: '50mb' })); // Increased for base64 file attachments
app.use(express_1.default.urlencoded({ limit: '50mb', extended: true }));
// Serve uploads static folder with streaming & no-cache headers
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../uploads'), {
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
        }
        else if (lowerPath.endsWith('.wav')) {
            // Auto-detect if file is actually an MPEG stream named .wav
            try {
                const fd = fs_1.default.openSync(filePath, 'r');
                const buf = Buffer.alloc(4);
                fs_1.default.readSync(fd, buf, 0, 4, 0);
                fs_1.default.closeSync(fd);
                const isMp3Header = (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) || buf.toString('utf8', 0, 3) === 'ID3';
                if (isMp3Header) {
                    res.setHeader('Content-Type', 'audio/mpeg');
                }
                else {
                    res.setHeader('Content-Type', 'audio/wav');
                }
            }
            catch (_) {
                res.setHeader('Content-Type', 'audio/wav');
            }
        }
        else if (lowerPath.endsWith('.aac')) {
            res.setHeader('Content-Type', 'audio/aac');
        }
        else if (lowerPath.endsWith('.ogg')) {
            res.setHeader('Content-Type', 'audio/ogg');
        }
        else if (lowerPath.endsWith('.m4a')) {
            res.setHeader('Content-Type', 'audio/mp4');
        }
        else if (lowerPath.endsWith('.webm')) {
            res.setHeader('Content-Type', 'audio/webm');
        }
    }
}));
// Mount routes
app.use('/api/auth', authRoutes_1.default);
app.use('/api/courses', courseRoutes_1.default);
app.use('/api/payment', paymentRoutes_1.default);
app.use('/api/payments', paymentRoutes_1.default);
app.use('/api/orders', paymentRoutes_1.default);
app.use('/api/study', studyRoutes_1.default);
app.use('/api/quizzes', quizRoutes_1.default);
app.use('/api/speaking', speakingRoutes_1.default);
app.use('/api/certificates', certificateRoutes_1.default);
app.use('/api/admin', adminRoutes_1.default);
app.use('/api/tutor', tutorRoutes_1.default);
app.use('/api/students', studentRoutes_1.default);
app.use('/api/chat', chatRoutes_1.default);
app.use('/api/notifications', notificationRoutes_1.default);
app.use('/api/tasks', taskRoutes_1.default);
app.use('/api/discussions', discussionRoutes_1.default);
app.use('/api/media', mediaRoutes_1.default);
app.use('/api', h5pRoutes_1.default);
// OpenAPI 3.0 & Swagger UI Interactive API Documentation (/docs & /api-docs)
const noCacheMiddleware = (req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('X-LiteSpeed-Cache-Control', 'no-cache');
    res.setHeader('Surrogate-Control', 'no-store');
    next();
};
app.use('/docs', noCacheMiddleware, swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swagger_1.swaggerDocument, swagger_1.swaggerUiOptions));
app.use('/api-docs', noCacheMiddleware, swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swagger_1.swaggerDocument, swagger_1.swaggerUiOptions));
// Alternative cache-busted documentation URLs for browsers with stubborn disk cache
app.use('/docs-v2', noCacheMiddleware, swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swagger_1.swaggerDocument, swagger_1.swaggerUiOptions));
app.use('/api-docs-v2', noCacheMiddleware, swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swagger_1.swaggerDocument, swagger_1.swaggerUiOptions));
app.get('/openapi.json', noCacheMiddleware, (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json(swagger_1.swaggerDocument);
});
app.get('/docs/swagger.json', noCacheMiddleware, (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json(swagger_1.swaggerDocument);
});
// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'E-learning Language Backend is running' });
});
// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});
// Global Error Handler (OWASP / security rules: never swallow exceptions, return clean messages)
app.use((err, req, res, next) => {
    console.error('Unhandled Server Error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});
server.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT} (Bound to 0.0.0.0 for LAN/IP access)`);
    db_1.default.getConnection()
        .then(async (conn) => {
        conn.release();
        console.log('✅ Database connected successfully to MySQL');
        try {
            await (0, season_and_level_setup_1.runSeasonAndLevelMigration)();
            await (0, student_vocabulary_setup_1.runStudentVocabularyMigration)();
            await (0, chat_setup_1.runChatMigration)();
            (0, seasonService_1.initSeasonScheduler)();
            (0, enrollmentExpiryService_1.initEnrollmentExpiryScheduler)();
        }
        catch (migrationErr) {
            console.warn('⚠️  Setup warning:', migrationErr.message);
        }
    })
        .catch((err) => {
        const dbHost = process.env.DB_HOST || '127.0.0.1';
        const dbPort = process.env.DB_PORT || '3306';
        console.warn(`⚠️  Database info: Belum terhubung ke MySQL di ${dbHost}:${dbPort} (${err.code || err.message}). Pastikan service MySQL/XAMPP/Docker sudah aktif.`);
    });
});
exports.default = app;
