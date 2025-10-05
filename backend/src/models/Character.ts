import mongoose, { Schema, Document, Types } from "mongoose";
import skillSchema, { ISkill } from "./Skill";

interface ICharacter extends Document {
  name: string;
  user: Types.ObjectId;
  skills: ISkill[];
  hp: number;
  xp: number;
  level: number;
}

const characterSchema = new Schema<ICharacter>({
  name: { type: String, required: true },
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  skills: [skillSchema],
  hp: { type: Number, default: 100 },
  xp: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
});

export default mongoose.model<ICharacter>("Character", characterSchema);
