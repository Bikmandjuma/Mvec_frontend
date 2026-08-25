# MVEC Frontend

A React + Vite frontend for a multi-vendor e-commerce platform.

## Features

- MVEC brand link returns to the home page.
- Responsive home page inspired by the supplied Alibaba login layout.
- Sky-blue visual panel instead of the original promotional image.
- Login page:
  - Continue with Google UI
  - Email or telephone
  - Password
  - Remember me
  - Full forgot-password flow UI: Gmail address → OTP verification → new password
- Sign-up page:
  - Continue with Google UI
  - Full name
  - Telephone
  - Email
  - Gender
  - Account type: Buyer or Vendor
  - Role-specific helper text
- React Router navigation.
- Frontend only. Google authentication, database, real email/OTP delivery, and password persistence are not connected yet.

## Run

```bash
npm install
npm run dev
```

Then open the local URL shown by Vite.

## Suggested next backend work

1. Add your Express/Node API.
2. Store users with a `role` field (`buyer` or `vendor`).
3. Add real Google OAuth.
4. Hash passwords with bcrypt if password login remains enabled.
5. Add JWT/session authentication.
6. Redirect vendors to a vendor dashboard and buyers to the shopping experience after login.

## Password reset flow

The frontend now includes a three-step password recovery experience:

1. User enters the Gmail address associated with the account.
2. User enters a six-digit OTP.
3. After verification, the user chooses a new password.

For the frontend prototype, the OTP is generated locally and displayed as a **Frontend demo OTP** so the complete flow can be tested.

For production, do **not** generate or expose the OTP in React. The backend should:
- Generate a cryptographically secure OTP.
- Store a hashed OTP with an expiry time.
- Send the OTP through an email provider such as Gmail/Google Workspace, SendGrid, Resend, or SMTP.
- Verify the OTP on the server.
- Allow a password reset only after successful server-side verification.
- Hash the new password before storing it.
