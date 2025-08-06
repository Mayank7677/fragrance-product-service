import express from "express";
import {
  createProduct,
  getAllProducts,
  getProductById,
  updateProductStatus,
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
productRouter.get("/:id", getProductById);
productRouter.delete("/:id", authMiddleware, isAdmin, updateProductStatus);

export default productRouter;
