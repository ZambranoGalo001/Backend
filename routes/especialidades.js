const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifytoken } = require('../utils/auth');

// Método GET múltiples registros (Paginación)
router.get('/', verifytoken, (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const string = req.query.string;
    let whereClause = '';
    let queryParams = [];

    if (string) {
        whereClause = 'where nombre_especialidad like ? or descripcion_especialidad like ?';
        const searchTerm = `%${string}%`;
        queryParams.push(searchTerm, searchTerm);
    }

    const countQuery = `select count(*) as total from especialidades ${whereClause}`;
    db.query(countQuery, queryParams, (err, countResult) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error al obtener total de especialidades' });
        }
        const totalEspecialidades = countResult[0].total;
        const totalPages = Math.ceil(totalEspecialidades / limit);

        const especialidadesQuery = `select * from especialidades ${whereClause} LIMIT ? OFFSET ?`;
        const finalParams = [...queryParams, limit, offset]; // Copiamos params para no alterar el original
        
        db.query(especialidadesQuery, finalParams, (err, especialidadesResult) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Error al obtener las especialidades' });
            }
            res.json({
                totalItems: totalEspecialidades,
                totalPage: totalPages,
                currentPage: page,
                limit: limit,
                data: especialidadesResult
            });
        });
    });
});

// Metodo GET UNICO
router.get('/:id', verifytoken, (req, res) => {
    const { id } = req.params;
    const query = 'SELECT * FROM especialidades WHERE idespecialidad = ?';
    db.query(query, [id], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error al obtener la especialidad' });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: 'Especialidad no encontrada.' });
        }
        res.json(results[0]);
    });
});

// Método POST
router.post('/', verifytoken, (req, res) => {
    const { nombre_especialidad, descripcion_especialidad } = req.body;
    const query = 'insert into especialidades (nombre_especialidad, descripcion_especialidad) values (?, ?)';
    db.query(query, [nombre_especialidad, descripcion_especialidad], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error al guardar las especialidades' });
        }
        res.json({
            message: 'Descripción registrada exitosamente',
            iddespecialidad: result.insertId
        });
    });
});

// Método PUT
router.put('/:id', verifytoken, (req, res) => {
    const { id } = req.params;
    const { nombre_especialidad, descripcion_especialidad } = req.body;
    const query = 'update especialidades set nombre_especialidad = ?, descripcion_especialidad = ? where idespecialidad = ?';
    db.query(query, [nombre_especialidad, descripcion_especialidad, id], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error al actualizar las especialidades' });
        }
        res.json({
            message: 'Descripción actualizada exitosamente',
            iddespecialidad: id
        });
    });
});

// --- MÉTODO DELETE CORREGIDO ---
router.delete('/:id', verifytoken, (req, res) => {
    const { id } = req.params;

    // Usamos subconsultas para validar existencia y dependencias en un solo paso
    const validar_query = `
        SELECT 
            (SELECT COUNT(*) FROM medicos WHERE fk_idespecialidad = ?) AS total_medicos, 
            (SELECT COUNT(*) FROM especialidades WHERE idespecialidad = ?) AS existe_especialidad
    `;

    db.query(validar_query, [id, id], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error al validar dependencias' });
        }

        const { total_medicos, existe_especialidad } = result[0];

        // Validación 1: ¿Existe el registro?
        if (existe_especialidad === 0) {
            return res.status(404).json({ error: 'Especialidad no encontrada' });
        }

        // Validación 2: ¿Tiene médicos asociados?
        if (total_medicos > 0) {
            return res.status(409).json({ error: 'No se puede eliminar: tiene médicos relacionados' });
        }

        // 3. Si todo está bien, procedemos a borrar
        const delete_query = 'DELETE FROM especialidades WHERE idespecialidad = ?';
        db.query(delete_query, [id], (err, deleteResult) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Error al eliminar la especialidad' });
            }

            res.json({
                message: 'Especialidad eliminada exitosamente',
                iddespecialidad: id
            });
        });
    });
});

module.exports = router;