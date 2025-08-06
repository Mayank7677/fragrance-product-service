import { NextFunction, Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { catchAsync } from "../utils/catchAsync";
import { IProduct } from "../schemas/product.schema";
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
    const imageUrls = imageUploads.map((img) => img.url);

    if (!imageUrls.length) {
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
      images: imageUrls,
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
      sortBy = "createdAt",
      order = "desc",
      size,
      tags,
    } = req.query;

    console.log("req.query", req.query);

    const filter: any = {};

    // search filter
    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    // direct filters
    if (gender) filter.gender = gender;
    if (collectionName) filter.collectionName = collectionName;
    if (isFeatured !== undefined) filter.isFeatured = isFeatured === "true";

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
 