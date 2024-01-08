import express, { Request, Response } from "express";
import mongoose from "mongoose";
import Transport from "./transport.model";
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
const PORT = process.env.PORT || 3004;
const eurekaHelper = require('./eureka-helper');

app.listen(PORT, () => {
  console.log("transport-server on 3004");
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

const upload = multer({ storage: storage }).single('imagePath');
app.post('/transports', keycloak.protect( 'realm:admin' ), upload, (req, res) => {
  console.log(req.file?.filename);

  const { mark, location, nbPerson, nbLuggage, price } = req.body;
  const imagePath = 'http://localhost:3004/images/' + req.file?.filename;

  const newTransport = new Transport({
    mark,
    location,
    nbPerson,
    nbLuggage,
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

  if (req.query.mark) {
    filter.mark = req.query.mark;
  }

  if (req.query.location) {
    filter.location = req.query.location;
  }

  if (req.query.nbPerson) {
    filter.nbPerson = { $lte: req.query.nbPerson };
  }

  if (req.query.nbLuggage) {
    filter.nbLuggage = { $lte: req.query.nbLuggage };
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

    const query = Transport.find(filter);
    Transport.paginate(query, options, (err, result) => {
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


app.get("/transportsList", keycloak.protect( 'realm:admin' ), (req: Request, resp: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.size as string) || 10;

  Transport.paginate("", { page: page, limit: pageSize }, (err, result) => {
    if (err) {
      resp.status(500).send(err);
    } else {
      resp.send(result);
    }
  });

});
app.get("/transports/:id", (req: Request, resp: Response) => {
  Transport.findById(req.params.id, (err: any, tranport: any) => {
    if (err) resp.status(500).send(err);
    else resp.send(tranport);
  });
});
app.put("/transports/:id", keycloak.protect( 'realm:admin' ), upload, (req: Request, resp: Response) => {
  const transportId = req.params.id;

  const updateObject: any = {};
  updateObject.mark = req.body.mark;
  updateObject.location = req.body.location;
  updateObject.nbPerson = req.body.nbPerson;
  updateObject.nbLuggage = req.body.nbLuggage;
  updateObject.price = req.body.price;
  if (req.file) {
    updateObject.imagePath = 'http://localhost:3004/images/' + req.file.filename;
  }

  Transport.findByIdAndUpdate(transportId, { $set: updateObject }, (err:any, updatedFlight:any) => {
    if (err) {
      console.error(err);
      resp.status(500).json({ error: "Internal Server Error" });
    } else {
      resp.json(updateObject);
    }
    
  });
});


app.delete("/transports/:id", keycloak.protect( 'realm:admin' ), (req: Request, resp: Response) => {
  Transport.findByIdAndDelete(req.params.id, req.body, (err: any) => {
    if (err) {
      console.error(err);
      resp.status(500).json({ error: "Internal Server Error" });
    } else {
      resp.json({ message: "Transport deleted successfully" });
    }
  });
});


app.get("/mark", (req, res) => {
  Transport.distinct("mark", (err:any, mark:any) => {
    if (err) {
      res.status(500).send(err);
    } else {
      res.json(mark);
    }
  });
});
app.get("/location", (req, res) => {
  Transport.distinct("location", (err:any, location:any) => {
    if (err) {
      res.status(500).send(err);
    } else {
      res.json(location);
    }
  });
});

app.get("/", (req, resp) => {
  resp.send("Transport Server");
});
