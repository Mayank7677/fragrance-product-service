import { model, Schema, Types } from "mongoose";
import { ICollectionDocument } from "../schemas/collection.schema";
import slugify from "slugify";

const CollectionSchema = new Schema<ICollectionDocument>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String },
    image: {
      url: { type: String },
      fileId: { type: String }, 
    },
    isFeatured: { type: Boolean, default: false },
    createdBy: { type: Types.ObjectId, ref: "User", required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Automatically generate slug from name before saving
CollectionSchema.pre("validate", function (next) {
  if (this.name && !this.slug) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  next();
});

export const Collection = model<ICollectionDocument>(
  "Collection",
  CollectionSchema
);
