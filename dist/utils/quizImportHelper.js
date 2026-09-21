"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.QUESTION_TYPE_MAP = void 0;
exports.normalizeKey = normalizeKey;
exports.getQuestionTypeIdFromSheetName = getQuestionTypeIdFromSheetName;
exports.parseQuizRows = parseQuizRows;
exports.parseQuizWorkbook = parseQuizWorkbook;
exports.createExcelTemplateBuffer = createExcelTemplateBuffer;
exports.createCsvTemplateString = createCsvTemplateString;
const XLSX = __importStar(require("xlsx"));
exports.QUESTION_TYPE_MAP = {
    // Multiple Choice (Single answer)
    '1': { id: 1, name: 'MULTIPLE_CHOICE' },
    'mcq': { id: 1, name: 'MULTIPLE_CHOICE' },
    'multiple_choice': { id: 1, name: 'MULTIPLE_CHOICE' },
    'pilihan_ganda': { id: 1, name: 'MULTIPLE_CHOICE' },
    'pilihan ganda': { id: 1, name: 'MULTIPLE_CHOICE' },
    // Multiple Select (Multiple answers)
    '2': { id: 2, name: 'MULTIPLE_SELECT' },
    'multi': { id: 2, name: 'MULTIPLE_SELECT' },
    'multiple_select': { id: 2, name: 'MULTIPLE_SELECT' },
    'multi_jawaban': { id: 2, name: 'MULTIPLE_SELECT' },
    'multi jawaban': { id: 2, name: 'MULTIPLE_SELECT' },
    'checkbox': { id: 2, name: 'MULTIPLE_SELECT' },
    // True & False
    '3': { id: 3, name: 'TRUE_FALSE' },
    'tf': { id: 3, name: 'TRUE_FALSE' },
    'true_false': { id: 3, name: 'TRUE_FALSE' },
    'true/false': { id: 3, name: 'TRUE_FALSE' },
    'true & false': { id: 3, name: 'TRUE_FALSE' },
    'benar_salah': { id: 3, name: 'TRUE_FALSE' },
    'benar / salah': { id: 3, name: 'TRUE_FALSE' },
    'benar salah': { id: 3, name: 'TRUE_FALSE' },
    // Fill in the Blank
    '4': { id: 4, name: 'FILL_BLANK' },
    'blank': { id: 4, name: 'FILL_BLANK' },
    'fill_blank': { id: 4, name: 'FILL_BLANK' },
    'fill_in_the_blank': { id: 4, name: 'FILL_BLANK' },
    'isian': { id: 4, name: 'FILL_BLANK' },
    'isian_singkat': { id: 4, name: 'FILL_BLANK' },
    'esai': { id: 4, name: 'FILL_BLANK' },
    // Matching Pairs
    '5': { id: 5, name: 'MATCHING' },
    'matching': { id: 5, name: 'MATCHING' },
    'matching_pairs': { id: 5, name: 'MATCHING' },
    'menjodohkan': { id: 5, name: 'MATCHING' },
    'pasangan': { id: 5, name: 'MATCHING' },
    'pairs': { id: 5, name: 'MATCHING' },
    // Word Ordering
    '6': { id: 6, name: 'WORD_ORDERING' },
    'ordering': { id: 6, name: 'WORD_ORDERING' },
    'word_ordering': { id: 6, name: 'WORD_ORDERING' },
    'susun_kata': { id: 6, name: 'WORD_ORDERING' },
    'susun kata': { id: 6, name: 'WORD_ORDERING' },
};
function normalizeKey(key) {
    return String(key || '')
        .trim()
        .toLowerCase()
        .replace(/[\s\-_]+/g, '_');
}
/**
 * Detects question type ID from sheet name
 * Returns -1 if it's a guide/instruction sheet to ignore
 */
