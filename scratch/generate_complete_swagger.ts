import fs from 'fs';
import path from 'path';

// Let's create the full comprehensive OpenAPI document generator
const fullSwaggerCode = `import swaggerUi from 'swagger-ui-express';

export const swaggerDocument: Record<string, any> = {
  openapi: '3.0.3',
  info: {
    title: 'E-Learning Language LMS API Documentation',
    version: '1.0.0',
    description: \`### 🎓 Interactive REST API Documentation & Testing Interface (FastAPI / Swagger style)
Platform backend untuk LMS Kelas Bahasa Inggris dengan dukungan AI Pronunciation, Edge-TTS, Interactive Quizzes, H5P Content, Payment Gateway, dan Manajemen Lengkap.

---
#### 🔑 Petunjuk Autentikasi:
1. Jalankan endpoint **POST /api/auth/login** atau **POST /api/auth/register**.
2. Salin token dari response (\\\`token\\\` atau \\\`accessToken\\\`).
3. Klik tombol hijau **Authorize** di kanan atas dokumen ini.
4. Masukkan token (format: cukup paste token, atau \\\`Bearer <token>\\\`) lalu klik **Authorize**.
5. Sekarang semua endpoint yang membutuhkan login dapat langsung diuji (**Try it out**) langsung dari browser!\`,
    contact: {
      name: 'E-Learning Language Dev Team',
      email: 'support@elearning-english.com'
    }
  },
  servers: [
    { url: '/', description: 'Current Server (Relative URL)' },
    { url: 'http://localhost:5000', description: 'Local Backend Server (Development - Port 5000)' },
    { url: 'https://api.kampunginggris.ai', description: 'Production Server (api.kampunginggris.ai)' },
    { url: 'http://localhost:3000', description: 'Alternative Local Server (Port 3000)' }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Masukkan JWT token yang didapatkan dari POST /api/auth/login'
      }
    },
    schemas: {
      ApiResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Operation successful' },
          data: { type: 'object' }
        }
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Error description' },
          message: { type: 'string', example: 'Detailed error message' }
        }
      },
      UserRegisterDto: {
        type: 'object',
        required: ['fullName', 'email', 'password'],
        properties: {
          fullName: { type: 'string', example: 'John Doe' },
          email: { type: 'string', format: 'email', example: 'user@example.com' },
          username: { type: 'string', example: 'johndoe' },
          password: { type: 'string', format: 'password', example: 'Password123' },
          roleId: { type: 'integer', default: 4, description: '4: Student, 3: Tutor, 2: Admin, 1: Superadmin', example: 4 }
        }
      },
      UserLoginDto: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'user@example.com' },
          password: { type: 'string', format: 'password', example: 'Password123' }
        }
      },
      CourseCreateDto: {
        type: 'object',
        required: ['title', 'price'],
        properties: {
          title: { type: 'string', example: 'Mastering English Grammar & Speaking' },
          slug: { type: 'string', example: 'mastering-english-grammar-speaking' },
          shortDescription: { type: 'string', example: 'Master tenses and speak fluently.' },
          description: { type: 'string', example: 'Full in-depth English curriculum with AI pronunciation scoring.' },
          price: { type: 'number', example: 299000 },
          discountPrice: { type: 'number', example: 199000 },
          categoryId: { type: 'integer', example: 1 },
          levelId: { type: 'integer', example: 1 },
          cefrLevel: { type: 'string', example: 'A1' },
          thumbnailUrl: { type: 'string', example: 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d' },
          certificateEnabled: { type: 'boolean', example: true },
          speakingAiEnabled: { type: 'boolean', example: true },
          status: { type: 'string', enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'], example: 'PUBLISHED' }
        }
      },
      CategoryCreateDto: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', example: 'Pronunciation' },
          slug: { type: 'string', example: 'pronunciation' },
          description: { type: 'string', example: 'Phonetics, accent training, and oral fluency.' },
          sortOrder: { type: 'integer', example: 1 },
          status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'], example: 'ACTIVE' }
        }
      },
      ModuleCreateDto: {
        type: 'object',
        required: ['courseVersionId', 'title'],
        properties: {
          courseVersionId: { type: 'integer', example: 1 },
          title: { type: 'string', example: 'Module 1: Everyday Greetings' },
          description: { type: 'string', example: 'Basic self introduction and greetings.' },
          moduleOrder: { type: 'integer', example: 1 },
          estimatedMinutes: { type: 'integer', example: 60 },
          status: { type: 'string', enum: ['DRAFT', 'PUBLISHED'], example: 'PUBLISHED' }
        }
      },
      LessonCreateDto: {
        type: 'object',
        required: ['moduleId', 'title', 'lessonType'],
        properties: {
          moduleId: { type: 'integer', example: 1 },
          title: { type: 'string', example: 'Lesson 1: Introduction' },
          slug: { type: 'string', example: 'lesson-1-intro' },
          lessonType: { type: 'string', enum: ['VIDEO', 'READING', 'QUIZ', 'SPEAKING', 'EXAM'], example: 'VIDEO' },
          lessonOrder: { type: 'integer', example: 1 },
          durationMinutes: { type: 'integer', example: 15 },
          isPreview: { type: 'boolean', example: false },
          isRequired: { type: 'boolean', example: true },
          passingScore: { type: 'integer', example: 70 },
          xpReward: { type: 'integer', example: 20 },
          status: { type: 'string', enum: ['DRAFT', 'PUBLISHED'], example: 'PUBLISHED' }
        }
      },
      LessonContentCreateDto: {
        type: 'object',
        required: ['title', 'contentType'],
        properties: {
          title: { type: 'string', example: 'Grammar Overview Slide' },
          contentType: { type: 'string', enum: ['VIDEO', 'READING', 'SLIDE', 'H5P', 'QUIZ'], example: 'READING' },
          body: { type: 'string', example: 'In this section, we learn present continuous tense formula: S + be + V-ing.' },
          videoUrl: { type: 'string', example: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
          h5pContentId: { type: 'integer', example: 1 },
          contentOrder: { type: 'integer', example: 1 },
          estimatedMinutes: { type: 'integer', example: 10 }
        }
      },
      QuizCreateDto: {
        type: 'object',
        required: ['title', 'courseId'],
        properties: {
          title: { type: 'string', example: 'Unit 1 Grammar Mastery Quiz' },
          description: { type: 'string', example: 'Evaluate your understanding of unit 1 concepts.' },
          courseId: { type: 'integer', example: 1 },
          lessonId: { type: 'integer', example: 1 },
          assessmentTypeCode: { type: 'string', enum: ['QUIZ', 'EXAM', 'PLACEMENT', 'MINI_QUIZ'], example: 'QUIZ' },
          timeLimitMinutes: { type: 'integer', example: 20 },
          passingScore: { type: 'integer', example: 70 },
          maxAttempts: { type: 'integer', example: 3 }
        }
      },
      QuestionCreateDto: {
        type: 'object',
        required: ['questionText', 'questionType'],
        properties: {
          questionText: { type: 'string', example: 'What is the correct past tense of "go"?' },
          questionType: { type: 'string', enum: ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'MATCHING', 'FILL_BLANK', 'ESSAY'], example: 'MULTIPLE_CHOICE' },
          points: { type: 'number', example: 10 },
          explanation: { type: 'string', example: '"Went" is the irregular past tense form of "go".' },
          options: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                optionText: { type: 'string', example: 'Went' },
                isCorrect: { type: 'boolean', example: true },
                explanation: { type: 'string', example: 'Correct!' }
              }
            }
          }
        }
      },
      SpeakingTestCreateDto: {
        type: 'object',
        required: ['title', 'assessmentId'],
        properties: {
          title: { type: 'string', example: 'Speaking Test: Self Introduction' },
          description: { type: 'string', example: 'Speak clearly into your microphone.' },
          assessmentId: { type: 'integer', example: 1 },
          targetLanguage: { type: 'string', example: 'en-US' }
        }
      },
      SpeakingPromptCreateDto: {
        type: 'object',
        required: ['promptText'],
        properties: {
          promptText: { type: 'string', example: 'Describe your favorite hobby and why you enjoy it.' },
          promptType: { type: 'string', enum: ['READ_ALOUD', 'REPEAT_SENTENCE', 'TOPIC_SPEAKING', 'PICTURE_DESCRIPTION'], example: 'READ_ALOUD' },
          audioUrl: { type: 'string', example: '/uploads/media/reference-audio.mp3' },
          imageUrl: { type: 'string', example: 'https://example.com/prompt.jpg' },
          promptOrder: { type: 'integer', example: 1 }
        }
      },
      CertificateTemplateDto: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', example: 'Standard Gold Certificate' },
          description: { type: 'string', example: 'Official Course Completion Certificate' },
          backgroundImageUrl: { type: 'string', example: 'https://example.com/cert-bg.png' },
          signatureImageUrl: { type: 'string', example: 'https://example.com/signature.png' },
          signatoryName: { type: 'string', example: 'Head Academic Director' },
          signatoryTitle: { type: 'string', example: 'Chief Academic Officer' }
        }
      },
      ScalevPackageDto: {
        type: 'object',
        required: ['name', 'scalevProductId', 'courseId'],
        properties: {
          name: { type: 'string', example: 'English Masterclass Scalev Bundle' },
          scalevProductId: { type: 'string', example: 'prod_scalev_12345' },
          courseId: { type: 'integer', example: 1 },
          price: { type: 'number', example: 199000 },
          isActive: { type: 'boolean', example: true }
        }
      },
      EmailSettingsDto: {
        type: 'object',
        properties: {
          smtpHost: { type: 'string', example: 'mail.erwinsyahrudin.online' },
          smtpPort: { type: 'integer', example: 465 },
          smtpUser: { type: 'string', example: 'support@erwinsyahrudin.online' },
          smtpPass: { type: 'string', example: 'Password!123' },
          smtpFrom: { type: 'string', example: 'support@erwinsyahrudin.online' },
          smtpFromName: { type: 'string', example: 'Global English LMS' },
          imapHost: { type: 'string', example: 'mail.erwinsyahrudin.online' },
          imapPort: { type: 'integer', example: 993 },
          imapUser: { type: 'string', example: 'support@erwinsyahrudin.online' },
          imapPass: { type: 'string', example: 'Password!123' }
        }
      },
      TagCreateDto: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', example: 'Speaking' },
          slug: { type: 'string', example: 'speaking' },
          color: { type: 'string', example: '#3b82f6' }
        }
      },
      BannerCreateDto: {
        type: 'object',
        required: ['title', 'imageUrl'],
        properties: {
          title: { type: 'string', example: 'Promo Ramadhan 50% Off' },
          imageUrl: { type: 'string', example: 'https://example.com/banner.jpg' },
          targetUrl: { type: 'string', example: '/courses/english-beginner' },
          isActive: { type: 'boolean', example: true },
          sortOrder: { type: 'integer', example: 1 }
        }
      }
    }
  },
  tags: [
    { name: 'Health', description: 'System health check & diagnostics' },
    { name: 'Authentication', description: 'Registration, login, OTP verification, password reset & profile' },
    { name: 'Courses', description: 'Browse courses, landing page, reviews, announcements & attachments' },
    { name: 'Payment & Orders', description: 'Checkout, Flip gateway, Scalev webhooks, & manual proofs' },
    { name: 'Study & Learning', description: 'Lesson viewer, video progress tracking, bookmarks, leaderboard' },
    { name: 'Quizzes & Assessments', description: 'Interactive quizzes, question formats & attempt submissions' },
    { name: 'Speaking AI & Pronunciation', description: 'Speaking tests, Edge TTS voice synthesis, voices list & STT' },
    { name: 'Certificates', description: 'Claim course certificate & public QR verification' },
    { name: 'Student Portal', description: 'Student enrolled courses, orders history, notifications & assignments' },
    { name: 'Tasks & Assignments', description: 'Task creation, student submissions, assignment status & grading' },
    { name: 'Discussions & Forum', description: 'Course forum topics, comments, questions & tutor/student replies' },
    { name: 'H5P Interactive Content', description: 'H5P rich media editor, media upload, interactive quizzes & scoring' },
    { name: 'Media Library', description: 'TTS audio generator, multi-speaker dialogue builder & uploads' },
    { name: 'Tutor Portal', description: 'Tutor reviews, grading submissions & full content authoring' },
    { name: 'Admin Panel', description: 'Full platform management: users, courses, modules, lessons, quizzes, speaking, certs, email hub, scalev, analytics' }
  ],
  paths: {
    // ----------------------------------------------------
    // HEALTH
    // ----------------------------------------------------
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Check API health status',
        description: 'Returns the current operational status of the LMS backend.',
        responses: { 200: { description: 'Server is healthy' } }
      }
    },

    // ----------------------------------------------------
    // AUTHENTICATION
    // ----------------------------------------------------
    '/api/auth/register': {
      post: {
        tags: ['Authentication'],
        summary: 'Register a new user account',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UserRegisterDto' } } }
        },
        responses: { 201: { description: 'User registered' }, 409: { description: 'Email/username already registered' } }
      }
    },
    '/api/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Log in with email & password',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UserLoginDto' } } }
        },
        responses: { 200: { description: 'Login successful with JWT token' }, 401: { description: 'Invalid credentials' } }
      }
    },
    '/api/auth/verify-code': {
      post: {
        tags: ['Authentication'],
        summary: 'Verify registration OTP code',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { email: { type: 'string' }, code: { type: 'string' } } } } }
        },
        responses: { 200: { description: 'Verified' } }
      }
    },
    '/api/auth/resend-code': {
      post: {
        tags: ['Authentication'],
        summary: 'Resend verification code',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { email: { type: 'string' } } } } }
        },
        responses: { 200: { description: 'Code sent' } }
      }
    },
    '/api/auth/social-login': {
      post: {
        tags: ['Authentication'],
        summary: 'Social login (Google / Facebook)',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { provider: { type: 'string' }, email: { type: 'string' }, fullName: { type: 'string' }, avatarUrl: { type: 'string' } } } } }
        },
        responses: { 200: { description: 'Logged in' } }
      }
    },
    '/api/auth/forgot-password': {
      post: {
        tags: ['Authentication'],
        summary: 'Request password reset instructions',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { email: { type: 'string' } } } } }
        },
        responses: { 200: { description: 'Reset email sent' } }
      }
    },
    '/api/auth/profile': {
      get: {
        tags: ['Authentication'],
        summary: 'Get logged in user profile',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'User profile data' } }
      },
      put: {
        tags: ['Authentication'],
        summary: 'Update user profile details',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { fullName: { type: 'string' }, phoneNumber: { type: 'string' }, avatarUrl: { type: 'string' }, bio: { type: 'string' } } } } }
        },
        responses: { 200: { description: 'Profile updated' } }
      }
    },
    '/api/auth/complete-onboarding': {
      post: {
        tags: ['Authentication'],
        summary: 'Complete onboarding target preferences',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { targetGoal: { type: 'string' }, proficiencyLevel: { type: 'string' } } } } }
        },
        responses: { 200: { description: 'Onboarding saved' } }
      }
    },

    // ----------------------------------------------------
    // COURSES
    // ----------------------------------------------------
    '/api/courses/landing': {
      get: {
        tags: ['Courses'],
        summary: 'Get public landing page courses & banners',
        responses: { 200: { description: 'Landing page data' } }
      }
    },
    '/api/courses': {
      get: {
        tags: ['Courses'],
        summary: 'List published courses catalog',
        parameters: [
          { name: 'category', in: 'query', schema: { type: 'string' } },
          { name: 'level', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } }
        ],
        responses: { 200: { description: 'Catalog list' } }
      }
    },
    '/api/courses/{slug}': {
      get: {
        tags: ['Courses'],
        summary: 'Get course curriculum and details by slug',
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Course curriculum details' }, 404: { description: 'Course not found' } }
      }
    },
    '/api/courses/{id}/reviews': {
      post: {
        tags: ['Courses'],
        summary: 'Submit rating and review for course',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { rating: { type: 'integer', example: 5 }, comment: { type: 'string' } } } } }
        },
        responses: { 201: { description: 'Review posted' } }
      }
    },
    '/api/courses/reviews/{id}/reply': {
      post: {
        tags: ['Courses'],
        summary: 'Reply to course review (Tutor / Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { reply: { type: 'string' } } } } }
        },
        responses: { 200: { description: 'Reply posted' } }
      }
    },
    '/api/courses/{id}/announcements': {
      post: {
        tags: ['Courses'],
        summary: 'Post announcement to course students',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { title: { type: 'string' }, content: { type: 'string' } } } } }
        },
        responses: { 201: { description: 'Announcement created' } }
      }
    },
    '/api/courses/announcements/{id}': {
      delete: {
        tags: ['Courses'],
        summary: 'Delete course announcement',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Announcement deleted' } }
      }
    },
    '/api/courses/presentation/{contentId}/file.pptx': {
      get: {
        tags: ['Courses'],
        summary: 'Download presentation PPTX file for lesson content',
        parameters: [{ name: 'contentId', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Binary PPTX stream' } }
      }
    },
    '/api/courses/attachment/{contentId}/{attIdx}/file': {
      get: {
        tags: ['Courses'],
        summary: 'Download lesson attachment file by index',
        parameters: [
          { name: 'contentId', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'attIdx', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: { 200: { description: 'Attachment file download' } }
      }
    },

    // ----------------------------------------------------
    // PAYMENT & ORDERS
    // ----------------------------------------------------
    '/api/payment/settings': {
      get: {
        tags: ['Payment & Orders'],
        summary: 'Get active payment settings and bank accounts (Public)',
        responses: { 200: { description: 'Payment configuration' } }
      }
    },
    '/api/payment/checkout': {
      post: {
        tags: ['Payment & Orders'],
        summary: 'Create course checkout order',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { courseId: { type: 'integer' }, paymentMethod: { type: 'string' }, couponCode: { type: 'string' } } } } }
        },
        responses: { 201: { description: 'Order created' } }
      }
    },
    '/api/payment/flip/checkout': {
      post: {
        tags: ['Payment & Orders'],
        summary: 'Create Flip checkout payment link',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { courseId: { type: 'integer' }, customerName: { type: 'string' }, customerEmail: { type: 'string' }, customerPhone: { type: 'string' } } } } }
        },
        responses: { 200: { description: 'Flip payment URL' } }
      }
    },
    '/api/payment/flip/webhook': {
      post: {
        tags: ['Payment & Orders'],
        summary: 'Flip webhook listener',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'Webhook acknowledged' } }
      }
    },
    '/api/payment/scalev-webhook': {
      post: {
        tags: ['Payment & Orders'],
        summary: 'Scalev payment & order webhook listener',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'Scalev webhook processed' } }
      },
      get: {
        tags: ['Payment & Orders'],
        summary: 'Scalev webhook verification ping',
        responses: { 200: { description: 'Webhook endpoint active' } }
      }
    },
    '/api/payment/manual-proof': {
      post: {
        tags: ['Payment & Orders'],
        summary: 'Submit manual bank transfer proof',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { orderId: { type: 'integer' }, bankName: { type: 'string' }, accountHolder: { type: 'string' }, proofImageBase64: { type: 'string' } } } } }
        },
        responses: { 200: { description: 'Proof submitted' } }
      }
    },

    // ----------------------------------------------------
    // STUDY & LEARNING
    // ----------------------------------------------------
    '/api/study/lesson/{id}': {
      get: {
        tags: ['Study & Learning'],
        summary: 'Get lesson study materials (Video, slides, text, H5P, quiz)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Lesson study details' } }
      }
    },
    '/api/study/video-progress': {
      post: {
        tags: ['Study & Learning'],
        summary: 'Save video watched duration and progress',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { lessonId: { type: 'integer' }, watchedSeconds: { type: 'number' }, totalDuration: { type: 'number' }, isCompleted: { type: 'boolean' } } } } }
        },
        responses: { 200: { description: 'Progress saved' } }
      }
    },
    '/api/study/progress': {
      post: {
        tags: ['Study & Learning'],
        summary: 'Mark lesson completion status',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { lessonId: { type: 'integer' }, status: { type: 'string' } } } } }
        },
        responses: { 200: { description: 'Lesson status updated' } }
      }
    },
    '/api/study/lesson/{id}/bookmark': {
      post: {
        tags: ['Study & Learning'],
        summary: 'Toggle bookmark for lesson',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Bookmark toggled' } }
      }
    },
    '/api/study/bookmarks': {
      get: {
        tags: ['Study & Learning'],
        summary: 'List user bookmarked lessons',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Bookmarks list' } }
      }
    },
    '/api/study/leaderboard': {
      get: {
        tags: ['Study & Learning'],
        summary: 'Get user leaderboard rankings and XP',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Leaderboard list' } }
      }
    },

    // ----------------------------------------------------
    // QUIZZES & ASSESSMENTS
    // ----------------------------------------------------
    '/api/quizzes/{id}': {
      get: {
        tags: ['Quizzes & Assessments'],
        summary: 'Get quiz questions and answers layout',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Quiz details' } }
      }
    },
    '/api/quizzes/type/{typeCode}': {
      get: {
        tags: ['Quizzes & Assessments'],
        summary: 'Get quizzes filtered by type (QUIZ, EXAM, MINI_QUIZ, PLACEMENT)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'typeCode', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'List of assessments by type' } }
      }
    },
    '/api/quizzes/submit': {
      post: {
        tags: ['Quizzes & Assessments'],
        summary: 'Submit quiz attempt for scoring',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { quizId: { type: 'integer' }, answers: { type: 'array', items: { type: 'object' } } } } } }
        },
        responses: { 200: { description: 'Evaluation score and results' } }
      }
    },
    '/api/quizzes/attempts/history': {
      get: {
        tags: ['Quizzes & Assessments'],
        summary: 'Get student quiz attempt history',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Attempts history' } }
      }
    },
    '/api/quizzes/attempts/{attemptId}': {
      get: {
        tags: ['Quizzes & Assessments'],
        summary: 'Get breakdown of a specific attempt',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'attemptId', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Attempt review' } }
      }
    },

    // ----------------------------------------------------
    // SPEAKING AI & PRONUNCIATION
    // ----------------------------------------------------
    '/api/speaking/tts/voices': {
      get: {
        tags: ['Speaking AI & Pronunciation'],
        summary: 'Get all 29 Edge-TTS neural voices list',
        responses: { 200: { description: 'List of curated voices' } }
      }
    },
    '/api/speaking/tts/synthesize': {
      post: {
        tags: ['Speaking AI & Pronunciation'],
        summary: 'Synthesize speech from text (Edge-TTS POST)',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { text: { type: 'string' }, voice: { type: 'string' }, rate: { type: 'string' }, pitch: { type: 'string' } } } } }
        },
        responses: { 200: { description: 'Audio stream (audio/mpeg)' } }
      },
      get: {
        tags: ['Speaking AI & Pronunciation'],
        summary: 'Direct progressive audio stream (Edge-TTS GET)',
        parameters: [
          { name: 'text', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'voice', in: 'query', schema: { type: 'string' } },
          { name: 'rate', in: 'query', schema: { type: 'string' } },
          { name: 'pitch', in: 'query', schema: { type: 'string' } }
        ],
        responses: { 200: { description: 'Progressive audio stream (audio/mpeg)' } }
      }
    },
    '/api/speaking/tts/stream': {
      get: {
        tags: ['Speaking AI & Pronunciation'],
        summary: 'Stream synthesized TTS audio stream directly',
        parameters: [
          { name: 'text', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'voice', in: 'query', schema: { type: 'string' } }
        ],
        responses: { 200: { description: 'Stream buffer' } }
      }
    },
    '/api/speaking/transcribe': {
      post: {
        tags: ['Speaking AI & Pronunciation'],
        summary: 'Transcribe spoken audio via STT',
        requestBody: {
          required: true,
          content: { 'multipart/form-data': { schema: { type: 'object', properties: { audio: { type: 'string', format: 'binary' } } } } }
        },
        responses: { 200: { description: 'Transcribed text and confidence' } }
      }
    },
    '/api/speaking/test/{testId}/prompts': {
      get: {
        tags: ['Speaking AI & Pronunciation'],
        summary: 'Get prompts for speaking test',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'testId', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Speaking prompts' } }
      }
    },
    '/api/speaking/submit': {
      post: {
        tags: ['Speaking AI & Pronunciation'],
        summary: 'Submit speaking audio for AI pronunciation scoring',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'multipart/form-data': { schema: { type: 'object', properties: { promptId: { type: 'integer' }, speakingTestId: { type: 'integer' }, audio: { type: 'string', format: 'binary' } } } } }
        },
        responses: { 200: { description: 'Pronunciation accuracy, fluency & word scores' } }
      }
    },
    '/api/speaking/attempts/history': {
      get: {
        tags: ['Speaking AI & Pronunciation'],
        summary: 'Get user speaking test history',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'List of past attempts' } }
      }
    },

    // ----------------------------------------------------
    // CERTIFICATES
    // ----------------------------------------------------
    '/api/certificates/verify/{code}': {
      get: {
        tags: ['Certificates'],
        summary: 'Verify certificate authenticity by code / QR',
        parameters: [{ name: 'code', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Certificate validity details' } }
      }
    },
    '/api/certificates/claim': {
      post: {
        tags: ['Certificates'],
        summary: 'Claim certificate upon course completion',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { courseId: { type: 'integer' } } } } }
        },
        responses: { 200: { description: 'Certificate claimed' } }
      }
    },

    // ----------------------------------------------------
    // STUDENT PORTAL
    // ----------------------------------------------------
    '/api/students/orders': {
      get: {
        tags: ['Student Portal'],
        summary: 'Get student course purchases & orders history',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'List of student orders' } }
      }
    },
    '/api/students/notifications': {
      get: {
        tags: ['Student Portal'],
        summary: 'Get student notification inbox',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Notifications list' } }
      }
    },
    '/api/students/notifications/{id}/read': {
      put: {
        tags: ['Student Portal'],
        summary: 'Mark notification as read',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Notification marked read' } }
      }
    },
    '/api/students/assignments': {
      get: {
        tags: ['Student Portal'],
        summary: 'List student assignments and homework',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Assignments list' } }
      }
    },
    '/api/students/assignments/submissions': {
      post: {
        tags: ['Student Portal'],
        summary: 'Submit homework assignment answer',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { assignmentId: { type: 'integer' }, content: { type: 'string' }, attachmentUrl: { type: 'string' } } } } }
        },
        responses: { 200: { description: 'Assignment submitted' } }
      }
    },
    '/api/students/discussions': {
      get: {
        tags: ['Student Portal'],
        summary: 'Get course discussion topics',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Discussions list' } }
      }
    },
    '/api/students/discussions/topics': {
      post: {
        tags: ['Student Portal'],
        summary: 'Create student discussion question',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { courseId: { type: 'integer' }, title: { type: 'string' }, content: { type: 'string' } } } } }
        },
        responses: { 201: { description: 'Topic created' } }
      }
    },
    '/api/students/discussions/topics/{id}/replies': {
      get: {
        tags: ['Student Portal'],
        summary: 'Get replies for discussion topic',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Topic replies list' } }
      },
      post: {
        tags: ['Student Portal'],
        summary: 'Post reply to discussion topic',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { content: { type: 'string' } } } } }
        },
        responses: { 201: { description: 'Reply posted' } }
      }
    },

    // ----------------------------------------------------
    // NOTIFICATIONS
    // ----------------------------------------------------
    '/api/notifications': {
      get: {
        tags: ['Student Portal'],
        summary: 'Get all notifications for user',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Notifications' } }
      }
    },
    '/api/notifications/read': {
      put: {
        tags: ['Student Portal'],
        summary: 'Mark all notifications as read',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'All marked read' } }
      }
    },
    '/api/notifications/{id}/read': {
      put: {
        tags: ['Student Portal'],
        summary: 'Mark specific notification as read',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Notification read' } }
      }
    },

    // ----------------------------------------------------
    // TASKS & ASSIGNMENTS
    // ----------------------------------------------------
    '/api/tasks': {
      get: {
        tags: ['Tasks & Assignments'],
        summary: 'List tasks and assignments',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Tasks list' } }
      },
      post: {
        tags: ['Tasks & Assignments'],
        summary: 'Create new task (Tutor / Admin)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { title: { type: 'string' }, description: { type: 'string' }, courseId: { type: 'integer' }, lessonId: { type: 'integer' }, dueDate: { type: 'string' }, maxScore: { type: 'integer' } } } } }
        },
        responses: { 201: { description: 'Task created' } }
      }
    },
    '/api/tasks/pending-summary': {
      get: {
        tags: ['Tasks & Assignments'],
        summary: 'Get student pending task count',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Pending count' } }
      }
    },
    '/api/tasks/{id}': {
      put: {
        tags: ['Tasks & Assignments'],
        summary: 'Update task details (Tutor / Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'Task updated' } }
      },
      delete: {
        tags: ['Tasks & Assignments'],
        summary: 'Delete task (Tutor / Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Task deleted' } }
      }
    },
    '/api/tasks/{id}/submit': {
      post: {
        tags: ['Tasks & Assignments'],
        summary: 'Submit student answer to task',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { content: { type: 'string' }, attachmentUrl: { type: 'string' } } } } }
        },
        responses: { 200: { description: 'Task submitted' } }
      }
    },
    '/api/tasks/{id}/submissions': {
      get: {
        tags: ['Tasks & Assignments'],
        summary: 'List submissions for a task (Tutor / Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Submissions list' } }
      }
    },
    '/api/tasks/submission/{id}/grade': {
      put: {
        tags: ['Tasks & Assignments'],
        summary: 'Grade a submission (Tutor / Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { score: { type: 'number' }, feedback: { type: 'string' } } } } }
        },
        responses: { 200: { description: 'Graded' } }
      }
    },
    '/api/tasks/assign': {
      post: {
        tags: ['Tasks & Assignments'],
        summary: 'Assign task to students',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'Assigned' } }
      }
    },
    '/api/tasks/{id}/status': {
      put: {
        tags: ['Tasks & Assignments'],
        summary: 'Update task status',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'Status updated' } }
      }
    },

    // ----------------------------------------------------
    // DISCUSSIONS & FORUM
    // ----------------------------------------------------
    '/api/discussions': {
      get: {
        tags: ['Discussions & Forum'],
        summary: 'List discussion threads',
        parameters: [
          { name: 'courseId', in: 'query', schema: { type: 'integer' } },
          { name: 'lessonId', in: 'query', schema: { type: 'integer' } }
        ],
        responses: { 200: { description: 'Discussion threads' } }
      },
      post: {
        tags: ['Discussions & Forum'],
        summary: 'Create new discussion thread',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { courseId: { type: 'integer' }, title: { type: 'string' }, content: { type: 'string' } } } } }
        },
        responses: { 201: { description: 'Discussion created' } }
      }
    },
    '/api/discussions/{id}': {
      delete: {
        tags: ['Discussions & Forum'],
        summary: 'Delete discussion thread',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Discussion deleted' } }
      }
    },
    '/api/discussions/comment': {
      post: {
        tags: ['Discussions & Forum'],
        summary: 'Post reply comment to discussion',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { discussionId: { type: 'integer' }, content: { type: 'string' } } } } }
        },
        responses: { 201: { description: 'Comment posted' } }
      }
    },
    '/api/discussions/comments': {
      get: {
        tags: ['Discussions & Forum'],
        summary: 'List comments for discussion',
        parameters: [{ name: 'discussionId', in: 'query', schema: { type: 'integer' } }],
        responses: { 200: { description: 'Comments list' } }
      }
    },
    '/api/discussions/comment/{id}': {
      delete: {
        tags: ['Discussions & Forum'],
        summary: 'Delete a discussion comment',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Comment deleted' } }
      }
    },

    // ----------------------------------------------------
    // H5P INTERACTIVE CONTENT
    // ----------------------------------------------------
    '/api/admin/h5p': {
      get: {
        tags: ['H5P Interactive Content'],
        summary: 'List all H5P interactive content items (Admin)',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'H5P items list' } }
      },
      post: {
        tags: ['H5P Interactive Content'],
        summary: 'Create new H5P interactive activity (Admin)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { title: { type: 'string' }, library: { type: 'string' }, params: { type: 'object' }, lessonId: { type: 'integer' } } } } }
        },
        responses: { 201: { description: 'H5P created' } }
      }
    },
    '/api/admin/h5p/{id}': {
      get: {
        tags: ['H5P Interactive Content'],
        summary: 'Get H5P content definition by ID',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'H5P content data' } }
      },
      put: {
        tags: ['H5P Interactive Content'],
        summary: 'Update H5P interactive activity',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'H5P updated' } }
      },
      delete: {
        tags: ['H5P Interactive Content'],
        summary: 'Delete H5P interactive activity',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'H5P deleted' } }
      }
    },
    '/api/admin/h5p/{id}/attach': {
      post: {
        tags: ['H5P Interactive Content'],
        summary: 'Attach H5P content to a lesson',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { lessonId: { type: 'integer' } } } } }
        },
        responses: { 200: { description: 'Attached' } }
      }
    },
    '/api/admin/h5p/upload-media': {
      post: {
        tags: ['H5P Interactive Content'],
        summary: 'Upload media asset for H5P element',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } } }
        },
        responses: { 200: { description: 'File uploaded' } }
      }
    },
    '/api/students/h5p/{id}': {
      get: {
        tags: ['H5P Interactive Content'],
        summary: 'Get H5P content for student player',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'H5P student content' } }
      }
    },
    '/api/students/h5p/{id}/submit': {
      post: {
        tags: ['H5P Interactive Content'],
        summary: 'Submit student H5P interaction attempt result',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { score: { type: 'number' }, maxScore: { type: 'number' }, completionStatus: { type: 'string' } } } } }
        },
        responses: { 200: { description: 'H5P score recorded' } }
      }
    },

    // ----------------------------------------------------
    // MEDIA LIBRARY & AI GENERATOR
    // ----------------------------------------------------
    '/api/media': {
      get: {
        tags: ['Media Library'],
        summary: 'List media files in library',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'type', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } }
        ],
        responses: { 200: { description: 'Media list' } }
      }
    },
    '/api/media/upload': {
      post: {
        tags: ['Media Library'],
        summary: 'Upload media asset to library',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }, title: { type: 'string' } } } } }
        },
        responses: { 201: { description: 'Uploaded' } }
      }
    },
    '/api/media/link': {
      post: {
        tags: ['Media Library'],
        summary: 'Add external media link (YouTube, Soundcloud, Drive)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { title: { type: 'string' }, url: { type: 'string' }, fileType: { type: 'string' } } } } }
        },
        responses: { 201: { description: 'Link saved' } }
      }
    },
    '/api/media/generate-ai-audio': {
      post: {
        tags: ['Media Library'],
        summary: 'Generate single-speaker AI audio file using Edge-TTS',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { text: { type: 'string' }, voice: { type: 'string' }, speed: { type: 'number' }, emotion: { type: 'string' } } } } }
        },
        responses: { 201: { description: 'AI audio created' } }
      }
    },
    '/api/media/generate-ai-dialogue': {
      post: {
        tags: ['Media Library'],
        summary: 'Generate multi-speaker conversation audio',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { title: { type: 'string' }, dialogue_lines: { type: 'array', items: { type: 'object' } } } } } }
        },
        responses: { 201: { description: 'Dialogue audio generated' } }
      }
    },
    '/api/media/synthesize-preview': {
      post: {
        tags: ['Media Library'],
        summary: 'Live preview audio stream (POST, All Roles)',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { text: { type: 'string' }, voice: { type: 'string' }, speed: { type: 'number' } } } } }
        },
        responses: { 200: { description: 'Audio stream (audio/mpeg)' } }
      },
      get: {
        tags: ['Media Library'],
        summary: 'Live preview audio stream (GET, All Roles)',
        parameters: [
          { name: 'text', in: 'query', schema: { type: 'string' } },
          { name: 'voice', in: 'query', schema: { type: 'string' } },
          { name: 'speed', in: 'query', schema: { type: 'number' } }
        ],
        responses: { 200: { description: 'Audio stream (audio/mpeg)' } }
      }
    },
    '/api/media/target-lessons': {
      get: {
        tags: ['Media Library'],
        summary: 'Get lesson target placements for media items',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Lessons placement list' } }
      }
    },
    '/api/media/speaking-targets': {
      get: {
        tags: ['Media Library'],
        summary: 'Get speaking targets placement list',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Speaking targets' } }
      }
    },
    '/api/media/{id}': {
      put: {
        tags: ['Media Library'],
        summary: 'Update media item details',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'Updated' } }
      },
      delete: {
        tags: ['Media Library'],
        summary: 'Delete media item',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Deleted' } }
      }
    },

    // ----------------------------------------------------
    // TUTOR PORTAL
    // ----------------------------------------------------
    '/api/tutor/submissions': {
      get: {
        tags: ['Tutor Portal'],
        summary: 'Get student submissions awaiting tutor review',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Submissions list' } }
      }
    },
    '/api/tutor/submissions/{attemptId}/review': {
      post: {
        tags: ['Tutor Portal'],
        summary: 'Submit tutor review and audio/text feedback',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'attemptId', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { score: { type: 'number' }, feedback: { type: 'string' } } } } }
        },
        responses: { 200: { description: 'Review submitted' } }
      }
    },
    '/api/tutor/lessons': {
      get: {
        tags: ['Tutor Portal'],
        summary: 'List tutor lessons',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Lessons list' } }
      },
      post: {
        tags: ['Tutor Portal'],
        summary: 'Create lesson (Tutor)',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/LessonCreateDto' } } } },
        responses: { 201: { description: 'Lesson created' } }
      }
    },
    '/api/tutor/courses/{id}/lessons': {
      get: {
        tags: ['Tutor Portal'],
        summary: 'Get lessons for specific course (Tutor)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Lessons list' } }
      }
    },
    '/api/tutor/lessons/{id}': {
      put: {
        tags: ['Tutor Portal'],
        summary: 'Update lesson (Tutor)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'Lesson updated' } }
      },
      delete: {
        tags: ['Tutor Portal'],
        summary: 'Delete lesson (Tutor)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Lesson deleted' } }
      }
    },
    '/api/tutor/lessons/{lessonId}/contents': {
      get: {
        tags: ['Tutor Portal'],
        summary: 'Get lesson contents (Tutor)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'lessonId', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Contents list' } }
      },
      post: {
        tags: ['Tutor Portal'],
        summary: 'Create lesson content item (Tutor)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'lessonId', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/LessonContentCreateDto' } } } },
        responses: { 201: { description: 'Content created' } }
      }
    },
    '/api/tutor/lessons/{lessonId}/contents/reorder': {
      post: {
        tags: ['Tutor Portal'],
        summary: 'Reorder lesson contents (Tutor)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'lessonId', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { orders: { type: 'array', items: { type: 'object' } } } } } }
        },
        responses: { 200: { description: 'Reordered' } }
      }
    },
    '/api/tutor/lessons/contents/{id}': {
      put: {
        tags: ['Tutor Portal'],
        summary: 'Update lesson content item (Tutor)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'Content updated' } }
      },
      delete: {
        tags: ['Tutor Portal'],
        summary: 'Delete lesson content item (Tutor)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Content deleted' } }
      }
    },
    '/api/tutor/lessons/contents/{id}/attachments': {
      get: {
        tags: ['Tutor Portal'],
        summary: 'Get attachments for lesson content item',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Attachments list' } }
      }
    },
    '/api/tutor/quizzes': {
      get: {
        tags: ['Tutor Portal'],
        summary: 'List quizzes (Tutor)',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Quizzes list' } }
      },
      post: {
        tags: ['Tutor Portal'],
        summary: 'Create quiz (Tutor)',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/QuizCreateDto' } } } },
        responses: { 201: { description: 'Quiz created' } }
      }
    },
    '/api/tutor/quizzes/{id}': {
      put: {
        tags: ['Tutor Portal'],
        summary: 'Update quiz (Tutor)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'Quiz updated' } }
      },
      delete: {
        tags: ['Tutor Portal'],
        summary: 'Delete quiz (Tutor)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Quiz deleted' } }
      }
    },
    '/api/tutor/quizzes/{quizId}/questions': {
      get: {
        tags: ['Tutor Portal'],
        summary: 'Get questions in quiz (Tutor)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'quizId', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Questions list' } }
      },
      post: {
        tags: ['Tutor Portal'],
        summary: 'Create question in quiz (Tutor)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'quizId', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/QuestionCreateDto' } } } },
        responses: { 201: { description: 'Question created' } }
      }
    },
    '/api/tutor/quizzes/questions/{questionId}': {
      put: {
        tags: ['Tutor Portal'],
        summary: 'Update quiz question (Tutor)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'questionId', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'Question updated' } }
      },
      delete: {
        tags: ['Tutor Portal'],
        summary: 'Delete quiz question (Tutor)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'questionId', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Question deleted' } }
      }
    },
    '/api/tutor/quizzes/questions/{questionId}/options': {
      post: {
        tags: ['Tutor Portal'],
        summary: 'Add question option (Tutor)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'questionId', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { optionText: { type: 'string' }, isCorrect: { type: 'boolean' } } } } } },
        responses: { 201: { description: 'Option added' } }
      }
    },
    '/api/tutor/quizzes/questions/{questionId}/options/bulk': {
      post: {
        tags: ['Tutor Portal'],
        summary: 'Bulk set question options (Tutor)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'questionId', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { options: { type: 'array', items: { type: 'object' } } } } } } },
        responses: { 200: { description: 'Options updated' } }
      }
    },
    '/api/tutor/quizzes/questions/{questionId}/matching-pairs': {
      post: {
        tags: ['Tutor Portal'],
        summary: 'Set matching pairs for question (Tutor)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'questionId', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { pairs: { type: 'array', items: { type: 'object' } } } } } } },
        responses: { 200: { description: 'Pairs saved' } }
      }
    },
    '/api/tutor/quizzes/questions/options/{optionId}': {
      put: {
        tags: ['Tutor Portal'],
        summary: 'Update option details (Tutor)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'optionId', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'Option updated' } }
      },
      delete: {
        tags: ['Tutor Portal'],
        summary: 'Delete question option (Tutor)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'optionId', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Option deleted' } }
      }
    },
    '/api/tutor/quizzes/questions/{questionId}/image': {
      put: {
        tags: ['Tutor Portal'],
        summary: 'Upload image for quiz question (Tutor)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'questionId', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { imageBase64: { type: 'string' } } } } } },
        responses: { 200: { description: 'Image updated' } }
      }
    },
    '/api/tutor/quizzes/questions/options/{optionId}/image': {
      put: {
        tags: ['Tutor Portal'],
        summary: 'Upload image for question option (Tutor)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'optionId', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { imageBase64: { type: 'string' } } } } } },
        responses: { 200: { description: 'Option image updated' } }
      }
    },

    // ----------------------------------------------------
    // ADMIN PANEL
    // ----------------------------------------------------
    '/api/admin/users': {
      get: {
        tags: ['Admin Panel'],
        summary: 'List all registered platform users (Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'roleId', in: 'query', schema: { type: 'integer' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } }
        ],
        responses: { 200: { description: 'Users list' } }
      },
      post: {
        tags: ['Admin Panel'],
        summary: 'Create new user manually (Admin)',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/UserRegisterDto' } } } },
        responses: { 201: { description: 'User created' } }
      }
    },
    '/api/admin/users/{id}': {
      put: {
        tags: ['Admin Panel'],
        summary: 'Update user account (Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'User updated' } }
      },
      delete: {
        tags: ['Admin Panel'],
        summary: 'Delete user account (Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'User deleted' } }
      }
    },
    '/api/admin/users/{id}/progress-summary': {
      get: {
        tags: ['Admin Panel'],
        summary: 'Get student course progress breakdown (Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Progress summary' } }
      }
    },
    '/api/admin/users/{id}/reset-progress': {
      post: {
        tags: ['Admin Panel'],
        summary: 'Reset student lesson & quiz progress (Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { courseId: { type: 'integer' } } } } } },
        responses: { 200: { description: 'Progress reset' } }
      }
    },
    '/api/admin/users/bulk-action': {
      post: {
        tags: ['Admin Panel'],
        summary: 'Perform bulk user actions (activate, deactivate, role update, delete)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { userIds: { type: 'array', items: { type: 'integer' } }, action: { type: 'string' } } } } }
        },
        responses: { 200: { description: 'Bulk action applied' } }
      }
    },
    '/api/admin/courses': {
      get: {
        tags: ['Admin Panel'],
        summary: 'List all courses with admin stats (Admin/Content Manager)',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Courses list' } }
      },
      post: {
        tags: ['Admin Panel'],
        summary: 'Create course (Admin/Content Manager)',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CourseCreateDto' } } } },
        responses: { 201: { description: 'Course created' } }
      }
    },
    '/api/admin/courses/{id}': {
      put: {
        tags: ['Admin Panel'],
        summary: 'Update course details',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'Course updated' } }
      },
      delete: {
        tags: ['Admin Panel'],
        summary: 'Delete course',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Course deleted' } }
      }
    },
    '/api/admin/courses/{id}/status': {
      put: {
        tags: ['Admin Panel'],
        summary: 'Update course status (PUBLISHED, DRAFT, ARCHIVED)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string' } } } } }
        },
        responses: { 200: { description: 'Status updated' } }
      }
    },
    '/api/admin/courses/{id}/lessons': {
      get: {
        tags: ['Admin Panel'],
        summary: 'Get all lessons belonging to course',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Lessons list' } }
      }
    },
    '/api/admin/categories': {
      get: {
        tags: ['Admin Panel'],
        summary: 'List course categories',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Categories list' } }
      },
      post: {
        tags: ['Admin Panel'],
        summary: 'Create course category',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CategoryCreateDto' } } } },
        responses: { 201: { description: 'Category created' } }
      }
    },
    '/api/admin/categories/{id}': {
      put: {
        tags: ['Admin Panel'],
        summary: 'Update category',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'Category updated' } }
      },
      delete: {
        tags: ['Admin Panel'],
        summary: 'Delete category',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Category deleted' } }
      }
    },
    '/api/admin/modules': {
      get: {
        tags: ['Admin Panel'],
        summary: 'List curriculum modules',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Modules list' } }
      },
      post: {
        tags: ['Admin Panel'],
        summary: 'Create module in course',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ModuleCreateDto' } } } },
        responses: { 201: { description: 'Module created' } }
      }
    },
    '/api/admin/modules/{id}': {
      put: {
        tags: ['Admin Panel'],
        summary: 'Update curriculum module',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'Module updated' } }
      },
      delete: {
        tags: ['Admin Panel'],
        summary: 'Delete curriculum module',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Module deleted' } }
      }
    },
    '/api/admin/lessons': {
      get: {
        tags: ['Admin Panel'],
        summary: 'List all lessons',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Lessons list' } }
      },
      post: {
        tags: ['Admin Panel'],
        summary: 'Create lesson (Admin/Content Manager)',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/LessonCreateDto' } } } },
        responses: { 201: { description: 'Lesson created' } }
      }
    },
    '/api/admin/lessons/{id}': {
      put: {
        tags: ['Admin Panel'],
        summary: 'Update lesson details',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'Lesson updated' } }
      },
      delete: {
        tags: ['Admin Panel'],
        summary: 'Delete lesson',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Lesson deleted' } }
      }
    },
    '/api/admin/lessons/{lessonId}/contents': {
      get: {
        tags: ['Admin Panel'],
        summary: 'Get contents for lesson',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'lessonId', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Contents list' } }
      },
      post: {
        tags: ['Admin Panel'],
        summary: 'Create content item in lesson',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'lessonId', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/LessonContentCreateDto' } } } },
        responses: { 201: { description: 'Content created' } }
      }
    },
    '/api/admin/lessons/{lessonId}/contents/reorder': {
      post: {
        tags: ['Admin Panel'],
        summary: 'Reorder contents inside lesson',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'lessonId', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { orders: { type: 'array', items: { type: 'object' } } } } } } },
        responses: { 200: { description: 'Reordered' } }
      }
    },
    '/api/admin/lessons/contents/{id}': {
      put: {
        tags: ['Admin Panel'],
        summary: 'Update lesson content item',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'Content updated' } }
      },
      delete: {
        tags: ['Admin Panel'],
        summary: 'Delete lesson content item',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Content deleted' } }
      }
    },
    '/api/admin/lessons/contents/{id}/attachments': {
      get: {
        tags: ['Admin Panel'],
        summary: 'Get attachments for lesson content',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Attachments list' } }
      }
    },
    '/api/admin/quizzes': {
      get: {
        tags: ['Admin Panel'],
        summary: 'List all quizzes across courses',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Quizzes list' } }
      },
      post: {
        tags: ['Admin Panel'],
        summary: 'Create quiz (Admin)',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/QuizCreateDto' } } } },
        responses: { 201: { description: 'Quiz created' } }
      }
    },
    '/api/admin/quizzes/{id}': {
      put: {
        tags: ['Admin Panel'],
        summary: 'Update quiz details',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'Quiz updated' } }
      },
      delete: {
        tags: ['Admin Panel'],
        summary: 'Delete quiz',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Quiz deleted' } }
      }
    },
    '/api/admin/quizzes/{quizId}/questions': {
      get: {
        tags: ['Admin Panel'],
        summary: 'Get questions belonging to quiz',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'quizId', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Questions list' } }
      },
      post: {
        tags: ['Admin Panel'],
        summary: 'Create question in quiz',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'quizId', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/QuestionCreateDto' } } } },
        responses: { 201: { description: 'Question created' } }
      }
    },
    '/api/admin/quizzes/questions/{questionId}': {
      put: {
        tags: ['Admin Panel'],
        summary: 'Update question in quiz',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'questionId', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'Question updated' } }
      },
      delete: {
        tags: ['Admin Panel'],
        summary: 'Delete question in quiz',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'questionId', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Question deleted' } }
      }
    },
    '/api/admin/quizzes/questions/{questionId}/options': {
      post: {
        tags: ['Admin Panel'],
        summary: 'Add single option to question',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'questionId', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { optionText: { type: 'string' }, isCorrect: { type: 'boolean' } } } } } },
        responses: { 201: { description: 'Option added' } }
      }
    },
    '/api/admin/quizzes/questions/{questionId}/options/bulk': {
      post: {
        tags: ['Admin Panel'],
        summary: 'Bulk replace options for question',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'questionId', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { options: { type: 'array', items: { type: 'object' } } } } } } },
        responses: { 200: { description: 'Options replaced' } }
      }
    },
    '/api/admin/quizzes/questions/{questionId}/matching-pairs': {
      post: {
        tags: ['Admin Panel'],
        summary: 'Set matching pairs for question',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'questionId', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { pairs: { type: 'array', items: { type: 'object' } } } } } } },
        responses: { 200: { description: 'Pairs saved' } }
      }
    },
    '/api/admin/quizzes/questions/options/{optionId}': {
      put: {
        tags: ['Admin Panel'],
        summary: 'Update option text & correctness',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'optionId', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'Option updated' } }
      },
      delete: {
        tags: ['Admin Panel'],
        summary: 'Delete option',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'optionId', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Option deleted' } }
      }
    },
    '/api/admin/quizzes/questions/{questionId}/image': {
      put: {
        tags: ['Admin Panel'],
        summary: 'Upload image for quiz question (base64)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'questionId', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { imageBase64: { type: 'string' } } } } } },
        responses: { 200: { description: 'Question image saved' } }
      }
    },
    '/api/admin/quizzes/questions/options/{optionId}/image': {
      put: {
        tags: ['Admin Panel'],
        summary: 'Upload image for question option (base64)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'optionId', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { imageBase64: { type: 'string' } } } } } },
        responses: { 200: { description: 'Option image saved' } }
      }
    },
    '/api/admin/speaking-tests': {
      get: {
        tags: ['Admin Panel'],
        summary: 'List speaking tests',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Speaking tests list' } }
      },
      post: {
        tags: ['Admin Panel'],
        summary: 'Create speaking test',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/SpeakingTestCreateDto' } } } },
        responses: { 201: { description: 'Speaking test created' } }
      }
    },
    '/api/admin/speaking-tests/{id}': {
      put: {
        tags: ['Admin Panel'],
        summary: 'Update speaking test',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'Speaking test updated' } }
      },
      delete: {
        tags: ['Admin Panel'],
        summary: 'Delete speaking test',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Speaking test deleted' } }
      }
    },
    '/api/admin/speaking-tests/{testId}/prompts': {
      post: {
        tags: ['Admin Panel'],
        summary: 'Create prompt in speaking test',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'testId', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/SpeakingPromptCreateDto' } } } },
        responses: { 201: { description: 'Prompt created' } }
      }
    },
    '/api/admin/speaking-tests/prompts/{promptId}': {
      put: {
        tags: ['Admin Panel'],
        summary: 'Update speaking prompt',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'promptId', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'Prompt updated' } }
      },
      delete: {
        tags: ['Admin Panel'],
        summary: 'Delete speaking prompt',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'promptId', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Prompt deleted' } }
      }
    },
    '/api/admin/certificate-templates': {
      get: {
        tags: ['Admin Panel'],
        summary: 'List certificate design templates',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Templates list' } }
      },
      post: {
        tags: ['Admin Panel'],
        summary: 'Create certificate design template',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CertificateTemplateDto' } } } },
        responses: { 201: { description: 'Template created' } }
      }
    },
    '/api/admin/certificate-templates/{id}': {
      put: {
        tags: ['Admin Panel'],
        summary: 'Update certificate template',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'Template updated' } }
      },
      delete: {
        tags: ['Admin Panel'],
        summary: 'Delete certificate template',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Template deleted' } }
      }
    },
    '/api/admin/scalev-packages': {
      get: {
        tags: ['Admin Panel'],
        summary: 'List Scalev course packages mapping',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Packages list' } }
      },
      post: {
        tags: ['Admin Panel'],
        summary: 'Create Scalev package mapping',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ScalevPackageDto' } } } },
        responses: { 201: { description: 'Package created' } }
      }
    },
    '/api/admin/scalev-packages/{id}': {
      put: {
        tags: ['Admin Panel'],
        summary: 'Update Scalev package mapping',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'Package updated' } }
      },
      delete: {
        tags: ['Admin Panel'],
        summary: 'Delete Scalev package mapping',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Package deleted' } }
      }
    },
    '/api/admin/orders': {
      get: {
        tags: ['Admin Panel'],
        summary: 'List all transaction orders (Admin)',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Orders list' } }
      }
    },
    '/api/admin/orders/{id}/status': {
      put: {
        tags: ['Admin Panel'],
        summary: 'Update order payment status',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', enum: ['paid', 'pending', 'cancelled', 'failed'] } } } } }
        },
        responses: { 200: { description: 'Order status updated' } }
      }
    },
    '/api/admin/orders/import-scalev': {
      post: {
        tags: ['Admin Panel'],
        summary: 'Import orders from Scalev API',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Import finished' } }
      }
    },
    '/api/admin/orders/scalev-sync': {
      post: {
        tags: ['Admin Panel'],
        summary: 'Manually trigger Scalev order synchronization',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Sync completed' } }
      }
    },
    '/api/admin/orders/manual-proofs': {
      get: {
        tags: ['Admin Panel'],
        summary: 'Get all submitted bank transfer proofs for review',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Manual proofs list' } }
      }
    },
    '/api/admin/orders/manual-proofs/{id}/verify': {
      post: {
        tags: ['Admin Panel'],
        summary: 'Approve or reject manual payment proof & auto-enroll',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { action: { type: 'string', enum: ['approve', 'reject'] }, adminNote: { type: 'string' } } } } }
        },
        responses: { 200: { description: 'Verification applied' } }
      }
    },
    '/api/admin/enrollments': {
      get: {
        tags: ['Admin Panel'],
        summary: 'List all student enrollments',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Enrollments list' } }
      }
    },
    '/api/admin/enrollments/manual': {
      post: {
        tags: ['Admin Panel'],
        summary: 'Manually enroll student into course',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { userId: { type: 'integer' }, courseId: { type: 'integer' } } } } }
        },
        responses: { 200: { description: 'Student enrolled' } }
      }
    },
    '/api/admin/enrollments/{id}': {
      delete: {
        tags: ['Admin Panel'],
        summary: 'Revoke / delete enrollment',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Enrollment deleted' } }
      }
    },
    '/api/admin/banners': {
      get: {
        tags: ['Admin Panel'],
        summary: 'List all promotional banners',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Banners list' } }
      },
      post: {
        tags: ['Admin Panel'],
        summary: 'Create new banner',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/BannerCreateDto' } } } },
        responses: { 201: { description: 'Banner created' } }
      }
    },
    '/api/admin/banners/{id}': {
      put: {
        tags: ['Admin Panel'],
        summary: 'Update promotional banner',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'Banner updated' } }
      },
      delete: {
        tags: ['Admin Panel'],
        summary: 'Delete promotional banner',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Banner deleted' } }
      }
    },
    '/api/admin/tags': {
      get: {
        tags: ['Admin Panel'],
        summary: 'List all course taxonomy tags',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Tags list' } }
      },
      post: {
        tags: ['Admin Panel'],
        summary: 'Create new taxonomy tag',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/TagCreateDto' } } } },
        responses: { 201: { description: 'Tag created' } }
      }
    },
    '/api/admin/tags/{id}': {
      put: {
        tags: ['Admin Panel'],
        summary: 'Update taxonomy tag',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'Tag updated' } }
      },
      delete: {
        tags: ['Admin Panel'],
        summary: 'Delete taxonomy tag',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Tag deleted' } }
      }
    },
    '/api/admin/settings': {
      get: {
        tags: ['Admin Panel'],
        summary: 'Get platform system settings',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Platform settings' } }
      },
      put: {
        tags: ['Admin Panel'],
        summary: 'Update platform system settings',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'Settings saved' } }
      }
    },
    '/api/admin/settings/public': {
      get: {
        tags: ['Admin Panel'],
        summary: 'Get public platform settings (No Auth)',
        responses: { 200: { description: 'Public settings' } }
      }
    },
    '/api/admin/payment/settings': {
      get: {
        tags: ['Admin Panel'],
        summary: 'Get detailed payment gateway settings (Admin)',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Payment settings' } }
      },
      put: {
        tags: ['Admin Panel'],
        summary: 'Update payment gateway settings (Admin)',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'Payment settings saved' } }
      }
    },
    '/api/admin/emails/settings': {
      get: {
        tags: ['Admin Panel'],
        summary: 'Get SMTP and Roundcube Webmail IMAP settings (Admin)',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Email settings' } }
      },
      post: {
        tags: ['Admin Panel'],
        summary: 'Save SMTP and Roundcube settings (Admin)',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/EmailSettingsDto' } } } },
        responses: { 200: { description: 'Email settings saved' } }
      }
    },
    '/api/admin/emails/test-smtp': {
      post: {
        tags: ['Admin Panel'],
        summary: 'Test SMTP connection and send test email (Admin)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { testRecipient: { type: 'string', format: 'email' } } } } }
        },
        responses: { 200: { description: 'SMTP test result' } }
      }
    },
    '/api/admin/emails/sync-roundcube': {
      post: {
        tags: ['Admin Panel'],
        summary: 'Sync latest incoming emails via IMAP / Roundcube (Admin)',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Emails synchronized' } }
      }
    },
    '/api/admin/emails/messages': {
      get: {
        tags: ['Admin Panel'],
        summary: 'List email messages in inbox/sent/drafts (Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'folder', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer' } }
        ],
        responses: { 200: { description: 'Messages list' } }
      },
      post: {
        tags: ['Admin Panel'],
        summary: 'Compose and send email message (Admin)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { to: { type: 'string' }, subject: { type: 'string' }, bodyHtml: { type: 'string' } } } } }
        },
        responses: { 201: { description: 'Email sent' } }
      }
    },
    '/api/admin/emails/messages/{id}/folder': {
      put: {
        tags: ['Admin Panel'],
        summary: 'Move email message to folder (trash, archive, spam) (Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { folder: { type: 'string' } } } } } },
        responses: { 200: { description: 'Folder updated' } }
      }
    },
    '/api/admin/emails/messages/{id}': {
      delete: {
        tags: ['Admin Panel'],
        summary: 'Permanently delete email message (Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Message deleted' } }
      }
    },
    '/api/admin/convert-pptx': {
      post: {
        tags: ['Admin Panel'],
        summary: 'Convert PPTX file to PDF slides using LibreOffice (Admin/Content Manager)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } } }
        },
        responses: { 200: { description: 'PDF stream or slide preview URLs' } }
      }
    },
    '/api/admin/analytics': {
      get: {
        tags: ['Admin Panel'],
        summary: 'Get platform revenue, users, and enrollment analytics (Admin)',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Analytics breakdown' } }
      }
    }
  }
};

// Custom Swagger UI styling for sleek, modern appearance
export const swaggerUiOptions: swaggerUi.SwaggerOptions = {
  customCss: \`
    .swagger-ui .topbar { background-color: #0f172a; border-bottom: 2px solid #3b82f6; }
    .swagger-ui .topbar .download-url-wrapper { display: none; }
    .swagger-ui .topbar-wrapper img { content: url('https://img.icons8.com/fluency/96/books.png'); height: 38px; width: 38px; }
    .swagger-ui .info { margin: 25px 0; }
    .swagger-ui .info .title { color: #1e293b; font-weight: 700; }
    .swagger-ui .scheme-container { background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; }
    .swagger-ui .btn.authorize { background-color: #10b981; border-color: #10b981; color: white; border-radius: 6px; }
    .swagger-ui .btn.authorize svg { fill: white; }
    .swagger-ui .opblock { border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .swagger-ui .opblock .opblock-summary { font-size: 14px; font-weight: 600; }
  \`,
  customSiteTitle: 'E-Learning Language LMS API Docs',
  customfavIcon: 'https://img.icons8.com/fluency/96/books.png',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    docExpansion: 'list',
    defaultModelsExpandDepth: 3
  }
};
`;

fs.writeFileSync(path.join(process.cwd(), 'src', 'docs', 'swagger.ts'), fullSwaggerCode, 'utf8');
console.log('✅ Generated 100% complete swagger.ts specification with all backend routes!');
