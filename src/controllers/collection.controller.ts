import { NextFunction, Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { catchAsync } from "../utils/catchAsync";
import { AppError } from "../utils/appError";
import imagekit from "../configs/imagekit";
import logger from "../utils/logger";
import slugify from "slugify";
import { Collection } from "../models/collection.model";
import { startSession } from "mongoose";
import productModel from "../models/product.model";
import redisClient from "../configs/redisClient";

export const createCollection = catchAsync(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    console.log(req.body);
    const { name, description, isFeatured } = req.body;
    const file = req.file;

    let image = {};

    if (file) {
      const imageUpload = await imagekit.upload({
        file: file.buffer,
        fileName: file.originalname,
        folder: "/collections",
      });

      logger.info("Image uploaded to ImageKit");

      image = {
        url: imageUpload.url,
        fileId: imageUpload.fileId,
      };
    }

    const slug = slugify(name || "", { lower: true, strict: true });

    const collection = new Collection({
      name,
      slug,
      description,
      image,
      isFeatured,
      createdBy: req.user.userId,
    });

    await collection.save();
    logger.info("Collection created successfully");

    res
      .status(201)
      .json({ message: "Collection created successfully", collection });
  }
);

export const updateCollection = catchAsync(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { name, description, isFeatured } = req.body;
    const file = req.file;

    const collection = await Collection.findById(id);

    if (!collection) return next(new AppError("Collection not found", 404));

    if (file) {
      if (collection.image?.fileId) {
        await imagekit.deleteFile(collection.image.fileId).catch(() => null);
      }

      const imageUpload = await imagekit.upload({
        file: file.buffer,
        fileName: file.originalname,
        folder: "/collections",
      });

      collection.image = {
        url: imageUpload.url,
        fileId: imageUpload.fileId,
      };
    }

    if (name) {
      collection.name = name;
      collection.slug = slugify(name);
    }

    if (description) {
      collection.description = description;
    }

    if (isFeatured !== undefined) {
      collection.isFeatured = isFeatured;
    }

    await collection.save();

    res.status(200).json({
      message: "Collection updated successfully",
      collection,
    });
  }
);

export const getAllCollections = catchAsync(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { page = 1, limit = 10, isFeatured, search } = req.query;
    const skip: number = (+page - 1) * +limit;
    const filter: any = {};

    if (isFeatured !== undefined) {
      filter.isFeatured = isFeatured === "true";
    }

    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    // generating unique cache key
    const cacheKey = `collections:${JSON.stringify(filter)}:${page}:${limit}`;

    // fetching from cache first 
    const cachedCollections = await redisClient.get(cacheKey);
    if (cachedCollections) {
      logger.info("Collections fetched from cache");
      return res.status(200).json(JSON.parse(cachedCollections));
    }

    // fetching from database
    const collections = await Collection.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(+limit);

    const total = await Collection.countDocuments(filter);

    const responseData = {
      success: true,
      total,
      page: +page,
      pageSize: collections.length,
      totalPages: Math.ceil(total / +limit),
      collections,
    }

    // setting cache
    await redisClient.setEx(cacheKey, 60 * 60, JSON.stringify(responseData));

    res.status(200).json(responseData);
  }
);

export const getCollectionById = catchAsync(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;

    if (!id) return next(new AppError("Please provide a collection id", 400));

    const collection = await Collection.findById(id);

    if (!collection) return next(new AppError("Collection not found", 404));

    res.status(200).json({ collection });
  }
);

export const updateCollectionStatus = catchAsync(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { isActive } = req.body;

    if (!id) return next(new AppError("Please provide a collection id", 400));
    if (typeof isActive !== "boolean") {
      return next(
        new AppError("Please provide a valid 'isActive' boolean value", 400)
      );
    }

    const session = await startSession();
    session.startTransaction();

    try {
      const collection = await Collection.findById(id).session(session);

      if (!collection) return next(new AppError("Collection not found", 404));

      collection.isActive = isActive;
      await collection.save({ session });

      await productModel.updateMany(
        { collectionId: id },
        { $set: { isActive } },
        { session }
      );

      await session.commitTransaction();
      await session.endSession();

      res.status(200).json({
        message: "Collection and products status updated successfully",
        collection,
      });
    } catch (error) {
      await session.abortTransaction();
      await session.endSession();
      return next(error);
    }
  }
);
