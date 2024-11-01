const express = require('express');
const cors = require('cors');
const multer = require('multer');
const mysql = require('mysql');
const dotenv = require("dotenv");
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require("bcryptjs");
const XlsxPopulate = require('xlsx-populate');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: './db.env' });

const app = express();

// Crear el directorio `public` si no existe
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir);
}

const storage = multer.diskStorage({
  filename: function (req, file, cb) {
    const ext = file.originalname.split(".").pop();
    const fileName = Date.now();
    cb(null, `${fileName}.${ext}`);
  },
  destination: function (req, file, cb) {
    cb(null, publicDir);
  },
});

const upload = multer({ storage: storage });

app.use(bodyParser.json());
app.use(cors());

const port = process.env.PORT || 3000;

const dbConfig = {
  host: process.env.host,
  user: process.env.user,
  password: process.env.password,
  database: process.env.database,
  connectionLimit: 10,
};

const pool = mysql.createPool(dbConfig);

pool.on('connection', (connection) => {
  console.log('New connection established with ID:', connection.threadId);
});

pool.on('acquire', (connection) => {
  console.log('Connection %d acquired', connection.threadId);
});

pool.on('release', (connection) => {
  console.log('Connection %d released', connection.threadId);
});

pool.on('error', (err) => {
  console.error('MySQL error: ', err);
});

function handleDisconnect() {
  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting connection: ', err);
      setTimeout(handleDisconnect, 2000);
    } else {
      connection.release();
      console.log('MySQL connected');
    }
  });
}

handleDisconnect();

app.post('/upload/excel', upload.single('myFile'), async (req, res) => {
  const baseDeDatos = req.body.tableName;
  const tableName = `baseDeDatos_${baseDeDatos}`;

  const filePath = path.join(publicDir, req.file.filename);
  try {
    const workbook = await XlsxPopulate.fromFileAsync(filePath);
    const sheet = workbook.sheet(0);
    const usedRange = sheet.usedRange();
    const data = usedRange.value();
    const headers = data[0].map(header => `\`${header}\``);

    const tableSchema = `
      id INT AUTO_INCREMENT PRIMARY KEY,
      marca VARCHAR(255),
      rank VARCHAR(255),
      presentacion VARCHAR(255),
      distribucion_tiendas VARCHAR(255),
      frentes VARCHAR(255),
      vol_ytd FLOAT,
      ccc VARCHAR(255),
      peakday_units FLOAT,
      facings_minimos_pd FLOAT,
      ros FLOAT,
      avail3m FLOAT,
      avail_plaza_oxxo FLOAT,
      volume_mix VARCHAR(255),
      industry_packtype VARCHAR(255),
      percent_availab FLOAT,
      mix_ros FLOAT,
      atw FLOAT,
      ajustes_frentes_minimos FLOAT
    `;

    const tableExistsQuery = `SHOW TABLES LIKE '${tableName}'`;
    const tableExists = await new Promise((resolve, reject) => {
      pool.query(tableExistsQuery, (err, results) => {
        if (err) {
          reject(err);
        } else {
          resolve(results.length > 0);
        }
      });
    });

    if (!tableExists) {
      const createTableQuery = `CREATE TABLE ${tableName} (${tableSchema})`;
      await new Promise((resolve, reject) => {
        pool.query(createTableQuery, (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });

      const insertDatabaseNameQuery = `INSERT INTO bases_datos (nombre_base_datos) VALUES (?)`;
      await new Promise((resolve, reject) => {
        pool.query(insertDatabaseNameQuery, [baseDeDatos], (err, result) => {
          if (err) {
            console.error('Error inserting database name:', err);
            reject(err);
          } else {
            console.log('Database name inserted');
            resolve(result);
          }
        });
      });
    }

    await new Promise((resolve, reject) => {
      pool.query(`DELETE FROM ${tableName}`, (err, result) => {
        if (err) {
          console.error('Error deleting existing records:', err);
          reject(err);
        } else {
          console.log('Existing records deleted');
          resolve(result);
        }
      });
    });

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const query = `INSERT INTO ${tableName} (${headers.join(", ")}) VALUES (${row.map(() => "?").join(", ")})`;
      await new Promise((resolve, reject) => {
        pool.query(query, row, (err, result) => {
          if (err) {
            console.error(`Error inserting row ${i}:`, err);
            reject(err);
          } else {
            resolve(result);
          }
        });
      });
    }

    res.status(200).send('File processed successfully');
  } catch (error) {
    console.error('Error processing file:', error);
    res.status(500).send('Error processing file');
  }
});

app.post('/upload/excel/planograma', upload.single('myFile'), async (req, res) => {
  const baseDeDatos = req.body.tableName;
  const tableName = `planograma_${baseDeDatos}`;

  const filePath = path.join(publicDir, req.file.filename);
  try {
    const workbook = await XlsxPopulate.fromFileAsync(filePath);
    const sheet = workbook.sheet(0);
    const usedRange = sheet.usedRange();
    const data = usedRange.value();
    const headers = data[0].map(header => `\`${header}\``);

    const tableSchema = `
      id INT AUTO_INCREMENT PRIMARY KEY,
      frente FLOAT,
      datos_planograma FLOAT,
      frentes_totales FLOAT,
      parrillas FLOAT,
      planograma FLOAT,
      skus FLOAT,
      volumen FLOAT,
      parrillas_admin FLOAT,
      degradado FLOAT,
      espacio FLOAT
    `;

    const tableExistsQuery = `SHOW TABLES LIKE '${tableName}'`;
    const tableExists = await new Promise((resolve, reject) => {
      pool.query(tableExistsQuery, (err, results) => {
        if (err) {
          reject(err);
        } else {
          resolve(results.length > 0);
        }
      });
    });

    if (!tableExists) {
      const createTableQuery = `CREATE TABLE ${tableName} (${tableSchema})`;
      await new Promise((resolve, reject) => {
        pool.query(createTableQuery, (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });

      const insertDatabaseNameQuery = `INSERT INTO bases_planograma (nombre_planograma) VALUES (?)`;
      await new Promise((resolve, reject) => {
        pool.query(insertDatabaseNameQuery, [baseDeDatos], (err, result) => {
          if (err) {
            console.error('Error inserting database name:', err);
            reject(err);
          } else {
            console.log('Database name inserted');
            resolve(result);
          }
        });
      });
    }

    await new Promise((resolve, reject) => {
      pool.query(`DELETE FROM ${tableName}`, (err, result) => {
        if (err) {
          console.error('Error deleting existing records:', err);
          reject(err);
        } else {
          console.log('Existing records deleted');
          resolve(result);
        }
      });
    });

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const query = `INSERT INTO ${tableName} (${headers.join(", ")}) VALUES (${row.map(() => "?").join(", ")})`;
      await new Promise((resolve, reject) => {
        pool.query(query, row, (err, result) => {
          if (err) {
            console.error(`Error inserting row ${i}:`, err);
            reject(err);
          } else {
            resolve(result);
          }
        });
      });
    }

    res.status(200).send('File processed successfully');
  } catch (error) {
    console.error('Error processing file:', error);
    res.status(500).send('Error processing file');
  }
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;

  pool.getConnection((err, connection) => {
    if (err) return res.status(500).send(err);
    connection.query('SELECT * FROM usuarios WHERE nombre = ? or email = ?', [username, username], async (err, results) => {
      connection.release();
      if (err) return res.status(500).send(err);
      if (!results.length || !(await bcrypt.compare(password, results[0].password))) {
        return res.status(401).send('Nombre de usuario o contraseña incorrecta');
      }
      if (results[0].rol !== 'user') {
        return res.status(403).send('Acceso denegado');
      }
      const token = jwt.sign({ id: results[0].id, rol: results[0].rol }, 'secretkey', { expiresIn: '74h' });
      res.status(200).send({ token });
    });
  });
});

app.get('/bases-datos', (req, res) => {
  const query = "SELECT nombre_base_datos FROM bases_datos WHERE nombre_base_datos != 'created'";

  pool.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching databases:', err);
      res.status(500).send('Error fetching databases');
    } else {
      res.status(200).json(results);
    }
  });
});

