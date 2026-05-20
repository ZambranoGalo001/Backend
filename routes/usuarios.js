const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../utils/auth');
const bcrypt = require('bcrypt');

//Metodo GET ÚNICO
router.get('/:id', verifyToken, (req, res) => {
    const { id } = req.params;
    //Consulta para obtener un único registro
    const query = 'select * from usuarios where idusuario = ?';
    db.query(query, [id], (err, results) => {
        if (err) {//Error en la base de datos o la consulta
            console.error(err);
            return res.status(500).json({ error: 'Error al obtener el usuario' })
        }

        if (results.length === 0) {//Si no se encuentra el usuario
            return res.status(404).json({ error: 'Usuario no encontrado' })
        }
        //si se encuentra devuelve los datos
        res.json(results[0]);
    });
});

//metodo GET multiples registros
router.get('/', verifyToken, (req, res) => {
    const page = parseInt(req.query.page) || 1;//Pagina actual
    const limit = parseInt(req.query.limit) || 10;//Limite de registros por página
    const offset = (page - 1) * limit;//Punto de inicio de la consulta
    const string = req.query.string;
    let whereClause = '';
    let queryParams = [];
    if (string) {
        whereClause = 'where cedula like ? or nombre like ? or apellido like ?';
        const searchTerm = `%${string}%`;
        queryParams.push(searchTerm, searchTerm, searchTerm);
    }
    //consulta para obtener total de registros
    const countQuery = `select count(*) as total from usuarios ${whereClause}`;
    db.query(countQuery, queryParams, (err, countResult) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error al obtener total de usuarios' });
        }
        const totalUsuarios = countResult[0].total;
        const totalPages = Math.ceil(totalUsuarios / limit);
        //consulta para obtener los registros de la página
        const usuariosQuery = `select * from usuarios ${whereClause} LIMIT ? OFFSET ?`;
        queryParams.push(limit, offset);
        db.query(usuariosQuery, queryParams, (err, usuariosResult) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Error al obtener los usuarios' });
            }
            //Enviar respuesta con los datos y la información de paginación
            res.json({
                totalItems: totalUsuarios,
                totalPage: totalPages,
                currentPage: page,
                limit: limit,
                data: usuariosResult
            });
        });
    });
});

//Método insertar
router.post('/', verifyToken, async (req, res) => {
    //1ro Obtener los datos del puerto de la peticion
    const { correo, password, rol, cedula, nombre, apellido, fecha_nacimiento } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 12);
        //2do Definir una consulta SQL para insertar
        const query = 'insert into usuarios (correo,password,rol,cedula,nombre,apellido,fecha_nacimiento) values (?,?,?,?,?,?,?)';
        //3er Crear un arreglo con los valores de la consulta
        const values = [correo, hashedPassword, rol, cedula, nombre, apellido, fecha_nacimiento]
        //4to Ejecutar la consulta
        db.query(query, values, (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Error al guardar usuarios' });
            }
            res.json({
                message: 'Usuario registrado correctamente',
                idusuario: result.insertId
            });
        });
    } catch (error) {
        res.status(500).json({ error: "Error al encriptar la contraseña"});
    }
})

//Método put
router.put('/:id', verifyToken, (req, res) => {
    //1ro Obtener el id del usuario desde parámetro de la url
    const { id } = req.params;
    //2do Obtener los datos del cuerpo de la peticion
    const { correo, password, rol, cedula, nombre, apellido, fecha_nacimiento } = req.body;
    //3ro Definir una consulta SQL para insertar
    const query = 'update usuarios set correo = ?, password = ?, rol = ?, cedula = ?, nombre = ?, apellido = ?, fecha_nacimiento = ? where idusuario = ?';
    //4to Crear un arreglo con los valores de la consulta
    const values = [correo, password, rol, cedula, nombre, apellido, fecha_nacimiento, id]
    //5to Ejecutar la consulta
    db.query(query, values, (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error al actualizar usuarios' });
        }
        res.json({
            message: 'Usuario actualizado correctamente',
            idusuario: id
        });
    });
});

//Método delete con verificación completa de dependencias
router.delete('/:id', verifyToken, (req, res) => {
    const { id } = req.params;

    // 1. Verificar si el usuario existe
    const VerificarQuery = 'SELECT COUNT(*) AS total_usuarios FROM usuarios WHERE idusuario = ?';
    db.query(VerificarQuery, [id], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error al contar usuarios' });
        }
        if (result[0].total_usuarios === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // 2. Verificar dependencias en todas las tablas relacionadas
        const DependenciasQuery = `
            SELECT 
                (SELECT COUNT(*) FROM pacientes WHERE fk_idusuario = ?) AS pacientes,
                (SELECT COUNT(*) FROM medicos WHERE fk_idusuario = ?) AS medicos,
                (SELECT COUNT(*) FROM ingresos WHERE fk_idpaciente IN (SELECT idpaciente FROM pacientes WHERE fk_idusuario = ?)) AS ingresos,
                (SELECT COUNT(*) FROM diagnosticos WHERE fk_idingreso IN (SELECT idingreso FROM ingresos WHERE fk_idpaciente IN (SELECT idpaciente FROM pacientes WHERE fk_idusuario = ?))) AS diagnosticos,
                (SELECT COUNT(*) FROM recetas WHERE fk_iddiagnostico IN (SELECT iddiagnostico FROM diagnosticos WHERE fk_idingreso IN (SELECT idingreso FROM ingresos WHERE fk_idpaciente IN (SELECT idpaciente FROM pacientes WHERE fk_idusuario = ?)))) AS recetas
        `;
        db.query(DependenciasQuery, [id, id, id, id, id], (err, deps) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Error al verificar dependencias' });
            }

            if (
                deps[0].pacientes > 0 ||
                deps[0].medicos > 0 ||
                deps[0].ingresos > 0 ||
                deps[0].diagnosticos > 0 ||
                deps[0].recetas > 0
            ) {
                return res.status(400).json({
                    error: 'No se puede eliminar el usuario porque tiene dependencias en otras tablas'
                });
            }

            // 3. Eliminar usuario si no tiene dependencias
            const DeleteQuery = 'DELETE FROM usuarios WHERE idusuario = ?';
            db.query(DeleteQuery, [id], (err, result) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ error: 'Error al eliminar usuario' });
                }
                res.json({
                    message: 'Usuario eliminado correctamente :D',
                    idusuario: id
                });
            });
        });
    });
});


module.exports = router;