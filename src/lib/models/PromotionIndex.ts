import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPromotionIndex extends Document {
  _id: mongoose.Types.ObjectId;
  barcode: string;
  promotionIds: mongoose.Types.ObjectId[];
  lastUpdated: Date;
}

const PromotionIndexSchema = new Schema<IPromotionIndex>(
  {
    barcode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    promotionIds: {
      type: [Schema.Types.ObjectId],
      default: [],
      ref: 'Promotion',
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const PromotionIndex: Model<IPromotionIndex> =
  mongoose.models.PromotionIndex ||
  mongoose.model<IPromotionIndex>('PromotionIndex', PromotionIndexSchema);

export default PromotionIndex;
