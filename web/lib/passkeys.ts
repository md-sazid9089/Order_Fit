import { mutate, type Session } from "./orderfit-api";

type Options = { challenge_id: string; public_key: unknown };

function supported() {
  if (typeof PublicKeyCredential === "undefined" || !navigator.credentials ||
      !PublicKeyCredential.parseCreationOptionsFromJSON || !PublicKeyCredential.parseRequestOptionsFromJSON) {
    throw new Error("Passkeys require a current browser on HTTPS or localhost.");
  }
}

export async function enrollPasskey(password: string): Promise<void> {
  supported();
  const options = await mutate<Options>("/auth/passkeys/enroll/options", "POST", { password });
  const credential = await navigator.credentials.create({ publicKey:
    PublicKeyCredential.parseCreationOptionsFromJSON(options.public_key as PublicKeyCredentialCreationOptionsJSON) });
  if (!(credential instanceof PublicKeyCredential)) throw new Error("Passkey enrollment was cancelled.");
  await mutate("/auth/passkeys/enroll/verify", "POST", {
    challenge_id: options.challenge_id, credential: credential.toJSON(),
  });
}

export async function signInWithPasskey(email: string, password: string): Promise<Session> {
  supported();
  const options = await mutate<Options>("/auth/passkeys/login/options", "POST", { email, password });
  const credential = await navigator.credentials.get({ publicKey:
    PublicKeyCredential.parseRequestOptionsFromJSON(options.public_key as PublicKeyCredentialRequestOptionsJSON) });
  if (!(credential instanceof PublicKeyCredential)) throw new Error("Passkey verification was cancelled.");
  return mutate<Session>("/auth/passkeys/login/verify", "POST", {
    challenge_id: options.challenge_id, credential: credential.toJSON(),
  });
}
