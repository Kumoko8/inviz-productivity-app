import mongoose, { Schema, Types } from "mongoose";

const skillSchema = new Schema({
  name: { type: String, required: true },
  progress: { type: Number, default: 0 },
  mastered: { type: Boolean, default: false },
}, { _id: true }); // Mongoose will give each skill a unique _id

export interface ISkill {
  _id: Types.ObjectId;
  name: string;
  progress: number;
  mastered: boolean;
}

export default skillSchema;
