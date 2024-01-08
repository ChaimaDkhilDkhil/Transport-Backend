"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
const transport_model_1 = __importDefault(require("./transport.model"));
const body_parser_1 = __importDefault(require("body-parser"));
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
const app = (0, express_1.default)();
app.use(cors());
app.use(session({
    secret: 'my-secret',
    resave: false,
    saveUninitialized: true,
    store: memoryStore,
}));
app.use(keycloak.middleware());
app.use('/images', express_1.default.static(path.join(__dirname, '../transports')));
const PORT = process.env.PORT || 3004;
const eurekaHelper = require('./eureka-helper');
app.listen(PORT, () => {
    console.log("transport-server on 3004");
});
eurekaHelper.registerWithEureka('transport-server', PORT);
app.use(body_parser_1.default.json());
const uri = "mongodb://127.0.0.1:27017/Flyware";
mongoose_1.default.connect(uri, (err) => {
    if (err)
        console.log(err);
    else
        console.log("Mongo Database connected successfully");
});
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'transports');
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}_${file.originalname}`);
    },
});
const upload = multer({ storage: storage }).single('imagePath');
app.post('/transports', upload, (req, res) => {
    var _a, _b;
    console.log((_a = req.file) === null || _a === void 0 ? void 0 : _a.filename);
    const { mark, location, nbPerson, nbLuggage, price } = req.body;
    const imagePath = 'http://localhost:3004/images/' + ((_b = req.file) === null || _b === void 0 ? void 0 : _b.filename);
    const newTransport = new transport_model_1.default({
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
app.get("/transports", (req, resp) => __awaiter(void 0, void 0, void 0, function* () {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.size) || 10;
    const filter = {};
    const minPrice = parseInt(req.query.minPrice);
    const maxPrice = parseInt(req.query.maxPrice);
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
            filter.price = Object.assign(Object.assign({}, filter.price), { $lte: maxPrice });
        }
        const options = {
            page: page,
            limit: pageSize
        };
        const query = transport_model_1.default.find(filter);
        transport_model_1.default.paginate(query, options, (err, result) => {
            if (err) {
                resp.status(500).send(err);
            }
            else {
                console.log('Pagination Result:', result);
                resp.send(result);
            }
        });
    }
    catch (err) {
        resp.status(500).json({ message: 'Error fetching transports', error: err });
    }
}));
app.get("/transportsList", keycloak.protect('realm:admin'), (req, resp) => {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.size) || 10;
    transport_model_1.default.paginate("", { page: page, limit: pageSize }, (err, result) => {
        if (err) {
            resp.status(500).send(err);
        }
        else {
            resp.send(result);
        }
    });
});
app.get("/transports/:id", (req, resp) => {
    transport_model_1.default.findById(req.params.id, (err, tranport) => {
        if (err)
            resp.status(500).send(err);
        else
            resp.send(tranport);
    });
});
app.put("/transports/:id", upload, (req, resp) => {
    const transportId = req.params.id;
    const updateObject = {};
    updateObject.mark = req.body.mark;
    updateObject.location = req.body.location;
    updateObject.nbPerson = req.body.nbPerson;
    updateObject.nbLuggage = req.body.nbLuggage;
    updateObject.price = req.body.price;
    if (req.file) {
        updateObject.imagePath = 'http://localhost:3004/images/' + req.file.filename;
    }
    transport_model_1.default.findByIdAndUpdate(transportId, { $set: updateObject }, (err, updatedFlight) => {
        if (err) {
            console.error(err);
            resp.status(500).json({ error: "Internal Server Error" });
        }
        else {
            resp.json(updateObject);
        }
    });
});
app.delete("/transports/:id", (req, resp) => {
    transport_model_1.default.findByIdAndDelete(req.params.id, req.body, (err) => {
        if (err) {
            console.error(err);
            resp.status(500).json({ error: "Internal Server Error" });
        }
        else {
            resp.json({ message: "Transport deleted successfully" });
        }
    });
});
app.get("/mark", (req, res) => {
    transport_model_1.default.distinct("mark", (err, mark) => {
        if (err) {
            res.status(500).send(err);
        }
        else {
            res.json(mark);
        }
    });
});
app.get("/location", (req, res) => {
    transport_model_1.default.distinct("location", (err, location) => {
        if (err) {
            res.status(500).send(err);
        }
        else {
            res.json(location);
        }
    });
});
app.get("/", (req, resp) => {
    resp.send("Transport Server");
});
