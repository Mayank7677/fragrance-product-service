import express from "express";
import {
  applyDiscountToCollection,
  createProduct,
  getAllProducts,
  getProductById,
  getProductsByCollection,
  removeDiscountFromCollection,
  updateProduct,
  updateProductStatus,
} from "../controllers/product.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { isAdmin } from "../middlewares/admin.middleware";
import { upload } from "../middlewares/upload.middleware";

const productRouter = express.Router();

productRouter.post(
  "/create/:collectionId",
  authMiddleware,
  isAdmin,
  upload.array("images", 3),
  createProduct
);
productRouter.get("/", getAllProducts);
productRouter.get("/:id", getProductById);
productRouter.delete("/:id", authMiddleware, isAdmin, updateProductStatus);
productRouter.patch(
  "/:id",
  authMiddleware,
  isAdmin,
  upload.array("images"),
  updateProduct
);
productRouter.get("/by-collection/:collectionId", getProductsByCollection);

// productRouter.patch(
//   "/collections/:collectionId/apply-discount", authMiddleware , isAdmin , applyDiscountToCollection)
productRouter.patch(
  "/collections/:collectionId/apply-discount", authMiddleware , isAdmin , applyDiscountToCollection)
productRouter.patch(
  "/collections/:collectionId/remove-discount", authMiddleware , isAdmin , removeDiscountFromCollection)

export default productRouter;
