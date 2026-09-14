"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = __importDefault(require("../config/db"));
async function revertEnum() {
    const conn = await db_1.default.getConnection();
    try {
        console.log('Reverting lesson_type ENUM to 5 core types...');
        await conn.query(`
      ALTER TABLE lessons 
      MODIFY COLUMN lesson_type ENUM('VIDEO', 'READING', 'QUIZ', 'SPEAKING', 'EXAM') NOT NULL DEFAULT 'VIDEO'
    `);
        console.log('SUCCESS: lesson_type ENUM reverted to VIDEO, READING, QUIZ, SPEAKING, EXAM');
    }
    catch (e) {
        console.error('FAILED:', e.message);
    }
    finally {
        conn.release();
        process.exit(0);
    }
}
revertEnum();
