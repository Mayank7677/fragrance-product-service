import { NextFunction, Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { catchAsync } from "../utils/catchAsync";
import imagekit from "../configs/imagekit";
import Product from "../models/product.model";
import logger from "../utils/logger";
import { AppError } from "../utils/appError";
import { Collection } from "../models/collection.model";
import { Types } from "mongoose";
import axios from "axios";

export const createProduct = catchAsync(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { collectionId } = req.params;
    const findCollection = await Collection.findById(collectionId);

    if (!collectionId) {
      return next(new AppError("Please provide a collection id", 400));
    }

    if (!findCollection) {
      return next(new AppError("Collection not found", 404));
    }

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
      gender,
      notes,
      launchDate,
      isFeatured,
      isActive,
      tags,
    } = req.body;

    logger.info("creating product");

    // Create product
    const product = await new Product({
      name,
      description,
      collectionId,
      gender,
      notes: notes ? JSON.parse(notes) : [],
      launchDate,
      isFeatured,
      isActive,
      tags: tags ? JSON.parse(tags) : [],
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
    if (isFeatured !== undefined) filter.isFeatured = isFeatured === "true";
    if (isActive !== undefined) filter.isActive = isActive === "true";

    // Filter by variant size
    // if (size) {
    //   filter["variants.size"] = size;
    // }

    // Filter by tags (expects comma-separated list like ?tags=luxury,woody)
    if (tags) {
      const tagArray = (tags as string).split(",").map((tag) => tag.trim());
      filter.tags = { $in: tagArray };
    }

    const skip: number = (+page - 1) * +limit;

    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort({ [sortBy as string]: order === "asc" ? 1 : -1 })
        .skip(skip)
        .limit(+limit)
        .populate("collectionId", "name slug"),

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

    const product = await Product.findById(id).populate(
      "collectionId",
      "name slug"
    );

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

    const product = await Product.findById(id).populate(
      "collectionId",
      "name slug"
    );
    if (!product) return next(new AppError("Product not found", 404));

    product.isActive = isActive;
    await product.save();

    res.status(200).json({ success: true, product });
  }
);

export const updateProduct = catchAsync(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const productId = req.params.id;
    const files = req.files as Express.Multer.File[];

    const product = await Product.findById(productId);
    if (!product) return next(new AppError("Product not found", 404));

    // Parse body fields
    const {
      name,
      description,
      gender,
      notes,
      launchDate,
      isFeatured,
      isActive,
      tags,
      existingImages,
    } = req.body;

    // Keep original images by default
    let allImages = product.images;

    // Only perform image updates if existingImages or files are provided
    if (existingImages || (files && files.length > 0)) {
      let parsedExistingImages: { url: string; fileId: string }[] = [];

      if (existingImages) {
        try {
          parsedExistingImages = JSON.parse(existingImages);
        } catch (err) {
          return next(new AppError("Invalid existingImages format", 400));
        }

        // Delete removed images from ImageKit
        const existingFileIds = parsedExistingImages.map((img) => img.fileId);
        const imagesToDelete = product.images.filter(
          (img: any) => !existingFileIds.includes(img.fileId)
        );

        await Promise.all(
          imagesToDelete.map((img: any) =>
            imagekit.deleteFile(img.fileId).catch(() => null)
          )
        );
      }

      // Upload new images
      let newImages: { url: string; fileId: string }[] = [];
      if (files && files.length > 0) {
        const uploads = await Promise.all(
          files.map((file) =>
            imagekit.upload({
              file: file.buffer,
              fileName: file.originalname,
              folder: "/perfumes",
            })
          )
        );

        newImages = uploads.map((img) => ({
          url: img.url,
          fileId: img.fileId,
        }));
      }

      // Combine both
      allImages = [...(parsedExistingImages || []), ...newImages];
    }

    // Prepare update object
    const data: any = {
      ...(name && { name }),
      ...(description && { description }),
      ...(gender && { gender }),
      ...(launchDate && { launchDate }),
      ...(isFeatured !== undefined && { isFeatured }),
      ...(isActive !== undefined && { isActive }),
      ...(tags && { tags: typeof tags === "string" ? JSON.parse(tags) : tags }),
      ...(notes && {
        notes: typeof notes === "string" ? JSON.parse(notes) : notes,
      }),
      ...(existingImages || (files && files.length > 0)
        ? { images: allImages }
        : {}),
    };

    const updated = await Product.findByIdAndUpdate(productId, data, {
      new: true,
    });

    res.status(200).json({
      message: "Product updated successfully",
      product: updated,
    });
  }
);

export const getProductsByCollection = catchAsync(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { collectionId } = req.params;
    const {
      page = 1,
      limit = 10,
      search = "",
      gender,
      isFeatured,
      minPrice,
      maxPrice,
    } = req.query;

    // Validate collectionId
    if (!Types.ObjectId.isValid(collectionId)) {
      return next(new AppError("Invalid collectionId", 400));
    }

    // Check collection existence
    const collectionExists = await Collection.findById(collectionId);
    if (!collectionExists) {
      return next(new AppError("Collection not found", 404));
    }

    // Filters
    const query: any = {
      collectionId: collectionId,
      isActive: true,
    };

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    if (gender) {
      query.gender = gender;
    }

    if (isFeatured !== undefined) {
      query.isFeatured = isFeatured === "true";
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [products, total] = await Promise.all([
      Product.find(query)
        .populate("collectionId", "name slug")
        // .populate("createdBy", "name email")                               // todo : user model not present in this database
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Product.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      products,
    });
  }
);