app.get('/planogramas', (req, res) => {
  const query = 'SELECT nombre_planograma FROM bases_planograma';

  pool.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching planograms:', err);
      res.status(500).send('Error fetching planograms');
    } else {
      res.status(200).json(results);
    }
  });
});

app.get('/datosUser/:base/:username', (req, res) => {
  const {base, username} = req.params;
  const tableName = `${username}_${base}`;

  const query = `SELECT * FROM ??`;
  pool.query(query, [tableName], (err, results) => {
    if (err) {
      console.error(`Error fetching data from ${tableName}:`, err);
      res.status(500).send(`Error fetching data from ${tableName}`);
    } else {
      res.status(200).json(results);
    }
  });
});

app.get('/datos/:base', (req, res) => {
  const base = req.params.base;
  const tableName = `baseDeDatos_${base}`;

  const query = `SELECT * FROM ??`;
  pool.query(query, [tableName], (err, results) => {
    if (err) {
      console.error(`Error fetching data from ${tableName}:`, err);
      res.status(500).send(`Error fetching data from ${tableName}`);
    } else {
      res.status(200).json(results);
    }
  });
});

app.get('/datosPlanograma/:planograma', (req, res) => {
  const planograma = req.params.planograma;
  const tableName = `planograma_${planograma}`;

  const query = `SELECT * FROM ??`;
  pool.query(query, [tableName], (err, results) => {
    if (err) {
      console.error(`Error fetching data from ${tableName}:`, err);
      res.status(500).send(`Error fetching data from ${tableName}`);
    } else {
      res.status(200).json(results);
    }
  });
});

app.get('/datosFrentesTotalesUser/planogramas/:planograma', (req, res) => {
  const planograma = req.params.planograma;
  const tableName = `planograma_${planograma}`;

  const query = `SELECT frentes_totales FROM ??`;
  pool.query(query, [tableName], (err, results) => {
    if (err) {
      console.error(`Error fetching data from ${tableName}:`, err);
      res.status(500).send(`Error fetching data from ${tableName}`);
    } else {
      res.status(200).json(results);
    }
  });
});

app.get('/datosDegradadoUser/degradados/:planograma', (req, res) => {
  const planograma = req.params.planograma;
  const tableName = `planograma_${planograma}`;

  const query = `SELECT degradado FROM ??`;
  pool.query(query, [tableName], (err, results) => {
    if (err) {
      console.error(`Error fetching data from ${tableName}:`, err);
      res.status(500).send(`Error fetching data from ${tableName}`);
    } else {
      res.status(200).json(results);
    }
  });
});

