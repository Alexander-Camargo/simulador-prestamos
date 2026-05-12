const express = require('express');
const path = require('path');
const cors = require('cors');
// 1. Importamos la librería que instalaste
const { CosmosClient } = require("@azure/cosmos");

const app = express();
const PORT = process.env.PORT || 8080; 

// 2. Configuración de conexión a Azure
// Usamos la variable de entorno que configuramos en el portal de Azure
const client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const databaseId = "SimuladorDB";
const containerId = "Historial";

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- RUTAS DE LA API CON COSMOS DB ---

// 1. Obtener todos los préstamos (desde la nube)
app.get('/api/prestamos', async (req, res) => {
  try {
    const { database } = await client.databases.createIfNotExists({ id: databaseId });
    const { container } = await database.containers.createIfNotExists({ id: containerId });
    
    const { resources: items } = await container.items.readAll().fetchAll();
    res.json(items);
  } catch (error) {
    res.status(500).send("Error al obtener datos: " + error.message);
  }
});

// 2. Guardar un nuevo préstamo (en la nube)
app.post('/api/prestamos', async (req, res) => {
  try {
    const { database } = await client.databases.createIfNotExists({ id: databaseId });
    const { container } = await database.containers.createIfNotExists({ id: containerId });
    
    const nuevoPrestamo = req.body;
    // Cosmos DB necesita un ID único por ítem, si el front no lo manda, lo creamos
    if (!nuevoPrestamo.id) nuevoPrestamo.id = Date.now().toString();

    const { resource: createdItem } = await container.items.create(nuevoPrestamo);
    res.status(201).json(createdItem);
  } catch (error) {
    res.status(500).send("Error al guardar: " + error.message);
  }
});

// 3. Eliminar un préstamo
app.delete('/api/prestamos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { database } = await client.databases.createIfNotExists({ id: databaseId });
    const { container } = await database.containers.createIfNotExists({ id: containerId });

    await container.item(id, id).delete(); // En NoSQL se suele usar el ID como Partition Key
    res.status(204).send();
  } catch (error) {
    res.status(500).send("Error al eliminar: " + error.message);
  }
});

// --- MANEJO DEL FRONTEND ---
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor listo en el puerto ${PORT}`);
  if (process.env.COSMOS_CONNECTION_STRING) {
    console.log("¡Conexión configurada con Azure Cosmos DB!");
  } else {
    console.warn("Advertencia: No se detectó la variable de entorno COSMOS_CONNECTION_STRING");
  }
});