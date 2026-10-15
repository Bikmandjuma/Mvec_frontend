import { client, mapAuthResponse, mapUser } from "./client";

export const authApi = {
  register: (payload) => {
    const backendPayload = {
      Fullname: payload.fullName || payload.Fullname,
      email: payload.email,
      phone: payload.telephone || payload.phone,
      gender: payload.gender,
      role: payload.role,
      companyName: payload.companyName,
      password: payload.password,
    };
    return client
      .post("/auth/register", backendPayload)
      .then((r) => mapAuthResponse(r.data));
  },
  login: (identity, password) => {
    const isEmail = identity.includes("@");
    const backendPayload = isEmail
      ? { email: identity, password }
      : { phone: identity, password };
    return client
      .post("/auth/login", backendPayload)
      .then((r) => mapAuthResponse(r.data));
  },
  me: () =>
    client.get("/auth/me").then((r) => mapUser(r.data.user)),
  updateProfile: (payload) =>
    client.patch("/auth/me", payload).then((r) => mapUser(r.data.user)),
  // Changing the password signs out every other session; the server returns
  // a fresh token for this one, which must replace the old (now revoked) one.
  changePassword: (payload) =>
    client.post("/auth/change-password", payload).then((r) => {
      if (r.data?.token) {
        try { localStorage.setItem("huska_token", r.data.token); } catch { /* storage unavailable */ }
      }
      return r.data;
    }),
  // Portal account settings (name, phone, avatar, preferences).
  updateAccount: (payload) =>
    client.patch("/auth/profile", payload).then((r) => ({ ...r.data, user: mapUser(r.data.user) })),
  uploadAvatar: (file) => {
    const formData = new FormData();
    formData.append("avatar", file);
    return client.post("/uploads/avatar", formData).then((r) => r.data);
  },
  removeAvatar: () =>
    client.delete("/auth/avatar").then((r) => r.data),
  logoutAll: () =>
    client.post("/auth/logout-all").then((r) => r.data),
  forgotPassword: (payload) =>
    client.post("/auth/forgot-password", payload).then((r) => r.data),
  verifyResetOtp: (payload) =>
    client.post("/auth/verify-reset-otp", payload).then((r) => r.data),
  resetPassword: (resetToken, newPassword) =>
    client.post("/auth/reset-password", { resetToken, newPassword }).then((r) => r.data),
};
