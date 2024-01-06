"use strict";
const express = require("express");
const mongoose = require("mongoose");
const Transport = require("./transport.model");
const bodyParser = require("body-parser");

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
  destination: (req, file, cb) => {
    cb(null, 'transports');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}_${file.originalname}`);
  },
});

const upload = multer({ storage: storage }).single('image');
app.post('/transports', upload, (req, res) => {
  console.log(req.file && req.file.filename);
  const { duration, date, returnDate, departure, destination, price } = req.body;
  const imagePath = 'http://localhost:3000/images/' + (req.file && req.file.filename);

  const newTransport = new Transport({
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

app.get("/transports", async (req, resp) => {
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.size) || 10;
  const filter = {};
  const nbPlaces = parseInt(req.query.nbPlaces);
  const type = req.query.type;
  const minPrice = parseInt(req.query.minPrice);
  const maxPrice = parseInt(req.query.maxPrice);

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
    let result = {};
    if (nbPlaces) {
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
      }
    } else {
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

    const query = Transport.find({ ...result, ...filter });
    Transport.paginate(query, options, (err, resultat) => {
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

app.get("/transportsList", keycloak.protect('realm:admin'), (req, resp) => {
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.size) || 10;
  Transport.paginate("", { page: page, limit: pageSize }, (err, result) => {
    if (err) {
      resp.status(500).send(err);
    } else {
      resp.send(result);
    }
  });
});

app.get("/transports/:id", (req, resp) => {
  Transport.findById(req.params.id, (err, transport) => {
    if (err) resp.status(500).send(err);
    else resp.send(transport);
  });
});

app.put("/transports/:id", upload, (req, resp) => {
  const transportId = req.params.id;

  const updateObject = {};
  updateObject.duration = req.body.duration;
  updateObject.date = req.body.date;
  if (req.body.returnDate) {
    updateObject.returnDate = req.body.returnDate;
  } else {
    updateObject.returnDate = null;
  }
  updateObject.departure = req.body.departure;
  updateObject.destination = req.body.destination;
  updateObject.price = req.body.price;
  if (req.file) {
    updateObject.imagePath = 'http://localhost:3000/images/' + req.file.filename;
  }

  Transport.findByIdAndUpdate(transportId, { $set: updateObject }, (err, updatedTransport) => {
    if (err) {
      console.error(err);
      resp.status(500).json({ error: "Internal Server Error" });
    } else {
      resp.json(updateObject);
    }

  });
});

app.delete("/transports/:id", (req, resp) => {
  Transport.findByIdAndDelete(req.params.id, req.body, (err) => {
    if (err) {
      console.error(err);
      resp.status(500).json({ error: "Internal Server Error" });
    } else {
      resp.json({ message: "transport deleted successfully" });
    }
  });
});

app.get("/destinations", (req, res) => {
  Transport.distinct("destination", (err, destinations) => {
    if (err) {
      res.status(500).send(err);
    } else {
      res.json(destinations);
    }
  });
});

app.get("/departures", (req, res) => {
  Transport.distinct("departure", (err, departures) => {
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

module.exports = app;