app.get('/datosFrentesUser/frentes/:planograma', (req, res) => {
  const planograma = req.params.planograma;
  const tableName = `planograma_${planograma}`;

  const query = `SELECT frente FROM ??`;
  pool.query(query, [tableName], (err, results) => {
    if (err) {
      console.error(`Error fetching data from ${tableName}:`, err);
      res.status(500).send(`Error fetching data from ${tableName}`);
    } else {
      res.status(200).json(results);
    }
  });
});
app.get('/inventory/:username', (req, res) => {
  const username = req.params.username;
  const userTableName = `inventory_${username}`;

  pool.getConnection((err, connection) => {
    if (err) {
      console.error("Error al obtener conexión de la base de datos: ", err);
      return res.status(500).send({ error: "Error al obtener conexión de la base de datos" });
    }

    connection.query(`DROP TABLE IF EXISTS ??`, [userTableName], (err) => {
      if (err) {
        connection.release();
        console.error("Error al eliminar la tabla: ", err);
        return res.status(500).send({ error: "Error al eliminar la tabla" });
      }

      connection.query(`CREATE TABLE ?? LIKE data`, [userTableName], (err) => {
        if (err) {
          connection.release();
          console.error("Error al crear la tabla: ", err);
          return res.status(500).send({ error: "Error al crear la tabla" });
        }

        connection.query(`INSERT INTO ?? SELECT * FROM data`, [userTableName], (err) => {
          if (err) {
            connection.release();
            console.error("Error al copiar los datos a la nueva tabla: ", err);
            return res.status(500).send({ error: "Error al copiar los datos a la nueva tabla" });
          }

          const sql = `SELECT * FROM ??`;
          connection.query(sql, [userTableName], (err, results) => {
            connection.release();
            if (err) {
              console.error("Error al obtener datos de la base de datos: ", err);
              res.status(500).send({ error: "Error al obtener datos de la base de datos" });
            } else {
              res.send(results);
            }
          });
        });
      });
    });
  });
});
// Editar base de datos como admin
app.put('/inventory/:base/:rank', (req, res) => {
  const { base, rank } = req.params;
  const updatedData = req.body;
  const tableName = `baseDeDatos_${base}`;

  if (!rank) {
    console.error('Validation Error: Rank is required');
    return res.status(400).send('Rank is required');
  }

  if (!updatedData || Object.keys(updatedData).length === 0) {
    console.error('Validation Error: No data provided to update');
    return res.status(400).send('No data provided to update');
  }

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Database Connection Error:', err);
      return res.status(500).send('Database Connection Error');
    }

    const fields = Object.keys(updatedData).map(field => `${field} = ?`).join(', ');
    const values = Object.values(updatedData);
    values.push(rank);

    const query = `UPDATE ${tableName} SET ${fields} WHERE rank = ?`;

    connection.query(query, values, (err, results) => {
      connection.release();
      if (err) {
        console.error('Error executing query:', err);
        return res.status(500).send('Error executing query');
      }

      if (results.affectedRows === 0) {
        return res.status(404).send('Item not found');
      }

      res.status(200).send('Item updated successfully');
    });
  });
});
// Eliminar base de datos como admin
app.delete('/inventory/:base/:rank', (req, res) => {
  const { base, rank } = req.params;
  const tableName = `baseDeDatos_${base}`;

  if (!rank) {
    console.error('Validation Error: Rank is required');
    return res.status(400).send('Rank is required');
  }

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Database Connection Error:', err);
      return res.status(500).send('Database Connection Error');
    }

    const query = `DELETE FROM ${tableName} WHERE rank = ?`;

    connection.query(query, [rank], (err, results) => {
      connection.release();
      if (err) {
        console.error('Error executing query:', err);
        return res.status(500).send('Error executing query');
      }

      if (results.affectedRows === 0) {
        return res.status(404).send('Item not found');
      }

      res.status(200).send('Item deleted successfully');
    });
  });
});
// Editar base de datos como admin
app.put('/planograma/:base/:frente', (req, res) => {
  const { base, frente } = req.params;
  const updatedData = req.body;
  const tableName = `planograma_${base}`;

  if (!frente) {
    console.error('Validation Error: Frente is required');
    return res.status(400).send('Frente is required');
  }

  if (!updatedData || Object.keys(updatedData).length === 0) {
    console.error('Validation Error: No data provided to update');
    return res.status(400).send('No data provided to update');
  }

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Database Connection Error:', err);
      return res.status(500).send('Database Connection Error');
    }

    const fields = Object.keys(updatedData).map(field => `${field} = ?`).join(', ');
    const values = Object.values(updatedData);
    values.push(frente);

    const query = `UPDATE ${tableName} SET ${fields} WHERE frente = ?`;

    connection.query(query, values, (err, results) => {
      connection.release();
      if (err) {
        console.error('Error executing query:', err);
        return res.status(500).send('Error executing query');
      }

      if (results.affectedRows === 0) {
        return res.status(404).send('Item not found');
      }

      res.status(200).send('Item updated successfully');
    });
  });
});
// Eliminar base de datos como admin
app.delete('/planograma/:base/:frente', (req, res) => {
  const { base, frente } = req.params;
  const tableName = `planograma_${base}`;

  if (!frente) {
    console.error('Validation Error: Frente is required');
    return res.status(400).send('Frente is required');
  }

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Database Connection Error:', err);
      return res.status(500).send('Database Connection Error');
    }

    const query = `DELETE FROM ${tableName} WHERE frente = ?`;

    connection.query(query, [frente], (err, results) => {
      connection.release();
      if (err) {
        console.error('Error executing query:', err);
        return res.status(500).send('Error executing query');
      }

      if (results.affectedRows === 0) {
        return res.status(404).send('Item not found');
      }

      res.status(200).send('Item deleted successfully');
    });
  });
});
// Editar base de datos de usuario
app.put('/inventoryUser/:base/:rank/:username', (req, res) => {
  const { base, rank, username } = req.params;
  const updatedData = req.body;
  const tableName = `${username}_${base}`;
  console.log('Datos recibidos:', {
    base,
    rank,
    username,
    updatedData
  });
  if (!rank) {
    console.error('Validation Error: Rank is required');
    return res.status(400).send('Rank is required');
  }

  if (!updatedData || Object.keys(updatedData).length === 0) {
    console.error('Validation Error: No data provided to update');
    return res.status(400).send('No data provided to update');
  }

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Database Connection Error:', err);
      return res.status(500).send('Database Connection Error');
    }

    const fields = Object.keys(updatedData).map(field => `${field} = ?`).join(', ');
    const values = Object.values(updatedData);
    values.push(rank);

    const query = `UPDATE ${tableName} SET ${fields} WHERE rank = ?`;

    connection.query(query, values, (err, results) => {
      connection.release();
      if (err) {
        console.error('Error executing query:', err);
        return res.status(500).send('Error executing query');
      }

      if (results.affectedRows === 0) {
        return res.status(404).send('Item not found');
      }

      res.status(200).send('Item updated successfully');
    });
  });
});

