import { customAlphabet } from "nanoid";

// Unambiguous alphabet (no 0/O/1/l/I) for tokens that may be read aloud or typed.
const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
const generate = customAlphabet(alphabet, 22);

export function generateShareToken(): string {
  return generate();
}
