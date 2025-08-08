import express from "express";
import {
  createCollection,
  getAllCollections,
  getCollectionById,
  updateCollection,
  updateCollectionStatus,
} from "../controllers/collection.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { isAdmin } from "../middlewares/admin.middleware";
import { upload } from "../middlewares/upload.middleware";

const collectionRouter = express.Router();

collectionRouter.post("/create", authMiddleware, isAdmin, upload.single("image"), createCollection);
collectionRouter.patch("/:id", authMiddleware, isAdmin, upload.single("image"), updateCollection);
collectionRouter.get("/", getAllCollections);
collectionRouter.get("/:id", getCollectionById);
collectionRouter.delete("/:id", authMiddleware, isAdmin, updateCollectionStatus);

export default collectionRouter;
