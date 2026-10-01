const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const MEDUSA_SERVER_PATH = path.join(process.cwd(), '.medusa', 'server');

// Check if .medusa/server exists - if not, build process failed
if (!fs.existsSync(MEDUSA_SERVER_PATH)) {
  throw new Error('.medusa/server directory not found. This indicates the Medusa build process failed. Please check for build errors.');
}

// Medusa builds a standalone server into .medusa/server with its own
// package.json, so production dependencies have to be installed there.
//
// This used to copy pnpm-lock.yaml and run pnpm unconditionally, which meant
// the build died on `copyFileSync` for anyone who installed with npm or yarn,
// even though the README documents npm. Pick whichever lockfile is actually
// present instead.
const PACKAGE_MANAGERS = [
  { lockfile: 'pnpm-lock.yaml', name: 'pnpm', install: 'pnpm i --prod --frozen-lockfile' },
  { lockfile: 'package-lock.json', name: 'npm', install: 'npm ci --omit=dev' },
  { lockfile: 'yarn.lock', name: 'yarn', install: 'yarn install --production --frozen-lockfile' },
];

const detected = PACKAGE_MANAGERS.find((pm) =>
  fs.existsSync(path.join(process.cwd(), pm.lockfile))
);

if (!detected) {
  throw new Error(
    `No lockfile found in ${process.cwd()}. Expected one of: ` +
    PACKAGE_MANAGERS.map((pm) => pm.lockfile).join(', ') +
    '. Commit your lockfile so the production install is reproducible.'
  );
}

fs.copyFileSync(
  path.join(process.cwd(), detected.lockfile),
  path.join(MEDUSA_SERVER_PATH, detected.lockfile)
);

// Copy .env if it exists
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  fs.copyFileSync(
    envPath,
    path.join(MEDUSA_SERVER_PATH, '.env')
  );
}

// Install dependencies
console.log(`Installing dependencies in .medusa/server with ${detected.name}...`);
execSync(detected.install, {
  cwd: MEDUSA_SERVER_PATH,
  stdio: 'inherit'
});

// Ensure allowFields middleware exists in framework within .medusa/server
try {
  const frameworkMiddlewaresDir = path.join(
    MEDUSA_SERVER_PATH,
    'node_modules',
    '@medusajs',
    'framework',
    'dist',
    'http',
    'middlewares'
  );
  if (fs.existsSync(frameworkMiddlewaresDir)) {
    const allowFieldsFile = path.join(frameworkMiddlewaresDir, 'allow-fields-middleware.js');
    if (!fs.existsSync(allowFieldsFile)) {
      fs.writeFileSync(
        allowFieldsFile,
        `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.allowFields = void 0;
const allowFields = (...fields) => {
  const fieldsToAllow = fields.flat();
  return (req, _res, next) => {
    req.allowed = req.allowed ?? [];
    req.allowed.push(...fieldsToAllow);
    next();
  };
};
exports.allowFields = allowFields;
`
      );
      const indexPath = path.join(frameworkMiddlewaresDir, 'index.js');
      if (fs.existsSync(indexPath)) {
        let content = fs.readFileSync(indexPath, 'utf8');
        if (!content.includes('allow-fields-middleware')) {
          content += '\n__exportStar(require("./allow-fields-middleware"), exports);\n';
          fs.writeFileSync(indexPath, content);
        }
      }
    }
  }
} catch (e) {
  console.warn('Warning: Could not sync allowFields into .medusa/server:', e.message);
}

