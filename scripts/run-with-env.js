const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { spawn } = require('child_process');

const [, , envFileArg, ...commandArgs] = process.argv;

if (!envFileArg || commandArgs.length === 0) {
  console.error('Usage: node scripts/run-with-env.js <env-file> <command> [args...]');
  process.exit(1);
}

const envFilePath = path.resolve(process.cwd(), envFileArg);

if (!fs.existsSync(envFilePath)) {
  console.error(`Env file not found: ${envFilePath}`);
  process.exit(1);
}

const parsed = dotenv.parse(fs.readFileSync(envFilePath, 'utf8'));
const command = commandArgs[0];
const args = commandArgs.slice(1);

const child = spawn(command, args, {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    ...parsed,
  },
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
