const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('../utils/auth');
const { verifyToken } = require('../utils/auth');


// metodo get unico
router.get('/:id', verifyToken, (req, res) => {
    const { id } = req.params; // captura el id del registro
    // consulta para obtener un unicpo registro
    const query = 'SELECT * FROM pacientes WHERE idpaciente = ?';
    db.query(query, [id], (error, results) => {
        if (error) { //error en la base de datos o en la consulta
            console.error(error);
            return res.status(500).json({ error: 'Error al obtener el paciente' })
        }

        if (results.length === 0) { //si no se encuentra el usuario
            return res.status(404).json({ messaje: 'Paciente no encontrado' })
        }
        // si se encuentra devuelve los datos
        res.json(results[0]);
    });

});

// metodos get multiples registros
router.get('/', verifyToken, (req, res) => {
    const page = parseInt(req.query.page) || 1; //pagina actual
    const limit = parseInt(req.query.limit) || 10; //numero de registros por pagina
    const offset = (page - 1) * limit; // punto de inicio de la consulta 
    const string = req.query.string;
    let whereClause = '';
    let queryParams = [];
    if (string) {
        whereClause = 'where direccion_pac like ? or telefono_pac like ? ';
        const searchTerm = `%${string}%`;
        queryParams.push(searchTerm, searchTerm);
    }
    //consulta para obtener total de registros
    const countQuery = `select count(*) as total from pacientes ${whereClause}`;
    db.query(countQuery, queryParams, (err, countResult) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error al obtener total de pacientes' });
        }
        const totalpacientes = countResult[0].total;
        const totalPages = Math.ceil(totalpacientes / limit);
        //consulta para obtener los registros de la página
        const pacientesQuery = `select * from pacientes ${whereClause} LIMIT ? OFFSET ?`;
        queryParams.push(limit, offset);
        db.query(pacientesQuery, queryParams, (err, pacientesResult) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Error al obtener los pacientes' });
            }
            //Enviar respuesta con los datos y la información de paginación
            res.json({
                totalItems: totalpacientes,
                totalPage: totalPages,
                currentPage: page,
                limit: limit,
                data: pacientesResult
            });
        });
    });

});

//metodo post
router.post('/', verifyToken, (req, res) => {

    //1obtener los datos del cuerpo de la peticion
    const { direccion_pac, telefono_pac, fk_idusuario } = req.body;
    //2definir una consulta sql para instertar
    const query = 'INSERT INTO pacientes (direccion_pac, telefono_pac, fk_idusuario) VALUES (?, ?, ?)';
    //3 creat un arreglo con los valores de una constante 
    const values = [direccion_pac, telefono_pac, fk_idusuario];
    //4 egecutar la consulta
    db.query(query, values, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error al guardara paciente' });
        }
        res.status(201).json({
            messaje: 'usuario registrado con exito',
            idpaciente: results.insertId
        });
    });
});
// metodo put
router.put('/:id', verifyToken, (req, res) => {
    // obtener el id del usuario
    const { id } = req.params;
    //  2 obtener los datos del cuerpo de la peticion
    const { direccion_pac, telefono_pac } = req.body;
    // 3 definir una consulta sql para instertar
    const query = 'UPDATE pacientes SET direccion_pac = ?, telefono_pac = ? WHERE idpaciente = ?';
    // 4 crear un arreglo  con los valoleres de la consulta
    const values = [direccion_pac, telefono_pac, id];
    //5 ejecurtar la consulta
    db.query(query, values, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error al editar el paciente' });
        }
        res.status(200).json({
            messaje: 'usuario editado con exito',
            idpaciente: id
        });
    });
});

// metodo delete
router.delete('/:id', verifyToken, (req, res) => {
    const { id } = req.params;

    // 1. Contar registros dependientes
    const countQuery = `
        SELECT 
            (SELECT COUNT(*) FROM ingresos WHERE fk_idpaciente = ?) AS total_ingresos,
            (SELECT COUNT(*) FROM diagnosticos WHERE fk_idingreso IN (
                SELECT idingreso FROM ingresos WHERE fk_idpaciente = ?
            )) AS total_diagnosticos
    `;

    db.query(countQuery, [id, id], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error interno del servidor' });
        }

        const { total_ingresos, total_diagnosticos } = results[0];

        if (total_ingresos > 0 || total_diagnosticos > 0) {
            return res.status(409).json({
                message: 'El paciente tiene registros dependientes, no se puede eliminar',
                total_ingresos,
                total_diagnosticos
            });
        }

        // 2. Obtener fk_idusuario antes de eliminar
        const getUserQuery = 'SELECT fk_idusuario FROM pacientes WHERE idpaciente = ?';
        db.query(getUserQuery, [id], (err, results) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Error interno del servidor' });
            }

            if (results.length === 0) {
                return res.status(404).json({ message: 'Paciente no encontrado' });
            }

            

            // 3. Eliminar paciente (hijo)
            const deletePaciente = 'DELETE FROM pacientes WHERE idpaciente = ?';
            db.query(deletePaciente, [id], (err) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ error: 'Error al eliminar el paciente' });
                }

                // 4. Eliminar usuario (padre)
                const deleteUsuario = 'DELETE FROM usuarios WHERE idusuario = ?';
                db.query(deleteUsuario, [id], (err, result) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).json({ error: 'Error al eliminar el paciente' });
                    }

                    res.status(200).json({
                        message: 'Paciente eliminado con éxito',
                        idpaciente: id
                    });
                });
            });
        });
    });
});


    module.exports = router;