// Punto de venta
app.get('/users', (req, res) => {
  const sql = `SELECT id, username, rol FROM users`;
  pool.getConnection((err, connection) => {
    if (err) return res.status(500).send(err);
    connection.query(sql, (err, results) => {
      connection.release();
      if (err) {
        console.error("Error al obtener datos de la base de datos: ", err);
        res.status(500).send({ error: "Error al obtener datos de la base de datos" });
      } else {
        res.send(results);
      }
    });
  });
});
app.post('/admin', (req, res) => {
  const { username, password } = req.body;

  pool.getConnection((err, connection) => {
    if (err) return res.status(500).send(err);
    connection.query('SELECT * FROM usuarios WHERE nombre = ? or email = ?', [username, username], async (err, results) => {
      connection.release();
      if (err) return res.status(500).send(err);
      if (!results.length || !(await bcrypt.compare(password, results[0].password))) {
        return res.status(401).send('Nombre de usuario o contraseña incorrecta');
      }
      console.log(results[0].rol);

      // Modificar la verificación del rol
      if (results[0].rol !== 'super' && results[0].rol !== 'admin') {
        return res.status(403).send('Acceso denegado');
      }

      const token = jwt.sign({ id: results[0].id, rol: results[0].rol }, 'secretkey', { expiresIn: '8h' });
      res.status(200).send({ token });
    });
  });
});


app.post('/register/admin', async (req, res) => {
  const { nombre, email, password, nombre_negocio, ubicacion, contacto, rol } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  pool.getConnection((err, connection) => {
    if (err) return res.status(500).send(err);

    connection.beginTransaction(err => {
      if (err) {
        connection.release();
        return res.status(500).send(err);
      }
      connection.query('INSERT INTO usuarios (nombre,email,password,nombre_negocio,ubicacion,contacto,rol) VALUES (?, ?, ?, ?, ?, ?, ?)', [nombre, email, hashedPassword, nombre_negocio, ubicacion, contacto , rol], (err, result) => {
        if (err) {
          console.error("Error en la consulta SQL:", err);
          connection.rollback(() => {
              connection.release();
              return res.status(500).send("Error en la base de datos.");
          });
      }else {
          connection.commit(err => {
            if (err) {
              connection.rollback(() => {
                connection.release();
                return res.status(500).send(err);
              });
            } else {
              connection.release();
              res.status(201).send('Administrador registrado correctamente');
            }
          });
        }
      });
    });
  });
});

app.post('/register/user', async (req, res) => {
  const { nombre, email, password, nombre_negocio, ubicacion, contacto, rol } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  pool.getConnection((err, connection) => {
    if (err) return res.status(500).send(err);

    connection.beginTransaction(err => {
      if (err) {
        connection.release();
        return res.status(500).send(err);
      }

      connection.query('INSERT INTO usuarios (nombre,email,password,nombre_negocio,ubicacion,contacto,rol) VALUES (?, ?, ?, ?, ?, ?, ?)', [nombre, email, hashedPassword, nombre_negocio, ubicacion, contacto , rol], (err, result) => {
        if (err) {
          connection.rollback(() => {
            connection.release();
            return res.status(500).send(err);
          });
        } else {
          connection.commit(err => {
            if (err) {
              connection.rollback(() => {
                connection.release();
                return res.status(500).send(err);
              });
            } else {
              connection.release();
              res.status(201).send('Administrador registrado correctamente');
            }
          });
        }
      });
    });
  });
});

