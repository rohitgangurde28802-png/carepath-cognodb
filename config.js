import { loadEnvFile } from 'node:process';

try { loadEnvFile(); } catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

export function getConfig(env = process.env) {
  return {
    port: Number(env.PORT || 3000),
    database: {
      uri: env.COGNODB_URI,
      username: env.COGNODB_USERNAME || 'cognodb',
      password: env.COGNODB_PASSWORD,
    },
  };
}

export function assertDatabaseConfig(database) {
  const missing = Object.entries(database)
    .filter(([, value]) => !value)
    .map(([key]) => `COGNODB_${key.toUpperCase()}`);
  if (missing.length) throw new Error(`Missing environment variables: ${missing.join(', ')}`);
}
