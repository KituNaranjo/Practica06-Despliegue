import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { connectDatabase } from './config/database.js';
import { createEmpleadosRouter } from './routes/empleados.routes.js';
import { EmpleadosController } from './controllers/empleados.controllers.js';
import { EmployeeMongoRepository } from './repositories/employee.mongo.repository.js';
import { errorMiddleware } from './middlewares/error.middleware.js';

const app = express();
const port = 3000;

connectDatabase();

// Composition Root: único lugar donde se conecta la implementación concreta (Mongo)
const empleadosController = new EmpleadosController(new EmployeeMongoRepository());

app.use(morgan('dev'));
app.use(express.json());
app.use(cors());
app.use('/api/v1', createEmpleadosRouter(empleadosController));

app.use(errorMiddleware);

app.listen(port, () => {
  console.log('Servidor escuchando en el puerto ' + port);
});
