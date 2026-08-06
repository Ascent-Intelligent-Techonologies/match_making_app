import "server-only";
import bcrypt from "bcryptjs";

/**
 * Verifies a candidate password against ADMIN_PASSWORD_HASH (a bcrypt hash
 * set in the environment). Generate a hash with:
 *   node -e "console.log(require('bcryptjs').hashSync('your-password', 12))"
 */
export async function verifyAdminPassword(candidate: string): Promise<boolean> {
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash) {
    throw new Error("ADMIN_PASSWORD_HASH environment variable is not set.");
  }
  if (!candidate) return false;
  return bcrypt.compare(candidate, hash);
}
