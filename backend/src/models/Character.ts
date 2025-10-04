import mongoose, { Schema, Document } from "mongoose";

export interface ISkill {
  name: string;
  mastered: boolean;
}

export interface ICharacter extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  skills: ISkill[];
}

const CharacterSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true },
  skills: [
    {
      name: { type: String, required: true },
      mastered: { type: Boolean, default: false },
    },
  ],
});

export default mongoose.model<ICharacter>("Character", CharacterSchema);
