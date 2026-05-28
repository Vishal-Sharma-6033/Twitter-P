import mongoose from "mongoose";

const PasswordResetRequestSchema = mongoose.Schema(
  {
    identifier: { type: String, required: true, index: true },
    identifierType: {
      type: String,
      required: true,
      enum: ["email", "phone"],
    },
    email: { type: String, required: true },
    requestedDay: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

PasswordResetRequestSchema.index(
  { identifier: 1, requestedDay: 1 },
  { unique: true }
);

export default mongoose.model(
  "PasswordResetRequest",
  PasswordResetRequestSchema
);