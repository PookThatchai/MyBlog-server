const mongoose = require("mongoose");
const { Schema } = mongoose;

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true, // ให้ username ไม่ซ้ำกัน
  },
  password: {
    type: String,
    required: true, // รหัสผ่านต้องไม่เป็นค่าว่าง
  },
});

module.exports = mongoose.model("User", UserSchema);
