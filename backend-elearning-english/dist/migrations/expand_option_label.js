"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = __importDefault(require("../config/db"));
async function migrate() {
    console.log('--- Migrating question_options.option_label column ---');
    try {
        const [colsBefore] = await db_1.default.query("SHOW FULL COLUMNS FROM question_options LIKE 'option_label'");
        console.log('Before migration:', colsBefore[0]?.Type);
        await db_1.default.query('ALTER TABLE question_options MODIFY COLUMN option_label VARCHAR(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL');
        const [colsAfter] = await db_1.default.query("SHOW FULL COLUMNS FROM question_options LIKE 'option_label'");
        console.log('After migration:', colsAfter[0]?.Type);
        console.log('✅ Successfully expanded option_label to VARCHAR(500)!');
    }
    catch (err) {
        console.error('Migration error:', err.message);
    }
    finally {
        process.exit(0);
    }
}
migrate();
