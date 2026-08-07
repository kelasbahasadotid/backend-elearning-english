import pool from '../config/db';
import bcrypt from 'bcryptjs';

async function seed() {
  console.log('Starting Database Seeder for Stage 1 Expanded Syllabus...');
  const connection = await pool.getConnection();
  try {
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    // 1. Truncate tables
    const tablesToTruncate = [
      'course_categories',
      'course_levels',
      'courses',
      'course_versions',
      'modules',
      'lessons',
      'lesson_contents',
      'assessments',
      'assessment_sections',
      'questions',
      'question_options',
      'speaking_tests',
      'speaking_prompts',
      'certificate_templates',
      'banners',
      'users',
      'orders',
      'order_items',
      'enrollments',
      'course_progress',
      'xp_transactions',
      'user_profiles',
      'user_statistics'
    ];

    for (const table of tablesToTruncate) {
      console.log(`Truncating table: ${table}`);
      await connection.query(`TRUNCATE TABLE ${table}`);
    }

    console.log('All target tables truncated successfully.');

    // 2. Seed Categories
    console.log('Seeding course_categories...');
    await connection.query(
      `INSERT INTO course_categories (id, parent_id, name, slug, description, sort_order, status) 
       VALUES 
       (1, NULL, 'General English', 'general-english', 'Improve reading, writing, and speaking skills.', 1, 'ACTIVE'),
       (2, NULL, 'Mini Quiz', 'mini-quiz', 'Short quizzes and practice tasks to evaluate your grammar and vocabulary speed.', 2, 'ACTIVE'),
       (3, NULL, 'Pronunciation', 'pronunciation', 'Improve speaking AI accent, voice phonetics and reading aloud.', 3, 'ACTIVE'),
       (4, NULL, 'Grammar', 'grammar', 'Master English tenses, clauses, sentence patterns and syntax.', 4, 'ACTIVE'),
       (5, NULL, 'Vocabulary', 'vocabulary', 'Learn daily expressions, phrasal verbs, idioms and context terms.', 5, 'ACTIVE'),
       (6, NULL, 'Conversation', 'conversation', 'Interactive dialogue practice and communication scenarios.', 6, 'ACTIVE')`
    );

    // 3. Seed Levels
    console.log('Seeding course_levels...');
    await connection.query(
      `INSERT INTO course_levels (id, code, name, description, sort_order, status) 
       VALUES (1, 'A1', 'Beginner', 'Basic daily expressions.', 1, 'ACTIVE')`
    );

    // 4. Seed Users for All Roles (password: 'SuperAdmin123', 'Admin123', 'Tutor123', 'Student123')
    console.log('Seeding role accounts...');
    
    // Ensure CONTENT_MANAGER role exists
    await connection.query(
      `INSERT IGNORE INTO roles (id, code, name, status) 
       VALUES (5, 'CONTENT_MANAGER', 'Content Manager', 'ACTIVE')`
    );

    const superAdminHash = await bcrypt.hash('SuperAdmin123', 10);
    const adminPassHash = await bcrypt.hash('Admin123', 10);
    const tutorPassHash = await bcrypt.hash('Tutor123', 10);
    const studentPassHash = await bcrypt.hash('Student123', 10);
    const contentPassHash = await bcrypt.hash('ContentManager123', 10);

    await connection.query(
      `INSERT INTO users (id, role_id, full_name, email, username, password, status) VALUES 
       (1, 1, 'Super Admin Global English', 'superadmin@globalenglish.com', 'superadmin', ?, 'ACTIVE'),
       (2, 2, 'Admin Global English', 'admin@globalenglish.com', 'admin', ?, 'ACTIVE'),
       (3, 3, 'Tutor Global English', 'tutor@globalenglish.com', 'tutor', ?, 'ACTIVE'),
       (4, 4, 'Student Global English', 'student@globalenglish.com', 'student', ?, 'ACTIVE'),
       (5, 4, 'Anita Student Global English', 'anita@gmail.com', 'anita', ?, 'ACTIVE'),
       (6, 5, 'Content Manager Global English', 'contentmanager@globalenglish.com', 'contentmanager', ?, 'ACTIVE')`,
      [superAdminHash, adminPassHash, tutorPassHash, studentPassHash, studentPassHash, contentPassHash]
    );

    for (const uId of [1, 2, 3, 4, 5, 6]) {
      await connection.query('INSERT INTO user_profiles (user_id) VALUES (?)', [uId]);
      await connection.query('INSERT INTO user_statistics (user_id, xp, level) VALUES (?, 0, 1)', [uId]);
    }

    // 5. Seed Course
    console.log('Seeding courses...');
    await connection.query(
      `INSERT INTO courses (id, category_id, level_id, created_by, code, title, slug, short_description, description, cefr_level, price, discount_price, certificate_enabled, speaking_ai_enabled, status) 
       VALUES (1, 1, 1, 1, 'ENG-BEG', 'English Beginner Speaking', 'english-beginner', 
       'Learn basic present tense structures and speak confidently with AI feedback.', 
       'In this course, you will learn the structures of Present Continuous and Simple Present, read practice passages, take interactive quizzes, and speak directly into the microphone for real-time AI phonetic grades.',
       'A1', 250000.00, 199000.00, 1, 1, 'PUBLISHED')`
    );

    // 6. Seed Course Version
    console.log('Seeding course_versions...');
    await connection.query(
      `INSERT INTO course_versions (id, course_id, version, is_current, published_at, created_by) 
       VALUES (1, 1, '1.0', 1, NOW(), 1)`
    );

    // 7. Seed Modules
    console.log('Seeding modules...');
    await connection.query(
      `INSERT INTO modules (id, course_version_id, title, description, module_order, estimated_minutes, status) 
       VALUES (1, 1, 'Present Tense Structures', 'Present continuous and basic introduction sentences.', 1, 90, 'PUBLISHED')`
    );

    // 8. Seed Lessons — 5 core types only (VIDEO, READING, QUIZ, SPEAKING, EXAM)
    // Question variety is managed at the question level (question_type_id), not lesson level
    console.log('Seeding lessons (5 core types)...');
    await connection.query(
      `INSERT INTO lessons (id, module_id, lesson_type, title, slug, lesson_order, duration_minutes, is_preview, is_required, passing_score, xp_reward, status) 
       VALUES 
       (1, 1, 'VIDEO',   'Theory: Present Continuous Structure',     'present-continuous-intro',    1, 15, 1, 1, 70, 15, 'PUBLISHED'),
       (2, 1, 'READING', 'Article: Common Exceptions & Adverbs',     'tenses-exceptions-reading',   2, 10, 1, 1, 70, 15, 'PUBLISHED'),
       (3, 1, 'QUIZ',    'Mixed Practice Quiz: All Question Types',   'mixed-practice-quiz',         3, 20, 0, 1, 70, 40, 'PUBLISHED'),
       (4, 1, 'SPEAKING','Pronunciation AI Challenge',                'pronunciation-ai-challenge',  4, 10, 0, 1, 70, 30, 'PUBLISHED'),
       (5, 1, 'EXAM',    'TOEFL Mock Final Exam',                    'toefl-mock-exam',             5, 30, 0, 1, 70, 60, 'PUBLISHED')`
    );

    // 9. Seed Lesson Contents (rich content for all 5 lessons — using parameterized queries to avoid escaping issues)
    console.log('Seeding lesson_contents (all 5 lessons)...');
    const lessonContents = [
      // LESSON 1: VIDEO — 2 content items
      [1, 1, 'VIDEO', 'Introduction to Present Continuous Tense',
        'This lesson introduces the Present Continuous tense, used for actions happening RIGHT NOW. Formula: Subject + am/is/are + Verb-ing. Examples: I am studying. She is cooking. They are playing soccer. Pay special attention to the correct form of "to be" (am/is/are) and adding -ing to the base verb.',
        1, 1, 8, 'ACTIVE'],
      [2, 1, 'VIDEO', 'When to Use Present Continuous vs Simple Present',
        'Key differences: Use PRESENT CONTINUOUS for temporary/in-progress actions ("I am reading a book right now"). Use SIMPLE PRESENT for habits and routines ("I read books every night"). Time signals for Present Continuous: NOW, AT THE MOMENT, CURRENTLY, RIGHT NOW, AT PRESENT, LOOK!, LISTEN!',
        2, 1, 7, 'ACTIVE'],
      // LESSON 2: READING — 3 sections
      [3, 2, 'READING', 'Section 1: Stative Verbs — The Exception Rule',
        'STATIVE VERBS describe states, not actions, and are NEVER used in the continuous form. Common stative verbs: KNOW, BELIEVE, UNDERSTAND, THINK (opinion), LOVE, HATE, WANT, NEED, PREFER, SEE, HEAR, SMELL, TASTE, HAVE (possession), OWN, BELONG. WRONG: She is knowing the answer. CORRECT: She knows the answer. TIP: If you can substitute the verb with "exist" or "be", it is probably stative.',
        1, 1, 4, 'ACTIVE'],
      [4, 2, 'READING', 'Section 2: Adverbs of Frequency with Simple Present',
        'Adverbs of frequency tell us HOW OFTEN something happens. Position: BEFORE the main verb but AFTER the verb "to be". Order: ALWAYS (100%) > USUALLY (80%) > OFTEN (60%) > SOMETIMES (50%) > RARELY (20%) > NEVER (0%). Examples: She always arrives early. He is usually punctual. They rarely miss a deadline. He never eats meat.',
        2, 1, 3, 'ACTIVE'],
      [5, 2, 'READING', 'Section 3: Common Irregular Spelling Rules (-ing form)',
        'Spelling rules for adding -ing: (1) Single vowel + single consonant = DOUBLE the consonant then add -ing (run > running, sit > sitting, swim > swimming). (2) Ends in silent -e = DROP the e then add -ing (make > making, write > writing, drive > driving). (3) Ends in -ie = CHANGE ie to y then add -ing (lie > lying, die > dying). (4) All other cases = just add -ing (play > playing, read > reading).',
        3, 1, 3, 'ACTIVE'],
      // LESSON 3: QUIZ — Overview content before the quiz
      [6, 3, 'READING', 'Quiz Overview: What to Expect',
        'This Mixed Practice Quiz contains 12 questions covering ALL five question types you will encounter: (1) MCQ - pick the single best answer from 4 options. (2) Multi-Select - choose ALL correct options. (3) True or False - decide if each grammar statement is correct. (4) Fill in the Blank - type the correct conjugated verb form. (5) Word Ordering - click words in the correct sentence order. Passing score: 70%. Good luck!',
        1, 0, 2, 'ACTIVE'],
      // LESSON 4: SPEAKING — Pronunciation guide before the exercise
      [7, 4, 'READING', 'Speaking Tips: How to Maximize Your Score',
        'Before you start the pronunciation exercise, read these tips: (1) SPEAK CLEARLY - Avoid rushing. Speak at a natural, conversational pace. (2) OPEN YOUR MOUTH - Fully articulate each word and avoid mumbling. (3) STRESS KEY WORDS - Stress content words (nouns, verbs, adjectives) more than function words. (4) PRONUNCIATION FOCUS: /th/ sound (the, that, this), /r/ vs /l/ (right vs light), short vs long vowels (ship vs sheep, bit vs beat). (5) The AI evaluates phoneme accuracy, word stress, and sentence rhythm. Aim for natural fluency.',
        1, 0, 2, 'ACTIVE'],
      // LESSON 5: EXAM — Strategy guide before the final exam
      [8, 5, 'READING', 'TOEFL Mock Exam Strategy and Instructions',
        'This final exam simulates a real TOEFL-style assessment. Rules and strategy: (1) TIME MANAGEMENT - 30 minutes for 10 questions. Do not spend more than 3 minutes per question. (2) PROCESS OF ELIMINATION - For MCQ, eliminate clearly wrong answers first to improve your odds. (3) GRAMMAR QUESTIONS - Look for subject-verb agreement, tense consistency, and inversion rules. (4) VOCABULARY QUESTIONS - Use context clues and word roots to determine meaning. (5) READ CAREFULLY - All options are designed to appear similar. Passing score: 70%. This exam counts toward your course certificate.',
        1, 0, 3, 'ACTIVE'],
    ];
    for (const row of lessonContents) {
      await connection.execute(
        `INSERT INTO lesson_contents (id, lesson_id, content_type, title, description, content_order, is_required, estimated_minutes, status) VALUES (?,?,?,?,?,?,?,?,?)`,
        row
      );
    }


    // 10. Seed Assessments (clean — only for lessons 3, 4, 5)
    console.log('Seeding assessments...');
    await connection.query(
      `INSERT INTO assessments (id, lesson_id, module_id, course_id, assessment_type_id, title, description, instruction, passing_score, duration_minutes, total_question, total_score, status, show_answer) 
       VALUES 
       (1, 3, 1, 1, 1, 'Mixed Practice Quiz: All Question Types',
        'A comprehensive practice quiz with 12 questions spanning all 5 question formats — MCQ, Multi-Select, True/False, Fill-in-Blank, and Word Ordering.',
        'Answer all questions. Read each question carefully — the answer format changes based on question type. Passing score is 70%.',
        70, 20, 12, 100, 'PUBLISHED', 1),

       (2, 5, 1, 1, 3, 'TOEFL Mock Final Exam',
        'A rigorous TOEFL-style exam with 10 questions testing grammar structures, vocabulary, and sentence construction across 3 question types.',
        'Read each question carefully. Select or type the most appropriate answer. You have 30 minutes. Manage your time wisely.',
        70, 30, 10, 100, 'PUBLISHED', 1),

       (3, 4, 1, 1, 4, 'Pronunciation AI Challenge',
        'A real-time AI-powered pronunciation assessment. Vosk speech recognition evaluates your phoneme accuracy, word stress, and intonation.',
        'Click the microphone icon and read each sentence aloud clearly and naturally. Speak at a steady, confident pace.',
        70, 10, 5, 100, 'PUBLISHED', 1)`
    );

    // 11. Seed Assessment Sections
    console.log('Seeding assessment_sections...');
    await connection.query(
      `INSERT INTO assessment_sections (id, assessment_id, title, instruction, section_order, duration_minutes, total_question) 
       VALUES 
       (1, 1, 'Mixed Question Types Section',
        'This section contains 5 different question types. Read each question carefully — the interface adapts to each format automatically.',
        1, 20, 12),
       (2, 2, 'TOEFL Grammar & Vocabulary Section',
        'Answer all questions to the best of your ability. Each question tests a different aspect of English grammar or vocabulary.',
        1, 30, 10),
       (3, 3, 'Pronunciation Reading Prompts',
        'Read each sentence or passage aloud. The AI will transcribe and score your speech in real time.',
        1, 10, 5)`
    );

    // 12. Seed Questions — QUIZ (12 questions, 5 types) + EXAM (10 questions, 3 types)
    // question_type_id: 1=MCQ Single, 2=MCQ Multi-Answer, 3=True/False, 4=Fill Blank (Esai), 6=Ordering
    console.log('Seeding questions (QUIZ: 12 mixed, EXAM: 10 questions)...');
    await connection.query(
      `INSERT INTO questions (id, assessment_section_id, question_type_id, question_code, title, question_text, point, status) 
       VALUES 

       -- ===== QUIZ QUESTIONS (section_id = 1) — 12 questions =====

       -- MCQ Single Answer (4 questions)
       (101, 1, 1, 'Q01', 'MCQ 1 — Verb Agreement',
        'She _____ to the library every Wednesday afternoon without fail.',
        8.34, 'ACTIVE'),
       (102, 1, 1, 'Q02', 'MCQ 2 — Past Continuous',
        'They _____ television when the earthquake suddenly hit last night.',
        8.34, 'ACTIVE'),
       (103, 1, 1, 'Q03', 'MCQ 3 — -ing Spelling',
        'Which of the following correctly applies the -ing spelling rule for the verb \"run\"?',
        8.34, 'ACTIVE'),
       (104, 1, 1, 'Q04', 'MCQ 4 — Stative Verb',
        'Choose the grammatically CORRECT sentence.',
        8.34, 'ACTIVE'),

       -- Multi-Answer MCQ (2 questions)
       (105, 1, 2, 'Q05', 'Multi 1 — Time Signals (Present Continuous)',
        'Which of the following are time signals ONLY used with the Present Continuous Tense?',
        8.34, 'ACTIVE'),
       (106, 1, 2, 'Q06', 'Multi 2 — Adverbs of Frequency',
        'Which of the following adverbs of frequency go BEFORE the main verb (not after)?',
        8.32, 'ACTIVE'),

       -- True / False (2 questions)
       (107, 1, 3, 'Q07', 'T/F 1 — Stative Verbs Rule',
        'Stative verbs like \"know\", \"love\", and \"belong\" are NEVER used in the Present Continuous (-ing) form.',
        8.34, 'ACTIVE'),
       (108, 1, 3, 'Q08', 'T/F 2 — Adverb Position',
        'Adverbs of frequency like \"always\" and \"usually\" are placed BEFORE the main verb in a Simple Present sentence.',
        8.34, 'ACTIVE'),

       -- Fill in the Blank (2 questions)
       (109, 1, 4, 'Q09', 'Fill 1 — Present Continuous',
        'Right now, my sister _____ (write) a letter to her best friend in Japan.',
        8.34, 'ACTIVE'),
       (110, 1, 4, 'Q10', 'Fill 2 — Simple Present Conjugation',
        'He _____ (go) to the gym three times a week to stay fit and healthy.',
        8.34, 'ACTIVE'),

       -- Word Ordering (2 questions)
       (111, 1, 6, 'Q11', 'Order 1 — Present Continuous',
        'Rearrange these words into a correct Present Continuous sentence:',
        8.34, 'ACTIVE'),
       (112, 1, 6, 'Q12', 'Order 2 — Simple Present (Question Form)',
        'Rearrange these words into a grammatically correct Simple Present question:',
        8.34, 'ACTIVE'),

       -- ===== EXAM QUESTIONS (section_id = 2) — 10 questions =====

       -- MCQ Single Answer (5 questions)
       (201, 2, 1, 'E01', 'EXAM MCQ 1 — Perfect Tense',
        'By the time the manager arrived at the office, the reports _____ already been sent to HQ.',
        10.00, 'ACTIVE'),
       (202, 2, 1, 'E02', 'EXAM MCQ 2 — Inversion Grammar',
        'Choose the sentence with the CORRECT grammatical structure using inversion:',
        10.00, 'ACTIVE'),
       (203, 2, 1, 'E03', 'EXAM MCQ 3 — Vocabulary Synonym',
        'Which of the following is the closest synonym of the word \"conspicuous\"?',
        10.00, 'ACTIVE'),
       (204, 2, 1, 'E04', 'EXAM MCQ 4 — Subject-Verb Agreement',
        'The committee, together with all senior managers, _____ reviewing the annual budget report.',
        10.00, 'ACTIVE'),
       (205, 2, 1, 'E05', 'EXAM MCQ 5 — Conditional Tense',
        'If she _____ harder during the semester, she would have passed the final examination.',
        10.00, 'ACTIVE'),

       -- Fill in the Blank (2 questions)
       (206, 2, 4, 'E06', 'EXAM Fill 1 — Simple Present (Formal)',
        'The board of directors _____ (meet) every quarter to review strategic performance.',
        10.00, 'ACTIVE'),
       (207, 2, 4, 'E07', 'EXAM Fill 2 — Conditional Form',
        'If I _____ (be) in your position, I would certainly reconsider my decision.',
        10.00, 'ACTIVE'),

       -- True / False (2 questions)
       (208, 2, 3, 'E08', 'EXAM T/F 1 — Formality Register',
        'In formal academic writing, contractions (shortened word forms like dont, cant, wont) are considered acceptable and appropriate for all contexts.',
        10.00, 'ACTIVE'),
       (209, 2, 3, 'E09', 'EXAM T/F 2 — Perfect Tense Usage',
        'The Present Perfect tense (have/has + past participle) is used to describe completed actions that have a connection to the present.',
        10.00, 'ACTIVE'),

       -- Word Ordering (1 question)
       (210, 2, 6, 'E10', 'EXAM Order 1 — Complex Sentence',
        'Rearrange the following words to form a grammatically correct formal sentence:',
        10.00, 'ACTIVE')`
    );

    // 13. Seed Question Options
    console.log('Seeding question_options (QUIZ + EXAM)...');
    await connection.query(
      `INSERT INTO question_options (id, question_id, option_label, option_text, is_correct, score, option_order) 
       VALUES 

       -- Q01 MCQ — goes (Simple Present, 3rd person singular)
       (1,  101, 'A', 'go',         0,  0.00, 1),
       (2,  101, 'B', 'goes',       1,  8.34, 2),
       (3,  101, 'C', 'is going',   0,  0.00, 3),
       (4,  101, 'D', 'gone',       0,  0.00, 4),

       -- Q02 MCQ — were watching (Past Continuous)
       (5,  102, 'A', 'watched',       0,  0.00, 1),
       (6,  102, 'B', 'were watching', 1,  8.34, 2),
       (7,  102, 'C', 'are watching',  0,  0.00, 3),
       (8,  102, 'D', 'have watched',  0,  0.00, 4),

       -- Q03 MCQ — running (double consonant rule)
       (9,  103, 'A', 'runing',   0,  0.00, 1),
       (10, 103, 'B', 'running',  1,  8.34, 2),
       (11, 103, 'C', 'runeing',  0,  0.00, 3),
       (12, 103, 'D', 'ruing',    0,  0.00, 4),

       -- Q04 MCQ — "She knows" correct (stative verb)
       (13, 104, 'A', 'She is knowing the answer very well.',  0,  0.00, 1),
       (14, 104, 'B', 'She knows the answer very well.',       1,  8.34, 2),
       (15, 104, 'C', 'She does knowing the answer.',          0,  0.00, 3),
       (16, 104, 'D', 'She be knowing the answer.',            0,  0.00, 4),

       -- Q05 Multi — Present Continuous time signals (right now, at the moment, look!)
       (17, 105, 'A', 'right now',          1,  2.78, 1),
       (18, 105, 'B', 'every day',          0,  0.00, 2),
       (19, 105, 'C', 'at the moment',      1,  2.78, 3),
       (20, 105, 'D', 'yesterday morning',  0,  0.00, 4),
       (21, 105, 'E', 'Listen!',            1,  2.78, 5),

       -- Q06 Multi — Adverbs before main verb (always, usually, often, rarely, never)
       (22, 106, 'A', 'always',    1,  1.66, 1),
       (23, 106, 'B', 'already',   0,  0.00, 2),
       (24, 106, 'C', 'usually',   1,  1.66, 3),
       (25, 106, 'D', 'yet',       0,  0.00, 4),
       (26, 106, 'E', 'rarely',    1,  1.66, 5),
       (27, 106, 'F', 'never',     1,  1.66, 6),

       -- Q07 True/False — Stative verb rule → TRUE
       (28, 107, 'A', 'True',  1,  8.34, 1),
       (29, 107, 'B', 'False', 0,  0.00, 2),

       -- Q08 True/False — Adverb position → TRUE
       (30, 108, 'A', 'True',  1,  8.34, 1),
       (31, 108, 'B', 'False', 0,  0.00, 2),

       -- Q09 Fill Blank — is writing
       (32, 109, 'ANS', 'is writing', 1,  8.34, 1),

       -- Q10 Fill Blank — goes
       (33, 110, 'ANS', 'goes', 1,  8.34, 1),

       -- Q11 Ordering — she is writing a letter right now
       (34, 111, 'ANS', 'she is writing a letter right now', 1,  8.34, 1),

       -- Q12 Ordering — do you study english every day
       (35, 112, 'ANS', 'do you study english every day', 1,  8.34, 1),

       -- E01 EXAM MCQ — had (Past Perfect: had + been sent)
       (36, 201, 'A', 'has',  0,  0.00, 1),
       (37, 201, 'B', 'have', 0,  0.00, 2),
       (38, 201, 'C', 'had',  1, 10.00, 3),
       (39, 201, 'D', 'were', 0,  0.00, 4),

       -- E02 EXAM MCQ — Rarely has she gone (correct inversion)
       (40, 202, 'A', 'Rarely she has gone to Paris.',   0,  0.00, 1),
       (41, 202, 'B', 'Rarely has she gone to Paris.',   1, 10.00, 2),
       (42, 202, 'C', 'Rarely she went to Paris.',       0,  0.00, 3),
       (43, 202, 'D', 'Rarely does she goes to Paris.',  0,  0.00, 4),

       -- E03 EXAM MCQ — noticeable (synonym of conspicuous)
       (44, 203, 'A', 'hidden',      0,  0.00, 1),
       (45, 203, 'B', 'noticeable',  1, 10.00, 2),
       (46, 203, 'C', 'minor',       0,  0.00, 3),
       (47, 203, 'D', 'quiet',       0,  0.00, 4),

       -- E04 EXAM MCQ — is (subject-verb agreement: singular collective noun)
       (48, 204, 'A', 'is',   1, 10.00, 1),
       (49, 204, 'B', 'are',  0,  0.00, 2),
       (50, 204, 'C', 'were', 0,  0.00, 3),
       (51, 204, 'D', 'has',  0,  0.00, 4),

       -- E05 EXAM MCQ — had studied (3rd conditional: If + Past Perfect)
       (52, 205, 'A', 'studied',      0,  0.00, 1),
       (53, 205, 'B', 'had studied',  1, 10.00, 2),
       (54, 205, 'C', 'would study',  0,  0.00, 3),
       (55, 205, 'D', 'was studying', 0,  0.00, 4),

       -- E06 EXAM Fill Blank — meets
       (56, 206, 'ANS', 'meets', 1, 10.00, 1),

       -- E07 EXAM Fill Blank — were
       (57, 207, 'ANS', 'were', 1, 10.00, 1),

       -- E08 EXAM True/False — contractions in formal writing → FALSE
       (58, 208, 'A', 'True',  0,  0.00, 1),
       (59, 208, 'B', 'False', 1, 10.00, 2),

       -- E09 EXAM True/False — Present Perfect connects past to present → TRUE
       (60, 209, 'A', 'True',  1, 10.00, 1),
       (61, 209, 'B', 'False', 0,  0.00, 2),

       -- E10 EXAM Ordering — scientists have discovered a new species in the ocean
       (62, 210, 'ANS', 'scientists have discovered a new species in the ocean', 1, 10.00, 1)`
    );

    // 14. Seed Speaking Tests & Prompts (5 prompts for rich practice)
    console.log('Seeding speaking_tests...');
    await connection.query(
      `INSERT INTO speaking_tests (id, assessment_id, title, instruction) 
       VALUES (1, 3, 'Pronunciation AI Challenge',
        'Read each sentence or passage aloud. Speak clearly, naturally, and at a steady pace. The AI will evaluate your phoneme accuracy and intonation.')`
    );

    console.log('Seeding speaking_prompts (5 prompts)...');
    await connection.query(
      `INSERT INTO speaking_prompts (id, speaking_test_id, prompt_type, prompt_text, prompt_order) 
       VALUES 
       (1, 1, 'READING',
        'Describe your favorite travel destination and explain why you love visiting it.',
        1),
       (2, 1, 'READING',
        'Explain the advantages and disadvantages of online education compared to traditional classroom learning.',
        2),
       (3, 1, 'READING',
        'Practicing English pronunciation every single day builds confidence and greatly improves your natural speech fluency.',
        3),
       (4, 1, 'READING',
        'Talk about a significant challenge you have overcome in your life and explain what valuable lessons you learned from the experience.',
        4),
       (5, 1, 'READING',
        'The weather is getting colder and the leaves are turning red and orange — autumn has finally arrived in the northern hemisphere.',
        5)`
    );

    // 15. Seed Certificate Templates
    console.log('Seeding certificate_templates...');
    await connection.query(
      `INSERT INTO certificate_templates (id, template_code, template_name, background_image, orientation, paper_size, active) 
       VALUES (1, 'GOLD_LMS', 'Gold Orientation Certificate', 'uploads/templates/gold.png', 'LANDSCAPE', 'A4', 1)`
    );

    // 16. Seed Banners
    console.log('Seeding banners...');
    await connection.query(
      `INSERT INTO banners (id, title, image_path, button_text, button_url, active) 
       VALUES (1, 'Welcome to Global English!', 'uploads/banners/welcome.png', 'Get Started', '/#predictor', 1)`
    );

    // 17. Seed Orders
    console.log('Seeding orders...');
    await connection.query(
      `INSERT INTO orders (id, order_number, user_id, subtotal, discount, tax, grand_total, payment_status, order_status) 
       VALUES 
       (1, 'ORD-20260717-001', 4, 250000.00, 51000.00, 0.00, 199000.00, 'UNPAID', 'PENDING'),
       (2, 'ORD-20260717-002', 5, 250000.00, 51000.00, 0.00, 199000.00, 'PAID', 'SUCCESS')`
    );

    await connection.query(
      `INSERT INTO order_items (id, order_id, course_id, price, discount, total) 
       VALUES 
       (1, 1, 1, 250000.00, 51000.00, 199000.00),
       (2, 2, 1, 250000.00, 51000.00, 199000.00)`
    );

    // 18. Seed Enrollments & Course Progress (Pre-enroll Student Anita [user 5] with 60% progress)
    console.log('Seeding enrollments & progress for Student Anita...');
    await connection.query(
      `INSERT INTO enrollments (id, user_id, course_id, source_id, order_id, enrolled_at, expired_at, access_days, status) 
       VALUES (2, 5, 1, 1, 2, NOW(), DATE_ADD(NOW(), INTERVAL 365 DAY), 365, 'ACTIVE')`
    );

    await connection.query(
      `INSERT INTO course_progress (user_id, course_id, enrollment_id, completed_module, total_module, overall_progress, average_score) 
       VALUES (5, 1, 2, 0, 1, 60.00, 85.00)`
    );

    // Give student Anita Level 2 & 240 XP in user_statistics
    await connection.query(
      `UPDATE user_statistics SET xp = 240, level = 2 WHERE user_id = 5`
    );

    console.log('Database Seeder executed successfully!');
  } catch (error) {
    console.error('Seeder failed with error:', error);
  } finally {
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    connection.release();
    process.exit(0);
  }
}

seed();
