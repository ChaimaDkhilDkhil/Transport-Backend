import mongoose from "mongoose";
import mongoosePaginate from "mongoose-paginate";



let transportSchema = new mongoose.Schema({
  mark:{type: String,default:true},
  location: { type: String, required: true },
  nbPerson: { type: Number, required: true },
  nbLuggage: { type: Number, required: true },
  price: { type: Number, required: true },
  imagePath: { type: String, required: true },
});
transportSchema.plugin(mongoosePaginate);


const transport = mongoose.model("transport", transportSchema);

export default transport;
