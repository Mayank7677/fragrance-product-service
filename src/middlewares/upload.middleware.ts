import multer from "multer";
import { AppError } from "../utils/appError";

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Max 5MB per image
  fileFilter(req, file, cb) {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new AppError("Please upload an image", 400));
    }
    cb(null, true);
  },
});