import { Document, Model, Types } from "mongoose";

export interface IProduct {
  name: string;
  slug: string;
  description: string;
  collectionId?: Types.ObjectId;
  gender: "male" | "female" | "unisex";
  notes?: string[];
  launchDate?: Date;
  images: { url: string; fileId: string }[];
  isFeatured?: boolean;
  isActive?: boolean;
  createdBy?: Types.ObjectId;
  tags?: string[];
  reviewCount?: number;
  ratingAverage?: number;
}

export interface IProductDocument extends IProduct, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProductModel extends Model<IProductDocument> {}