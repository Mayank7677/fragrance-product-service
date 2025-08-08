import { Document, Model, Types } from "mongoose";

export interface IVariant {
  size: string; // e.g., "100ml"
  sku: string;
  price: number;
  stock: number;
  isLimitedEdition?: boolean;
}

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
  // variants: IVariant[];
  tags?: string[];
  reviewCount?: number;
  ratingAverage?: number;
}

export interface IProductDocument extends IProduct, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProductModel extends Model<IProductDocument> {
  // Add any static methods here in future
  findBySlug(slug: string): Promise<IProductDocument | null>;
}