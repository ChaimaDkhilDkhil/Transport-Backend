import express, { Request, Response } from "express";
import mongoose from "mongoose";
import transportModel from "./transport.model";
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
  destination: (req: Request, file: any, cb: any) => {
    cb(null, 'transports');
  },
  filename: (req: Request, file: any, cb: any) => {
    cb(null, `${Date.now()}_${file.originalname}`);
  },
});

const upload = multer({ storage: storage }).single('image');
app.post('/transports', upload, (req, res) => {
  console.log(req.file?.filename);

  const { duration, date, returnDate, departure, destination, price } = req.body;
  const imagePath = 'http://localhost:3000/images/' + req.file?.filename;

  const newTransport = new transportModel({
    duration,
    date,
    returnDate,
    departure,
    destination,
    price,
    imagePath,
  });

  newTransport.save((err, savedTransport) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ error: 'Une erreur est survenue lors de l\'enregistrement du transport.' });
    }
    res.status(201).json(savedTransport);
  });
});

app.get("/transports", async (req: Request, resp: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.size as string) || 10;
  const filter: any = {};
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

    const query = transportModel.find(filter);
    transportModel.paginate(query, options, (err, result) => {
      if (err) {
        resp.status(500).send(err);
      } else {
        console.log('Pagination Result:', result);
        resp.send(result);
      }
    });

  } catch (err) {
    resp.status(500).json({ message: 'Error fetching transports', error: err });
  }
});

// ... Autres endpoints restants

app.get("/", (req, resp) => {
  resp.send("Transport Server");
});
