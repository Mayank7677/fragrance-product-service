import { NextFunction, Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { catchAsync } from "../utils/catchAsync";
import imagekit from "../configs/imagekit";
import Product from "../models/product.model";
import logger from "../utils/logger";
import { AppError } from "../utils/appError";

export const createProduct = catchAsync(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const files = req.files as Express.Multer.File[];

    // Upload images to ImageKit
    const imageUploads = await Promise.all(
      files.map((file) =>
        imagekit.upload({
          file: file.buffer,
          fileName: file.originalname,
          folder: "/perfumes",
        })
      )
    );

    logger.info("Images uploaded to ImageKit");
    const images = imageUploads.map((img) => ({
      url: img.url,
      fileId: img.fileId,
    }));

    if (!images.length) {
      return next(new AppError("Please upload at least one image", 400));
    }

    // Extract product fields from body
    const {
      name,
      description,
      collectionName,
      gender,
      notes,
      launchDate,
      isFeatured,
      isActive,
      variants,
      tags,
    } = req.body;

    // Create product
    const product = await new Product({
      name,
      description,
      collectionName,
      gender,
      notes: notes ? JSON.parse(notes) : [],
      launchDate,
      isFeatured,
      isActive,
      tags: tags ? JSON.parse(tags) : [],
      variants: variants ? JSON.parse(variants) : [],
      images: images,
      createdBy: req.user.userId,
    });

    await product.save();

    logger.info("Product created successfully");

    res.status(201).json({ message: "Product created successfully", product });
  }
);

export const getAllProducts = catchAsync(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const {
      page = 1,
      limit = 10,
      search,
      gender,
      collectionName,
      isFeatured,
      isActive,
      sortBy = "createdAt",
      order = "desc",
      size,
      tags,
    } = req.query;

    const filter: any = {};

    // search filter
    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    // direct filters
    if (gender) filter.gender = gender;
    if (collectionName) filter.collectionName = collectionName;
    if (isFeatured !== undefined) filter.isFeatured = isFeatured === "true";
    if (isActive !== undefined) filter.isActive = isActive === "true";

    // Filter by variant size
    if (size) {
      filter["variants.size"] = size;
    }

    // Filter by tags (expects comma-separated list like ?tags=luxury,woody)
    if (tags) {
      const tagArray = (tags as string).split(",").map((tag) => tag.trim());
      filter.tags = { $in: tagArray };
    }

    const skip: number = (+page - 1) * +limit;

    console.log("Generated filter:", JSON.stringify(filter, null, 2));

    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort({ [sortBy as string]: order === "asc" ? 1 : -1 })
        .skip(skip)
        .limit(+limit),

      Product.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      total,
      page: +page,
      pageSize: products.length,
      totalPages: Math.ceil(total / +limit),
      products,
    });
  }
);

export const getProductById = catchAsync(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;

    if (!id) return next(new AppError("Please provide a product id", 400));

    const product = await Product.findById(id);

    if (!product) return next(new AppError("Product not found", 404));

    res.status(200).json({ product });
  }
);

export const updateProductStatus = catchAsync(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { isActive } = req.body;

    if (!id) return next(new AppError("Please provide a product id", 400));
    if (typeof isActive !== "boolean") {
      return next(
        new AppError("Please provide a valid 'isActive' boolean value", 400)
      );
    }

    const product = await Product.findById(id);
    if (!product) return next(new AppError("Product not found", 404));

    product.isActive = isActive;
    await product.save();

    res.status(200).json({ success: true, product });
  }
);

export const updateProduct = catchAsync(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const files = req.files as Express.Multer.File[];

    const product = await Product.findById(id);
    if (!product) return next(new AppError("Product not found", 404));

    const {
      name,
      description,
      collectionName,
      gender,
      notes,
      launchDate,
      isFeatured,
      isActive,
      tags,
      variants,
    } = req.body;

    // 🔁 Update basic fields if provided
    if (name) product.name = name;
    if (description) product.description = description;
    if (collectionName) product.collectionName = collectionName;
    if (gender) product.gender = gender;
    if (launchDate) product.launchDate = launchDate;
    if (isFeatured !== undefined) product.isFeatured = isFeatured === "true";
    if (isActive !== undefined) product.isActive = isActive === "true";
    if (tags) product.tags = JSON.parse(tags);
    if (notes) product.notes = JSON.parse(notes);
    if (variants) product.variants = JSON.parse(variants);

    // 🔄 Handle image replacement (if new images provided)
    if (files && files.length > 0) {
      // Delete old images from ImageKit
      for (const img of product.images || []) {
        await imagekit.deleteFile(img.fileId);
      }

      // Upload new images
      const uploaded = await Promise.all(
        files.map((file) =>
          imagekit.upload({
            file: file.buffer,
            fileName: file.originalname,
            folder: "/perfumes",
          })
        )
      );

      product.images = uploaded.map((img) => ({
        url: img.url,
        fileId: img.fileId,
      }));
    }

    await product.save();

    res.status(200).json({ message: "Product updated successfully", product });
  }
);
