export default function GoogleButton() {
  return (
    <button
      type="button"
      className="google-btn"
      onClick={() => alert('Google authentication will be connected to the backend later.')}
    >
      <span className="google-g">G</span>
      <span>Continue with Google</span>
    </button>
  );
}
