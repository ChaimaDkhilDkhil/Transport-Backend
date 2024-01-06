import express, { Request, Response } from "express";
import mongoose from "mongoose";
import transport from "./transport.model";
import bodyParser from "body-parser";

const cors = require('cors');
const multer = require('multer');
const path = require('path');

const session = require('express-session');
const Keycloak = require('keycloak-connect');

const memoryStore = new session.MemoryStore();
const kcConfig = {
  clientId: 'flyware-client',
  bearerOnly: true,
  serverUrl: 'http://localhost:8080',
  realm: 'Flyware-Realm',
  publicClient: true
};

const keycloak = new Keycloak({ store: memoryStore }, kcConfig);
const app = express();
app.use(cors());
app.use(session({
  secret: 'my-secret',
  resave: false,
  saveUninitialized: true,
  store: memoryStore,
}));

app.use(keycloak.middleware()); 
app.use('/images', express.static(path.join(__dirname, '../transports')));
const PORT = process.env.PORT || 3000;
const eurekaHelper = require('./eureka-helper');

app.listen(PORT, () => {
  console.log("transport-server on 3000");
});

eurekaHelper.registerWithEureka('transport-server', PORT);
app.use(bodyParser.json());

const uri = "mongodb://127.0.0.1:27017/Flyware";
mongoose.connect(uri, (err) => {
  if (err) console.log(err);
  else console.log("Mongo Database connected successfully");
});


const storage = multer.diskStorage({
  destination: (req:Request, file:any, cb:any) => {
    cb(null, 'transports');
  },
  filename: (req:Request, file:any, cb:any) => {
    cb(null, `${Date.now()}_${file.originalname}`); // Rename the file if necessary
  },
});

const upload = multer({ storage: storage }).single('image');
app.post('/transports', upload, (req, res) => {
  console.log(req.file?.filename);

  const { duration,date,returnDate, departure, destination, price,nbBuisPlaces,nbEcoPlaces } = req.body;
  const imagePath = 'http://localhost:3000/images/' + req.file?.filename;

  const newtransport = new transport({
    duration,
    date,
    returnDate,
    departure,
    destination,
    price,
    nbBuisPlaces,
    nbEcoPlaces,
    imagePath,
  });

  newtransport.save((err, savedtransport) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ error: 'Une erreur est survenue lors de l\'enregistrement du transport.' });
    }
    res.status(201).json(savedtransport);
  });
});

app.get("/transports", async (req: Request, resp: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.size as string) || 10;
  const filter: any = {};
  const nbPlaces = parseInt(req.query.nbPlaces as string);
  const type = req.query.type as string;
  const minPrice = parseInt(req.query.minPrice as string);
  const maxPrice = parseInt(req.query.maxPrice as string);

  if (req.query.departure) {
    filter.departure = req.query.departure;
  }

  if (req.query.destination) {
    filter.destination = req.query.destination;
  }

  if (req.query.date) {
    filter.date = req.query.date;
  }

  if (req.query.returnDate) {
    filter.returnDate = req.query.returnDate;
  }

  try {
    let result: any = {};
if(nbPlaces){
    if (type === 'business') {
      result = {
           nbBuisPlaces: { $gte: nbPlaces }
        
      };
    } else if (type === 'economic') {
      result = {
        nbEcoPlaces: { $gte: nbPlaces }
      };
    } else {
      result = {
        $or: [
          { nbBuisPlaces: { $gte: nbPlaces } },
          { nbEcoPlaces: { $gte: nbPlaces } }
        ]
      };
    }}else {
      if (type === 'business') {
        result = {
             nbBuisPlaces: { $gt: 0 }
          
        };
      } else if (type === 'economic') {
        result = {
          nbEcoPlaces: { $gt: 0 }
        };
      }
    }
    if (minPrice) {
      filter.price = { $gte: minPrice };
    }
    
    if (maxPrice) {
      filter.price = { ...filter.price, $lte: maxPrice };
    }
const options = {
  page: page,
  limit: pageSize
};

const query = transport.find({...result,...filter});
transport.paginate(query, options, (err, resultat) => {
  if (err) {
    resp.status(500).send(err);
  } else {
    console.log('Pagination Result:', resultat);
    resp.send(resultat);
  }
});

  
  } catch (err) {
    resp.status(500).json({ message: 'Error fetching transports', error: err });
  }
});

app.get("/transportsList", keycloak.protect( 'realm:admin' ), (req: Request, resp: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.size as string) || 10;


  transport.paginate("", { page: page, limit: pageSize }, (err, result) => {
    if (err) {
      resp.status(500).send(err);
    } else {
      resp.send(result);
    }
  });

});
app.get("/transports/:id", (req: Request, resp: Response) => {
  transport.findById(req.params.id, (err: any, transport: any) => {
    if (err) resp.status(500).send(err);
    else resp.send(transport);
  });
});
app.put("/transports/:id", upload, (req: Request, resp: Response) => {
  const transportId = req.params.id;

  const updateObject: any = {};
  updateObject.duration = req.body.duration;
  updateObject.date = req.body.date;
  if(req.body.returnDate) {  updateObject.returnDate = req.body.returnDate;
  }else{  updateObject.returnDate = null;
  }
  updateObject.departure = req.body.departure;
  updateObject.destination = req.body.destination;
  updateObject.price = req.body.price;
  updateObject.nbBuisPlaces = req.body.nbBuisPlaces;
  updateObject.nbEcoPlaces = req.body.nbEcoPlaces;
  if (req.file) {
    updateObject.imagePath = 'http://localhost:3000/images/' + req.file.filename;
  }

  transport.findByIdAndUpdate(transportId, { $set: updateObject }, (err:any, updatedtransport:any) => {
    if (err) {
      console.error(err);
      resp.status(500).json({ error: "Internal Server Error" });
    } else {
      resp.json(updateObject);
    }
    
  });
});


app.delete("/transports/:id", (req: Request, resp: Response) => {
  transport.findByIdAndDelete(req.params.id, req.body, (err: any) => {
    if (err) {
      console.error(err);
      resp.status(500).json({ error: "Internal Server Error" });
    } else {
      resp.json({ message: "transport deleted successfully" });
    }
  });
});


app.get("/destinations", (req, res) => {
  transport.distinct("destination", (err:any, destinations:any) => {
    if (err) {
      res.status(500).send(err);
    } else {
      res.json(destinations);
    }
  });
});
app.get("/departures", (req, res) => {
  transport.distinct("departure", (err:any, departures:any) => {
    if (err) {
      res.status(500).send(err);
    } else {
      res.json(departures);
    }
  });
});
app.get("/", (req, resp) => {
  resp.send("Transport Server");
});
