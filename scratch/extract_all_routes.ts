import fs from 'fs';
import path from 'path';

const routesDir = path.join(process.cwd(), 'src', 'routes');
const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.ts'));

console.log(`Found ${routeFiles.length} route files.\n`);

interface RouteEndpoint {
  file: string;
  method: string;
  subPath: string;
  fullPath: string;
  controllerFn: string;
}

const allEndpoints: RouteEndpoint[] = [];

// Mapping of route prefix from src/app.ts
const routePrefixes: Record<string, string> = {
  'authRoutes.ts': '/api/auth',
  'courseRoutes.ts': '/api/courses',
  'paymentRoutes.ts': '/api/payment',
  'studyRoutes.ts': '/api/study',
  'quizRoutes.ts': '/api/quizzes',
  'speakingRoutes.ts': '/api/speaking',
  'certificateRoutes.ts': '/api/certificates',
  'adminRoutes.ts': '/api/admin',
  'tutorRoutes.ts': '/api/tutor',
  'studentRoutes.ts': '/api/students',
  'notificationRoutes.ts': '/api/notifications',
  'taskRoutes.ts': '/api/tasks',
  'discussionRoutes.ts': '/api/discussions',
  'mediaRoutes.ts': '/api/media',
  'h5pRoutes.ts': '/api'
};

const routeRegex = /router\.(get|post|put|delete|patch)\(\s*['"`]([^'"`]+)['"`]\s*,\s*(?:[a-zA-Z0-9_().,\s]+,\s*)*([a-zA-Z0-9_]+)\s*\)/g;

for (const file of routeFiles) {
  const content = fs.readFileSync(path.join(routesDir, file), 'utf8');
  const prefix = routePrefixes[file] || '/api';

  let match;
  while ((match = routeRegex.exec(content)) !== null) {
    const method = match[1].toLowerCase();
    const subPath = match[2];
    const controllerFn = match[3];

    // normalize path
    let fullPath = '';
    if (subPath === '/') {
      fullPath = prefix;
    } else if (subPath.startsWith('/')) {
      fullPath = prefix === '/api' ? `/api${subPath}` : `${prefix}${subPath}`;
    } else {
      fullPath = `${prefix}/${subPath}`;
    }

    // Convert express :param to openapi {param}
    const openApiPath = fullPath.replace(/:([a-zA-Z0-9_]+)/g, '{$1}');

    allEndpoints.push({
      file,
      method,
      subPath,
      fullPath: openApiPath,
      controllerFn
    });
  }
}

// Add health endpoint
allEndpoints.push({
  file: 'app.ts',
  method: 'get',
  subPath: '/health',
  fullPath: '/health',
  controllerFn: 'health'
});

console.log(`Extracted total ${allEndpoints.length} route endpoints from backend.\n`);

import { swaggerDocument } from '../src/docs/swagger';
const documentedPaths = swaggerDocument.paths || {};

const missingInSwagger: RouteEndpoint[] = [];
const documentedCount = Object.keys(documentedPaths).length;

for (const ep of allEndpoints) {
  const pathObj = documentedPaths[ep.fullPath];
  if (!pathObj || !pathObj[ep.method]) {
    missingInSwagger.push(ep);
  }
}

console.log(`Documented paths currently in Swagger: ${documentedCount}`);
console.log(`Missing endpoints to add: ${missingInSwagger.length}\n`);

missingInSwagger.forEach(m => {
  console.log(`- [${m.method.toUpperCase()}] ${m.fullPath} (from ${m.file} -> ${m.controllerFn})`);
});

fs.writeFileSync('scratch/all_extracted_endpoints.json', JSON.stringify({
  total: allEndpoints.length,
  documentedCount,
  missingCount: missingInSwagger.length,
  missing: missingInSwagger,
  all: allEndpoints
}, null, 2));
