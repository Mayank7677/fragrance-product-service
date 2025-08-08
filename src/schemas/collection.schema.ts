import { Document, Types } from "mongoose";

export interface IImage {
  url: string;
  fileId: string;
}

export interface ICollection {
  name: string;
  slug: string;
  description?: string;
  image?: IImage;
  isFeatured?: boolean;
  createdBy?: Types.ObjectId;
  isActive?: boolean;
}

export interface ICollectionDocument extends ICollection, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
