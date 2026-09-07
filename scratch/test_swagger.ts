import { swaggerDocument } from '../src/docs/swagger';

console.log('OpenAPI Version:', swaggerDocument.openapi);
console.log('Title:', swaggerDocument.info.title);
console.log('Total Paths:', Object.keys(swaggerDocument.paths).length);
console.log('Total Tags:', swaggerDocument.tags.length);
console.log('Paths List:');
Object.keys(swaggerDocument.paths).forEach(p => console.log('  -', p));
