const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export const generateLetterOnlyPassword = (length = 12) => {
  const size = Math.max(8, length);
  let password = "";

  for (let index = 0; index < size; index += 1) {
    const randomIndex = Math.floor(Math.random() * LETTERS.length);
    password += LETTERS[randomIndex];
  }

  return password;
};

export const normalizePasswordResetIdentifier = (value: string) =>
  value.trim().replace(/\s+/g, " ");

export const normalizePhoneInput = (value: string) => value.replace(/\D/g, "");

export const inferPasswordResetIdentifierType = (value: string) =>
  value.includes("@") ? "email" : "phone";