app.post('/user/add/database', async (req, res) => {
  const { username, baseDeDatos } = req.body;
  const userDatabases = `${username}_database`;
  const userTableName = `${username}_${baseDeDatos}`;
  const sourceTableName = `baseDeDatos_${baseDeDatos}`;

  pool.getConnection((err, connection) => {
    if (err) return res.status(500).send(err);

    const checkTableExistsQuery = `SHOW TABLES LIKE '${userTableName}'`;
    connection.query(checkTableExistsQuery, (err, results) => {
      if (err) {
        connection.release();
        return res.status(500).send(err);
      }

      if (results.length === 0) {
        // La tabla no existe, crearla copiando la estructura y datos de baseDeDatos_baseDatos
        const createTableQuery = `CREATE TABLE ${userTableName} LIKE ${sourceTableName}`;
        connection.query(createTableQuery, (err) => {
          if (err) {
            connection.release();
            return res.status(500).send(err);
          }

          const copyTableDataQuery = `INSERT INTO ${userTableName} SELECT * FROM ${sourceTableName}`;
          connection.query(copyTableDataQuery, (err) => {
            if (err) {
              connection.release();
              return res.status(500).send(err);
            }

            // Ahora inserta los valores en userDatabases
            connection.query(`INSERT INTO ${userDatabases} (database, planograma) VALUES (?, ?)`, [baseDeDatos, baseDeDatos], (err, result) => {
              connection.release();
              if (err) {
                return res.status(500).send(err);
              }
              res.status(201).send('Base de datos añadida y tabla creada correctamente');
            });
          });
        });
      } else {
        // La tabla ya existe, solo insertar en userDatabases
        connection.query(`INSERT INTO ${userDatabases} (database, planograma) VALUES (?, ?)`, [baseDeDatos, baseDeDatos], (err, result) => {
          connection.release();
          if (err) {
            return res.status(500).send(err);
          }
          res.status(201).send('Base de datos añadida correctamente');
        });
      }
    });
  });
});

app.get('/user/databases/:username', (req, res) => {
  const { username } = req.params;
  const userTableName = `${username}_database`;


  pool.getConnection((err, connection) => {
    if (err) return res.status(500).send(err);

    const getDatabasesQuery = `SELECT * FROM ${userTableName}`;

    connection.query(getDatabasesQuery, (err, results) => {
      if (err) {
        connection.release();
        return res.status(500).send(err);
      } else {
        connection.release();
        res.status(200).json(results);
      }
    });
  });
});

app.post('/admin/create/category', async (req, res) => {
  const { nombreCategoria } = req.body;
  const sourceTableName = 'categorias';

  pool.getConnection((err, connection) => {
    if (err) return res.status(500).send(err);

    const checkTableExistsQuery = `SHOW TABLES LIKE '${sourceTableName}'`;
    connection.query(checkTableExistsQuery, (err, results) => {
      if (err) {
        connection.release();
        return res.status(500).send(err);
      }

      if (results.length === 0) {
        const createTableQuery = `CREATE TABLE ${sourceTableName} (id INT AUTO_INCREMENT PRIMARY KEY, categoria VARCHAR(255) NOT NULL)`;
        connection.query(createTableQuery, (err) => {
          if (err) {
            connection.release();
            return res.status(500).send(err);
          }
          connection.query(`INSERT INTO ${sourceTableName} (categoria) VALUES (?)`, [nombreCategoria], (err, result) => {
            connection.release();
            if (err) {
              return res.status(500).send(err);
            }
            res.status(201).send('Categoría añadida y tabla creada');
          });
        });
      } else {
        connection.query(`INSERT INTO ${sourceTableName} (categoria) VALUES (?)`, [nombreCategoria], (err, result) => {
          connection.release();
          if (err) {
            return res.status(500).send(err);
          }
          res.status(201).send('Categoría añadida');
        });
      }
    });
  });
});

app.get('/admin/get/rol', async (req, res) => {
  const query = "SELECT DISTINCT rol FROM usuarios WHERE rol = 'user' OR rol = 'admin'";

  pool.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching roles:', err);
      res.status(500).send('Error fetching roles');
    } else {
      res.status(200).json(results);
    }
  });
});


app.get('/admin/get/rol/super', async (req, res) => {
  const query = 'SELECT DISTINCT rol FROM usuarios';

  pool.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching categories:', err);
      res.status(500).send('Error fetching categories');
    } else {
      res.status(200).json(results);
    }
  });
});

app.post('/admin/create/product', async (req, res) => {
  const { nombre, precio, categoria, estado } = req.body;
  const sourceTableName = 'productos';

  pool.getConnection((err, connection) => {
    if (err) return res.status(500).send(err);

    const checkTableExistsQuery = `SHOW TABLES LIKE '${sourceTableName}'`;
    connection.query(checkTableExistsQuery, (err, results) => {
      if (err) {
        connection.release();
        return res.status(500).send(err);
      }

      if (results.length === 0) {
        const createTableQuery = `CREATE TABLE ${sourceTableName} (
          id INT AUTO_INCREMENT PRIMARY KEY,
          nombre VARCHAR(255) NOT NULL,
          precio INT NOT NULL,
          categoria VARCHAR(255) NOT NULL,
          estado VARCHAR(255) NOT NULL
        )`;
        connection.query(createTableQuery, (err) => {
          if (err) {
            connection.release();
            return res.status(500).send(err);
          }
          connection.query(`INSERT INTO ${sourceTableName} (nombre, precio, categoria, estado) VALUES (?, ?, ?, ?)`, [nombre, precio, categoria, estado], (err, result) => {
            connection.release();
            if (err) {
              return res.status(500).send(err);
            }
            res.status(201).send('Producto añadido y tabla creada');
          });
        });
      } else {
        connection.query(`INSERT INTO ${sourceTableName} (nombre, precio, categoria, estado) VALUES (?, ?, ?, ?)`, [nombre, precio, categoria, estado], (err, result) => {
          connection.release();
          if (err) {
            return res.status(500).send(err);
          }
          res.status(201).send('Producto añadido');
        });
      }
    });
  });
});

// app.get('/admin/get/products', async (req, res) => {
//   const query = 'SELECT * FROM productos';

