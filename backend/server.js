const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
// Azure usa el puerto 8080 por defecto en contenedores
const PORT = process.env.PORT || 8080; 

app.use(cors());
app.use(express.json());

// Servir archivos estáticos de React (la carpeta public se llenará al crear el Docker)
app.use(express.static(path.join(__dirname, 'public')));

// "Base de Datos" temporal en memoria
let prestamosDB = [];

// --- RUTAS DE LA API ---

// 1. Obtener todos los préstamos
app.get('/api/prestamos', (req, res) => {
  res.json(prestamosDB);
});

// 2. Guardar un nuevo préstamo
app.post('/api/prestamos', (req, res) => {
  const nuevoPrestamo = req.body;
  prestamosDB.unshift(nuevoPrestamo); // Guardar al inicio
  res.status(201).json(nuevoPrestamo);
});

// 3. Eliminar un préstamo por ID
app.delete('/api/prestamos/:id', (req, res) => {
  const { id } = req.params;
  prestamosDB = prestamosDB.filter(p => p.id !== id);
  res.status(204).send();
});

// --- MANEJO DEL FRONTEND ---
// Si el usuario entra a cualquier otra ruta, le enviamos el index.html de React
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor listo en el puerto ${PORT}`);
});