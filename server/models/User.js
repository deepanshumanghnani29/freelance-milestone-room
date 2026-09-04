// server/models/User.js
// The User model. One document per NamoID identity.
//
// namoidSub is the unique, permanent user identifier from NamoID (the "sub" claim).
// It is used as the foreign key in Project documents instead of MongoDB's ObjectId,
// which keeps joins simple and avoids extra lookups.
//
// role is set exactly once via POST /api/users/me/role.
// After it is set, no route allows it to change.

import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    namoidSub: {
      type: String,
      required: true,
      unique: true, // one User per NamoID identity
      index: true,
    },
    email: { type: String },
    name:  { type: String },
    role: {
      type: String,
      enum: ["client", "freelancer", null],
      default: null,
      // null means the user has signed in but not picked a role yet (onboarding).
    },
  },
  { timestamps: true } // adds createdAt and updatedAt automatically
);

export const User = mongoose.model("User", userSchema);
