const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');
const { generateToken } = require('../utils/auth');

//Función de autenticación
router.post('/login', (req, res) => {
    const { cedula, password } = req.body;

    //buscar el usuario en la BDD
    db.query("SELECT * FROM usuarios WHERE cedula = ?", [cedula], async (err, results) => {
        if(err) throw err;
        if (results.length === 0){
            return res.status(401).json({ message: 'cedula o contraseña invalida' });
        };
        const user = results[0];

        //Comparar la contraseña encriptada
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if(!isPasswordValid) {
            return res.status(401).json({ message: 'cedula o contraseña invalida' });
        };

        //Si la contraseña es válida, genera un token y lo envía
        const token = generateToken({id: user.idusuario, cedula: user.cedula});
        res.json({ message: 'Inicio de sesión exitoso', idusuario: user.idusuario, cedula: user.cedula, token});

    });
})

module.exports = router;