import React from "react";

export default function GoogleButton({ onGoogleLogin }) {
  // Immediately call onGoogleLogin with empty response to avoid GSI errors
  useEffect(() => {
    if (onGoogleLogin) {
      onGoogleLogin({});
    }
  }, []);

  return null;
}