function getQuestionTypeIdFromSheetName(sheetName) {
    const s = sheetName.toLowerCase().trim();
    if (s.includes('petunjuk') ||
        s.includes('panduan') ||
        s.includes('guide') ||
        s.includes('instruction') ||
        s.includes('info') ||
        s.includes('format') ||
        s.includes('baca_saya') ||
        s.includes('readme')) {
        return -1;
    }
    if (s.includes('multiple choice') || s.includes('pilihan ganda') || s.includes('mcq') || s.startsWith('1'))
        return 1;
    if (s.includes('multiple select') || s.includes('multi jawaban') || s.includes('checkbox') || s.startsWith('2'))
        return 2;
    if (s.includes('true') || s.includes('false') || s.includes('benar') || s.includes('salah') || s.includes('tf') || s.startsWith('3'))
        return 3;
    if (s.includes('blank') || s.includes('isian') || s.includes('esai') || s.startsWith('4'))
        return 4;
    if (s.includes('match') || s.includes('jodoh') || s.includes('pasang') || s.startsWith('5'))
        return 5;
    if (s.includes('order') || s.includes('susun') || s.includes('kata') || s.startsWith('6'))
        return 6;
    return null;
}
/**
 * Parses raw JSON rows extracted from a sheet
 */
function parseQuizRows(rawRows, defaultTypeId, sourceSheet) {
    const results = [];
    rawRows.forEach((rawRow, idx) => {
        // Standardize object keys
        const row = {};
        for (const [k, v] of Object.entries(rawRow)) {
            row[normalizeKey(k)] = typeof v === 'string' ? v.trim() : v;
        }
        // Determine question type from row or fallback to defaultTypeId or 1
        let questionTypeId = defaultTypeId || 1;
        let typeName = 'MULTIPLE_CHOICE';
        const rawType = String(row.question_type ||
            row.tipe_soal ||
            row.type ||
            row.tipe ||
            row.jenis ||
            '').trim().toLowerCase();
        if (rawType && exports.QUESTION_TYPE_MAP[rawType]) {
            questionTypeId = exports.QUESTION_TYPE_MAP[rawType].id;
            typeName = exports.QUESTION_TYPE_MAP[rawType].name;
        }
        else if (defaultTypeId) {
            const foundEntry = Object.values(exports.QUESTION_TYPE_MAP).find(t => t.id === defaultTypeId);
            if (foundEntry) {
                questionTypeId = foundEntry.id;
                typeName = foundEntry.name;
            }
        }
        // Determine question text
        const questionText = String(row.question_text ||
            row.pertanyaan ||
            row.soal ||
            row.text ||
            row.isi_soal ||
            row.instruksi ||
            '').trim();
        const originalRowIndex = idx + 2;
        if (!questionText) {
            return; // Skip empty rows
        }
        // Determine code, point, explanation
        const questionCode = String(row.question_code || row.kode_soal || row.kode || `Q-${idx + 1}`).trim();
        const point = parseFloat(row.point || row.bobot || row.nilai || row.skor || '10') || 10;
        const explanation = String(row.explanation || row.pembahasan || row.penjelasan || '').trim();
        // Determine correct answer string
        const rawCorrect = String(row.correct_answer ||
            row.kunci_jawaban ||
            row.kunci ||
            row.jawaban_benar ||
            row.kalimat_benar ||
            row.kalimat_kunci ||
            row.answer ||
            '').trim();
        const options = [];
        let validationError = undefined;
        // 1 & 2: Multiple Choice / Multiple Select
        if (questionTypeId === 1 || questionTypeId === 2) {
            const letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
            const correctTokens = rawCorrect
                .split(/[,;|]+/)
                .map((t) => t.trim().toUpperCase());
            letters.forEach((letter, lIdx) => {
                const optVal = row[`option_${letter}`] ||
                    row[`pilihan_${letter}`] ||
                    row[`opsi_${letter}`] ||
                    row[letter];
                if (optVal !== undefined && String(optVal).trim() !== '') {
                    const optStr = String(optVal).trim();
                    const label = letter.toUpperCase();
                    const isCorrect = correctTokens.includes(label) ||
                        correctTokens.includes(optStr.toUpperCase()) ||
                        rawCorrect.toUpperCase() === label ||
                        rawCorrect.toUpperCase() === optStr.toUpperCase();
                    options.push({
                        optionLabel: label,
                        optionText: optStr,
                        isCorrect: !!isCorrect,
                        score: isCorrect ? point : 0,
                        optionOrder: lIdx + 1
                    });
                }
            });
            if (options.length < 2) {
                validationError = 'Minimal harus memiliki 2 pilihan jawaban (pilihan_a, pilihan_b)';
            }
            else if (!options.some(o => o.isCorrect)) {
                validationError = `Kunci jawaban "${rawCorrect}" tidak cocok dengan opsi yang ada`;
            }
        }
        // 3: True & False
        else if (questionTypeId === 3) {
            const optA = row.option_a || row.pilihan_a || 'True (Benar)';
            const optB = row.option_b || row.pilihan_b || 'False (Salah)';
            const isTrueCorrect = rawCorrect.toLowerCase().includes('true') ||
                rawCorrect.toLowerCase().includes('benar') ||
                rawCorrect.toUpperCase() === 'A' ||
                rawCorrect === '1';
            options.push({
                optionLabel: 'A',
                optionText: String(optA),
                isCorrect: isTrueCorrect,
                score: isTrueCorrect ? point : 0,
                optionOrder: 1
            });
            options.push({
                optionLabel: 'B',
                optionText: String(optB),
                isCorrect: !isTrueCorrect,
                score: !isTrueCorrect ? point : 0,
                optionOrder: 2
            });
            if (!rawCorrect) {
                validationError = 'Kunci jawaban True / False belum diisi';
            }
        }
        // 4: Fill in the Blank
        else if (questionTypeId === 4) {
            const acceptedAnswers = rawCorrect
                ? rawCorrect.split(/[,;|]+/).map((a) => a.trim()).filter(Boolean)
                : [String(row.option_a || row.pilihan_a || row.jawaban || '').trim()].filter(Boolean);
            acceptedAnswers.forEach((ans, aIdx) => {
                options.push({
                    optionLabel: String.fromCharCode(65 + aIdx),
                    optionText: ans,
                    isCorrect: true,
                    score: point,
                    optionOrder: aIdx + 1
                });
            });
            if (options.length === 0) {
                validationError = 'Kunci jawaban isian singkat belum diisi';
            }
        }
        // 5: Matching Pairs (Menjodohkan)
        else if (questionTypeId === 5) {
            // Format 1: Columns premis_1 & jawaban_1, premis_2 & jawaban_2, dst.
            for (let pIdx = 1; pIdx <= 10; pIdx++) {
                const leftVal = row[`premis_${pIdx}`] || row[`soal_${pIdx}`] || row[`kiri_${pIdx}`];
                const rightVal = row[`jawaban_${pIdx}`] || row[`pasangan_${pIdx}`] || row[`kanan_${pIdx}`];
                if (leftVal && rightVal && !String(rightVal).includes(':')) {
                    options.push({
                        optionLabel: String(leftVal).trim(),
                        optionText: String(rightVal).trim(),
                        isCorrect: true,
                        score: 0,
                        optionOrder: options.length + 1
                    });
                }
            }
            // Format 2: Pasangan string: "Cat:Kucing | Dog:Anjing | Bird:Burung"
            if (options.length === 0) {
                const pairsRaw = row.pairs || row.pasangan || row.jodohkan || (rawCorrect.includes(':') || rawCorrect.includes('=') ? rawCorrect : null);
                if (pairsRaw) {
                    const pairItems = String(pairsRaw).split(/[|;\n]+/).map(p => p.trim()).filter(Boolean);
                    pairItems.forEach((pairStr, pIdx) => {
                        const parts = pairStr.includes(':') ? pairStr.split(':') : pairStr.split('=');
                        const left = (parts[0] || `Premis ${pIdx + 1}`).trim();
                        const right = (parts[1] || '').trim();
                        if (left && right) {
                            options.push({
                                optionLabel: left,
                                optionText: right,
                                isCorrect: true,
                                score: 0,
                                optionOrder: pIdx + 1
                            });
                        }
                    });
                }
            }
            // Format 3: pilihan_a (kiri 1), pilihan_b (kanan 1), pilihan_c (kiri 2), pilihan_d (kanan 2)...
            if (options.length === 0) {
                const pairPairs = [
                    ['a', 'b'],
                    ['c', 'd'],
                    ['e', 'f'],
                    ['g', 'h']
                ];
                pairPairs.forEach(([leftKey, rightKey], pIdx) => {
                    const leftVal = row[`option_${leftKey}`] || row[`pilihan_${leftKey}`] || row[`left_${pIdx + 1}`];
                    const rightVal = row[`option_${rightKey}`] || row[`pilihan_${rightKey}`] || row[`right_${pIdx + 1}`];
                    if (leftVal && rightVal) {
                        options.push({
                            optionLabel: String(leftVal).trim(),
                            optionText: String(rightVal).trim(),
                            isCorrect: true,
                            score: 0,
                            optionOrder: options.length + 1
                        });
                    }
                });
            }
            if (options.length < 2) {
                validationError = 'Soal menjodohkan minimal membutuhkan 2 pasang (isi kolom premis_1 & jawaban_1, premis_2 & jawaban_2)';
            }
        }
        // 6: Word Ordering (Menyusun Kata)
        else if (questionTypeId === 6) {
            const fullSentence = rawCorrect || row.kalimat_benar || row.kalimat_kunci || row.kalimat_urut || row.option_a || row.pilihan_a || '';
            const words = [];
            // Look for kata_1, kata_2, kata_3...
            for (let w = 1; w <= 12; w++) {
                const val = row[`kata_${w}`] || row[`word_${w}`] || row[`potongan_${w}`];
                if (val)
                    words.push(String(val).trim());
            }
            // Look for option_a ... option_h if kata_1 not provided
            if (words.length === 0) {
                ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].forEach((letter) => {
                    const val = row[`option_${letter}`] || row[`pilihan_${letter}`];
                    if (val)
                        words.push(String(val).trim());
                });
            }
            // If word list is empty, split fullSentence
            if (words.length === 0 && fullSentence) {
                fullSentence.split(/\s+/).forEach((w) => {
                    if (w.trim())
                        words.push(w.trim());
                });
            }
            if (!fullSentence || words.length < 2) {
                validationError = 'Kalimat urut lengkap atau potongan kata belum lengkap (minimal 2 kata)';
            }
            options.push({
                optionLabel: 'CORRECT_ORDER',
                optionText: String(fullSentence).trim(),
                isCorrect: true,
                score: point,
                optionOrder: 1
            });
            words.forEach((word, wIdx) => {
                options.push({
                    optionLabel: String.fromCharCode(65 + wIdx),
                    optionText: word,
                    isCorrect: true,
                    score: 0,
                    optionOrder: wIdx + 2
                });
            });
        }
        results.push({
            questionTypeId,
            questionTypeName: typeName,
            questionCode,
            questionText,
            explanation,
            point,
            options,
            originalRowIndex,
            sourceSheet: sourceSheet || undefined,
            validationError
        });
    });
    return results;
}
/**
 * Parses an entire Excel workbook across all its sheets
 */
