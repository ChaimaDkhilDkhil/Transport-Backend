import mongoose from "mongoose";
import mongoosePaginate from "mongoose-paginate";


let transportSchema = new mongoose.Schema({
  duration: { type: String, required: true },
  date:{type: Date,required: true},
  returnDate:{type: Date,default:null},
  destination: { type: String, required: true },
  departure: { type: String, required: true },
  price: { type: Number, required: true },
  imagePath: { type: String, required: true },
});

transportSchema.plugin(mongoosePaginate);


const transport = mongoose.model("transport", transportSchema);

export default transport;