//   pool.query(query, (err, results) => {
//     if (err) {
//       console.error('Error fetching categories:', err);
//       res.status(500).send('Error fetching categories');
//     } else {
//       res.status(200).json(results);
//     }
//   });
// });

app.get('/user/get/products', async (req, res) => {
  const { categoria } = req.query;
  const query = `SELECT * FROM productos WHERE estado = 'activo' AND categoria = ?`;
  let queryParams = categoria;

  pool.query(query,queryParams, (err, results) => {
    if (err) {
      console.error('Error fetching categories:', err);
      res.status(500).send('Error fetching categories');
    } else {
      res.status(200).json(results);
    }
  });
});
//Obtener usuarios por rol
app.get('/admin/get/users/rol', async (req, res) => {
  const { categoria, username } = req.query;

  let query = 'SELECT * FROM usuarios WHERE rol = ? AND nombre_negocio = (SELECT nombre_negocio FROM usuarios WHERE nombre = ? LIMIT 1)LIMIT 0, 25;';
  let queryParams = [categoria, username ];

  pool.query(query, queryParams, (err, results) => {
    if (err) {
      console.error('Error fetching products:', err);
      res.status(500).send('Error fetching products');
    } else {
      res.status(200).json(results);
    }
  });
});


app.get('/admin/get/users/rol/super', async (req, res) => {
  const { categoria } = req.query;

  let query = 'SELECT * FROM usuarios WHERE rol = ? ;';
  let queryParams = [categoria ];

  pool.query(query, queryParams, (err, results) => {
    if (err) {
      console.error('Error fetching products:', err);
      res.status(500).send('Error fetching products');
    } else {
      res.status(200).json(results);
    }
  });
});


app.get('/admin/get/users', async (req, res) => {
  const { username } = req.query;

  let query = "SELECT * FROM usuarios where (rol = 'user' OR rol = 'admin') AND nombre_negocio = (SELECT nombre_negocio FROM usuarios WHERE nombre = ? LIMIT 1)LIMIT 0, 25 ";
  let queryParams = [ username];

  pool.query(query, queryParams, (err, results) => {
    if (err) {
      console.error('Error fetching products:', err);
      res.status(500).send('Error fetching products');
    } else {
      res.status(200).json(results);
    }
  });
});

app.get('/admin/get/users/super', async (req, res) => {
  const { categoria } = req.query;

  let query = 'SELECT * FROM usuarios';
  let queryParams = categoria;

  pool.query(query, queryParams, (err, results) => {
    if (err) {
      console.error('Error fetching products:', err);
      res.status(500).send('Error fetching products');
    } else {
      res.status(200).json(results);
    }
  });
});


app.get('/admin/get/users/business', async (req, res) => {
  const { nombre } = req.query;

  let query = 'SELECT nombre_negocio FROM usuarios where nombre = ?';
  let queryParams = nombre;

  pool.query(query, queryParams, (err, results) => {
    if (err) {
      console.error('Error fetching business name:', err);
      res.status(500).send('Error fetching business name');
    } else {
      res.status(200).json(results);
    }
  });
});

app.get('/admin/get/users/ubicacion', async (req, res) => {
  const { nombre } = req.query;

  let query = 'SELECT ubicacion FROM usuarios where nombre = ?';
  let queryParams = nombre;

  pool.query(query, queryParams, (err, results) => {
    if (err) {
      console.error('Error fetching ubicacion name:', err);
      res.status(500).send('Error fetching ubicacion name');
    } else {
      res.status(200).json(results);
    }
  });
});


app.put('/admin/update/user/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  console.log(nombre, password, id)
  const query = `UPDATE usuarios SET password = ?  WHERE id = ?`;

  pool.query(query, [hashedPassword, id], (err, result) => {
    if (err) {
      console.error('Error updating product:', err);
      return res.status(500).send('Error updating product');
    }

    res.status(200).send('Producto actualizado');
  });



});

app.post('/admin/create/mesa', async (req, res) => {
  const { mesa, estado } = req.body;
  const sourceTableName = 'mesas';

  pool.getConnection((err, connection) => {
    if (err) return res.status(500).send(err);

    const checkTableExistsQuery = `SHOW TABLES LIKE '${sourceTableName}'`;
    connection.query(checkTableExistsQuery, (err, results) => {
      if (err) {
        connection.release();
        return res.status(500).send(err);
      }

      if (results.length === 0) {
        const createTableQuery = `CREATE TABLE ${sourceTableName} (
          id INT AUTO_INCREMENT PRIMARY KEY,
          mesa INT NOT NULL,
          estado VARCHAR(255) NOT NULL
        )`;
        connection.query(createTableQuery, (err) => {
          if (err) {
            connection.release();
            return res.status(500).send(err);
          }
          connection.query(`INSERT INTO ${sourceTableName} (mesa, estado) VALUES (?, ?)`, [mesa, estado], (err, result) => {
            connection.release();
            if (err) {
              return res.status(500).send(err);
            }
            res.status(201).send('Producto añadido y tabla creada');
          });
        });
      } else {
        connection.query(`INSERT INTO ${sourceTableName} (mesa, estado) VALUES (?, ?)`, [mesa, estado], (err, result) => {
          connection.release();
          if (err) {
            return res.status(500).send(err);
          }
          res.status(201).send('Producto añadido');
        });
      }
    });
  });
});

