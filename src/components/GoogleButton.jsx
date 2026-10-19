import { GoogleLogin } from "@react-oauth/google";

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

// "Continue with Google". Google hands back an ID token (credential), which
// the backend verifies before signing the user in. Hidden when no client id
// is configured for this build.
export default function GoogleButton({ onCredential, onError, text = "continue_with" }) {
  if (!GOOGLE_CLIENT_ID) return null;
  return (
    <div className="google-signin">
      <div className="or-divider">or</div>
      <GoogleLogin
        onSuccess={(res) => (res?.credential ? onCredential(res.credential) : onError?.())}
        onError={() => onError?.()}
        text={text}
        shape="pill"
        width="320"
      />
    </div>
  );
}