function parseQuizWorkbook(wb) {
    const allQuestions = [];
    for (const sheetName of wb.SheetNames) {
        const typeId = getQuestionTypeIdFromSheetName(sheetName);
        // If it's a guide/instruction sheet, skip it
        if (typeId === -1) {
            continue;
        }
        const ws = wb.Sheets[sheetName];
        if (!ws)
            continue;
        const rawRows = XLSX.utils.sheet_to_json(ws);
        if (Array.isArray(rawRows) && rawRows.length > 0) {
            const parsed = parseQuizRows(rawRows, typeId ?? undefined, sheetName);
            allQuestions.push(...parsed);
        }
    }
    // If no questions were found across sheets (e.g. non-standard sheet names), fallback to reading all non-empty sheets
    if (allQuestions.length === 0 && wb.SheetNames.length > 0) {
        for (const sheetName of wb.SheetNames) {
            const ws = wb.Sheets[sheetName];
            if (!ws)
                continue;
            const rawRows = XLSX.utils.sheet_to_json(ws);
            if (Array.isArray(rawRows) && rawRows.length > 0) {
                const parsed = parseQuizRows(rawRows, undefined, sheetName);
                allQuestions.push(...parsed);
            }
        }
    }
    return allQuestions;
}
/**
 * Creates a beautiful multi-sheet Excel (.xlsx) workbook buffer where:
 * Sheet 1 = Petunjuk & Panduan
 * Sheet 2 = 1. Pilihan Ganda (MCQ)
 * Sheet 3 = 2. Multi Jawaban
 * Sheet 4 = 3. Benar atau Salah
 * Sheet 5 = 4. Isian Singkat
 * Sheet 6 = 5. Menjodohkan (Matching)
 * Sheet 7 = 6. Menyusun Kata
 */