app.get('/admin/get/mesa', async (req, res) => {
  let query = 'SELECT * FROM mesas';
  pool.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching products:', err);
      res.status(500).send('Error fetching products');
    } else {
      res.status(200).json(results);
    }
  });
});

app.put('/admin/update/mesa/:id', async (req, res) => {
  const { id } = req.params;
  const { mesa, estado } = req.body;

  const query = `UPDATE mesas SET mesa = ?, estado = ? WHERE id = ?`;

  pool.query(query, [mesa, estado, id], (err, result) => {
    if (err) {
      console.error('Error updating product:', err);
      return res.status(500).send('Error updating product');
    }

    res.status(200).send('Producto actualizado');
  });
});

app.post('/user/create/new/payment', async (req, res) => {
  const { metodoPago, totalVenta, descuentoTotal, propina, montoPagado, cambioDevuelto} = req.body;
  const sourceTableName = 'ventasHoy';

  pool.getConnection((err, connection) => {
    if (err) return res.status(500).send(err);

    const checkTableExistsQuery = `SHOW TABLES LIKE '${sourceTableName}'`;
    connection.query(checkTableExistsQuery, (err, results) => {
      if (err) {
        connection.release();
        return res.status(500).send(err);
      }

      if (results.length === 0) {
        const createTableQuery = `CREATE TABLE ${sourceTableName} (
          id INT AUTO_INCREMENT PRIMARY KEY,
          metodoPago INT NOT NULL,
          totalVenta INT NOT NULL ,
          descuentoTotal INT NOT NULL,
          propina INT NOT NULL,
          montoPagado INT NOT NULL,
          cambioDevuelto INT NOT NULL,
        )`;
        connection.query(createTableQuery, (err) => {
          if (err) {
            connection.release();
            return res.status(500).send(err);
          }
          connection.query(`INSERT INTO ${sourceTableName} (metodoPago, totalVenta, descuentoTotal, propina, montoPagado, cambioDevuelto) VALUES (?, ?, ? ,?, ?, ?)`, [metodoPago, totalVenta, descuentoTotal, propina, montoPagado, cambioDevuelto], (err, result) => {
            connection.release();
            if (err) {
              return res.status(500).send(err);
            }
            res.status(201).send('Producto añadido y tabla creada');
          });
        });
      } else {
        connection.query(`INSERT INTO ${sourceTableName} (metodoPago, totalVenta, descuentoTotal, propina, montoPagado, cambioDevuelto) VALUES (?, ?, ? ,?, ?, ?)`, [metodoPago, totalVenta, descuentoTotal, propina, montoPagado, cambioDevuelto], (err, result) => {
          connection.release();
          if (err) {
            return res.status(500).send(err);
          }
          res.status(201).send('Producto añadido');
        });
      }
    });
  });
});

app.get('/admin/get/payments', async (req, res) => {
  let query = 'SELECT * FROM ventasHoy';
  pool.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching products:', err);
      res.status(500).send('Error fetching products');
    } else {
      res.status(200).json(results);
    }
  });
});

app.post('/user/create/new/order', async (req, res) => {
  const { ordenes } = req.body;
  if (!Array.isArray(ordenes) || ordenes.length === 0) {
    return res.status(400).send('No orders provided');
  }

  const mesa = ordenes[0].mesa; // Asumiendo que todas las órdenes son para la misma mesa
  const sourceTableName = 'ordenes';
  const sourceTableMesa = `orden_${mesa}`;

  pool.getConnection((err, connection) => {
    if (err) return res.status(500).send(err);

    connection.beginTransaction(err => {
      if (err) {
        connection.release();
        return res.status(500).send(err);
      }

      const checkTableExistsQuery = `SHOW TABLES LIKE '${sourceTableName}'`;
      connection.query(checkTableExistsQuery, (err, results) => {
        if (err) {
          return connection.rollback(() => {
            connection.release();
            res.status(500).send(err);
          });
        }

        const createOrInsert = () => {
          const insertQuery = `INSERT INTO ${sourceTableName} (mesa, producto, cantidad, precioUnitario, entregado, pagado) VALUES ?`;
          const orderValues = ordenes.map(order => [order.mesa, order.producto, order.cantidad, order.precioUnitario, order.entregado, order.pagado]);

          connection.query(insertQuery, [orderValues], err => {
            if (err) {
              return connection.rollback(() => {
                connection.release();
                res.status(500).send(err);
              });
            }

            const insertMesaQuery = `INSERT INTO ${sourceTableMesa} (producto, cantidad, precioUnitario, entregado, pagado) VALUES ?`;
            const mesaOrderValues = ordenes.map(order => [order.producto, order.cantidad, order.precioUnitario, order.entregado, order.pagado]);

            connection.query(insertMesaQuery, [mesaOrderValues], err => {
              if (err) {
                return connection.rollback(() => {
                  connection.release();
                  res.status(500).send(err);
                });
              }

              connection.commit(err => {
                if (err) {
                  return connection.rollback(() => {
                    connection.release();
                    res.status(500).send(err);
                  });
                }
                connection.release();
                res.status(201).send('Ordenes añadidas');
              });
            });
          });
        };

        const createTableIfNotExists = (tableName, createTableQuery, callback) => {
          connection.query(`SHOW TABLES LIKE '${tableName}'`, (err, results) => {
            if (err) {
              return connection.rollback(() => {
                connection.release();
                res.status(500).send(err);
              });
            }

            if (results.length === 0) {
              connection.query(createTableQuery, err => {
                if (err) {
                  return connection.rollback(() => {
                    connection.release();
                    res.status(500).send(err);
                  });
                }
                callback();
              });
            } else {
              callback();
            }
          });
        };

        createTableIfNotExists(
          sourceTableName,
          `CREATE TABLE ${sourceTableName} (
            id INT AUTO_INCREMENT PRIMARY KEY,
            mesa INT NOT NULL,
            producto VARCHAR(255) NOT NULL,
            cantidad INT NOT NULL,
            precioUnitario INT NOT NULL,
            entregado VARCHAR(255) NOT NULL,
            pagado VARCHAR(255) NOT NULL
          )`,
          () => {
            createTableIfNotExists(
              sourceTableMesa,
              `CREATE TABLE ${sourceTableMesa} (
                id INT AUTO_INCREMENT PRIMARY KEY,
                producto VARCHAR(255) NOT NULL,
                cantidad INT NOT NULL,
                precioUnitario INT NOT NULL,
                entregado VARCHAR(255) NOT NULL,
                pagado VARCHAR(255) NOT NULL
              )`,
              () => {
                connection.query(`DELETE FROM ${sourceTableMesa}`, err => {
                  if (err) {
                    return connection.rollback(() => {
                      connection.release();
                      res.status(500).send(err);
                    });
                  }
                  createOrInsert();
                });
              }
            );
          }
        );
      });
    });
  });
});

