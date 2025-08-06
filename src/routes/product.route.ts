import express from "express";
import {
  createProduct,
  getAllProducts,
} from "../controllers/product.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { isAdmin } from "../middlewares/admin.middleware";
import { upload } from "../middlewares/upload.middleware";

const productRouter = express.Router();

productRouter.post(
  "/create",
  authMiddleware,
  isAdmin,
  upload.array("images", 3),
  createProduct
);
productRouter.get("/", getAllProducts);

export default productRouter;