function createExcelTemplateBuffer(filterType) {
    const wb = XLSX.utils.book_new();
    // ── SHEET 1: PETUNJUK & PANDUAN ──────────────────────────────────────────
    const petunjukRows = [
        {
            'Nama Lembar (Sheet)': '1. Pilihan Ganda (MCQ)',
            'Tipe Soal': 'MULTIPLE_CHOICE',
            'Format Kunci Jawaban': 'Huruf opsi: A, B, C, D, atau E',
            'Aturan Penting': 'Isi pertanyaan, bobot skor, opsi pilihan_a s/d pilihan_d (atau e), dan kunci jawaban.',
        },
        {
            'Nama Lembar (Sheet)': '2. Multi Jawaban',
            'Tipe Soal': 'MULTIPLE_SELECT',
            'Format Kunci Jawaban': 'Beberapa huruf dipisah koma (contoh: A, C)',
            'Aturan Penting': 'Siswa bisa memilih lebih dari satu jawaban benar. Skor diberikan jika memilih jawaban benar.',
        },
        {
            'Nama Lembar (Sheet)': '3. Benar atau Salah',
            'Tipe Soal': 'TRUE_FALSE',
            'Format Kunci Jawaban': 'Tulis "True" atau "False" (atau Benar / Salah)',
            'Aturan Penting': 'Pilihan A otomatis Benar (True), Pilihan B otomatis Salah (False).',
        },
        {
            'Nama Lembar (Sheet)': '4. Isian Singkat',
            'Tipe Soal': 'FILL_BLANK',
            'Format Kunci Jawaban': 'Tulis kata / frasa jawaban yang diharapkan',
            'Aturan Penting': 'Jika ada beberapa alternatif jawaban yang diterima, pisahkan dengan tanda koma atau titik koma (;).',
        },
        {
            'Nama Lembar (Sheet)': '5. Menjodohkan (Matching)',
            'Tipe Soal': 'MATCHING',
            'Format Kunci Jawaban': 'Kolom premis_1 sejajar jawaban_1, premis_2 sejajar jawaban_2, dst.',
            'Aturan Penting': 'Sisi kiri adalah soal/premis, sisi kanan adalah pasangannya. Sisi kanan akan otomatis diacak saat ujian.',
        },
        {
            'Nama Lembar (Sheet)': '6. Menyusun Kata',
            'Tipe Soal': 'WORD_ORDERING',
            'Format Kunci Jawaban': 'Kolom kalimat_benar diisi kalimat urut utuh',
            'Aturan Penting': 'Potongan kata diisi pada kata_1, kata_2, kata_3, dst. Siswa menyusun potongan kata tersebut.',
        },
    ];
    const wsPetunjuk = XLSX.utils.json_to_sheet(petunjukRows);
    wsPetunjuk['!cols'] = [
        { wch: 25 }, // Nama Lembar
        { wch: 20 }, // Tipe Soal
        { wch: 38 }, // Format Kunci Jawaban
        { wch: 65 }, // Aturan Penting
    ];
    XLSX.utils.book_append_sheet(wb, wsPetunjuk, 'Petunjuk & Panduan');
    // Helper to append a question sheet
    const addMcqSheet = () => {
        const rows = [
            {
                'kode_soal': 'MCQ-01',
                'pertanyaan': 'What is the simple past tense of the verb "eat"?',
                'bobot': 10,
                'pilihan_a': 'Ate',
                'pilihan_b': 'Eaten',
                'pilihan_c': 'Eating',
                'pilihan_d': 'Eats',
                'pilihan_e': '',
                'kunci_jawaban': 'A',
                'pembahasan': '"Ate" adalah bentuk past tense (V2) dari kata kerja "eat".',
            },
            {
                'kode_soal': 'MCQ-02',
                'pertanyaan': 'Choose the sentence that uses the Present Continuous tense correctly:',
                'bobot': 10,
                'pilihan_a': 'She is reading a novel in the library right now.',
                'pilihan_b': 'She reads a novel in the library right now.',
                'pilihan_c': 'She readed a novel in the library right now.',
                'pilihan_d': 'She has read a novel in the library right now.',
                'pilihan_e': '',
                'kunci_jawaban': 'A',
                'pembahasan': 'Present Continuous Tense menggunakan rumus Subject + to be (am/is/are) + Verb-ing.',
            },
        ];
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [{ wch: 12 }, { wch: 50 }, { wch: 8 }, { wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 45 }];
        XLSX.utils.book_append_sheet(wb, ws, '1. Pilihan Ganda (MCQ)');
    };
    const addMultiSheet = () => {
        const rows = [
            {
                'kode_soal': 'MULTI-01',
                'pertanyaan': 'Which of the following are modal auxiliary verbs in English? (Pilih 2 jawaban)',
                'bobot': 15,
                'pilihan_a': 'Should',
                'pilihan_b': 'Happily',
                'pilihan_c': 'Must',
                'pilihan_d': 'House',
                'pilihan_e': '',
                'kunci_jawaban': 'A, C',
                'pembahasan': 'Should dan Must adalah modal auxiliary verbs.',
            },
            {
                'kode_soal': 'MULTI-02',
                'pertanyaan': 'Which of the following words are time signals for the Present Continuous Tense? (Pilih 2 jawaban)',
                'bobot': 15,
                'pilihan_a': 'Right now',
                'pilihan_b': 'At the moment',
                'pilihan_c': 'Yesterday',
                'pilihan_d': 'Two weeks ago',
                'pilihan_e': '',
                'kunci_jawaban': 'A, B',
                'pembahasan': '"Right now" dan "At the moment" adalah time signals penanda aksi yang sedang berlangsung.',
            },
        ];
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [{ wch: 12 }, { wch: 55 }, { wch: 8 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 20 }, { wch: 18 }, { wch: 45 }];
        XLSX.utils.book_append_sheet(wb, ws, '2. Multi Jawaban');
    };
    const addTfSheet = () => {
        const rows = [
            {
                'kode_soal': 'TF-01',
                'pertanyaan': 'The word "delicious" is an adjective describing taste.',
                'bobot': 10,
                'pilihan_a': 'True (Benar)',
                'pilihan_b': 'False (Salah)',
                'kunci_jawaban': 'True',
                'pembahasan': '"Delicious" (lezat) adalah kata sifat (adjective).',
            },
            {
                'kode_soal': 'TF-02',
                'pertanyaan': 'In English grammar, stative verbs like "know" and "belong" are frequently used in continuous (-ing) tenses.',
                'bobot': 10,
                'pilihan_a': 'True (Benar)',
                'pilihan_b': 'False (Salah)',
                'kunci_jawaban': 'False',
                'pembahasan': 'Stative verbs umumnya tidak digunakan dalam continuous tense.',
            },
        ];
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [{ wch: 12 }, { wch: 60 }, { wch: 8 }, { wch: 20 }, { wch: 20 }, { wch: 18 }, { wch: 45 }];
        XLSX.utils.book_append_sheet(wb, ws, '3. Benar atau Salah');
    };
    const addBlankSheet = () => {
        const rows = [
            {
                'kode_soal': 'BLANK-01',
                'pertanyaan': 'She usually _____ (drink) coffee before starting her workday.',
                'bobot': 15,
                'kunci_jawaban': 'drinks',
                'pembahasan': 'Subjek "She" menggunakan kata kerja dengan akhiran -s (drinks) pada Simple Present Tense.',
            },
            {
                'kode_soal': 'BLANK-02',
                'pertanyaan': 'Yesterday afternoon, they _____ (watch) a great movie together at the cinema.',
                'bobot': 15,
                'kunci_jawaban': 'watched',
                'pembahasan': 'Keterangan waktu "Yesterday" menandakan Simple Past Tense sehingga kata kerja berubah menjadi V2 (watched).',
            },
        ];
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [{ wch: 12 }, { wch: 60 }, { wch: 8 }, { wch: 25 }, { wch: 50 }];
        XLSX.utils.book_append_sheet(wb, ws, '4. Isian Singkat');
    };
    const addMatchingSheet = () => {
        const rows = [
            {
                'kode_soal': 'MATCH-01',
                'pertanyaan': 'Jodohkan kata sapaan bahasa Inggris berikut dengan arti bahasa Indonesianya:',
                'bobot': 20,
                'premis_1': 'Good morning',
                'jawaban_1': 'Selamat pagi',
                'premis_2': 'Good night',
                'jawaban_2': 'Selamat tidur / malam',
                'premis_3': 'See you later',
                'jawaban_3': 'Sampai jumpa lagi',
                'premis_4': 'Have a nice day',
                'jawaban_4': 'Semoga harimu menyenangkan',
                'premis_5': '',
                'jawaban_5': '',
                'pembahasan': 'Premis di kolom kiri berpasangan langsung dengan jawaban di kolom kanan.',
            },
            {
                'kode_soal': 'MATCH-02',
                'pertanyaan': 'Jodohkan kata benda (Noun) berikut dengan kata sifat (Adjective) pasangannya:',
                'bobot': 20,
                'premis_1': 'Sun',
                'jawaban_1': 'Sunny',
                'premis_2': 'Rain',
                'jawaban_2': 'Rainy',
                'premis_3': 'Wind',
                'jawaban_3': 'Windy',
                'premis_4': 'Cloud',
                'jawaban_4': 'Cloudy',
                'premis_5': '',
                'jawaban_5': '',
                'pembahasan': 'Perubahan Noun cuaca menjadi Adjective dengan penambahan akhiran -y.',
            },
        ];
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [
            { wch: 12 }, // kode_soal
            { wch: 50 }, // pertanyaan
            { wch: 8 }, // bobot
            { wch: 18 }, { wch: 24 }, // 1
            { wch: 18 }, { wch: 24 }, // 2
            { wch: 18 }, { wch: 24 }, // 3
            { wch: 18 }, { wch: 24 }, // 4
            { wch: 18 }, { wch: 24 }, // 5
            { wch: 45 }, // pembahasan
        ];
        XLSX.utils.book_append_sheet(wb, ws, '5. Menjodohkan (Matching)');
    };
    const addOrderingSheet = () => {
        const rows = [
            {
                'kode_soal': 'ORDER-01',
                'pertanyaan': 'Susun potongan kata berikut menjadi kalimat bahasa Inggris yang benar:',
                'bobot': 15,
                'kalimat_benar': 'He practices English every day',
                'kata_1': 'every day',
                'kata_2': 'English',
                'kata_3': 'practices',
                'kata_4': 'He',
                'kata_5': '',
                'kata_6': '',
                'pembahasan': 'Struktur kalimat S + V + O + Adverb: He (S) + practices (V) + English (O) + every day (Adverb).',
            },
            {
                'kode_soal': 'ORDER-02',
                'pertanyaan': 'Susun kata acak berikut menjadi pertanyaan Present Continuous yang tepat:',
                'bobot': 15,
                'kalimat_benar': 'Are you studying for the exam right now',
                'kata_1': 'right now',
                'kata_2': 'the exam',
                'kata_3': 'studying',
                'kata_4': 'for',
                'kata_5': 'Are',
                'kata_6': 'you',
                'pembahasan': 'Kalimat tanya Present Continuous: To Be (Are) + Subject (you) + Verb-ing (studying) + Object/Adverb.',
            },
        ];
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [
            { wch: 12 }, // kode_soal
            { wch: 50 }, // pertanyaan
            { wch: 8 }, // bobot
            { wch: 42 }, // kalimat_benar
            { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, // kata 1-6
            { wch: 45 }, // pembahasan
        ];
        XLSX.utils.book_append_sheet(wb, ws, '6. Menyusun Kata');
    };
    // Determine which sheets to add
    if (!filterType || filterType === 'ALL') {
        addMcqSheet();
        addMultiSheet();
        addTfSheet();
        addBlankSheet();
        addMatchingSheet();
        addOrderingSheet();
    }
    else if (filterType === 'MULTIPLE_CHOICE') {
        addMcqSheet();
    }
    else if (filterType === 'MULTIPLE_SELECT') {
        addMultiSheet();
    }
    else if (filterType === 'TRUE_FALSE') {
        addTfSheet();
    }
    else if (filterType === 'FILL_BLANK') {
        addBlankSheet();
    }
    else if (filterType === 'MATCHING') {
        addMatchingSheet();
    }
    else if (filterType === 'WORD_ORDERING') {
        addOrderingSheet();
    }
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
/**
 * Creates CSV template string
 */
function createCsvTemplateString(filterType) {
    const rows = [
        {
            'tipe_soal': 'MULTIPLE_CHOICE',
            'kode_soal': 'MCQ-01',
            'pertanyaan': 'What is the simple past tense of "eat"?',
            'bobot': 10,
            'pilihan_a': 'Ate',
            'pilihan_b': 'Eaten',
            'pilihan_c': 'Eating',
            'pilihan_d': 'Eats',
            'pilihan_e': '',
            'kunci_jawaban': 'A',
            'pembahasan': '"Ate" adalah bentuk V2 dari "eat".',
        },
        {
            'tipe_soal': 'MULTIPLE_SELECT',
            'kode_soal': 'MULTI-01',
            'pertanyaan': 'Which of the following are modal auxiliary verbs? (Pilih 2 jawaban)',
            'bobot': 15,
            'pilihan_a': 'Should',
            'pilihan_b': 'Happily',
            'pilihan_c': 'Must',
            'pilihan_d': 'House',
            'pilihan_e': '',
            'kunci_jawaban': 'A, C',
            'pembahasan': 'Should dan Must adalah modal verbs.',
        },
        {
            'tipe_soal': 'TRUE_FALSE',
            'kode_soal': 'TF-01',
            'pertanyaan': 'The word "delicious" is an adjective describing taste.',
            'bobot': 10,
            'pilihan_a': 'True (Benar)',
            'pilihan_b': 'False (Salah)',
            'pilihan_c': '',
            'pilihan_d': '',
            'pilihan_e': '',
            'kunci_jawaban': 'True',
            'pembahasan': '"Delicious" (lezat) adalah kata sifat.',
        },
        {
            'tipe_soal': 'FILL_BLANK',
            'kode_soal': 'BLANK-01',
            'pertanyaan': 'She usually _____ (drink) coffee before starting her workday.',
            'bobot': 15,
            'pilihan_a': '',
            'pilihan_b': '',
            'pilihan_c': '',
            'pilihan_d': '',
            'pilihan_e': '',
            'kunci_jawaban': 'drinks',
            'pembahasan': 'Subjek "She" menggunakan akhiran -s (drinks).',
        },
        {
            'tipe_soal': 'MATCHING',
            'kode_soal': 'MATCH-01',
            'pertanyaan': 'Jodohkan kata sapaan bahasa Inggris berikut dengan artinya:',
            'bobot': 20,
            'pilihan_a': 'Good morning',
            'pilihan_b': 'Selamat pagi',
            'pilihan_c': 'Good night',
            'pilihan_d': 'Selamat tidur / malam',
            'pilihan_e': 'See you later',
            'pilihan_f': 'Sampai jumpa lagi',
            'kunci_jawaban': 'Good morning:Selamat pagi | Good night:Selamat tidur / malam | See you later:Sampai jumpa lagi',
            'pembahasan': 'Pilihan kiri berpasangan langsung dengan pilihan kanan.',
        },
        {
            'tipe_soal': 'WORD_ORDERING',
            'kode_soal': 'ORDER-01',
            'pertanyaan': 'Susun potongan kata berikut menjadi kalimat yang benar:',
            'bobot': 15,
            'pilihan_a': 'every day',
            'pilihan_b': 'English',
            'pilihan_c': 'practices',
            'pilihan_d': 'He',
            'pilihan_e': '',
            'kunci_jawaban': 'He practices English every day',
            'pembahasan': 'Struktur kalimat S + V + O + Adverb.',
        },
    ];
    let filtered = rows;
    if (filterType && filterType !== 'ALL') {
        filtered = rows.filter(r => r.tipe_soal === filterType);
    }
    const ws = XLSX.utils.json_to_sheet(filtered);
    return XLSX.utils.sheet_to_csv(ws);
}
