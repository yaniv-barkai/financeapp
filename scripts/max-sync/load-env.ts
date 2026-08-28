import { config } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(packageDir, "../..");

config({ path: resolve(projectRoot, ".env.local") });
config({ path: resolve(projectRoot, ".env") });

// Scraper uses pino-pretty in dev mode; it's not a runtime dependency of max-sync.
if (!process.env.CI && process.env.NODE_ENV !== "production") {
  process.env.NODE_ENV = "production";
}

/** Prefer a JSON file over inline FIREBASE_SERVICE_ACCOUNT_KEY (avoids shell quoting issues). */
export function resolveFirebaseServiceAccountKey(): string {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  if (inline) return inline;

  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_FILE?.trim();
  if (filePath) {
    const absolute = resolve(projectRoot, filePath);
    if (!existsSync(absolute)) {
      throw new Error(
        `FIREBASE_SERVICE_ACCOUNT_KEY_FILE not found: ${absolute}\n` +
          "Download the key from Firebase Console → Project settings → Service accounts."
      );
    }
    return readFileSync(absolute, "utf8");
  }

  throw new Error(
    "Set FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_SERVICE_ACCOUNT_KEY_FILE in .env.local"
  );
}
