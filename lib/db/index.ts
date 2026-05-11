import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

// Wir nutzen ! hier, da wir sicherstellen, dass die Variable in der lokalen Umgebung oder bei Vercel gesetzt ist
const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle({ client: sql });
