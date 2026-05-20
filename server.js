//Server.js
const express = require('express');
const cors = require('cors')
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

//Middleware
app.use(cors());
app.use(express.json());

//Importación de rutas
const authRoutes = require('./routes/auth');
const usuariosRoutes = require('./routes/usuarios');
const router = require('./routes/auth');

//Usar rutas
app.use('/api/auth', authRoutes)
app.use('/api/usuarios', usuariosRoutes)
app.use('/api/especialidades', require('./routes/especialidades'));
 feature/modulo-usuarios
app.use('/api/usuarios', require('routes/usuarios'));
 app.use('/api/pacientes', require('./routes/pacientes'));
 main

//Ruta de ejemplo
app.get('/', (req, res) => {
    res.send('Hola desde el servidor express!');
});

//iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor corriendo en el puerto ${port}`);
});