app.get('/user/get/orders', async (req, res) => {
  let query = 'SELECT * FROM ordenes';
  pool.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching products:', err);
      res.status(500).send('Error fetching products');
    } else {
      res.status(200).json(results);
    }
  });
});

app.get('/user/get/orders/mesa', async (req, res) => {
  const { mesa } = req.query;

  let query = `SELECT * FROM orden_${mesa}`;
  let queryParams = mesa;

  pool.query(query, queryParams, (err, results) => {
    if (err) {
      console.error('Error fetching products:', err);
      res.status(500).send('Error fetching products');
    } else {
      res.status(200).json(results);
    }
  });
});

app.put('/user/update/orden/:mesa', async (req, res) => {
  const {mesa} = req.params;
  const {producto, cantidad } = req.body
  
  const query = `UPDATE ordenes SET cantidad = ? WHERE mesa = ? and producto = ?`;

  pool.query(query, [cantidad ,mesa, producto], (err, result) => {
    if (err) {
      console.error('Error updating product:', err);
      return res.status(500).send('Error updating product');
    }

    res.status(200).send('Producto actualizado');
  });
  const queryMesa = `UPDATE orden_${mesa}  SET cantidad = ? where producto = ?`;

  pool.query(queryMesa, [cantidad , producto], (err, result) => {
    if (err) {
      console.error('Error updating product:', err);
      return res.status(500).send('Error updating product');
    }

    res.status(200).send('Producto actualizado');
  });
});

app.post('/user/insert/orden/:mesa', async (req, res) => {
  const {mesa} = req.params;
  const {producto, cantidad, precioUnitario, entregado, pagado } = req.body
  
  const query = `INSERT INTO ordenes (mesa, producto, cantidad, precioUnitario, entregado, pagado)
    VALUES (?, ?, ?, ?, ?, ?)`;

  pool.query(query, [mesa , producto, cantidad, precioUnitario, entregado, pagado], (err, result) => {
    if (err) {
      console.error('Error updating product:', err);
      return res.status(500).send('Error updating product');
    }

    res.status(200).send('Producto actualizado');
  });
  
  const queryMesa = `INSERT INTO orden_${mesa} (producto, cantidad, precioUnitario, entregado, pagado)
    VALUES (?, ?, ?, ?, ?)`;

  pool.query(queryMesa, [producto, cantidad, precioUnitario, entregado, pagado], (err, result) => {
    if (err) {
      console.error('Error updating product:', err);
      return res.status(500).send('Error updating product');
    }

    res.status(200).send('Producto actualizado');
  });
});

// Función para insertar el PDF en la base de datos
function insertPdf(filePath) {
  // Leer el archivo PDF
  fs.readFile(filePath, (err, data) => {
      if (err) {
          return console.error('Error al leer el archivo PDF: ' + err.message);
      }

      // Preparar la consulta SQL
      const query = 'INSERT INTO pdf_files (name, data) VALUES (?, ?)';
      const values = [path.basename(filePath), data];

      // Ejecutar la consulta
      pool.query(query, values, (err, results) => {
          if (err) {
              return console.error('Error al insertar el PDF en la base de datos: ' + err.message);
          }
          console.log('PDF insertado con éxito. ID:', results.insertId);
      });
  });
}
// Insertar el PDF llamando a la función
 
// const filePath = './descarga.jpg';
//  insertPdf(filePath);

// Endpoint para descargar el archivo PDF usando su ID
app.get('/download/example', (req, res) => {
  const fileId = req.params.id;

  // Consulta SQL para obtener el archivo PDF por ID
  const query = 'SELECT name, data FROM pdf_files WHERE id = 2';
  pool.query(query, [fileId], (err, results) => {
    if (err) {
      console.error('Error al recuperar el archivo de la base de datos:', err);
      return res.status(500).send('Error al obtener el archivo');
    }

    if (results.length === 0) {
      return res.status(404).send('Archivo no encontrado');
    }

    const file = results[0];

    // Configurar encabezados para que el archivo se descargue como PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${file.name}`);
    
    // Enviar el archivo PDF como respuesta
    res.send(file.data);
  });
});



app.listen(port, () => {
  console.log(`Servidor ejecutándose en el puerto ${port}`);
});