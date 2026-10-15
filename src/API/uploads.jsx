import { client } from "./client";

export const uploadsApi = {
  // Accepts an array of File objects, returns { urls: string[] }
  uploadImages: (files) => {
    const formData = new FormData();
    [...files].forEach((file) => formData.append("images", file));
    // Deliberately no Content-Type header here: axios auto-detects FormData
    // and sets "multipart/form-data; boundary=..." itself. Setting it
    // manually (without the boundary) makes the body unparseable on the
    // server and is what was causing upload requests to fail.
    return client.post("/uploads/images", formData).then((r) => r.data);
  },
  // Profile photo for the signed-in account. Returns { avatarUrl }.
  uploadAvatar: (file) => {
    const formData = new FormData();
    formData.append("avatar", file);
    return client.post("/uploads/avatar", formData).then((r) => r.data);
  },
};
