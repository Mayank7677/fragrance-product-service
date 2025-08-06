import { model, Schema, Types } from "mongoose";
import { IProductDocument, IProductModel } from "../schemas/product.schema";

    const ProductSchema = new Schema<IProductDocument>(
    {
        name: { type: String, required: true, trim: true },
        slug: { type: String,  unique: true },
        description: { type: String, required: true },
        collectionName: { type: String },
        gender: {
        type: String,
        enum: ["male", "female", "unisex"],
        required: true,
        },
        notes: [{ type: String }],
        launchDate: { type: Date },
        images: [{ type: String }],
        isFeatured: { type: Boolean, default: false },
        isActive: { type: Boolean, default: true },
        createdBy: { type: Types.ObjectId, ref: "User" },

        variants: [
        {
            size: { type: String, required: true }, // "50ml" / "100ml"
            sku: { type: String, required: true, unique: true },
            price: { type: Number, required: true , min: [0, "Price cannot be negative"]},
            stock: { type: Number, required: true , min: [0, "Stock cannot be negative"]},
            isLimitedEdition: { type: Boolean, default: false },
        },
        ],

        tags : [{ type: String }],
        reviewCount : { type: Number, default: 0 },
        ratingAverage : { type: Number, default: 0 },
    },
    { timestamps: true }
    );

ProductSchema.pre('save' , function (next){
    if(this.isModified('name')){
        this.slug = this.name.toLowerCase().split(' ').join('-');
    }
    next();
})

export default model<IProductDocument , IProductModel>("Product", ProductSchema);