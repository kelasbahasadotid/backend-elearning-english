"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = __importDefault(require("../config/db"));
async function migrate() {
    const conn = await db_1.default.getConnection();
    try {
        console.log('Running lesson_type ENUM migration...');
        const [cols] = await conn.query(`
      SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'lessons' 
        AND COLUMN_NAME = 'lesson_type'
    `);
        const colsArr = cols;
        if (colsArr.length > 0) {
            console.log('Current COLUMN_TYPE:', colsArr[0].COLUMN_TYPE);
        }
        await conn.query(`
      ALTER TABLE lessons 
      MODIFY COLUMN lesson_type ENUM('VIDEO','READING','QUIZ','SPEAKING','EXAM','FILL_BLANK','TRUE_FALSE','ORDERING','MULTIPLE_CHOICE') NOT NULL DEFAULT 'VIDEO'
    `);
        console.log('SUCCESS: lesson_type ENUM extended with FILL_BLANK, TRUE_FALSE, ORDERING, MULTIPLE_CHOICE');
    }
    catch (error) {
        const e = error;
        console.error('FAILED:', e.message);
    }
    finally {
        conn.release();
        process.exit(0);
    }
}
migrate();
