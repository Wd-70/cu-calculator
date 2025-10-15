import mongoose, { Schema, Model, Types } from 'mongoose';

export interface IModificationHistory {
  _id: Types.ObjectId;
  productId: Types.ObjectId;
  action: 'create' | 'update' | 'verify' | 'report';
  beforeData?: Record<string, unknown>;
  afterData?: Record<string, unknown>;
  modifiedBy: string;
  modifiedAt: Date;
  ipAddress?: string;
}

const ModificationHistorySchema = new Schema<IModificationHistory>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      enum: ['create', 'update', 'verify', 'report'],
    },
    beforeData: Schema.Types.Mixed,
    afterData: Schema.Types.Mixed,
    modifiedBy: {
      type: String,
      required: true,
    },
    modifiedAt: {
      type: Date,
      default: Date.now,
    },
    ipAddress: String,
  },
  {
    timestamps: false,
  }
);

// Index for querying history by product
ModificationHistorySchema.index({ productId: 1, modifiedAt: -1 });

const ModificationHistory: Model<IModificationHistory> =
  mongoose.models.ModificationHistory ||
  mongoose.model<IModificationHistory>('ModificationHistory', ModificationHistorySchema);

export default ModificationHistory;
