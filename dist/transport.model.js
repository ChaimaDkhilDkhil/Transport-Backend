"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const mongoose_paginate_1 = __importDefault(require("mongoose-paginate"));
let transportSchema = new mongoose_1.default.Schema({
    duration: { type: String, required: true },
    date:{type: Date,required: true},
    returnDate:{type: Date,default:null},
    destination: { type: String, required: true },
    departure: { type: String, required: true },
    price: { type: Number, required: true },
    imagePath: { type: String, required: true },
  });
transportSchema.plugin(mongoose_paginate_1.default);
const transport = mongoose_1.default.model("transport", transportSchema);
exports.default = transport;