// export const applyDiscountToCollection = catchAsync(
//   async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
//     const { collectionId } = req.params;
//     const { discountPercent } = req.body;

//     if (!collectionId)
//       return next(new AppError("Please provide a collection id", 400));
//     if (typeof discountPercent !== "number")
//       return next(new AppError("Please provide a valid discount percent", 400));

//     // get all products of collection
//     const products = await Product.find({ collectionId });

//     if (!products.length)
//       return next(new AppError("No products found in collection", 404));

//     // product Ids
//     const productIds = products.map((product) => product._id);

//     // calling inventory service to apply discount
//     let result = await axios.patch(
//       `${process.env.INVENTORY_SERVICE_URL}/api/variants/update-discount-by-collection`,
//       {
//         productIds,
//         discountPercent,
//       },
//       {
//         headers: {
//           Authorization: req.headers.authorization,
//         },
//       }
//     );

//     res.status(200).json({
//       message: "Discount applied successfully",
//     });
//   }
// );

export const applyDiscountToCollection = catchAsync(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { collectionId } = req.params;
    const { discountPercent } = req.body;
    const adminUserId = req.user?.userId || null; // from auth middleware

    if (!collectionId)
      return next(new AppError("Please provide a collection id", 400));
    if (typeof discountPercent !== "number")
      return next(new AppError("Please provide a valid discount percent", 400));

    // get all products of collection
    const products = await Product.find({ collectionId });

    if (!products.length)
      return next(new AppError("No products found in collection", 404));

    // product Ids
    const productIds = products.map((product) => product._id);

    try {
      // calling inventory service to apply discount
      let result = await axios.patch(
        `${process.env.INVENTORY_SERVICE_URL}/api/variants/update-discount-by-collection`,
        {
          productIds,
          discountPercent,
          initiatedBy: adminUserId,
        },
        {
          headers: {
            Authorization: req.headers.authorization,
            "x-internal-key": process.env.INTERNAL_API_KEY,
          },
        }
      );

      logger.info("Inventory prepare returned successfully" + result.data);
      const { operationId } = result.data as { operationId: string };
      logger.info("applyDiscountToCollection operationId: " + operationId);

      // At this point inventory has applied changes and recorded audit (status pending).
      // If Product Service has additional steps (e.g., update collection metadata), do them here.

      // if all okay
      await axios.post(
        `${process.env.INVENTORY_SERVICE_URL}/api/variants/commit-bulk-discount`,
        {
          operationId,
        },
        {
          headers: {
            Authorization: req.headers.authorization,
            "x-internal-key": process.env.INTERNAL_API_KEY,
          },
        }
      );

      res.status(200).json({
        message: "Discount applied successfully",
      });
    } catch (err: any) {
      // Inventory prepare might have succeeded but subsequent product service actions failed.
      // Try to rollback inventory if we have an operationId

      console.log(err);
      console.log(
        "err.response?.config?.data?.operationId",
        JSON.parse(err.response?.config?.data || "{}").operationId
      );
      const opId = JSON.parse(err.response?.config?.data || "{}").operationId;
      logger.error("applyDiscountToCollection operationId: " + opId);

      if (opId) {
        try {
          await axios.post(
            `${process.env.INVENTORY_SERVICE_URL}/api/variants/rollback-bulk-discount`,
            {
              operationId: opId,
            },
            {
              headers: {
                Authorization: req.headers.authorization,
                "x-internal-key": process.env.INTERNAL_API_KEY,
              },
            }
          );
        } catch (error: any) {
          logger.error("Rollback failed", error);
        }
      }

      return next(
        new AppError(err.response?.data?.message || err.message, 500)
      );
    }
  }
);

export const removeDiscountFromCollection = catchAsync(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { collectionId } = req.params;

    if (!collectionId)
      return next(new AppError("Please provide a collection id", 400));

    // get all products of collection
    const products = await Product.find({ collectionId });

    if (!products.length)
      return next(new AppError("No products found in collection", 404));

    // product Ids
    const productIds = products.map((product) => product._id);

    // calling inventory service to remove discount
    let result = await axios.patch(
      `${process.env.INVENTORY_SERVICE_URL}/api/variants/remove-discount-by-collection`,
      {
        productIds,
      },
      {
        headers: {
          Authorization: req.headers.authorization,
        },
      }
    );

    res.status(200).json({
      message: "Discount removed successfully",
    });
  }
);

export const getAllProductsByIds = catchAsync(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    console.log(req.query.productIds);
    const ids = (req.query.productIds as string)?.split(",") || [];

    // Convert all IDs to Mongo ObjectId type
    const objectIds = ids.map((id) => new Types.ObjectId(id));

    console.log(objectIds);
    const products = await Product.find({ _id: { $in: objectIds } });
    res.status(200).json({ products });
  }
);
